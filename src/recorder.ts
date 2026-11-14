// Records every call's events with their timing, so a call can be replayed on the dashboard later
// (/dashboard/?replay or ?replay=<name>). Saved to recordings/ once the summary arrives
// (or 30 s after the call ended, if no summary comes).
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { bus, type CallEvent } from './events';

export const RECORDINGS_DIR = path.join(__dirname, '..', 'recordings');
const SAVE_AFTER_END_MS = 30_000;

interface Recording {
  room: string;
  startedAt: string;
  events: { t: number; event: CallEvent }[]; // t = seconds since the call started
}

const active = new Map<string, { started: number; recording: Recording }>();

function save(room: string) {
  const entry = active.get(room);
  if (!entry) return;
  active.delete(room);
  const stamp = entry.recording.startedAt.slice(0, 16).replace(/[:T]/g, '-');
  const name = `${stamp}-${room.slice(-6)}`;
  mkdirSync(RECORDINGS_DIR, { recursive: true });
  const json = JSON.stringify(entry.recording, null, 2);
  writeFileSync(path.join(RECORDINGS_DIR, `${name}.json`), json);
  writeFileSync(path.join(RECORDINGS_DIR, 'latest.json'), json);
  console.log(`[recorder] Saved call as recordings/${name}.json (replay: /dashboard/?replay=${name})`);
}

export function startRecorder() {
  bus.on((event) => {
    if (event.type === 'call_started') {
      const now = Date.now();
      active.set(event.room, { started: now, recording: { room: event.room, startedAt: new Date(now).toISOString(), events: [] } });
    }
    const entry = active.get(event.room);
    if (!entry) return;
    entry.recording.events.push({ t: (Date.now() - entry.started) / 1000, event });
    if (event.type === 'summary') save(event.room);
    if (event.type === 'call_ended') setTimeout(() => save(event.room), SAVE_AFTER_END_MS);
  });
}

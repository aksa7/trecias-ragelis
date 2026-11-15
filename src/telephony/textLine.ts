// Simulated SMS line, the text version of the browser phones: the scammer's text page posts a message
// here, and it reaches the brain as a one-line "call" in its own room (text-…). The text is held until
// the brain has judged it: only a clean text is delivered (a text_delivered action); one with even a slight
// sign of a scam is blocked (a victim_warning action), and actions.ts texts the family.
// The texts never touch a real number; only the family alerts are real SMS.
import type { FastifyInstance } from 'fastify';
import { bus, type Level } from '../events';
import { whenAssessed } from '../brain';
import { say } from '../language';

const MAX_LENGTH = 600;
const MAX_HOLD_MS = 8000; // deliver anyway if the judging takes longer than this
// Much stricter than calls: any sign of a scam blocks a text. Clean texts (a clinic reminder, family plans)
// score ~5; a bank claiming "unusual activity" or a relative "in trouble" on a new number score 15+.
const BLOCK_RISK = 15;

export const isTextRoom = (room: string) => room.startsWith('text-');

export function registerTextLine(app: FastifyInstance) {
  const verdicts = new Map<string, { level: Level; risk: number; reason: string }>();
  bus.on((event) => {
    if (!isTextRoom(event.room) || (event.type !== 'level' && event.type !== 'risk')) return;
    const verdict = verdicts.get(event.room) ?? { level: 1, risk: 0, reason: '' };
    if (event.type === 'level') verdicts.set(event.room, { ...verdict, level: event.level, reason: event.level > 1 ? event.reason : verdict.reason });
    else verdicts.set(event.room, { ...verdict, risk: event.score, reason: verdict.level > 1 ? verdict.reason : event.reason });
  });

  app.post<{ Body: { text?: string } }>('/text', async (req, reply) => {
    const text = String(req.body?.text ?? '').trim().slice(0, MAX_LENGTH);
    if (!text) return reply.code(400).send({ error: 'text is empty' });

    const room = `text-${Date.now().toString(36)}`;
    bus.emit({ type: 'call_started', room, from: 'sms:scammer' });
    bus.emit({ type: 'transcript', room, role: 'scammer', text });
    void deliverWhenJudged(room, text);
    return { room };
  });

  async function deliverWhenJudged(room: string, text: string) {
    await new Promise((resolve) => setImmediate(resolve)); // let the brain pick the text up first
    await Promise.race([whenAssessed(room), new Promise((resolve) => setTimeout(resolve, MAX_HOLD_MS))]);
    const { level = 1, risk = 0, reason = '' } = verdicts.get(room) ?? {};
    verdicts.delete(room);
    const blocked = level >= 3 || risk >= BLOCK_RISK;
    console.log(`[text] ${blocked ? 'Blocked' : 'Delivered'} (risk ${risk}): ${text.slice(0, 60)}`);
    if (!blocked) {
      bus.emit({ type: 'action', room, kind: 'text_delivered', text });
    } else {
      const what = level === 5 ? say('Sukčių SMS užblokuota', 'Scam text blocked') : say('Įtartina SMS užblokuota', 'Suspicious text blocked');
      bus.emit({ type: 'action', room, kind: 'victim_warning', text: `${what}: ${reason}` });
    }
  }
}

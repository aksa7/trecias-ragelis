// Simulated SMS line, the text version of the browser phones: the scammer's text page posts a message
// here, and it reaches the brain as a one-line "call" in its own room (text-…). The text is held until
// the brain has judged it: a scam (level 5) never reaches the victim, anything else is delivered
// (a text_delivered action) with its verdict. actions.ts words the family alerts for a text.
// The texts never touch a real number; only the family alerts are real SMS.
import type { FastifyInstance } from 'fastify';
import { bus, type Level } from '../events';
import { whenAssessed } from '../brain';

const MAX_LENGTH = 600;
const MAX_HOLD_MS = 8000; // deliver anyway if the judging takes longer than this

export const isTextRoom = (room: string) => room.startsWith('text-');

export function registerTextLine(app: FastifyInstance) {
  const levels = new Map<string, Level>();
  bus.on((event) => {
    if (event.type === 'level' && isTextRoom(event.room)) levels.set(event.room, event.level);
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
    const blocked = levels.get(room) === 5;
    levels.delete(room);
    console.log(`[text] ${blocked ? 'Blocked' : 'Delivered'}: ${text.slice(0, 60)}`);
    if (!blocked) bus.emit({ type: 'action', room, kind: 'text_delivered', text });
  }
}

// Simulated SMS line, the text version of the browser phones: the scammer's text page posts a message
// here, and it reaches the brain as a one-line "call" in its own room (text-…). Risk, levels and the
// family SMS work as for calls; actions.ts words them for a text, and the victim's Messages page shows
// the text with the verdict. The texts never touch a real number; only the family alerts are real SMS.
import type { FastifyInstance } from 'fastify';
import { bus } from '../events';

const MAX_LENGTH = 600;

export const isTextRoom = (room: string) => room.startsWith('text-');

export function registerTextLine(app: FastifyInstance) {
  app.post<{ Body: { text?: string } }>('/text', async (req, reply) => {
    const text = String(req.body?.text ?? '').trim().slice(0, MAX_LENGTH);
    if (!text) return reply.code(400).send({ error: 'text is empty' });

    const room = `text-${Date.now().toString(36)}`;
    bus.emit({ type: 'call_started', room, from: 'sms:scammer' });
    bus.emit({ type: 'transcript', room, role: 'scammer', text });
    return { room };
  });
}

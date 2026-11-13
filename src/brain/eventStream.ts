// GET /events: every bus event as Server-Sent Events (one "data: <json>" message per event).
// New connections first receive recent history, so a page opened mid-call catches up.
import type { FastifyInstance } from 'fastify';
import { bus, type CallEvent } from '../events';

const HISTORY_SIZE = 500;

export function registerEventStream(app: FastifyInstance) {
  const history: CallEvent[] = [];
  bus.on((event) => {
    history.push(event);
    if (history.length > HISTORY_SIZE) history.shift();
  });

  app.get('/events', (req, reply) => {
    reply.hijack();
    const res = reply.raw;
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const send = (event: CallEvent) => res.write(`data: ${JSON.stringify(event)}\n\n`);
    history.forEach(send);
    const off = bus.on(send);
    const ping = setInterval(() => res.write(': ping\n\n'), 15_000); // keeps tunnels from closing it

    req.raw.on('close', () => {
      off();
      clearInterval(ping);
    });
  });
}

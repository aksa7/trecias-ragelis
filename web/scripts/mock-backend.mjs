// Stand-in for the real backend: serves GET /events as Server-Sent Events on :3000.
// Use it to work on the dashboard without Twilio, and as a reference for the
// exact wire format the backend must send.
//
//   node scripts/mock-backend.mjs     (then: npm run dev, open http://localhost:5173)
import http from 'node:http';

const PORT = Number(process.env.PORT ?? 3000);
const room = 'room-CA' + Math.random().toString(16).slice(2, 10);

const script = [
  [1000, { type: 'call_started', room, from: '+37069900123' }],
  [2000, { type: 'action', room, kind: 'monitoring', text: 'BustedAI attached to the line · listening' }],
  [3500, { type: 'transcript', room, role: 'scammer', text: 'Sveiki, čia policija. Jūsų sūnus pateko į avariją.' }],
  [5000, { type: 'risk', room, score: 55, reason: 'Authority impersonation + emergency' }],
  [5200, { type: 'level', room, level: 3, reason: 'emergency story + pressure' }],
  [6000, { type: 'action', room, kind: 'family_sms', text: 'SMS sent to emergency contact' }],
  [8000, { type: 'transcript', role: 'scammer', room, text: 'Reikia skubiai pervesti užstatą, kitaip jis liks areštinėje.' }],
  [9500, { type: 'risk', room, score: 88, reason: 'Demands urgent money transfer' }],
  [9700, { type: 'level', room, level: 5, reason: 'urgent bail transfer' }],
  [10200, { type: 'action', room, kind: 'intervention', text: 'Guardian voice → victim: “Tai sukčiai. Padėkite ragelį.”' }],
  [13000, { type: 'call_ended', room }],
  [13500, { type: 'summary', room, text: 'Fake police / accident scam. Victim hung up. Family notified.' }],
];

http
  .createServer((req, res) => {
    if (req.url !== '/events') {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    // One SSE message per event: "data: <json>\n\n"
    const send = (event) => res.write(`data: ${JSON.stringify(event)}\n\n`);
    const timers = script.map(([at, event]) => setTimeout(() => send(event), at));
    const keepAlive = setInterval(() => res.write(': ping\n\n'), 15000);
    req.on('close', () => {
      timers.forEach(clearTimeout);
      clearInterval(keepAlive);
    });
    console.log('[mock] dashboard connected, replaying', script.length, 'events');
  })
  .listen(PORT, () => console.log(`[mock] SSE on http://localhost:${PORT}/events`));

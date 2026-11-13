// Replays the dashboard's demo scenarios through the brain, without phones or Twilio.
// Only call_started / transcript / call_ended are replayed; risk, level and summary come from the real brain.
//   npm run replay              all scenarios
//   npm run replay -- bank      one scenario (bank, police, courier, investment)
import 'dotenv/config';
import { bus } from '../src/events';
import { startBrain } from '../src/brain';
import { SCENARIOS } from '../web/src/demo/scenarios';

const SPEED = 2; // replay twice as fast as the scripted timing
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Print everything; subscribed before the brain so lines appear before the reactions to them.
bus.on((e) => {
  if (e.type === 'transcript') console.log(`  ${e.role === 'scammer' ? 'CALLER   ' : 'RECIPIENT'} ${e.text}`);
  if (e.type === 'risk') console.log(`      risk ${e.score}: ${e.reason}`);
  if (e.type === 'level') console.log(`      ▲ LEVEL ${e.level}: ${e.reason}`);
  if (e.type === 'summary') console.log(`  summary: ${e.text}`);
});

function waitForSummary(room: string, ms: number) {
  return new Promise<void>((resolve) => {
    const off = bus.on((e) => {
      if (e.type === 'summary' && e.room === room) {
        off();
        resolve();
      }
    });
    setTimeout(resolve, ms);
  });
}

async function replay(id: string) {
  const scenario = SCENARIOS.find((s) => s.id === id)!;
  const room = `room-REPLAY-${id}`;
  console.log(`\n=== ${scenario.title} (expected level ${scenario.outcome}) ===`);

  let elapsed = 0;
  bus.emit({ type: 'call_started', room, from: '+37060000000' });
  for (const { at, event } of scenario.steps) {
    if (event.type !== 'transcript') continue;
    await sleep((at - elapsed) / SPEED);
    elapsed = at;
    bus.emit({ type: 'transcript', room, role: event.role, text: event.text });
  }
  await sleep(4000); // let the last assessment finish
  const summary = waitForSummary(room, process.env.ANTHROPIC_API_KEY ? 20000 : 0);
  bus.emit({ type: 'call_ended', room });
  await summary;
}

async function main() {
  startBrain();
  const ids = process.argv[2] ? [process.argv[2]] : SCENARIOS.map((s) => s.id);
  for (const id of ids) await replay(id);
  process.exit(0);
}

main();

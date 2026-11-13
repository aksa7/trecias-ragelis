// Brain: listens to transcript events, judges scam risk, and escalates levels.
// Telephony and the dashboard react to the risk / level / summary events it emits.
//
// Two kinds of risk:
//   evidence  - hard facts (keyword hits, requests Claude reports); never goes down during a call
//   suspicion - Claude's current read of the call, turned into a number by rules.ts; can go down
// Displayed risk = max(evidence, suspicion), so it can drop, but never below the evidence.
//
// Levels trigger actions that can't be undone (SMS, cutting the call), so they need more:
//   level 5: evidence >= 80 (codes, PIN, logins, remote access) - instant
//   level 3: evidence >= 50 (transfer, cash, secrecy...) - instant,
//            or suspicion >= 50 in CONFIRMATIONS assessments in a row - one spike is not enough
// Once reached, a level stays.
import { bus, type CallEvent, type Level } from '../events';
import { matchKeywords, victimSaysDigits } from './keywords';
import { judge } from './rules';
import { extractFacts, summarizeCall, type Line } from './scorer';

const CONFIRMATIONS = 2;

interface CallState {
  lines: Line[];
  evidence: number;
  evidenceReason: string;
  suspicion: number;
  suspicionReason: string;
  shownRisk: number;
  level: Level;
  highStreak: number; // consecutive assessments with suspicion >= 50
  requestsSeen: Set<string>;
  scoring: boolean; // a Claude assessment is in flight
  rescore: boolean; // new lines arrived while scoring
}

const calls = new Map<string, CallState>();
// Twilio can deliver the last words after the call ended; they must not start a new "call".
const endedRooms = new Set<string>();

function callFor(room: string): CallState {
  let call = calls.get(room);
  if (!call) {
    call = {
      lines: [],
      evidence: 0,
      evidenceReason: '',
      suspicion: 0,
      suspicionReason: '',
      shownRisk: -1,
      level: 1,
      highStreak: 0,
      requestsSeen: new Set(),
      scoring: false,
      rescore: false,
    };
    calls.set(room, call);
  }
  return call;
}

function raiseLevel(room: string, call: CallState, level: Level, reason: string) {
  if (level <= call.level) return;
  call.level = level;
  bus.emit({ type: 'level', room, level, reason });
}

/** Recompute the shown risk and the level from the current evidence and suspicion. */
function update(room: string, call: CallState) {
  const risk = Math.max(call.evidence, call.suspicion);
  const reason = call.evidence >= call.suspicion ? call.evidenceReason : call.suspicionReason;
  if (risk !== call.shownRisk) {
    call.shownRisk = risk;
    bus.emit({ type: 'risk', room, score: risk, reason });
  }

  if (call.evidence >= 80) raiseLevel(room, call, 5, call.evidenceReason);
  else if (call.evidence >= 50) raiseLevel(room, call, 3, call.evidenceReason);
  if (call.highStreak >= CONFIRMATIONS) raiseLevel(room, call, 3, call.suspicionReason);
}

function addEvidence(call: CallState, score: number, reason: string) {
  if (score > call.evidence) {
    call.evidence = score;
    call.evidenceReason = reason;
  }
}

/** One Claude assessment at a time per call; if lines arrived meanwhile, run once more. */
async function assess(room: string, call: CallState) {
  if (!process.env.ANTHROPIC_API_KEY) return;
  if (call.scoring) {
    call.rescore = true;
    return;
  }
  call.scoring = true;
  try {
    do {
      call.rescore = false;
      const started = Date.now();
      const facts = await extractFacts([...call.lines]);
      if (endedRooms.has(room)) return;
      const { evidence, suspicion } = judge(facts);
      console.log(
        `[brain] ${Date.now() - started} ms evidence ${evidence} suspicion ${suspicion} | ${facts.claimed_identity}` +
          ` asks [${facts.requests}] pressure [${facts.pressure}] legit [${facts.legit_cues}] victim ${facts.victim_state}: ${facts.reason}`,
      );

      facts.requests.forEach((r) => call.requestsSeen.add(r));
      addEvidence(call, evidence, facts.reason);
      call.suspicion = suspicion;
      call.suspicionReason = facts.reason;
      call.highStreak = suspicion >= 50 ? call.highStreak + 1 : 0;
      update(room, call);
    } while (call.rescore);
  } catch (err) {
    // Keep the last state; the next transcript line triggers a new attempt.
    console.error('[brain] Claude assessment failed:', err instanceof Error ? err.message : err);
  } finally {
    call.scoring = false;
  }
}

function onTranscript(room: string, line: Line) {
  if (endedRooms.has(room)) return;
  const call = callFor(room);
  call.lines.push(line);

  // Fast path: unmistakable phrases count as evidence instantly, without waiting for Claude.
  const hit = line.role === 'scammer' ? matchKeywords(line.text) : null;
  if (hit) addEvidence(call, hit.floor, hit.reason);
  if (line.role === 'victim' && call.evidence >= 80 && victimSaysDigits(line.text)) {
    addEvidence(call, 95, 'Auka pradeda sakyti kodą');
  }
  if (hit || call.evidence >= 95) update(room, call);

  void assess(room, call);
}

async function onCallEnded(room: string) {
  const call = calls.get(room);
  calls.delete(room);
  endedRooms.add(room);
  if (!call || call.lines.length === 0 || !process.env.ANTHROPIC_API_KEY) return;
  try {
    const text = await summarizeCall(call.lines, call.level, [...call.requestsSeen]);
    bus.emit({ type: 'summary', room, text });
  } catch (err) {
    console.error('[brain] Summary failed:', err instanceof Error ? err.message : err);
  }
}

export function startBrain() {
  if (!process.env.ANTHROPIC_API_KEY) console.warn('[brain] ANTHROPIC_API_KEY is not set: only keyword rules will work.');

  // React after every listener has seen the event, so risk/level never arrive before the line they react to.
  bus.on((event: CallEvent) => queueMicrotask(() => handle(event)));

  function handle(event: CallEvent) {
    if (event.type === 'call_started') {
      callFor(event.room);
      bus.emit({ type: 'level', room: event.room, level: 1, reason: 'Skambutis stebimas' });
    } else if (event.type === 'transcript') {
      onTranscript(event.room, { role: event.role, text: event.text });
    } else if (event.type === 'call_ended') {
      void onCallEnded(event.room);
    }
  }
}

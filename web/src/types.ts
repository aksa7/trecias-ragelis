// Mirror of the backend contract in src/events.ts.
// Keep both files in sync: the dashboard only understands these shapes.

/** Who spoke, as reported by speech-to-text. */
export type Role = 'scammer' | 'victim';

/** Escalation layers. A call can only move up: 1 -> 3 -> 5. */
export type Level = 1 | 3 | 5;

export type ActionKind =
  | 'monitoring' // L1: BustedAI attached to the line
  | 'family_sms' // L3/L5: SMS to the emergency contact
  | 'victim_warning' // L3: guardian politely warns the victim
  | 'intervention'; // L5: guardian tells the victim to hang up

export type CallEvent =
  | { type: 'call_started'; room: string; from: string }
  | { type: 'transcript'; room: string; role: Role; text: string }
  | { type: 'risk'; room: string; score: number; reason: string }
  | { type: 'level'; room: string; level: Level; reason: string }
  /** `speech` = the exact words the guardian said into the call, if any. */
  | { type: 'action'; room: string; kind: ActionKind; text: string; speech?: string }
  | { type: 'call_ended'; room: string }
  | { type: 'summary'; room: string; text: string };

export type EventType = CallEvent['type'];

const EVENT_TYPES: ReadonlySet<string> = new Set<EventType>([
  'call_started',
  'transcript',
  'risk',
  'level',
  'action',
  'call_ended',
  'summary',
]);

/** Narrow unknown JSON from the wire to a CallEvent we can render. */
export function isCallEvent(value: unknown): value is CallEvent {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as { type?: unknown; room?: unknown };
  return typeof v.type === 'string' && EVENT_TYPES.has(v.type) && typeof v.room === 'string';
}

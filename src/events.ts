import { EventEmitter } from 'node:events';

export type Level = 1 | 3 | 5;
export type ActionKind = 'monitoring' | 'family_sms' | 'victim_warning' | 'intervention';

export type CallEvent =
  | { type: 'call_started'; room: string; from: string }
  | { type: 'transcript'; room: string; role: 'scammer' | 'victim'; text: string }
  | { type: 'risk'; room: string; score: number; reason: string }
  | { type: 'level'; room: string; level: Level; reason: string }
  | { type: 'action'; room: string; kind: ActionKind; text: string; speech?: string }
  | { type: 'call_ended'; room: string }
  | { type: 'summary'; room: string; text: string };

const emitter = new EventEmitter();
emitter.setMaxListeners(50);

export const bus = {
  emit: (event: CallEvent) => emitter.emit('event', event),
  /** Returns an unsubscribe function. */
  on: (handler: (event: CallEvent) => void) => {
    emitter.on('event', handler);
    return () => emitter.off('event', handler);
  },
};

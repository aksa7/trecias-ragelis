import type { ActionKind, CallEvent, Level, Role } from '../types';
import { LEVELS, maxLevel, scoreToLevel } from '../lib/levels';

export type CallStatus = 'idle' | 'live' | 'ended';

/** Transcript speakers. "guardian" lines come from action events with speech. */
export type LineRole = Role | 'guardian';

export type LogKind = 'call' | 'ai' | 'risk' | 'sms' | 'voice';

export interface TranscriptLine {
  id: number;
  role: LineRole;
  text: string;
  at: number;
}

export interface LogEntry {
  id: number;
  at: number;
  text: string;
  kind: LogKind;
  /** Escalations and guardian voice are drawn in the accent colour. */
  alert: boolean;
}

export interface CallState {
  status: CallStatus;
  room: string | null;
  from: string | null;
  startedAt: number | null;
  endedAt: number | null;
  transcript: TranscriptLine[];
  /** Highest score seen in this call. Shown instead of the latest so it never "calms down". */
  peakScore: number;
  reason: string;
  level: Level;
  log: LogEntry[];
  summary: string | null;
  /** Bumped on every spoken line; the eye glances when it changes. */
  activity: number;
  nextId: number;
}

export type CallAction = { kind: 'event'; event: CallEvent; at: number } | { kind: 'reset' };

export const initialCallState: CallState = {
  status: 'idle',
  room: null,
  from: null,
  startedAt: null,
  endedAt: null,
  transcript: [],
  peakScore: 0,
  reason: '',
  level: 1,
  log: [],
  summary: null,
  activity: 0,
  nextId: 1,
};

const MAX_LOG = 80;

const ACTION_KIND: Record<ActionKind, LogKind> = {
  monitoring: 'ai',
  family_sms: 'sms',
  victim_warning: 'voice',
  intervention: 'voice',
};

function appendLog(state: CallState, at: number, text: string, kind: LogKind, alert = false): CallState {
  const entry: LogEntry = { id: state.nextId, at, text, kind, alert };
  return { ...state, log: [...state.log, entry].slice(-MAX_LOG), nextId: state.nextId + 1 };
}

function appendLine(state: CallState, role: LineRole, text: string, at: number): CallState {
  const line: TranscriptLine = { id: state.nextId, role, text, at };
  return {
    ...state,
    transcript: [...state.transcript, line],
    activity: state.activity + 1,
    nextId: state.nextId + 1,
  };
}

/** Raise the level (never lower it) and log the escalation once. */
function escalate(state: CallState, target: Level, reason: string, at: number): CallState {
  const next = maxLevel(state.level, target);
  if (next === state.level) return state;
  const why = reason ? `: ${reason}` : '';
  const text = `Raised to ${next} · ${LEVELS[next].name}${why}`;
  return appendLog({ ...state, level: next }, at, text, 'risk', true);
}

function startCall(room: string, from: string, at: number): CallState {
  return appendLog(
    { ...initialCallState, status: 'live', room, from, startedAt: at },
    at,
    'Call intercepted',
    'call',
  );
}

/** If the dashboard opened mid-call, adopt the first room we hear about. */
function ensureRoom(state: CallState, room: string, at: number): CallState | null {
  if (state.room === room) return state;
  if (state.status === 'live') return null; // event for another call: ignore
  return startCall(room, 'unknown', at);
}

export function callReducer(state: CallState, action: CallAction): CallState {
  if (action.kind === 'reset') return initialCallState;

  const { event, at } = action;

  if (event.type === 'call_started') return startCall(event.room, event.from, at);

  const current = ensureRoom(state, event.room, at);
  if (!current) return state;

  switch (event.type) {
    case 'transcript':
      return appendLine(current, event.role, event.text, at);

    case 'risk': {
      const score = Math.max(0, Math.min(100, Math.round(event.score)));
      const isPeak = score >= current.peakScore;
      const scored: CallState = {
        ...current,
        peakScore: isPeak ? score : current.peakScore,
        reason: isPeak && event.reason ? event.reason : current.reason,
      };
      // Fallback for when the backend has not implemented level events yet.
      return escalate(scored, scoreToLevel(score), event.reason, at);
    }

    case 'level':
      return escalate(current, event.level, event.reason, at);

    case 'action': {
      const kind = ACTION_KIND[event.kind];
      const alert = event.kind === 'intervention' || event.kind === 'victim_warning';
      const logged = appendLog(current, at, event.text, kind, alert);
      return event.speech ? appendLine(logged, 'guardian', event.speech, at) : logged;
    }

    case 'call_ended':
      return appendLog({ ...current, status: 'ended', endedAt: at }, at, 'Call ended', 'call');

    case 'summary':
      return { ...current, summary: event.text };
  }
}

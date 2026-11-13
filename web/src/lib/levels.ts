import type { Level } from '../types';

export interface LevelInfo {
  level: Level;
  name: string;
  /** What the caller is doing at this level. */
  signal: string;
  /** What BustedAI does at this level. */
  response: string;
}

export const LEVELS: Record<Level, LevelInfo> = {
  1: {
    level: 1,
    name: 'Monitor',
    signal: 'Unknown caller, small talk or offers',
    response: 'Listens silently',
  },
  3: {
    level: 3,
    name: 'Alert',
    signal: 'Urgency, asks for money',
    response: 'Guardian warns the victim, family gets an SMS',
  },
  5: {
    level: 5,
    name: 'Intervene',
    signal: 'Asks for Smart-ID, PIN or logins',
    response: 'Guardian tells the victim to hang up, family notified',
  },
};

export const LEVEL_ORDER: readonly Level[] = [1, 3, 5];

/** Thresholds used only when the backend sends a score but no level event. */
export function scoreToLevel(score: number): Level {
  if (score >= 80) return 5;
  if (score >= 50) return 3;
  return 1;
}

export function maxLevel(a: Level, b: Level): Level {
  return a >= b ? a : b;
}

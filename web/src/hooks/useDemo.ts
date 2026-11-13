import { useCallback, useEffect, useRef, useState } from 'react';
import type { CallEvent } from '../types';
import type { Scenario } from '../demo/scenarios';

/** Plays a scripted call through the same handler as live events. */
export function useDemo(onEvent: (event: CallEvent) => void) {
  const [running, setRunning] = useState<Scenario | null>(null);
  const timers = useRef<number[]>([]);
  const handler = useRef(onEvent);
  handler.current = onEvent;

  const stop = useCallback(() => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
    setRunning(null);
  }, []);

  const start = useCallback(
    (scenario: Scenario) => {
      stop();
      setRunning(scenario);
      const last = scenario.steps.at(-1)?.at ?? 0;
      timers.current = scenario.steps.map((step) => window.setTimeout(() => handler.current(step.event), step.at));
      timers.current.push(window.setTimeout(() => setRunning(null), last + 50));
    },
    [stop],
  );

  useEffect(() => stop, [stop]);

  return { running, start, stop };
}

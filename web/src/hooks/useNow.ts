import { useEffect, useState } from 'react';

/** Current time, refreshed on an interval. Pass active=false to freeze it. */
export function useNow(intervalMs = 250, active = true): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs, active]);

  return now;
}

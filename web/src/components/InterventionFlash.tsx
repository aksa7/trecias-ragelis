import { useEffect, useState } from 'react';
import type { CallState } from '../state/callReducer';

interface InterventionFlashProps {
  call: CallState;
}

/**
 * Full-screen risk-5 beat: red tint + two sweeping bands.
 * Plays once per call (~1.8 s). Status-line fill is handled in CSS via data-level.
 */
export function InterventionFlash({ call }: InterventionFlashProps) {
  const [visible, setVisible] = useState(false);
  const trigger = call.status === 'live' && call.level === 5 ? call.room : null;

  useEffect(() => {
    if (!trigger) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    setVisible(true);
    const id = window.setTimeout(() => setVisible(false), 1800);
    return () => window.clearTimeout(id);
  }, [trigger]);

  if (!visible) return null;

  return (
    <div className="flash" aria-hidden>
      <div className="flash__tint" />
      <div className="flash__band flash__band--wide" />
      <div className="flash__band flash__band--narrow" />
    </div>
  );
}

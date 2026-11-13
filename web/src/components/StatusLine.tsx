import type { CallState } from '../state/callReducer';
import type { Level } from '../types';
import { PROTECTED_NAME } from '../config';

const firstName = PROTECTED_NAME.split(',')[0]?.trim() || 'the victim';

const LIVE_TEXT: Record<Level, string> = {
  1: 'Monitoring. No risk detected.',
  3: `Alert. Guardian warned ${firstName}, family notified.`,
  5: `Intervening. Guardian told ${firstName} to hang up.`,
};

const OUTCOME_TEXT: Record<Level, string> = {
  1: 'Call ended. No threat.',
  3: 'Call ended. Flagged, family informed.',
  5: 'Call ended. Threat neutralized.',
};

interface StatusLineProps {
  call: CallState;
}

/** One sentence under the top bar that says what is happening right now. */
export function StatusLine({ call }: StatusLineProps) {
  let text = 'Waiting for a call.';
  if (call.status === 'live') text = LIVE_TEXT[call.level];
  if (call.status === 'ended') text = OUTCOME_TEXT[call.level];

  return (
    <div className={`statusline statusline--${call.status} statusline--l${call.level}`} role="status" aria-live="polite">
      {text}
    </div>
  );
}

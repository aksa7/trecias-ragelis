import type { CallState } from '../state/callReducer';
import type { Level } from '../types';
import { maskNumber } from '../lib/format';
import { EMERGENCY_CONTACT, PROTECTED_NAME } from '../config';
import { Eye } from './Eye';

function watcherState(call: CallState): string {
  if (call.status === 'idle') return 'Standing by';
  if (call.status === 'ended') return 'Case closed';
  const byLevel: Record<Level, string> = { 1: 'Listening', 3: 'Suspicious', 5: 'Intervening' };
  return byLevel[call.level];
}

interface CallDetailsProps {
  call: CallState;
}

export function CallDetails({ call }: CallDetailsProps) {
  return (
    <>
      <section className="block block--eye">
        <Eye level={call.level} status={call.status} activity={call.activity} />
        <p className="watcher-state">{watcherState(call)}</p>
      </section>

      <section className="block">
        <h2 className="label">Call</h2>
        <dl className="facts">
          <dt>Caller</dt>
          <dd>{call.from ? maskNumber(call.from) : '—'}</dd>
          <dt>Protected</dt>
          <dd>{PROTECTED_NAME}</dd>
          <dt>Emergency contact</dt>
          <dd>{EMERGENCY_CONTACT}</dd>
          <dt>Line</dt>
          <dd className="muted">{call.room ?? '—'}</dd>
        </dl>
      </section>
    </>
  );
}

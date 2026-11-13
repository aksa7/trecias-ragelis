import type { CallState } from '../state/callReducer';
import type { StreamStatus } from '../hooks/useEventStream';
import { formatClock, formatDuration } from '../lib/format';
import { useNow } from '../hooks/useNow';
import { Logo } from './Logo';

const FEED_TEXT: Record<StreamStatus, string> = {
  online: 'Feed online',
  connecting: 'Connecting',
  offline: 'Feed offline',
};

interface TopBarProps {
  call: CallState;
  stream: StreamStatus;
}

export function TopBar({ call, stream }: TopBarProps) {
  const now = useNow(250);
  const elapsed = call.startedAt ? (call.endedAt ?? now) - call.startedAt : 0;

  return (
    <header className="topbar">
      <div className="brand">
        <Logo status={call.status} level={call.level} room={call.room} />
        <span className="brand__tag">Line guardian</span>
      </div>

      <div className={`callclock callclock--${call.status}`}>
        {call.status === 'idle' ? (
          <span className="muted">No active call</span>
        ) : (
          <>
            <span className="callclock__state">{call.status === 'live' ? 'Live' : 'Ended'}</span>
            <span className="callclock__time">{formatDuration(elapsed)}</span>
          </>
        )}
      </div>

      <div className="topbar__meta">
        <span className={`feed feed--${stream}`}>{FEED_TEXT[stream]}</span>
        <span className="topbar__clock">{formatClock(now)}</span>
      </div>
    </header>
  );
}

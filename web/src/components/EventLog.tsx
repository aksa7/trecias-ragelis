import type { CallState, LogKind } from '../state/callReducer';
import { formatClock } from '../lib/format';
import { useStickToBottom } from '../hooks/useStickToBottom';

const KIND_LABEL: Record<LogKind, string> = {
  call: 'Call',
  ai: 'AI',
  risk: 'Risk',
  sms: 'SMS',
  voice: 'Voice',
};

interface EventLogProps {
  call: CallState;
}

export function EventLog({ call }: EventLogProps) {
  const { ref, following, scrollToBottom } = useStickToBottom<HTMLDivElement>();
  const lastId = call.log.at(-1)?.id;
  const actions = call.log.filter((e) => e.kind === 'sms' || e.kind === 'voice').length;
  const actionLabel = actions === 0 ? 'No actions yet' : `${actions} action${actions === 1 ? '' : 's'} taken`;
  const empty = call.log.length === 0;

  return (
    <section className="block block--grow log-panel">
      <header className="section-head">
        <h2 className="label">Event log</h2>
        <span className="label muted">{actionLabel}</span>
      </header>

      <div className="log__scroll" ref={ref}>
        <ol className="log">
          {empty && <li className="log__empty">Armed. No events yet.</li>}
          {call.log.map((entry) => {
            const alert = entry.alert || entry.kind === 'risk' || entry.kind === 'voice';
            const newest = entry.id === lastId;
            return (
              <li
                key={entry.id}
                className={[
                  'log__entry',
                  `log__entry--${entry.kind}`,
                  alert ? 'is-alert' : '',
                  newest ? 'is-newest' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <time className="log__time">{formatClock(entry.at)}</time>
                <span className="log__kind">{KIND_LABEL[entry.kind]}</span>
                <span className="log__text">{entry.text}</span>
              </li>
            );
          })}
        </ol>
        {call.summary && (
          <div className="report">
            <h3 className="label">Case report</h3>
            <p>{call.summary}</p>
          </div>
        )}
      </div>

      {!following && !empty && (
        <button type="button" className="jump" onClick={() => scrollToBottom(true)}>
          Latest ↓
        </button>
      )}
    </section>
  );
}

import type { CallState, LineRole } from '../state/callReducer';
import { formatDuration } from '../lib/format';
import { useStickToBottom } from '../hooks/useStickToBottom';
import { TypedText } from './TypedText';

const ROLE_LABEL: Record<LineRole, string> = {
  scammer: 'Caller',
  victim: 'Victim',
  guardian: 'BustedAI',
};

interface TranscriptProps {
  call: CallState;
}

export function Transcript({ call }: TranscriptProps) {
  const { ref, following, scrollToBottom } = useStickToBottom<HTMLDivElement>();
  const lastId = call.transcript.at(-1)?.id;
  const empty = call.transcript.length === 0;

  return (
    <section className="transcript">
      <header className="section-head">
        <h2 className="label">Transcript</h2>
        <span className="label muted">Lithuanian · live</span>
      </header>

      <div className="transcript__scroll" ref={ref}>
        <ol className="transcript__lines">
          {call.transcript.map((line) => (
            <li key={line.id} className={`line line--${line.role}`}>
              <span className="line__time">{formatDuration(line.at - (call.startedAt ?? line.at))}</span>
              <span className="line__role">{ROLE_LABEL[line.role]}</span>
              <p className="line__text">
                <TypedText text={line.text} animate={line.id === lastId} highlight={line.role !== 'guardian'} />
              </p>
            </li>
          ))}
        </ol>
        {empty && (
          <p className="transcript__empty">
            {call.status === 'live' ? 'Listening on the line' : 'Transcript appears here when a call comes in'}
            <span className="caret caret--blink" aria-hidden />
          </p>
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

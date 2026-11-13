import type { CallState } from '../state/callReducer';
import type { Level } from '../types';
import { LEVEL_ORDER, LEVELS } from '../lib/levels';

const SEGMENTS = [1, 2, 3, 4, 5];

type StepState = 'pending' | 'active' | 'done';

function stepState(step: Level, call: CallState): StepState {
  if (call.status === 'idle' || step > call.level) return 'pending';
  return step === call.level ? 'active' : 'done';
}

interface RiskPanelProps {
  call: CallState;
}

export function RiskPanel({ call }: RiskPanelProps) {
  const idle = call.status === 'idle';
  const level = idle ? 0 : call.level;
  const name = idle ? 'Idle' : LEVELS[call.level].name;
  const action = idle ? '—' : LEVELS[call.level].response;

  return (
    <section className="block risk">
      <header className="section-head">
        <h2 className="label">Risk</h2>
        <p className="risk__score">
          Score <span className="num">{call.peakScore}</span><span className="muted">/100</span>
        </p>
      </header>

      <div className="risk__main">
        <span
          key={level}
          className="risk__level"
          aria-label={`Risk level ${level} of 5`}
        >
          {level}
        </span>
        <div className="risk__side">
          <span className="risk__name">{name}</span>
          <div className="segments" aria-hidden>
            {SEGMENTS.map((n) => (
              <span key={n} className={`segments__bar ${n <= level ? 'is-on' : ''}`} />
            ))}
          </div>
        </div>
      </div>

      <ol className="protocol-row" aria-label="Response protocol">
        {LEVEL_ORDER.map((step) => {
          const state = stepState(step, call);
          return (
            <li key={step} className={`protocol-row__step is-${state} protocol-row__step--l${step}`}>
              <span className="protocol-row__label">
                {step} {LEVELS[step].name}
              </span>
            </li>
          );
        })}
      </ol>

      <dl className="facts facts--tight">
        <dt>Action</dt>
        <dd>{action}</dd>
        <dt>Reason</dt>
        <dd>{call.reason || <span className="muted">—</span>}</dd>
      </dl>
    </section>
  );
}

import { useEffect, useRef } from 'react';
import { SCENARIOS, type Scenario } from '../demo/scenarios';

interface ScenarioMenuProps {
  onPick: (scenario: Scenario) => void;
  onClose: () => void;
}

/** Modal list of demo calls. Number keys and Escape are handled by the app. */
export function ScenarioMenu({ onPick, onClose }: ScenarioMenuProps) {
  const firstButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    firstButton.current?.focus();
  }, []);

  return (
    <div className="menu-backdrop" onClick={onClose}>
      <div
        className="menu"
        role="dialog"
        aria-modal="true"
        aria-labelledby="menu-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="menu__head">
          <h2 id="menu-title" className="label">
            Run a demo call
          </h2>
          <span className="label muted">Esc to close</span>
        </header>
        <ul className="menu__list">
          {SCENARIOS.map((scenario, i) => (
            <li key={scenario.id}>
              <button
                type="button"
                className="menu__item"
                ref={i === 0 ? firstButton : undefined}
                onClick={() => onPick(scenario)}
              >
                <kbd>{scenario.key}</kbd>
                <span className="menu__text">
                  <span className="menu__title">{scenario.title}</span>
                  <span className="menu__plot">{scenario.plot}</span>
                </span>
                <span className={`menu__outcome menu__outcome--l${scenario.outcome}`}>Risk {scenario.outcome}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

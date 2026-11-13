import { useCallback, useEffect, useReducer, useState } from 'react';
import type { CallEvent } from './types';
import { callReducer, initialCallState } from './state/callReducer';
import { SCENARIOS, scenarioByKey, type Scenario } from './demo/scenarios';
import { useEventStream } from './hooks/useEventStream';
import { useDemo } from './hooks/useDemo';
import { TopBar } from './components/TopBar';
import { StatusLine } from './components/StatusLine';
import { CallDetails } from './components/CallDetails';
import { Transcript } from './components/Transcript';
import { RiskPanel } from './components/RiskPanel';
import { EventLog } from './components/EventLog';
import { ScenarioMenu } from './components/ScenarioMenu';
import { Footer } from './components/Footer';
import { InterventionFlash } from './components/InterventionFlash';

const EVENTS_URL: string = import.meta.env.VITE_EVENTS_URL ?? '/events';
const params = new URLSearchParams(window.location.search);
/** ?offline disables the live feed. ?demo=2 autoplays scenario 2 (?demo alone plays 1). */
const LIVE_ENABLED = !params.has('offline');
const AUTOPLAY = params.has('demo') ? (scenarioByKey(params.get('demo') || '1') ?? SCENARIOS[0]) : null;

export function App() {
  const [call, dispatch] = useReducer(callReducer, initialCallState);
  const [menuOpen, setMenuOpen] = useState(false);

  const handleEvent = useCallback((event: CallEvent) => {
    dispatch({ kind: 'event', event, at: Date.now() });
  }, []);

  const stream = useEventStream(EVENTS_URL, LIVE_ENABLED, handleEvent);
  const { running: demo, start: startDemo, stop: stopDemo } = useDemo(handleEvent);

  const reset = useCallback(() => {
    stopDemo();
    setMenuOpen(false);
    dispatch({ kind: 'reset' });
  }, [stopDemo]);

  const runScenario = useCallback(
    (scenario: Scenario) => {
      setMenuOpen(false);
      dispatch({ kind: 'reset' });
      startDemo(scenario);
    },
    [startDemo],
  );

  useEffect(() => {
    if (AUTOPLAY) runScenario(AUTOPLAY);
  }, [runScenario]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      const key = e.key.toLowerCase();
      const scenario = scenarioByKey(key);
      if (scenario) runScenario(scenario);
      else if (key === 'd') setMenuOpen((open) => !open);
      else if (key === 'escape') setMenuOpen(false);
      else if (key === 'r') reset();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [runScenario, reset]);

  return (
    <div className="app" data-status={call.status} data-level={call.status === 'idle' ? 0 : call.level}>
      <TopBar call={call} stream={stream} />
      <StatusLine call={call} />

      <main className="layout">
        <aside className="col col--left">
          <CallDetails call={call} />
        </aside>
        <div className="col col--center">
          <Transcript call={call} />
        </div>
        <aside className="col col--right">
          <RiskPanel call={call} />
          <EventLog call={call} />
        </aside>
      </main>

      <Footer demo={demo} liveEnabled={LIVE_ENABLED} onMenu={() => setMenuOpen((open) => !open)} onReset={reset} />

      {menuOpen && <ScenarioMenu onPick={runScenario} onClose={() => setMenuOpen(false)} />}
      <InterventionFlash call={call} />
    </div>
  );
}

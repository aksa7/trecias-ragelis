import type { Scenario } from '../demo/scenarios';

interface FooterProps {
  demo: Scenario | null;
  liveEnabled: boolean;
  onMenu: () => void;
  onReset: () => void;
}

export function Footer({ demo, liveEnabled, onMenu, onReset }: FooterProps) {
  let mode = liveEnabled ? 'Live mode · listening on /events' : 'Offline mode · press D for a demo call';
  if (demo) mode = `Demo: ${demo.title}`;

  return (
    <footer className="footer">
      <span className="muted">{mode}</span>
      <span className="footer__spacer" />
      <button type="button" className="key" onClick={onMenu}>
        <kbd>D</kbd> Demo calls
      </button>
      <span className="key key--static">
        <kbd>1</kbd>–<kbd>4</kbd> Run
      </span>
      <button type="button" className="key" onClick={onReset}>
        <kbd>R</kbd> Reset
      </button>
    </footer>
  );
}

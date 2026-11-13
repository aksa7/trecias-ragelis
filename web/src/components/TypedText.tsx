import { useEffect, useState } from 'react';
import { splitByTriggers } from '../lib/keywords';

interface TypedTextProps {
  text: string;
  /** Type the text out character by character (used for the newest line only). */
  animate: boolean;
  /** Underline scam trigger words. */
  highlight?: boolean;
  msPerChar?: number;
}

/** Transcript text with scam trigger words underlined, optionally typed out. */
export function TypedText({ text, animate, highlight = true, msPerChar = 14 }: TypedTextProps) {
  const [shown, setShown] = useState(animate ? 0 : text.length);

  useEffect(() => {
    if (!animate) {
      setShown(text.length);
      return;
    }
    setShown(0);
    const id = window.setInterval(() => {
      setShown((n) => {
        if (n >= text.length) {
          window.clearInterval(id);
          return n;
        }
        return n + 1;
      });
    }, msPerChar);
    return () => window.clearInterval(id);
  }, [text, animate, msPerChar]);

  const segments = highlight ? splitByTriggers(text) : [{ text, flagged: false }];
  let budget = shown;

  return (
    <>
      {segments.map((segment, i) => {
        if (budget <= 0) return null;
        const visible = segment.text.slice(0, budget);
        budget -= segment.text.length;
        return segment.flagged ? (
          <mark key={i} className="trigger">
            {visible}
          </mark>
        ) : (
          <span key={i}>{visible}</span>
        );
      })}
      {shown < text.length && <span className="caret" aria-hidden />}
    </>
  );
}

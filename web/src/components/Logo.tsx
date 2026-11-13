import { useEffect, useRef } from 'react';
import type { Level } from '../types';
import type { CallStatus } from '../state/callReducer';

interface LogoProps {
  status: CallStatus;
  level: Level;
  /** Changes when a new call starts (room id) so the decode can replay. */
  room: string | null;
}

const WORD = 'BustedAI';
const GLYPHS = '01<>/\\=+*#%$&?ABCDEFXZ';

const randGlyph = () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)]!;

/**
 * Monospace wordmark that "decodes" into BustedAI, with a blinking block cursor
 * and occasional single-character glitches. ASCII-only so the width never jumps.
 */
export function Logo({ status, level, room }: LogoProps) {
  const charsRef = useRef<HTMLSpanElement>(null);
  const cursorRef = useRef<HTMLSpanElement>(null);
  const input = useRef({ status, level, room });
  input.current = { status, level, room };

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const host = charsRef.current;
    const cursor = cursorRef.current;
    if (!host || !cursor) return;

    const spans = Array.from(host.querySelectorAll<HTMLSpanElement>('[data-i]'));
    let frame = 0;
    let decodeUntil = 0;
    let decodeStart = 0;
    let nextGlitch = performance.now() + 5000;
    let glitchIndex = -1;
    let glitchUntil = 0;
    let saved = '';
    let lastRoom: string | null = null;
    let lastLevel: Level = 1;
    let cursorOn = true;
    let nextCursor = 0;

    const paint = (text: string) => {
      for (let i = 0; i < spans.length; i++) {
        const ch = text[i] ?? ' ';
        spans[i]!.textContent = ch;
        spans[i]!.classList.toggle('logo__ch--dim', i >= 6 && text === WORD);
      }
    };

    const scramble = () => Array.from(WORD, () => randGlyph()).join('');

    const startDecode = (now: number) => {
      if (reduce) {
        paint(WORD);
        decodeUntil = 0;
        return;
      }
      paint(scramble());
      decodeStart = now;
      decodeUntil = now + 700;
    };

    startDecode(performance.now());

    const tick = (now: number) => {
      const { status: st, level: lvl, room: rm } = input.current;

      if (!rm) {
        lastRoom = null;
        lastLevel = 1;
      } else if (rm !== lastRoom) {
        lastRoom = rm;
        lastLevel = 1;
        startDecode(now);
      }
      if (st === 'live' && lvl === 5 && lastLevel !== 5) {
        lastLevel = 5;
        startDecode(now);
      } else if (lvl !== 5) {
        lastLevel = lvl;
      }

      if (decodeUntil && now < decodeUntil) {
        const elapsed = now - decodeStart;
        const settled = Math.min(WORD.length, Math.floor(elapsed / 45));
        let out = '';
        for (let i = 0; i < WORD.length; i++) {
          out += i < settled ? WORD[i]! : randGlyph();
        }
        paint(out);
      } else if (decodeUntil && now >= decodeUntil) {
        paint(WORD);
        decodeUntil = 0;
      } else if (!reduce) {
        if (glitchIndex >= 0 && now >= glitchUntil) {
          const chars = WORD.split('');
          chars[glitchIndex] = saved;
          paint(chars.join(''));
          glitchIndex = -1;
          nextGlitch = now + 5000;
        } else if (glitchIndex < 0 && now >= nextGlitch) {
          glitchIndex = Math.floor(Math.random() * WORD.length);
          saved = WORD[glitchIndex]!;
          const chars = WORD.split('');
          chars[glitchIndex] = randGlyph();
          paint(chars.join(''));
          glitchUntil = now + 110;
        }
      }

      const hot = st === 'live' && (lvl === 3 || lvl === 5);
      cursor.classList.toggle('logo__cursor--hot', hot);

      if (!reduce && now >= nextCursor) {
        cursorOn = !cursorOn;
        cursor.style.opacity = cursorOn ? '1' : '0';
        nextCursor = now + 530;
      } else if (reduce) {
        cursor.style.opacity = '1';
      }

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <span className="logo" aria-label="BustedAI">
      <span className="logo__chars" ref={charsRef} aria-hidden>
        {Array.from(WORD).map((_, i) => (
          <span key={i} data-i={i} className={i >= 6 ? 'logo__ch logo__ch--dim' : 'logo__ch'}>
            {WORD[i]}
          </span>
        ))}
      </span>
      <span ref={cursorRef} className="logo__cursor" aria-hidden />
    </span>
  );
}

import { useEffect, useMemo, useRef } from 'react';
import type { Level } from '../types';
import type { CallStatus } from '../state/callReducer';

interface EyeProps {
  level: Level;
  status: CallStatus;
  /** Changes on every spoken line; the eye glances toward the transcript. */
  activity: number;
}

const W = 220;
const H = 130;
const CX = W / 2;
const CY = H / 2 + 2;
const HALF_W = 90;
const IRIS_R = 25;
const MAX_GAZE_X = 28;
const MAX_GAZE_Y = 8;
const FIBRE_COUNT = 56;

/** Pupil radius per level: relaxed, focused, locked on. */
const PUPIL_R: Record<Level, number> = { 1: 8.5, 3: 6.5, 5: 4.2 };

const lerp = (from: number, to: number, t: number) => from + (to - from) * t;
const rand = (min: number, max: number) => min + Math.random() * (max - min);
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

/** Fixed seeded lengths so fibres never re-randomise across frames or remounts. */
function fibreLengths(count: number): number[] {
  let seed = 0x9e3779b9;
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    out.push(0.42 + (seed % 1000) / 1000 * 0.5);
  }
  return out;
}

interface LidGeom {
  /** Inner / outer corners (outer sits slightly higher). */
  ix: number;
  iy: number;
  ox: number;
  oy: number;
  /** Upper-lid control points (high arch). */
  u1x: number;
  u1y: number;
  u2x: number;
  u2y: number;
  /** Lower-lid control points (shallow). */
  l1x: number;
  l1y: number;
  l2x: number;
  l2y: number;
  /** Crease above the upper lid. */
  c1x: number;
  c1y: number;
  c2x: number;
  c2y: number;
}

/**
 * Asymmetric almond: upper lid arches more, outer corner higher than inner.
 * `upperDrop` 0 = fully open upper lid; 1 = upper lid meets the lower lid.
 * `lowerRise` lifts the lower lid for a slight squint.
 * `gazeY` nudges the upper lid with vertical gaze.
 */
function lids(open: number, upperDrop: number, lowerRise: number, gazeY: number): LidGeom {
  const rise = open;
  const drop = clamp(upperDrop, 0, 1);
  const squat = clamp(lowerRise, 0, 1);

  const ix = CX - HALF_W;
  const ox = CX + HALF_W;
  const iy = CY + 3;
  const oy = CY - 4;

  const upperPeak = 38 * rise;
  const lowerPeak = 16 * rise;
  const gazeLift = gazeY * -0.35;

  // When blinking, the upper lid descends toward the lower curve.
  const meetY = CY + 4 * rise * (1 - squat);
  const uPeakY = lerp(CY - upperPeak + gazeLift, meetY - 2, drop);
  const uCornerY = lerp(0, meetY - iy, drop * 0.85);

  const lPeakY = CY + lowerPeak * (1 - squat * 0.55);

  return {
    ix,
    iy: iy + uCornerY * 0.15,
    ox,
    oy: oy + uCornerY * 0.1,
    u1x: CX - 42,
    u1y: uPeakY + 2,
    u2x: CX + 38,
    u2y: uPeakY - 4,
    l1x: CX + 48,
    l1y: lPeakY - 1,
    l2x: CX - 40,
    l2y: lPeakY + 2,
    c1x: CX - 48,
    c1y: uPeakY - 10,
    c2x: CX + 44,
    c2y: uPeakY - 14,
  };
}

function upperPath(g: LidGeom): string {
  return `M${g.ix} ${g.iy} C${g.u1x} ${g.u1y} ${g.u2x} ${g.u2y} ${g.ox} ${g.oy}`;
}

function lowerPath(g: LidGeom): string {
  return `M${g.ox} ${g.oy} C${g.l1x} ${g.l1y} ${g.l2x} ${g.l2y} ${g.ix} ${g.iy}`;
}

function aperturePath(g: LidGeom): string {
  return `${upperPath(g)} C${g.l1x} ${g.l1y} ${g.l2x} ${g.l2y} ${g.ix} ${g.iy} Z`;
}

function creasePath(g: LidGeom): string {
  return `M${g.ix + 8} ${g.iy - 6} C${g.c1x} ${g.c1y} ${g.c2x} ${g.c2y} ${g.ox - 6} ${g.oy - 8}`;
}

/**
 * A single-stroke eye that watches the call. One rAF loop writes SVG attributes
 * through refs so React does not re-render every frame.
 */
export function Eye({ level, status, activity }: EyeProps) {
  const upperRef = useRef<SVGPathElement>(null);
  const lowerRef = useRef<SVGPathElement>(null);
  const creaseRef = useRef<SVGPathElement>(null);
  const clipRef = useRef<SVGPathElement>(null);
  const irisGroupRef = useRef<SVGGElement>(null);
  const pupilRef = useRef<SVGCircleElement>(null);
  const limbalRef = useRef<SVGCircleElement>(null);
  const irisFillRef = useRef<SVGCircleElement>(null);
  const fibreGroupRef = useRef<SVGGElement>(null);
  const catch1Ref = useRef<SVGCircleElement>(null);
  const catch2Ref = useRef<SVGCircleElement>(null);
  const lidShadowRef = useRef<SVGRectElement>(null);
  const gradRef = useRef<SVGRadialGradientElement>(null);

  const fibres = useMemo(() => fibreLengths(FIBRE_COUNT), []);

  const input = useRef({ level, status, glanceUntil: 0 });
  input.current.level = level;
  input.current.status = status;

  useEffect(() => {
    if (activity > 0) input.current.glanceUntil = performance.now() + 900;
  }, [activity]);

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let frame = 0;
    let open = 0.35;
    let upperDrop = 0;
    let lowerRise = 0;
    let gx = 0;
    let gy = 0;
    let pupil = PUPIL_R[1];
    let target = { x: 0, y: 0 };
    let nextSaccade = 0;
    let blinkPhase: 'idle' | 'closing' | 'opening' | 'pause' = 'idle';
    let blinkT = 0;
    let blinkStart = 0;
    let doublePending = false;
    let nextBlink = performance.now() + rand(2600, 6800);
    let oscPhase = 0;

    const applyGeom = (g: LidGeom) => {
      upperRef.current?.setAttribute('d', upperPath(g));
      lowerRef.current?.setAttribute('d', lowerPath(g));
      creaseRef.current?.setAttribute('d', creasePath(g));
      clipRef.current?.setAttribute('d', aperturePath(g));
    };

    const paintRisk = (lvl: Level, live: boolean) => {
      const hot = live && (lvl === 3 || lvl === 5);
      const centre = hot ? '#5a1814' : '#3b3a36';
      const edge = hot ? '#2a0c0a' : '#1c1b19';
      const stop0 = gradRef.current?.querySelector('[data-stop="0"]');
      const stop1 = gradRef.current?.querySelector('[data-stop="1"]');
      stop0?.setAttribute('stop-color', centre);
      stop1?.setAttribute('stop-color', edge);
      limbalRef.current?.setAttribute('stroke', hot ? 'var(--accent)' : '#0e0e0d');
      fibreGroupRef.current?.setAttribute('stroke', live && lvl === 5 ? 'var(--accent)' : '#8a8780');
      fibreGroupRef.current?.setAttribute('opacity', live && lvl === 5 ? '0.45' : '0.22');
    };

    const tick = (now: number) => {
      const { level: lvl, status: st, glanceUntil } = input.current;
      const live = st === 'live';
      const locked = lvl === 5 && live;

      // Blinking: upper lid drops to meet the lower lid (~150 ms).
      if (!reduceMotion && !locked) {
        if (blinkPhase === 'idle' && now >= nextBlink) {
          blinkPhase = 'closing';
          blinkStart = now;
          blinkT = 0;
          doublePending = Math.random() < 0.18;
        } else if (blinkPhase === 'closing') {
          blinkT = clamp((now - blinkStart) / 75, 0, 1);
          if (blinkT >= 1) {
            blinkPhase = 'opening';
            blinkStart = now;
          }
        } else if (blinkPhase === 'opening') {
          blinkT = 1 - clamp((now - blinkStart) / 75, 0, 1);
          if (blinkT <= 0) {
            if (doublePending) {
              doublePending = false;
              blinkPhase = 'pause';
              blinkStart = now;
            } else {
              blinkPhase = 'idle';
              nextBlink = now + rand(2600, 6800);
            }
          }
        } else if (blinkPhase === 'pause') {
          if (now - blinkStart > 90) {
            blinkPhase = 'closing';
            blinkStart = now;
            blinkT = 0;
          }
        }
      } else {
        blinkPhase = 'idle';
        blinkT = 0;
      }

      const blinkAmount = blinkPhase === 'idle' || blinkPhase === 'pause' ? 0 : blinkT;

      // Gaze.
      if (locked) {
        target = { x: 0, y: 0 };
      } else if (now < glanceUntil) {
        target = { x: MAX_GAZE_X * 0.9, y: MAX_GAZE_Y * 0.35 };
      } else if (!reduceMotion && now >= nextSaccade) {
        const range = st === 'idle' ? 0.45 : 1;
        target = {
          x: rand(-1, 1) * MAX_GAZE_X * range,
          y: rand(-1, 1) * MAX_GAZE_Y * range,
        };
        nextSaccade = now + rand(700, 2400);
      }

      const targetOpen = st === 'idle' ? 0.48 : locked ? 0.78 : 1;
      const targetLower = locked ? 0.28 : 0;
      open = reduceMotion ? targetOpen : lerp(open, targetOpen, 0.1);
      lowerRise = reduceMotion ? targetLower : lerp(lowerRise, targetLower, 0.1);
      upperDrop = reduceMotion ? 0 : lerp(upperDrop, blinkAmount, blinkAmount > upperDrop ? 0.55 : 0.35);
      gx = reduceMotion ? target.x : lerp(gx, target.x, 0.18);
      gy = reduceMotion ? target.y : lerp(gy, target.y, 0.18);

      oscPhase += 0.04;
      const osc = Math.sin(oscPhase) * 0.3;
      const pupilTarget = PUPIL_R[st === 'idle' ? 1 : lvl] + osc;
      pupil = reduceMotion ? pupilTarget : lerp(pupil, pupilTarget, 0.1);

      const g = lids(open, upperDrop, lowerRise, gy);
      applyGeom(g);

      irisGroupRef.current?.setAttribute('transform', `translate(${gx.toFixed(2)} ${gy.toFixed(2)})`);
      pupilRef.current?.setAttribute('r', pupil.toFixed(2));
      catch1Ref.current?.setAttribute('cx', String(CX + pupil * 0.35));
      catch1Ref.current?.setAttribute('cy', String(CY - pupil * 0.4));
      catch2Ref.current?.setAttribute('cx', String(CX - pupil * 0.25));
      catch2Ref.current?.setAttribute('cy', String(CY + pupil * 0.15));

      // Soft lid shadow tracks the upper lid.
      const shadowTop = Math.min(g.u1y, g.u2y) - 4;
      lidShadowRef.current?.setAttribute('y', shadowTop.toFixed(2));
      lidShadowRef.current?.setAttribute('height', Math.max(8, CY - shadowTop + 6).toFixed(2));

      paintRisk(lvl, live);

      frame = requestAnimationFrame(tick);
    };

    // Initial pose.
    applyGeom(lids(0.48, 0, 0, 0));
    paintRisk(input.current.level, input.current.status === 'live');
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const initial = lids(0.48, 0, 0, 0);

  return (
    <svg
      className={`eye eye--l${level} eye--${status}`}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="BustedAI is watching the call"
    >
      <defs>
        <clipPath id="eye-aperture">
          <path ref={clipRef} d={aperturePath(initial)} />
        </clipPath>
        <radialGradient ref={gradRef} id="eye-iris-grad" cx="42%" cy="38%" r="65%">
          <stop data-stop="0" offset="0%" stopColor="#3b3a36" />
          <stop data-stop="1" offset="100%" stopColor="#1c1b19" />
        </radialGradient>
        <linearGradient id="eye-lid-shadow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#000" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#000" stopOpacity="0" />
        </linearGradient>
      </defs>

      <g clipPath="url(#eye-aperture)">
        <rect className="eye__sclera" x={0} y={0} width={W} height={H} />
        <g ref={irisGroupRef}>
          <circle ref={irisFillRef} className="eye__iris-fill" cx={CX} cy={CY} r={IRIS_R} fill="url(#eye-iris-grad)" />
          <g ref={fibreGroupRef} className="eye__fibres" stroke="#8a8780" strokeWidth={0.6} opacity={0.22}>
            {fibres.map((len, i) => {
              const a = (i / FIBRE_COUNT) * Math.PI * 2;
              const inner = 2.2;
              const outer = IRIS_R * len;
              return (
                <line
                  key={i}
                  x1={CX + Math.cos(a) * inner}
                  y1={CY + Math.sin(a) * inner}
                  x2={CX + Math.cos(a) * outer}
                  y2={CY + Math.sin(a) * outer}
                />
              );
            })}
          </g>
          <circle
            ref={limbalRef}
            className="eye__limbal"
            cx={CX}
            cy={CY}
            r={IRIS_R - 0.5}
            fill="none"
            stroke="#0e0e0d"
            strokeWidth={2.2}
          />
          <circle ref={pupilRef} className="eye__pupil" cx={CX} cy={CY} r={PUPIL_R[1]} />
          <circle ref={catch1Ref} className="eye__catch eye__catch--main" cx={CX + 3} cy={CY - 3} r={2.1} />
          <circle ref={catch2Ref} className="eye__catch eye__catch--soft" cx={CX - 2} cy={CY + 1.5} r={1.1} />
        </g>
        <rect ref={lidShadowRef} className="eye__lid-shadow" x={0} y={0} width={W} height={40} fill="url(#eye-lid-shadow)" />
      </g>

      <path ref={creaseRef} className="eye__crease" d={creasePath(initial)} />
      <path ref={upperRef} className="eye__lid eye__lid--upper" d={upperPath(initial)} />
      <path ref={lowerRef} className="eye__lid eye__lid--lower" d={lowerPath(initial)} />
    </svg>
  );
}

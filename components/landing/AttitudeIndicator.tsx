'use client';

import { useState, useEffect, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Attitude Indicator – pure SVG flight instrument
// ---------------------------------------------------------------------------
// Simulates gentle drone flight motion by compositing several sine / cosine
// oscillations at different frequencies and amplitudes.  Everything is drawn
// with raw SVG – no external charting or graphics libraries required.
// ---------------------------------------------------------------------------

const MONO_FONT = "'SF Mono', Monaco, 'Cascadia Code', monospace";

// Betaflight dark-theme palette
const COLOR = {
  bg: '#141414',
  bezelOuter: '#333',
  bezelInner: '#1f1f1f',
  sky: '#1a2744',
  ground: '#5c3d2e',
  horizon: '#f2f2f2',
  aircraft: '#ffbb00',
  text: '#f2f2f2',
  muted: '#8c8c8c',
  ladderLine: 'rgba(255,255,255,0.55)',
  ladderText: 'rgba(255,255,255,0.7)',
} as const;

// Pitch ladder range
const PITCH_MARKS = [-30, -20, -10, 10, 20, 30];
const PIXELS_PER_DEGREE = 2.8; // vertical scaling for pitch offset

// Roll arc tick positions (degrees)
const ROLL_TICKS = [0, 10, 20, 30, 45, 60, -10, -20, -30, -45, -60];
const MAJOR_ROLL_TICKS = new Set([0, 30, -30, 60, -60]);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AttitudeIndicator() {
  const [pitch, setPitch] = useState(0);
  const [roll, setRoll] = useState(0);
  const [yaw, setYaw] = useState(0);

  // Simulated flight data ---------------------------------------------------
  useEffect(() => {
    let frame: number;
    let t = Math.random() * 1000; // stagger start so every mount looks unique

    const tick = () => {
      t += 0.016; // ~60 fps increment

      // Composite oscillation for pitch (-12 … +12 deg typical)
      const p =
        5.0 * Math.sin(t * 0.47) +
        3.2 * Math.sin(t * 1.13 + 1.0) +
        1.8 * Math.cos(t * 2.07 + 0.5) +
        0.9 * Math.sin(t * 3.51 + 2.3);

      // Composite oscillation for roll (-18 … +18 deg typical)
      const r =
        7.0 * Math.sin(t * 0.31 + 0.8) +
        4.5 * Math.cos(t * 0.87 + 2.1) +
        2.6 * Math.sin(t * 1.73 + 1.4) +
        1.2 * Math.cos(t * 2.91 + 3.0);

      // Yaw: slow drift 0-360
      const y = ((t * 12.0) % 360 + 360) % 360;

      setPitch(p);
      setRoll(r);
      setYaw(y);

      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  // Formatting helper -------------------------------------------------------
  const fmt = useCallback((v: number, decimals = 1) => {
    const sign = v >= 0 ? '+' : '';
    return `${sign}${v.toFixed(decimals)}`;
  }, []);

  // Derived values ----------------------------------------------------------
  const pitchOffset = pitch * PIXELS_PER_DEGREE; // px shift for horizon
  const rollRad = (roll * Math.PI) / 180;

  // We render inside a 280 x 280 viewBox; the component itself is responsive.
  const SIZE = 280;
  const CX = SIZE / 2;
  const CY = SIZE / 2;
  const INSTRUMENT_R = 115; // radius of the visible instrument disc

  return (
    <div
      style={{
        width: '100%',
        maxWidth: 280,
        aspectRatio: '1 / 1',
        background: COLOR.bg,
        borderRadius: 12,
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        width="100%"
        height="100%"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: 'block' }}
      >
        {/* ---------- Defs: filters, clips, gradients ---------- */}
        <defs>
          {/* Glow for the aircraft symbol */}
          <filter id="ai-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
            <feColorMatrix
              in="blur"
              type="matrix"
              values="1 0 0 0 0.2
                      0 0.8 0 0 0.15
                      0 0 0 0 0
                      0 0 0 0.7 0"
              result="glow"
            />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Circular clip for the instrument face */}
          <clipPath id="ai-disc">
            <circle cx={CX} cy={CY} r={INSTRUMENT_R} />
          </clipPath>

          {/* Subtle inner shadow on the bezel */}
          <radialGradient id="ai-bezel-grad" cx="50%" cy="50%" r="50%">
            <stop offset="85%" stopColor={COLOR.bezelInner} stopOpacity="0" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.45" />
          </radialGradient>
        </defs>

        {/* ---------- Outer bezel ---------- */}
        <circle cx={CX} cy={CY} r={INSTRUMENT_R + 18} fill={COLOR.bezelOuter} />
        <circle cx={CX} cy={CY} r={INSTRUMENT_R + 12} fill={COLOR.bezelInner} />

        {/* ---------- Instrument face (clipped) ---------- */}
        <g clipPath="url(#ai-disc)">
          {/*
            Everything inside this group rotates/translates with pitch & roll.
            The transform origin is the centre of the instrument.
          */}
          <g
            transform={`
              rotate(${-roll}, ${CX}, ${CY})
              translate(0, ${pitchOffset})
            `}
          >
            {/* Sky */}
            <rect
              x={CX - 200}
              y={CY - 400}
              width={400}
              height={400}
              fill={COLOR.sky}
            />
            {/* Ground */}
            <rect
              x={CX - 200}
              y={CY}
              width={400}
              height={400}
              fill={COLOR.ground}
            />
            {/* Horizon line */}
            <line
              x1={CX - 200}
              y1={CY}
              x2={CX + 200}
              y2={CY}
              stroke={COLOR.horizon}
              strokeWidth={1.5}
            />

            {/* ---------- Pitch ladder ---------- */}
            {PITCH_MARKS.map((deg) => {
              const y = CY - deg * PIXELS_PER_DEGREE;
              const halfW = deg % 10 === 0 ? 28 : 18;
              return (
                <g key={deg}>
                  <line
                    x1={CX - halfW}
                    y1={y}
                    x2={CX + halfW}
                    y2={y}
                    stroke={COLOR.ladderLine}
                    strokeWidth={1}
                  />
                  {/* Small end-ticks */}
                  <line
                    x1={CX - halfW}
                    y1={y}
                    x2={CX - halfW}
                    y2={y + (deg > 0 ? 4 : -4)}
                    stroke={COLOR.ladderLine}
                    strokeWidth={1}
                  />
                  <line
                    x1={CX + halfW}
                    y1={y}
                    x2={CX + halfW}
                    y2={y + (deg > 0 ? 4 : -4)}
                    stroke={COLOR.ladderLine}
                    strokeWidth={1}
                  />
                  {/* Degree labels */}
                  <text
                    x={CX - halfW - 6}
                    y={y + 3.5}
                    textAnchor="end"
                    fill={COLOR.ladderText}
                    fontSize={8}
                    fontFamily={MONO_FONT}
                  >
                    {Math.abs(deg)}
                  </text>
                  <text
                    x={CX + halfW + 6}
                    y={y + 3.5}
                    textAnchor="start"
                    fill={COLOR.ladderText}
                    fontSize={8}
                    fontFamily={MONO_FONT}
                  >
                    {Math.abs(deg)}
                  </text>
                </g>
              );
            })}
          </g>
        </g>

        {/* ---------- Roll indicator arc (fixed to frame) ---------- */}
        <g>
          {/* Arc path at the top of the instrument */}
          {(() => {
            const arcR = INSTRUMENT_R - 4;
            // Draw an arc from -60 to +60 deg (measuring from top)
            const ticks: React.ReactElement[] = [];

            ROLL_TICKS.forEach((deg) => {
              const angle = ((deg - 90) * Math.PI) / 180;
              const isMajor = MAJOR_ROLL_TICKS.has(deg);
              const innerR = arcR - (isMajor ? 10 : 6);
              const outerR = arcR;
              const x1 = CX + innerR * Math.cos(angle);
              const y1 = CY + innerR * Math.sin(angle);
              const x2 = CX + outerR * Math.cos(angle);
              const y2 = CY + outerR * Math.sin(angle);

              ticks.push(
                <line
                  key={`rt-${deg}`}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={deg === 0 ? COLOR.text : COLOR.muted}
                  strokeWidth={isMajor ? 1.5 : 1}
                />
              );
            });

            // Arc line
            const arcStartAngle = ((-60 - 90) * Math.PI) / 180;
            const arcEndAngle = ((60 - 90) * Math.PI) / 180;
            const sx = CX + arcR * Math.cos(arcStartAngle);
            const sy = CY + arcR * Math.sin(arcStartAngle);
            const ex = CX + arcR * Math.cos(arcEndAngle);
            const ey = CY + arcR * Math.sin(arcEndAngle);

            return (
              <>
                <path
                  d={`M ${sx} ${sy} A ${arcR} ${arcR} 0 0 1 ${ex} ${ey}`}
                  fill="none"
                  stroke={COLOR.muted}
                  strokeWidth={1}
                />
                {ticks}
              </>
            );
          })()}

          {/* Moving roll pointer (triangle) */}
          {(() => {
            const pointerR = INSTRUMENT_R - 15;
            const angle = ((-roll - 90) * Math.PI) / 180;
            const tipX = CX + (pointerR + 12) * Math.cos(angle);
            const tipY = CY + (pointerR + 12) * Math.sin(angle);

            // Small triangle pointing inward
            const baseAngle1 = angle - 0.06;
            const baseAngle2 = angle + 0.06;
            const baseR = pointerR + 4;
            const bx1 = CX + baseR * Math.cos(baseAngle1);
            const by1 = CY + baseR * Math.sin(baseAngle1);
            const bx2 = CX + baseR * Math.cos(baseAngle2);
            const by2 = CY + baseR * Math.sin(baseAngle2);

            return (
              <polygon
                points={`${tipX},${tipY} ${bx1},${by1} ${bx2},${by2}`}
                fill={COLOR.text}
              />
            );
          })()}

          {/* Fixed top centre reference triangle (white, pointing down) */}
          <polygon
            points={`${CX},${CY - INSTRUMENT_R + 16} ${CX - 5},${CY - INSTRUMENT_R + 6} ${CX + 5},${CY - INSTRUMENT_R + 6}`}
            fill={COLOR.text}
          />
        </g>

        {/* ---------- Fixed aircraft symbol ---------- */}
        <g filter="url(#ai-glow)">
          {/* Centre dot */}
          <circle cx={CX} cy={CY} r={3} fill={COLOR.aircraft} />
          {/* Left wing */}
          <line
            x1={CX - 8}
            y1={CY}
            x2={CX - 38}
            y2={CY}
            stroke={COLOR.aircraft}
            strokeWidth={3}
            strokeLinecap="round"
          />
          {/* Left wing down-stroke */}
          <line
            x1={CX - 38}
            y1={CY}
            x2={CX - 38}
            y2={CY + 10}
            stroke={COLOR.aircraft}
            strokeWidth={3}
            strokeLinecap="round"
          />
          {/* Right wing */}
          <line
            x1={CX + 8}
            y1={CY}
            x2={CX + 38}
            y2={CY}
            stroke={COLOR.aircraft}
            strokeWidth={3}
            strokeLinecap="round"
          />
          {/* Right wing down-stroke */}
          <line
            x1={CX + 38}
            y1={CY}
            x2={CX + 38}
            y2={CY + 10}
            stroke={COLOR.aircraft}
            strokeWidth={3}
            strokeLinecap="round"
          />
          {/* Tail stub */}
          <line
            x1={CX}
            y1={CY - 3}
            x2={CX}
            y2={CY - 14}
            stroke={COLOR.aircraft}
            strokeWidth={3}
            strokeLinecap="round"
          />
        </g>

        {/* Inner bezel shadow overlay */}
        <circle cx={CX} cy={CY} r={INSTRUMENT_R} fill="url(#ai-bezel-grad)" />

        {/* Outer ring stroke */}
        <circle
          cx={CX}
          cy={CY}
          r={INSTRUMENT_R + 12}
          fill="none"
          stroke={COLOR.bezelOuter}
          strokeWidth={1}
        />

        {/* ---------- Numeric readouts ---------- */}
        <g fontFamily={MONO_FONT} fontSize={10}>
          {/* Background strip */}
          <rect
            x={CX - 100}
            y={SIZE - 32}
            width={200}
            height={22}
            rx={4}
            fill="rgba(20,20,20,0.85)"
          />

          {/* Pitch */}
          <text x={CX - 82} y={SIZE - 17} fill={COLOR.muted} fontSize={8}>
            PIT
          </text>
          <text x={CX - 58} y={SIZE - 17} fill={COLOR.text} fontSize={10}>
            {fmt(pitch)}°
          </text>

          {/* Roll */}
          <text x={CX - 20} y={SIZE - 17} fill={COLOR.muted} fontSize={8}>
            RLL
          </text>
          <text x={CX + 2} y={SIZE - 17} fill={COLOR.text} fontSize={10}>
            {fmt(roll)}°
          </text>

          {/* Yaw */}
          <text x={CX + 40} y={SIZE - 17} fill={COLOR.muted} fontSize={8}>
            YAW
          </text>
          <text x={CX + 62} y={SIZE - 17} fill={COLOR.text} fontSize={10}>
            {yaw.toFixed(1)}°
          </text>
        </g>
      </svg>
    </div>
  );
}

"use client";

import { useEffect, useRef, useCallback, useState } from "react";

const BUFFER_SIZE = 200;
const SVG_WIDTH = 800;
const SVG_HEIGHT = 200;
const PADDING_LEFT = 44;
const PADDING_RIGHT = 16;
const PADDING_TOP = 28;
const PADDING_BOTTOM = 12;
const PLOT_W = SVG_WIDTH - PADDING_LEFT - PADDING_RIGHT;
const PLOT_H = SVG_HEIGHT - PADDING_TOP - PADDING_BOTTOM;

const CHANNELS = [
  { label: "Accel X", color: "#f97316" },
  { label: "Accel Y", color: "#a855f7" },
  { label: "Accel Z", color: "#06b6d4" },
] as const;

const GRID_LINES = [-2, -1, 0, 1, 2];

const FONT = "'SF Mono', Monaco, 'Cascadia Code', monospace";

function valueToY(v: number): number {
  // -2 -> PADDING_TOP + PLOT_H, +2 -> PADDING_TOP
  return PADDING_TOP + PLOT_H * (1 - (v + 2) / 4);
}

function indexToX(i: number): number {
  return PADDING_LEFT + (i / (BUFFER_SIZE - 1)) * PLOT_W;
}

/** Generate a realistic accelerometer sample */
function generateSample(t: number, channelOffset: number): number {
  const phase = channelOffset * 2.094;
  if (channelOffset === 2) {
    // Z-axis hovers around 1g (gravity)
    const v =
      1.0 +
      0.15 * Math.sin(2 * Math.PI * 0.4 * t + phase) +
      0.08 * Math.sin(2 * Math.PI * 1.5 * t + phase * 1.2) +
      (Math.random() - 0.5) * 0.06;
    return Math.max(-2, Math.min(2, v));
  }
  // X/Y hover around 0g
  const v =
    0.2 * Math.sin(2 * Math.PI * 0.6 * t + phase) +
    0.12 * Math.sin(2 * Math.PI * 1.8 * t + phase * 0.8) +
    0.06 * Math.sin(2 * Math.PI * 3.2 * t + phase * 1.5) +
    (Math.random() - 0.5) * 0.05;
  return Math.max(-2, Math.min(2, v));
}

function buildPolyline(data: number[]): string {
  return data.map((v, i) => `${indexToX(i).toFixed(1)},${valueToY(v).toFixed(1)}`).join(" ");
}

interface AccelerometerWaveformProps {
  /** Live accel data (g). When provided, simulation is disabled. */
  accel?: { x: number; y: number; z: number };
}

export function AccelerometerWaveform({ accel }: AccelerometerWaveformProps) {
  const [buffers, setBuffers] = useState<[number[], number[], number[]]>(() => {
    const initial: [number[], number[], number[]] = [[], [], []];
    for (let i = 0; i < BUFFER_SIZE; i++) {
      const t = (i - BUFFER_SIZE) / 30;
      initial[0].push(generateSample(t, 0));
      initial[1].push(generateSample(t, 1));
      initial[2].push(generateSample(t, 2));
    }
    return initial;
  });

  const tRef = useRef(0);
  const rafRef = useRef<number>(0);
  const lastFrameRef = useRef(0);
  const liveRef = useRef(accel);

  useEffect(() => {
    liveRef.current = accel;
  }, [accel]);

  const tick = useCallback((timestamp: number) => {
    if (lastFrameRef.current === 0) lastFrameRef.current = timestamp;
    const delta = timestamp - lastFrameRef.current;

    if (delta >= 33) {
      lastFrameRef.current = timestamp;
      tRef.current += 1 / 30;
      const t = tRef.current;
      const live = liveRef.current;

      setBuffers((prev) => {
        const next: [number[], number[], number[]] = [
          [...prev[0].slice(1), live ? Math.max(-2, Math.min(2, live.x)) : generateSample(t, 0)],
          [...prev[1].slice(1), live ? Math.max(-2, Math.min(2, live.y)) : generateSample(t, 1)],
          [...prev[2].slice(1), live ? Math.max(-2, Math.min(2, live.z)) : generateSample(t, 2)],
        ];
        return next;
      });
    }

    rafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [tick]);

  return (
    <div style={{ width: "100%", background: "#141414", borderRadius: 6, border: "1px solid #333", overflow: "hidden" }}>
      <svg
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        width="100%"
        height="auto"
        style={{ display: "block" }}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {CHANNELS.map((ch, ci) => (
            <filter key={ci} id={`accel-glow-${ci}`} x="-10%" y="-10%" width="120%" height="120%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
              <feFlood floodColor={ch.color} floodOpacity="0.6" result="color" />
              <feComposite in="color" in2="blur" operator="in" result="colorBlur" />
              <feMerge>
                <feMergeNode in="colorBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          ))}

          <pattern id="accel-scanlines" width="4" height="4" patternUnits="userSpaceOnUse">
            <rect width="4" height="4" fill="#141414" />
            <rect width="4" height="1" fill="#1a1a1a" />
          </pattern>

          <pattern id="accel-grid" width={PLOT_W / 20} height={PLOT_H / 8} patternUnits="userSpaceOnUse" x={PADDING_LEFT} y={PADDING_TOP}>
            <rect width={PLOT_W / 20} height={PLOT_H / 8} fill="none" />
            <line x1="0" y1={PLOT_H / 8} x2={PLOT_W / 20} y2={PLOT_H / 8} stroke="#1a1a1a" strokeWidth="0.5" />
            <line x1={PLOT_W / 20} y1="0" x2={PLOT_W / 20} y2={PLOT_H / 8} stroke="#1a1a1a" strokeWidth="0.5" />
          </pattern>

          <clipPath id="accel-plot-clip">
            <rect x={PADDING_LEFT} y={PADDING_TOP} width={PLOT_W} height={PLOT_H} />
          </clipPath>
        </defs>

        <rect width={SVG_WIDTH} height={SVG_HEIGHT} fill="#141414" />

        <rect x={PADDING_LEFT} y={PADDING_TOP} width={PLOT_W} height={PLOT_H} fill="#111" />
        <rect x={PADDING_LEFT} y={PADDING_TOP} width={PLOT_W} height={PLOT_H} fill="url(#accel-grid)" />
        <rect x={PADDING_LEFT} y={PADDING_TOP} width={PLOT_W} height={PLOT_H} fill="url(#accel-scanlines)" opacity="0.3" />

        {GRID_LINES.filter((v) => v !== -2 && v !== 2).map((v) => (
          <line
            key={v}
            x1={PADDING_LEFT}
            y1={valueToY(v)}
            x2={PADDING_LEFT + PLOT_W}
            y2={valueToY(v)}
            stroke="#333"
            strokeWidth={v === 0 ? 1 : 0.5}
            strokeDasharray={v === 0 ? undefined : "4,4"}
          />
        ))}

        {GRID_LINES.map((v) => (
          <text
            key={v}
            x={PADDING_LEFT - 4}
            y={valueToY(v) + 3}
            textAnchor="end"
            fill="#8c8c8c"
            fontSize="8"
            fontFamily={FONT}
          >
            {v > 0 ? `+${v}` : v}
          </text>
        ))}

        <text
          x={PADDING_LEFT - 4}
          y={PADDING_TOP - 6}
          textAnchor="end"
          fill="#555"
          fontSize="7"
          fontFamily={FONT}
        >
          g
        </text>

        <g clipPath="url(#accel-plot-clip)">
          {CHANNELS.map((ch, ci) => (
            <polyline
              key={ci}
              points={buildPolyline(buffers[ci])}
              fill="none"
              stroke={ch.color}
              strokeWidth="1.5"
              strokeLinejoin="round"
              strokeLinecap="round"
              filter={`url(#accel-glow-${ci})`}
            />
          ))}

          <line
            x1={PADDING_LEFT + PLOT_W}
            y1={PADDING_TOP}
            x2={PADDING_LEFT + PLOT_W}
            y2={PADDING_TOP + PLOT_H}
            stroke="#ffbb00"
            strokeWidth="1"
            opacity="0.5"
          />
        </g>

        <rect
          x={PADDING_LEFT}
          y={PADDING_TOP}
          width={PLOT_W}
          height={PLOT_H}
          fill="none"
          stroke="#333"
          strokeWidth="1"
        />

        <text
          x={PADDING_LEFT + 6}
          y={PADDING_TOP - 8}
          fill="#8c8c8c"
          fontSize="9"
          fontFamily={FONT}
          letterSpacing="1.5"
        >
          ACCELEROMETER
        </text>

        {CHANNELS.map((ch, ci) => {
          const lx = SVG_WIDTH - PADDING_RIGHT - 60;
          const ly = PADDING_TOP + 12 + ci * 14;
          return (
            <g key={ci}>
              <circle cx={lx} cy={ly - 3} r={3} fill={ch.color} />
              <text
                x={lx + 8}
                y={ly}
                fill="#f2f2f2"
                fontSize="8"
                fontFamily={FONT}
              >
                {ch.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

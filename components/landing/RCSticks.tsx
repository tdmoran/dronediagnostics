"use client";

import { useEffect, useRef, useState, useCallback } from "react";

const FONT = "'SF Mono', Monaco, 'Cascadia Code', monospace";

const STICK_SIZE = 140;
const GAP = 40;
const TOTAL_W = STICK_SIZE * 2 + GAP;
const LABEL_H = 18;
const VALUES_H = 28;
const CORNER_LABEL_MARGIN = 10;
const SVG_WIDTH = TOTAL_W;
const SVG_HEIGHT = LABEL_H + STICK_SIZE + VALUES_H + CORNER_LABEL_MARGIN;
const DOT_R = 6;

interface StickPosition {
  x: number; // -1 to +1
  y: number; // -1 to +1
}

/** Map -1..+1 to microseconds 1000..2000 */
function toMicros(v: number): number {
  return Math.round(1500 + v * 500);
}

/** Smoothly animated simulated stick data */
function useSimulatedSticks() {
  const [left, setLeft] = useState<StickPosition>({ x: 0, y: 0.2 });
  const [right, setRight] = useState<StickPosition>({ x: 0, y: 0 });
  const tRef = useRef(0);
  const rafRef = useRef<number>(0);
  const lastFrameRef = useRef(0);

  const tick = useCallback((timestamp: number) => {
    if (lastFrameRef.current === 0) lastFrameRef.current = timestamp;
    const delta = timestamp - lastFrameRef.current;

    if (delta >= 33) {
      lastFrameRef.current = timestamp;
      tRef.current += 1 / 30;
      const t = tRef.current;

      // Left stick: throttle at ~60% with gentle drift, small yaw inputs
      setLeft({
        x:
          0.08 * Math.sin(2 * Math.PI * 0.15 * t) +
          0.05 * Math.sin(2 * Math.PI * 0.4 * t),
        y:
          0.2 +
          0.06 * Math.sin(2 * Math.PI * 0.1 * t) +
          0.03 * Math.sin(2 * Math.PI * 0.35 * t),
      });

      // Right stick: gentle pitch/roll inputs
      setRight({
        x:
          0.15 * Math.sin(2 * Math.PI * 0.25 * t) +
          0.08 * Math.sin(2 * Math.PI * 0.6 * t),
        y:
          0.12 * Math.sin(2 * Math.PI * 0.2 * t + 0.5) +
          0.06 * Math.sin(2 * Math.PI * 0.55 * t),
      });
    }

    rafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [tick]);

  return { left, right };
}

function StickArea({
  pos,
  offsetX,
  labelTop,
  labelBottom,
  axisLabels,
  values,
}: {
  pos: StickPosition;
  offsetX: number;
  labelTop: string;
  labelBottom: [string, string];
  axisLabels: { top: string; bottom: string; left: string; right: string };
  values: [string, string];
}) {
  const cx = offsetX + STICK_SIZE / 2;
  const cy = LABEL_H + STICK_SIZE / 2;
  const dotX = cx + pos.x * (STICK_SIZE / 2 - DOT_R - 4);
  const dotY = cy - pos.y * (STICK_SIZE / 2 - DOT_R - 4); // invert Y

  return (
    <g>
      {/* Label above */}
      <text
        x={cx}
        y={LABEL_H - 5}
        textAnchor="middle"
        fill="#8c8c8c"
        fontSize="9"
        fontFamily={FONT}
        letterSpacing="1"
      >
        {labelTop}
      </text>

      {/* Stick area background */}
      <rect
        x={offsetX}
        y={LABEL_H}
        width={STICK_SIZE}
        height={STICK_SIZE}
        rx={4}
        fill="#1f1f1f"
        stroke="#333"
        strokeWidth="1"
      />

      {/* Subtle grid inside */}
      {[0.25, 0.5, 0.75].map((f) => (
        <g key={f}>
          <line
            x1={offsetX + f * STICK_SIZE}
            y1={LABEL_H}
            x2={offsetX + f * STICK_SIZE}
            y2={LABEL_H + STICK_SIZE}
            stroke="#282828"
            strokeWidth="0.5"
          />
          <line
            x1={offsetX}
            y1={LABEL_H + f * STICK_SIZE}
            x2={offsetX + STICK_SIZE}
            y2={LABEL_H + f * STICK_SIZE}
            stroke="#282828"
            strokeWidth="0.5"
          />
        </g>
      ))}

      {/* Crosshair center lines */}
      <line
        x1={cx}
        y1={LABEL_H}
        x2={cx}
        y2={LABEL_H + STICK_SIZE}
        stroke="#444"
        strokeWidth="1"
      />
      <line
        x1={offsetX}
        y1={cy}
        x2={offsetX + STICK_SIZE}
        y2={cy}
        stroke="#444"
        strokeWidth="1"
      />

      {/* Corner / axis labels */}
      <text
        x={cx}
        y={LABEL_H + 10}
        textAnchor="middle"
        fill="#555"
        fontSize="7"
        fontFamily={FONT}
      >
        {axisLabels.top}
      </text>
      <text
        x={cx}
        y={LABEL_H + STICK_SIZE - 4}
        textAnchor="middle"
        fill="#555"
        fontSize="7"
        fontFamily={FONT}
      >
        {axisLabels.bottom}
      </text>
      <text
        x={offsetX + 4}
        y={cy + 3}
        textAnchor="start"
        fill="#555"
        fontSize="7"
        fontFamily={FONT}
      >
        {axisLabels.left}
      </text>
      <text
        x={offsetX + STICK_SIZE - 4}
        y={cy + 3}
        textAnchor="end"
        fill="#555"
        fontSize="7"
        fontFamily={FONT}
      >
        {axisLabels.right}
      </text>

      {/* Glow trail (larger faded circle behind dot) */}
      <circle cx={dotX} cy={dotY} r={DOT_R + 6} fill="#ffbb00" opacity="0.1" />
      <circle cx={dotX} cy={dotY} r={DOT_R + 3} fill="#ffbb00" opacity="0.15" />

      {/* Stick dot */}
      <circle cx={dotX} cy={dotY} r={DOT_R} fill="#ffbb00" />
      <circle cx={dotX} cy={dotY} r={DOT_R - 2} fill="#ffdd66" opacity="0.6" />

      {/* Numeric values below */}
      <text
        x={offsetX + STICK_SIZE * 0.25}
        y={LABEL_H + STICK_SIZE + 14}
        textAnchor="middle"
        fill="#f2f2f2"
        fontSize="8"
        fontFamily={FONT}
      >
        {values[0]}
      </text>
      <text
        x={offsetX + STICK_SIZE * 0.75}
        y={LABEL_H + STICK_SIZE + 14}
        textAnchor="middle"
        fill="#f2f2f2"
        fontSize="8"
        fontFamily={FONT}
      >
        {values[1]}
      </text>

      {/* Axis name labels below values */}
      <text
        x={offsetX + STICK_SIZE * 0.25}
        y={LABEL_H + STICK_SIZE + 24}
        textAnchor="middle"
        fill="#8c8c8c"
        fontSize="7"
        fontFamily={FONT}
      >
        {labelBottom[0]}
      </text>
      <text
        x={offsetX + STICK_SIZE * 0.75}
        y={LABEL_H + STICK_SIZE + 24}
        textAnchor="middle"
        fill="#8c8c8c"
        fontSize="7"
        fontFamily={FONT}
      >
        {labelBottom[1]}
      </text>
    </g>
  );
}

export function RCSticks() {
  const { left, right } = useSimulatedSticks();

  const thrVal = toMicros(left.y);
  const yawVal = toMicros(left.x);
  const pitVal = toMicros(right.y);
  const rolVal = toMicros(right.x);

  return (
    <div
      style={{
        display: "inline-block",
        background: "#141414",
        borderRadius: 6,
        border: "1px solid #333",
        padding: "8px 12px",
      }}
    >
      <svg
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        width={SVG_WIDTH}
        height={SVG_HEIGHT}
        style={{ display: "block" }}
      >
        {/* Left stick */}
        <StickArea
          pos={left}
          offsetX={0}
          labelTop="LEFT STICK"
          labelBottom={["THR", "YAW"]}
          axisLabels={{ top: "2000", bottom: "1000", left: "1000", right: "2000" }}
          values={[`THR: ${thrVal}`, `YAW: ${yawVal}`]}
        />

        {/* Right stick */}
        <StickArea
          pos={right}
          offsetX={STICK_SIZE + GAP}
          labelTop="RIGHT STICK"
          labelBottom={["PIT", "ROL"]}
          axisLabels={{ top: "2000", bottom: "1000", left: "1000", right: "2000" }}
          values={[`PIT: ${pitVal}`, `ROL: ${rolVal}`]}
        />
      </svg>
    </div>
  );
}

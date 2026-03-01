"use client";

import { useEffect, useRef, useState } from "react";

const MONO_FONT = "'SF Mono', Monaco, 'Cascadia Code', monospace";

// Arc geometry
const CX = 130;
const CY = 130;
const RADIUS = 105;
const STROKE_WIDTH = 12;
const SWEEP_DEG = 270;
const START_ANGLE_DEG = 135; // bottom-left start

function degToRad(deg: number) {
  return (deg * Math.PI) / 180;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = degToRad(angleDeg);
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function describeArc(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number
) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const sweep = endAngle - startAngle;
  const largeArc = sweep > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

function percentToColor(pct: number): string {
  // green #96e212 at 100, yellow #ffbb00 at 50, red #e2123f at 0
  if (pct >= 50) {
    const t = (pct - 50) / 50;
    const r = Math.round(0xff + t * (0x96 - 0xff));
    const g = Math.round(0xbb + t * (0xe2 - 0xbb));
    const b = Math.round(0x00 + t * (0x12 - 0x00));
    return `rgb(${r},${g},${b})`;
  } else {
    const t = pct / 50;
    const r = Math.round(0xe2 + t * (0xff - 0xe2));
    const g = Math.round(0x12 + t * (0xbb - 0x12));
    const b = Math.round(0x3f + t * (0x00 - 0x3f));
    return `rgb(${r},${g},${b})`;
  }
}

function pctToVoltage(pct: number): string {
  // 6S LiPo: 3.0V per cell (0%) to 4.2V per cell (100%)
  const cellV = 3.0 + (pct / 100) * 1.2;
  return (cellV * 6).toFixed(1);
}

// Tick mark positions
const TICKS = [0, 25, 50, 75, 100];

interface BatteryGaugeProps {
  /** Live battery data. When provided, simulation is disabled. */
  battery?: { voltage: number; amperage: number; rssi: number };
}

/** Convert real voltage to percentage assuming 6S LiPo (18.0–25.2V). */
function voltageToPct(v: number): number {
  return Math.max(0, Math.min(100, ((v - 18.0) / (25.2 - 18.0)) * 100));
}

export function BatteryGauge({ battery }: BatteryGaugeProps) {
  const [displayPct, setDisplayPct] = useState(85);
  const targetRef = useRef(85);
  const currentRef = useRef(85);
  const animFrameRef = useRef<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [currentDraw, setCurrentDraw] = useState(12.5);
  const [liveVoltage, setLiveVoltage] = useState<string | null>(null);

  // When live battery data arrives, drive the gauge from it
  useEffect(() => {
    if (battery) {
      targetRef.current = voltageToPct(battery.voltage);
      setCurrentDraw(battery.amperage);
      setLiveVoltage(battery.voltage.toFixed(1));
    }
  }, [battery]);

  // Oscillate target between 70-95 (simulation only)
  useEffect(() => {
    if (battery) return;
    let rising = false;
    intervalRef.current = setInterval(() => {
      if (rising) {
        targetRef.current = 70 + Math.random() * 25;
      } else {
        targetRef.current = 70 + Math.random() * 15;
      }
      rising = !rising;
      setCurrentDraw(parseFloat((10 + Math.random() * 6).toFixed(1)));
    }, 3000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [battery]);

  // Smooth animation loop (runs always for easing)
  useEffect(() => {
    function animate() {
      const diff = targetRef.current - currentRef.current;
      currentRef.current += diff * 0.04;
      setDisplayPct(Math.round(currentRef.current * 10) / 10);
      animFrameRef.current = requestAnimationFrame(animate);
    }
    animFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, []);

  const pct = Math.max(0, Math.min(100, displayPct));
  const fillAngle = START_ANGLE_DEG + (pct / 100) * SWEEP_DEG;
  const arcColor = percentToColor(pct);
  const voltage = liveVoltage ?? pctToVoltage(pct);

  // Background arc (full sweep)
  const bgArcPath = describeArc(
    CX,
    CY,
    RADIUS,
    START_ANGLE_DEG,
    START_ANGLE_DEG + SWEEP_DEG
  );

  // Foreground arc (filled portion)
  const fgArcPath =
    pct > 0.5
      ? describeArc(CX, CY, RADIUS, START_ANGLE_DEG, fillAngle)
      : "";

  // Tick marks
  const tickElements = TICKS.map((tickPct) => {
    const angle = START_ANGLE_DEG + (tickPct / 100) * SWEEP_DEG;
    const inner = polarToCartesian(CX, CY, RADIUS - 20, angle);
    const outer = polarToCartesian(CX, CY, RADIUS - 8, angle);
    const label = polarToCartesian(CX, CY, RADIUS - 28, angle);
    return (
      <g key={tickPct}>
        <line
          x1={inner.x}
          y1={inner.y}
          x2={outer.x}
          y2={outer.y}
          stroke="#555"
          strokeWidth={2}
          strokeLinecap="round"
        />
        <text
          x={label.x}
          y={label.y}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#8c8c8c"
          fontSize={9}
          fontFamily={MONO_FONT}
        >
          {tickPct}
        </text>
      </g>
    );
  });

  const gradientId = "batteryArcGradient";
  const filterId = "arcGlow";

  return (
    <div
      style={{
        width: 260,
        maxWidth: "100%",
        background: "#141414",
        borderRadius: 4,
        border: "1px solid #333",
        padding: "16px 12px 12px",
        fontFamily: MONO_FONT,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <svg
        width={260}
        height={220}
        viewBox="0 0 260 220"
        style={{ overflow: "visible" }}
      >
        <defs>
          {/* Gradient along the arc */}
          <linearGradient id={gradientId} x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#e2123f" />
            <stop offset="50%" stopColor="#ffbb00" />
            <stop offset="100%" stopColor="#96e212" />
          </linearGradient>

          {/* Glow filter */}
          <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
            <feColorMatrix
              in="blur"
              type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.6 0"
              result="glow"
            />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Background arc track */}
        <path
          d={bgArcPath}
          fill="none"
          stroke="#2a2a2a"
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
        />

        {/* Foreground arc with glow */}
        {fgArcPath && (
          <path
            d={fgArcPath}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth={STROKE_WIDTH}
            strokeLinecap="round"
            filter={`url(#${filterId})`}
          />
        )}

        {/* Tick marks */}
        {tickElements}

        {/* Center percentage text */}
        <text
          x={CX}
          y={CY - 6}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#f2f2f2"
          fontSize={38}
          fontWeight="bold"
          fontFamily={MONO_FONT}
        >
          {Math.round(pct)}%
        </text>

        {/* Voltage below percentage */}
        <text
          x={CX}
          y={CY + 26}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#ffbb00"
          fontSize={16}
          fontFamily={MONO_FONT}
        >
          {voltage}V
        </text>

        {/* Small "BATTERY" label */}
        <text
          x={CX}
          y={CY + 48}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#8c8c8c"
          fontSize={9}
          fontFamily={MONO_FONT}
          letterSpacing={2}
        >
          BATTERY
        </text>

        {/* Arc endpoint indicator dot */}
        {pct > 0.5 && (() => {
          const endPoint = polarToCartesian(CX, CY, RADIUS, fillAngle);
          return (
            <circle
              cx={endPoint.x}
              cy={endPoint.y}
              r={3}
              fill={arcColor}
              style={{
                filter: `drop-shadow(0 0 4px ${arcColor})`,
              }}
            />
          );
        })()}
      </svg>

      {/* Stat boxes */}
      <div
        style={{
          display: "flex",
          gap: 8,
          width: "100%",
          marginTop: 4,
        }}
      >
        <StatBox label="Voltage" value={`${voltage}V`} />
        <StatBox label="Cells" value="6S" />
        <StatBox label="Current" value={`${currentDraw.toFixed(1)}A`} />
      </div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        flex: 1,
        background: "#1f1f1f",
        borderRadius: 4,
        border: "1px solid #333",
        padding: "6px 4px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          color: "#8c8c8c",
          fontSize: 9,
          fontFamily: MONO_FONT,
          letterSpacing: 1,
          textTransform: "uppercase",
          marginBottom: 2,
        }}
      >
        {label}
      </div>
      <div
        style={{
          color: "#f2f2f2",
          fontSize: 13,
          fontFamily: MONO_FONT,
          fontWeight: 600,
        }}
      >
        {value}
      </div>
    </div>
  );
}

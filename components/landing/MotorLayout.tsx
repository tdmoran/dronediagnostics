"use client";

import { useEffect, useRef, useState } from "react";

const MONO_FONT = "'SF Mono', Monaco, 'Cascadia Code', monospace";

const SIZE = 280;
const CX = SIZE / 2;
const CY = SIZE / 2;
const ARM_LENGTH = 90;
const PROP_RADIUS = 28;

// Betaflight standard motor layout (X config):
// Motor 1: front-right, Motor 2: rear-right, Motor 3: rear-left, Motor 4: front-left
const MOTOR_POSITIONS = [
  { id: 1, label: "M1", angle: -45, cw: true },   // front-right
  { id: 2, label: "M2", angle: 45, cw: false },    // rear-right (actually 135 from top)
  { id: 3, label: "M3", angle: 135, cw: true },    // rear-left (actually 225 from top)
  { id: 4, label: "M4", angle: -135, cw: false },  // front-left
].map((m) => {
  const rad = (m.angle * Math.PI) / 180;
  return {
    ...m,
    x: CX + ARM_LENGTH * Math.cos(rad),
    y: CY + ARM_LENGTH * Math.sin(rad),
  };
});

function rpmToColor(rpm: number): string {
  // green at 4000, yellow at 6000, red at 8000
  const t = Math.max(0, Math.min(1, (rpm - 4000) / 4000));
  if (t <= 0.5) {
    const s = t / 0.5;
    const r = Math.round(0x96 + s * (0xff - 0x96));
    const g = Math.round(0xe2 + s * (0xbb - 0xe2));
    const b = Math.round(0x12 + s * (0x00 - 0x12));
    return `rgb(${r},${g},${b})`;
  } else {
    const s = (t - 0.5) / 0.5;
    const r = Math.round(0xff + s * (0xe2 - 0xff));
    const g = Math.round(0xbb + s * (0x12 - 0xbb));
    const b = Math.round(0x00 + s * (0x3f - 0x00));
    return `rgb(${r},${g},${b})`;
  }
}

function rpmToBarHeight(rpm: number): number {
  // Map 4000-8000 to 0-36 px bar height
  return Math.max(0, Math.min(36, ((rpm - 4000) / 4000) * 36));
}

function rpmToSpinDuration(rpm: number): number {
  // Higher RPM = faster spin. Map 4000-8000 to 1.2s-0.3s
  const t = Math.max(0, Math.min(1, (rpm - 4000) / 4000));
  return 1.2 - t * 0.9;
}

interface MotorLayoutProps {
  /** Live motor PWM values (1000-2000). When provided, simulation is disabled. */
  motors?: number[];
}

/** Map PWM (1000-2000) to approximate RPM range (4000-8000). */
function pwmToRpm(pwm: number): number {
  return 4000 + ((Math.max(1000, Math.min(2000, pwm)) - 1000) / 1000) * 4000;
}

export function MotorLayout({ motors: liveMotors }: MotorLayoutProps) {
  const [rpms, setRpms] = useState([6200, 6100, 6300, 6150]);
  const targetRpmsRef = useRef([6200, 6100, 6300, 6150]);
  const currentRpmsRef = useRef([6200, 6100, 6300, 6150]);
  const animFrameRef = useRef<number>(0);

  // Drive targets from live motor data
  useEffect(() => {
    if (liveMotors && liveMotors.length >= 4) {
      targetRpmsRef.current = liveMotors.slice(0, 4).map(pwmToRpm);
    }
  }, [liveMotors]);

  // Generate new target RPMs periodically (simulation only)
  useEffect(() => {
    if (liveMotors) return;
    const interval = setInterval(() => {
      targetRpmsRef.current = [
        5000 + Math.random() * 3000,
        4800 + Math.random() * 3200,
        5100 + Math.random() * 2900,
        4900 + Math.random() * 3100,
      ];
    }, 2500);
    return () => clearInterval(interval);
  }, [liveMotors]);

  // Smooth animation loop
  useEffect(() => {
    function animate() {
      const next = currentRpmsRef.current.map((cur, i) => {
        const diff = targetRpmsRef.current[i] - cur;
        return cur + diff * 0.05;
      });
      currentRpmsRef.current = next;
      setRpms(next.map((v) => Math.round(v)));
      animFrameRef.current = requestAnimationFrame(animate);
    }
    animFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, []);

  const propGlowId = (i: number) => `propGlow${i}`;

  return (
    <div
      style={{
        width: SIZE,
        height: SIZE,
        maxWidth: "100%",
        background: "#141414",
        borderRadius: 4,
        border: "1px solid #333",
        position: "relative",
        fontFamily: MONO_FONT,
      }}
    >
      {/* CSS keyframes for propeller spin */}
      <style>{`
        @keyframes spinCW {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes spinCCW {
          from { transform: rotate(0deg); }
          to { transform: rotate(-360deg); }
        }
      `}</style>

      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        style={{ overflow: "visible" }}
      >
        <defs>
          {/* Per-motor glow filters with dynamic color */}
          {MOTOR_POSITIONS.map((m, i) => {
            const color = rpmToColor(rpms[i]);
            return (
              <filter
                key={m.id}
                id={propGlowId(i)}
                x="-80%"
                y="-80%"
                width="260%"
                height="260%"
              >
                <feGaussianBlur
                  in="SourceGraphic"
                  stdDeviation="3"
                  result="blur"
                />
                <feFlood floodColor={color} floodOpacity="0.35" result="color" />
                <feComposite in="color" in2="blur" operator="in" result="glow" />
                <feMerge>
                  <feMergeNode in="glow" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            );
          })}
        </defs>

        {/* Frame arms */}
        {MOTOR_POSITIONS.map((m) => (
          <line
            key={`arm-${m.id}`}
            x1={CX}
            y1={CY}
            x2={m.x}
            y2={m.y}
            stroke="#555"
            strokeWidth={3}
            strokeLinecap="round"
          />
        ))}

        {/* Center body */}
        <rect
          x={CX - 14}
          y={CY - 14}
          width={28}
          height={28}
          rx={4}
          fill="#1f1f1f"
          stroke="#555"
          strokeWidth={1.5}
        />

        {/* Forward direction arrow in center */}
        <polygon
          points={`${CX},${CY - 9} ${CX - 5},${CY - 2} ${CX + 5},${CY - 2}`}
          fill="#ffbb00"
        />
        <text
          x={CX}
          y={CY + 8}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#8c8c8c"
          fontSize={6}
          fontFamily={MONO_FONT}
          letterSpacing={0.5}
        >
          FWD
        </text>

        {/* Motor assemblies */}
        {MOTOR_POSITIONS.map((m, i) => {
          const rpm = rpms[i];
          const color = rpmToColor(rpm);
          const spinDur = rpmToSpinDuration(rpm);
          const barH = rpmToBarHeight(rpm);
          const spinDir = m.cw ? "spinCW" : "spinCCW";

          // RPM bar position: offset to the right of the motor
          const barX = m.x + PROP_RADIUS + 6;
          const barY = m.y - 18;
          const barTotalH = 36;
          const barW = 5;

          // Motor label position: offset above motor
          const isFront = m.angle < 0 && Math.abs(m.angle) <= 135;
          const labelY = isFront ? m.y - PROP_RADIUS - 14 : m.y + PROP_RADIUS + 14;

          return (
            <g key={m.id}>
              {/* Motor mount circle */}
              <circle
                cx={m.x}
                cy={m.y}
                r={PROP_RADIUS + 2}
                fill="none"
                stroke="#333"
                strokeWidth={1}
                strokeDasharray="3,3"
              />

              {/* Spinning propeller */}
              <g
                filter={`url(#${propGlowId(i)})`}
                style={{
                  transformOrigin: `${m.x}px ${m.y}px`,
                  animation: `${spinDir} ${spinDur}s linear infinite`,
                }}
              >
                {/* Blade 1 */}
                <ellipse
                  cx={m.x}
                  cy={m.y}
                  rx={PROP_RADIUS}
                  ry={4}
                  fill={color}
                  opacity={0.7}
                />
                {/* Blade 2 */}
                <ellipse
                  cx={m.x}
                  cy={m.y}
                  rx={4}
                  ry={PROP_RADIUS}
                  fill={color}
                  opacity={0.7}
                />
              </g>

              {/* Center hub */}
              <circle cx={m.x} cy={m.y} r={5} fill="#1f1f1f" stroke="#555" strokeWidth={1} />

              {/* Motor label */}
              <text
                x={m.x}
                y={labelY}
                textAnchor="middle"
                dominantBaseline="central"
                fill="#8c8c8c"
                fontSize={9}
                fontFamily={MONO_FONT}
              >
                {m.label}
              </text>

              {/* RPM bar background */}
              <rect
                x={barX}
                y={barY}
                width={barW}
                height={barTotalH}
                rx={2}
                fill="#2a2a2a"
              />

              {/* RPM bar fill (fills from bottom) */}
              <rect
                x={barX}
                y={barY + (barTotalH - barH)}
                width={barW}
                height={barH}
                rx={2}
                fill={color}
              />

              {/* RPM number */}
              <text
                x={barX + barW / 2}
                y={barY + barTotalH + 10}
                textAnchor="middle"
                dominantBaseline="central"
                fill="#f2f2f2"
                fontSize={8}
                fontFamily={MONO_FONT}
              >
                {rpm}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

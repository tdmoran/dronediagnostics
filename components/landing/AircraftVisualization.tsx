"use client";

import { useEffect, useRef, useState } from "react";

const MONO_FONT = "'SF Mono', Monaco, 'Cascadia Code', monospace";

// ---------------------------------------------------------------------------
// 3D Math Utilities
// ---------------------------------------------------------------------------

type Vec3 = [number, number, number];

/** ZYX Euler rotation matrix applied to a point. Angles in degrees. */
function rotate3D(
  point: Vec3,
  rollDeg: number,
  pitchDeg: number,
  yawDeg: number
): Vec3 {
  const toRad = Math.PI / 180;
  const cr = Math.cos(rollDeg * toRad),
    sr = Math.sin(rollDeg * toRad);
  const cp = Math.cos(pitchDeg * toRad),
    sp = Math.sin(pitchDeg * toRad);
  const cy = Math.cos(yawDeg * toRad),
    sy = Math.sin(yawDeg * toRad);

  const [x, y, z] = point;

  // ZYX order: Rz(yaw) * Ry(pitch) * Rx(roll)
  const x1 = cy * cp * x + (cy * sp * sr - sy * cr) * y + (cy * sp * cr + sy * sr) * z;
  const y1 = sy * cp * x + (sy * sp * sr + cy * cr) * y + (sy * sp * cr - cy * sr) * z;
  const z1 = -sp * x + cp * sr * y + cp * cr * z;

  return [x1, y1, z1];
}

/** Weak perspective projection: scaled orthographic with mild depth scaling. */
function project(point: Vec3, cx: number, cy: number, scale: number): { x: number; y: number; z: number } {
  const depthScale = 1 + point[2] * 0.0015;
  return {
    x: cx + point[0] * scale * depthScale,
    y: cy - point[1] * scale * depthScale, // SVG y is inverted
    z: point[2],
  };
}

// ---------------------------------------------------------------------------
// Drone Geometry
// ---------------------------------------------------------------------------

const ARM_LEN = 1.0;
const BODY_HALF = 0.22;
const BODY_H = 0.1;

// X-config motor positions (matching MotorLayout)
const MOTOR_POS: Vec3[] = [
  [ARM_LEN * Math.cos(Math.PI / 4), ARM_LEN * Math.sin(Math.PI / 4), 0],     // front-right
  [ARM_LEN * Math.cos((3 * Math.PI) / 4), ARM_LEN * Math.sin((3 * Math.PI) / 4), 0], // front-left
  [ARM_LEN * Math.cos((-3 * Math.PI) / 4), ARM_LEN * Math.sin((-3 * Math.PI) / 4), 0], // rear-left
  [ARM_LEN * Math.cos(-Math.PI / 4), ARM_LEN * Math.sin(-Math.PI / 4), 0],    // rear-right
];

// Body box: 8 vertices
const BODY_VERTS: Vec3[] = [
  [-BODY_HALF, BODY_HALF, BODY_H],
  [BODY_HALF, BODY_HALF, BODY_H],
  [BODY_HALF, -BODY_HALF, BODY_H],
  [-BODY_HALF, -BODY_HALF, BODY_H],
  [-BODY_HALF, BODY_HALF, -BODY_H],
  [BODY_HALF, BODY_HALF, -BODY_H],
  [BODY_HALF, -BODY_HALF, -BODY_H],
  [-BODY_HALF, -BODY_HALF, -BODY_H],
];

// Body edges (index pairs)
const BODY_EDGES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 0], // top face
  [4, 5], [5, 6], [6, 7], [7, 4], // bottom face
  [0, 4], [1, 5], [2, 6], [3, 7], // verticals
];

// Forward chevron arrow vertices (on top face)
const ARROW_VERTS: Vec3[] = [
  [0, 0.18, BODY_H + 0.01],
  [-0.1, 0.08, BODY_H + 0.01],
  [0, 0.12, BODY_H + 0.01],
  [0.1, 0.08, BODY_H + 0.01],
];

// Propeller disc: 8-point polygon at each motor
function discPoints(center: Vec3, radius: number): Vec3[] {
  const pts: Vec3[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    pts.push([
      center[0] + radius * Math.cos(a),
      center[1] + radius * Math.sin(a),
      center[2],
    ]);
  }
  return pts;
}

// Ground-plane reference grid
const GRID_LINES: [Vec3, Vec3][] = [];
const GRID_EXTENT = 1.8;
const GRID_STEP = 0.6;
for (let v = -GRID_EXTENT; v <= GRID_EXTENT + 0.01; v += GRID_STEP) {
  GRID_LINES.push([
    [v, -GRID_EXTENT, -0.3],
    [v, GRID_EXTENT, -0.3],
  ]);
  GRID_LINES.push([
    [-GRID_EXTENT, v, -0.3],
    [GRID_EXTENT, v, -0.3],
  ]);
}

const PROP_RADIUS = 0.32;

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

const COLOR = {
  armFront: "#ffbb00",
  armBack: "#b38400",
  propFront: "#96e212",
  propBack: "#5a8a0d",
  arrow: "#e2123f",
  grid: "#222222",
  bg: "#141414",
  text: "#f2f2f2",
  muted: "#8c8c8c",
} as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface AircraftVisualizationProps {
  attitude?: { roll: number; pitch: number; yaw: number };
}

export function AircraftVisualization({ attitude }: AircraftVisualizationProps) {
  const [roll, setRoll] = useState(0);
  const [pitch, setPitch] = useState(0);
  const [yaw, setYaw] = useState(0);
  const animFrameRef = useRef<number>(0);
  const tRef = useRef(Math.random() * 1000);

  // Live attitude data
  useEffect(() => {
    if (attitude) {
      setRoll(attitude.roll);
      setPitch(attitude.pitch);
      setYaw(((attitude.yaw % 360) + 360) % 360);
    }
  }, [attitude]);

  // Simulated motion when no live data
  useEffect(() => {
    if (attitude) return;

    function animate() {
      tRef.current += 0.016;
      const t = tRef.current;

      const simRoll =
        12.0 * Math.sin(t * 0.37) +
        6.0 * Math.cos(t * 0.89 + 1.2) +
        3.0 * Math.sin(t * 1.73 + 0.5);
      const simPitch =
        8.0 * Math.sin(t * 0.53 + 0.7) +
        4.0 * Math.cos(t * 1.17 + 2.0) +
        2.0 * Math.sin(t * 2.1 + 1.0);
      const simYaw = ((t * 15.0) % 360 + 360) % 360;

      setRoll(simRoll);
      setPitch(simPitch);
      setYaw(simYaw);

      animFrameRef.current = requestAnimationFrame(animate);
    }

    animFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [attitude]);

  // ---------------------------------------------------------------------------
  // 3D Projection
  // ---------------------------------------------------------------------------

  const SIZE = 280;
  const CX = SIZE / 2;
  const CY = SIZE / 2 - 10; // shift up slightly for stat boxes
  const SCALE = 80;

  const proj = (p: Vec3) => project(rotate3D(p, roll, pitch, yaw), CX, CY, SCALE);

  // Project motor positions and sort by depth for painter's algorithm
  const motorsProjected = MOTOR_POS.map((pos, i) => {
    const rotated = rotate3D(pos, roll, pitch, yaw);
    const projected = project(rotated, CX, CY, SCALE);
    return { idx: i, pos, rotated, projected };
  });
  const motorsSorted = [...motorsProjected].sort((a, b) => a.rotated[2] - b.rotated[2]);

  // Project body vertices
  const bodyProjected = BODY_VERTS.map((v) => proj(v));
  const bodyCenter = rotate3D([0, 0, 0] as Vec3, roll, pitch, yaw);

  // Project arrow
  const arrowProjected = ARROW_VERTS.map((v) => proj(v));

  // Body average depth
  const bodyAvgZ =
    BODY_VERTS.reduce((sum, v) => sum + rotate3D(v, roll, pitch, yaw)[2], 0) /
    BODY_VERTS.length;

  // Build render layers sorted by depth
  type RenderItem = { z: number; key: string; render: () => React.ReactElement };
  const layers: RenderItem[] = [];

  // Grid lines (world-fixed, always at the back)
  layers.push({
    z: -999,
    key: "grid",
    render: () => (
      <g key="grid" opacity={0.35}>
        {GRID_LINES.map((line, i) => {
          // Grid is world-fixed: don't rotate it, just project
          const p1 = project(line[0], CX, CY, SCALE);
          const p2 = project(line[1], CX, CY, SCALE);
          return (
            <line
              key={i}
              x1={p1.x}
              y1={p1.y}
              x2={p2.x}
              y2={p2.y}
              stroke={COLOR.grid}
              strokeWidth={0.5}
            />
          );
        })}
      </g>
    ),
  });

  // Arms + prop discs for each motor
  motorsProjected.forEach((m) => {
    const isFront = m.rotated[2] > bodyCenter[2];
    const armColor = isFront ? COLOR.armFront : COLOR.armBack;
    const propColor = isFront ? COLOR.propFront : COLOR.propBack;
    const center = proj([0, 0, 0] as Vec3);

    // Arm
    layers.push({
      z: m.rotated[2] - 0.01,
      key: `arm-${m.idx}`,
      render: () => (
        <line
          key={`arm-${m.idx}`}
          x1={center.x}
          y1={center.y}
          x2={m.projected.x}
          y2={m.projected.y}
          stroke={armColor}
          strokeWidth={2.5}
          strokeLinecap="round"
        />
      ),
    });

    // Prop disc
    const disc = discPoints(m.pos, PROP_RADIUS).map((p) => proj(p));
    const discPath = disc.map((p, j) => `${j === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";

    layers.push({
      z: m.rotated[2],
      key: `prop-${m.idx}`,
      render: () => (
        <path
          key={`prop-${m.idx}`}
          d={discPath}
          fill={propColor}
          fillOpacity={0.25}
          stroke={propColor}
          strokeWidth={1}
          strokeOpacity={0.6}
        />
      ),
    });

    // Motor hub
    layers.push({
      z: m.rotated[2] + 0.01,
      key: `hub-${m.idx}`,
      render: () => (
        <circle
          key={`hub-${m.idx}`}
          cx={m.projected.x}
          cy={m.projected.y}
          r={3}
          fill="#1f1f1f"
          stroke={armColor}
          strokeWidth={1}
        />
      ),
    });
  });

  // Body wireframe
  layers.push({
    z: bodyAvgZ,
    key: "body",
    render: () => (
      <g key="body">
        {BODY_EDGES.map(([a, b], i) => {
          const edgeMidZ = (bodyProjected[a].z + bodyProjected[b].z) / 2;
          const edgeColor = edgeMidZ > bodyCenter[2] ? COLOR.armFront : COLOR.armBack;
          return (
            <line
              key={i}
              x1={bodyProjected[a].x}
              y1={bodyProjected[a].y}
              x2={bodyProjected[b].x}
              y2={bodyProjected[b].y}
              stroke={edgeColor}
              strokeWidth={1.5}
              strokeOpacity={0.8}
            />
          );
        })}
      </g>
    ),
  });

  // Forward arrow (on top of body)
  const arrowZ = ARROW_VERTS.reduce(
    (sum, v) => sum + rotate3D(v, roll, pitch, yaw)[2],
    0
  ) / ARROW_VERTS.length;

  layers.push({
    z: arrowZ + 0.02,
    key: "arrow",
    render: () => {
      const path =
        `M ${arrowProjected[0].x} ${arrowProjected[0].y} ` +
        `L ${arrowProjected[1].x} ${arrowProjected[1].y} ` +
        `L ${arrowProjected[2].x} ${arrowProjected[2].y} ` +
        `L ${arrowProjected[3].x} ${arrowProjected[3].y} Z`;
      return (
        <path
          key="arrow"
          d={path}
          fill={COLOR.arrow}
          fillOpacity={0.9}
          stroke={COLOR.arrow}
          strokeWidth={1}
        />
      );
    },
  });

  // Sort by z (back to front)
  layers.sort((a, b) => a.z - b.z);

  // Format angle
  const fmt = (v: number) => {
    const sign = v >= 0 ? "+" : "";
    return `${sign}${v.toFixed(1)}`;
  };

  return (
    <div
      style={{
        width: 260,
        maxWidth: "100%",
        background: COLOR.bg,
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
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        style={{ overflow: "visible" }}
      >
        {layers.map((layer) => layer.render())}
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
        <StatBox label="Roll" value={`${fmt(roll)}°`} />
        <StatBox label="Pitch" value={`${fmt(pitch)}°`} />
        <StatBox label="Yaw" value={`${yaw.toFixed(1)}°`} />
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

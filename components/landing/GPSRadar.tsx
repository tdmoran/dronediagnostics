'use client';

import { useState, useEffect, useRef } from 'react';

interface Satellite {
  prn: number;
  elevation: number; // 0 = horizon, 90 = directly overhead
  azimuth: number;   // 0-360 degrees from north
  snr: number;       // signal-to-noise ratio
  driftAz: number;   // drift speed in azimuth (deg/s)
  driftEl: number;   // drift speed in elevation (deg/s)
}

const MONO_FONT = "'SF Mono', Monaco, 'Cascadia Code', monospace";

function generateSatellites(): Satellite[] {
  const sats: Satellite[] = [];
  const count = 14;
  for (let i = 0; i < count; i++) {
    sats.push({
      prn: [1, 3, 6, 8, 11, 14, 17, 19, 22, 24, 27, 30, 32, 5][i],
      elevation: 10 + Math.random() * 75,
      azimuth: (i * (360 / count) + Math.random() * 30) % 360,
      snr: 12 + Math.random() * 38,
      driftAz: (Math.random() - 0.5) * 0.3,
      driftEl: (Math.random() - 0.5) * 0.04,
    });
  }
  return sats;
}

function getSatColor(snr: number): string {
  if (snr > 35) return '#96e212';
  if (snr >= 20) return '#ffbb00';
  return '#e2123f';
}

interface GPSRadarProps {
  /** Live GPS data. When provided, the info bar shows real values. */
  gps?: {
    num_satellites: number;
    fix_type: number;
    hdop: number | null;
  } | null;
}

export function GPSRadar({ gps }: GPSRadarProps) {
  const [satellites, setSatellites] = useState<Satellite[]>(() => generateSatellites());
  const [sweepAngle, setSweepAngle] = useState(0);
  const animRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  // Animation loop for sweep line
  useEffect(() => {
    const animate = (time: number) => {
      if (lastTimeRef.current === 0) lastTimeRef.current = time;
      const delta = time - lastTimeRef.current;
      lastTimeRef.current = time;

      setSweepAngle((prev) => (prev + (delta / 4000) * 360) % 360);
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  // Satellite drift (slow orbital motion)
  useEffect(() => {
    const interval = setInterval(() => {
      setSatellites((prev) =>
        prev.map((sat) => {
          let newEl = sat.elevation + sat.driftEl;
          let newAz = (sat.azimuth + sat.driftAz + 360) % 360;
          let driftEl = sat.driftEl;

          // Bounce elevation within bounds
          if (newEl < 5) { newEl = 5; driftEl = Math.abs(driftEl); }
          if (newEl > 85) { newEl = 85; driftEl = -Math.abs(driftEl); }

          return { ...sat, elevation: newEl, azimuth: newAz, driftEl };
        })
      );
    }, 100);
    return () => clearInterval(interval);
  }, []);

  const width = 280;
  const height = 320;
  const cx = 140;
  const cy = 140;
  const maxR = 120;

  // Convert elevation/azimuth to SVG x,y
  // elevation 90 = center (r=0), elevation 0 = edge (r=maxR)
  function satToXY(el: number, az: number): { x: number; y: number } {
    const r = ((90 - el) / 90) * maxR;
    const rad = ((az - 90) * Math.PI) / 180; // -90 so 0deg (North) is up
    return {
      x: cx + r * Math.cos(rad),
      y: cy + r * Math.sin(rad),
    };
  }

  const simTrackedCount = satellites.filter((s) => s.snr >= 20).length;
  const trackedCount = gps ? gps.num_satellites : simTrackedCount;
  const totalCount = gps ? gps.num_satellites : satellites.length;
  const fixLabel = gps ? (gps.fix_type === 2 ? '3D Fix' : gps.fix_type === 1 ? '2D Fix' : 'No Fix') : '3D Fix';
  const fixColor = gps ? (gps.fix_type === 2 ? '#ffbb00' : gps.fix_type === 1 ? '#ffbb00' : '#e2123f') : '#ffbb00';
  const hdopValue = gps?.hdop != null ? (gps.hdop / 100).toFixed(1) : '1.2';

  return (
    <div
      style={{
        width,
        height,
        background: '#141414',
        borderRadius: 8,
        border: '1px solid #333',
        overflow: 'hidden',
      }}
    >
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <defs>
          {/* Green glow filter for satellite dots */}
          <filter id="gps-glow-green" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="gps-glow-yellow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="gps-glow-red" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Sweep trail gradient */}
          <linearGradient id="sweep-trail" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#96e212" stopOpacity="0" />
            <stop offset="100%" stopColor="#96e212" stopOpacity="0.15" />
          </linearGradient>
        </defs>

        {/* Radar background */}
        <circle cx={cx} cy={cy} r={maxR} fill="#1a1a2a" />

        {/* Concentric elevation circles */}
        {[0, 30, 60, 90].map((elev, i) => {
          const r = ((90 - elev) / 90) * maxR;
          return (
            <circle
              key={elev}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke="#333"
              strokeWidth={i === 3 ? 1.5 : 0.8}
              strokeDasharray={i === 3 ? 'none' : '3,3'}
            />
          );
        })}

        {/* Elevation labels */}
        {[30, 60].map((elev) => {
          const r = ((90 - elev) / 90) * maxR;
          return (
            <text
              key={`label-${elev}`}
              x={cx + 3}
              y={cy - r + 10}
              fill="#555"
              fontSize={8}
              fontFamily={MONO_FONT}
            >
              {elev}°
            </text>
          );
        })}

        {/* Cross-hair lines */}
        <line x1={cx} y1={cy - maxR} x2={cx} y2={cy + maxR} stroke="#333" strokeWidth={0.8} />
        <line x1={cx - maxR} y1={cy} x2={cx + maxR} y2={cy} stroke="#333" strokeWidth={0.8} />

        {/* Cardinal direction labels */}
        <text x={cx} y={cy - maxR - 6} textAnchor="middle" fill="#8c8c8c" fontSize={11} fontFamily={MONO_FONT} fontWeight="bold">N</text>
        <text x={cx} y={cy + maxR + 14} textAnchor="middle" fill="#8c8c8c" fontSize={11} fontFamily={MONO_FONT} fontWeight="bold">S</text>
        <text x={cx + maxR + 10} y={cy + 4} textAnchor="middle" fill="#8c8c8c" fontSize={11} fontFamily={MONO_FONT} fontWeight="bold">E</text>
        <text x={cx - maxR - 10} y={cy + 4} textAnchor="middle" fill="#8c8c8c" fontSize={11} fontFamily={MONO_FONT} fontWeight="bold">W</text>

        {/* Radar sweep with conic trail */}
        {/* Sweep trail (wedge arc) */}
        {(() => {
          const trailDeg = 45;
          const startAngle = sweepAngle - trailDeg - 90;
          const endAngle = sweepAngle - 90;
          const segments = 12;
          const elements = [];
          for (let i = 0; i < segments; i++) {
            const a1 = startAngle + (i / segments) * trailDeg;
            const a2 = startAngle + ((i + 1) / segments) * trailDeg;
            const r1 = (a1 * Math.PI) / 180;
            const r2 = (a2 * Math.PI) / 180;
            const opacity = ((i + 1) / segments) * 0.12;
            const path = [
              `M ${cx} ${cy}`,
              `L ${cx + maxR * Math.cos(r1)} ${cy + maxR * Math.sin(r1)}`,
              `A ${maxR} ${maxR} 0 0 1 ${cx + maxR * Math.cos(r2)} ${cy + maxR * Math.sin(r2)}`,
              'Z',
            ].join(' ');
            elements.push(
              <path key={`sweep-${i}`} d={path} fill="#96e212" opacity={opacity} />
            );
          }
          return elements;
        })()}

        {/* Sweep line */}
        {(() => {
          const rad = ((sweepAngle - 90) * Math.PI) / 180;
          return (
            <line
              x1={cx}
              y1={cy}
              x2={cx + maxR * Math.cos(rad)}
              y2={cy + maxR * Math.sin(rad)}
              stroke="#96e212"
              strokeWidth={1.5}
              opacity={0.6}
            />
          );
        })()}

        {/* Clip circle for radar area */}
        <clipPath id="radar-clip">
          <circle cx={cx} cy={cy} r={maxR} />
        </clipPath>

        {/* Satellite dots */}
        <g clipPath="url(#radar-clip)">
          {satellites.map((sat) => {
            const { x, y } = satToXY(sat.elevation, sat.azimuth);
            const color = getSatColor(sat.snr);
            const glowId =
              sat.snr > 35 ? 'gps-glow-green' : sat.snr >= 20 ? 'gps-glow-yellow' : 'gps-glow-red';
            return (
              <g key={sat.prn}>
                <circle
                  cx={x}
                  cy={y}
                  r={4}
                  fill={color}
                  filter={`url(#${glowId})`}
                />
                <text
                  x={x + 6}
                  y={y - 6}
                  fill={color}
                  fontSize={8}
                  fontFamily={MONO_FONT}
                  fontWeight="bold"
                  opacity={0.9}
                >
                  {sat.prn}
                </text>
              </g>
            );
          })}
        </g>

        {/* Info bar background */}
        <rect x={0} y={height - 40} width={width} height={40} fill="#1f1f1f" />
        <line x1={0} y1={height - 40} x2={width} y2={height - 40} stroke="#333" strokeWidth={1} />

        {/* Info bar text */}
        <text
          x={width / 2}
          y={height - 18}
          textAnchor="middle"
          fill="#f2f2f2"
          fontSize={11}
          fontFamily={MONO_FONT}
        >
          <tspan fill="#96e212">{trackedCount}</tspan>
          <tspan fill="#8c8c8c">/{totalCount} Satellites</tspan>
          <tspan fill="#333"> | </tspan>
          <tspan fill={fixColor}>{fixLabel}</tspan>
          <tspan fill="#333"> | </tspan>
          <tspan fill="#8c8c8c">HDOP: </tspan>
          <tspan fill="#96e212">{hdopValue}</tspan>
        </text>
      </svg>
    </div>
  );
}

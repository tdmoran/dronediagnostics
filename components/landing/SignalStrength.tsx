'use client';

import { useState, useEffect } from 'react';

const MONO_FONT = "'SF Mono', Monaco, 'Cascadia Code', monospace";
const BAR_COUNT = 8;

function getSignalColor(rssi: number): string {
  if (rssi >= -60) return '#96e212';
  if (rssi >= -70) return '#ffbb00';
  return '#e2123f';
}

function getQualityLabel(rssi: number): { label: string; color: string } {
  if (rssi >= -55) return { label: 'Excellent', color: '#96e212' };
  if (rssi >= -65) return { label: 'Good', color: '#96e212' };
  if (rssi >= -72) return { label: 'Fair', color: '#ffbb00' };
  return { label: 'Poor', color: '#e2123f' };
}

function getLinkQuality(rssi: number): number {
  // Map RSSI range to 0-100%
  const clamped = Math.max(-100, Math.min(-30, rssi));
  return Math.round(((clamped + 100) / 70) * 100);
}

interface SignalStrengthProps {
  /** Live RSSI value (0-1023 from MSP_ANALOG). When provided, simulation is disabled. */
  rssiRaw?: number;
}

/** Map raw MSP RSSI (0-1023) to approximate dBm (-100..-30). */
function rawRssiToDbm(raw: number): number {
  return -100 + (Math.max(0, Math.min(1023, raw)) / 1023) * 70;
}

export function SignalStrength({ rssiRaw }: SignalStrengthProps) {
  const [rssi, setRssi] = useState(-64);
  const [pulsePhase, setPulsePhase] = useState(0);
  const [packetLoss, setPacketLoss] = useState(0.2);

  // When live RSSI arrives, use it
  useEffect(() => {
    if (rssiRaw !== undefined) {
      setRssi(rawRssiToDbm(rssiRaw));
    }
  }, [rssiRaw]);

  // Fluctuate RSSI (simulation only)
  useEffect(() => {
    if (rssiRaw !== undefined) return;
    const interval = setInterval(() => {
      setRssi((prev) => {
        const delta = (Math.random() - 0.5) * 4;
        const next = prev + delta;
        return Math.max(-75, Math.min(-55, next));
      });
      setPacketLoss((prev) => {
        const delta = (Math.random() - 0.5) * 0.3;
        return Math.max(0, Math.min(3.0, +(prev + delta).toFixed(1)));
      });
    }, 800);
    return () => clearInterval(interval);
  }, [rssiRaw]);

  // Pulse animation
  useEffect(() => {
    let frame: number;
    const animate = () => {
      setPulsePhase((prev) => (prev + 0.04) % (Math.PI * 2));
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, []);

  const width = 280;
  const height = 200;
  const barAreaX = 40;
  const barAreaWidth = 200;
  const barAreaBottom = 140;
  const barMaxHeight = 70;
  const barGap = 5;
  const barWidth = (barAreaWidth - (BAR_COUNT - 1) * barGap) / BAR_COUNT;

  // Signal strength maps to active bars: -55 dBm => all 8, -75 dBm => ~2
  const signalPct = ((rssi + 100) / 45) * 100; // 0-100 roughly
  const activeBars = Math.max(1, Math.min(BAR_COUNT, Math.round((signalPct / 100) * BAR_COUNT)));

  const color = getSignalColor(rssi);
  const { label: qualityLabel, color: qualityColor } = getQualityLabel(rssi);
  const linkQuality = getLinkQuality(rssi);

  // Pulse scale: subtle throb
  const pulseScale = 1 + Math.sin(pulsePhase) * 0.04;

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
          {/* Glow filter for active bars */}
          <filter id="sig-bar-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Glow for wave decoration */}
          <filter id="sig-wave-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Radio wave decoration arcs above bars */}
        {[1, 2, 3].map((i) => {
          const arcR = 12 + i * 10;
          const waveCx = barAreaX + barAreaWidth / 2;
          const waveCy = barAreaBottom - barMaxHeight + 2;
          const waveOpacity = Math.max(0.08, (0.35 - i * 0.08) + Math.sin(pulsePhase + i * 0.7) * 0.12);
          return (
            <path
              key={`wave-${i}`}
              d={`M ${waveCx - arcR * 0.7} ${waveCy - arcR * 0.5} A ${arcR} ${arcR} 0 0 1 ${waveCx + arcR * 0.7} ${waveCy - arcR * 0.5}`}
              fill="none"
              stroke={color}
              strokeWidth={1.5}
              opacity={waveOpacity}
              filter="url(#sig-wave-glow)"
            />
          );
        })}

        {/* Signal bars */}
        {Array.from({ length: BAR_COUNT }).map((_, i) => {
          const barHeight = ((i + 1) / BAR_COUNT) * barMaxHeight;
          const x = barAreaX + i * (barWidth + barGap);
          const y = barAreaBottom - barHeight;
          const isActive = i < activeBars;

          // Bars get progressively colored
          let barColor = '#333';
          if (isActive) {
            barColor = color;
          }

          // Pulse transform for active bars
          const scaleY = isActive ? pulseScale : 1;
          const scaledHeight = barHeight * scaleY;
          const scaledY = barAreaBottom - scaledHeight;

          return (
            <g key={`bar-${i}`}>
              <rect
                x={x}
                y={scaledY}
                width={barWidth}
                height={scaledHeight}
                rx={2}
                fill={barColor}
                opacity={isActive ? 0.9 : 0.3}
                filter={isActive ? 'url(#sig-bar-glow)' : undefined}
              />
            </g>
          );
        })}

        {/* RSSI value display */}
        <text
          x={width / 2}
          y={160}
          textAnchor="middle"
          fill="#f2f2f2"
          fontSize={22}
          fontFamily={MONO_FONT}
          fontWeight="bold"
        >
          {Math.round(rssi)} dBm
        </text>

        {/* Quality label */}
        <text
          x={width / 2}
          y={175}
          textAnchor="middle"
          fill={qualityColor}
          fontSize={11}
          fontFamily={MONO_FONT}
          fontWeight="bold"
        >
          {qualityLabel}
        </text>

        {/* Bottom info bar */}
        <rect x={0} y={height - 28} width={width} height={28} fill="#1f1f1f" />
        <line x1={0} y1={height - 28} x2={width} y2={height - 28} stroke="#333" strokeWidth={1} />
        <text
          x={width / 2}
          y={height - 10}
          textAnchor="middle"
          fill="#8c8c8c"
          fontSize={10}
          fontFamily={MONO_FONT}
        >
          <tspan fill="#8c8c8c">Link: </tspan>
          <tspan fill={color}>{linkQuality}%</tspan>
          <tspan fill="#333"> | </tspan>
          <tspan fill="#8c8c8c">Loss: </tspan>
          <tspan fill={packetLoss > 1 ? '#e2123f' : '#96e212'}>{packetLoss.toFixed(1)}%</tspan>
        </text>
      </svg>
    </div>
  );
}

'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Radio,
  Wifi,
  WifiOff,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  Signal,
  Activity,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { useTelemetry } from '@/components/TelemetryProvider';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CHANNEL_NAMES: Record<number, string> = {
  0: 'Roll',
  1: 'Pitch',
  2: 'Throttle',
  3: 'Yaw',
  4: 'Arm',
  5: 'Mode',
  6: 'AUX2',
  7: 'AUX3',
  8: 'AUX4',
  9: 'AUX5',
  10: 'AUX6',
  11: 'AUX7',
  12: 'AUX8',
  13: 'AUX9',
  14: 'AUX10',
  15: 'AUX11',
};

const RSSI_HISTORY_MAX = 120; // 2 minutes at ~1 Hz

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeRssi(raw: number): number {
  // Betaflight raw RSSI can be 0-1023. Percentage is 0-100.
  if (raw > 100) return Math.round(raw / 10.23);
  return Math.round(raw);
}

type LinkQuality = 'EXCELLENT' | 'GOOD' | 'POOR' | 'CRITICAL';

function getLinkQuality(rssiPct: number): LinkQuality {
  if (rssiPct >= 60) return 'EXCELLENT';
  if (rssiPct >= 30) return 'GOOD';
  if (rssiPct >= 10) return 'POOR';
  return 'CRITICAL';
}

function getRssiColor(rssiPct: number): string {
  if (rssiPct >= 60) return '#22c55e';   // green
  if (rssiPct >= 30) return '#eab308';   // yellow
  return '#ef4444';                        // red
}

function getLinkQualityBadgeClass(q: LinkQuality): string {
  switch (q) {
    case 'EXCELLENT': return 'bg-green-600 text-white border-green-500';
    case 'GOOD':      return 'bg-yellow-600 text-white border-yellow-500';
    case 'POOR':      return 'bg-orange-600 text-white border-orange-500';
    case 'CRITICAL':  return 'bg-red-700 text-white border-red-600';
  }
}

// Map a channel value (1000-2000) to 0-1 for relative position
function chNorm(value: number): number {
  return Math.max(0, Math.min(1, (value - 1000) / 1000));
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

// -- RSSI Arc Gauge ----------------------------------------------------------

function RssiGauge({ rssiPct }: { rssiPct: number }) {
  const color = getRssiColor(rssiPct);

  // SVG arc from -150deg to +150deg (300deg total sweep)
  // Center at (80, 80), radius 60
  const cx = 80;
  const cy = 82;
  const r = 58;
  const startAngleDeg = -210; // -210 == 210 clockwise from 3 o'clock
  const sweepDeg = 240;

  function polarToXY(angleDeg: number): [number, number] {
    const rad = (angleDeg * Math.PI) / 180;
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
  }

  const startRad = startAngleDeg;
  const [sx, sy] = polarToXY(startRad);

  // Track arc (full 240 deg)
  const endTrackAngle = startAngleDeg + sweepDeg;
  const [etx, ety] = polarToXY(endTrackAngle);
  const trackPath = `M ${sx} ${sy} A ${r} ${r} 0 1 1 ${etx} ${ety}`;

  // Filled arc up to rssiPct
  const fillAngle = startAngleDeg + (sweepDeg * Math.min(100, rssiPct)) / 100;
  const [fx, fy] = polarToXY(fillAngle);
  const largeArc = (sweepDeg * rssiPct) / 100 > 180 ? 1 : 0;
  const fillPath = rssiPct > 0
    ? `M ${sx} ${sy} A ${r} ${r} 0 ${largeArc} 1 ${fx} ${fy}`
    : '';

  return (
    <div className="flex flex-col items-center">
      <svg width="160" height="120" viewBox="0 0 160 120">
        {/* Track */}
        <path
          d={trackPath}
          fill="none"
          stroke="#333"
          strokeWidth="12"
          strokeLinecap="round"
        />
        {/* Threshold markers */}
        {[30, 60].map((threshold) => {
          const angle = startAngleDeg + (sweepDeg * threshold) / 100;
          const [ox, oy] = polarToXY(angle);
          const innerR = r - 10;
          const innerX = cx + innerR * Math.cos((angle * Math.PI) / 180);
          const innerY = cy + innerR * Math.sin((angle * Math.PI) / 180);
          return (
            <line
              key={threshold}
              x1={ox}
              y1={oy}
              x2={innerX}
              y2={innerY}
              stroke={threshold === 60 ? '#22c55e' : '#eab308'}
              strokeWidth="2"
              opacity="0.7"
            />
          );
        })}
        {/* Fill */}
        {fillPath && (
          <path
            d={fillPath}
            fill="none"
            stroke={color}
            strokeWidth="12"
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 6px ${color}60)` }}
          />
        )}
        {/* Center label */}
        <text
          x={cx}
          y={cy - 6}
          textAnchor="middle"
          fill={color}
          fontSize="26"
          fontWeight="700"
          fontFamily="monospace"
        >
          {rssiPct}
        </text>
        <text
          x={cx}
          y={cy + 14}
          textAnchor="middle"
          fill="#8c8c8c"
          fontSize="12"
          fontFamily="sans-serif"
        >
          %
        </text>
      </svg>
    </div>
  );
}

// -- RC Channel Bar ----------------------------------------------------------

interface RcChannelBarProps {
  index: number;
  value: number;
}

function RcChannelBar({ index, value }: RcChannelBarProps) {
  const name = CHANNEL_NAMES[index] ?? `AUX${index - 4}`;
  const isThrottle = index === 2;
  const BAR_W = 200;
  const clampedValue = Math.max(1000, Math.min(2000, value));

  let fillLeft: number;
  let fillWidth: number;

  if (isThrottle) {
    // Fill from left: 0 at 1000, full at 2000
    fillWidth = ((clampedValue - 1000) / 1000) * BAR_W;
    fillLeft = 0;
  } else {
    // Fill from center outward
    const center = BAR_W / 2;
    const norm = (clampedValue - 1500) / 500; // -1 to +1
    if (norm >= 0) {
      fillLeft = center;
      fillWidth = norm * center;
    } else {
      fillWidth = -norm * center;
      fillLeft = center - fillWidth;
    }
  }

  const deviation = clampedValue - 1500;

  return (
    <div className="flex items-center gap-3 py-1.5">
      {/* Channel name */}
      <div className="w-16 text-right">
        <span className="text-[11px] text-[#8c8c8c] font-mono uppercase tracking-wide">
          Ch{index + 1}
        </span>
        <div className="text-[11px] text-[#f2f2f2] leading-tight">{name}</div>
      </div>

      {/* Bar container */}
      <div
        className="relative bg-[#0d0d0d] border border-[#2a2a2a] rounded-sm overflow-hidden"
        style={{ width: BAR_W, height: 20 }}
      >
        {/* Fill */}
        <div
          className="absolute top-0 bottom-0 bg-[#ffbb00] opacity-80 transition-all duration-75"
          style={{ left: fillLeft, width: Math.max(2, fillWidth) }}
        />
        {/* Center line */}
        <div
          className="absolute top-0 bottom-0 w-px bg-[#555]"
          style={{ left: BAR_W / 2 }}
        />
      </div>

      {/* Numeric value */}
      <div className="w-14 font-mono text-xs text-[#f2f2f2]">
        {clampedValue}
        <span
          className={`ml-1 text-[10px] ${deviation >= 0 ? 'text-[#8c8c8c]' : 'text-[#8c8c8c]'}`}
        >
          {deviation >= 0 ? `+${deviation}` : deviation}
        </span>
      </div>
    </div>
  );
}

// -- RC Stick Display --------------------------------------------------------

interface RcStickProps {
  label: string;
  xLabel: string;
  yLabel: string;
  xValue: number; // 1000-2000
  yValue: number; // 1000-2000
  yInverted?: boolean; // throttle: not inverted (bottom=1000), pitch: inverted
}

function RcStick({ label, xLabel, yLabel, xValue, yValue, yInverted = false }: RcStickProps) {
  const SIZE = 160;
  const PADDING = 12;
  const INNER = SIZE - PADDING * 2;

  const xNorm = chNorm(Math.max(1000, Math.min(2000, xValue))); // 0-1, 0=left
  const yNormRaw = chNorm(Math.max(1000, Math.min(2000, yValue))); // 0-1, 0=bottom
  // For display: yInverted=false => dot at bottom when 1000, top when 2000
  //              yInverted=true  => dot at top when 1000 (Pitch: up = forward = lower value)
  const yNorm = yInverted ? 1 - yNormRaw : yNormRaw;

  const dotX = PADDING + xNorm * INNER;
  // SVG y grows downward; yNorm=0 means bottom, so invert for SVG
  const dotY = PADDING + (1 - yNorm) * INNER;

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[11px] text-[#8c8c8c] uppercase tracking-widest">{label}</span>
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE}>
          {/* Background */}
          <rect
            x={0}
            y={0}
            width={SIZE}
            height={SIZE}
            fill="#0d0d0d"
            rx={4}
            stroke="#2a2a2a"
            strokeWidth={1}
          />
          {/* Grid */}
          {[0.25, 0.5, 0.75].map((t) => (
            <g key={t}>
              <line
                x1={PADDING + t * INNER}
                y1={PADDING}
                x2={PADDING + t * INNER}
                y2={SIZE - PADDING}
                stroke="#1e1e1e"
                strokeWidth={1}
              />
              <line
                x1={PADDING}
                y1={PADDING + t * INNER}
                x2={SIZE - PADDING}
                y2={PADDING + t * INNER}
                stroke="#1e1e1e"
                strokeWidth={1}
              />
            </g>
          ))}
          {/* Crosshair */}
          <line
            x1={SIZE / 2}
            y1={PADDING}
            x2={SIZE / 2}
            y2={SIZE - PADDING}
            stroke="#333"
            strokeWidth={1}
          />
          <line
            x1={PADDING}
            y1={SIZE / 2}
            x2={SIZE - PADDING}
            y2={SIZE / 2}
            stroke="#333"
            strokeWidth={1}
          />
          {/* Center dot */}
          <circle cx={SIZE / 2} cy={SIZE / 2} r={2} fill="#333" />
          {/* Stick dot */}
          <circle
            cx={dotX}
            cy={dotY}
            r={7}
            fill="#ffbb00"
            style={{ filter: 'drop-shadow(0 0 5px #ffbb0099)' }}
          />
          <circle cx={dotX} cy={dotY} r={3} fill="#fff" opacity={0.8} />
        </svg>
        {/* Axis labels */}
        <div
          className="absolute top-1 left-1/2 -translate-x-1/2 text-[9px] text-[#555] uppercase tracking-wider"
        >
          {yLabel}+
        </div>
        <div
          className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[9px] text-[#555] uppercase tracking-wider"
        >
          {yLabel}-
        </div>
        <div
          className="absolute left-1 top-1/2 -translate-y-1/2 text-[9px] text-[#555] uppercase tracking-wider"
          style={{ writingMode: 'vertical-rl', transform: 'translateY(-50%) rotate(180deg)' }}
        >
          {xLabel}-
        </div>
        <div
          className="absolute right-1 top-1/2 -translate-y-1/2 text-[9px] text-[#555] uppercase tracking-wider"
          style={{ writingMode: 'vertical-rl' }}
        >
          {xLabel}+
        </div>
      </div>
      {/* Value readout */}
      <div className="flex gap-3 text-[11px] font-mono text-[#8c8c8c]">
        <span>{xLabel}: <span className="text-[#f2f2f2]">{Math.round(xValue)}</span></span>
        <span>{yLabel}: <span className="text-[#f2f2f2]">{Math.round(yValue)}</span></span>
      </div>
    </div>
  );
}

// -- Channel Statistics Table ------------------------------------------------

interface ChannelStats {
  min: number;
  max: number;
  current: number;
}

interface ChannelStatsTableProps {
  stats: ChannelStats[];
}

function ChannelStatsTable({ stats }: ChannelStatsTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs font-mono">
        <thead>
          <tr className="border-b border-[#333]">
            <th className="text-left py-2 px-3 text-[#8c8c8c] font-medium">CH</th>
            <th className="text-left py-2 px-3 text-[#8c8c8c] font-medium">Name</th>
            <th className="text-right py-2 px-3 text-[#8c8c8c] font-medium">Min</th>
            <th className="text-right py-2 px-3 text-[#8c8c8c] font-medium">Max</th>
            <th className="text-right py-2 px-3 text-[#8c8c8c] font-medium">Current</th>
            <th className="text-right py-2 px-3 text-[#8c8c8c] font-medium">vs Center</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((s, i) => {
            const name = CHANNEL_NAMES[i] ?? `AUX${i - 4}`;
            const deviation = s.current - 1500;
            const deviationStr = deviation >= 0 ? `+${deviation}` : `${deviation}`;
            const deviationColor =
              Math.abs(deviation) > 400
                ? 'text-red-400'
                : Math.abs(deviation) > 200
                ? 'text-yellow-400'
                : 'text-[#8c8c8c]';
            return (
              <tr
                key={i}
                className="border-b border-[#222] hover:bg-[#242424] transition-colors"
              >
                <td className="py-1.5 px-3 text-[#8c8c8c]">{i + 1}</td>
                <td className="py-1.5 px-3 text-[#f2f2f2]">{name}</td>
                <td className="py-1.5 px-3 text-right text-blue-400">{s.min}</td>
                <td className="py-1.5 px-3 text-right text-green-400">{s.max}</td>
                <td className="py-1.5 px-3 text-right text-[#ffbb00]">{s.current}</td>
                <td className={`py-1.5 px-3 text-right ${deviationColor}`}>
                  {deviationStr}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// -- Custom Recharts Tooltip -------------------------------------------------

function RssiTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string | number;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-[#1f1f1f] border border-[#333] rounded px-3 py-2 text-xs font-mono">
      <div className="text-[#8c8c8c]">{label}</div>
      <div className="text-[#ffbb00] font-bold">{payload[0].value}%</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

interface RssiHistoryPoint {
  t: string;
  rssi: number;
}

export default function RadioPage() {
  const { telemetry, connected } = useTelemetry();

  // Rolling RSSI history (last 120 points)
  const [rssiHistory, setRssiHistory] = useState<RssiHistoryPoint[]>([]);

  // Per-channel min/max tracking
  const channelStatsRef = useRef<Array<{ min: number; max: number }>>([]);

  // Derived RSSI percentage
  const rssiPct = useMemo(() => {
    if (!telemetry?.battery?.rssi && telemetry?.battery?.rssi !== 0) return 0;
    return normalizeRssi(telemetry.battery.rssi);
  }, [telemetry]);

  const linkQuality = useMemo(() => getLinkQuality(rssiPct), [rssiPct]);
  const rssiColor = useMemo(() => getRssiColor(rssiPct), [rssiPct]);

  // Failsafe: triggered when RSSI drops below 10%
  const failsafeTriggered = rssiPct < 10 && connected;

  // RC channels (up to 16, or empty array)
  const rc: number[] = useMemo(() => telemetry?.rc ?? [], [telemetry]);
  const activeChannelCount = rc.length;

  // Update RSSI history when telemetry changes
  useEffect(() => {
    if (!telemetry) return;
    const now = new Date();
    const label = `${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    setRssiHistory((prev) => {
      const next = [...prev, { t: label, rssi: rssiPct }];
      return next.slice(-RSSI_HISTORY_MAX);
    });
  }, [telemetry, rssiPct]);

  // Update channel min/max stats
  useEffect(() => {
    if (rc.length === 0) return;
    rc.forEach((val, i) => {
      if (!channelStatsRef.current[i]) {
        channelStatsRef.current[i] = { min: val, max: val };
      } else {
        channelStatsRef.current[i].min = Math.min(channelStatsRef.current[i].min, val);
        channelStatsRef.current[i].max = Math.max(channelStatsRef.current[i].max, val);
      }
    });
  }, [rc]);

  const channelStats: ChannelStats[] = useMemo(() => {
    return rc.map((val, i) => ({
      min: channelStatsRef.current[i]?.min ?? val,
      max: channelStatsRef.current[i]?.max ?? val,
      current: val,
    }));
  }, [rc]);

  // Safe channel access
  const ch = useCallback(
    (idx: number): number => rc[idx] ?? 1500,
    [rc]
  );

  // RSSI chart reference line props
  const refLineStyle = { strokeDasharray: '4 4', strokeWidth: 1 };

  return (
    <div className="p-6 space-y-6">

      {/* ------------------------------------------------------------------ */}
      {/* Header Row                                                          */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Radio className="w-7 h-7 text-[#ffbb00]" />
          <div>
            <h1 className="text-2xl font-bold text-[#f2f2f2] leading-none">Radio &amp; RC</h1>
            <p className="text-[#8c8c8c] text-sm mt-0.5">RC link monitoring &amp; channel inspector</p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Connection status */}
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded border text-sm font-medium ${
              connected
                ? 'bg-green-950/40 border-green-700 text-green-400'
                : 'bg-red-950/40 border-red-700 text-red-400'
            }`}
          >
            {connected ? (
              <Wifi className="w-4 h-4" />
            ) : (
              <WifiOff className="w-4 h-4" />
            )}
            {connected ? 'Connected' : 'Disconnected'}
            {connected && (
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse ml-1" />
            )}
          </div>

          {/* Link quality badge */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs font-bold tracking-widest uppercase ${getLinkQualityBadgeClass(linkQuality)}`}
          >
            <Signal className="w-3.5 h-3.5" />
            {linkQuality}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Disconnected banner                                                 */}
      {/* ------------------------------------------------------------------ */}
      {!connected && (
        <div className="flex items-start gap-3 p-4 rounded-lg border border-red-700 bg-red-950/30">
          <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-red-300 font-semibold text-sm">No telemetry connection</p>
            <p className="text-red-400/70 text-xs mt-0.5">
              Unable to reach the flight controller. Check USB / wireless link and ensure the
              telemetry server is running on <code className="font-mono">ws://127.0.0.1:8000</code>.
            </p>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Row 1 - Signal Cards                                               */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

        {/* RSSI Gauge Card */}
        <Card className="bg-[#1f1f1f] border-[#333]">
          <CardHeader className="pb-0 pt-4">
            <CardTitle className="text-[#f2f2f2] text-sm font-semibold flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#ffbb00]" />
              RSSI
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center pb-4">
            <RssiGauge rssiPct={rssiPct} />
            <div className="flex items-center gap-2 text-xs text-[#8c8c8c] mt-1">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: rssiColor }}
              />
              Signal strength
            </div>
            {/* Raw value */}
            {telemetry?.battery?.rssi !== undefined && (
              <div className="mt-1 text-[11px] text-[#555] font-mono">
                raw: {telemetry.battery.rssi}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Link Quality Card */}
        <Card className="bg-[#1f1f1f] border-[#333]">
          <CardHeader className="pb-0 pt-4">
            <CardTitle className="text-[#f2f2f2] text-sm font-semibold flex items-center gap-2">
              <Signal className="w-4 h-4 text-[#ffbb00]" />
              Link Quality
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center gap-4 py-6">
            <div
              className={`text-4xl font-black tracking-widest ${getLinkQualityBadgeClass(linkQuality)} px-5 py-3 rounded-lg border`}
            >
              {linkQuality}
            </div>
            <div className="text-center space-y-1">
              <div className="text-[#f2f2f2] text-2xl font-bold font-mono">
                {rssiPct}
                <span className="text-[#8c8c8c] text-lg ml-1">%</span>
              </div>
              <div className="text-[#8c8c8c] text-xs">Signal percentage</div>
            </div>
            {/* Threshold legend */}
            <div className="flex gap-3 text-[10px] font-mono text-[#8c8c8c]">
              <span className="text-green-400">&#8805;60% EXCELLENT</span>
              <span className="text-yellow-400">&#8805;30% GOOD</span>
              <span className="text-red-400">&lt;30% POOR</span>
            </div>
          </CardContent>
        </Card>

        {/* Failsafe Status Card */}
        <Card className="bg-[#1f1f1f] border-[#333]">
          <CardHeader className="pb-0 pt-4">
            <CardTitle className="text-[#f2f2f2] text-sm font-semibold flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#ffbb00]" />
              Failsafe Status
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center gap-4 py-6">
            {failsafeTriggered ? (
              <>
                <ShieldAlert className="w-12 h-12 text-red-400 animate-pulse" />
                <div className="px-4 py-2 rounded-lg border border-red-600 bg-red-900/30 text-red-400 text-sm font-bold tracking-widest">
                  TRIGGERED
                </div>
                <p className="text-red-400/70 text-xs text-center">
                  RSSI below safe threshold. Failsafe may be active.
                </p>
              </>
            ) : (
              <>
                <ShieldCheck className="w-12 h-12 text-green-400" />
                <div className="px-4 py-2 rounded-lg border border-green-600 bg-green-900/30 text-green-400 text-sm font-bold tracking-widest">
                  SAFE
                </div>
                <p className="text-[#8c8c8c] text-xs text-center">
                  {connected
                    ? 'Link is active. Failsafe not triggered.'
                    : 'No link — failsafe state unknown.'}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Row 2 - RSSI History Chart                                          */}
      {/* ------------------------------------------------------------------ */}
      <Card className="bg-[#1f1f1f] border-[#333]">
        <CardHeader className="pb-2">
          <CardTitle className="text-[#f2f2f2] text-sm font-semibold flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#ffbb00]" />
            RSSI History
            <span className="ml-auto text-[#555] font-normal text-xs">Last 2 minutes</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-52">
            {rssiHistory.length === 0 ? (
              <div className="h-full flex items-center justify-center text-[#555] text-sm">
                Waiting for telemetry data&hellip;
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={rssiHistory} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                  <XAxis
                    dataKey="t"
                    stroke="#555"
                    tick={{ fill: '#555', fontSize: 10 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    stroke="#555"
                    tick={{ fill: '#555', fontSize: 10 }}
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                    width={42}
                  />
                  <Tooltip content={<RssiTooltip />} />
                  {/* Good threshold */}
                  <ReferenceLine
                    y={60}
                    stroke="#22c55e"
                    strokeOpacity={0.5}
                    label={{ value: '60%', fill: '#22c55e', fontSize: 10, position: 'right' }}
                    {...refLineStyle}
                  />
                  {/* Warning threshold */}
                  <ReferenceLine
                    y={30}
                    stroke="#eab308"
                    strokeOpacity={0.5}
                    label={{ value: '30%', fill: '#eab308', fontSize: 10, position: 'right' }}
                    {...refLineStyle}
                  />
                  <Line
                    type="monotone"
                    dataKey="rssi"
                    stroke={rssiColor}
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* Row 3 - RC Channel Bars                                             */}
      {/* ------------------------------------------------------------------ */}
      <Card className="bg-[#1f1f1f] border-[#333]">
        <CardHeader className="pb-2">
          <CardTitle className="text-[#f2f2f2] text-sm font-semibold flex items-center gap-2">
            <Radio className="w-4 h-4 text-[#ffbb00]" />
            RC Channels
            <Badge
              variant="secondary"
              className="ml-2 bg-[#2a2a2a] text-[#8c8c8c] text-[10px] px-2 py-0"
            >
              {activeChannelCount} active
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rc.length === 0 ? (
            <div className="py-8 text-center text-[#555] text-sm">
              No RC channel data received yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
              {rc.slice(0, 16).map((val, i) => (
                <RcChannelBar key={i} index={i} value={val} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* Row 4 - RC Sticks Visualization                                     */}
      {/* ------------------------------------------------------------------ */}
      <Card className="bg-[#1f1f1f] border-[#333]">
        <CardHeader className="pb-2">
          <CardTitle className="text-[#f2f2f2] text-sm font-semibold flex items-center gap-2">
            <Radio className="w-4 h-4 text-[#ffbb00]" />
            RC Sticks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap justify-center gap-12 py-2">
            {/* Left Stick: Yaw (X) / Throttle (Y) */}
            <RcStick
              label="Left Stick"
              xLabel="Yaw"
              yLabel="Thr"
              xValue={ch(3)}
              yValue={ch(2)}
              yInverted={false}
            />
            {/* Right Stick: Roll (X) / Pitch (Y) */}
            <RcStick
              label="Right Stick"
              xLabel="Roll"
              yLabel="Pitch"
              xValue={ch(0)}
              yValue={ch(1)}
              yInverted
            />
          </div>
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* Row 5 - Channel Statistics                                          */}
      {/* ------------------------------------------------------------------ */}
      {channelStats.length > 0 && (
        <Card className="bg-[#1f1f1f] border-[#333]">
          <CardHeader className="pb-2">
            <CardTitle className="text-[#f2f2f2] text-sm font-semibold flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#ffbb00]" />
              Channel Statistics
              <span className="ml-auto text-[#555] font-normal text-xs">
                Min / Max since page load
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 pb-2">
            <ChannelStatsTable stats={channelStats} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

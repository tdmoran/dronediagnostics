'use client';

import { useState, useEffect, useRef } from 'react';
import { useTelemetry } from '@/components/TelemetryProvider';
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import {
  Battery,
  BatteryWarning,
  BatteryLow,
  Zap,
  Activity,
  AlertTriangle,
  WifiOff,
  Clock,
  TrendingDown,
  Layers,
  Gauge,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BatteryPoint {
  /** Wall-clock timestamp (ms) */
  ts: number;
  /** Seconds elapsed since first point */
  elapsed: number;
  voltage: number;
  amperage: number;
  power: number;
  powerMeter: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_BUFFER = 300; // 300 points  ≈ 30 s at 10 Hz
const LIPO_CELL_FULL_V = 4.2;
const LIPO_CELL_NOMINAL_V = 3.7;
const LIPO_CELL_CRITICAL_V = 3.0;
const VOLTAGE_FULL = 14.8;    // reference lines on chart (4S defaults)
const VOLTAGE_NOMINAL = 14.0;
const VOLTAGE_CRITICAL = 12.0;

const CHART_TOOLTIP_STYLE = {
  backgroundColor: '#1f1f1f',
  border: '1px solid #333',
  borderRadius: '4px',
  color: '#f2f2f2',
  fontSize: '12px',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function voltageColor(v: number): string {
  if (v >= 14) return '#22c55e';
  if (v >= 12) return '#ffbb00';
  return '#ef4444';
}

function chargeColor(pct: number): string {
  if (pct >= 40) return '#22c55e';
  if (pct >= 20) return '#ffbb00';
  return '#ef4444';
}

function estimateCellCount(voltage: number): number {
  if (voltage <= 0) return 0;
  return Math.max(1, Math.round(voltage / LIPO_CELL_FULL_V));
}

function formatSeconds(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

function formatMah(mah: number): string {
  if (mah >= 1000) return `${(mah / 1000).toFixed(2)} Ah`;
  return `${mah.toFixed(0)} mAh`;
}

// ---------------------------------------------------------------------------
// Animated number component
// ---------------------------------------------------------------------------

function AnimatedValue({
  value,
  decimals = 1,
  suffix = '',
  className = '',
}: {
  value: number;
  decimals?: number;
  suffix?: string;
  className?: string;
}) {
  return (
    <motion.span
      key={value.toFixed(decimals)}
      initial={{ opacity: 0.6, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className={className}
    >
      {value.toFixed(decimals)}
      {suffix}
    </motion.span>
  );
}

// ---------------------------------------------------------------------------
// Circular progress for charge level
// ---------------------------------------------------------------------------

function ChargeCircle({ pct }: { pct: number }) {
  const r = 42;
  const circ = 2 * Math.PI * r;
  const dash = circ * (pct / 100);
  const color = chargeColor(pct);

  return (
    <div className="relative w-28 h-28 flex items-center justify-center">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100" width={112} height={112}>
        {/* Track */}
        <circle cx={50} cy={50} r={r} fill="none" stroke="#333" strokeWidth={8} />
        {/* Progress */}
        <circle
          cx={50}
          cy={50}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          style={{ transition: 'stroke-dasharray 0.4s ease, stroke 0.4s ease' }}
        />
      </svg>
      <div className="relative flex flex-col items-center leading-tight">
        <span className="text-2xl font-bold" style={{ color }}>
          {Math.round(pct)}%
        </span>
        <span className="text-[10px] text-[#8c8c8c] uppercase tracking-wide">Charge</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Metric card
// ---------------------------------------------------------------------------

function MetricCard({
  icon,
  label,
  value,
  valueColor = '#f2f2f2',
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  valueColor?: string;
  sub?: React.ReactNode;
}) {
  return (
    <div className="bg-[#1f1f1f] border border-[#333] rounded-lg p-4 flex flex-col gap-2">
      <div className="flex items-center gap-2 text-[#8c8c8c] text-xs uppercase tracking-wider">
        {icon}
        {label}
      </div>
      <div className="text-4xl font-bold font-mono leading-none" style={{ color: valueColor }}>
        {value}
      </div>
      {sub && <div className="text-xs text-[#8c8c8c]">{sub}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custom tooltip for recharts
// ---------------------------------------------------------------------------

function ChartTooltip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: string | number;
  unit?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div style={CHART_TOOLTIP_STYLE} className="px-3 py-2 space-y-1">
      <p className="text-[#8c8c8c] text-[11px]">{label}s ago</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="text-[12px] font-mono">
          {p.name}: {typeof p.value === 'number' ? p.value.toFixed(2) : p.value}
          {unit}
        </p>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cell health indicator
// ---------------------------------------------------------------------------

function CellHealthBar({ cellV }: { cellV: number }) {
  const pct = Math.max(
    0,
    Math.min(100, ((cellV - LIPO_CELL_CRITICAL_V) / (LIPO_CELL_FULL_V - LIPO_CELL_CRITICAL_V)) * 100)
  );
  const color =
    cellV >= LIPO_CELL_NOMINAL_V ? '#22c55e' : cellV >= LIPO_CELL_CRITICAL_V ? '#ffbb00' : '#ef4444';
  const label =
    cellV >= LIPO_CELL_NOMINAL_V
      ? 'Good'
      : cellV >= LIPO_CELL_CRITICAL_V
      ? 'Low'
      : 'Critical';

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-[#8c8c8c]">
        <span>Cell health</span>
        <span style={{ color }} className="font-semibold">
          {label}
        </span>
      </div>
      <div className="h-2 bg-[#333] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            backgroundColor: color,
            transition: 'width 0.4s ease, background-color 0.4s ease',
          }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function BatteryPage() {
  const { telemetry, connected } = useTelemetry();

  // Rolling telemetry buffer
  const bufferRef = useRef<BatteryPoint[]>([]);
  const [buffer, setBuffer] = useState<BatteryPoint[]>([]);

  // Session tracking
  const sessionStartRef = useRef<number | null>(null);
  const [sessionDuration, setSessionDuration] = useState(0);

  // Accumulated mAh (trapezoidal integration at 100 ms intervals)
  const mahRef = useRef(0);
  const lastMahTsRef = useRef<number | null>(null);
  const [mahConsumed, setMahConsumed] = useState(0);

  // Peak current in session
  const peakCurrentRef = useRef(0);
  const [peakCurrent, setPeakCurrent] = useState(0);

  // Append new telemetry points
  useEffect(() => {
    if (!telemetry?.battery) return;

    const { voltage, amperage, power_meter } = telemetry.battery;
    const now = Date.now();

    // Mark session start on first connection
    if (sessionStartRef.current === null && connected) {
      sessionStartRef.current = now;
    }

    // mAh integration: I (A) * dt (h) * 1000
    if (lastMahTsRef.current !== null) {
      const dtHours = (now - lastMahTsRef.current) / 3_600_000;
      mahRef.current += amperage * dtHours * 1000;
      setMahConsumed(mahRef.current);
    }
    lastMahTsRef.current = now;

    // Peak current
    if (amperage > peakCurrentRef.current) {
      peakCurrentRef.current = amperage;
      setPeakCurrent(amperage);
    }

    const elapsed =
      bufferRef.current.length > 0
        ? (now - bufferRef.current[0].ts) / 1000
        : 0;

    const point: BatteryPoint = {
      ts: now,
      elapsed,
      voltage,
      amperage,
      power: voltage * amperage,
      powerMeter: power_meter,
    };

    bufferRef.current = [...bufferRef.current, point].slice(-MAX_BUFFER);
    setBuffer([...bufferRef.current]);
  }, [telemetry, connected]);

  // Session timer tick
  useEffect(() => {
    const id = setInterval(() => {
      if (sessionStartRef.current !== null) {
        setSessionDuration((Date.now() - sessionStartRef.current) / 1000);
      }
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // -------------------------------------------------------------------------
  // Derived values from latest telemetry
  // -------------------------------------------------------------------------

  const latest = buffer[buffer.length - 1];
  const voltage = latest?.voltage ?? 0;
  const amperage = latest?.amperage ?? 0;
  const power = voltage * amperage;
  const powerMeter = latest?.powerMeter ?? 0;

  // Cell estimation
  const cellCount = voltage > 0 ? estimateCellCount(voltage) : 0;
  const cellVoltage = cellCount > 0 ? voltage / cellCount : 0;

  // Average voltage over buffer
  const avgVoltage =
    buffer.length > 0
      ? buffer.reduce((s, p) => s + p.voltage, 0) / buffer.length
      : 0;

  // Estimated flight time remaining (minutes)
  // Based on power_meter % remaining and average current draw
  const avgCurrent =
    buffer.length > 1
      ? buffer.reduce((s, p) => s + p.amperage, 0) / buffer.length
      : amperage;

  // Estimate mAh remaining: assume battery capacity proportional to power_meter
  // We use (powerMeter % * estimated total mAh) / avgCurrent
  // If avgCurrent is very small, cap to avoid Infinity
  const estimatedFlightMinutes =
    avgCurrent > 0.5 && powerMeter > 0
      ? // Using a heuristic: remaining_mah / avg_mA * 60
        // We treat mahConsumed as drawn so far, power_meter as % remaining
        // remaining_mah ≈ mahConsumed * (powerMeter / (100 - powerMeter))  when discharge is linear
        (() => {
          const consumed = mahConsumed > 0 ? mahConsumed : 1;
          const dischargePct = 100 - powerMeter;
          const remainingMah =
            dischargePct > 0 ? consumed * (powerMeter / dischargePct) : consumed * 2;
          return remainingMah / (avgCurrent * 1000 / 60);
        })()
      : null;

  // Chart data: seconds-ago axis (newest = 0, oldest = most negative)
  const chartData = buffer.map((p, i) => ({
    t: -((buffer[buffer.length - 1]?.ts ?? p.ts) - p.ts) / 1000,
    voltage: parseFloat(p.voltage.toFixed(3)),
    amperage: parseFloat(p.amperage.toFixed(2)),
    power: parseFloat(p.power.toFixed(1)),
  }));

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="p-6 space-y-6 min-h-full">
      {/* ------------------------------------------------------------------ */}
      {/* Page Header                                                          */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Battery className="w-7 h-7 text-[#ffbb00]" />
          <div>
            <h1 className="text-2xl font-bold text-[#f2f2f2]">Battery Monitor</h1>
            <p className="text-sm text-[#8c8c8c]">Live power system telemetry</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
            }`}
          />
          <span className="text-[#8c8c8c]">{connected ? 'Live' : 'Disconnected'}</span>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Disconnection banner                                                */}
      {/* ------------------------------------------------------------------ */}
      <AnimatePresence>
        {!connected && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
          >
            <div className="flex items-center gap-3 bg-[#1f1f1f] border border-[#ff6b6b]/40 rounded-lg px-4 py-3 text-sm text-[#ff6b6b]">
              <WifiOff className="w-4 h-4 flex-shrink-0" />
              <span>
                No telemetry connection.
                {buffer.length > 0
                  ? ' Displaying buffered data from last session.'
                  : ' Connect your flight controller to see live data.'}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ------------------------------------------------------------------ */}
      {/* Row 1 — Key metrics                                                 */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Voltage */}
        <MetricCard
          icon={<Zap className="w-3.5 h-3.5" />}
          label="Pack Voltage"
          valueColor={voltageColor(voltage)}
          value={
            <AnimatedValue
              value={voltage}
              decimals={2}
              suffix="V"
              className="tabular-nums"
            />
          }
          sub={
            voltage > 0 ? (
              <span style={{ color: voltageColor(voltage) }}>
                {voltage >= 14 ? 'Good' : voltage >= 12 ? 'Nominal' : 'Critical — land now'}
              </span>
            ) : (
              'No data'
            )
          }
        />

        {/* Current */}
        <MetricCard
          icon={<Activity className="w-3.5 h-3.5" />}
          label="Draw"
          valueColor="#00d4ff"
          value={
            <AnimatedValue
              value={amperage}
              decimals={1}
              suffix="A"
              className="tabular-nums"
            />
          }
          sub={`Peak: ${peakCurrent.toFixed(1)} A`}
        />

        {/* Power */}
        <MetricCard
          icon={<Gauge className="w-3.5 h-3.5" />}
          label="Power"
          valueColor="#ff6b6b"
          value={
            <AnimatedValue
              value={power}
              decimals={0}
              suffix="W"
              className="tabular-nums"
            />
          }
          sub={`V × A = ${voltage.toFixed(1)} × ${amperage.toFixed(1)}`}
        />

        {/* Charge Level */}
        <div className="bg-[#1f1f1f] border border-[#333] rounded-lg p-4 flex flex-col items-center justify-center gap-2">
          <div className="flex items-center gap-2 text-[#8c8c8c] text-xs uppercase tracking-wider self-start">
            {powerMeter >= 40 ? (
              <Battery className="w-3.5 h-3.5" />
            ) : powerMeter >= 20 ? (
              <BatteryLow className="w-3.5 h-3.5" />
            ) : (
              <BatteryWarning className="w-3.5 h-3.5" />
            )}
            Charge Level
          </div>
          <ChargeCircle pct={powerMeter} />
          <div className="text-xs text-[#8c8c8c]">power_meter reading</div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Row 2 — Voltage history chart                                        */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-[#1f1f1f] border border-[#333] rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-[#f2f2f2] flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-[#ffbb00]" />
            Voltage History
          </h2>
          <span className="text-[#8c8c8c] text-xs">Last {Math.round((buffer.length / MAX_BUFFER) * 30)}s of data</span>
        </div>

        {buffer.length === 0 ? (
          <div className="h-56 flex items-center justify-center text-[#8c8c8c] text-sm">
            Waiting for telemetry data…
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="voltageGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ffbb00" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#ffbb00" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" vertical={false} />
              <XAxis
                dataKey="t"
                stroke="#555"
                tick={{ fill: '#8c8c8c', fontSize: 11 }}
                tickFormatter={(v: number) => `${Math.abs(v).toFixed(0)}s`}
                label={{ value: 'seconds ago', position: 'insideBottomRight', offset: -4, fill: '#555', fontSize: 10 }}
              />
              <YAxis
                stroke="#555"
                tick={{ fill: '#8c8c8c', fontSize: 11 }}
                domain={['auto', 'auto']}
                tickFormatter={(v: number) => `${v.toFixed(1)}V`}
                width={52}
              />
              <Tooltip content={<ChartTooltip unit="V" />} />
              {/* Reference lines */}
              <ReferenceLine y={VOLTAGE_FULL} stroke="#22c55e" strokeDasharray="4 3" strokeWidth={1}>
              </ReferenceLine>
              <ReferenceLine y={VOLTAGE_NOMINAL} stroke="#ffbb00" strokeDasharray="4 3" strokeWidth={1}>
              </ReferenceLine>
              <ReferenceLine y={VOLTAGE_CRITICAL} stroke="#ef4444" strokeDasharray="4 3" strokeWidth={1}>
              </ReferenceLine>
              <Area
                type="monotone"
                dataKey="voltage"
                stroke="#ffbb00"
                strokeWidth={2}
                fill="url(#voltageGrad)"
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}

        {/* Reference line legend */}
        <div className="flex items-center gap-6 mt-2 text-[11px] text-[#8c8c8c]">
          <span className="flex items-center gap-1.5">
            <span className="w-5 border-t-2 border-dashed border-green-500 inline-block" />
            {VOLTAGE_FULL}V Full
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-5 border-t-2 border-dashed border-[#ffbb00] inline-block" />
            {VOLTAGE_NOMINAL}V Nominal
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-5 border-t-2 border-dashed border-red-500 inline-block" />
            {VOLTAGE_CRITICAL}V Critical
          </span>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Row 3 — Current & Power charts (side by side)                       */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Current draw */}
        <div className="bg-[#1f1f1f] border border-[#333] rounded-lg p-4">
          <h2 className="text-sm font-semibold text-[#f2f2f2] flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-[#00d4ff]" />
            Current Draw
          </h2>
          {buffer.length === 0 ? (
            <div className="h-44 flex items-center justify-center text-[#8c8c8c] text-sm">
              No data yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={176}>
              <LineChart data={chartData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" vertical={false} />
                <XAxis
                  dataKey="t"
                  stroke="#555"
                  tick={{ fill: '#8c8c8c', fontSize: 10 }}
                  tickFormatter={(v: number) => `${Math.abs(v).toFixed(0)}s`}
                />
                <YAxis
                  stroke="#555"
                  tick={{ fill: '#8c8c8c', fontSize: 10 }}
                  tickFormatter={(v: number) => `${v.toFixed(0)}A`}
                  width={40}
                />
                <Tooltip content={<ChartTooltip unit="A" />} />
                <Line
                  type="monotone"
                  dataKey="amperage"
                  stroke="#00d4ff"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Power */}
        <div className="bg-[#1f1f1f] border border-[#333] rounded-lg p-4">
          <h2 className="text-sm font-semibold text-[#f2f2f2] flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4 text-[#ff6b6b]" />
            Power (Watts)
          </h2>
          {buffer.length === 0 ? (
            <div className="h-44 flex items-center justify-center text-[#8c8c8c] text-sm">
              No data yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={176}>
              <LineChart data={chartData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" vertical={false} />
                <XAxis
                  dataKey="t"
                  stroke="#555"
                  tick={{ fill: '#8c8c8c', fontSize: 10 }}
                  tickFormatter={(v: number) => `${Math.abs(v).toFixed(0)}s`}
                />
                <YAxis
                  stroke="#555"
                  tick={{ fill: '#8c8c8c', fontSize: 10 }}
                  tickFormatter={(v: number) => `${v.toFixed(0)}W`}
                  width={48}
                />
                <Tooltip content={<ChartTooltip unit="W" />} />
                <Line
                  type="monotone"
                  dataKey="power"
                  stroke="#ff6b6b"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Row 4 — Battery health panel                                         */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-[#1f1f1f] border border-[#333] rounded-lg p-4">
        <h2 className="text-sm font-semibold text-[#f2f2f2] flex items-center gap-2 mb-4">
          <AlertTriangle className="w-4 h-4 text-[#ffbb00]" />
          Battery Health &amp; Session Stats
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {/* Flight time remaining */}
          <div className="bg-[#242424] rounded-lg p-3 space-y-1">
            <div className="text-[10px] text-[#8c8c8c] uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3 h-3" />
              Est. Flight Remaining
            </div>
            <div className="text-xl font-bold font-mono text-[#f2f2f2]">
              {estimatedFlightMinutes !== null && isFinite(estimatedFlightMinutes)
                ? `${Math.max(0, estimatedFlightMinutes).toFixed(1)} min`
                : '—'}
            </div>
            <div className="text-[10px] text-[#8c8c8c]">based on avg draw</div>
          </div>

          {/* Average voltage */}
          <div className="bg-[#242424] rounded-lg p-3 space-y-1">
            <div className="text-[10px] text-[#8c8c8c] uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="w-3 h-3" />
              Avg Voltage
            </div>
            <div
              className="text-xl font-bold font-mono"
              style={{ color: avgVoltage > 0 ? voltageColor(avgVoltage) : '#8c8c8c' }}
            >
              {avgVoltage > 0 ? `${avgVoltage.toFixed(2)}V` : '—'}
            </div>
            <div className="text-[10px] text-[#8c8c8c]">session average</div>
          </div>

          {/* Peak current */}
          <div className="bg-[#242424] rounded-lg p-3 space-y-1">
            <div className="text-[10px] text-[#8c8c8c] uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="w-3 h-3" />
              Peak Current
            </div>
            <div className="text-xl font-bold font-mono text-[#00d4ff]">
              {peakCurrent > 0 ? `${peakCurrent.toFixed(1)}A` : '—'}
            </div>
            <div className="text-[10px] text-[#8c8c8c]">session max</div>
          </div>

          {/* mAh consumed */}
          <div className="bg-[#242424] rounded-lg p-3 space-y-1">
            <div className="text-[10px] text-[#8c8c8c] uppercase tracking-wider flex items-center gap-1.5">
              <TrendingDown className="w-3 h-3" />
              mAh Consumed
            </div>
            <div className="text-xl font-bold font-mono text-[#ff6b6b]">
              {mahConsumed > 0 ? formatMah(mahConsumed) : '—'}
            </div>
            <div className="text-[10px] text-[#8c8c8c]">integrated from I×t</div>
          </div>

          {/* Session duration */}
          <div className="bg-[#242424] rounded-lg p-3 space-y-1">
            <div className="text-[10px] text-[#8c8c8c] uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3 h-3" />
              Session Duration
            </div>
            <div className="text-xl font-bold font-mono text-[#f2f2f2]">
              {sessionDuration > 0 ? formatSeconds(sessionDuration) : '—'}
            </div>
            <div className="text-[10px] text-[#8c8c8c]">since first connection</div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Row 5 — Cell voltage estimation                                      */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-[#1f1f1f] border border-[#333] rounded-lg p-4">
        <h2 className="text-sm font-semibold text-[#f2f2f2] flex items-center gap-2 mb-4">
          <Layers className="w-4 h-4 text-[#ffbb00]" />
          Cell Voltage Estimation
        </h2>

        {voltage <= 0 ? (
          <p className="text-[#8c8c8c] text-sm">No voltage data available.</p>
        ) : (
          <div className="space-y-4">
            {/* Summary row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-[#242424] rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-[#ffbb00] font-mono">{cellCount}S</div>
                <div className="text-[11px] text-[#8c8c8c] mt-0.5">Estimated Config</div>
              </div>
              <div className="bg-[#242424] rounded-lg p-3 text-center">
                <div
                  className="text-2xl font-bold font-mono"
                  style={{ color: chargeColor(((cellVoltage - LIPO_CELL_CRITICAL_V) / (LIPO_CELL_FULL_V - LIPO_CELL_CRITICAL_V)) * 100) }}
                >
                  {cellVoltage.toFixed(3)}V
                </div>
                <div className="text-[11px] text-[#8c8c8c] mt-0.5">Per Cell</div>
              </div>
              <div className="bg-[#242424] rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-[#f2f2f2] font-mono">
                  {(cellCount * LIPO_CELL_FULL_V).toFixed(1)}V
                </div>
                <div className="text-[11px] text-[#8c8c8c] mt-0.5">Full Charge Target</div>
              </div>
              <div className="bg-[#242424] rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-red-500 font-mono">
                  {(cellCount * LIPO_CELL_CRITICAL_V).toFixed(1)}V
                </div>
                <div className="text-[11px] text-[#8c8c8c] mt-0.5">Critical Cutoff</div>
              </div>
            </div>

            {/* Cell health bar */}
            <div className="max-w-md">
              <CellHealthBar cellV={cellVoltage} />
            </div>

            {/* Visual cells */}
            {cellCount > 0 && cellCount <= 12 && (
              <div>
                <p className="text-[11px] text-[#8c8c8c] mb-2">Estimated cell layout</p>
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: cellCount }).map((_, i) => {
                    const pct =
                      ((cellVoltage - LIPO_CELL_CRITICAL_V) /
                        (LIPO_CELL_FULL_V - LIPO_CELL_CRITICAL_V)) *
                      100;
                    const bg =
                      cellVoltage >= LIPO_CELL_NOMINAL_V
                        ? '#22c55e'
                        : cellVoltage >= LIPO_CELL_CRITICAL_V
                        ? '#ffbb00'
                        : '#ef4444';
                    return (
                      <div
                        key={i}
                        className="relative w-10 rounded-sm border border-[#444] overflow-hidden"
                        style={{ height: 52, backgroundColor: '#141414' }}
                        title={`Cell ${i + 1}: ~${cellVoltage.toFixed(3)}V`}
                      >
                        {/* Fill from bottom */}
                        <div
                          className="absolute bottom-0 left-0 right-0"
                          style={{
                            height: `${Math.max(0, Math.min(100, pct))}%`,
                            backgroundColor: bg,
                            opacity: 0.85,
                            transition: 'height 0.4s ease, background-color 0.4s ease',
                          }}
                        />
                        {/* Cell number */}
                        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white mix-blend-plus-lighter">
                          {i + 1}
                        </span>
                        {/* Positive terminal nub */}
                        <div
                          className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-1.5 rounded-t-sm border border-[#444]"
                          style={{ backgroundColor: '#242424' }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <p className="text-[11px] text-[#8c8c8c]">
              Cell count estimated by dividing pack voltage ({voltage.toFixed(2)}V) by{' '}
              {LIPO_CELL_FULL_V}V per cell (LiPo fully charged). Assumes balanced pack.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

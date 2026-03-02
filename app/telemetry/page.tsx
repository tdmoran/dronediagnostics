'use client';

import { useState, useEffect, useRef } from 'react';
import { useTelemetry } from '@/components/TelemetryProvider';
import type { TelemetryData } from '@/types/gps';
import {
  Activity,
  Wifi,
  WifiOff,
  Battery,
  BatteryWarning,
  Satellite,
  Navigation,
  Cpu,
  Radio,
  Zap,
  ChevronDown,
  ChevronRight,
  MapPin,
  Gauge,
  AlertTriangle,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChartPoint {
  t: number;
  // gyro
  gx: number;
  gy: number;
  gz: number;
  // accel
  ax: number;
  ay: number;
  az: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BUFFER_SIZE = 60;

function fmt(n: number | undefined | null, decimals = 1): string {
  if (n == null || isNaN(n)) return '—';
  return n.toFixed(decimals);
}

function fmtTs(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/** Return Tailwind text color based on attitude angle (degrees). */
function attitudeColor(deg: number, warnAt = 30, dangerAt = 60): string {
  const abs = Math.abs(deg);
  if (abs >= dangerAt) return 'text-red-400';
  if (abs >= warnAt) return 'text-yellow-400';
  return 'text-green-400';
}

/** Return Tailwind text color for battery voltage (per-cell ≥ 3.7 V = ok). */
function voltageColor(v: number): string {
  if (v >= 14.8) return 'text-green-400';
  if (v >= 13.0) return 'text-yellow-400';
  return 'text-red-400';
}

/** Return Tailwind text color for RSSI. */
function rssiColor(rssi: number): string {
  if (rssi >= 50) return 'text-green-400';
  if (rssi >= 30) return 'text-yellow-400';
  return 'text-red-400';
}

/** Decode Betaflight sensors bitmask into named sensors. */
const SENSOR_BITS: Record<number, string> = {
  1: 'ACC',
  2: 'BARO',
  4: 'MAG',
  8: 'SONAR',
  16: 'GPS',
  32: 'GYRO',
};

function decodeSensors(mask: number): string[] {
  return Object.entries(SENSOR_BITS)
    .filter(([bit]) => mask & Number(bit))
    .map(([, name]) => name);
}

/** Motor throttle progress bar color by value (0-2000). */
function motorColor(value: number): string {
  const pct = value / 2000;
  if (pct < 0.3) return 'bg-blue-500';
  if (pct < 0.6) return 'bg-[#ffbb00]';
  return 'bg-red-500';
}

/** RC channel deviation from center (1500), clamped 1000-2000. */
function rcBarWidth(value: number): number {
  return Math.min(100, Math.max(0, ((value - 1000) / 1000) * 100));
}

function rcBarColor(value: number): string {
  const delta = Math.abs(value - 1500);
  if (delta < 100) return 'bg-green-500';
  if (delta < 300) return 'bg-[#ffbb00]';
  return 'bg-red-500';
}

// ---------------------------------------------------------------------------
// Panel wrapper
// ---------------------------------------------------------------------------

function Panel({
  icon,
  title,
  children,
  className = '',
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-[#1f1f1f] border border-[#333] rounded-lg p-4 ${className}`}
    >
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[#333]">
        <span className="text-[#ffbb00]">{icon}</span>
        <h2 className="text-sm font-semibold uppercase tracking-widest text-[#ffbb00]">
          {title}
        </h2>
      </div>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton card
// ---------------------------------------------------------------------------

function SkeletonPanel({ rows = 3 }: { rows?: number }) {
  return (
    <div className="bg-[#1f1f1f] border border-[#333] rounded-lg p-4 animate-pulse">
      <div className="h-4 bg-[#2a2a2a] rounded w-1/3 mb-4" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-3 bg-[#242424] rounded mb-2" />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Not Connected banner
// ---------------------------------------------------------------------------

function NotConnectedBanner() {
  return (
    <div className="w-full flex items-start gap-4 bg-[#1f1f1f] border border-[#333] rounded-lg p-6">
      <div className="flex-shrink-0 mt-0.5">
        <WifiOff className="w-8 h-8 text-red-400 animate-pulse" />
      </div>
      <div>
        <p className="text-[#f2f2f2] font-semibold text-lg mb-1">
          Not connected to telemetry backend
        </p>
        <p className="text-[#8c8c8c] text-sm leading-relaxed">
          The live telemetry WebSocket at{' '}
          <code className="font-mono text-[#ffbb00] bg-[#141414] px-1 rounded">
            ws://127.0.0.1:8000/ws/telemetry
          </code>{' '}
          is not reachable. Start the backend server and this page will
          reconnect automatically every 3 seconds.
        </p>
        <div className="mt-3 flex items-center gap-2 text-sm text-[#8c8c8c]">
          <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          Retrying connection…
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Attitude panel
// ---------------------------------------------------------------------------

function AttitudePanel({
  attitude,
}: {
  attitude: TelemetryData['attitude'];
}) {
  const items = [
    { label: 'Roll', value: attitude?.roll },
    { label: 'Pitch', value: attitude?.pitch },
    { label: 'Yaw', value: attitude?.yaw },
  ];

  return (
    <Panel icon={<Navigation className="w-4 h-4" />} title="Attitude">
      <div className="grid grid-cols-3 gap-3">
        {items.map(({ label, value }) => (
          <div key={label} className="bg-[#141414] rounded-lg p-3 text-center">
            <p className="text-[#8c8c8c] text-xs mb-1 uppercase tracking-wider">
              {label}
            </p>
            <p
              className={`text-2xl font-bold font-mono ${value != null ? attitudeColor(value) : 'text-[#8c8c8c]'}`}
            >
              {fmt(value, 1)}
              <span className="text-sm ml-0.5">°</span>
            </p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Mini chart tooltip
// ---------------------------------------------------------------------------

function ChartTooltipContent({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1a1a1a] border border-[#444] rounded px-2 py-1 text-xs font-mono">
      {payload.map((entry) => (
        <div key={entry.name} style={{ color: entry.color }}>
          {entry.name}: {entry.value?.toFixed(2)}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Gyroscope panel
// ---------------------------------------------------------------------------

function GyroscopePanel({
  gyro,
  buffer,
}: {
  gyro: TelemetryData['gyro'];
  buffer: ChartPoint[];
}) {
  return (
    <Panel icon={<Activity className="w-4 h-4" />} title="Gyroscope">
      <div className="grid grid-cols-3 gap-3 mb-4">
        {(['x', 'y', 'z'] as const).map((axis, i) => (
          <div key={axis} className="bg-[#141414] rounded-lg p-3 text-center">
            <p className="text-[#8c8c8c] text-xs mb-1 uppercase">{axis}</p>
            <p
              className="text-lg font-bold font-mono"
              style={{ color: ['#ef4444', '#22c55e', '#3b82f6'][i] }}
            >
              {fmt(gyro?.[axis], 1)}
            </p>
            <p className="text-[#8c8c8c] text-xs">°/s</p>
          </div>
        ))}
      </div>
      <div className="h-28">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={buffer} margin={{ top: 2, right: 4, left: -28, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
            <XAxis dataKey="t" hide />
            <YAxis stroke="#555" fontSize={9} tickCount={5} />
            <Tooltip content={<ChartTooltipContent />} />
            <Line
              type="monotone"
              dataKey="gx"
              name="X"
              stroke="#ef4444"
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="gy"
              name="Y"
              stroke="#22c55e"
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="gz"
              name="Z"
              stroke="#3b82f6"
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="flex gap-4 mt-1">
        {[['X', '#ef4444'], ['Y', '#22c55e'], ['Z', '#3b82f6']].map(
          ([label, color]) => (
            <span
              key={label}
              className="flex items-center gap-1 text-xs text-[#8c8c8c]"
            >
              <span
                className="inline-block w-3 h-0.5 rounded"
                style={{ backgroundColor: color }}
              />
              {label}
            </span>
          )
        )}
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Accelerometer panel
// ---------------------------------------------------------------------------

function AccelerometerPanel({
  accel,
  buffer,
}: {
  accel: TelemetryData['accel'];
  buffer: ChartPoint[];
}) {
  return (
    <Panel icon={<Gauge className="w-4 h-4" />} title="Accelerometer">
      <div className="grid grid-cols-3 gap-3 mb-4">
        {(['x', 'y', 'z'] as const).map((axis, i) => (
          <div key={axis} className="bg-[#141414] rounded-lg p-3 text-center">
            <p className="text-[#8c8c8c] text-xs mb-1 uppercase">{axis}</p>
            <p
              className="text-lg font-bold font-mono"
              style={{ color: ['#f97316', '#a855f7', '#06b6d4'][i] }}
            >
              {fmt(accel?.[axis], 2)}
            </p>
            <p className="text-[#8c8c8c] text-xs">m/s²</p>
          </div>
        ))}
      </div>
      <div className="h-28">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={buffer} margin={{ top: 2, right: 4, left: -28, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
            <XAxis dataKey="t" hide />
            <YAxis stroke="#555" fontSize={9} tickCount={5} />
            <Tooltip content={<ChartTooltipContent />} />
            <Line
              type="monotone"
              dataKey="ax"
              name="X"
              stroke="#f97316"
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="ay"
              name="Y"
              stroke="#a855f7"
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="az"
              name="Z"
              stroke="#06b6d4"
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="flex gap-4 mt-1">
        {[['X', '#f97316'], ['Y', '#a855f7'], ['Z', '#06b6d4']].map(
          ([label, color]) => (
            <span
              key={label}
              className="flex items-center gap-1 text-xs text-[#8c8c8c]"
            >
              <span
                className="inline-block w-3 h-0.5 rounded"
                style={{ backgroundColor: color }}
              />
              {label}
            </span>
          )
        )}
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Battery panel
// ---------------------------------------------------------------------------

function BatteryPanel({
  battery,
}: {
  battery: TelemetryData['battery'];
}) {
  const voltage = battery?.voltage ?? 0;
  const amperage = battery?.amperage ?? 0;
  const rssi = battery?.rssi ?? 0;
  const powerMeter = battery?.power_meter ?? 0;

  return (
    <Panel icon={<Battery className="w-4 h-4" />} title="Battery">
      {/* Big voltage */}
      <div className="flex items-end gap-2 mb-4">
        <span className={`text-4xl font-bold font-mono ${voltageColor(voltage)}`}>
          {fmt(voltage, 2)}
        </span>
        <span className="text-[#8c8c8c] text-base mb-1">V</span>
        {voltage > 0 && voltage < 13.0 && (
          <BatteryWarning className="w-5 h-5 text-red-400 animate-pulse mb-1 ml-1" />
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[#141414] rounded-lg p-3">
          <p className="text-[#8c8c8c] text-xs mb-1">Amperage</p>
          <p className="text-[#f2f2f2] text-lg font-mono font-semibold">
            {fmt(amperage, 2)}{' '}
            <span className="text-[#8c8c8c] text-xs">A</span>
          </p>
        </div>
        <div className="bg-[#141414] rounded-lg p-3">
          <p className="text-[#8c8c8c] text-xs mb-1">RSSI</p>
          <p className={`text-lg font-mono font-semibold ${rssiColor(rssi)}`}>
            {rssi}{' '}
            <span className="text-[#8c8c8c] text-xs">%</span>
          </p>
        </div>
      </div>

      {/* Power meter */}
      <div className="mt-3">
        <div className="flex justify-between text-xs text-[#8c8c8c] mb-1">
          <span>Power meter</span>
          <span>{powerMeter}%</span>
        </div>
        <div className="h-2 bg-[#141414] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              powerMeter > 50
                ? 'bg-green-500'
                : powerMeter > 20
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
            }`}
            style={{ width: `${Math.min(100, powerMeter)}%` }}
          />
        </div>
      </div>

      {/* RSSI bar */}
      <div className="mt-3">
        <div className="flex justify-between text-xs text-[#8c8c8c] mb-1">
          <span>Signal strength</span>
          <span>{rssi}%</span>
        </div>
        <div className="h-2 bg-[#141414] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${rssiColor(rssi).replace('text-', 'bg-')}`}
            style={{ width: `${Math.min(100, rssi)}%` }}
          />
        </div>
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Flight Status panel
// ---------------------------------------------------------------------------

function FlightStatusPanel({
  status,
}: {
  status: TelemetryData['status'];
}) {
  const sensors = status ? decodeSensors(status.sensors) : [];
  const flightMode =
    typeof status?.flight_mode === 'string'
      ? status.flight_mode
      : status?.flight_mode != null
        ? String(status.flight_mode)
        : null;

  const modeColors: Record<string, string> = {
    ACRO: 'bg-purple-900/60 text-purple-300 border-purple-700',
    ANGLE: 'bg-blue-900/60 text-blue-300 border-blue-700',
    HORIZON: 'bg-cyan-900/60 text-cyan-300 border-cyan-700',
    BARO: 'bg-green-900/60 text-green-300 border-green-700',
    GPS: 'bg-emerald-900/60 text-emerald-300 border-emerald-700',
  };
  const modeCls =
    (flightMode && modeColors[flightMode.toUpperCase()]) ||
    'bg-[#242424] text-[#f2f2f2] border-[#444]';

  return (
    <Panel icon={<Cpu className="w-4 h-4" />} title="Flight Status">
      {/* Flight mode badge */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[#8c8c8c] text-xs">Mode:</span>
        <span
          className={`px-3 py-0.5 rounded border text-sm font-bold font-mono ${modeCls}`}
        >
          {flightMode ?? '—'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-[#141414] rounded-lg p-3">
          <p className="text-[#8c8c8c] text-xs mb-1">Cycle Time</p>
          <p className="text-[#f2f2f2] font-mono font-semibold">
            {status?.cycle_time != null ? status.cycle_time : '—'}
            <span className="text-[#8c8c8c] text-xs ml-1">µs</span>
          </p>
        </div>
        <div className="bg-[#141414] rounded-lg p-3">
          <p className="text-[#8c8c8c] text-xs mb-1">I2C Errors</p>
          <p
            className={`font-mono font-semibold ${
              (status?.i2c_errors ?? 0) > 0
                ? 'text-red-400'
                : 'text-green-400'
            }`}
          >
            {status?.i2c_errors != null ? status.i2c_errors : '—'}
          </p>
        </div>
      </div>

      {/* Sensor bitmask */}
      <div>
        <p className="text-[#8c8c8c] text-xs mb-2">
          Sensors{' '}
          {status?.sensors != null && (
            <span className="font-mono text-[#555]">
              (0x{status.sensors.toString(16).toUpperCase()})
            </span>
          )}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {Object.values(SENSOR_BITS).map((name) => {
            const active = sensors.includes(name);
            return (
              <span
                key={name}
                className={`px-2 py-0.5 rounded text-xs font-mono border ${
                  active
                    ? 'bg-green-900/50 text-green-300 border-green-700'
                    : 'bg-[#141414] text-[#555] border-[#2a2a2a]'
                }`}
              >
                {name}
              </span>
            );
          })}
          {status == null && (
            <span className="text-[#8c8c8c] text-xs">No data</span>
          )}
        </div>
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Motors panel
// ---------------------------------------------------------------------------

function MotorsPanel({ motors }: { motors: TelemetryData['motors'] }) {
  const values = motors ?? [0, 0, 0, 0];
  const MAX = 2000;

  return (
    <Panel icon={<Zap className="w-4 h-4" />} title="Motors">
      <div className="space-y-3">
        {values.map((v, i) => {
          const pct = Math.min(100, Math.max(0, (v / MAX) * 100));
          return (
            <div key={i}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-[#8c8c8c] font-mono">M{i + 1}</span>
                <span className="text-[#f2f2f2] font-mono font-semibold">
                  {v}
                  <span className="text-[#555] ml-0.5">/ {MAX}</span>
                </span>
              </div>
              <div className="h-3 bg-[#141414] rounded-full overflow-hidden border border-[#2a2a2a]">
                <div
                  className={`h-full rounded-full transition-all duration-150 ${motorColor(v)}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// RC Channels panel
// ---------------------------------------------------------------------------

const RC_CHANNEL_NAMES: Record<number, string> = {
  0: 'Roll',
  1: 'Pitch',
  2: 'Throttle',
  3: 'Yaw',
  4: 'AUX1',
  5: 'AUX2',
  6: 'AUX3',
  7: 'AUX4',
  8: 'AUX5',
  9: 'AUX6',
  10: 'AUX7',
  11: 'AUX8',
  12: 'AUX9',
  13: 'AUX10',
  14: 'AUX11',
  15: 'AUX12',
};

function RCChannelsPanel({ rc }: { rc: TelemetryData['rc'] }) {
  const channels = (rc ?? []).slice(0, 16);

  if (channels.length === 0) {
    return (
      <Panel icon={<Radio className="w-4 h-4" />} title="RC Channels">
        <p className="text-[#8c8c8c] text-sm text-center py-4">No RC data</p>
      </Panel>
    );
  }

  return (
    <Panel icon={<Radio className="w-4 h-4" />} title="RC Channels">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
        {channels.map((v, i) => {
          const barW = rcBarWidth(v);
          const centerPct = 50; // 1500 maps to 50%
          const valuePct = rcBarWidth(v);
          // bar from center outward
          const left = Math.min(centerPct, valuePct);
          const width = Math.abs(valuePct - centerPct);
          return (
            <div key={i}>
              <div className="flex items-center justify-between text-xs mb-0.5">
                <span className="text-[#8c8c8c] font-mono w-20 truncate">
                  {RC_CHANNEL_NAMES[i] ?? `CH${i + 1}`}
                </span>
                <span className="text-[#f2f2f2] font-mono font-semibold">
                  {v}
                </span>
              </div>
              {/* full range bar */}
              <div className="relative h-2 bg-[#141414] rounded-full overflow-hidden border border-[#2a2a2a]">
                {/* center reference tick */}
                <div
                  className="absolute top-0 bottom-0 w-px bg-[#444]"
                  style={{ left: '50%' }}
                />
                {/* value fill from center */}
                <div
                  className={`absolute top-0 bottom-0 rounded-sm ${rcBarColor(v)}`}
                  style={{
                    left: `${left}%`,
                    width: `${width}%`,
                  }}
                />
                {/* full fill for throttle-style (0 from left) */}
                <div
                  className="absolute top-0 bottom-0 opacity-30 rounded-full"
                  style={{
                    left: 0,
                    width: `${barW}%`,
                    background: 'rgba(255,187,0,0.3)',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// GPS Quick Stats panel
// ---------------------------------------------------------------------------

function GPSQuickStatsPanel({ gps }: { gps: TelemetryData['gps'] }) {
  const fixColorMap: Record<string, string> = {
    green: 'text-green-400',
    yellow: 'text-yellow-400',
    red: 'text-red-400',
    gray: 'text-[#8c8c8c]',
  };

  return (
    <Panel icon={<Satellite className="w-4 h-4" />} title="GPS Quick Stats">
      {gps == null ? (
        <p className="text-[#8c8c8c] text-sm text-center py-4">No GPS data</p>
      ) : (
        <>
          {/* Fix status */}
          <div className="flex items-center gap-2 mb-3">
            <span
              className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                gps.fix_color === 'green'
                  ? 'bg-green-400'
                  : gps.fix_color === 'yellow'
                    ? 'bg-yellow-400'
                    : gps.fix_color === 'red'
                      ? 'bg-red-400'
                      : 'bg-[#555]'
              }`}
            />
            <span
              className={`text-sm font-semibold ${fixColorMap[gps.fix_color] ?? 'text-[#8c8c8c]'}`}
            >
              {gps.fix_status}
            </span>
            <span className="text-[#8c8c8c] text-xs ml-auto">
              {gps.num_satellites} sats
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#141414] rounded-lg p-3">
              <p className="text-[#8c8c8c] text-xs mb-1 flex items-center gap-1">
                <MapPin className="w-3 h-3" /> Latitude
              </p>
              <p className="text-[#f2f2f2] font-mono text-sm font-semibold">
                {gps.lat.toFixed(6)}
              </p>
            </div>
            <div className="bg-[#141414] rounded-lg p-3">
              <p className="text-[#8c8c8c] text-xs mb-1 flex items-center gap-1">
                <MapPin className="w-3 h-3" /> Longitude
              </p>
              <p className="text-[#f2f2f2] font-mono text-sm font-semibold">
                {gps.lon.toFixed(6)}
              </p>
            </div>
            <div className="bg-[#141414] rounded-lg p-3">
              <p className="text-[#8c8c8c] text-xs mb-1">Altitude</p>
              <p className="text-[#f2f2f2] font-mono font-semibold">
                {fmt(gps.altitude, 1)}{' '}
                <span className="text-[#8c8c8c] text-xs">m</span>
              </p>
            </div>
            <div className="bg-[#141414] rounded-lg p-3">
              <p className="text-[#8c8c8c] text-xs mb-1">Speed</p>
              <p className="text-[#f2f2f2] font-mono font-semibold">
                {fmt(gps.speed, 1)}{' '}
                <span className="text-[#8c8c8c] text-xs">m/s</span>
              </p>
            </div>
            <div className="bg-[#141414] rounded-lg p-3">
              <p className="text-[#8c8c8c] text-xs mb-1">Course</p>
              <p className="text-[#f2f2f2] font-mono font-semibold">
                {fmt(gps.course, 1)}{' '}
                <span className="text-[#8c8c8c] text-xs">°</span>
              </p>
            </div>
            <div className="bg-[#141414] rounded-lg p-3">
              <p className="text-[#8c8c8c] text-xs mb-1">HDOP</p>
              <p
                className={`font-mono font-semibold ${
                  gps.hdop == null
                    ? 'text-[#8c8c8c]'
                    : gps.hdop < 2
                      ? 'text-green-400'
                      : gps.hdop < 5
                        ? 'text-yellow-400'
                        : 'text-red-400'
                }`}
              >
                {gps.hdop != null ? fmt(gps.hdop, 2) : '—'}
              </p>
            </div>
          </div>

          {/* DMS coords */}
          <div className="mt-3 bg-[#141414] rounded-lg p-2.5">
            <p className="text-[#8c8c8c] text-xs mb-1">DMS Coordinates</p>
            <p className="text-[#f2f2f2] font-mono text-xs leading-relaxed">
              {gps.coordinates_dms}
            </p>
          </div>
        </>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Raw Data panel (collapsible)
// ---------------------------------------------------------------------------

function RawDataPanel({ telemetry }: { telemetry: TelemetryData | null }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-[#1f1f1f] border border-[#333] rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 p-4 text-left hover:bg-[#252525] transition-colors"
        aria-expanded={open}
      >
        {open ? (
          <ChevronDown className="w-4 h-4 text-[#ffbb00] flex-shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-[#ffbb00] flex-shrink-0" />
        )}
        <span className="text-sm font-semibold uppercase tracking-widest text-[#ffbb00]">
          Raw Telemetry JSON
        </span>
        <span className="ml-auto text-xs text-[#8c8c8c]">
          {open ? 'collapse' : 'expand'}
        </span>
      </button>
      {open && (
        <div className="border-t border-[#333] bg-[#141414]">
          <pre className="p-4 text-xs font-mono text-[#8c8c8c] leading-relaxed overflow-x-auto max-h-96 overflow-y-auto">
            {telemetry
              ? JSON.stringify(telemetry, null, 2)
              : 'No telemetry data yet.'}
          </pre>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function TelemetryPage() {
  const { telemetry, connected } = useTelemetry();
  const bufferRef = useRef<ChartPoint[]>([]);
  const [buffer, setBuffer] = useState<ChartPoint[]>([]);

  // Rolling buffer: append each new telemetry frame
  const prevTimestamp = useRef<number | null>(null);
  useEffect(() => {
    if (!telemetry) return;
    if (telemetry.timestamp === prevTimestamp.current) return;
    prevTimestamp.current = telemetry.timestamp;

    const point: ChartPoint = {
      t: telemetry.timestamp,
      gx: telemetry.gyro?.x ?? 0,
      gy: telemetry.gyro?.y ?? 0,
      gz: telemetry.gyro?.z ?? 0,
      ax: telemetry.accel?.x ?? 0,
      ay: telemetry.accel?.y ?? 0,
      az: telemetry.accel?.z ?? 0,
    };

    bufferRef.current = [...bufferRef.current, point].slice(-BUFFER_SIZE);
    setBuffer([...bufferRef.current]);
  }, [telemetry]);

  const timestamp = telemetry?.timestamp;

  return (
    <div className="min-h-screen bg-[#141414] p-4 lg:p-6 space-y-4 lg:space-y-6">
      {/* ------------------------------------------------------------------ */}
      {/* Header row                                                          */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Activity className="w-6 h-6 text-[#ffbb00]" />
          <div>
            <h1 className="text-xl lg:text-2xl font-bold text-[#f2f2f2]">
              Live Telemetry
            </h1>
            <p className="text-[#8c8c8c] text-xs mt-0.5">
              Real-time raw data from the flight controller
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Timestamp */}
          {timestamp != null && (
            <span className="text-[#8c8c8c] text-xs font-mono">
              Last: {fmtTs(timestamp)}
            </span>
          )}

          {/* Connection badge */}
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-semibold ${
              connected
                ? 'bg-green-950/40 border-green-700 text-green-400'
                : 'bg-red-950/40 border-red-800 text-red-400'
            }`}
          >
            {connected ? (
              <>
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <Wifi className="w-4 h-4" />
                Connected
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                <WifiOff className="w-4 h-4" />
                Disconnected
              </>
            )}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Not connected banner                                                */}
      {/* ------------------------------------------------------------------ */}
      {!connected && <NotConnectedBanner />}

      {/* ------------------------------------------------------------------ */}
      {/* Connected but waiting for first frame                               */}
      {/* ------------------------------------------------------------------ */}
      {connected && telemetry == null && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <SkeletonPanel key={i} rows={i % 3 === 0 ? 5 : 3} />
          ))}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Main dashboard grid (only when we have data)                        */}
      {/* ------------------------------------------------------------------ */}
      {telemetry != null && (
        <>
          {/* Row 1: Attitude + Flight Status + Battery */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <AttitudePanel attitude={telemetry.attitude} />
            <FlightStatusPanel status={telemetry.status} />
            <BatteryPanel battery={telemetry.battery} />
          </div>

          {/* Row 2: Gyro + Accel (each takes half width on large screens) */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <GyroscopePanel gyro={telemetry.gyro} buffer={buffer} />
            <AccelerometerPanel accel={telemetry.accel} buffer={buffer} />
          </div>

          {/* Row 3: Motors + RC Channels */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <MotorsPanel motors={telemetry.motors} />
            <RCChannelsPanel rc={telemetry.rc} />
          </div>

          {/* Row 4: GPS Quick Stats (full width) */}
          <GPSQuickStatsPanel gps={telemetry.gps} />

          {/* Row 5: Raw JSON (collapsible, full width) */}
          <RawDataPanel telemetry={telemetry} />
        </>
      )}

      {/* When disconnected, still show last data if we have it */}
      {!connected && telemetry != null && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-950/30 border border-yellow-800/50 text-yellow-400 text-xs">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          Showing last known telemetry snapshot. Data may be stale.
        </div>
      )}
    </div>
  );
}

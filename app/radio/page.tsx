'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { Radio, Signal, Wifi, WifiOff, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTelemetry } from '@/components/TelemetryProvider';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ChannelMap = 'AETR' | 'TAER' | 'AERT';
type ReceiverType = 'CRSF' | 'SBUS' | 'PPM';

interface ChannelMapDef {
  label: string;
  /** Index 0-3 mapping: [aileron, elevator, throttle, rudder] channel indices */
  names: [string, string, string, string];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CHANNEL_MAPS: Record<ChannelMap, ChannelMapDef> = {
  AETR: {
    label: 'AETR (Aileron, Elevator, Throttle, Rudder)',
    names: ['Roll (Aileron)', 'Pitch (Elevator)', 'Throttle', 'Yaw (Rudder)'],
  },
  TAER: {
    label: 'TAER (Throttle, Aileron, Elevator, Rudder)',
    names: ['Throttle', 'Roll (Aileron)', 'Pitch (Elevator)', 'Yaw (Rudder)'],
  },
  AERT: {
    label: 'AERT (Aileron, Elevator, Rudder, Throttle)',
    names: ['Roll (Aileron)', 'Pitch (Elevator)', 'Yaw (Rudder)', 'Throttle'],
  },
};

const TOTAL_CHANNELS = 18;
const CENTER = 1500;

// Betaflight AETR: ch0=Roll, ch1=Pitch, ch2=Throttle, ch3=Yaw
// Indices into the rc array for named channels
function getNamedIndices(map: ChannelMap): {
  rollIdx: number;
  pitchIdx: number;
  throttleIdx: number;
  yawIdx: number;
} {
  switch (map) {
    case 'AETR':
      return { rollIdx: 0, pitchIdx: 1, throttleIdx: 2, yawIdx: 3 };
    case 'TAER':
      return { rollIdx: 1, pitchIdx: 2, throttleIdx: 0, yawIdx: 3 };
    case 'AERT':
      return { rollIdx: 0, pitchIdx: 1, throttleIdx: 3, yawIdx: 2 };
  }
}

// ---------------------------------------------------------------------------
// Demo data generator
// ---------------------------------------------------------------------------

function generateDemoChannels(): number[] {
  return Array.from({ length: TOTAL_CHANNELS }, (_, i) => {
    // Give throttle (ch 2 in AETR) a slightly low value for realism
    const base = i === 2 ? 1000 : CENTER;
    const noise = Math.round((Math.random() - 0.5) * 20);
    return Math.max(1000, Math.min(2000, base + noise));
  });
}

// ---------------------------------------------------------------------------
// Bar color logic
// ---------------------------------------------------------------------------

function getBarColor(value: number): string {
  if (value < 1050 || value > 1950) return '#e2123f';
  if (value >= 1450 && value <= 1550) return '#96e212';
  return '#ffbb00';
}

// ---------------------------------------------------------------------------
// Sub-component: Connection Banner
// ---------------------------------------------------------------------------

function ConnectionBanner() {
  return (
    <div className="flex items-center gap-3 rounded-[4px] border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span>No flight controller connected — showing demo data</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Single RC channel bar
// ---------------------------------------------------------------------------

interface ChannelBarProps {
  index: number;
  label: string;
  value: number;
  deadband: number;
  isInDeadband: boolean;
}

function ChannelBar({ index, label, value, deadband: _deadband, isInDeadband }: ChannelBarProps) {
  const fillPct = ((value - 1000) / 1000) * 100;
  const barColor = getBarColor(value);

  return (
    <div className="flex items-center gap-3">
      {/* Channel label */}
      <div className="w-36 shrink-0">
        <div className="text-xs font-medium text-[#f2f2f2]">
          Ch {index + 1}
          {label && (
            <span className="ml-1 text-[#8c8c8c]">· {label}</span>
          )}
        </div>
      </div>

      {/* Bar track */}
      <div className="relative h-5 flex-1 rounded-lg bg-[#141414]">
        {/* Fill */}
        <div
          className="absolute inset-y-0 left-0 rounded-lg transition-all duration-75"
          style={{
            width: `${Math.max(0, Math.min(100, fillPct))}%`,
            backgroundColor: barColor,
            opacity: 0.85,
          }}
        />
        {/* Center marker at 50% */}
        <div className="absolute inset-y-0 left-1/2 w-px bg-[#555]" />
        {/* Deadband indicator */}
        {isInDeadband && (
          <div
            className="absolute inset-y-0 rounded-lg opacity-30"
            style={{
              left: '50%',
              transform: 'translateX(-50%)',
              width: '4%',
              backgroundColor: '#96e212',
            }}
          />
        )}
      </div>

      {/* Numeric value */}
      <div
        className="w-12 shrink-0 text-right font-mono text-xs"
        style={{ color: barColor }}
      >
        {value}
      </div>

      {/* Deadband dot */}
      <div className="w-3 shrink-0">
        {isInDeadband && (
          <div className="h-2 w-2 rounded-full bg-[#96e212]" title="Within deadband" />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Channel bars grid
// ---------------------------------------------------------------------------

interface ChannelBarsProps {
  channels: number[];
  channelMap: ChannelMap;
  deadband: number;
}

function ChannelBars({ channels, channelMap, deadband }: ChannelBarsProps) {
  const names = CHANNEL_MAPS[channelMap].names;

  const getLabel = (idx: number): string => {
    if (idx < 4) return names[idx];
    return '';
  };

  const leftCol = channels.slice(0, 9);
  const rightCol = channels.slice(9, 18);

  return (
    <div className="grid grid-cols-1 gap-2 lg:grid-cols-2 lg:gap-x-6">
      {/* Left column: Ch 1-9 */}
      <div className="space-y-1.5">
        {leftCol.map((value, i) => {
          const isInDeadband =
            deadband > 0 && Math.abs(value - CENTER) <= deadband;
          return (
            <ChannelBar
              key={i}
              index={i}
              label={getLabel(i)}
              value={value}
              deadband={deadband}
              isInDeadband={isInDeadband}
            />
          );
        })}
      </div>
      {/* Right column: Ch 10-18 */}
      <div className="space-y-1.5">
        {rightCol.map((value, i) => {
          const idx = i + 9;
          const isInDeadband =
            deadband > 0 && Math.abs(value - CENTER) <= deadband;
          return (
            <ChannelBar
              key={idx}
              index={idx}
              label={getLabel(idx)}
              value={value}
              deadband={deadband}
              isInDeadband={isInDeadband}
            />
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Virtual joystick (SVG)
// ---------------------------------------------------------------------------

const STICK_SIZE = 150;
const DOT_R = 7;

interface VirtualStickProps {
  label: string;
  xValue: number; // 1000-2000
  yValue: number; // 1000-2000
  xAxisLabel: string;
  yAxisLabel: string;
}

function VirtualStick({ label, xValue, yValue, xAxisLabel, yAxisLabel }: VirtualStickProps) {
  // Map 1000-2000 to -1..+1
  const xNorm = (Math.max(1000, Math.min(2000, xValue)) - 1500) / 500;
  // Y axis: higher value = up, so invert for SVG coords
  const yNorm = -((Math.max(1000, Math.min(2000, yValue)) - 1500) / 500);

  const cx = STICK_SIZE / 2;
  const cy = STICK_SIZE / 2;
  const travel = STICK_SIZE / 2 - DOT_R - 6;
  const dotX = cx + xNorm * travel;
  const dotY = cy + yNorm * travel;

  const dotColor =
    Math.abs(xNorm) < 0.1 && Math.abs(yNorm) < 0.1 ? '#96e212' : '#ffbb00';

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="text-xs font-semibold uppercase tracking-wider text-[#8c8c8c]">
        {label}
      </div>
      <svg
        width={STICK_SIZE}
        height={STICK_SIZE}
        viewBox={`0 0 ${STICK_SIZE} ${STICK_SIZE}`}
        style={{ display: 'block' }}
      >
        {/* Background */}
        <rect
          x={0}
          y={0}
          width={STICK_SIZE}
          height={STICK_SIZE}
          rx={6}
          fill="#141414"
          stroke="#333"
          strokeWidth={1}
        />

        {/* Subtle grid */}
        {[0.25, 0.5, 0.75].map((f) => (
          <g key={f}>
            <line
              x1={f * STICK_SIZE}
              y1={0}
              x2={f * STICK_SIZE}
              y2={STICK_SIZE}
              stroke="#282828"
              strokeWidth={0.5}
            />
            <line
              x1={0}
              y1={f * STICK_SIZE}
              x2={STICK_SIZE}
              y2={f * STICK_SIZE}
              stroke="#282828"
              strokeWidth={0.5}
            />
          </g>
        ))}

        {/* Crosshair center lines */}
        <line x1={cx} y1={0} x2={cx} y2={STICK_SIZE} stroke="#3a3a3a" strokeWidth={1} />
        <line x1={0} y1={cy} x2={STICK_SIZE} y2={cy} stroke="#3a3a3a" strokeWidth={1} />

        {/* Axis edge labels */}
        <text x={cx} y={10} textAnchor="middle" fill="#555" fontSize={7} fontFamily="monospace">
          {yAxisLabel}+
        </text>
        <text x={cx} y={STICK_SIZE - 3} textAnchor="middle" fill="#555" fontSize={7} fontFamily="monospace">
          {yAxisLabel}-
        </text>
        <text x={4} y={cy + 3} textAnchor="start" fill="#555" fontSize={7} fontFamily="monospace">
          {xAxisLabel}-
        </text>
        <text x={STICK_SIZE - 4} y={cy + 3} textAnchor="end" fill="#555" fontSize={7} fontFamily="monospace">
          {xAxisLabel}+
        </text>

        {/* Glow behind dot */}
        <circle cx={dotX} cy={dotY} r={DOT_R + 7} fill={dotColor} opacity={0.08} />
        <circle cx={dotX} cy={dotY} r={DOT_R + 4} fill={dotColor} opacity={0.12} />

        {/* Dot */}
        <circle cx={dotX} cy={dotY} r={DOT_R} fill={dotColor} />
        <circle cx={dotX} cy={dotY} r={DOT_R - 2} fill="#fff" opacity={0.25} />
      </svg>

      {/* Value readout */}
      <div className="flex gap-4 font-mono text-xs text-[#f2f2f2]">
        <span>
          <span className="text-[#8c8c8c]">{xAxisLabel}: </span>
          {xValue}
        </span>
        <span>
          <span className="text-[#8c8c8c]">{yAxisLabel}: </span>
          {yValue}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Stick visualizations panel
// ---------------------------------------------------------------------------

interface SticksVisualizationProps {
  channels: number[];
  channelMap: ChannelMap;
}

function SticksVisualization({ channels, channelMap }: SticksVisualizationProps) {
  const { rollIdx, pitchIdx, throttleIdx, yawIdx } = getNamedIndices(channelMap);

  const rollVal = channels[rollIdx] ?? CENTER;
  const pitchVal = channels[pitchIdx] ?? CENTER;
  const throttleVal = channels[throttleIdx] ?? CENTER;
  const yawVal = channels[yawIdx] ?? CENTER;

  return (
    <Card className="bg-[#1f1f1f] border-[#333]">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base text-[#f2f2f2]">
          <Signal className="h-4 w-4 text-[#ffbb00]" />
          Stick Visualization
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap justify-center gap-10">
          <VirtualStick
            label="Left Stick"
            xValue={yawVal}
            yValue={throttleVal}
            xAxisLabel="YAW"
            yAxisLabel="THR"
          />
          <VirtualStick
            label="Right Stick"
            xValue={rollVal}
            yValue={pitchVal}
            xAxisLabel="ROL"
            yAxisLabel="PIT"
          />
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: RSSI / link quality badge
// ---------------------------------------------------------------------------

function rssiColor(rssi: number): string {
  if (rssi >= 70) return '#96e212';
  if (rssi >= 40) return '#ffbb00';
  return '#e2123f';
}

function rssiLabel(rssi: number): string {
  if (rssi >= 70) return 'Good';
  if (rssi >= 40) return 'Fair';
  return 'Poor';
}

// ---------------------------------------------------------------------------
// Sub-component: Receiver info card
// ---------------------------------------------------------------------------

interface ReceiverInfoCardProps {
  rssi: number | undefined;
  receiverType: ReceiverType;
  onReceiverTypeChange: (v: ReceiverType) => void;
  connected: boolean;
}

function ReceiverInfoCard({
  rssi,
  receiverType,
  onReceiverTypeChange,
  connected,
}: ReceiverInfoCardProps) {
  const displayRssi = rssi ?? 0;
  const color = connected ? rssiColor(displayRssi) : '#555';
  const label = connected ? rssiLabel(displayRssi) : 'N/A';

  return (
    <Card className="bg-[#1f1f1f] border-[#333]">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base text-[#f2f2f2]">
          {connected ? (
            <Wifi className="h-4 w-4 text-[#96e212]" />
          ) : (
            <WifiOff className="h-4 w-4 text-[#8c8c8c]" />
          )}
          Receiver
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Receiver type selector */}
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-[#8c8c8c]">Receiver Type</span>
          <Select
            value={receiverType}
            onValueChange={(v) => onReceiverTypeChange(v as ReceiverType)}
          >
            <SelectTrigger
              className="h-8 w-28 border-[#333] bg-[#242424] text-xs text-[#f2f2f2]"
              size="sm"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-[#333] bg-[#242424] text-[#f2f2f2]">
              <SelectItem value="CRSF">CRSF</SelectItem>
              <SelectItem value="SBUS">SBUS</SelectItem>
              <SelectItem value="PPM">PPM</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* RSSI */}
        <div className="rounded-lg bg-[#242424] p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs text-[#8c8c8c]">RSSI</span>
            <Badge
              className="text-xs"
              style={{
                backgroundColor: color + '22',
                color: color,
                border: `1px solid ${color}44`,
              }}
            >
              {label}
            </Badge>
          </div>
          <div className="flex items-end gap-2">
            <span
              className="font-mono text-3xl font-bold leading-none"
              style={{ color }}
            >
              {connected ? displayRssi : '--'}
            </span>
            <span className="mb-0.5 text-xs text-[#8c8c8c]">/ 100</span>
          </div>
          {/* Bar */}
          <div className="mt-3 h-2 rounded-full bg-[#141414]">
            <div
              className="h-2 rounded-full transition-all duration-200"
              style={{
                width: connected ? `${Math.max(0, Math.min(100, displayRssi))}%` : '0%',
                backgroundColor: color,
              }}
            />
          </div>
        </div>

        {/* Link quality bars (visual decoration) */}
        <div className="flex items-end gap-1 px-1">
          {Array.from({ length: 5 }, (_, i) => {
            const threshold = (i + 1) * 20;
            const active = connected && displayRssi >= threshold;
            return (
              <div
                key={i}
                className="flex-1 rounded-sm transition-all duration-200"
                style={{
                  height: `${8 + i * 4}px`,
                  backgroundColor: active ? color : '#2a2a2a',
                }}
              />
            );
          })}
          <span className="ml-2 text-xs text-[#8c8c8c]">Link</span>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Channel map selector card
// ---------------------------------------------------------------------------

interface ChannelMapCardProps {
  channelMap: ChannelMap;
  onChannelMapChange: (v: ChannelMap) => void;
}

function ChannelMapCard({ channelMap, onChannelMapChange }: ChannelMapCardProps) {
  const names = CHANNEL_MAPS[channelMap].names;

  return (
    <Card className="bg-[#1f1f1f] border-[#333]">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base text-[#f2f2f2]">
          <Radio className="h-4 w-4 text-[#ffbb00]" />
          Channel Map
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Select
          value={channelMap}
          onValueChange={(v) => onChannelMapChange(v as ChannelMap)}
        >
          <SelectTrigger className="w-full border-[#333] bg-[#242424] text-sm text-[#f2f2f2]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="border-[#333] bg-[#242424] text-[#f2f2f2]">
            {(Object.entries(CHANNEL_MAPS) as [ChannelMap, ChannelMapDef][]).map(
              ([key, def]) => (
                <SelectItem key={key} value={key}>
                  {def.label}
                </SelectItem>
              )
            )}
          </SelectContent>
        </Select>

        {/* Show current mapping */}
        <div className="rounded-lg bg-[#242424] p-3 space-y-1.5">
          {names.map((name, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <span className="text-[#8c8c8c]">Ch {i + 1}</span>
              <span className="font-medium text-[#f2f2f2]">{name}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: Deadband card
// ---------------------------------------------------------------------------

interface DeadbandCardProps {
  deadband: number;
  onDeadbandChange: (v: number) => void;
  channels: number[];
}

function DeadbandCard({ deadband, onDeadbandChange, channels }: DeadbandCardProps) {
  const channelsInDeadband = channels.filter(
    (v) => deadband > 0 && Math.abs(v - CENTER) <= deadband
  );

  return (
    <Card className="bg-[#1f1f1f] border-[#333]">
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-[#f2f2f2]">Stick Deadband</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <input
            type="number"
            min={0}
            max={50}
            value={deadband}
            onChange={(e) =>
              onDeadbandChange(Math.max(0, Math.min(50, Number(e.target.value))))
            }
            className="w-20 rounded-lg border border-[#333] bg-[#242424] px-3 py-2 text-center font-mono text-sm text-[#f2f2f2] outline-none focus:border-[#ffbb00] transition-colors"
          />
          <span className="text-xs text-[#8c8c8c]">µs from center (1500 ± {deadband})</span>
        </div>

        {/* Range: 1500 - deadband to 1500 + deadband */}
        {deadband > 0 && (
          <div className="rounded-lg bg-[#242424] p-3 space-y-2">
            <div className="text-xs text-[#8c8c8c]">
              Dead zone: {CENTER - deadband} – {CENTER + deadband}
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#8c8c8c]">Channels within deadband</span>
              <Badge
                className="font-mono"
                style={{
                  backgroundColor: channelsInDeadband.length > 0 ? '#96e21222' : '#2a2a2a',
                  color: channelsInDeadband.length > 0 ? '#96e212' : '#555',
                  border: `1px solid ${channelsInDeadband.length > 0 ? '#96e21244' : '#333'}`,
                }}
              >
                {channelsInDeadband.length} / {channels.length}
              </Badge>
            </div>
            {channelsInDeadband.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {channels.map((v, i) =>
                  deadband > 0 && Math.abs(v - CENTER) <= deadband ? (
                    <span
                      key={i}
                      className="rounded px-1.5 py-0.5 font-mono text-xs"
                      style={{ backgroundColor: '#96e21220', color: '#96e212' }}
                    >
                      Ch{i + 1}
                    </span>
                  ) : null
                )}
              </div>
            )}
          </div>
        )}

        {deadband === 0 && (
          <div className="text-xs text-[#555]">Set a deadband &gt; 0 to see affected channels.</div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function RadioPage() {
  const { telemetry, connected } = useTelemetry();

  const [channelMap, setChannelMap] = useState<ChannelMap>('AETR');
  const [receiverType, setReceiverType] = useState<ReceiverType>('CRSF');
  const [deadband, setDeadband] = useState<number>(5);

  // Demo data with slight noise refreshing at ~10 Hz
  const [demoChannels, setDemoChannels] = useState<number[]>(() =>
    generateDemoChannels()
  );

  // Refresh demo data at 10 Hz when not connected
  const demoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!connected) {
      demoIntervalRef.current = setInterval(() => {
        setDemoChannels(generateDemoChannels());
      }, 100);
    } else {
      if (demoIntervalRef.current) {
        clearInterval(demoIntervalRef.current);
        demoIntervalRef.current = null;
      }
    }

    return () => {
      if (demoIntervalRef.current) clearInterval(demoIntervalRef.current);
    };
  }, [connected]);

  // Use live telemetry.rc if available, otherwise demo
  const rawChannels: number[] = useMemo(() => {
    if (connected && telemetry?.rc && telemetry.rc.length > 0) {
      // Pad to 18 channels if needed
      const ch = [...telemetry.rc];
      while (ch.length < TOTAL_CHANNELS) ch.push(CENTER);
      return ch.slice(0, TOTAL_CHANNELS);
    }
    return demoChannels;
  }, [connected, telemetry?.rc, demoChannels]);

  const rssi = telemetry?.battery?.rssi;

  return (
    <div className="space-y-6 p-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-[#f2f2f2]">
            <Radio className="h-6 w-6 text-[#ffbb00]" />
            Receiver / Radio
          </h1>
          <p className="mt-1 text-sm text-[#8c8c8c]">
            RC channel monitor and receiver diagnostics
          </p>
        </div>

        {/* Connection indicator */}
        <div className="flex items-center gap-2">
          <div
            className={`h-2.5 w-2.5 rounded-full ${
              connected ? 'animate-pulse bg-[#96e212]' : 'bg-[#555]'
            }`}
          />
          <span className="text-sm text-[#8c8c8c]">
            {connected ? 'Live' : 'Demo'}
          </span>
        </div>
      </div>

      {/* Connection banner */}
      {!connected && <ConnectionBanner />}

      {/* Top row: config cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <ChannelMapCard
          channelMap={channelMap}
          onChannelMapChange={setChannelMap}
        />
        <ReceiverInfoCard
          rssi={rssi}
          receiverType={receiverType}
          onReceiverTypeChange={setReceiverType}
          connected={connected}
        />
        <DeadbandCard
          deadband={deadband}
          onDeadbandChange={setDeadband}
          channels={rawChannels}
        />
      </div>

      {/* Stick visualization */}
      <SticksVisualization channels={rawChannels} channelMap={channelMap} />

      {/* RC channel bar graphs */}
      <Card className="bg-[#1f1f1f] border-[#333]">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-base text-[#f2f2f2]">
            <span className="flex items-center gap-2">
              <Signal className="h-4 w-4 text-[#ffbb00]" />
              RC Channels
            </span>
            <div className="flex items-center gap-4 text-xs font-normal text-[#8c8c8c]">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-3 rounded-sm bg-[#e2123f]" />
                Extreme
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-3 rounded-sm bg-[#ffbb00]" />
                Active
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-3 rounded-sm bg-[#96e212]" />
                Center
              </span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChannelBars
            channels={rawChannels}
            channelMap={channelMap}
            deadband={deadband}
          />
        </CardContent>
      </Card>
    </div>
  );
}

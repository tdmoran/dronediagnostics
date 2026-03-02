'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Battery,
  BatteryWarning,
  Zap,
  AlertTriangle,
  CheckCircle2,
  Save,
  Activity,
  Gauge,
  Clock,
  Info,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useTelemetry } from '@/components/TelemetryProvider';
import { useToast } from '@/hooks/use-toast';

// ---------------------------------------------------------------------------
// Demo / constants
// ---------------------------------------------------------------------------

const DEMO_VOLTAGE = 16.1;
const DEMO_AMPERAGE = 18;
const DEMO_MAH = 450;

const MAX_HISTORY = 300;

// ---------------------------------------------------------------------------
// Helper utilities
// ---------------------------------------------------------------------------

/** Auto-detect cell count: pack voltage / 4.2, rounded to nearest integer (1–6). */
function detectCellCount(packVoltage: number): number {
  const raw = packVoltage / 4.2;
  return Math.min(6, Math.max(1, Math.round(raw)));
}

/** Battery percentage from cell voltage using linear interpolation 3.3V–4.2V. */
function cellVoltageToPct(cellV: number, minCellV: number, maxCellV: number): number {
  if (maxCellV <= minCellV) return 0;
  const pct = ((cellV - minCellV) / (maxCellV - minCellV)) * 100;
  return Math.min(100, Math.max(0, pct));
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Single stat card used in the top row. */
function StatCard({
  icon,
  label,
  value,
  valueColor,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueColor: string;
  sub?: React.ReactNode;
}) {
  return (
    <Card className="bg-[#1f1f1f] border-[#333]">
      <CardContent className="pt-5 pb-5">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-[#8c8c8c] text-xs font-medium uppercase tracking-wider">
              {label}
            </span>
            <span className={`text-3xl font-bold font-mono ${valueColor}`}>{value}</span>
            {sub && <span className="text-xs text-[#8c8c8c] mt-0.5">{sub}</span>}
          </div>
          <div className="text-[#ffbb00] opacity-70 mt-1">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

/** Large visual battery gauge. */
function BatteryGauge({
  pct,
  cellVoltage,
  cellCount,
}: {
  pct: number;
  cellVoltage: number;
  cellCount: number;
}) {
  const gaugeColor =
    pct > 60 ? '#96e212' : pct > 30 ? '#ffbb00' : '#e2123f';

  const barBg = pct > 60
    ? 'from-[#96e212]/20 to-[#96e212]/5'
    : pct > 30
    ? 'from-[#ffbb00]/20 to-[#ffbb00]/5'
    : 'from-[#e2123f]/20 to-[#e2123f]/5';

  return (
    <Card className="bg-[#1f1f1f] border-[#333]">
      <CardHeader className="pb-2">
        <CardTitle className="text-[#f2f2f2] flex items-center gap-2 text-base">
          <Battery className="w-5 h-5 text-[#ffbb00]" />
          Battery State of Charge
          <span className="ml-auto text-[#8c8c8c] text-xs font-normal font-mono">
            {cellCount}S detected
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Percentage display */}
        <div className="flex items-center justify-between">
          <span
            className="text-6xl font-bold font-mono tabular-nums"
            style={{ color: gaugeColor }}
          >
            {Math.round(pct)}%
          </span>
          <div className="text-right">
            <div className="text-sm text-[#8c8c8c]">Cell voltage</div>
            <div
              className="text-2xl font-bold font-mono"
              style={{ color: gaugeColor }}
            >
              {cellVoltage.toFixed(2)}V
            </div>
          </div>
        </div>

        {/* Gauge bar */}
        <div className={`relative h-8 rounded-lg bg-gradient-to-r ${barBg} border border-[#333] overflow-hidden`}>
          {/* Fill */}
          <div
            className="absolute inset-y-0 left-0 transition-all duration-500 rounded-lg"
            style={{
              width: `${pct}%`,
              background: `linear-gradient(90deg, ${gaugeColor}cc, ${gaugeColor})`,
            }}
          />
          {/* Tick marks at 25 / 50 / 75 */}
          {[25, 50, 75].map((tick) => (
            <div
              key={tick}
              className="absolute inset-y-0 w-px bg-[#333]"
              style={{ left: `${tick}%` }}
            />
          ))}
          {/* Center percentage label */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-bold text-white/70 drop-shadow">
              {Math.round(pct)}%
            </span>
          </div>
        </div>

        {/* Threshold markers */}
        <div className="flex justify-between text-[10px] text-[#8c8c8c] font-mono">
          <span className="text-red-400">Critical</span>
          <span className="text-yellow-400">Low</span>
          <span className="text-yellow-400">Warning</span>
          <span className="text-[#96e212]">Good</span>
          <span className="text-[#96e212]">Full</span>
        </div>
      </CardContent>
    </Card>
  );
}

interface VoltagePoint {
  t: number;    // seconds ago (negative)
  v: number;    // voltage
}

/** Voltage history line chart. */
function VoltageChart({ data, lineColor }: { data: VoltagePoint[]; lineColor: string }) {
  const formatted = data.map((p, i) => ({
    t: -((data.length - 1 - i)),
    v: p.v,
  }));

  const voltages = data.map((p) => p.v);
  const minV = voltages.length ? Math.min(...voltages) - 0.2 : 14;
  const maxV = voltages.length ? Math.max(...voltages) + 0.2 : 17;

  return (
    <Card className="bg-[#1f1f1f] border-[#333]">
      <CardHeader className="pb-2">
        <CardTitle className="text-[#f2f2f2] flex items-center gap-2 text-base">
          <Activity className="w-5 h-5 text-[#ffbb00]" />
          Voltage History
          <span className="ml-auto text-[#8c8c8c] text-xs font-normal">
            Last {Math.min(data.length, MAX_HISTORY)} readings
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length < 2 ? (
          <div className="h-48 flex items-center justify-center text-[#8c8c8c] text-sm">
            Accumulating data…
          </div>
        ) : (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={formatted} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                <XAxis
                  dataKey="t"
                  stroke="#8c8c8c"
                  fontSize={10}
                  tickFormatter={(v) => `${v}s`}
                  interval="preserveStartEnd"
                />
                <YAxis
                  stroke="#8c8c8c"
                  fontSize={10}
                  domain={[minV, maxV]}
                  tickFormatter={(v: number) => `${v.toFixed(1)}V`}
                  width={48}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f1f1f',
                    border: '1px solid #333',
                    borderRadius: '4px',
                    fontSize: '11px',
                    color: '#f2f2f2',
                  }}
                  formatter={(value: number) => [`${value.toFixed(2)}V`, 'Voltage']}
                  labelFormatter={(label) => `${label}s`}
                />
                <Line
                  type="monotone"
                  dataKey="v"
                  stroke={lineColor}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Battery configuration card. */
function BatteryConfig({
  config,
  onChange,
  onSave,
}: {
  config: BatteryConfigState;
  onChange: (key: keyof BatteryConfigState, value: string | number) => void;
  onSave: () => void;
}) {
  return (
    <Card className="bg-[#1f1f1f] border-[#333]">
      <CardHeader className="pb-2">
        <CardTitle className="text-[#f2f2f2] flex items-center gap-2 text-base">
          <Gauge className="w-5 h-5 text-[#ffbb00]" />
          Battery Configuration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Cell count override */}
        <div className="flex items-center justify-between gap-4">
          <label className="text-sm text-[#8c8c8c] shrink-0 w-44">Cell Count Override</label>
          <Select
            value={config.cellCountOverride}
            onValueChange={(v) => onChange('cellCountOverride', v)}
          >
            <SelectTrigger className="w-36 bg-[#242424] border-[#333] text-[#f2f2f2] text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#242424] border-[#333] text-[#f2f2f2]">
              <SelectItem value="auto">Auto-detect</SelectItem>
              {[1, 2, 3, 4, 5, 6].map((s) => (
                <SelectItem key={s} value={String(s)}>{s}S</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Capacity */}
        <div className="flex items-center justify-between gap-4">
          <label className="text-sm text-[#8c8c8c] shrink-0 w-44">Capacity (mAh)</label>
          <input
            type="number"
            min={100}
            max={30000}
            step={100}
            value={config.capacityMah}
            onChange={(e) => onChange('capacityMah', Number(e.target.value))}
            className="w-36 bg-[#242424] border border-[#333] rounded-md px-3 py-1.5 text-sm text-[#f2f2f2] font-mono focus:outline-none focus:border-[#ffbb00]"
          />
        </div>

        {/* Min cell voltage */}
        <div className="flex items-center justify-between gap-4">
          <label className="text-sm text-[#8c8c8c] shrink-0 w-44">Min Cell Voltage (V)</label>
          <input
            type="number"
            min={2.5}
            max={3.9}
            step={0.1}
            value={config.minCellV}
            onChange={(e) => onChange('minCellV', Number(e.target.value))}
            className="w-36 bg-[#242424] border border-[#333] rounded-md px-3 py-1.5 text-sm text-[#f2f2f2] font-mono focus:outline-none focus:border-[#ffbb00]"
          />
        </div>

        {/* Warning cell voltage */}
        <div className="flex items-center justify-between gap-4">
          <label className="text-sm text-[#8c8c8c] shrink-0 w-44">Warning Cell Voltage (V)</label>
          <input
            type="number"
            min={3.0}
            max={4.0}
            step={0.1}
            value={config.warnCellV}
            onChange={(e) => onChange('warnCellV', Number(e.target.value))}
            className="w-36 bg-[#242424] border border-[#333] rounded-md px-3 py-1.5 text-sm text-[#f2f2f2] font-mono focus:outline-none focus:border-[#ffbb00]"
          />
        </div>

        {/* Max cell voltage */}
        <div className="flex items-center justify-between gap-4">
          <label className="text-sm text-[#8c8c8c] shrink-0 w-44">Max Cell Voltage (V)</label>
          <input
            type="number"
            min={4.0}
            max={4.35}
            step={0.05}
            value={config.maxCellV}
            onChange={(e) => onChange('maxCellV', Number(e.target.value))}
            className="w-36 bg-[#242424] border border-[#333] rounded-md px-3 py-1.5 text-sm text-[#f2f2f2] font-mono focus:outline-none focus:border-[#ffbb00]"
          />
        </div>

        {/* Voltage scale */}
        <div className="flex items-start justify-between gap-4">
          <div className="shrink-0 w-44">
            <label className="text-sm text-[#8c8c8c]">Voltage Scale</label>
            <p className="text-[10px] text-[#8c8c8c]/60 mt-0.5 leading-tight">
              Adjust if voltage reading is inaccurate
            </p>
          </div>
          <input
            type="number"
            min={0.8}
            max={1.2}
            step={0.01}
            value={config.voltageScale}
            onChange={(e) => onChange('voltageScale', Number(e.target.value))}
            className="w-36 bg-[#242424] border border-[#333] rounded-md px-3 py-1.5 text-sm text-[#f2f2f2] font-mono focus:outline-none focus:border-[#ffbb00]"
          />
        </div>

        <div className="pt-1">
          <Button onClick={onSave} className="w-full gap-2" variant="default">
            <Save className="w-4 h-4" />
            Save Config
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface Warning {
  id: string;
  level: 'error' | 'warning' | 'info';
  message: string;
}

/** Battery health estimate card. */
function BatteryHealth({
  cellVoltage,
  cellCount,
  mAhConsumed,
  capacityMah,
  avgCurrent,
  warnings,
  minCellV,
  warnCellV,
}: {
  cellVoltage: number;
  cellCount: number;
  mAhConsumed: number;
  capacityMah: number;
  avgCurrent: number;
  warnings: Warning[];
  minCellV: number;
  warnCellV: number;
}) {
  const remainingMah = Math.max(0, capacityMah - mAhConsumed);

  // Flight time remaining (minutes)
  let flightTimeMin: string = '-- min';
  if (avgCurrent > 0.5) {
    const mins = (remainingMah / avgCurrent) / 60;
    flightTimeMin = `${mins.toFixed(1)} min`;
  }

  // Per-cell status
  const cellStatus =
    cellVoltage >= warnCellV
      ? { label: 'Good', color: 'text-[#96e212]' }
      : cellVoltage >= minCellV
      ? { label: 'Low', color: 'text-yellow-400' }
      : { label: 'Critical', color: 'text-red-400' };

  const warningIcons: Record<Warning['level'], React.ReactNode> = {
    error: <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />,
    warning: <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0" />,
    info: <Info className="w-4 h-4 text-[#8c8c8c] shrink-0" />,
  };
  const warningBg: Record<Warning['level'], string> = {
    error: 'bg-red-950/20 border-l-red-500',
    warning: 'bg-yellow-950/20 border-l-yellow-500',
    info: 'bg-[#242424] border-l-[#333]',
  };

  return (
    <Card className="bg-[#1f1f1f] border-[#333]">
      <CardHeader className="pb-2">
        <CardTitle className="text-[#f2f2f2] flex items-center gap-2 text-base">
          <BatteryWarning className="w-5 h-5 text-[#ffbb00]" />
          Battery Health
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Internal resistance */}
        <div className="bg-[#242424] rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-4 h-4 text-[#8c8c8c]" />
            <span className="text-xs text-[#8c8c8c] uppercase tracking-wider font-medium">
              Est. Internal Resistance
            </span>
          </div>
          <p className="text-sm text-[#8c8c8c] italic">
            Not available — connect and fly to calculate
          </p>
        </div>

        {/* Cells in range */}
        <div className="bg-[#242424] rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-4 h-4 text-[#8c8c8c]" />
            <span className="text-xs text-[#8c8c8c] uppercase tracking-wider font-medium">
              Cells in Range
            </span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {Array.from({ length: cellCount }).map((_, i) => (
              <div
                key={i}
                className="bg-[#1f1f1f] border border-[#333] rounded px-2 py-1 text-center"
              >
                <div className="text-[10px] text-[#8c8c8c]">C{i + 1}</div>
                <div className={`text-xs font-bold font-mono ${cellStatus.color}`}>
                  {cellVoltage.toFixed(2)}V
                </div>
                <div className={`text-[9px] ${cellStatus.color}`}>{cellStatus.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Flight time remaining */}
        <div className="bg-[#242424] rounded-lg p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#8c8c8c]" />
            <span className="text-xs text-[#8c8c8c] uppercase tracking-wider font-medium">
              Flight Time Remaining
            </span>
          </div>
          <span className="text-lg font-bold font-mono text-[#f2f2f2]">{flightTimeMin}</span>
        </div>

        {/* Warnings panel */}
        <div className="space-y-1.5">
          <div className="text-xs text-[#8c8c8c] uppercase tracking-wider font-medium mb-2">
            Active Warnings
          </div>
          {warnings.length === 0 ? (
            <div className="flex items-center gap-2 text-[#96e212] text-sm p-2">
              <CheckCircle2 className="w-4 h-4" />
              All systems nominal
            </div>
          ) : (
            warnings.map((w) => (
              <div
                key={w.id}
                className={`flex items-start gap-2 p-2.5 rounded-r-md border-l-4 ${warningBg[w.level]}`}
              >
                {warningIcons[w.level]}
                <span className="text-sm text-[#f2f2f2]">{w.message}</span>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// State types
// ---------------------------------------------------------------------------

interface BatteryConfigState {
  cellCountOverride: string;  // "auto" | "1" | "2" | ... | "6"
  capacityMah: number;
  minCellV: number;
  warnCellV: number;
  maxCellV: number;
  voltageScale: number;
}

// ---------------------------------------------------------------------------
// Current draw running average (exponential moving average)
// ---------------------------------------------------------------------------

const EMA_ALPHA = 0.05;

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function BatteryPage() {
  const { telemetry, connected } = useTelemetry();
  const { success } = useToast();

  // Config state
  const [config, setConfig] = useState<BatteryConfigState>({
    cellCountOverride: 'auto',
    capacityMah: 1500,
    minCellV: 3.3,
    warnCellV: 3.5,
    maxCellV: 4.2,
    voltageScale: 1.0,
  });

  // Voltage history rolling buffer
  const historyRef = useRef<VoltagePoint[]>([]);
  const [history, setHistory] = useState<VoltagePoint[]>([]);

  // EMA current draw
  const emaCurrentRef = useRef<number>(0);
  const [avgCurrent, setAvgCurrent] = useState(0);

  // -------------------------------------------------------------------------
  // Derived live values
  // -------------------------------------------------------------------------

  const rawVoltage = connected && telemetry?.battery
    ? telemetry.battery.voltage
    : DEMO_VOLTAGE;

  const scaledVoltage = rawVoltage * config.voltageScale;

  const amperage = connected && telemetry?.battery
    ? telemetry.battery.amperage
    : DEMO_AMPERAGE;

  const mAhConsumed = connected && telemetry?.battery
    ? telemetry.battery.power_meter
    : DEMO_MAH;

  // Cell count
  const cellCount =
    config.cellCountOverride === 'auto'
      ? detectCellCount(scaledVoltage)
      : Number(config.cellCountOverride);

  const cellVoltage = cellCount > 0 ? scaledVoltage / cellCount : 0;

  const batteryPct = cellVoltageToPct(cellVoltage, config.minCellV, config.maxCellV);

  // -------------------------------------------------------------------------
  // Accumulate voltage history on telemetry change
  // -------------------------------------------------------------------------

  useEffect(() => {
    const now = Date.now();
    const point: VoltagePoint = { t: now, v: scaledVoltage };

    historyRef.current = [...historyRef.current, point].slice(-MAX_HISTORY);
    setHistory([...historyRef.current]);

    // Update EMA of current draw
    if (amperage > 0) {
      emaCurrentRef.current =
        emaCurrentRef.current === 0
          ? amperage
          : EMA_ALPHA * amperage + (1 - EMA_ALPHA) * emaCurrentRef.current;
      setAvgCurrent(emaCurrentRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [telemetry, scaledVoltage]);

  // -------------------------------------------------------------------------
  // Chart line color — follows current cell voltage
  // -------------------------------------------------------------------------

  const lineColor =
    cellVoltage > config.warnCellV
      ? '#96e212'
      : cellVoltage > config.minCellV
      ? '#ffbb00'
      : '#e2123f';

  // -------------------------------------------------------------------------
  // Voltage card color
  // -------------------------------------------------------------------------

  const packVoltageColor =
    scaledVoltage > 15
      ? 'text-[#96e212]'
      : scaledVoltage >= 14
      ? 'text-yellow-400'
      : 'text-red-400';

  const cellVoltageColor =
    cellVoltage > 3.9
      ? 'text-[#96e212]'
      : cellVoltage >= 3.7
      ? 'text-yellow-400'
      : 'text-red-400';

  const amperageColor =
    amperage < 30
      ? 'text-[#96e212]'
      : amperage < 60
      ? 'text-yellow-400'
      : 'text-red-400';

  const mahPct = config.capacityMah > 0 ? (mAhConsumed / config.capacityMah) * 100 : 0;
  const mahColor =
    mahPct < 60
      ? 'text-[#96e212]'
      : mahPct < 80
      ? 'text-yellow-400'
      : 'text-red-400';

  // -------------------------------------------------------------------------
  // Warnings
  // -------------------------------------------------------------------------

  const warnings: Warning[] = [];

  if (cellVoltage > 0 && cellVoltage < config.minCellV) {
    warnings.push({
      id: 'low-cell-crit',
      level: 'error',
      message: `Cell voltage critical: ${cellVoltage.toFixed(2)}V (below ${config.minCellV}V minimum)`,
    });
  } else if (cellVoltage > 0 && cellVoltage < config.warnCellV) {
    warnings.push({
      id: 'low-cell-warn',
      level: 'warning',
      message: `Cell voltage low: ${cellVoltage.toFixed(2)}V (below ${config.warnCellV}V warning threshold)`,
    });
  }

  if (amperage > 80) {
    warnings.push({
      id: 'high-current',
      level: 'error',
      message: `High current draw: ${amperage.toFixed(1)}A — check motors and ESC`,
    });
  } else if (amperage > 50) {
    warnings.push({
      id: 'high-current-warn',
      level: 'warning',
      message: `Elevated current draw: ${amperage.toFixed(1)}A`,
    });
  }

  if (mahPct >= 80) {
    warnings.push({
      id: 'mah-limit',
      level: 'warning',
      message: `mAh consumed (${mAhConsumed} mAh) is at ${Math.round(mahPct)}% of configured capacity (${config.capacityMah} mAh)`,
    });
  }

  // -------------------------------------------------------------------------
  // Config handlers
  // -------------------------------------------------------------------------

  const handleConfigChange = useCallback(
    (key: keyof BatteryConfigState, value: string | number) => {
      setConfig((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const handleSaveConfig = useCallback(() => {
    success('Config Saved', 'Battery configuration updated');
  }, [success]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="p-6 space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#f2f2f2] flex items-center gap-2">
            <Battery className="w-6 h-6 text-[#ffbb00]" />
            Battery Management
          </h1>
          <p className="text-[#8c8c8c] text-sm mt-1">
            Betaflight-style live battery monitoring and configuration
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`w-2.5 h-2.5 rounded-full ${
              connected ? 'bg-[#96e212] animate-pulse' : 'bg-yellow-500'
            }`}
          />
          <span className="text-xs text-[#8c8c8c]">
            {connected ? 'Live telemetry' : 'Demo data'}
          </span>
        </div>
      </div>

      {/* Disconnected banner */}
      {!connected && (
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-950/30 border border-amber-800/60 rounded-[4px] text-amber-300 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          No flight controller connected — showing demo data
        </div>
      )}

      {/* Section 1: Live Battery Status cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          icon={<Battery className="w-6 h-6" />}
          label="Pack Voltage"
          value={`${scaledVoltage.toFixed(2)}V`}
          valueColor={packVoltageColor}
          sub={`${cellCount}S pack`}
        />
        <StatCard
          icon={<Zap className="w-6 h-6" />}
          label="Cell Voltage"
          value={`${cellVoltage.toFixed(2)}V`}
          valueColor={cellVoltageColor}
          sub="per cell"
        />
        <StatCard
          icon={<Activity className="w-6 h-6" />}
          label="Current Draw"
          value={`${amperage.toFixed(1)}A`}
          valueColor={amperageColor}
          sub={`avg ${avgCurrent.toFixed(1)}A`}
        />
        <StatCard
          icon={<Gauge className="w-6 h-6" />}
          label="mAh Consumed"
          value={`${Math.round(mAhConsumed)} mAh`}
          valueColor={mahColor}
          sub={
            mahPct >= 80 ? (
              <span className="text-yellow-400 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {Math.round(mahPct)}% of capacity
              </span>
            ) : (
              `${Math.round(mahPct)}% of ${config.capacityMah} mAh`
            )
          }
        />
      </div>

      {/* Section 2: Battery Status Gauge */}
      <BatteryGauge
        pct={batteryPct}
        cellVoltage={cellVoltage}
        cellCount={cellCount}
      />

      {/* Section 3: Voltage History Chart */}
      <VoltageChart data={history} lineColor={lineColor} />

      {/* Section 4 + 5: Config and Health (side by side on large screens) */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Section 4: Battery Configuration */}
        <BatteryConfig
          config={config}
          onChange={handleConfigChange}
          onSave={handleSaveConfig}
        />

        {/* Section 5: Battery Health Estimate */}
        <BatteryHealth
          cellVoltage={cellVoltage}
          cellCount={cellCount}
          mAhConsumed={mAhConsumed}
          capacityMah={config.capacityMah}
          avgCurrent={avgCurrent}
          warnings={warnings}
          minCellV={config.minCellV}
          warnCellV={config.warnCellV}
        />
      </div>
    </div>
  );
}

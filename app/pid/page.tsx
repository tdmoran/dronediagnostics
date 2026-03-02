'use client';

import { useState, useMemo } from 'react';
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

// ─── Types ────────────────────────────────────────────────────────────────────

interface AxisPID {
  p: number;
  i: number;
  d: number;
  ff: number;
}

interface PIDValues {
  roll: AxisPID;
  pitch: AxisPID;
  yaw: AxisPID;
}

interface ActualRates {
  centerSens: number;
  maxRate: number;
}

interface BetaflightRates {
  rcRate: number;
  superRate: number;
  rcExpo: number;
}

interface AxisRates {
  actual: ActualRates;
  betaflight: BetaflightRates;
}

interface RatesState {
  roll: AxisRates;
  pitch: AxisRates;
  yaw: AxisRates;
}

interface GyroFilter {
  enabled: boolean;
  type: 'PT1' | 'BIQUAD';
  frequency: number;
}

interface DynamicNotch {
  enabled: boolean;
  minHz: number;
  maxHz: number;
  count: number;
  width: number;
}

interface RPMFilter {
  enabled: boolean;
  harmonics: number;
}

interface DtermFilter {
  enabled: boolean;
  type: 'PT1' | 'BIQUAD';
  frequency: number;
}

interface DtermNotch {
  enabled: boolean;
  frequency: number;
  cutoff: number;
}

interface FiltersState {
  gyroLowpass1: GyroFilter;
  gyroLowpass2: GyroFilter;
  dynamicNotch: DynamicNotch;
  rpmFilter: RPMFilter;
  dtermLowpass1: DtermFilter;
  dtermLowpass2: DtermFilter;
  dtermNotch: DtermNotch;
}

interface AdvancedSettings {
  antiGravity: number;
  itermRelax: 'OFF' | 'RP' | 'RPY';
  tpaStartThrottle: number;
  tpaRate: number;
  motorOutputLimit: number;
}

// ─── Rate Curve Math ──────────────────────────────────────────────────────────

function actualRate(stick: number, centerSens: number, maxRate: number): number {
  const absStick = Math.abs(stick);
  const expo = absStick * absStick * absStick;
  return Math.sign(stick) * (centerSens * absStick + (maxRate - centerSens) * expo);
}

function betaflightRate(
  stick: number,
  rcRate: number,
  superRate: number,
  expo: number
): number {
  const absStick = Math.abs(stick);
  const expoed = absStick - expo * (absStick * absStick * absStick - absStick);
  const superFactor = 1.0 / (1.0 - superRate * absStick);
  return Math.sign(stick) * rcRate * expoed * superFactor * 200;
}

// ─── Default State ────────────────────────────────────────────────────────────

const DEFAULT_PID: PIDValues = {
  roll:  { p: 45, i: 85,  d: 38, ff: 100 },
  pitch: { p: 47, i: 90,  d: 42, ff: 105 },
  yaw:   { p: 45, i: 85,  d: 0,  ff: 100 },
};

const DEFAULT_RATES: RatesState = {
  roll:  { actual: { centerSens: 200, maxRate: 720 }, betaflight: { rcRate: 1.00, superRate: 0.70, rcExpo: 0.00 } },
  pitch: { actual: { centerSens: 200, maxRate: 720 }, betaflight: { rcRate: 1.00, superRate: 0.70, rcExpo: 0.00 } },
  yaw:   { actual: { centerSens: 180, maxRate: 500 }, betaflight: { rcRate: 1.00, superRate: 0.70, rcExpo: 0.00 } },
};

const DEFAULT_FILTERS: FiltersState = {
  gyroLowpass1:  { enabled: true,  type: 'PT1',    frequency: 250 },
  gyroLowpass2:  { enabled: false, type: 'PT1',    frequency: 0   },
  dynamicNotch:  { enabled: true,  minHz: 100, maxHz: 500, count: 3, width: 20 },
  rpmFilter:     { enabled: false, harmonics: 3 },
  dtermLowpass1: { enabled: true,  type: 'PT1',    frequency: 150 },
  dtermLowpass2: { enabled: false, type: 'PT1',    frequency: 0   },
  dtermNotch:    { enabled: false, frequency: 0, cutoff: 0 },
};

const DEFAULT_ADVANCED: AdvancedSettings = {
  antiGravity: 10,
  itermRelax: 'RP',
  tpaStartThrottle: 1500,
  tpaRate: 10,
  motorOutputLimit: 100,
};

// ─── Presets ──────────────────────────────────────────────────────────────────

const PID_PRESETS: { label: string; values: PIDValues }[] = [
  {
    label: '5" Freestyle',
    values: {
      roll:  { p: 45, i: 85, d: 38, ff: 100 },
      pitch: { p: 47, i: 90, d: 42, ff: 105 },
      yaw:   { p: 45, i: 85, d: 0,  ff: 100 },
    },
  },
  {
    label: '3" Cinewhoop',
    values: {
      roll:  { p: 38, i: 75, d: 30, ff: 80 },
      pitch: { p: 40, i: 80, d: 32, ff: 85 },
      yaw:   { p: 38, i: 75, d: 0,  ff: 80 },
    },
  },
  {
    label: '7" Long Range',
    values: {
      roll:  { p: 35, i: 65, d: 25, ff: 70 },
      pitch: { p: 37, i: 70, d: 27, ff: 75 },
      yaw:   { p: 35, i: 65, d: 0,  ff: 70 },
    },
  },
];

const FILTER_PRESETS: { label: string; apply: (f: FiltersState) => FiltersState }[] = [
  {
    label: 'Noisy Build (RPM + Dynamic)',
    apply: (f) => ({
      ...f,
      rpmFilter:    { ...f.rpmFilter, enabled: true },
      dynamicNotch: { ...f.dynamicNotch, enabled: true, minHz: 100, maxHz: 500, count: 3, width: 20 },
      gyroLowpass1: { ...f.gyroLowpass1, enabled: true, frequency: 200 },
    }),
  },
  {
    label: 'Clean Build (Lowpass only)',
    apply: (f) => ({
      ...f,
      rpmFilter:    { ...f.rpmFilter, enabled: false },
      dynamicNotch: { ...f.dynamicNotch, enabled: true, minHz: 200, maxHz: 500, count: 1, width: 10 },
      gyroLowpass1: { ...f.gyroLowpass1, enabled: true, frequency: 250 },
    }),
  },
  {
    label: 'Props In — Safe Tune',
    apply: (f) => ({
      ...f,
      rpmFilter:     { ...f.rpmFilter, enabled: true },
      dynamicNotch:  { ...f.dynamicNotch, enabled: true, minHz: 100, maxHz: 500, count: 3, width: 25 },
      gyroLowpass1:  { ...f.gyroLowpass1, enabled: true, frequency: 150 },
      dtermLowpass1: { ...f.dtermLowpass1, enabled: true, frequency: 100 },
    }),
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

const PARAM_COLORS: Record<string, string> = {
  p:  '#ef4444',
  i:  '#3b82f6',
  d:  '#22c55e',
  ff: '#f59e0b',
};

const PARAM_RANGES: Record<string, { min: number; max: number }> = {
  p:  { min: 0, max: 100 },
  i:  { min: 0, max: 200 },
  d:  { min: 0, max: 100 },
  ff: { min: 0, max: 200 },
};

function PIDSlider({
  label,
  param,
  value,
  multiplier,
  onChange,
}: {
  label: string;
  param: string;
  value: number;
  multiplier: number;
  onChange: (v: number) => void;
}) {
  const { min, max } = PARAM_RANGES[param];
  const color = PARAM_COLORS[param];
  const displayValue = Math.round(value * multiplier);

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-semibold" style={{ color }}>
          {label.toUpperCase()}
        </span>
        <span className="text-sm font-mono text-[#f2f2f2]">{displayValue}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
        style={{ accentColor: '#ffbb00', background: `linear-gradient(to right, ${color} 0%, ${color} ${((value - min) / (max - min)) * 100}%, #333 ${((value - min) / (max - min)) * 100}%, #333 100%)` }}
      />
    </div>
  );
}

function AxisPIDCard({
  axis,
  values,
  multiplier,
  onChange,
}: {
  axis: string;
  values: AxisPID;
  multiplier: number;
  onChange: (key: keyof AxisPID, v: number) => void;
}) {
  return (
    <div className="bg-[#242424] rounded-lg border border-[#333] p-4 flex-1">
      <h3 className="text-base font-bold text-[#f2f2f2] mb-4 uppercase tracking-widest border-b border-[#333] pb-2">
        {axis}
      </h3>
      <PIDSlider label="P" param="p" value={values.p} multiplier={multiplier} onChange={(v) => onChange('p', v)} />
      <PIDSlider label="I" param="i" value={values.i} multiplier={multiplier} onChange={(v) => onChange('i', v)} />
      <PIDSlider label="D" param="d" value={values.d} multiplier={multiplier} onChange={(v) => onChange('d', v)} />
      <PIDSlider label="FF" param="ff" value={values.ff} multiplier={multiplier} onChange={(v) => onChange('ff', v)} />
    </div>
  );
}

function ToggleSwitch({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex items-center h-6 w-11 rounded-full transition-colors flex-shrink-0 ${
        enabled ? 'bg-[#ffbb00]' : 'bg-[#333]'
      }`}
    >
      <span
        className={`inline-block w-4 h-4 bg-white rounded-full transition-transform ${
          enabled ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

function SaveBanner({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed bottom-6 left-1/2 z-50 flex items-center gap-4 px-6 py-3 rounded-[4px] border border-[#ffbb00] bg-[#1f1f1f] shadow-xl"
      style={{ transform: 'translateX(-50%)' }}
    >
      <span className="text-[#ffbb00] font-semibold text-sm">
        Settings saved — restart FC to apply
      </span>
      <button
        onClick={onClose}
        className="text-[#8c8c8c] hover:text-[#f2f2f2] text-lg leading-none font-bold"
      >
        x
      </button>
    </div>
  );
}

// ─── Tab: PID Values ──────────────────────────────────────────────────────────

function PIDValuesTab({
  pid,
  setPid,
  onSave,
}: {
  pid: PIDValues;
  setPid: React.Dispatch<React.SetStateAction<PIDValues>>;
  onSave: () => void;
}) {
  const [multiplier, setMultiplier] = useState(1.0);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [advanced, setAdvanced] = useState<AdvancedSettings>(DEFAULT_ADVANCED);

  const updateAxis = (
    axis: keyof PIDValues,
    key: keyof AxisPID,
    value: number
  ) => {
    setPid((prev) => ({ ...prev, [axis]: { ...prev[axis], [key]: value } }));
  };

  return (
    <div className="space-y-5">
      {/* Quick Presets */}
      <div className="bg-[#1f1f1f] rounded-[4px] border border-[#333] p-4">
        <h2 className="text-sm font-semibold text-[#8c8c8c] uppercase tracking-wider mb-3">
          Quick Presets
        </h2>
        <div className="flex flex-wrap gap-2">
          {PID_PRESETS.map((preset) => (
            <button
              key={preset.label}
              onClick={() => setPid(preset.values)}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-[#242424] text-[#8c8c8c] border border-[#333] hover:border-[#ffbb00] hover:text-[#ffbb00] transition-colors"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3-Column PID Sliders */}
      <div className="bg-[#1f1f1f] rounded-[4px] border border-[#333] p-4">
        <h2 className="text-sm font-semibold text-[#8c8c8c] uppercase tracking-wider mb-4">
          PID Values
        </h2>
        <div className="flex gap-4">
          {(['roll', 'pitch', 'yaw'] as const).map((axis) => (
            <AxisPIDCard
              key={axis}
              axis={axis}
              values={pid[axis]}
              multiplier={multiplier}
              onChange={(key, value) => updateAxis(axis, key, value)}
            />
          ))}
        </div>

        {/* Legend */}
        <div className="flex gap-5 mt-4 pt-4 border-t border-[#333]">
          {(['p', 'i', 'd', 'ff'] as const).map((p) => (
            <div key={p} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: PARAM_COLORS[p] }} />
              <span className="text-xs text-[#8c8c8c] font-mono uppercase">{p}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Master Multiplier */}
      <div className="bg-[#1f1f1f] rounded-[4px] border border-[#333] p-4">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-semibold text-[#8c8c8c] uppercase tracking-wider">
            Master Multiplier
          </h2>
          <span className="text-lg font-bold font-mono text-[#ffbb00]">
            {multiplier.toFixed(2)}x
          </span>
        </div>
        <p className="text-xs text-[#8c8c8c] mb-3">Scales all PID values proportionally.</p>
        <input
          type="range"
          min={0.5}
          max={2.0}
          step={0.05}
          value={multiplier}
          onChange={(e) => setMultiplier(Number(e.target.value))}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
          style={{ accentColor: '#ffbb00' }}
        />
        <div className="flex justify-between text-xs text-[#8c8c8c] mt-1">
          <span>0.5x</span>
          <span>1.0x</span>
          <span>2.0x</span>
        </div>
      </div>

      {/* Advanced Settings */}
      <div className="bg-[#1f1f1f] rounded-[4px] border border-[#333] overflow-hidden">
        <button
          onClick={() => setAdvancedOpen(!advancedOpen)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-[#8c8c8c] uppercase tracking-wider hover:text-[#f2f2f2] transition-colors"
        >
          <span>Advanced Settings</span>
          <span
            className="text-xs transition-transform duration-200"
            style={{ transform: advancedOpen ? 'rotate(180deg)' : 'rotate(0deg)', display: 'inline-block' }}
          >
            ▼
          </span>
        </button>

        {advancedOpen && (
          <div className="px-4 pb-5 space-y-5 border-t border-[#333]">
            <div className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Anti-Gravity */}
              <div>
                <label className="text-sm font-medium text-[#f2f2f2] block mb-1">
                  Anti-Gravity
                </label>
                <input
                  type="number"
                  min={3}
                  max={30}
                  value={advanced.antiGravity}
                  onChange={(e) =>
                    setAdvanced((p) => ({ ...p, antiGravity: Number(e.target.value) }))
                  }
                  className="w-full bg-[#242424] border border-[#333] rounded-lg px-3 py-2 text-[#f2f2f2] text-sm focus:outline-none focus:border-[#ffbb00]"
                />
              </div>

              {/* I-term Relax */}
              <div>
                <label className="text-sm font-medium text-[#f2f2f2] block mb-1">
                  I-term Relax
                </label>
                <select
                  value={advanced.itermRelax}
                  onChange={(e) =>
                    setAdvanced((p) => ({
                      ...p,
                      itermRelax: e.target.value as AdvancedSettings['itermRelax'],
                    }))
                  }
                  className="w-full bg-[#242424] border border-[#333] rounded-lg px-3 py-2 text-[#f2f2f2] text-sm focus:outline-none focus:border-[#ffbb00]"
                >
                  <option value="OFF">OFF</option>
                  <option value="RP">RP</option>
                  <option value="RPY">RPY</option>
                </select>
              </div>
            </div>

            {/* TPA Start Throttle */}
            <div>
              <div className="flex justify-between mb-1">
                <label className="text-sm font-medium text-[#f2f2f2]">TPA Start Throttle</label>
                <span className="text-sm font-mono text-[#ffbb00]">{advanced.tpaStartThrottle}</span>
              </div>
              <input
                type="range"
                min={1000}
                max={2000}
                step={10}
                value={advanced.tpaStartThrottle}
                onChange={(e) =>
                  setAdvanced((p) => ({ ...p, tpaStartThrottle: Number(e.target.value) }))
                }
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                style={{ accentColor: '#ffbb00' }}
              />
              <div className="flex justify-between text-xs text-[#8c8c8c] mt-1">
                <span>1000</span>
                <span>2000</span>
              </div>
            </div>

            {/* TPA Rate */}
            <div>
              <div className="flex justify-between mb-1">
                <label className="text-sm font-medium text-[#f2f2f2]">TPA Rate</label>
                <span className="text-sm font-mono text-[#ffbb00]">{advanced.tpaRate}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={advanced.tpaRate}
                onChange={(e) =>
                  setAdvanced((p) => ({ ...p, tpaRate: Number(e.target.value) }))
                }
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                style={{ accentColor: '#ffbb00' }}
              />
              <div className="flex justify-between text-xs text-[#8c8c8c] mt-1">
                <span>0%</span>
                <span>100%</span>
              </div>
            </div>

            {/* Motor Output Limit */}
            <div>
              <div className="flex justify-between mb-1">
                <label className="text-sm font-medium text-[#f2f2f2]">Motor Output Limit</label>
                <span className="text-sm font-mono text-[#ffbb00]">{advanced.motorOutputLimit}%</span>
              </div>
              <input
                type="range"
                min={50}
                max={100}
                step={1}
                value={advanced.motorOutputLimit}
                onChange={(e) =>
                  setAdvanced((p) => ({ ...p, motorOutputLimit: Number(e.target.value) }))
                }
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                style={{ accentColor: '#ffbb00' }}
              />
              <div className="flex justify-between text-xs text-[#8c8c8c] mt-1">
                <span>50%</span>
                <span>100%</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Save */}
      <div className="flex justify-end pt-1">
        <button
          onClick={onSave}
          className="px-6 py-2.5 rounded-[4px] bg-[#ffbb00] text-[#141414] font-bold text-sm hover:bg-[#e6a800] transition-colors"
        >
          Save &amp; Apply
        </button>
      </div>
    </div>
  );
}

// ─── Tab: Rates ───────────────────────────────────────────────────────────────

type RatesMode = 'ACTUAL' | 'BETAFLIGHT';
type RatesAxis = 'roll' | 'pitch' | 'yaw';

function RatesAxisColumn({
  axis,
  mode,
  rates,
  onChange,
}: {
  axis: RatesAxis;
  mode: RatesMode;
  rates: AxisRates;
  onChange: (updated: AxisRates) => void;
}) {
  const label = axis.charAt(0).toUpperCase() + axis.slice(1);

  return (
    <div className="bg-[#242424] rounded-lg border border-[#333] p-4 flex-1">
      <h3 className="text-sm font-bold text-[#f2f2f2] uppercase tracking-widest mb-4 border-b border-[#333] pb-2">
        {label}
      </h3>

      {mode === 'ACTUAL' ? (
        <>
          <div className="mb-4">
            <div className="flex justify-between mb-1">
              <span className="text-sm text-[#8c8c8c]">Center Sensitivity</span>
              <span className="text-sm font-mono text-[#f2f2f2]">{rates.actual.centerSens} °/s</span>
            </div>
            <input
              type="range"
              min={0}
              max={500}
              step={5}
              value={rates.actual.centerSens}
              onChange={(e) =>
                onChange({ ...rates, actual: { ...rates.actual, centerSens: Number(e.target.value) } })
              }
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
              style={{ accentColor: '#ffbb00' }}
            />
            <div className="flex justify-between text-xs text-[#8c8c8c] mt-1">
              <span>0</span>
              <span>500</span>
            </div>
          </div>

          <div>
            <div className="flex justify-between mb-1">
              <span className="text-sm text-[#8c8c8c]">Max Rate</span>
              <span className="text-sm font-mono text-[#f2f2f2]">{rates.actual.maxRate} °/s</span>
            </div>
            <input
              type="range"
              min={0}
              max={1200}
              step={10}
              value={rates.actual.maxRate}
              onChange={(e) =>
                onChange({ ...rates, actual: { ...rates.actual, maxRate: Number(e.target.value) } })
              }
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
              style={{ accentColor: '#ffbb00' }}
            />
            <div className="flex justify-between text-xs text-[#8c8c8c] mt-1">
              <span>0</span>
              <span>1200</span>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* RC Rate */}
          <div className="mb-4">
            <div className="flex justify-between mb-1">
              <span className="text-sm text-[#8c8c8c]">RC Rate</span>
              <span className="text-sm font-mono text-[#f2f2f2]">{rates.betaflight.rcRate.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={2.55}
              step={0.01}
              value={rates.betaflight.rcRate}
              onChange={(e) =>
                onChange({ ...rates, betaflight: { ...rates.betaflight, rcRate: Number(e.target.value) } })
              }
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
              style={{ accentColor: '#ffbb00' }}
            />
            <div className="flex justify-between text-xs text-[#8c8c8c] mt-1">
              <span>0</span>
              <span>2.55</span>
            </div>
          </div>

          {/* Super Rate */}
          <div className="mb-4">
            <div className="flex justify-between mb-1">
              <span className="text-sm text-[#8c8c8c]">Super Rate</span>
              <span className="text-sm font-mono text-[#f2f2f2]">{rates.betaflight.superRate.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={0.95}
              step={0.01}
              value={rates.betaflight.superRate}
              onChange={(e) =>
                onChange({ ...rates, betaflight: { ...rates.betaflight, superRate: Number(e.target.value) } })
              }
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
              style={{ accentColor: '#ffbb00' }}
            />
            <div className="flex justify-between text-xs text-[#8c8c8c] mt-1">
              <span>0</span>
              <span>0.95</span>
            </div>
          </div>

          {/* RC Expo */}
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-sm text-[#8c8c8c]">RC Expo</span>
              <span className="text-sm font-mono text-[#f2f2f2]">{rates.betaflight.rcExpo.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={1.00}
              step={0.01}
              value={rates.betaflight.rcExpo}
              onChange={(e) =>
                onChange({ ...rates, betaflight: { ...rates.betaflight, rcExpo: Number(e.target.value) } })
              }
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
              style={{ accentColor: '#ffbb00' }}
            />
            <div className="flex justify-between text-xs text-[#8c8c8c] mt-1">
              <span>0</span>
              <span>1.00</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const CURVE_AXIS_COLORS: Record<RatesAxis, string> = {
  roll: '#ef4444',
  pitch: '#22c55e',
  yaw: '#3b82f6',
};

function RatesTab({
  rates,
  setRates,
  onSave,
}: {
  rates: RatesState;
  setRates: React.Dispatch<React.SetStateAction<RatesState>>;
  onSave: () => void;
}) {
  const [mode, setMode] = useState<RatesMode>('ACTUAL');
  const [curveAxis, setCurveAxis] = useState<RatesAxis>('roll');

  const curveData = useMemo(() => {
    const points: { stick: number; rate: number }[] = [];
    for (let i = 0; i <= 200; i++) {
      const stick = (i / 200) * 2 - 1; // -1 to +1
      const r = rates[curveAxis];
      let rate: number;
      if (mode === 'ACTUAL') {
        rate = actualRate(stick, r.actual.centerSens, r.actual.maxRate);
      } else {
        rate = betaflightRate(
          stick,
          r.betaflight.rcRate,
          r.betaflight.superRate,
          r.betaflight.rcExpo
        );
      }
      points.push({ stick: Math.round(stick * 100), rate: Math.round(rate) });
    }
    return points;
  }, [mode, curveAxis, rates]);

  const updateAxis = (axis: RatesAxis, updated: AxisRates) => {
    setRates((prev) => ({ ...prev, [axis]: updated }));
  };

  return (
    <div className="space-y-5">
      {/* Mode selector */}
      <div className="bg-[#1f1f1f] rounded-[4px] border border-[#333] p-4">
        <h2 className="text-sm font-semibold text-[#8c8c8c] uppercase tracking-wider mb-3">
          Rates Type
        </h2>
        <div className="flex gap-2">
          {(['ACTUAL', 'BETAFLIGHT'] as RatesMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors ${
                mode === m
                  ? 'bg-[#ffbb00] text-[#141414]'
                  : 'bg-[#242424] text-[#8c8c8c] hover:bg-[#333]'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Per-axis sliders */}
      <div className="bg-[#1f1f1f] rounded-[4px] border border-[#333] p-4">
        <h2 className="text-sm font-semibold text-[#8c8c8c] uppercase tracking-wider mb-4">
          Per-Axis Rates
        </h2>
        <div className="flex gap-4">
          {(['roll', 'pitch', 'yaw'] as RatesAxis[]).map((axis) => (
            <RatesAxisColumn
              key={axis}
              axis={axis}
              mode={mode}
              rates={rates[axis]}
              onChange={(updated) => updateAxis(axis, updated)}
            />
          ))}
        </div>
      </div>

      {/* Rate Curve Graph */}
      <div className="bg-[#1f1f1f] rounded-[4px] border border-[#333] p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-[#8c8c8c] uppercase tracking-wider">
            Rate Curve
          </h2>
          <div className="flex gap-2">
            {(['roll', 'pitch', 'yaw'] as RatesAxis[]).map((axis) => (
              <button
                key={axis}
                onClick={() => setCurveAxis(axis)}
                className={`px-3 py-1 rounded text-xs font-semibold transition-colors capitalize ${
                  curveAxis === axis
                    ? 'text-[#141414]'
                    : 'bg-[#242424] text-[#8c8c8c] hover:bg-[#333]'
                }`}
                style={curveAxis === axis ? { backgroundColor: CURVE_AXIS_COLORS[axis] } : {}}
              >
                {axis}
              </button>
            ))}
          </div>
        </div>

        <div className="h-64 bg-[#141414] rounded-lg border border-[#333] p-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={curveData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
              <XAxis
                dataKey="stick"
                stroke="#8c8c8c"
                fontSize={11}
                tickFormatter={(v) => `${v}%`}
                domain={[-100, 100]}
                type="number"
                ticks={[-100, -75, -50, -25, 0, 25, 50, 75, 100]}
                label={{ value: 'Stick Input (%)', position: 'insideBottom', offset: -2, fill: '#8c8c8c', fontSize: 11 }}
              />
              <YAxis
                stroke="#8c8c8c"
                fontSize={11}
                tickFormatter={(v) => `${v}°/s`}
                width={60}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f1f1f',
                  border: '1px solid #333',
                  borderRadius: '4px',
                  fontSize: 12,
                }}
                labelStyle={{ color: '#8c8c8c' }}
                formatter={(v: number) => [`${v} °/s`, 'Rate']}
                labelFormatter={(l) => `Stick: ${l}%`}
              />
              <ReferenceLine x={0} stroke="#333" strokeWidth={1} />
              <ReferenceLine y={0} stroke="#333" strokeWidth={1} />
              <Line
                type="monotone"
                dataKey="rate"
                stroke={CURVE_AXIS_COLORS[curveAxis]}
                strokeWidth={2}
                dot={false}
                name="Rate"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Save */}
      <div className="flex justify-end pt-1">
        <button
          onClick={onSave}
          className="px-6 py-2.5 rounded-[4px] bg-[#ffbb00] text-[#141414] font-bold text-sm hover:bg-[#e6a800] transition-colors"
        >
          Save &amp; Apply
        </button>
      </div>
    </div>
  );
}

// ─── Tab: Filters ─────────────────────────────────────────────────────────────

function FilterFreqSlider({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-3 flex-1">
      <span className="text-sm text-[#8c8c8c] w-24 flex-shrink-0">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer"
        style={{ accentColor: '#ffbb00' }}
      />
      <span className="text-sm font-mono text-[#f2f2f2] w-20 text-right flex-shrink-0">
        {value === 0 ? 'OFF' : `${value}${unit}`}
      </span>
    </div>
  );
}

function FilterTypeSelect({
  value,
  onChange,
}: {
  value: 'PT1' | 'BIQUAD';
  onChange: (v: 'PT1' | 'BIQUAD') => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as 'PT1' | 'BIQUAD')}
      className="bg-[#333] border border-[#444] rounded px-2 py-1 text-xs text-[#f2f2f2] focus:outline-none focus:border-[#ffbb00]"
    >
      <option value="PT1">PT1</option>
      <option value="BIQUAD">BIQUAD</option>
    </select>
  );
}

function FiltersTab({
  filters,
  setFilters,
  onSave,
}: {
  filters: FiltersState;
  setFilters: React.Dispatch<React.SetStateAction<FiltersState>>;
  onSave: () => void;
}) {
  return (
    <div className="space-y-5">
      {/* Filter Presets */}
      <div className="bg-[#1f1f1f] rounded-[4px] border border-[#333] p-4">
        <h2 className="text-sm font-semibold text-[#8c8c8c] uppercase tracking-wider mb-3">
          Filter Presets
        </h2>
        <div className="flex flex-wrap gap-2">
          {FILTER_PRESETS.map((preset) => (
            <button
              key={preset.label}
              onClick={() => setFilters((prev) => preset.apply(prev))}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-[#242424] text-[#8c8c8c] border border-[#333] hover:border-[#ffbb00] hover:text-[#ffbb00] transition-colors"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Gyro Filters */}
      <div className="bg-[#1f1f1f] rounded-[4px] border border-[#333] p-4">
        <h2 className="text-sm font-semibold text-[#8c8c8c] uppercase tracking-wider mb-4">
          Gyro Filters
        </h2>
        <div className="space-y-5">
          {/* Gyro Lowpass 1 */}
          <div className="bg-[#242424] rounded-lg p-4 border border-[#333] space-y-3">
            <div className="flex items-center gap-3">
              <ToggleSwitch
                enabled={filters.gyroLowpass1.enabled}
                onChange={(v) => setFilters((p) => ({ ...p, gyroLowpass1: { ...p.gyroLowpass1, enabled: v } }))}
              />
              <span className="text-sm font-semibold text-[#f2f2f2]">Gyro Lowpass 1</span>
              <FilterTypeSelect
                value={filters.gyroLowpass1.type}
                onChange={(v) => setFilters((p) => ({ ...p, gyroLowpass1: { ...p.gyroLowpass1, type: v } }))}
              />
            </div>
            <FilterFreqSlider
              label="Frequency"
              value={filters.gyroLowpass1.frequency}
              min={0}
              max={1000}
              step={5}
              unit="Hz"
              onChange={(v) => setFilters((p) => ({ ...p, gyroLowpass1: { ...p.gyroLowpass1, frequency: v } }))}
            />
          </div>

          {/* Gyro Lowpass 2 */}
          <div className="bg-[#242424] rounded-lg p-4 border border-[#333] space-y-3">
            <div className="flex items-center gap-3">
              <ToggleSwitch
                enabled={filters.gyroLowpass2.enabled}
                onChange={(v) => setFilters((p) => ({ ...p, gyroLowpass2: { ...p.gyroLowpass2, enabled: v } }))}
              />
              <span className="text-sm font-semibold text-[#f2f2f2]">Gyro Lowpass 2</span>
              <FilterTypeSelect
                value={filters.gyroLowpass2.type}
                onChange={(v) => setFilters((p) => ({ ...p, gyroLowpass2: { ...p.gyroLowpass2, type: v } }))}
              />
            </div>
            <FilterFreqSlider
              label="Frequency"
              value={filters.gyroLowpass2.frequency}
              min={0}
              max={1000}
              step={5}
              unit="Hz"
              onChange={(v) => setFilters((p) => ({ ...p, gyroLowpass2: { ...p.gyroLowpass2, frequency: v } }))}
            />
          </div>

          {/* Dynamic Notch Filter */}
          <div className="bg-[#242424] rounded-lg p-4 border border-[#333] space-y-3">
            <div className="flex items-center gap-3">
              <ToggleSwitch
                enabled={filters.dynamicNotch.enabled}
                onChange={(v) => setFilters((p) => ({ ...p, dynamicNotch: { ...p.dynamicNotch, enabled: v } }))}
              />
              <span className="text-sm font-semibold text-[#f2f2f2]">Dynamic Notch Filter</span>
            </div>
            <FilterFreqSlider
              label="Min Hz"
              value={filters.dynamicNotch.minHz}
              min={0}
              max={1000}
              step={5}
              unit="Hz"
              onChange={(v) => setFilters((p) => ({ ...p, dynamicNotch: { ...p.dynamicNotch, minHz: v } }))}
            />
            <FilterFreqSlider
              label="Max Hz"
              value={filters.dynamicNotch.maxHz}
              min={0}
              max={1000}
              step={5}
              unit="Hz"
              onChange={(v) => setFilters((p) => ({ ...p, dynamicNotch: { ...p.dynamicNotch, maxHz: v } }))}
            />
            <div className="flex gap-4">
              <div className="flex-1">
                <div className="flex justify-between mb-1">
                  <span className="text-sm text-[#8c8c8c]">Count</span>
                  <span className="text-sm font-mono text-[#f2f2f2]">{filters.dynamicNotch.count}</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={5}
                  step={1}
                  value={filters.dynamicNotch.count}
                  onChange={(e) =>
                    setFilters((p) => ({ ...p, dynamicNotch: { ...p.dynamicNotch, count: Number(e.target.value) } }))
                  }
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                  style={{ accentColor: '#ffbb00' }}
                />
              </div>
              <div className="flex-1">
                <div className="flex justify-between mb-1">
                  <span className="text-sm text-[#8c8c8c]">Width</span>
                  <span className="text-sm font-mono text-[#f2f2f2]">{filters.dynamicNotch.width}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={filters.dynamicNotch.width}
                  onChange={(e) =>
                    setFilters((p) => ({ ...p, dynamicNotch: { ...p.dynamicNotch, width: Number(e.target.value) } }))
                  }
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                  style={{ accentColor: '#ffbb00' }}
                />
              </div>
            </div>
          </div>

          {/* RPM Filter */}
          <div className="bg-[#242424] rounded-lg p-4 border border-[#333] space-y-3">
            <div className="flex items-center gap-3">
              <ToggleSwitch
                enabled={filters.rpmFilter.enabled}
                onChange={(v) => setFilters((p) => ({ ...p, rpmFilter: { ...p.rpmFilter, enabled: v } }))}
              />
              <span className="text-sm font-semibold text-[#f2f2f2]">RPM Filter</span>
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-sm text-[#8c8c8c]">Harmonics</span>
                <span className="text-sm font-mono text-[#f2f2f2]">{filters.rpmFilter.harmonics}</span>
              </div>
              <input
                type="range"
                min={1}
                max={3}
                step={1}
                value={filters.rpmFilter.harmonics}
                onChange={(e) =>
                  setFilters((p) => ({ ...p, rpmFilter: { ...p.rpmFilter, harmonics: Number(e.target.value) } }))
                }
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                style={{ accentColor: '#ffbb00' }}
              />
            </div>
            <p className="text-xs text-[#8c8c8c] italic">
              Requires Bidirectional DShot and supported ESC firmware
            </p>
          </div>
        </div>
      </div>

      {/* D-term Filters */}
      <div className="bg-[#1f1f1f] rounded-[4px] border border-[#333] p-4">
        <h2 className="text-sm font-semibold text-[#8c8c8c] uppercase tracking-wider mb-4">
          D-term Filters
        </h2>
        <div className="space-y-5">
          {/* D-term Lowpass 1 */}
          <div className="bg-[#242424] rounded-lg p-4 border border-[#333] space-y-3">
            <div className="flex items-center gap-3">
              <ToggleSwitch
                enabled={filters.dtermLowpass1.enabled}
                onChange={(v) => setFilters((p) => ({ ...p, dtermLowpass1: { ...p.dtermLowpass1, enabled: v } }))}
              />
              <span className="text-sm font-semibold text-[#f2f2f2]">D-term Lowpass 1</span>
              <FilterTypeSelect
                value={filters.dtermLowpass1.type}
                onChange={(v) => setFilters((p) => ({ ...p, dtermLowpass1: { ...p.dtermLowpass1, type: v } }))}
              />
            </div>
            <FilterFreqSlider
              label="Frequency"
              value={filters.dtermLowpass1.frequency}
              min={0}
              max={500}
              step={5}
              unit="Hz"
              onChange={(v) => setFilters((p) => ({ ...p, dtermLowpass1: { ...p.dtermLowpass1, frequency: v } }))}
            />
          </div>

          {/* D-term Lowpass 2 */}
          <div className="bg-[#242424] rounded-lg p-4 border border-[#333] space-y-3">
            <div className="flex items-center gap-3">
              <ToggleSwitch
                enabled={filters.dtermLowpass2.enabled}
                onChange={(v) => setFilters((p) => ({ ...p, dtermLowpass2: { ...p.dtermLowpass2, enabled: v } }))}
              />
              <span className="text-sm font-semibold text-[#f2f2f2]">D-term Lowpass 2</span>
              <FilterTypeSelect
                value={filters.dtermLowpass2.type}
                onChange={(v) => setFilters((p) => ({ ...p, dtermLowpass2: { ...p.dtermLowpass2, type: v } }))}
              />
            </div>
            <FilterFreqSlider
              label="Frequency"
              value={filters.dtermLowpass2.frequency}
              min={0}
              max={500}
              step={5}
              unit="Hz"
              onChange={(v) => setFilters((p) => ({ ...p, dtermLowpass2: { ...p.dtermLowpass2, frequency: v } }))}
            />
          </div>

          {/* D-term Notch */}
          <div className="bg-[#242424] rounded-lg p-4 border border-[#333] space-y-3">
            <div className="flex items-center gap-3">
              <ToggleSwitch
                enabled={filters.dtermNotch.enabled}
                onChange={(v) => setFilters((p) => ({ ...p, dtermNotch: { ...p.dtermNotch, enabled: v } }))}
              />
              <span className="text-sm font-semibold text-[#f2f2f2]">D-term Notch</span>
            </div>
            <FilterFreqSlider
              label="Frequency"
              value={filters.dtermNotch.frequency}
              min={0}
              max={500}
              step={5}
              unit="Hz"
              onChange={(v) => setFilters((p) => ({ ...p, dtermNotch: { ...p.dtermNotch, frequency: v } }))}
            />
            <FilterFreqSlider
              label="Cutoff"
              value={filters.dtermNotch.cutoff}
              min={0}
              max={500}
              step={5}
              unit="Hz"
              onChange={(v) => setFilters((p) => ({ ...p, dtermNotch: { ...p.dtermNotch, cutoff: v } }))}
            />
          </div>
        </div>
      </div>

      {/* Info note card */}
      <div className="bg-[#1f1f1f] rounded-[4px] border border-[#ffbb00]/30 p-4">
        <div className="flex gap-3">
          <span className="text-[#ffbb00] text-base flex-shrink-0 mt-0.5">!</span>
          <p className="text-sm text-[#8c8c8c] leading-relaxed">
            <strong className="text-[#f2f2f2]">Tip:</strong> Enable RPM Filter if your ESCs support
            Bidirectional DShot (BLHeli32 / AM32 / Bluejay). It provides precise per-motor notch
            filtering and allows higher D-term without oscillation.
          </p>
        </div>
      </div>

      {/* Save */}
      <div className="flex justify-end pt-1">
        <button
          onClick={onSave}
          className="px-6 py-2.5 rounded-[4px] bg-[#ffbb00] text-[#141414] font-bold text-sm hover:bg-[#e6a800] transition-colors"
        >
          Save &amp; Apply
        </button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'pid' | 'rates' | 'filters';

const TABS: { id: Tab; label: string }[] = [
  { id: 'pid',     label: 'PID Values' },
  { id: 'rates',   label: 'Rates'      },
  { id: 'filters', label: 'Filters'    },
];

export default function PIDTuningPage() {
  const [activeTab, setActiveTab] = useState<Tab>('pid');
  const [pid, setPid] = useState<PIDValues>(DEFAULT_PID);
  const [rates, setRates] = useState<RatesState>(DEFAULT_RATES);
  const [filters, setFilters] = useState<FiltersState>(DEFAULT_FILTERS);
  const [showBanner, setShowBanner] = useState(false);

  const handleSave = () => {
    setShowBanner(true);
    setTimeout(() => setShowBanner(false), 4000);
  };

  return (
    <div className="p-4 lg:p-6 space-y-5">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-[#f2f2f2]">PID Tuning</h1>
        <p className="text-[#8c8c8c] text-sm mt-1">
          Configure PID values, rates, and filter settings for your flight controller
        </p>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-2 border-b border-[#333] pb-0">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-2.5 text-sm font-semibold rounded-t-lg transition-colors -mb-px border-b-2 ${
              activeTab === tab.id
                ? 'bg-[#ffbb00] text-[#141414] border-[#ffbb00]'
                : 'bg-[#242424] text-[#8c8c8c] border-transparent hover:bg-[#2a2a2a] hover:text-[#f2f2f2]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'pid' && (
        <PIDValuesTab pid={pid} setPid={setPid} onSave={handleSave} />
      )}
      {activeTab === 'rates' && (
        <RatesTab rates={rates} setRates={setRates} onSave={handleSave} />
      )}
      {activeTab === 'filters' && (
        <FiltersTab filters={filters} setFilters={setFilters} onSave={handleSave} />
      )}

      {/* Save banner */}
      {showBanner && <SaveBanner onClose={() => setShowBanner(false)} />}
    </div>
  );
}

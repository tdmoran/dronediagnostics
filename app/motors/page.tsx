'use client';

import { useState, useEffect, useRef } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Zap,
  Settings2,
  RotateCcw,
  ShieldAlert,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTelemetry } from '@/components/TelemetryProvider';

// ─── Types ────────────────────────────────────────────────────────────────────

type SpinDirection = 'CCW' | 'CW';

interface MotorConfig {
  id: number;
  label: string;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  defaultDir: SpinDirection;
}

interface SimMotorData {
  rpm: number;
  temp: number;
  voltage: number;
  current: number;
  dshotErr: number;
}

const MOTOR_CONFIGS: MotorConfig[] = [
  { id: 1, label: 'M1', position: 'top-left',     defaultDir: 'CCW' },
  { id: 2, label: 'M2', position: 'top-right',    defaultDir: 'CW'  },
  { id: 3, label: 'M3', position: 'bottom-left',  defaultDir: 'CW'  },
  { id: 4, label: 'M4', position: 'bottom-right', defaultDir: 'CCW' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

function computeFinalThrottle(master: number, individual: number): number {
  return (master / 100) * (individual / 100) * 100;
}

function rpmColor(throttlePct: number): string {
  if (throttlePct > 70) return 'text-red-400';
  if (throttlePct > 30) return 'text-[#ffbb00]';
  return 'text-[#96e212]';
}

function tempColor(temp: number): string {
  if (temp > 70) return 'text-red-400';
  if (temp > 50) return 'text-[#ffbb00]';
  return 'text-[#96e212]';
}

function throttleIndicatorColor(throttlePct: number): string {
  if (throttlePct === 0) return '#4b5563'; // gray-600
  if (throttlePct <= 30) return '#eab308'; // yellow-500
  if (throttlePct <= 65) return '#f97316'; // orange-500
  return '#ef4444'; // red-500
}

// ─── Motor Node in diagram ────────────────────────────────────────────────────

function MotorNode({
  config,
  direction,
  finalThrottle,
  onToggleDir,
}: {
  config: MotorConfig;
  direction: SpinDirection;
  finalThrottle: number;
  onToggleDir: () => void;
}) {
  const color = throttleIndicatorColor(finalThrottle);
  const isSpinning = finalThrottle > 0;

  return (
    <div className="flex flex-col items-center gap-1.5">
      {/* Motor circle */}
      <div
        className="relative w-16 h-16 rounded-full border-2 flex items-center justify-center transition-all duration-150"
        style={{
          borderColor: color,
          boxShadow: isSpinning ? `0 0 12px ${color}60` : 'none',
          backgroundColor: '#242424',
        }}
      >
        {/* Throttle fill ring */}
        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 64 64">
          <circle
            cx="32" cy="32" r="28"
            fill="none"
            stroke={color}
            strokeWidth="4"
            strokeDasharray={`${(finalThrottle / 100) * 175.9} 175.9`}
            strokeLinecap="round"
            className="transition-all duration-150"
          />
        </svg>
        <div className="z-10 text-center">
          <div className="text-sm font-bold text-[#f2f2f2]">{config.label}</div>
          <div className="text-xs font-mono" style={{ color }}>
            {Math.round(finalThrottle)}%
          </div>
        </div>
      </div>

      {/* Spin direction toggle */}
      <button
        onClick={onToggleDir}
        className="flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-mono transition-colors duration-150 hover:bg-[#333]"
        style={{
          borderColor: direction === 'CCW' ? '#3b82f6' : '#a855f7',
          color: direction === 'CCW' ? '#60a5fa' : '#c084fc',
        }}
      >
        <RotateCcw
          className="w-3 h-3"
          style={{
            transform: direction === 'CW' ? 'scaleX(-1)' : 'none',
            color: direction === 'CCW' ? '#60a5fa' : '#c084fc',
          }}
        />
        {direction}
      </button>
    </div>
  );
}

// ─── Quad Diagram ─────────────────────────────────────────────────────────────

function QuadDiagram({
  finalThrottles,
  directions,
  onToggleDir,
}: {
  finalThrottles: number[];
  directions: SpinDirection[];
  onToggleDir: (idx: number) => void;
}) {
  return (
    <Card className="bg-[#1f1f1f] border-[#333]">
      <CardHeader className="pb-2">
        <CardTitle className="text-[#f2f2f2] flex items-center gap-2 text-base">
          <Zap className="w-4 h-4 text-[#ffbb00]" />
          Quad Motor Layout
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center gap-2">
          {/* Direction label */}
          <div className="flex items-center gap-1 mb-1">
            <div className="w-0 h-0 border-l-4 border-r-4 border-b-8 border-l-transparent border-r-transparent border-b-[#ffbb00]" />
            <span className="text-xs text-[#8c8c8c]">FRONT</span>
          </div>

          {/* Grid layout */}
          <div className="grid grid-cols-3 gap-4 items-center w-full max-w-xs">
            {/* Row 1 */}
            <MotorNode
              config={MOTOR_CONFIGS[0]}
              direction={directions[0]}
              finalThrottle={finalThrottles[0]}
              onToggleDir={() => onToggleDir(0)}
            />
            {/* Center top */}
            <div />
            <MotorNode
              config={MOTOR_CONFIGS[1]}
              direction={directions[1]}
              finalThrottle={finalThrottles[1]}
              onToggleDir={() => onToggleDir(1)}
            />

            {/* Row 2 — body */}
            <div className="flex justify-end">
              {/* arm line */}
              <div className="h-px w-full bg-[#333] self-center" />
            </div>
            <div
              className="w-14 h-14 rounded-lg border border-[#333] mx-auto flex items-center justify-center text-xs text-[#8c8c8c] font-mono"
              style={{ backgroundColor: '#1a1a1a' }}
            >
              BODY
            </div>
            <div className="flex justify-start">
              <div className="h-px w-full bg-[#333] self-center" />
            </div>

            {/* Row 3 */}
            <MotorNode
              config={MOTOR_CONFIGS[2]}
              direction={directions[2]}
              finalThrottle={finalThrottles[2]}
              onToggleDir={() => onToggleDir(2)}
            />
            <div />
            <MotorNode
              config={MOTOR_CONFIGS[3]}
              direction={directions[3]}
              finalThrottle={finalThrottles[3]}
              onToggleDir={() => onToggleDir(3)}
            />
          </div>

          <div className="text-xs text-[#8c8c8c] mt-1">REAR</div>

          {/* Legend */}
          <div className="flex gap-4 mt-3 text-xs text-[#8c8c8c]">
            <div className="flex items-center gap-1">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-400" />
              CCW
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-purple-400" />
              CW
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-gray-600" />
              Idle
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-yellow-500" />
              Low
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-orange-500" />
              Mid
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500" />
              High
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MotorsPage() {
  const { telemetry, connected } = useTelemetry();

  // ── Safety gate state ──────────────────────────────────────────────────────
  const [safetyChecked, setSafetyChecked] = useState(false);
  const [testingEnabled, setTestingEnabled] = useState(false);

  // ── Motor controls state ───────────────────────────────────────────────────
  const [masterThrottle, setMasterThrottle] = useState(0);
  const [individualThrottles, setIndividualThrottles] = useState([100, 100, 100, 100]);
  const [directions, setDirections] = useState<SpinDirection[]>(['CCW', 'CW', 'CW', 'CCW']);

  // ── Simulated ESC telemetry ────────────────────────────────────────────────
  const [simData, setSimData] = useState<SimMotorData[]>([
    { rpm: 0, temp: 25, voltage: 16.8, current: 0.0, dshotErr: 0 },
    { rpm: 0, temp: 25, voltage: 16.8, current: 0.0, dshotErr: 0 },
    { rpm: 0, temp: 25, voltage: 16.8, current: 0.0, dshotErr: 0 },
    { rpm: 0, temp: 25, voltage: 16.8, current: 0.0, dshotErr: 0 },
  ]);

  // ── Config state ───────────────────────────────────────────────────────────
  const [motorProtocol, setMotorProtocol] = useState('DShot600');
  const [biDirDshot, setBiDirDshot] = useState(false);
  const [motorPoles, setMotorPoles] = useState(14);
  const [mixerType, setMixerType] = useState('Quad X');

  // Compute final throttles per motor
  const finalThrottles = individualThrottles.map((ind, i) =>
    testingEnabled ? computeFinalThrottle(masterThrottle, ind) : 0
  );

  const anyMotorActive = finalThrottles.some((t) => t > 0);

  // Safety guard: if somehow safety is disabled but master > 15%, cut to 0
  useEffect(() => {
    if (!testingEnabled && masterThrottle > 0) {
      setMasterThrottle(0);
    }
    if (!safetyChecked && masterThrottle > 15) {
      setMasterThrottle(0);
    }
  }, [testingEnabled, safetyChecked, masterThrottle]);

  // Simulation loop for ESC data
  const simIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (simIntervalRef.current) {
      clearInterval(simIntervalRef.current);
    }

    simIntervalRef.current = setInterval(() => {
      setSimData((prev) =>
        prev.map((d, i) => {
          const throttlePct = finalThrottles[i] ?? 0;

          // Use real telemetry motor values if available, else simulate
          const realMotorVal = telemetry?.motors?.[i];
          let rpm: number;
          if (realMotorVal !== undefined && connected) {
            // telemetry.motors is typically 1000-2000 range; normalize to RPM
            const normalized = clamp((realMotorVal - 1000) / 1000, 0, 1);
            rpm = Math.round(normalized * 12000 * (motorPoles / 14));
          } else {
            rpm = testingEnabled
              ? Math.round(throttlePct * 120) + Math.round((Math.random() - 0.5) * 60)
              : 0;
          }

          const temp = testingEnabled
            ? clamp(25 + throttlePct * 0.3 + (Math.random() - 0.5) * 0.5, 25, 120)
            : Math.max(25, d.temp - 0.05);

          const current = testingEnabled
            ? clamp(throttlePct * 0.18 + (Math.random() - 0.5) * 0.3, 0, 20)
            : 0;

          const voltage = clamp(
            16.8 - throttlePct * 0.005 + (Math.random() - 0.5) * 0.05,
            13.0,
            16.8
          );

          return {
            rpm: Math.max(0, rpm),
            temp: parseFloat(temp.toFixed(1)),
            voltage: parseFloat(voltage.toFixed(2)),
            current: parseFloat(current.toFixed(1)),
            dshotErr: 0,
          };
        })
      );
    }, 200);

    return () => {
      if (simIntervalRef.current) clearInterval(simIntervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testingEnabled, masterThrottle, individualThrottles, connected, telemetry, motorPoles]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  function handleEnableTesting() {
    if (safetyChecked) {
      setTestingEnabled(true);
    }
  }

  function handleDisableTesting() {
    setTestingEnabled(false);
    setMasterThrottle(0);
  }

  function handleToggleDir(idx: number) {
    setDirections((prev) =>
      prev.map((d, i) => (i === idx ? (d === 'CCW' ? 'CW' : 'CCW') : d))
    );
  }

  function handleIndividualThrottle(idx: number, val: number) {
    setIndividualThrottles((prev) => prev.map((v, i) => (i === idx ? val : v)));
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6 min-h-screen" style={{ backgroundColor: '#141414' }}>

      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#f2f2f2] flex items-center gap-2">
            <Zap className="w-7 h-7 text-[#ffbb00]" />
            Motors
          </h1>
          <p className="text-[#8c8c8c] mt-1">ESC output testing and motor diagnostics</p>
        </div>
        <div className="flex items-center gap-3">
          {anyMotorActive && testingEnabled && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-950/60 border border-red-700 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
              <span className="text-red-400 text-sm font-bold tracking-wider">ARMED</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            {connected ? (
              <Wifi className="w-4 h-4 text-[#96e212]" />
            ) : (
              <WifiOff className="w-4 h-4 text-[#8c8c8c]" />
            )}
            <span className="text-sm text-[#8c8c8c]">{connected ? 'Live' : 'Demo'}</span>
          </div>
        </div>
      </div>

      {/* ── Section 1: Safety Gate ──────────────────────────────────────── */}
      <div
        className="rounded-[4px] border-2 p-6"
        style={{
          borderColor: testingEnabled ? '#166534' : '#991b1b',
          backgroundColor: testingEnabled ? 'rgba(20, 83, 45, 0.12)' : 'rgba(69, 10, 10, 0.2)',
        }}
      >
        <div className="flex items-start gap-3 mb-5">
          <ShieldAlert
            className="w-6 h-6 mt-0.5 shrink-0"
            style={{ color: testingEnabled ? '#4ade80' : '#f87171' }}
          />
          <div>
            <h2
              className="text-lg font-bold tracking-wide"
              style={{ color: testingEnabled ? '#4ade80' : '#fca5a5' }}
            >
              {testingEnabled ? 'MOTOR TESTING ACTIVE — STAY CLEAR' : 'DANGER — PROPELLER SAFETY WARNING'}
            </h2>
            <p className="text-sm mt-1" style={{ color: testingEnabled ? '#86efac' : '#fca5a5' }}>
              {testingEnabled
                ? 'Motor outputs are live. Keep all persons and objects away from the drone.'
                : 'Motor testing can cause serious injury. Before proceeding:'}
            </p>
          </div>
        </div>

        {!testingEnabled && (
          <>
            <ul className="space-y-1.5 mb-5 ml-9">
              {[
                'Remove ALL propellers from ALL motors',
                'Ensure no one is near the drone',
                'Keep the drone on a stable surface',
                'Never test motors with battery voltage above idle',
              ].map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm text-red-300">
                  <span className="text-red-500 text-base leading-none">•</span>
                  {item}
                </li>
              ))}
            </ul>

            {/* Checkbox */}
            <label className="flex items-start gap-3 cursor-pointer mb-5 ml-9">
              <div className="relative mt-0.5">
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={safetyChecked}
                  onChange={(e) => setSafetyChecked(e.target.checked)}
                />
                <div
                  className="w-5 h-5 rounded border-2 flex items-center justify-center transition-colors duration-150"
                  style={{
                    borderColor: safetyChecked ? '#22c55e' : '#ef4444',
                    backgroundColor: safetyChecked ? '#14532d' : '#450a0a',
                  }}
                >
                  {safetyChecked && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                  )}
                </div>
              </div>
              <span
                className="text-sm select-none"
                style={{ color: safetyChecked ? '#4ade80' : '#fca5a5' }}
              >
                I confirm I have removed all propellers and the area is clear
              </span>
            </label>

            {/* Enable button */}
            <div className="ml-9">
              <Button
                onClick={handleEnableTesting}
                disabled={!safetyChecked}
                className="font-bold"
                style={
                  safetyChecked
                    ? {
                        backgroundColor: '#e2123f',
                        color: '#fff',
                        border: 'none',
                      }
                    : {
                        backgroundColor: '#333',
                        color: '#666',
                        border: '1px solid #444',
                        cursor: 'not-allowed',
                      }
                }
              >
                <ShieldAlert className="w-4 h-4 mr-1" />
                Enable Motor Testing
              </Button>
            </div>
          </>
        )}

        {testingEnabled && (
          <div className="ml-9">
            <Button
              onClick={handleDisableTesting}
              variant="outline"
              className="border-green-700 text-green-400 hover:bg-green-950/40"
            >
              <CheckCircle2 className="w-4 h-4 mr-1" />
              Disable Motor Testing
            </Button>
          </div>
        )}
      </div>

      {/* ── Section 2: Motor Testing Controls (gated) ───────────────────── */}
      {testingEnabled && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 2a. Quad Layout Diagram */}
            <QuadDiagram
              finalThrottles={finalThrottles}
              directions={directions}
              onToggleDir={handleToggleDir}
            />

            {/* 2b & 2c. Throttle Sliders */}
            <Card className="bg-[#1f1f1f] border-[#333]">
              <CardHeader className="pb-2">
                <CardTitle className="text-[#f2f2f2] flex items-center gap-2 text-base">
                  <Zap className="w-4 h-4 text-[#e2123f]" />
                  Throttle Controls
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">

                {/* Master throttle */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold tracking-widest text-[#8c8c8c] uppercase">
                      Master Throttle
                    </label>
                    <div className="flex items-center gap-2">
                      <span
                        className="text-2xl font-bold font-mono"
                        style={{ color: masterThrottle === 0 ? '#4b5563' : '#e2123f' }}
                      >
                        {masterThrottle}%
                      </span>
                      {masterThrottle > 0 && (
                        <span className="text-xs text-red-400 font-bold animate-pulse">LIVE</span>
                      )}
                    </div>
                  </div>
                  <div className="relative">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={masterThrottle}
                      onChange={(e) => setMasterThrottle(Number(e.target.value))}
                      className="w-full h-3 rounded-full appearance-none cursor-pointer"
                      style={{
                        accentColor: '#e2123f',
                        background: `linear-gradient(to right, #e2123f ${masterThrottle}%, #333 ${masterThrottle}%)`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-[#8c8c8c]">
                    <span>Idle (0%)</span>
                    <span>Full (100%)</span>
                  </div>
                </div>

                <div className="border-t border-[#333]" />

                {/* Individual motor sliders */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold tracking-widest text-[#8c8c8c] uppercase">
                      Individual Motors
                    </span>
                    <button
                      className="text-xs text-[#ffbb00] hover:underline"
                      onClick={() => setIndividualThrottles([100, 100, 100, 100])}
                    >
                      Reset All to 100%
                    </button>
                  </div>

                  {MOTOR_CONFIGS.map((motor, idx) => {
                    const indVal = individualThrottles[idx];
                    const final = finalThrottles[idx];
                    const sliderColor =
                      indVal === 0
                        ? '#4b5563'
                        : final > 65
                        ? '#ef4444'
                        : final > 30
                        ? '#f97316'
                        : '#eab308';

                    return (
                      <div key={motor.id} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[#f2f2f2] font-mono font-semibold">
                            {motor.label}{' '}
                            <span className="text-[#8c8c8c]">
                              ({directions[idx]})
                            </span>
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-[#8c8c8c]">
                              Ind: {indVal}% &rarr;
                            </span>
                            <span className="font-mono font-bold" style={{ color: sliderColor }}>
                              Final: {final.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={1}
                          value={indVal}
                          onChange={(e) => handleIndividualThrottle(idx, Number(e.target.value))}
                          className="w-full h-2 rounded-full appearance-none cursor-pointer"
                          style={{
                            accentColor: sliderColor,
                            background: `linear-gradient(to right, ${sliderColor} ${indVal}%, #333 ${indVal}%)`,
                          }}
                        />
                      </div>
                    );
                  })}
                </div>

                {/* Safety indicator */}
                <div
                  className="rounded-[4px] px-3 py-2 text-xs text-center font-mono"
                  style={{
                    backgroundColor: anyMotorActive ? 'rgba(226,18,63,0.12)' : '#1a1a1a',
                    border: `1px solid ${anyMotorActive ? '#e2123f' : '#333'}`,
                    color: anyMotorActive ? '#f87171' : '#8c8c8c',
                  }}
                >
                  {anyMotorActive
                    ? `MOTORS ACTIVE — Max output: ${Math.max(...finalThrottles).toFixed(1)}%`
                    : 'All motors at idle'}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ── Section 3: Live Motor Data ───────────────────────────────────── */}
      <Card className="bg-[#1f1f1f] border-[#333]">
        <CardHeader className="pb-2">
          <CardTitle className="text-[#f2f2f2] flex items-center gap-2 text-base">
            <Zap className="w-4 h-4 text-[#ffbb00]" />
            Live Motor Data
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Table header */}
          <div className="grid grid-cols-7 gap-2 text-xs font-bold text-[#8c8c8c] uppercase tracking-wider border-b border-[#333] pb-2">
            <div>Motor</div>
            <div className="text-right">RPM</div>
            <div className="text-right">Temp</div>
            <div className="text-right">Voltage</div>
            <div className="text-right">Current</div>
            <div className="text-right">DShot Err</div>
            <div className="text-right">Status</div>
          </div>

          {/* Table rows */}
          {MOTOR_CONFIGS.map((motor, idx) => {
            const d = simData[idx];
            const finalPct = finalThrottles[idx];
            const rpmPct = (d.rpm / 12000) * 100;

            const dshotBadgeColor =
              d.dshotErr === 0
                ? 'bg-[#14532d] text-[#4ade80] border border-[#166534]'
                : d.dshotErr <= 1
                ? 'bg-yellow-950/60 text-yellow-400 border border-yellow-700'
                : 'bg-red-950/60 text-red-400 border border-red-700';

            return (
              <div
                key={motor.id}
                className="grid grid-cols-7 gap-2 items-center py-2 border-b border-[#2a2a2a] last:border-0"
              >
                {/* Motor ID */}
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full transition-all duration-200"
                    style={{
                      backgroundColor: throttleIndicatorColor(finalPct),
                      boxShadow:
                        finalPct > 0
                          ? `0 0 6px ${throttleIndicatorColor(finalPct)}80`
                          : 'none',
                    }}
                  />
                  <span className="font-mono font-bold text-[#f2f2f2] text-sm">
                    {motor.label}
                  </span>
                </div>

                {/* RPM */}
                <div className={`text-right font-mono text-sm ${rpmColor(rpmPct)}`}>
                  {d.rpm.toLocaleString()}
                </div>

                {/* Temp */}
                <div className={`text-right font-mono text-sm ${tempColor(d.temp)}`}>
                  {d.temp.toFixed(1)}°C
                </div>

                {/* Voltage */}
                <div className="text-right font-mono text-sm text-[#f2f2f2]">
                  {d.voltage.toFixed(2)}V
                </div>

                {/* Current */}
                <div className="text-right font-mono text-sm text-[#f2f2f2]">
                  {d.current.toFixed(1)}A
                </div>

                {/* DShot Error */}
                <div className="text-right font-mono text-sm text-[#8c8c8c]">
                  {d.dshotErr.toFixed(1)}%
                </div>

                {/* Status badge */}
                <div className="flex justify-end">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-mono font-semibold ${dshotBadgeColor}`}
                  >
                    {d.dshotErr === 0 ? 'OK' : d.dshotErr <= 1 ? 'WARN' : 'ERR'}
                  </span>
                </div>
              </div>
            );
          })}

          {/* Note */}
          <p className="text-xs text-[#8c8c8c] italic pt-1">
            <AlertTriangle className="w-3 h-3 inline mr-1 text-[#ffbb00]" />
            RPM values are simulated. Enable Bidirectional DShot on your ESCs for real-time RPM
            telemetry.
          </p>
        </CardContent>
      </Card>

      {/* ── Section 4: Configuration ─────────────────────────────────────── */}
      <Card className="bg-[#1f1f1f] border-[#333]">
        <CardHeader className="pb-2">
          <CardTitle className="text-[#f2f2f2] flex items-center gap-2 text-base">
            <Settings2 className="w-4 h-4 text-[#ffbb00]" />
            Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">

            {/* Motor Protocol */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#8c8c8c] uppercase tracking-wider block">
                Motor Protocol
              </label>
              <select
                value={motorProtocol}
                onChange={(e) => setMotorProtocol(e.target.value)}
                className="w-full rounded-[4px] border border-[#333] bg-[#242424] text-[#f2f2f2] px-3 py-2 text-sm focus:outline-none focus:border-[#ffbb00] transition-colors"
              >
                <option value="DShot150">DShot150</option>
                <option value="DShot300">DShot300</option>
                <option value="DShot600">DShot600</option>
                <option value="PWM">PWM</option>
              </select>
            </div>

            {/* Bidirectional DShot */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#8c8c8c] uppercase tracking-wider block">
                Bidirectional DShot
              </label>
              <div className="flex items-center gap-3 py-2">
                <button
                  onClick={() => setBiDirDshot((v) => !v)}
                  className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none"
                  style={{ backgroundColor: biDirDshot ? '#ffbb00' : '#333' }}
                  role="switch"
                  aria-checked={biDirDshot}
                >
                  <span
                    className="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg transform transition-transform duration-200"
                    style={{ transform: biDirDshot ? 'translateX(20px)' : 'translateX(0px)' }}
                  />
                </button>
                <span className="text-sm" style={{ color: biDirDshot ? '#ffbb00' : '#8c8c8c' }}>
                  {biDirDshot ? 'ON' : 'OFF'}
                </span>
              </div>
              {biDirDshot && (
                <p className="text-xs text-[#8c8c8c]">
                  Requires BLHeli32 / AM32 / Bluejay firmware
                </p>
              )}
            </div>

            {/* Motor Poles */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#8c8c8c] uppercase tracking-wider block">
                Motor Poles
              </label>
              <input
                type="number"
                min={2}
                max={42}
                step={2}
                value={motorPoles}
                onChange={(e) => setMotorPoles(clamp(Number(e.target.value), 2, 42))}
                className="w-full rounded-[4px] border border-[#333] bg-[#242424] text-[#f2f2f2] px-3 py-2 text-sm focus:outline-none focus:border-[#ffbb00] transition-colors"
              />
              <p className="text-xs text-[#8c8c8c]">
                eRPM &times; 2 / poles = mech. RPM
              </p>
            </div>

            {/* Mixer Type */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#8c8c8c] uppercase tracking-wider block">
                Mixer Type
              </label>
              <select
                value={mixerType}
                onChange={(e) => setMixerType(e.target.value)}
                className="w-full rounded-[4px] border border-[#333] bg-[#242424] text-[#f2f2f2] px-3 py-2 text-sm focus:outline-none focus:border-[#ffbb00] transition-colors"
              >
                <option value="Quad X">Quad X</option>
                <option value="Quad +">Quad +</option>
                <option value="Hex X">Hex X</option>
                <option value="Octo X">Octo X</option>
              </select>
            </div>
          </div>

          {/* Config summary */}
          <div className="mt-4 pt-4 border-t border-[#2a2a2a] flex flex-wrap gap-2">
            <Badge className="bg-[#242424] text-[#8c8c8c] border border-[#333] text-xs">
              {motorProtocol}
            </Badge>
            <Badge className="bg-[#242424] text-[#8c8c8c] border border-[#333] text-xs">
              {mixerType}
            </Badge>
            <Badge className="bg-[#242424] text-[#8c8c8c] border border-[#333] text-xs">
              {motorPoles} poles
            </Badge>
            {biDirDshot && (
              <Badge className="bg-[#ffbb00]/10 text-[#ffbb00] border border-[#ffbb00]/30 text-xs">
                Bidirectional DShot
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

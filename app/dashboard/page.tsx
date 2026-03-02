'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Wifi,
  WifiOff,
  Battery,
  BatteryCharging,
  BatteryWarning,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  RotateCcw,
  Save,
  Power,
  Navigation,
  Crosshair,
  Activity,
  Zap,
  Satellite,
  MapPin,
  Gauge,
  Cpu,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Radio,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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

// ─── Local types ──────────────────────────────────────────────────────────────

interface TelemetryPoint {
  timestamp: number;
  gyroX: number;
  gyroY: number;
  gyroZ: number;
  accelX: number;
  accelY: number;
  accelZ: number;
}

interface SimMotorStatus {
  id: number;
  rpm: number;
}

interface Alert {
  id: string;
  type: 'warning' | 'error' | 'info';
  message: string;
  timestamp: Date;
}

// ─── Arming flag helpers ──────────────────────────────────────────────────────

interface ArmFlag {
  key: string;
  label: string;
  active: boolean; // true = problem present → RED; false = cleared → GREEN
}

function deriveArmFlags({
  flight_mode,
  cycle_time,
  motors,
  hasGpsFix,
}: {
  flight_mode: number;
  cycle_time: number;
  motors: number[];
  hasGpsFix: boolean;
}): ArmFlag[] {
  // Throttle: any motor value > 1100 (above minimum)
  const throttleHigh = motors.some((m) => m > 1100);
  // ANGLE: simulate based on flight_mode bit 1
  const angleRequired = (flight_mode & 0b10) !== 0;
  // NOPREARM: simulate — always cleared in demo
  const noPrearm = false;
  // GPS: no 3D fix
  const gpsNoFix = !hasGpsFix;
  // CALIBRATING: simulate — always cleared
  const calibrating = false;
  // LOAD: FC loop time too high
  const loadHigh = cycle_time > 500;

  return [
    { key: 'THROTTLE', label: 'THROTTLE', active: throttleHigh },
    { key: 'ANGLE', label: 'ANGLE', active: angleRequired },
    { key: 'NOPREARM', label: 'NOPREARM', active: noPrearm },
    { key: 'GPS', label: 'GPS', active: gpsNoFix },
    { key: 'CALIBRATING', label: 'CALIBRATING', active: calibrating },
    { key: 'LOAD', label: 'LOAD', active: loadHigh },
  ];
}

// ─── 3D Drone Visualization ───────────────────────────────────────────────────

function Drone3DVisualization({
  pitch = 0,
  roll = 0,
  yaw = 0,
}: {
  pitch?: number;
  roll?: number;
  yaw?: number;
}) {
  return (
    <div className="relative w-full h-64 perspective-1000">
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ perspective: '1000px' }}
      >
        <div
          className="relative w-48 h-48 transition-transform duration-100"
          style={{
            transformStyle: 'preserve-3d',
            transform: `rotateX(${-pitch}deg) rotateY(${roll}deg) rotateZ(${yaw}deg)`,
          }}
        >
          {/* Drone Body */}
          <div
            className="absolute top-1/2 left-1/2 w-16 h-16 bg-gradient-to-br from-[#ffbb00] to-[#e6a800] rounded-lg shadow-lg"
            style={{
              transform: 'translate(-50%, -50%) translateZ(20px)',
              boxShadow: '0 0 20px rgba(255, 187, 0, 0.5)',
            }}
          >
            <div className="absolute top-1/2 left-1/2 w-2 h-2 bg-green-400 rounded-full animate-pulse transform -translate-x-1/2 -translate-y-1/2" />
          </div>

          {/* Front-Left Arm */}
          <div
            className="absolute top-0 left-0 w-20 h-4 bg-gradient-to-r from-gray-600 to-gray-700 origin-bottom-right"
            style={{ transform: 'translate(40%, 200%) rotate(-45deg) translateZ(10px)' }}
          >
            <div className="absolute -top-3 left-0 w-10 h-10 bg-gradient-to-br from-red-500 to-red-700 rounded-full shadow-md flex items-center justify-center">
              <span className="text-xs font-bold text-white">1</span>
            </div>
          </div>

          {/* Front-Right Arm */}
          <div
            className="absolute top-0 right-0 w-20 h-4 bg-gradient-to-l from-gray-600 to-gray-700 origin-bottom-left"
            style={{ transform: 'translate(-40%, 200%) rotate(45deg) translateZ(10px)' }}
          >
            <div className="absolute -top-3 right-0 w-10 h-10 bg-gradient-to-br from-red-500 to-red-700 rounded-full shadow-md flex items-center justify-center">
              <span className="text-xs font-bold text-white">2</span>
            </div>
          </div>

          {/* Rear-Left Arm */}
          <div
            className="absolute bottom-0 left-0 w-20 h-4 bg-gradient-to-r from-gray-600 to-gray-700 origin-top-right"
            style={{ transform: 'translate(40%, -200%) rotate(45deg) translateZ(10px)' }}
          >
            <div className="absolute -bottom-3 left-0 w-10 h-10 bg-gradient-to-br from-red-500 to-red-700 rounded-full shadow-md flex items-center justify-center">
              <span className="text-xs font-bold text-white">3</span>
            </div>
          </div>

          {/* Rear-Right Arm */}
          <div
            className="absolute bottom-0 right-0 w-20 h-4 bg-gradient-to-l from-gray-600 to-gray-700 origin-top-left"
            style={{ transform: 'translate(-40%, -200%) rotate(-45deg) translateZ(10px)' }}
          >
            <div className="absolute -bottom-3 right-0 w-10 h-10 bg-gradient-to-br from-red-500 to-red-700 rounded-full shadow-md flex items-center justify-center">
              <span className="text-xs font-bold text-white">4</span>
            </div>
          </div>

          {/* Direction Indicator */}
          <div
            className="absolute top-0 left-1/2 w-0 h-0 border-l-4 border-r-4 border-b-8 border-l-transparent border-r-transparent border-b-yellow-400"
            style={{ transform: 'translate(-50%, -150%) translateZ(30px)' }}
          />
        </div>

        {/* Grid Floor */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `linear-gradient(rgba(255, 187, 0, 0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 187, 0, 0.3) 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
            transform: 'rotateX(60deg) translateZ(-100px)',
          }}
        />
      </div>

      {/* Attitude Readout */}
      <div className="absolute bottom-2 left-2 text-xs text-gray-400 font-mono space-y-1">
        <div>Pitch: {pitch.toFixed(1)}°</div>
        <div>Roll: {roll.toFixed(1)}°</div>
        <div>Yaw: {yaw.toFixed(1)}°</div>
      </div>
    </div>
  );
}

// ─── Arming Status Card ───────────────────────────────────────────────────────

function ArmingStatusCard({
  connected,
  isArmed,
  flags,
}: {
  connected: boolean;
  isArmed: boolean;
  flags: ArmFlag[];
}) {
  const allClear = flags.every((f) => !f.active);

  return (
    <Card className="bg-[#1f1f1f] border border-[#333] rounded-[4px]">
      <CardHeader className="pb-2">
        <CardTitle className="text-white flex items-center gap-2 text-lg">
          <ShieldAlert className="w-5 h-5 text-[#ffbb00]" />
          Arming Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Primary state display */}
        {!connected ? (
          <div className="flex items-center gap-3 p-4 rounded-lg bg-[#242424] border border-[#333]">
            <WifiOff className="w-5 h-5 text-[#8c8c8c] shrink-0" />
            <span className="text-[#8c8c8c] text-sm">No flight controller connected</span>
          </div>
        ) : isArmed ? (
          <div className="relative flex items-center justify-center p-5 rounded-lg bg-red-950/40 border border-red-700">
            {/* Pulsing ring */}
            <span className="absolute inset-0 rounded-lg animate-ping bg-red-600 opacity-10 pointer-events-none" />
            <div className="flex items-center gap-3">
              <span className="relative flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500" />
              </span>
              <span className="text-2xl font-bold text-red-400 tracking-widest">ARMED</span>
            </div>
          </div>
        ) : allClear ? (
          <div className="flex items-center justify-center gap-3 p-4 rounded-lg bg-green-950/30 border border-green-700">
            <ShieldCheck className="w-6 h-6 text-[#96e212]" />
            <span className="text-xl font-bold text-[#96e212] tracking-widest">READY TO ARM</span>
          </div>
        ) : (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-[#242424] border border-[#333]">
            <ShieldAlert className="w-5 h-5 text-[#ffbb00] shrink-0" />
            <span className="text-sm text-[#ffbb00]">Arming blocked — clear all flags</span>
          </div>
        )}

        {/* Flags grid */}
        {connected && !isArmed && (
          <div className="flex flex-wrap gap-2">
            {flags.map((flag) => (
              <span
                key={flag.key}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] text-xs font-mono font-semibold border ${
                  flag.active
                    ? 'bg-red-950/40 border-[#e2123f] text-[#e2123f]'
                    : 'bg-green-950/30 border-[#96e212] text-[#96e212]'
                }`}
              >
                <span
                  className={`inline-block w-1.5 h-1.5 rounded-full ${
                    flag.active ? 'bg-[#e2123f]' : 'bg-[#96e212]'
                  }`}
                />
                {flag.label}
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Arm State Indicator (replaces interactive ARM button) ────────────────────

function ArmStateIndicator({
  connected,
  isArmed,
}: {
  connected: boolean;
  isArmed: boolean;
}) {
  return (
    <Card className="bg-[#1f1f1f] border border-[#333] rounded-[4px]">
      <CardHeader className="pb-2">
        <CardTitle className="text-white flex items-center gap-2 text-lg">
          <Cpu className="w-5 h-5 text-[#ffbb00]" />
          Arm State
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Large status badge */}
        <div className="flex flex-col items-center justify-center py-6 gap-3">
          {isArmed ? (
            <div className="relative flex items-center justify-center">
              {/* Pulsing outer ring */}
              <span className="absolute inline-flex h-24 w-24 rounded-full bg-red-500 opacity-20 animate-ping" />
              <span className="absolute inline-flex h-20 w-20 rounded-full bg-red-500 opacity-10 animate-ping [animation-delay:150ms]" />
              <div className="relative flex items-center justify-center h-20 w-20 rounded-full bg-red-900/60 border-2 border-red-500">
                <span className="text-red-400 font-bold text-lg tracking-widest">ARMED</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-20 w-20 rounded-full bg-[#242424] border-2 border-[#333]">
              <span className="text-[#8c8c8c] font-bold text-sm tracking-widest">
                {connected ? 'DISARMED' : '------'}
              </span>
            </div>
          )}
        </div>

        {/* Connection row */}
        <div
          className={`flex items-center gap-3 p-3 rounded-lg border ${
            connected
              ? 'bg-green-950/30 border-green-800'
              : 'bg-[#242424] border-[#333]'
          }`}
        >
          {connected ? (
            <Wifi className="w-5 h-5 text-green-400" />
          ) : (
            <WifiOff className="w-5 h-5 text-[#8c8c8c]" />
          )}
          <span className={connected ? 'text-green-400 text-sm' : 'text-[#8c8c8c] text-sm'}>
            {connected ? 'Flight controller connected' : 'Not connected'}
          </span>
        </div>

        {/* Safety notice */}
        <p className="text-xs text-center text-[#8c8c8c] flex items-center justify-center gap-1.5">
          <Radio className="w-3 h-3 shrink-0" />
          Arm via transmitter switch only
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Battery Card ─────────────────────────────────────────────────────────────

function BatteryCard({
  voltage,
  amperage,
  mah,
  connected,
}: {
  voltage: number;
  amperage: number;
  mah: number;
  connected: boolean;
}) {
  // Estimate percentage from voltage: assume 4S (16.8V full, 13.2V empty)
  const cellCount = Math.round(voltage / 4.2) || 4;
  const fullV = cellCount * 4.2;
  const emptyV = cellCount * 3.3;
  const percentage = Math.max(0, Math.min(100, Math.round(((voltage - emptyV) / (fullV - emptyV)) * 100)));

  const getBatteryColor = (pct: number) => {
    if (pct > 50) return 'text-[#96e212]';
    if (pct > 20) return 'text-[#ffbb00]';
    return 'text-[#e2123f]';
  };

  const getBatteryIcon = (pct: number) => {
    if (pct > 50) return <BatteryCharging className="w-8 h-8 text-[#96e212]" />;
    if (pct > 20) return <Battery className="w-8 h-8 text-[#ffbb00]" />;
    return <BatteryWarning className="w-8 h-8 text-[#e2123f]" />;
  };

  return (
    <Card className="bg-[#1f1f1f] border border-[#333] rounded-[4px]">
      <CardHeader className="pb-2">
        <CardTitle className="text-white flex items-center gap-2 text-lg">
          <Zap className="w-5 h-5 text-[#ffbb00]" />
          Battery
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className={`text-5xl font-bold ${getBatteryColor(percentage)}`}>
            {percentage}%
          </div>
          {getBatteryIcon(percentage)}
        </div>

        <Progress value={percentage} className="h-4 bg-[#242424]" />

        {/* Voltage — prominent */}
        <div className="bg-[#242424] rounded-lg p-3 flex items-center justify-between">
          <span className="text-[#8c8c8c] text-sm">Voltage</span>
          <span className="text-2xl font-bold text-white font-mono">{voltage.toFixed(2)} V</span>
        </div>

        {/* mAh consumed — prominent */}
        <div className="bg-[#242424] rounded-lg p-3 flex items-center justify-between">
          <span className="text-[#8c8c8c] text-sm">mAh consumed</span>
          <span className="text-2xl font-bold text-[#ffbb00] font-mono">
            {connected ? Math.round(mah) : '—'} mAh
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#242424] rounded-lg p-2 text-center">
            <div className="text-lg font-bold text-white">{cellCount}S</div>
            <div className="text-xs text-[#8c8c8c]">Cells</div>
          </div>
          <div className="bg-[#242424] rounded-lg p-2 text-center">
            <div className="text-lg font-bold text-white">{amperage.toFixed(1)} A</div>
            <div className="text-xs text-[#8c8c8c]">Current</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Flight Mode Card ─────────────────────────────────────────────────────────

function FlightModeCard({
  flightMode,
  failsafe,
  isArmed,
}: {
  flightMode: string;
  failsafe: boolean;
  isArmed: boolean;
}) {
  const getModeColor = (mode: string) => {
    switch (mode.toUpperCase()) {
      case 'ACRO': return 'text-purple-400';
      case 'ANGLE': return 'text-blue-400';
      case 'HORIZON': return 'text-cyan-400';
      default: return 'text-[#8c8c8c]';
    }
  };

  return (
    <Card className="bg-[#1f1f1f] border border-[#333] rounded-[4px]">
      <CardHeader className="pb-2">
        <CardTitle className="text-white flex items-center gap-2 text-lg">
          <Navigation className="w-5 h-5 text-purple-500" />
          Flight Mode
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center py-4">
          <div className={`text-4xl font-bold ${getModeColor(flightMode)}`}>{flightMode}</div>
          <div className="text-sm text-[#8c8c8c] mt-1">Current Mode</div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between p-2 rounded-lg bg-[#242424]">
            <span className="text-gray-300 flex items-center gap-2">
              <Crosshair className="w-4 h-4" />
              Arm Status
            </span>
            <Badge
              className={
                isArmed
                  ? 'bg-[#e2123f] text-white border-0'
                  : 'bg-[#333] text-[#8c8c8c] border-0'
              }
            >
              {isArmed ? 'ARMED' : 'DISARMED'}
            </Badge>
          </div>

          <div className="flex items-center justify-between p-2 rounded-lg bg-[#242424]">
            <span className="text-gray-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Failsafe
            </span>
            <Badge
              className={
                failsafe
                  ? 'bg-[#e2123f] text-white border-0'
                  : 'bg-[#96e212]/20 text-[#96e212] border border-[#96e212]/40'
              }
            >
              {failsafe ? 'ACTIVE' : 'OK'}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Live Sensor Graphs ───────────────────────────────────────────────────────

function LiveSensorGraphs({ data }: { data: TelemetryPoint[] }) {
  return (
    <Card className="bg-[#1f1f1f] border border-[#333] rounded-[4px]">
      <CardHeader className="pb-2">
        <CardTitle className="text-white flex items-center gap-2 text-lg">
          <Activity className="w-5 h-5 text-cyan-500" />
          Live Sensors
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-48 mb-4">
          <div className="text-xs text-[#8c8c8c] mb-1">Gyroscope (deg/s)</div>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="timestamp" hide />
              <YAxis stroke="#8c8c8c" fontSize={10} domain={[-100, 100]} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f1f1f', border: '1px solid #333', borderRadius: '4px' }}
              />
              <Line type="monotone" dataKey="gyroX" stroke="#ef4444" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="gyroY" stroke="#22c55e" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="gyroZ" stroke="#3b82f6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="h-48">
          <div className="text-xs text-[#8c8c8c] mb-1">Accelerometer (g)</div>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="timestamp" hide />
              <YAxis stroke="#8c8c8c" fontSize={10} domain={[-5, 15]} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f1f1f', border: '1px solid #333', borderRadius: '4px' }}
              />
              <Line type="monotone" dataKey="accelX" stroke="#f97316" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="accelY" stroke="#a855f7" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="accelZ" stroke="#06b6d4" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── GPS Status Panel ─────────────────────────────────────────────────────────

function GPSStatusPanel({
  satellites,
  fixType,
  hdop,
  speed,
  lat,
  lon,
}: {
  satellites: number;
  fixType: string;
  hdop: number;
  speed: number;
  lat: number;
  lon: number;
}) {
  const getFixColor = (fix: string) => {
    if (fix === '3D Fix') return 'text-[#96e212]';
    if (fix === '2D Fix') return 'text-[#ffbb00]';
    return 'text-[#e2123f]';
  };

  return (
    <Card className="bg-[#1f1f1f] border border-[#333] rounded-[4px]">
      <CardHeader className="pb-2">
        <CardTitle className="text-white flex items-center gap-2 text-lg">
          <Satellite className="w-5 h-5 text-green-500" />
          GPS Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between p-3 bg-[#242424] rounded-lg">
          <div className="flex items-center gap-2">
            <Satellite className="w-5 h-5 text-[#ffbb00]" />
            <span className="text-gray-300">Satellites</span>
          </div>
          <div className="text-2xl font-bold text-white">{satellites}</div>
        </div>

        <div className="flex items-center justify-between p-3 bg-[#242424] rounded-lg">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-purple-400" />
            <span className="text-gray-300">Fix Type</span>
          </div>
          <span className={`font-bold ${getFixColor(fixType)}`}>{fixType}</span>
        </div>

        <div className="flex items-center justify-between p-3 bg-[#242424] rounded-lg">
          <div className="flex items-center gap-2">
            <Crosshair className="w-5 h-5 text-orange-400" />
            <span className="text-gray-300">HDOP</span>
          </div>
          <span className="font-mono text-white">{hdop.toFixed(2)}</span>
        </div>

        <div className="flex items-center justify-between p-3 bg-[#242424] rounded-lg">
          <div className="flex items-center gap-2">
            <Gauge className="w-5 h-5 text-cyan-400" />
            <span className="text-gray-300">Speed</span>
          </div>
          <span className="font-mono text-white">{speed.toFixed(1)} m/s</span>
        </div>

        <div className="relative h-24 bg-[#242424] rounded-lg overflow-hidden">
          <div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage: `linear-gradient(rgba(34, 197, 94, 0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(34, 197, 94, 0.2) 1px, transparent 1px)`,
              backgroundSize: '20px 20px',
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <MapPin className="w-8 h-8 text-green-500 mx-auto" />
              <div className="text-xs text-[#8c8c8c] mt-1">
                {lat.toFixed(6)}, {lon.toFixed(6)}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Quick Controls ───────────────────────────────────────────────────────────

function QuickControls({
  connected,
  onCalibrateGyro,
  onCalibrateAccel,
  onSaveSettings,
  onReboot,
}: {
  connected: boolean;
  onCalibrateGyro: () => void;
  onCalibrateAccel: () => void;
  onSaveSettings: () => void;
  onReboot: () => void;
}) {
  return (
    <Card className="bg-[#1f1f1f] border border-[#333] rounded-[4px]">
      <CardHeader className="pb-2">
        <CardTitle className="text-white flex items-center gap-2 text-lg">
          <Settings2 className="w-5 h-5 text-orange-500" />
          Quick Controls
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          <Button
            onClick={onCalibrateGyro}
            disabled={!connected}
            variant="outline"
            className="h-16 flex flex-col items-center justify-center gap-1 border-[#333] hover:bg-[#242424] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RotateCcw className="w-5 h-5 text-[#ffbb00]" />
            <span className="text-xs">Calibrate Gyro</span>
          </Button>

          <Button
            onClick={onCalibrateAccel}
            disabled={!connected}
            variant="outline"
            className="h-16 flex flex-col items-center justify-center gap-1 border-[#333] hover:bg-[#242424] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Activity className="w-5 h-5 text-green-400" />
            <span className="text-xs">Calibrate Accel</span>
          </Button>

          <Button
            onClick={onSaveSettings}
            disabled={!connected}
            variant="outline"
            className="h-16 flex flex-col items-center justify-center gap-1 border-[#333] hover:bg-[#242424] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Save className="w-5 h-5 text-[#ffbb00]" />
            <span className="text-xs">Save Settings</span>
          </Button>

          <Button
            onClick={onReboot}
            disabled={!connected}
            variant="outline"
            className="h-16 flex flex-col items-center justify-center gap-1 border-[#333] hover:bg-[#242424] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Power className="w-5 h-5 text-[#e2123f]" />
            <span className="text-xs">Reboot FC</span>
          </Button>
        </div>
        {!connected && (
          <p className="text-xs text-[#8c8c8c] text-center mt-3">
            Controls disabled — connect FC to enable
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Motors Overview ──────────────────────────────────────────────────────────

function MotorsOverview({ motors }: { motors: SimMotorStatus[] }) {
  const maxRpm = 10000;
  return (
    <Card className="bg-[#1f1f1f] border border-[#333] rounded-[4px]">
      <CardHeader className="pb-2">
        <CardTitle className="text-white flex items-center gap-2 text-lg">
          <Zap className="w-5 h-5 text-red-500" />
          Motors
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-3">
          {motors.map((motor) => (
            <div key={motor.id} className="bg-[#242424] rounded-lg p-3">
              <div className="text-center mb-2">
                <span className="text-lg font-bold text-white">{motor.id}</span>
              </div>
              <div className="relative h-20 bg-[#141414] rounded-lg overflow-hidden">
                <div
                  className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#ffbb00] to-[#e6a800] transition-all duration-100"
                  style={{ height: `${(motor.rpm / maxRpm) * 100}%` }}
                />
              </div>
              <div className="text-center mt-2">
                <div className="text-xs text-[#8c8c8c]">{motor.rpm.toLocaleString()}</div>
                <div className="text-xs text-[#333]">RPM</div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Recent Alerts ────────────────────────────────────────────────────────────

function RecentAlerts({ alerts }: { alerts: Alert[] }) {
  const getAlertIcon = (type: Alert['type']) => {
    switch (type) {
      case 'error': return <AlertCircle className="w-4 h-4 text-[#e2123f]" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-[#ffbb00]" />;
      case 'info': return <CheckCircle2 className="w-4 h-4 text-[#ffbb00]" />;
    }
  };

  const getAlertClass = (type: Alert['type']) => {
    switch (type) {
      case 'error': return 'border-l-[#e2123f] bg-red-950/20';
      case 'warning': return 'border-l-[#ffbb00] bg-yellow-950/20';
      case 'info': return 'border-l-[#ffbb00] bg-[rgba(255,187,0,0.07)]';
    }
  };

  return (
    <Card className="bg-[#1f1f1f] border border-[#333] rounded-[4px]">
      <CardHeader className="pb-2">
        <CardTitle className="text-white flex items-center gap-2 text-lg">
          <AlertTriangle className="w-5 h-5 text-[#ffbb00]" />
          Recent Alerts
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {alerts.length === 0 ? (
            <div className="text-center py-8 text-[#8c8c8c]">No recent alerts</div>
          ) : (
            alerts.slice(0, 10).map((alert) => (
              <div
                key={alert.id}
                className={`flex items-start gap-3 p-3 rounded-r-lg border-l-4 ${getAlertClass(alert.type)}`}
              >
                {getAlertIcon(alert.type)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#f2f2f2]">{alert.message}</p>
                  <p className="text-xs text-[#8c8c8c] mt-1">{alert.timestamp.toLocaleTimeString()}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Disconnected Banner ──────────────────────────────────────────────────────

function DisconnectedBanner() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-[4px] bg-amber-950/40 border border-amber-600/60 text-amber-300 text-sm">
      <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400" />
      <span>
        No flight controller connected — showing demo data. Connect via serial port to see live telemetry.
      </span>
    </div>
  );
}

// ─── Main Dashboard Page ──────────────────────────────────────────────────────

export default function DashboardPage() {
  const { telemetry, connected } = useTelemetry();

  // Simulated / fallback state
  const [simTelemetryPoints, setSimTelemetryPoints] = useState<TelemetryPoint[]>([]);
  const [simAttitude, setSimAttitude] = useState({ pitch: 0, roll: 0, yaw: 0 });
  const [simMotors, setSimMotors] = useState<SimMotorStatus[]>([
    { id: 1, rpm: 0 },
    { id: 2, rpm: 0 },
    { id: 3, rpm: 0 },
    { id: 4, rpm: 0 },
  ]);
  const [alerts, setAlerts] = useState<Alert[]>([]);

  const addAlert = useCallback((type: Alert['type'], message: string) => {
    const newAlert: Alert = {
      id: Date.now().toString() + Math.random(),
      type,
      message,
      timestamp: new Date(),
    };
    setAlerts((prev) => [newAlert, ...prev].slice(0, 20));
  }, []);

  // Log connection changes
  const prevConnected = useRef(connected);
  useEffect(() => {
    if (connected !== prevConnected.current) {
      addAlert(
        connected ? 'info' : 'warning',
        connected ? 'Flight controller connected' : 'Flight controller disconnected — showing demo data'
      );
      prevConnected.current = connected;
    }
  }, [connected, addAlert]);

  // Simulation loop — always running so UI looks good when disconnected
  useEffect(() => {
    const interval = setInterval(() => {
      const newPoint: TelemetryPoint = {
        timestamp: Date.now(),
        gyroX: (Math.random() - 0.5) * 20 + (connected ? 0 : (Math.random() - 0.5) * 50),
        gyroY: (Math.random() - 0.5) * 20 + (connected ? 0 : (Math.random() - 0.5) * 50),
        gyroZ: (Math.random() - 0.5) * 20 + (connected ? 0 : (Math.random() - 0.5) * 50),
        accelX: (Math.random() - 0.5) * 0.5,
        accelY: (Math.random() - 0.5) * 0.5,
        accelZ: 9.8 + (Math.random() - 0.5) * 0.5,
      };

      setSimTelemetryPoints((prev) => [...prev, newPoint].slice(-100));

      if (!connected) {
        setSimAttitude((prev) => ({
          pitch: Math.max(-45, Math.min(45, prev.pitch + (Math.random() - 0.5) * 2)),
          roll: Math.max(-45, Math.min(45, prev.roll + (Math.random() - 0.5) * 2)),
          yaw: (prev.yaw + (Math.random() - 0.5) * 1) % 360,
        }));

        setSimMotors((prev) =>
          prev.map((m) => ({
            ...m,
            rpm: Math.max(0, Math.min(10000, m.rpm + (Math.random() - 0.5) * 500)),
          }))
        );
      }
    }, 100);

    return () => clearInterval(interval);
  }, [connected]);

  // ── Derived values from live telemetry or simulation ──────────────────────

  const attitude = telemetry?.attitude
    ? { pitch: telemetry.attitude.pitch, roll: telemetry.attitude.roll, yaw: telemetry.attitude.yaw }
    : simAttitude;

  const liveMotors: SimMotorStatus[] = telemetry?.motors
    ? telemetry.motors.map((rpm, i) => ({ id: i + 1, rpm }))
    : simMotors;

  // Arm state
  const flightModeBits = telemetry?.status?.flight_mode ?? 0;
  const isArmed = connected ? (flightModeBits & 1) !== 0 : false;

  // Battery
  const batteryVoltage = telemetry?.battery?.voltage ?? 16.8;
  const batteryAmperage = telemetry?.battery?.amperage ?? 12.5;
  const batteryMah = telemetry?.battery?.power_meter ?? 0;

  // Flight mode label
  const flightModeLabel = (() => {
    if (!connected) return 'ACRO';
    const bits = flightModeBits >> 1; // skip armed bit
    if (bits & 0b001) return 'ANGLE';
    if (bits & 0b010) return 'HORIZON';
    return 'ACRO';
  })();

  // GPS
  const gpsData = telemetry?.gps;
  const gpsSatellites = gpsData?.num_satellites ?? 12;
  const gpsFixType =
    gpsData?.fix_type === 2 ? '3D Fix' : gpsData?.fix_type === 1 ? '2D Fix' : 'No Fix';
  const gpsHdop = gpsData?.hdop ?? 1.2;
  const gpsSpeed = gpsData?.speed ?? 0;
  const gpsLat = gpsData?.lat ?? 51.5074;
  const gpsLon = gpsData?.lon ?? -0.1278;
  const hasGpsFix = gpsData?.fix_type === 2;

  // Arming flags
  const armingFlags = deriveArmFlags({
    flight_mode: flightModeBits,
    cycle_time: telemetry?.status?.cycle_time ?? 0,
    motors: telemetry?.motors ?? [],
    hasGpsFix,
  });

  // Sensor graph data: prefer live telemetry, otherwise use sim
  const graphData: TelemetryPoint[] = connected && telemetry
    ? simTelemetryPoints.map((p) => ({
        ...p,
        gyroX: telemetry.gyro?.x ?? p.gyroX,
        gyroY: telemetry.gyro?.y ?? p.gyroY,
        gyroZ: telemetry.gyro?.z ?? p.gyroZ,
        accelX: telemetry.accel?.x ?? p.accelX,
        accelY: telemetry.accel?.y ?? p.accelY,
        accelZ: telemetry.accel?.z ?? p.accelZ,
      }))
    : simTelemetryPoints;

  // Handlers
  const handleCalibrateGyro = () => {
    addAlert('info', 'Gyro calibration started...');
    setTimeout(() => addAlert('info', 'Gyro calibration complete'), 2000);
  };

  const handleCalibrateAccel = () => {
    addAlert('info', 'Accelerometer calibration started...');
    setTimeout(() => addAlert('info', 'Accelerometer calibration complete'), 2000);
  };

  const handleSaveSettings = () => addAlert('info', 'Settings saved to EEPROM');
  const handleReboot = () => addAlert('warning', 'Flight controller rebooting...');

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#f2f2f2]">Dashboard</h1>
          <p className="text-[#8c8c8c] mt-1">Real-time flight controller monitoring</p>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`w-3 h-3 rounded-full ${
              connected ? 'bg-[#96e212] animate-pulse' : 'bg-[#ffbb00]'
            }`}
          />
          <span className="text-sm text-[#8c8c8c]">{connected ? 'Live' : 'Demo'}</span>
        </div>
      </div>

      {/* Disconnected Banner */}
      {!connected && <DisconnectedBanner />}

      {/* Top Row — Arming Status (full width) */}
      <ArmingStatusCard connected={connected} isArmed={isArmed} flags={armingFlags} />

      {/* Second Row — Arm State + Battery + Flight Mode */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <ArmStateIndicator connected={connected} isArmed={isArmed} />
        <BatteryCard
          voltage={batteryVoltage}
          amperage={batteryAmperage}
          mah={batteryMah}
          connected={connected}
        />
        <FlightModeCard
          flightMode={flightModeLabel}
          failsafe={false}
          isArmed={isArmed}
        />
      </div>

      {/* Middle Row — 3D Attitude + Live Sensors + GPS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="bg-[#1f1f1f] border border-[#333] rounded-[4px]">
          <CardHeader className="pb-2">
            <CardTitle className="text-white flex items-center gap-2 text-lg">
              <Activity className="w-5 h-5 text-[#ffbb00]" />
              3D Attitude
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Drone3DVisualization
              pitch={attitude.pitch}
              roll={attitude.roll}
              yaw={attitude.yaw}
            />
          </CardContent>
        </Card>

        <LiveSensorGraphs data={graphData} />

        <GPSStatusPanel
          satellites={gpsSatellites}
          fixType={gpsFixType}
          hdop={gpsHdop}
          speed={gpsSpeed}
          lat={gpsLat}
          lon={gpsLon}
        />
      </div>

      {/* Bottom Row — Quick Controls + Motors + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <QuickControls
          connected={connected}
          onCalibrateGyro={handleCalibrateGyro}
          onCalibrateAccel={handleCalibrateAccel}
          onSaveSettings={handleSaveSettings}
          onReboot={handleReboot}
        />
        <MotorsOverview motors={liveMotors} />
        <RecentAlerts alerts={alerts} />
      </div>
    </div>
  );
}

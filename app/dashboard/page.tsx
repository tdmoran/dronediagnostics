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
  Play,
  Square
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
  ResponsiveContainer 
} from 'recharts';

// Types
interface TelemetryPoint {
  timestamp: number;
  gyroX: number;
  gyroY: number;
  gyroZ: number;
  accelX: number;
  accelY: number;
  accelZ: number;
}

interface DroneStatus {
  connected: boolean;
  armed: boolean;
  fcName: string;
  target: string;
  firmwareVersion: string;
  flightMode: string;
  failsafe: boolean;
}

interface BatteryStatus {
  percentage: number;
  voltage: number;
  cellCount: number;
  current: number;
}

interface GPSStatus {
  satellites: number;
  totalSatellites: number;
  fixType: 'No Fix' | '2D Fix' | '3D Fix';
  hdop: number;
  speed: number;
  lat: number;
  lon: number;
}

interface MotorStatus {
  id: number;
  rpm: number;
}

interface Alert {
  id: string;
  type: 'warning' | 'error' | 'info';
  message: string;
  timestamp: Date;
}


// 3D Drone Visualization Component
function Drone3DVisualization({ 
  pitch = 0, 
  roll = 0, 
  yaw = 0 
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
          {/* Drone Body (Center) */}
          <div 
            className="absolute top-1/2 left-1/2 w-16 h-16 bg-gradient-to-br from-[#ffbb00] to-[#e6a800] rounded-lg shadow-lg"
            style={{
              transform: 'translate(-50%, -50%) translateZ(20px)',
              boxShadow: '0 0 20px rgba(255, 187, 0, 0.5)'
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


// Connection Status Card
function ConnectionStatusCard({ status, onArmToggle }: { status: DroneStatus; onArmToggle: () => void }) {
  return (
    <Card className="bg-[#1f1f1f] border-[#333]">
      <CardHeader className="pb-2">
        <CardTitle className="text-white flex items-center gap-2 text-lg">
          <Cpu className="w-5 h-5 text-[#ffbb00]" />
          Connection Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* ARM/DISARM Toggle */}
        <button
          onClick={onArmToggle}
          className={`w-full py-6 rounded-[4px] font-bold text-2xl transition-all duration-300 shadow-lg ${
            status.armed 
              ? 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white shadow-red-500/25' 
              : 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white shadow-green-500/25'
          }`}
        >
          <div className="flex items-center justify-center gap-3">
            {status.armed ? (
              <><Square className="w-8 h-8" /> DISARM</>
            ) : (
              <><Play className="w-8 h-8" /> ARM</>
            )}
          </div>
        </button>

        {/* Connection State */}
        <div className={`flex items-center gap-3 p-3 rounded-lg border ${
          status.connected ? 'bg-green-950/30 border-green-800' : 'bg-red-950/30 border-red-800'
        }`}>
          {status.connected ? (
            <Wifi className="w-5 h-5 text-green-400" />
          ) : (
            <WifiOff className="w-5 h-5 text-red-400" />
          )}
          <span className={status.connected ? 'text-green-400' : 'text-red-400'}>
            {status.connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>

        {/* FC Info */}
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">FC Name</span>
            <span className="text-white font-mono">{status.fcName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Target</span>
            <span className="text-white font-mono">{status.target}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Firmware</span>
            <span className="text-[#ffbb00] font-mono">{status.firmwareVersion}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Battery Card
function BatteryCard({ battery }: { battery: BatteryStatus }) {
  const getBatteryColor = (percentage: number) => {
    if (percentage > 50) return 'text-green-400';
    if (percentage > 20) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getBatteryIcon = (percentage: number) => {
    if (percentage > 50) return <BatteryCharging className="w-8 h-8 text-green-400" />;
    if (percentage > 20) return <Battery className="w-8 h-8 text-yellow-400" />;
    return <BatteryWarning className="w-8 h-8 text-red-400" />;
  };

  return (
    <Card className="bg-[#1f1f1f] border-[#333]">
      <CardHeader className="pb-2">
        <CardTitle className="text-white flex items-center gap-2 text-lg">
          <Zap className="w-5 h-5 text-yellow-500" />
          Battery
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className={`text-5xl font-bold ${getBatteryColor(battery.percentage)}`}>
            {battery.percentage}%
          </div>
          {getBatteryIcon(battery.percentage)}
        </div>

        <div className="relative">
          <Progress value={battery.percentage} className="h-4 bg-[#242424]" />
        </div>

        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="bg-[#242424] rounded-lg p-2">
            <div className="text-xl font-bold text-white">{battery.voltage.toFixed(1)}V</div>
            <div className="text-xs text-gray-400">Voltage</div>
          </div>
          <div className="bg-[#242424] rounded-lg p-2">
            <div className="text-xl font-bold text-white">{battery.cellCount}S</div>
            <div className="text-xs text-gray-400">Cells</div>
          </div>
          <div className="bg-[#242424] rounded-lg p-2">
            <div className="text-xl font-bold text-white">{battery.current.toFixed(1)}A</div>
            <div className="text-xs text-gray-400">Current</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}


// Flight Mode Card
function FlightModeCard({ status }: { status: DroneStatus }) {
  const getModeColor = (mode: string) => {
    switch (mode.toUpperCase()) {
      case 'ACRO': return 'text-purple-400';
      case 'ANGLE': return 'text-blue-400';
      case 'HORIZON': return 'text-cyan-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <Card className="bg-[#1f1f1f] border-[#333]">
      <CardHeader className="pb-2">
        <CardTitle className="text-white flex items-center gap-2 text-lg">
          <Navigation className="w-5 h-5 text-purple-500" />
          Flight Mode
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center py-4">
          <div className={`text-4xl font-bold ${getModeColor(status.flightMode)}`}>
            {status.flightMode}
          </div>
          <div className="text-sm text-gray-400 mt-1">Current Mode</div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between p-2 rounded-lg bg-[#242424]">
            <span className="text-gray-300 flex items-center gap-2">
              <Crosshair className="w-4 h-4" />
              Arming Status
            </span>
            <Badge variant={status.armed ? 'default' : 'secondary'} className={status.armed ? 'bg-green-600' : 'bg-gray-600'}>
              {status.armed ? 'ARMED' : 'DISARMED'}
            </Badge>
          </div>

          <div className="flex items-center justify-between p-2 rounded-lg bg-[#242424]">
            <span className="text-gray-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Failsafe
            </span>
            <Badge variant={status.failsafe ? 'destructive' : 'default'} className={status.failsafe ? '' : 'bg-green-600'}>
              {status.failsafe ? 'ACTIVE' : 'OK'}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Live Sensor Graphs
function LiveSensorGraphs({ data }: { data: TelemetryPoint[] }) {
  return (
    <Card className="bg-[#1f1f1f] border-[#333]">
      <CardHeader className="pb-2">
        <CardTitle className="text-white flex items-center gap-2 text-lg">
          <Activity className="w-5 h-5 text-cyan-500" />
          Live Sensors
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-48 mb-4">
          <div className="text-xs text-gray-400 mb-1">Gyroscope (deg/s)</div>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333333" />
              <XAxis dataKey="timestamp" hide />
              <YAxis stroke="#9ca3af" fontSize={10} domain={[-100, 100]} />
              <Tooltip contentStyle={{ backgroundColor: '#1f1f1f', border: '1px solid #333333', borderRadius: '4px' }} />
              <Line type="monotone" dataKey="gyroX" stroke="#ef4444" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="gyroY" stroke="#22c55e" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="gyroZ" stroke="#3b82f6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="h-48">
          <div className="text-xs text-gray-400 mb-1">Accelerometer (g)</div>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333333" />
              <XAxis dataKey="timestamp" hide />
              <YAxis stroke="#9ca3af" fontSize={10} domain={[-5, 15]} />
              <Tooltip contentStyle={{ backgroundColor: '#1f1f1f', border: '1px solid #333333', borderRadius: '4px' }} />
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


// GPS Status Panel
function GPSStatusPanel({ gps }: { gps: GPSStatus }) {
  const getFixColor = (fixType: string) => {
    switch (fixType) {
      case '3D Fix': return 'text-green-400';
      case '2D Fix': return 'text-yellow-400';
      default: return 'text-red-400';
    }
  };

  return (
    <Card className="bg-[#1f1f1f] border-[#333]">
      <CardHeader className="pb-2">
        <CardTitle className="text-white flex items-center gap-2 text-lg">
          <Satellite className="w-5 h-5 text-green-500" />
          GPS Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-3 bg-[#242424] rounded-lg">
          <div className="flex items-center gap-2">
            <Satellite className="w-5 h-5 text-[#ffbb00]" />
            <span className="text-gray-300">Satellites</span>
          </div>
          <div className="text-2xl font-bold text-white">
            {gps.satellites}<span className="text-gray-500 text-lg">/{gps.totalSatellites}</span>
          </div>
        </div>

        <div className="flex items-center justify-between p-3 bg-[#242424] rounded-lg">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-purple-400" />
            <span className="text-gray-300">Fix Type</span>
          </div>
          <span className={`font-bold ${getFixColor(gps.fixType)}`}>{gps.fixType}</span>
        </div>

        <div className="flex items-center justify-between p-3 bg-[#242424] rounded-lg">
          <div className="flex items-center gap-2">
            <Crosshair className="w-5 h-5 text-orange-400" />
            <span className="text-gray-300">HDOP</span>
          </div>
          <span className="font-mono text-white">{gps.hdop.toFixed(2)}</span>
        </div>

        <div className="flex items-center justify-between p-3 bg-[#242424] rounded-lg">
          <div className="flex items-center gap-2">
            <Gauge className="w-5 h-5 text-cyan-400" />
            <span className="text-gray-300">Speed</span>
          </div>
          <span className="font-mono text-white">{gps.speed.toFixed(1)} m/s</span>
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
              <div className="text-xs text-gray-400 mt-1">{gps.lat.toFixed(6)}, {gps.lon.toFixed(6)}</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Quick Controls
function QuickControls({ onCalibrateGyro, onCalibrateAccel, onSaveSettings, onReboot }: { 
  onCalibrateGyro: () => void;
  onCalibrateAccel: () => void;
  onSaveSettings: () => void;
  onReboot: () => void;
}) {
  return (
    <Card className="bg-[#1f1f1f] border-[#333]">
      <CardHeader className="pb-2">
        <CardTitle className="text-white flex items-center gap-2 text-lg">
          <Settings2 className="w-5 h-5 text-orange-500" />
          Quick Controls
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          <Button onClick={onCalibrateGyro} variant="outline" className="h-16 flex flex-col items-center justify-center gap-1 border-[#333] hover:bg-[#242424]">
            <RotateCcw className="w-5 h-5 text-[#ffbb00]" />
            <span className="text-xs">Calibrate Gyro</span>
          </Button>
          
          <Button onClick={onCalibrateAccel} variant="outline" className="h-16 flex flex-col items-center justify-center gap-1 border-[#333] hover:bg-[#242424]">
            <Activity className="w-5 h-5 text-green-400" />
            <span className="text-xs">Calibrate Accel</span>
          </Button>
          
          <Button onClick={onSaveSettings} variant="outline" className="h-16 flex flex-col items-center justify-center gap-1 border-[#333] hover:bg-[#242424]">
            <Save className="w-5 h-5 text-yellow-400" />
            <span className="text-xs">Save Settings</span>
          </Button>
          
          <Button onClick={onReboot} variant="outline" className="h-16 flex flex-col items-center justify-center gap-1 border-[#333] hover:bg-[#242424]">
            <Power className="w-5 h-5 text-red-400" />
            <span className="text-xs">Reboot FC</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}


// Motors Overview
function MotorsOverview({ motors }: { motors: MotorStatus[] }) {
  const maxRpm = 10000;

  return (
    <Card className="bg-[#1f1f1f] border-[#333]">
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
                <div className="text-xs text-gray-400">{motor.rpm.toLocaleString()}</div>
                <div className="text-xs text-gray-500">RPM</div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Recent Alerts
function RecentAlerts({ alerts }: { alerts: Alert[] }) {
  const getAlertIcon = (type: Alert['type']) => {
    switch (type) {
      case 'error': return <AlertCircle className="w-4 h-4 text-red-400" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
      case 'info': return <CheckCircle2 className="w-4 h-4 text-[#ffbb00]" />;
    }
  };

  const getAlertClass = (type: Alert['type']) => {
    switch (type) {
      case 'error': return 'border-l-red-500 bg-red-950/20';
      case 'warning': return 'border-l-yellow-500 bg-yellow-950/20';
      case 'info': return 'border-l-[#ffbb00] bg-[rgba(255,187,0,0.1)]';
    }
  };

  return (
    <Card className="bg-[#1f1f1f] border-[#333]">
      <CardHeader className="pb-2">
        <CardTitle className="text-white flex items-center gap-2 text-lg">
          <AlertTriangle className="w-5 h-5 text-yellow-500" />
          Recent Alerts
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {alerts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No recent alerts</div>
          ) : (
            alerts.slice(0, 10).map((alert) => (
              <div key={alert.id} className={`flex items-start gap-3 p-3 rounded-r-lg border-l-4 ${getAlertClass(alert.type)}`}>
                {getAlertIcon(alert.type)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-200">{alert.message}</p>
                  <p className="text-xs text-gray-500 mt-1">{alert.timestamp.toLocaleTimeString()}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}


// Main Dashboard Page
export default function DashboardPage() {
  const [telemetryData, setTelemetryData] = useState<TelemetryPoint[]>([]);
  const [droneStatus, setDroneStatus] = useState<DroneStatus>({
    connected: false,
    armed: false,
    fcName: 'MATEKF722',
    target: 'MATEKF722',
    firmwareVersion: 'Betaflight 4.4.0',
    flightMode: 'ACRO',
    failsafe: false,
  });
  const [battery, setBattery] = useState<BatteryStatus>({
    percentage: 85,
    voltage: 16.8,
    cellCount: 6,
    current: 12.5,
  });
  const [gps, setGPS] = useState<GPSStatus>({
    satellites: 12,
    totalSatellites: 14,
    fixType: '3D Fix',
    hdop: 1.2,
    speed: 0,
    lat: 51.5074,
    lon: -0.1278,
  });
  const [motors, setMotors] = useState<MotorStatus[]>([
    { id: 1, rpm: 0 },
    { id: 2, rpm: 0 },
    { id: 3, rpm: 0 },
    { id: 4, rpm: 0 },
  ]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [attitude, setAttitude] = useState({ pitch: 0, roll: 0, yaw: 0 });
  
  const ws = useRef<WebSocket | null>(null);
  const isSimulated = useRef(false);

  // Add alert helper
  const addAlert = useCallback((type: Alert['type'], message: string) => {
    const newAlert: Alert = {
      id: Date.now().toString(),
      type,
      message,
      timestamp: new Date(),
    };
    setAlerts(prev => [newAlert, ...prev].slice(0, 20));
  }, []);

  // WebSocket Connection
  useEffect(() => {
    const connectWebSocket = () => {
      try {
        ws.current = new WebSocket('ws://localhost:8000/ws/telemetry');

        ws.current.onopen = () => {
          console.log('Dashboard WebSocket connected');
          setDroneStatus(prev => ({ ...prev, connected: true }));
          isSimulated.current = false;
          addAlert('info', 'WebSocket connected');
        };

        ws.current.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            if (data.gyro) {
              setAttitude({
                pitch: data.gyro.pitch || 0,
                roll: data.gyro.roll || 0,
                yaw: data.gyro.yaw || 0,
              });
            }

            if (data.battery) {
              setBattery(prev => ({
                ...prev,
                percentage: data.battery.percentage || prev.percentage,
                voltage: data.battery.voltage || prev.voltage,
                current: data.battery.current || prev.current,
              }));
            }

            if (data.motors) {
              setMotors(data.motors.map((rpm: number, idx: number) => ({
                id: idx + 1,
                rpm: rpm || 0,
              })));
            }

            if (data.gps) {
              setGPS(prev => ({
                ...prev,
                satellites: data.gps.satellites || prev.satellites,
                fixType: data.gps.fixType || prev.fixType,
                hdop: data.gps.hdop || prev.hdop,
                speed: data.gps.speed || prev.speed,
                lat: data.gps.lat || prev.lat,
                lon: data.gps.lon || prev.lon,
              }));
            }

            if (data.status) {
              setDroneStatus(prev => ({
                ...prev,
                armed: data.status.armed || false,
                flightMode: data.status.flightMode || prev.flightMode,
                failsafe: data.status.failsafe || false,
              }));
            }
          } catch (err) {
            console.error('Failed to parse telemetry:', err);
          }
        };

        ws.current.onclose = () => {
          console.log('Dashboard WebSocket closed');
          setDroneStatus(prev => ({ ...prev, connected: false }));
          
          if (!isSimulated.current) {
            isSimulated.current = true;
            addAlert('warning', 'WebSocket disconnected - using simulated data');
          }
        };

        ws.current.onerror = () => {
          console.error('WebSocket error');
          setDroneStatus(prev => ({ ...prev, connected: false }));
        };
      } catch (err) {
        console.error('Failed to connect WebSocket:', err);
        isSimulated.current = true;
      }
    };

    connectWebSocket();

    return () => {
      ws.current?.close();
    };
  }, [addAlert]);

  // Telemetry Data Update Loop (every 100ms)
  useEffect(() => {
    const interval = setInterval(() => {
      const newPoint: TelemetryPoint = {
        timestamp: Date.now(),
        gyroX: (Math.random() - 0.5) * 20 + (isSimulated.current ? (Math.random() - 0.5) * 50 : 0),
        gyroY: (Math.random() - 0.5) * 20 + (isSimulated.current ? (Math.random() - 0.5) * 50 : 0),
        gyroZ: (Math.random() - 0.5) * 20 + (isSimulated.current ? (Math.random() - 0.5) * 50 : 0),
        accelX: (Math.random() - 0.5) * 0.5 + (isSimulated.current ? 0 : 0),
        accelY: (Math.random() - 0.5) * 0.5 + (isSimulated.current ? 0 : 0),
        accelZ: 9.8 + (Math.random() - 0.5) * 0.5,
      };

      setTelemetryData(prev => {
        const newData = [...prev, newPoint];
        // Keep only last 100 points
        return newData.slice(-100);
      });

      // Update attitude with simulated movement if disconnected
      if (isSimulated.current) {
        setAttitude(prev => ({
          pitch: prev.pitch + (Math.random() - 0.5) * 2,
          roll: prev.roll + (Math.random() - 0.5) * 2,
          yaw: (prev.yaw + (Math.random() - 0.5) * 1) % 360,
        }));

        // Simulate motor RPM
        setMotors(prev => prev.map(m => ({
          ...m,
          rpm: Math.max(0, Math.min(10000, m.rpm + (Math.random() - 0.5) * 500)),
        })));
      }
    }, 100);

    return () => clearInterval(interval);
  }, []);

  // Handlers
  const handleArmToggle = () => {
    setDroneStatus(prev => ({ ...prev, armed: !prev.armed }));
    addAlert(droneStatus.armed ? 'info' : 'warning', droneStatus.armed ? 'Drone DISARMED' : 'Drone ARMED');
  };

  const handleCalibrateGyro = () => {
    addAlert('info', 'Gyro calibration started...');
    setTimeout(() => addAlert('info', 'Gyro calibration complete'), 2000);
  };

  const handleCalibrateAccel = () => {
    addAlert('info', 'Accelerometer calibration started...');
    setTimeout(() => addAlert('info', 'Accelerometer calibration complete'), 2000);
  };

  const handleSaveSettings = () => {
    addAlert('info', 'Settings saved to EEPROM');
  };

  const handleReboot = () => {
    addAlert('warning', 'Flight controller rebooting...');
  };

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-400 mt-1">Real-time flight controller monitoring</p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${droneStatus.connected ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} />
          <span className="text-sm text-gray-400">
            {droneStatus.connected ? 'Live' : 'Simulated'}
          </span>
        </div>
      </div>

      {/* Top Row - Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <ConnectionStatusCard status={droneStatus} onArmToggle={handleArmToggle} />
        <BatteryCard battery={battery} />
        <FlightModeCard status={droneStatus} />
      </div>

      {/* Middle Row - Live Telemetry */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 3D Drone Visualization */}
        <Card className="bg-[#1f1f1f] border-[#333]">
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

        {/* Live Sensor Graphs */}
        <LiveSensorGraphs data={telemetryData} />

        {/* GPS Status */}
        <GPSStatusPanel gps={gps} />
      </div>

      {/* Bottom Row - Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <QuickControls 
          onCalibrateGyro={handleCalibrateGyro}
          onCalibrateAccel={handleCalibrateAccel}
          onSaveSettings={handleSaveSettings}
          onReboot={handleReboot}
        />
        <MotorsOverview motors={motors} />
        <RecentAlerts alerts={alerts} />
      </div>
    </div>
  );
}

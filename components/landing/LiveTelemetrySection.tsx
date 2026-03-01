'use client';

import { useTelemetry } from '@/components/TelemetryProvider';
import { AircraftVisualization } from './AircraftVisualization';
import { TelemetryWaveform } from './TelemetryWaveform';
import { AccelerometerWaveform } from './AccelerometerWaveform';
import { BatteryGauge } from './BatteryGauge';
import { SignalStrength } from './SignalStrength';
import { MotorLayout } from './MotorLayout';
import { RCSticks } from './RCSticks';
import { SensorStatus } from './SensorStatus';
import { SystemInfo } from './SystemInfo';

const FONT = "'SF Mono', Monaco, 'Cascadia Code', monospace";

export function LiveTelemetrySection() {
  const { telemetry, connected } = useTelemetry();

  const hasLiveData = connected && telemetry && (
    telemetry.gyro || telemetry.attitude || telemetry.motors || telemetry.rc || telemetry.battery
  );

  const cycleTime = telemetry?.status?.cycle_time;
  const i2cErrors = telemetry?.status?.i2c_errors ?? 0;
  const cpuLoad = cycleTime ? Math.min(100, Math.round((cycleTime / 2000) * 100)) : 12;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className={`w-2 h-2 rounded-full animate-pulse ${connected ? 'bg-[#96e212]' : 'bg-[#e2123f]'}`} />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[#8c8c8c]">
          Live Telemetry Preview
        </h2>
        <div className="flex-1 h-px bg-[#333]" />
        <span
          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm ${
            hasLiveData
              ? 'bg-[#96e212]/20 text-[#96e212] border border-[#96e212]/40'
              : 'bg-[#333] text-[#8c8c8c] border border-[#444]'
          }`}
          style={{ fontFamily: FONT }}
        >
          {hasLiveData ? 'LIVE' : 'SIMULATED'}
        </span>
      </div>

      {/* 3-Column Betaflight Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)_minmax(0,3fr)] gap-3">
        {/* Column 1, Row 1: Aircraft 3D Model */}
        <div className="bg-[#1f1f1f] rounded-[4px] border border-[#333] p-3 flex flex-col items-center">
          <AircraftVisualization attitude={telemetry?.attitude} />
        </div>

        {/* Column 2, Row 1: Gyroscope Waveform */}
        <div className="bg-[#1f1f1f] rounded-[4px] border border-[#333] p-3">
          <TelemetryWaveform gyro={telemetry?.gyro} />
        </div>

        {/* Column 3, Row 1: Battery Gauge */}
        <div className="bg-[#1f1f1f] rounded-[4px] border border-[#333] p-3 flex flex-col items-center">
          <BatteryGauge battery={telemetry?.battery ? {
            voltage: telemetry.battery.voltage,
            amperage: telemetry.battery.amperage,
            rssi: telemetry.battery.rssi,
          } : undefined} />
        </div>

        {/* Column 1, Row 2: Sensor Status */}
        <div className="bg-[#1f1f1f] rounded-[4px] border border-[#333] p-3">
          <SensorStatus
            status={telemetry?.status}
            gyro={telemetry?.gyro}
            accel={telemetry?.accel}
            gps={telemetry?.gps}
            connected={connected}
          />
        </div>

        {/* Column 2, Row 2: Accelerometer Waveform */}
        <div className="bg-[#1f1f1f] rounded-[4px] border border-[#333] p-3">
          <AccelerometerWaveform accel={telemetry?.accel} />
        </div>

        {/* Column 3, Row 2: Signal Strength */}
        <div className="bg-[#1f1f1f] rounded-[4px] border border-[#333] p-3 flex flex-col items-center">
          <SignalStrength rssiRaw={telemetry?.battery?.rssi} />
        </div>

        {/* Column 1, Row 3: System Info */}
        <div className="bg-[#1f1f1f] rounded-[4px] border border-[#333] p-3">
          <SystemInfo status={telemetry?.status} battery={telemetry?.battery} />
        </div>

        {/* Column 2, Row 3: Motor Outputs */}
        <div className="bg-[#1f1f1f] rounded-[4px] border border-[#333] p-3 flex flex-col items-center">
          <MotorLayout motors={telemetry?.motors} />
        </div>

        {/* Column 3, Row 3: RC Input */}
        <div className="bg-[#1f1f1f] rounded-[4px] border border-[#333] p-3 flex flex-col items-center">
          <RCSticks rc={telemetry?.rc} />
        </div>
      </div>

      {/* Bottom Status Bar */}
      <div
        className="flex items-center gap-6 px-3 py-1.5 bg-[#1a1a1a] border border-[#333] rounded-[4px] text-[10px] text-[#8c8c8c]"
        style={{ fontFamily: FONT }}
      >
        <span>
          CPU: <span className="text-[#f2f2f2]">{cpuLoad}%</span>
        </span>
        <span className="w-px h-3 bg-[#333]" />
        <span>
          Cycle: <span className="text-[#f2f2f2]">{cycleTime ? `${cycleTime}µs` : '---'}</span>
        </span>
        <span className="w-px h-3 bg-[#333]" />
        <span>
          I2C Err: <span className={i2cErrors > 0 ? 'text-[#e2123f]' : 'text-[#f2f2f2]'}>{i2cErrors}</span>
        </span>
        <span className="w-px h-3 bg-[#333]" />
        <span>
          Pkt Loss: <span className="text-[#f2f2f2]">0.0%</span>
        </span>
      </div>
    </div>
  );
}

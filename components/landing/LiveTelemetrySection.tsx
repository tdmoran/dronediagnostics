'use client';

import { useTelemetry } from '@/components/TelemetryProvider';
import { AttitudeIndicator } from './AttitudeIndicator';
import { BatteryGauge } from './BatteryGauge';
import { MotorLayout } from './MotorLayout';
import { GPSRadar } from './GPSRadar';
import { SignalStrength } from './SignalStrength';
import { TelemetryWaveform } from './TelemetryWaveform';
import { RCSticks } from './RCSticks';

export function LiveTelemetrySection() {
  const { telemetry, connected } = useTelemetry();

  // Determine whether we have real data (at least one non-GPS field present)
  const hasLiveData = connected && telemetry && (
    telemetry.gyro || telemetry.attitude || telemetry.motors || telemetry.rc || telemetry.battery
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className={`w-2 h-2 rounded-full animate-pulse ${connected ? 'bg-[#96e212]' : 'bg-[#e2123f]'}`} />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[#8c8c8c]">
          Live Telemetry Preview
        </h2>
        <div className="flex-1 h-px bg-[#333]" />
        <span className="text-xs text-[#666]">
          {hasLiveData ? 'LIVE' : 'SIMULATED'}
        </span>
      </div>

      {/* Gyroscope Waveform - Full Width */}
      <div className="bg-[#1f1f1f] rounded-[4px] border border-[#333] p-4">
        <TelemetryWaveform gyro={telemetry?.gyro} />
      </div>

      {/* Main Instruments Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Attitude Indicator */}
        <div className="bg-[#1f1f1f] rounded-[4px] border border-[#333] p-4 flex flex-col items-center">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#8c8c8c] mb-3 self-start">
            Attitude
          </h3>
          <AttitudeIndicator attitude={telemetry?.attitude} />
        </div>

        {/* Battery Gauge */}
        <div className="bg-[#1f1f1f] rounded-[4px] border border-[#333] p-4 flex flex-col items-center">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#8c8c8c] mb-3 self-start">
            Power
          </h3>
          <BatteryGauge battery={telemetry?.battery} />
        </div>

        {/* Motor Layout */}
        <div className="bg-[#1f1f1f] rounded-[4px] border border-[#333] p-4 flex flex-col items-center">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#8c8c8c] mb-3 self-start">
            Motors
          </h3>
          <MotorLayout motors={telemetry?.motors} />
        </div>

        {/* GPS Radar */}
        <div className="bg-[#1f1f1f] rounded-[4px] border border-[#333] p-4 flex flex-col items-center">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#8c8c8c] mb-3 self-start">
            Satellites
          </h3>
          <GPSRadar gps={telemetry?.gps ? {
            num_satellites: telemetry.gps.num_satellites,
            fix_type: telemetry.gps.fix_type,
            hdop: telemetry.gps.hdop,
          } : undefined} />
        </div>
      </div>

      {/* Secondary Instruments Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* RC Sticks */}
        <div className="bg-[#1f1f1f] rounded-[4px] border border-[#333] p-4 flex flex-col items-center">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#8c8c8c] mb-3 self-start">
            RC Input
          </h3>
          <RCSticks rc={telemetry?.rc} />
        </div>

        {/* Signal Strength */}
        <div className="bg-[#1f1f1f] rounded-[4px] border border-[#333] p-4 flex flex-col items-center">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#8c8c8c] mb-3 self-start">
            Radio Link
          </h3>
          <SignalStrength rssiRaw={telemetry?.battery?.rssi} />
        </div>
      </div>
    </div>
  );
}

'use client';

import type { StatusData, GyroData, AccelData, GPSData } from '@/types/gps';

const FONT = "'SF Mono', Monaco, 'Cascadia Code', monospace";

// Backend bitmask: acc=bit0(1), baro=bit1(2), mag=bit2(4), gps=bit3(8)
// Gyro has no bit — inferred from live gyro data presence

interface SensorDef {
  name: string;
  bit: number | null; // null = inferred from live data, not bitmask
  chip: string;
}

const SENSORS: SensorDef[] = [
  { name: 'Gyroscope', bit: null, chip: 'MPU6000' },
  { name: 'Accelerometer', bit: 0, chip: 'MPU6000' },
  { name: 'Barometer', bit: 1, chip: 'BMP280' },
  { name: 'Magnetometer', bit: 2, chip: 'HMC5883L' },
  { name: 'GPS', bit: 3, chip: 'UBLOX' },
  { name: 'Optical Flow', bit: null, chip: 'PMW3901' },
];

interface SensorStatusProps {
  status?: StatusData;
  gyro?: GyroData;
  accel?: AccelData;
  gps?: GPSData | null;
  connected?: boolean;
}

export function SensorStatus({ status, gyro, accel, gps, connected }: SensorStatusProps) {
  const sensorBitmask = status?.sensors ?? null;

  function isDetected(sensor: SensorDef): boolean | null {
    if (!connected) return null; // not connected — show "---"

    // Infer from live data for sensors without a bitmask bit
    if (sensor.name === 'Gyroscope') return !!gyro;
    if (sensor.name === 'Optical Flow') return false; // no data source for this

    // Infer from live data as fallback when bitmask not yet received
    if (sensorBitmask === null) {
      if (sensor.name === 'Accelerometer') return !!accel;
      if (sensor.name === 'GPS') return !!gps;
      return null;
    }

    return (sensorBitmask & (1 << sensor.bit!)) !== 0;
  }

  return (
    <div style={{ fontFamily: FONT }}>
      <div className="text-[9px] uppercase tracking-[1.5px] text-[#8c8c8c] mb-2">
        Sensor Status
      </div>
      <div className="border border-[#333] rounded-sm overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[1fr_80px_72px] bg-[#1a1a1a] px-2 py-1 border-b border-[#333]">
          <span className="text-[9px] uppercase text-[#666]">Sensor</span>
          <span className="text-[9px] uppercase text-[#666]">Chip</span>
          <span className="text-[9px] uppercase text-[#666] text-right">Status</span>
        </div>
        {/* Rows */}
        {SENSORS.map((sensor) => {
          const detected = isDetected(sensor);
          return (
            <div
              key={sensor.name}
              className="grid grid-cols-[1fr_80px_72px] px-2 py-1.5 border-b border-[#333] last:border-b-0 bg-[#1f1f1f] hover:bg-[#242424] transition-colors"
            >
              <span className="text-[10px] text-[#ccc]">{sensor.name}</span>
              <span className="text-[10px] text-[#8c8c8c]">
                {detected === null ? '---' : detected ? sensor.chip : 'N/A'}
              </span>
              <span className="text-right">
                {detected === null ? (
                  <span className="text-[9px] text-[#666]">---</span>
                ) : detected ? (
                  <span className="text-[9px] font-bold text-[#96e212]">OK</span>
                ) : (
                  <span className="text-[9px] text-[#666]">N/A</span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export interface GPSData {
  lat: number;
  lon: number;
  altitude: number;
  speed: number;
  course: number;
  fix_type: number;
  num_satellites: number;
  hdop: number | null;
  lat_dms: string;
  lon_dms: string;
  coordinates_decimal: string;
  coordinates_dms: string;
  fix_status: string;
  fix_color: 'red' | 'yellow' | 'green' | 'gray';
}

export interface GPSStatus {
  has_fix: boolean;
  fix_type: number;
  fix_status: string;
  num_satellites: number;
  color: 'red' | 'yellow' | 'green' | 'gray';
}

export interface GyroData {
  x: number;
  y: number;
  z: number;
}

export interface AccelData {
  x: number;
  y: number;
  z: number;
}

export interface AttitudeData {
  roll: number;
  pitch: number;
  yaw: number;
}

export interface StatusData {
  cycle_time: number;
  i2c_errors: number;
  sensors: number;
  flight_mode: number;
  current_profile: number;
}

export interface BatteryData {
  voltage: number;
  power_meter: number;
  rssi: number;
  amperage: number;
}

export interface TelemetryData {
  type: 'telemetry';
  timestamp: number;
  gps: GPSData | null;
  gyro?: GyroData;
  accel?: AccelData;
  attitude?: AttitudeData;
  status?: StatusData;
  motors?: number[];
  rc?: number[];
  battery?: BatteryData;
}

export type FixType = 0 | 1 | 2;

export const FIX_TYPE_LABELS: Record<FixType, string> = {
  0: 'No Fix',
  1: '2D Fix',
  2: '3D Fix',
};

export const FIX_TYPE_COLORS: Record<FixType, string> = {
  0: 'bg-gps-red',
  1: 'bg-gps-yellow',
  2: 'bg-gps-green',
};

export const FIX_TYPE_TEXT_COLORS: Record<FixType, string> = {
  0: 'text-gps-red',
  1: 'text-gps-yellow',
  2: 'text-gps-green',
};

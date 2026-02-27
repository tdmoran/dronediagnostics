// Types for Blackbox Log Analysis

export interface BlackboxHeader {
  version: number;
  firmwareVersion: string;
  firmwareRevision: string;
  boardInformation: string;
  craftName: string;
  logStartTime: Date;
  fields: BlackboxField[];
}

export interface BlackboxField {
  name: string;
  type: 'signed' | 'unsigned' | 'float';
  predictor: number;
  encoding: number;
}

export interface BlackboxFrame {
  timestamp: number;
  gyro: { x: number; y: number; z: number };
  accel: { x: number; y: number; z: number };
  motors: number[];
  rcCommand: { roll: number; pitch: number; yaw: number; throttle: number };
  altitude?: number;
  speed?: number;
  latitude?: number;
  longitude?: number;
  gpsSpeed?: number;
  voltage?: number;
  current?: number;
  rssi?: number;
}

export interface BlackboxLog {
  header: BlackboxHeader;
  frames: BlackboxFrame[];
  statistics: FlightStatistics;
}

export interface FlightStatistics {
  duration: number;
  maxSpeed: number;
  maxAltitude: number;
  maxGyroRate: number;
  maxAccel: number;
  avgVoltage: number;
  avgCurrent: number;
  maxCurrent: number;
  distanceTraveled: number;
}

export interface LogFile {
  id: string;
  name: string;
  size: number;
  createdAt: Date;
  index: number;
}

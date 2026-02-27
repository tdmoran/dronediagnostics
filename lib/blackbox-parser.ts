import * as fs from 'fs';
import { BlackboxHeader, BlackboxFrame, BlackboxLog, BlackboxField, FlightStatistics, LogFile } from '@/types/blackbox';

/**
 * Betaflight Blackbox Log Parser
 * 
 * BBL files are binary files that contain flight data logged by Betaflight.
 * The format consists of:
 * 1. A header section with metadata and field definitions
 * 2. Frame data (I-frames and P-frames)
 * 3. Event markers
 * 
 * This parser implements a simplified version that can read and decode
 * the most common frame types and fields.
 */

const HEADER_START = 'H Product:Blackbox flight data recorder by Nicholas Sherlock\n';
const HEADER_MARKER = 'H ';

interface ParsedHeader {
  firmwareVersion: string;
  firmwareDate: string;
  firmwareTime: string;
  craftName: string;
  fields: Map<string, BlackboxField>;
  fieldNames: string[];
  dataVersion: number;
  minThrottle: number;
  maxThrottle: number;
}

export class BlackboxParser {
  private buffer: Buffer;
  private offset: number = 0;

  constructor(buffer: Buffer) {
    this.buffer = buffer;
  }

  /**
   * Parse the BBL file and return structured log data
   */
  parse(): BlackboxLog {
    const parsedHeader = this.parseHeader();
    const frames = this.parseFrames(parsedHeader);
    const statistics = this.calculateStatistics(frames);

    return {
      header: {
        version: parsedHeader.dataVersion,
        firmwareVersion: parsedHeader.firmwareVersion,
        firmwareRevision: parsedHeader.firmwareDate,
        boardInformation: parsedHeader.firmwareDate + ' ' + parsedHeader.firmwareTime,
        craftName: parsedHeader.craftName,
        logStartTime: new Date(),
        fields: Array.from(parsedHeader.fields.values())
      },
      frames,
      statistics
    };
  }

  /**
   * Parse the header section of the BBL file
   */
  private parseHeader(): ParsedHeader {
    const header: ParsedHeader = {
      firmwareVersion: '',
      firmwareDate: '',
      firmwareTime: '',
      craftName: '',
      fields: new Map(),
      fieldNames: [],
      dataVersion: 0,
      minThrottle: 1000,
      maxThrottle: 2000
    };

    let line = '';
    while (this.offset < this.buffer.length) {
      const byte = this.buffer[this.offset++];
      
      if (byte === 0x0A) { // Newline
        if (line.startsWith('H ')) {
          this.parseHeaderLine(line.substring(2), header);
        } else if (line.startsWith('Field H ')) {
          this.parseFieldDefinition(line.substring(8), header);
        } else if (line.startsWith('I ')) {
          // Start of data section, stop parsing header
          this.offset -= line.length + 1;
          break;
        }
        line = '';
      } else if (byte !== 0x0D) { // Ignore carriage return
        line += String.fromCharCode(byte);
      }
    }

    return header;
  }

  /**
   * Parse a single header line
   */
  private parseHeaderLine(line: string, header: ParsedHeader): void {
    const parts = line.split(':');
    if (parts.length < 2) return;

    const key = parts[0].trim();
    const value = parts[1].trim();

    switch (key) {
      case 'Firmware revision':
        header.firmwareVersion = value;
        break;
      case 'Firmware date':
        header.firmwareDate = value;
        break;
      case 'Firmware time':
        header.firmwareTime = value;
        break;
      case 'Craft name':
        header.craftName = value;
        break;
      case 'Data version':
        header.dataVersion = parseInt(value, 10) || 0;
        break;
      case 'minthrottle':
        header.minThrottle = parseInt(value, 10) || 1000;
        break;
      case 'maxthrottle':
        header.maxThrottle = parseInt(value, 10) || 2000;
        break;
    }
  }

  /**
   * Parse field definition from header
   */
  private parseFieldDefinition(line: string, header: ParsedHeader): void {
    // Parse field headers like: gyroADC:0,1,2
    const parts = line.split(':');
    if (parts.length < 2) return;

    const fieldName = parts[0].trim();
    const indices = parts[1].split(',').map(s => parseInt(s.trim(), 10));

    header.fieldNames.push(fieldName);
    
    for (let i = 0; i < indices.length; i++) {
      const subFieldName = indices.length > 1 ? `${fieldName}[${i}]` : fieldName;
      header.fields.set(subFieldName, {
        name: subFieldName,
        type: 'signed',
        predictor: 0,
        encoding: 0
      });
    }
  }

  /**
   * Parse frame data from the BBL file
   */
  private parseFrames(header: ParsedHeader): BlackboxFrame[] {
    const frames: BlackboxFrame[] = [];
    let lastFrameTime = 0;

    while (this.offset < this.buffer.length) {
      const frameType = String.fromCharCode(this.buffer[this.offset]);
      
      if (frameType === 'I' || frameType === 'P' || frameType === 'S' || frameType === 'E') {
        const frame = this.parseFrame(frameType, header, lastFrameTime);
        if (frame) {
          frames.push(frame);
          lastFrameTime = frame.timestamp;
        }
      } else {
        // Skip unknown bytes
        this.offset++;
      }

      // Safety limit to prevent memory issues
      if (frames.length > 100000) {
        console.warn('Reached frame limit, truncating log');
        break;
      }
    }

    return frames;
  }

  /**
   * Parse a single frame
   */
  private parseFrame(type: string, header: ParsedHeader, lastFrameTime: number): BlackboxFrame | null {
    // Move past frame type marker
    this.offset++;
    
    // Skip space if present
    if (this.buffer[this.offset] === 0x20) {
      this.offset++;
    }

    // For I-frames, read the timestamp
    let timestamp = lastFrameTime;
    if (type === 'I') {
      const line = this.readLine();
      const parts = line.split(',');
      if (parts.length > 0) {
        timestamp = parseInt(parts[0], 10) || lastFrameTime;
      }
      
      // Parse gyro values from the line
      const gyro = {
        x: parseInt(parts[1] || '0', 10),
        y: parseInt(parts[2] || '0', 10),
        z: parseInt(parts[3] || '0', 10)
      };

      const accel = {
        x: parseInt(parts[4] || '0', 10),
        y: parseInt(parts[5] || '0', 10),
        z: parseInt(parts[6] || '0', 10)
      };

      const motors = [
        parseInt(parts[7] || '0', 10),
        parseInt(parts[8] || '0', 10),
        parseInt(parts[9] || '0', 10),
        parseInt(parts[10] || '0', 10)
      ];

      return {
        timestamp,
        gyro,
        accel,
        motors,
        rcCommand: {
          roll: parseInt(parts[11] || '0', 10),
          pitch: parseInt(parts[12] || '0', 10),
          yaw: parseInt(parts[13] || '0', 10),
          throttle: parseInt(parts[14] || '0', 10)
        },
        altitude: parseFloat(parts[15] || '0'),
        speed: parseFloat(parts[16] || '0'),
        voltage: parseFloat(parts[17] || '0') / 100,
        current: parseFloat(parts[18] || '0') / 100,
        rssi: parseInt(parts[19] || '0', 10)
      };
    } else if (type === 'P') {
      // P-frame (delta frame) - simplified parsing
      const line = this.readLine();
      const parts = line.split(',');
      
      // P-frames contain deltas or absolute values depending on the field
      // For simplicity, we'll parse as absolute values
      return {
        timestamp: lastFrameTime + 1000, // Approximate timing
        gyro: {
          x: parseInt(parts[1] || '0', 10),
          y: parseInt(parts[2] || '0', 10),
          z: parseInt(parts[3] || '0', 10)
        },
        accel: {
          x: parseInt(parts[4] || '0', 10),
          y: parseInt(parts[5] || '0', 10),
          z: parseInt(parts[6] || '0', 10)
        },
        motors: [
          parseInt(parts[7] || '0', 10),
          parseInt(parts[8] || '0', 10),
          parseInt(parts[9] || '0', 10),
          parseInt(parts[10] || '0', 10)
        ],
        rcCommand: {
          roll: parseInt(parts[11] || '0', 10),
          pitch: parseInt(parts[12] || '0', 10),
          yaw: parseInt(parts[13] || '0', 10),
          throttle: parseInt(parts[14] || '0', 10)
        }
      };
    }

    return null;
  }

  /**
   * Read a line from the buffer
   */
  private readLine(): string {
    let line = '';
    while (this.offset < this.buffer.length) {
      const byte = this.buffer[this.offset++];
      if (byte === 0x0A) break;
      if (byte !== 0x0D) {
        line += String.fromCharCode(byte);
      }
    }
    return line;
  }

  /**
   * Calculate flight statistics from frames
   */
  private calculateStatistics(frames: BlackboxFrame[]): FlightStatistics {
    if (frames.length === 0) {
      return {
        duration: 0,
        maxSpeed: 0,
        maxAltitude: 0,
        maxGyroRate: 0,
        maxAccel: 0,
        avgVoltage: 0,
        avgCurrent: 0,
        maxCurrent: 0,
        distanceTraveled: 0
      };
    }

    const duration = frames[frames.length - 1].timestamp - frames[0].timestamp;
    
    let maxSpeed = 0;
    let maxAltitude = 0;
    let maxGyroRate = 0;
    let maxAccel = 0;
    let maxCurrent = 0;
    let totalVoltage = 0;
    let totalCurrent = 0;
    let voltageCount = 0;
    let currentCount = 0;

    for (const frame of frames) {
      if (frame.speed && frame.speed > maxSpeed) maxSpeed = frame.speed;
      if (frame.altitude && frame.altitude > maxAltitude) maxAltitude = frame.altitude;
      
      const gyroRate = Math.sqrt(
        frame.gyro.x ** 2 + frame.gyro.y ** 2 + frame.gyro.z ** 2
      );
      if (gyroRate > maxGyroRate) maxGyroRate = gyroRate;

      const accel = Math.sqrt(
        frame.accel.x ** 2 + frame.accel.y ** 2 + frame.accel.z ** 2
      );
      if (accel > maxAccel) maxAccel = accel;

      if (frame.current && frame.current > maxCurrent) maxCurrent = frame.current;
      
      if (frame.voltage) {
        totalVoltage += frame.voltage;
        voltageCount++;
      }
      if (frame.current) {
        totalCurrent += frame.current;
        currentCount++;
      }
    }

    return {
      duration: duration / 1000000, // Convert microseconds to seconds
      maxSpeed,
      maxAltitude,
      maxGyroRate,
      maxAccel,
      avgVoltage: voltageCount > 0 ? totalVoltage / voltageCount : 0,
      avgCurrent: currentCount > 0 ? totalCurrent / currentCount : 0,
      maxCurrent,
      distanceTraveled: maxSpeed * (duration / 1000000) // Rough estimate
    };
  }
}

/**
 * Parse a BBL file from buffer
 */
export function parseBBLFile(buffer: Buffer): BlackboxLog {
  const parser = new BlackboxParser(buffer);
  return parser.parse();
}

/**
 * Get list of available logs from a BBL file
 * (BBL files can contain multiple logs)
 */
export function getLogList(buffer: Buffer): LogFile[] {
  const logs: LogFile[] = [];
  let offset = 0;
  let logIndex = 0;

  while (offset < buffer.length) {
    // Look for header marker
    const headerIdx = buffer.indexOf('H Product:Blackbox', offset);
    if (headerIdx === -1) break;

    // Find next header or end of file
    const nextHeaderIdx = buffer.indexOf('H Product:Blackbox', headerIdx + 1);
    const endOffset = nextHeaderIdx === -1 ? buffer.length : nextHeaderIdx;
    
    const size = endOffset - headerIdx;
    
    logs.push({
      id: `log_${logIndex}`,
      name: `Log ${logIndex + 1}`,
      size,
      createdAt: new Date(),
      index: logIndex
    });

    offset = endOffset;
    logIndex++;
  }

  return logs;
}

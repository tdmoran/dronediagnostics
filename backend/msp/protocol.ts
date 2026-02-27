import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';
import * as codes from './codes';

// MSP Protocol Implementation
const MSP_HEADER = 0x24; // '$'
const MSP_V1 = 0x4D; // 'M'
const MSP_V2 = 0x58; // 'X'
const MSP_DIRECTION_TO_FC = 0x3C; // '<'
const MSP_DIRECTION_FROM_FC = 0x3E; // '>'

export class MSPProtocol {
  private port: SerialPort | null = null;
  private parser: ReadlineParser | null = null;
  private isConnected: boolean = false;
  private pendingResponse: ((data: Buffer) => void) | null = null;
  private responseTimeout: NodeJS.Timeout | null = null;

  async connect(path: string, baudRate: number = 115200): Promise<boolean> {
    try {
      this.port = new SerialPort({ path, baudRate });
      this.parser = this.port.pipe(new ReadlineParser({ delimiter: '\n' }));
      
      this.port.on('data', (data: Buffer) => {
        if (this.pendingResponse) {
          this.pendingResponse(data);
          this.pendingResponse = null;
        }
      });

      this.isConnected = true;
      return true;
    } catch (error) {
      console.error('Failed to connect to flight controller:', error);
      return false;
    }
  }

  disconnect(): void {
    if (this.port) {
      this.port.close();
      this.port = null;
      this.parser = null;
      this.isConnected = false;
    }
  }

  async sendCommand(cmd: number, data: Buffer = Buffer.alloc(0)): Promise<Buffer> {
    if (!this.port || !this.isConnected) {
      throw new Error('Not connected to flight controller');
    }

    return new Promise((resolve, reject) => {
      // Build MSP V1 packet
      const packet = Buffer.alloc(6 + data.length);
      packet[0] = MSP_HEADER;
      packet[1] = MSP_V1;
      packet[2] = MSP_DIRECTION_TO_FC;
      packet[3] = data.length;
      packet[4] = cmd;
      
      if (data.length > 0) {
        data.copy(packet, 5);
      }
      
      // Calculate checksum
      let checksum = packet[3] ^ packet[4];
      for (let i = 0; i < data.length; i++) {
        checksum ^= data[i];
      }
      packet[5 + data.length] = checksum;

      // Set up response handler
      this.pendingResponse = (response: Buffer) => {
        if (this.responseTimeout) {
          clearTimeout(this.responseTimeout);
        }
        resolve(response);
      };

      // Set timeout
      this.responseTimeout = setTimeout(() => {
        this.pendingResponse = null;
        reject(new Error('MSP command timeout'));
      }, 2000);

      // Send packet
      this.port!.write(packet);
    });
  }

  async getApiVersion(): Promise<string> {
    try {
      const response = await this.sendCommand(codes.MSP_API_VERSION);
      if (response.length >= 3) {
        return `${response[1]}.${response[2]}.${response[3] || 0}`;
      }
      return '0.0.0';
    } catch (error) {
      console.error('Error getting API version:', error);
      return '0.0.0';
    }
  }

  async getFirmwareVersion(): Promise<{ major: number; minor: number; patch: number; versionString: string }> {
    try {
      const response = await this.sendCommand(codes.MSP_FC_VARIANT);
      const variant = response.toString('ascii', 1, 5);
      
      const versionResponse = await this.sendCommand(codes.MSP_FC_VERSION);
      const major = versionResponse[1];
      const minor = versionResponse[2];
      const patch = versionResponse[3];
      
      return {
        major,
        minor,
        patch,
        versionString: `${variant} ${major}.${minor}.${patch}`
      };
    } catch (error) {
      console.error('Error getting firmware version:', error);
      return { major: 0, minor: 0, patch: 0, versionString: 'Unknown' };
    }
  }

  async getBoardInfo(): Promise<{ identifier: string; targetName: string; boardName: string; manufacturerId: string }> {
    try {
      const response = await this.sendCommand(codes.MSP_BOARD_INFO);
      
      // Parse board info response
      let offset = 1;
      const identifier = response.toString('ascii', offset, offset + 4);
      offset += 4;
      
      const hwRevision = response.readUInt16LE(offset);
      offset += 2;
      
      // Try to get target name (may not be available in older versions)
      let targetName = identifier;
      try {
        const targetResponse = await this.sendCommand(codes.MSP_UID);
        targetName = targetResponse.toString('ascii', 1) || identifier;
      } catch {
        // Target name not available
      }
      
      return {
        identifier,
        targetName,
        boardName: `${identifier} (Rev ${hwRevision})`,
        manufacturerId: 'BF'
      };
    } catch (error) {
      console.error('Error getting board info:', error);
      return {
        identifier: 'UNKNOWN',
        targetName: 'UNKNOWN',
        boardName: 'Unknown Board',
        manufacturerId: 'BF'
      };
    }
  }

  async getCLIDump(): Promise<string> {
    try {
      // Enter CLI mode
      this.port?.write(Buffer.from('#\r\n'));
      await this.delay(100);
      
      // Send dump command
      this.port?.write(Buffer.from('dump\r\n'));
      
      // Collect response
      let dump = '';
      const timeout = Date.now() + 5000;
      
      while (Date.now() < timeout) {
        const data = await this.readData();
        if (data) {
          dump += data;
          if (dump.includes('dump completed')) {
            break;
          }
        }
        await this.delay(100);
      }
      
      // Exit CLI mode
      this.port?.write(Buffer.from('exit\r\n'));
      
      return dump;
    } catch (error) {
      console.error('Error getting CLI dump:', error);
      return '';
    }
  }

  async setCLISetting(setting: string, value: string): Promise<boolean> {
    try {
      // Enter CLI mode
      this.port?.write(Buffer.from('#\r\n'));
      await this.delay(100);
      
      // Send set command
      this.port?.write(Buffer.from(`set ${setting} = ${value}\r\n`));
      await this.delay(100);
      
      // Save
      this.port?.write(Buffer.from('save\r\n'));
      await this.delay(500);
      
      return true;
    } catch (error) {
      console.error('Error setting CLI value:', error);
      return false;
    }
  }

  async restoreCLIDump(dump: string): Promise<boolean> {
    try {
      // Enter CLI mode
      this.port?.write(Buffer.from('#\r\n'));
      await this.delay(100);
      
      // Parse and apply settings
      const lines = dump.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('set ') || trimmed.startsWith('feature ') || trimmed.startsWith('map ')) {
          this.port?.write(Buffer.from(trimmed + '\r\n'));
          await this.delay(50);
        }
      }
      
      // Save
      this.port?.write(Buffer.from('save\r\n'));
      await this.delay(500);
      
      return true;
    } catch (error) {
      console.error('Error restoring CLI dump:', error);
      return false;
    }
  }

  private async readData(): Promise<string | null> {
    return new Promise((resolve) => {
      const handler = (data: Buffer) => {
        resolve(data.toString());
      };
      
      this.port?.once('data', handler);
      setTimeout(() => {
        this.port?.removeListener('data', handler);
        resolve(null);
      }, 500);
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }
}

// Singleton instance
export const mspProtocol = new MSPProtocol();

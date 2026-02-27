import express, { Request, Response } from 'express';
import cors from 'cors';
import multer from 'multer';
import * as fs from 'fs';
import * as path from 'path';
import { mspProtocol } from './msp/protocol';
import { parseBBLFile, getLogList } from '../lib/blackbox-parser';
import { FirmwareUpdateInfo, ConfigDump, GitHubRelease } from '../types/firmware';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });

// Ensure uploads directory exists
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// ===== BLACKBOX API ROUTES =====

/**
 * POST /api/blackbox/parse
 * Parse uploaded BBL file to JSON
 */
app.post('/api/blackbox/parse', upload.single('file'), (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const buffer = fs.readFileSync(filePath);
    
    // Parse the BBL file
    const logData = parseBBLFile(buffer);
    
    // Clean up uploaded file
    fs.unlinkSync(filePath);
    
    res.json({
      success: true,
      data: logData
    });
  } catch (error) {
    console.error('Error parsing BBL file:', error);
    res.status(500).json({ error: 'Failed to parse BBL file' });
  }
});

/**
 * GET /api/blackbox/logs
 * List available logs on FC (from SD card or dataflash)
 */
app.get('/api/blackbox/logs', async (req: Request, res: Response) => {
  try {
    // In a real implementation, this would query the FC via MSP
    // For now, return mock data
    const logs = [
      { id: '1', name: 'LOG00001.BBL', size: 1024576, date: new Date().toISOString() },
      { id: '2', name: 'LOG00002.BBL', size: 2048576, date: new Date().toISOString() },
      { id: '3', name: 'LOG00003.BBL', size: 1534576, date: new Date().toISOString() }
    ];
    
    res.json({ logs });
  } catch (error) {
    console.error('Error listing logs:', error);
    res.status(500).json({ error: 'Failed to list logs' });
  }
});

/**
 * GET /api/blackbox/download/:id
 * Download log from FC
 */
app.get('/api/blackbox/download/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // In a real implementation, this would:
    // 1. Connect to FC via MSP
    // 2. Read dataflash/SD card
    // 3. Stream the data
    
    // For demo, return a mock file path
    res.json({
      success: true,
      message: `Download initiated for log ${id}`,
      downloadUrl: `/api/blackbox/file/${id}`
    });
  } catch (error) {
    console.error('Error downloading log:', error);
    res.status(500).json({ error: 'Failed to download log' });
  }
});

// ===== FIRMWARE API ROUTES =====

/**
 * GET /api/firmware/version
 * Get current Betaflight version from FC
 */
app.get('/api/firmware/version', async (req: Request, res: Response) => {
  try {
    // In real implementation, connect via MSP
    // const version = await mspProtocol.getFirmwareVersion();
    
    // Mock response
    const version = {
      major: 4,
      minor: 4,
      patch: 0,
      versionString: 'Betaflight 4.4.0',
      buildDate: 'Jan 15 2024'
    };
    
    res.json(version);
  } catch (error) {
    console.error('Error getting firmware version:', error);
    res.status(500).json({ error: 'Failed to get firmware version' });
  }
});

/**
 * GET /api/firmware/target
 * Get FC target/board info
 */
app.get('/api/firmware/target', async (req: Request, res: Response) => {
  try {
    // In real implementation, connect via MSP
    // const boardInfo = await mspProtocol.getBoardInfo();
    
    // Mock response
    const boardInfo = {
      identifier: 'S411',
      targetName: 'MATEKF411',
      boardName: 'MATEKF411 (Rev 1)',
      manufacturerId: 'MTKS'
    };
    
    res.json(boardInfo);
  } catch (error) {
    console.error('Error getting board info:', error);
    res.status(500).json({ error: 'Failed to get board info' });
  }
});

/**
 * GET /api/firmware/latest
 * Get latest firmware release from GitHub
 */
app.get('/api/firmware/latest', async (req: Request, res: Response) => {
  try {
    // Fetch latest release from GitHub API
    const response = await fetch('https://api.github.com/repos/betaflight/betaflight/releases/latest');
    
    if (!response.ok) {
      throw new Error('Failed to fetch from GitHub');
    }
    
    const release: GitHubRelease = await response.json() as GitHubRelease;
    
    // Get current version from query param or default
    const currentVersion = (req.query.current as string) || '4.4.0';
    const target = (req.query.target as string) || 'MATEKF411';
    
    // Parse version strings for comparison
    const currentParts = currentVersion.split('.').map(Number);
    const latestTag = release.tag_name.replace('v', '');
    const latestParts = latestTag.split('.').map(Number);
    
    // Simple version comparison
    let updateAvailable = false;
    for (let i = 0; i < 3; i++) {
      if (latestParts[i] > (currentParts[i] || 0)) {
        updateAvailable = true;
        break;
      } else if (latestParts[i] < (currentParts[i] || 0)) {
        break;
      }
    }
    
    // Find firmware file for this target
    const targetFirmwareUrl = release.assets.find(asset => 
      asset.name.includes(target) && asset.name.endsWith('.hex')
    )?.browser_download_url;
    
    const updateInfo: FirmwareUpdateInfo = {
      current: {
        major: currentParts[0] || 0,
        minor: currentParts[1] || 0,
        patch: currentParts[2] || 0,
        versionString: currentVersion
      },
      latest: release,
      updateAvailable,
      targetFirmwareUrl
    };
    
    res.json(updateInfo);
  } catch (error) {
    console.error('Error checking for firmware updates:', error);
    res.status(500).json({ error: 'Failed to check for updates' });
  }
});

// ===== CONFIG BACKUP/RESTORE API ROUTES =====

/**
 * GET /api/config/export
 * Export full CLI dump as text file
 */
app.get('/api/config/export', async (req: Request, res: Response) => {
  try {
    // In real implementation, connect via MSP
    // const cliDump = await mspProtocol.getCLIDump();
    
    // Mock CLI dump
    const mockDump = `# Betaflight / MATEKF411 (MTKS) 4.4.0 Jan 15 2024

# name
name MyDrone

# resources
resource BEEPER 1 B02
resource MOTOR 1 B00
resource MOTOR 2 B01
resource MOTOR 3 A00
resource MOTOR 4 A01

# feature
feature -RX_PARALLEL_PWM
feature RX_SERIAL
feature GPS
feature TELEMETRY

# serial
serial 0 64 115200 57600 0 115200
serial 1 2 115200 57600 0 115200

# aux
aux 0 0 0 900 2100 0 0
aux 1 1 1 900 1300 0 0
aux 2 2 1 1300 1700 0 0

# master
set gyro_sync_denom = 1
set pid_process_denom = 2
set motor_pwm_protocol = DSHOT300
set motor_poles = 14
set vbat_min_cell_voltage = 330
set vbat_warning_cell_voltage = 350
set vbat_scale = 110
set current_meter = ADC
set battery_meter = ADC

# profile
profile 0

set dterm_lowpass_type = BIQUAD
set dterm_lowpass_hz = 100
set dterm_notch_hz = 260
set dterm_notch_cutoff = 160

# rateprofile
rateprofile 0

set roll_rc_rate = 100
set pitch_rc_rate = 100
set yaw_rc_rate = 100
set roll_expo = 0
set pitch_expo = 0
set yaw_expo = 0
set roll_srate = 70
set pitch_srate = 70
set yaw_srate = 70

# end of dump`;

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `betaflight_backup_${timestamp}.txt`;
    
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(mockDump);
  } catch (error) {
    console.error('Error exporting config:', error);
    res.status(500).json({ error: 'Failed to export config' });
  }
});

/**
 * POST /api/config/import
 * Import and restore config from backup
 */
app.post('/api/config/import', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const cliDump = fs.readFileSync(filePath, 'utf-8');
    
    // Parse the dump to extract settings
    const settings: Record<string, string> = {};
    const lines = cliDump.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('set ')) {
        const parts = trimmed.substring(4).split('=');
        if (parts.length === 2) {
          const key = parts[0].trim();
          const value = parts[1].trim();
          settings[key] = value;
        }
      }
    }
    
    // Clean up uploaded file
    fs.unlinkSync(filePath);
    
    // In real implementation, apply settings via MSP
    // await mspProtocol.restoreCLIDump(cliDump);
    
    res.json({
      success: true,
      message: 'Config parsed successfully',
      settingsCount: Object.keys(settings).length,
      preview: settings
    });
  } catch (error) {
    console.error('Error importing config:', error);
    res.status(500).json({ error: 'Failed to import config' });
  }
});

/**
 * POST /api/config/restore
 * Apply imported settings to FC
 */
app.post('/api/config/restore', async (req: Request, res: Response) => {
  try {
    const { settings, apply } = req.body;
    
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'Invalid settings data' });
    }
    
    // In real implementation, apply each setting via MSP
    // for (const [key, value] of Object.entries(settings)) {
    //   await mspProtocol.setCLISetting(key, value as string);
    // }
    
    if (apply) {
      // Actually apply settings
      res.json({
        success: true,
        message: 'Settings applied successfully',
        appliedCount: Object.keys(settings).length
      });
    } else {
      // Just preview
      res.json({
        success: true,
        message: 'Settings preview ready',
        settingsCount: Object.keys(settings).length,
        settings
      });
    }
  } catch (error) {
    console.error('Error restoring config:', error);
    res.status(500).json({ error: 'Failed to restore config' });
  }
});

/**
 * POST /api/config/diff
 * Compare current config with backup
 */
app.post('/api/config/diff', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const backupDump = fs.readFileSync(filePath, 'utf-8');
    
    // Clean up uploaded file
    fs.unlinkSync(filePath);
    
    // Parse backup settings
    const backupSettings: Record<string, string> = {};
    const lines = backupDump.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('set ')) {
        const parts = trimmed.substring(4).split('=');
        if (parts.length === 2) {
          const key = parts[0].trim();
          const value = parts[1].trim();
          backupSettings[key] = value;
        }
      }
    }
    
    // Mock current settings (in real implementation, get from FC)
    const currentSettings: Record<string, string> = {
      'gyro_sync_denom': '1',
      'pid_process_denom': '2',
      'motor_pwm_protocol': 'DSHOT300',
      'motor_poles': '14',
      'vbat_min_cell_voltage': '330',
      'vbat_warning_cell_voltage': '350',
      'vbat_scale': '110',
      'current_meter': 'ADC',
      'battery_meter': 'ADC',
      'roll_rc_rate': '100',
      'pitch_rc_rate': '100',
      'yaw_rc_rate': '100',
      'roll_expo': '0',
      'pitch_expo': '5',  // Different from backup
      'yaw_expo': '0',
      'roll_srate': '70',
      'pitch_srate': '75', // Different from backup
      'yaw_srate': '70'
    };
    
    // Calculate diff
    const diff = {
      added: [] as string[],
      removed: [] as string[],
      modified: [] as { key: string; current: string; backup: string }[],
      unchanged: [] as string[]
    };
    
    // Check for added/modified/unchanged
    for (const [key, backupValue] of Object.entries(backupSettings)) {
      if (!(key in currentSettings)) {
        diff.added.push(key);
      } else if (currentSettings[key] !== backupValue) {
        diff.modified.push({
          key,
          current: currentSettings[key],
          backup: backupValue
        });
      } else {
        diff.unchanged.push(key);
      }
    }
    
    // Check for removed
    for (const key of Object.keys(currentSettings)) {
      if (!(key in backupSettings)) {
        diff.removed.push(key);
      }
    }
    
    res.json({
      success: true,
      diff,
      stats: {
        total: Object.keys(backupSettings).length,
        added: diff.added.length,
        removed: diff.removed.length,
        modified: diff.modified.length,
        unchanged: diff.unchanged.length
      }
    });
  } catch (error) {
    console.error('Error comparing config:', error);
    res.status(500).json({ error: 'Failed to compare config' });
  }
});

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`DroneDiagnostics backend running on port ${PORT}`);
});

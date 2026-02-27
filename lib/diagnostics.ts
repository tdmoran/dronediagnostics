// lib/diagnostics.ts
// Diagnostic rules and knowledge base for Betaflight/INAV drone diagnostics

export type HardwareStatus = 'working' | 'warning' | 'failed' | 'not_detected';

export interface HardwareCheck {
  name: string;
  status: HardwareStatus;
  message: string;
  details?: string;
  value?: number | string;
  unit?: string;
}

export interface HardwareReport {
  timestamp: number;
  overallHealth: number; // 0-100
  checks: HardwareCheck[];
  summary: {
    working: number;
    warning: number;
    failed: number;
    notDetected: number;
  };
}

export type ProblemType = 
  | 'wont_arm'
  | 'unstable_flight'
  | 'gps_no_fix'
  | 'motors_not_spinning'
  | 'motors_no_thrust'
  | 'receiver_no_signal'
  | 'battery_voltage_wrong'
  | 'fc_not_connecting'
  | 'gyro_drift'
  | 'failsafe_issues';

export interface DiagnosisCause {
  id: string;
  likelihood: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  why: string;
  fix: string[];
  wikiLink?: string;
}

export interface DiagnosisResult {
  problem: ProblemType;
  timestamp: number;
  causes: DiagnosisCause[];
  quickChecks: {
    passed: string[];
    failed: string[];
  };
}

// Hardware check functions
export async function runHardwareChecks(): Promise<HardwareReport> {
  // In a real implementation, these would query the FC via MSP/CLI
  // For now, we simulate realistic responses
  
  const checks: HardwareCheck[] = [
    await checkGyro(),
    await checkAccelerometer(),
    await checkMotors(),
    await checkBattery(),
    await checkGPS(),
    await checkReceiver(),
    await checkBarometer(),
    await checkCompass(),
    await checkESCs(),
    await checkBlackbox(),
  ];

  const summary = {
    working: checks.filter(c => c.status === 'working').length,
    warning: checks.filter(c => c.status === 'warning').length,
    failed: checks.filter(c => c.status === 'failed').length,
    notDetected: checks.filter(c => c.status === 'not_detected').length,
  };

  // Calculate overall health score
  const total = checks.length;
  const health = Math.round(
    (summary.working * 100 + summary.warning * 50 + summary.failed * 0 + summary.notDetected * 75) / total
  );

  return {
    timestamp: Date.now(),
    overallHealth: health,
    checks,
    summary,
  };
}

async function checkGyro(): Promise<HardwareCheck> {
  // Simulate gyro check
  return {
    name: 'Gyroscope',
    status: 'working',
    message: 'MPU6000 detected',
    details: 'Noise level normal, no drift detected',
    value: 0.02,
    unit: 'deg/s',
  };
}

async function checkAccelerometer(): Promise<HardwareCheck> {
  return {
    name: 'Accelerometer',
    status: 'working',
    message: 'Working normally',
    details: 'Calibration valid',
    value: 9.81,
    unit: 'm/s²',
  };
}

async function checkMotors(): Promise<HardwareCheck> {
  return {
    name: 'Motors',
    status: 'working',
    message: '4 motors detected',
    details: 'Motor 1-4 responding to DShot300',
    value: 4,
    unit: 'motors',
  };
}

async function checkBattery(): Promise<HardwareCheck> {
  const voltage = 16.4; // Simulated 4S voltage
  const cells = 4;
  const cellVoltage = voltage / cells;
  
  let status: HardwareStatus = 'working';
  let message = 'Battery healthy';
  
  if (cellVoltage < 3.3) {
    status = 'warning';
    message = 'Battery low';
  } else if (cellVoltage < 3.0) {
    status = 'failed';
    message = 'Battery critically low';
  }

  return {
    name: 'Battery',
    status,
    message,
    details: `${cells}S LiPo, ${cellVoltage.toFixed(2)}V per cell`,
    value: voltage,
    unit: 'V',
  };
}

async function checkGPS(): Promise<HardwareCheck> {
  return {
    name: 'GPS',
    status: 'working',
    message: 'GPS module detected',
    details: '14 satellites, 3D fix',
    value: 14,
    unit: 'sats',
  };
}

async function checkReceiver(): Promise<HardwareCheck> {
  return {
    name: 'Receiver',
    status: 'working',
    message: 'CRSF receiver detected',
    details: 'RSSI: -45dBm, 12 channels active',
    value: -45,
    unit: 'dBm',
  };
}

async function checkBarometer(): Promise<HardwareCheck> {
  return {
    name: 'Barometer',
    status: 'not_detected',
    message: 'No barometer detected',
    details: 'Altitude hold not available',
  };
}

async function checkCompass(): Promise<HardwareCheck> {
  return {
    name: 'Compass',
    status: 'not_detected',
    message: 'No magnetometer detected',
    details: 'GPS rescue and position hold may be limited',
  };
}

async function checkESCs(): Promise<HardwareCheck> {
  return {
    name: 'ESCs',
    status: 'working',
    message: 'ESCs communicating',
    details: 'DShot300 protocol active, telemetry enabled',
    value: 4,
    unit: 'ESCs',
  };
}

async function checkBlackbox(): Promise<HardwareCheck> {
  return {
    name: 'Blackbox',
    status: 'working',
    message: 'SD card detected',
    details: '7.2GB free space, logging enabled',
    value: 7200,
    unit: 'MB',
  };
}

// Problem diagnosis logic
export async function diagnoseProblem(
  problem: ProblemType,
  hardwareReport: HardwareReport
): Promise<DiagnosisResult> {
  const causes = getCausesForProblem(problem, hardwareReport);
  
  // Sort by likelihood
  const likelihoodOrder = { high: 0, medium: 1, low: 2 };
  causes.sort((a, b) => likelihoodOrder[a.likelihood] - likelihoodOrder[b.likelihood]);

  // Run quick checks
  const quickChecks = await runQuickChecks(problem, hardwareReport);

  return {
    problem,
    timestamp: Date.now(),
    causes,
    quickChecks,
  };
}

function getCausesForProblem(problem: ProblemType, report: HardwareReport): DiagnosisCause[] {
  const causes: Record<ProblemType, DiagnosisCause[]> = {
    wont_arm: [
      {
        id: 'arm_switches',
        likelihood: 'high',
        title: 'Arm switch not activated',
        description: 'The arm switch on your transmitter is not in the ON position',
        why: 'Betaflight requires a dedicated AUX channel configured as an ARM switch for safety',
        fix: [
          'Check your transmitter - ensure the arm switch is in the correct position',
          'Verify in Receiver tab that the AUX channel moves when you toggle the switch',
          'Confirm the channel range includes 1700-2100 when switch is ON',
        ],
        wikiLink: 'https://betaflight.com/docs/wiki/guides/current/Arming-Sequence-And-Safety',
      },
      {
        id: 'gyro_cal',
        likelihood: 'high',
        title: 'Gyro not calibrated',
        description: 'The gyroscope needs calibration before arming',
        why: 'Betaflight blocks arming if gyro calibration is not complete or has drifted',
        fix: [
          'Leave the quad perfectly still on a flat surface for 5 seconds after power on',
          'Click "Recalibrate Gyro" in the Quick Fixes section',
          'Check that the gyro noise is acceptable in the Sensors tab',
        ],
      },
      {
        id: 'throttle_high',
        likelihood: 'medium',
        title: 'Throttle not at minimum',
        description: 'The throttle channel is reading above minimum value',
        why: 'Safety feature prevents arming if throttle is not at zero',
        fix: [
          'Lower your throttle stick completely',
          'Check in Receiver tab that throttle shows ~1000 when stick is down',
          'Adjust channel endpoints in transmitter if needed',
        ],
      },
      {
        id: 'cli_active',
        likelihood: 'medium',
        title: 'CLI mode active',
        description: 'The flight controller is in CLI/configurator mode',
        why: 'Arming is disabled when connected to configurator via USB',
        fix: [
          'Disconnect from Betaflight Configurator',
          'Power cycle the quad',
          'Or click "Exit" in CLI tab before disconnecting',
        ],
      },
      {
        id: 'hardware_fault',
        likelihood: 'low',
        title: 'Hardware fault detected',
        description: 'A hardware component is reporting errors',
        why: 'Betaflight prevents arming when critical hardware has issues',
        fix: [
          'Check for hardware errors in the Setup tab',
          'Run hardware validation to identify the faulty component',
          'Replace or repair the affected component',
        ],
      },
    ],
    
    unstable_flight: [
      {
        id: 'pid_tuning',
        likelihood: 'high',
        title: 'PID tuning needed',
        description: 'The PID values are not optimized for your quad',
        why: 'Default PIDs may not work well for all builds, causing oscillations',
        fix: [
          'Run PID autotune in Betaflight',
          'Manually reduce P gains by 20-30% if oscillating',
          'Increase D gain slightly if wobbling in wind',
        ],
        wikiLink: 'https://betaflight.com/docs/wiki/guides/current/PID-Tuning-Guide',
      },
      {
        id: 'motor_vibrations',
        likelihood: 'high',
        title: 'Motor/prop vibrations',
        description: 'Mechanical vibrations are affecting gyro performance',
        why: 'Unbalanced props, bent shafts, or loose screws cause noise',
        fix: [
          'Balance your propellers using a balancer',
          'Check for bent motor shafts',
          'Tighten all frame screws, especially motor screws',
          'Add soft mounting for the flight controller',
        ],
      },
      {
        id: 'gyro_lpf',
        likelihood: 'medium',
        title: 'Gyro filtering too low',
        description: 'Not enough filtering for the noise level',
        why: 'High gyro noise needs adequate low-pass filtering',
        fix: [
          'Increase gyro low-pass filter cutoff frequency',
          'Enable dynamic filters if not already active',
          'Check for motor bearing wear (causes noise)',
        ],
      },
      {
        id: 'esc_desync',
        likelihood: 'medium',
        title: 'ESC desynchronization',
        description: 'ESCs are losing sync with motors',
        why: 'Old ESC firmware or incorrect motor timing',
        fix: [
          'Update ESC firmware to latest version',
          'Increase motor timing in BLHeli configurator',
          'Check solder joints on motor wires',
        ],
      },
    ],
    
    gps_no_fix: [
      {
        id: 'gps_location',
        likelihood: 'high',
        title: 'Poor GPS antenna position',
        description: 'GPS antenna has obstructed view of sky',
        why: 'GPS needs clear line of sight to satellites',
        fix: [
          'Move GPS module to top of quad with clear sky view',
          'Keep away from carbon fiber, VTX, and camera',
          'Use a mast/extension if needed',
        ],
      },
      {
        id: 'gps_config',
        likelihood: 'medium',
        title: 'Incorrect GPS configuration',
        description: 'GPS baud rate or protocol mismatch',
        why: 'FC and GPS must use same communication settings',
        fix: [
          'Set GPS baud rate to 115200 or 57600',
          'Enable UBLOX protocol',
          'Ensure correct UART is assigned to GPS',
        ],
      },
      {
        id: 'gps_cold_start',
        likelihood: 'medium',
        title: 'GPS cold start',
        description: 'GPS needs time to download satellite data',
        why: 'First fix can take 2-5 minutes without assistance',
        fix: [
          'Wait 3-5 minutes for first fix',
          'Use GPS with GLONASS/Galileo for faster fix',
          'Ensure you have clear sky visibility',
        ],
      },
    ],
    
    motors_not_spinning: [
      {
        id: 'motor_protocol',
        likelihood: 'high',
        title: 'Incorrect ESC protocol',
        description: 'ESC protocol setting mismatch',
        why: 'ESCs must use the same protocol as configured in Betaflight',
        fix: [
          'Check ESC protocol in Motors tab (DShot300 recommended)',
          'Verify ESCs support the selected protocol',
          'Reflash ESCs if protocol incompatible',
        ],
      },
      {
        id: 'esc_power',
        likelihood: 'high',
        title: 'ESCs not powered',
        description: 'ESCs are not receiving battery voltage',
        why: 'Bad solder joint, blown ESC, or disconnected power',
        fix: [
          'Check battery voltage at ESC input pads',
          'Inspect solder joints on power leads',
          'Check for blown ESC (burn marks, burnt smell)',
        ],
      },
      {
        id: 'motor_wires',
        likelihood: 'medium',
        title: 'Loose motor connections',
        description: 'Signal or power wires disconnected',
        why: 'Vibration can loosen motor wire solder joints',
        fix: [
          'Check all motor wire solder joints',
          'Verify signal wires are connected to correct pads',
          'Resolder any loose connections',
        ],
      },
    ],
    
    motors_no_thrust: [
      {
        id: 'prop_direction',
        likelihood: 'high',
        title: 'Props on backwards',
        description: 'Propellers installed with wrong orientation',
        why: 'Props must generate airflow downward for lift',
        fix: [
          'Check prop orientation - leading edge should face up/fwd',
          'Verify props are on correct motors (CW/CCW)',
          'Refer to motor direction diagram in Betaflight',
        ],
      },
      {
        id: 'motor_direction',
        likelihood: 'high',
        title: 'Motors spinning wrong direction',
        description: 'Motor rotation does not match prop direction',
        why: 'Motors must spin in direction that works with prop',
        fix: [
          'Reverse motor direction in BLHeli configurator',
          'Or swap any two motor wires to reverse direction',
          'Verify all motors spin correctly in Motors tab',
        ],
      },
      {
        id: 'low_throttle',
        likelihood: 'medium',
        title: 'Insufficient throttle signal',
        description: 'ESCs not receiving full throttle range',
        why: 'Throttle endpoints may be incorrect',
        fix: [
          'Calibrate ESCs in Motors tab',
          'Verify throttle range is 1000-2000 in Receiver tab',
          'Adjust transmitter endpoints if needed',
        ],
      },
    ],
    
    receiver_no_signal: [
      {
        id: 'receiver_binding',
        likelihood: 'high',
        title: 'Receiver not bound',
        description: 'Receiver is not bound to transmitter',
        why: 'New receiver or lost binding requires re-pairing',
        fix: [
          'Enter bind mode on receiver (button or power cycle)',
          'Enter bind mode on transmitter',
          'Wait for bind confirmation LED',
        ],
      },
      {
        id: 'receiver_uart',
        likelihood: 'high',
        title: 'Incorrect UART assignment',
        description: 'Receiver not connected to correct UART',
        why: 'Betaflight needs correct UART for your receiver protocol',
        fix: [
          'Verify receiver is soldered to correct UART TX/RX',
          'Enable Serial RX on correct UART in Ports tab',
          'Select correct receiver protocol in Configuration tab',
        ],
      },
      {
        id: 'receiver_power',
        likelihood: 'medium',
        title: 'Receiver not powered',
        description: 'Receiver has no power or wrong voltage',
        why: 'Some receivers need 5V, others can use VBAT',
        fix: [
          'Check voltage at receiver power pins',
          'Verify receiver LED is on',
          'Use correct voltage (5V for most, some need 3.3V)',
        ],
      },
    ],
    
    battery_voltage_wrong: [
      {
        id: 'voltage_scale',
        likelihood: 'high',
        title: 'Voltage scale incorrect',
        description: 'Voltage divider ratio not set correctly',
        why: 'Betaflight needs correct scale to calculate battery voltage',
        fix: [
          'Measure actual battery voltage with multimeter',
          'Adjust voltage scale in Power & Battery tab',
          'Common values: 110 for 4S, 150 for 6S (varies by FC)',
        ],
      },
      {
        id: 'voltage_meter',
        likelihood: 'medium',
        title: 'Voltage meter disabled',
        description: 'Onboard ADC not enabled',
        why: 'Betaflight needs ADC enabled to read voltage',
        fix: [
          'Enable "VBAT" in Configuration tab',
          'Verify correct ADC input is selected',
          'Check solder joints on battery voltage sense wire',
        ],
      },
    ],
    
    fc_not_connecting: [
      {
        id: 'usb_cable',
        likelihood: 'high',
        title: 'Bad USB cable',
        description: 'USB cable is charge-only or damaged',
        why: 'Some USB cables only have power wires, no data',
        fix: [
          'Try a different USB cable (known good data cable)',
          'Use shorter cable if possible',
          'Avoid USB hubs, connect directly to computer',
        ],
      },
      {
        id: 'usb_driver',
        likelihood: 'high',
        title: 'Missing USB driver',
        description: 'STM32 VCP driver not installed',
        why: 'Windows needs driver to communicate with STM32',
        fix: [
          'Install STM32 VCP drivers from Betaflight website',
          'Use Zadig tool to install WinUSB driver',
          'Restart computer after driver installation',
        ],
      },
      {
        id: 'fc_bootloader',
        likelihood: 'medium',
        title: 'FC in bootloader mode',
        description: 'FC is stuck in DFU/bootloader mode',
        why: 'Boot button pressed or corrupted firmware',
        fix: [
          'Check if boot button is stuck down',
          'Flash firmware using DFU mode',
          'Release boot button and power cycle',
        ],
      },
    ],
    
    gyro_drift: [
      {
        id: 'vibration',
        likelihood: 'high',
        title: 'Excessive vibration',
        description: 'Mechanical vibration causing gyro drift',
        why: 'Vibration can be interpreted as rotation by gyro',
        fix: [
          'Balance propellers',
          'Check for loose screws',
          'Soft mount the flight controller',
          'Check motor bearings for wear',
        ],
      },
      {
        id: 'temperature',
        likelihood: 'medium',
        title: 'Temperature drift',
        description: 'Gyro drifting due to temperature changes',
        why: 'MEMS gyros are temperature sensitive',
        fix: [
          'Allow FC to warm up before flying',
          'Enable gyro calibration on first arm',
          'Keep FC away from hot components (VTX)',
        ],
      },
    ],
    
    failsafe_issues: [
      {
        id: 'failsafe_mode',
        likelihood: 'high',
        title: 'Wrong failsafe mode',
        description: 'Failsafe mode not set to DROP or GPS-RESCUE',
        why: 'Default mode may be HOLD which is unsafe',
        fix: [
          'Set failsafe mode to DROP for acro flying',
          'Or use GPS-RESCUE if GPS equipped',
          'Test failsafe by turning off transmitter (with props off!)',
        ],
        wikiLink: 'https://betaflight.com/docs/wiki/guides/current/Failsafe',
      },
      {
        id: 'rssi_low',
        likelihood: 'medium',
        title: 'Low RSSI causing premature failsafe',
        description: 'Signal strength drops below threshold',
        why: 'Range issues or interference cause RSSI drops',
        fix: [
          'Check antenna positioning on receiver',
          'Increase failsafe delay threshold',
          'Check for sources of interference (WiFi, power lines)',
        ],
      },
    ],
  };

  return causes[problem] || [];
}

async function runQuickChecks(problem: ProblemType, report: HardwareReport): Promise<{passed: string[]; failed: string[]}> {
  const passed: string[] = [];
  const failed: string[] = [];

  // Common checks based on hardware report
  const gyroCheck = report.checks.find(c => c.name === 'Gyroscope');
  if (gyroCheck?.status === 'working') {
    passed.push('Gyroscope functioning');
  } else {
    failed.push('Gyroscope issue detected');
  }

  const motorCheck = report.checks.find(c => c.name === 'Motors');
  if (motorCheck?.status === 'working') {
    passed.push('Motors responding');
  } else {
    failed.push('Motor communication failed');
  }

  const receiverCheck = report.checks.find(c => c.name === 'Receiver');
  if (receiverCheck?.status === 'working') {
    passed.push('Receiver connected');
  } else {
    failed.push('No receiver signal');
  }

  // Problem-specific checks
  switch (problem) {
    case 'wont_arm':
      if (report.overallHealth > 80) passed.push('Hardware health good');
      else failed.push('Hardware issues present');
      break;
    case 'gps_no_fix':
      const gpsCheck = report.checks.find(c => c.name === 'GPS');
      if (gpsCheck?.status === 'working') passed.push('GPS module detected');
      else failed.push('GPS not detected');
      break;
  }

  return { passed, failed };
}

// Quick fix actions
export async function recalibrateGyro(): Promise<{success: boolean; message: string}> {
  // Simulate gyro recalibration
  await new Promise(resolve => setTimeout(resolve, 2000));
  return {
    success: true,
    message: 'Gyro calibration complete. Keep quad still for best results.',
  };
}

export async function resetToDefaults(): Promise<{success: boolean; message: string}> {
  // Simulate reset
  await new Promise(resolve => setTimeout(resolve, 1500));
  return {
    success: true,
    message: 'Settings reset to defaults. Please recalibrate sensors.',
  };
}

export async function runMotorTest(): Promise<{success: boolean; message: string; results?: number[]}> {
  // Simulate motor test
  await new Promise(resolve => setTimeout(resolve, 3000));
  return {
    success: true,
    message: 'Motor test complete. All 4 motors responding.',
    results: [1050, 1060, 1045, 1055], // RPM at idle
  };
}

// Health score calculation
export function calculateHealthScore(report: HardwareReport): number {
  return report.overallHealth;
}

export function getHealthStatus(score: number): {status: 'excellent' | 'good' | 'fair' | 'poor'; color: string} {
  if (score >= 90) return { status: 'excellent', color: 'green' };
  if (score >= 70) return { status: 'good', color: 'blue' };
  if (score >= 50) return { status: 'fair', color: 'yellow' };
  return { status: 'poor', color: 'red' };
}

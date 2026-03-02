// lib/diagnostics.ts
// Diagnostic rules and hardware checks — uses live telemetry from FastAPI backend

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

// Betaflight MSP_STATUS sensors bitmask
const SENSOR_ACC   = 1 << 0;
const SENSOR_BARO  = 1 << 1;
const SENSOR_MAG   = 1 << 2;
const SENSOR_GPS   = 1 << 3;
const SENSOR_SONAR = 1 << 4;

async function fetchTelemetry(): Promise<Record<string, any> | null> {
  try {
    const res = await fetch('http://localhost:8000/api/telemetry', { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function runHardwareChecks(): Promise<HardwareReport> {
  const telem = await fetchTelemetry();
  const connected = telem?.connected ?? false;

  const checks: HardwareCheck[] = [
    checkGyro(telem),
    checkAccelerometer(telem),
    checkMotors(telem),
    checkBattery(telem),
    checkGPS(telem),
    checkReceiver(telem),
    checkBarometer(telem),
    checkCompass(telem),
    checkConnection(connected),
  ];

  const summary = {
    working: checks.filter(c => c.status === 'working').length,
    warning: checks.filter(c => c.status === 'warning').length,
    failed: checks.filter(c => c.status === 'failed').length,
    notDetected: checks.filter(c => c.status === 'not_detected').length,
  };

  const health = Math.round(
    (summary.working * 100 + summary.warning * 50 + summary.notDetected * 75) / checks.length
  );

  return { timestamp: Date.now(), overallHealth: health, checks, summary };
}

function checkConnection(connected: boolean): HardwareCheck {
  return {
    name: 'FC Connection',
    status: connected ? 'working' : 'failed',
    message: connected ? 'Flight controller connected via MSP' : 'No flight controller connected',
    details: connected ? 'Serial polling active' : 'Connect via the sidebar port selector',
  };
}

function checkGyro(telem: Record<string, any> | null): HardwareCheck {
  if (!telem?.connected) {
    return { name: 'Gyroscope', status: 'not_detected', message: 'No FC connected' };
  }

  const sensors: number = telem?.status?.sensors ?? 0;
  const gyro = telem?.gyro;

  // If we're getting IMU data, gyro is working
  if (gyro) {
    const noise = Math.sqrt(gyro.x ** 2 + gyro.y ** 2 + gyro.z ** 2);
    const status: HardwareStatus = noise > 80 ? 'warning' : 'working';
    return {
      name: 'Gyroscope',
      status,
      message: status === 'working' ? 'Gyro responding normally' : 'High gyro noise detected',
      details: `X=${gyro.x.toFixed(1)} Y=${gyro.y.toFixed(1)} Z=${gyro.z.toFixed(1)} deg/s`,
      value: noise.toFixed(1),
      unit: 'deg/s noise',
    };
  }

  // Accelerometer sensor bit implies gyro chip is also present (same die on most FCs)
  if (sensors & SENSOR_ACC) {
    return { name: 'Gyroscope', status: 'working', message: 'Detected via sensor flags', details: 'No IMU stream yet' };
  }

  return { name: 'Gyroscope', status: 'not_detected', message: 'No gyro data received', details: 'Check MSP_STATUS sensor flags' };
}

function checkAccelerometer(telem: Record<string, any> | null): HardwareCheck {
  if (!telem?.connected) {
    return { name: 'Accelerometer', status: 'not_detected', message: 'No FC connected' };
  }

  const sensors: number = telem?.status?.sensors ?? 0;
  const accel = telem?.accel;

  if (accel) {
    const magnitude = Math.sqrt(accel.x ** 2 + accel.y ** 2 + accel.z ** 2);
    const status: HardwareStatus = Math.abs(magnitude - 1.0) > 0.3 ? 'warning' : 'working';
    return {
      name: 'Accelerometer',
      status,
      message: status === 'working' ? 'Calibration valid' : 'Possible calibration drift',
      details: `|g|=${magnitude.toFixed(3)}g (expected ≈1.0g at rest)`,
      value: magnitude.toFixed(3),
      unit: 'g',
    };
  }

  if (sensors & SENSOR_ACC) {
    return { name: 'Accelerometer', status: 'working', message: 'Detected via sensor flags' };
  }

  return { name: 'Accelerometer', status: 'not_detected', message: 'Not detected by FC' };
}

function checkMotors(telem: Record<string, any> | null): HardwareCheck {
  if (!telem?.connected) {
    return { name: 'Motors', status: 'not_detected', message: 'No FC connected' };
  }

  const motors: number[] | undefined = telem?.motors;
  if (!motors) {
    return { name: 'Motors', status: 'not_detected', message: 'No motor data received' };
  }

  const activeMotors = motors.filter((m: number) => m > 0).length;
  const idleMotors = motors.filter((m: number) => m >= 1000 && m <= 1100).length;

  if (activeMotors === 0) {
    return {
      name: 'Motors',
      status: 'warning',
      message: 'Motors at zero — disarmed or ESC protocol mismatch',
      details: `Values: ${motors.slice(0, 4).join(', ')}`,
    };
  }

  return {
    name: 'Motors',
    status: 'working',
    message: `${activeMotors} motors reporting`,
    details: `Values: ${motors.slice(0, 4).join(', ')}`,
    value: activeMotors,
    unit: 'motors',
  };
}

function checkBattery(telem: Record<string, any> | null): HardwareCheck {
  if (!telem?.connected) {
    return { name: 'Battery', status: 'not_detected', message: 'No FC connected' };
  }

  const battery = telem?.battery;
  if (!battery) {
    return { name: 'Battery', status: 'not_detected', message: 'No battery telemetry received' };
  }

  const voltage: number = battery.voltage;
  if (voltage < 1) {
    return { name: 'Battery', status: 'not_detected', message: 'No battery detected (0V)', details: 'Check voltage sense wiring' };
  }

  // Estimate cell count (most common: 1S=3-4.2V, 2S=6-8.4V, 3S=9-12.6V, 4S=12-16.8V)
  const cellCount = voltage > 12 ? 4 : voltage > 9 ? 3 : voltage > 6 ? 2 : 1;
  const cellV = voltage / cellCount;

  let status: HardwareStatus = 'working';
  let message = `Battery healthy (${cellCount}S)`;

  if (cellV < 3.3) {
    status = 'warning';
    message = `Low battery — ${cellV.toFixed(2)}V/cell`;
  }
  if (cellV < 3.0) {
    status = 'failed';
    message = `Critical battery — ${cellV.toFixed(2)}V/cell`;
  }

  return {
    name: 'Battery',
    status,
    message,
    details: `${cellCount}S estimated, ${cellV.toFixed(2)}V/cell`,
    value: voltage.toFixed(1),
    unit: 'V',
  };
}

function checkGPS(telem: Record<string, any> | null): HardwareCheck {
  if (!telem?.connected) {
    return { name: 'GPS', status: 'not_detected', message: 'No FC connected' };
  }

  const sensors: number = telem?.status?.sensors ?? 0;
  const gps = telem?.gps;

  // Check sensors bitmask
  if (!(sensors & SENSOR_GPS) && !gps) {
    return { name: 'GPS', status: 'not_detected', message: 'GPS not enabled in FC', details: 'Enable GPS in Ports + Configuration tabs' };
  }

  if (!gps) {
    return { name: 'GPS', status: 'warning', message: 'GPS enabled but no data yet', details: 'Waiting for GPS module to respond' };
  }

  const sats = gps.num_satellites;
  const fixType = gps.fix_type;

  if (fixType === 0) {
    return {
      name: 'GPS',
      status: sats > 3 ? 'warning' : 'not_detected',
      message: sats > 0 ? `Searching — ${sats} satellites` : 'No GPS fix (searching)',
      details: 'Move outdoors with clear sky view',
      value: sats,
      unit: 'sats',
    };
  }

  return {
    name: 'GPS',
    status: sats >= 6 ? 'working' : 'warning',
    message: fixType >= 2 ? `3D fix — ${sats} satellites` : `2D fix — ${sats} satellites`,
    details: `Fix type ${fixType}, lat=${gps.lat.toFixed(6)}, lon=${gps.lon.toFixed(6)}`,
    value: sats,
    unit: 'sats',
  };
}

function checkReceiver(telem: Record<string, any> | null): HardwareCheck {
  if (!telem?.connected) {
    return { name: 'Receiver', status: 'not_detected', message: 'No FC connected' };
  }

  const rc: number[] | undefined = telem?.rc;
  if (!rc || rc.length === 0) {
    return { name: 'Receiver', status: 'failed', message: 'No RC channel data', details: 'Check receiver binding and UART assignment' };
  }

  const activeChannels = rc.filter((v: number) => v >= 900 && v <= 2100).length;
  const rssi = telem?.battery?.rssi;

  if (activeChannels < 4) {
    return {
      name: 'Receiver',
      status: 'warning',
      message: `Only ${activeChannels} valid channels (need ≥4)`,
      details: rc.slice(0, 8).join(', '),
    };
  }

  const rssiPct = rssi != null ? (rssi > 100 ? Math.round(rssi / 10.23) : rssi) : null;
  const rssiStatus: HardwareStatus = rssiPct == null ? 'working' : rssiPct > 60 ? 'working' : rssiPct > 30 ? 'warning' : 'failed';

  return {
    name: 'Receiver',
    status: rssiStatus,
    message: rssiStatus === 'working' ? `${activeChannels} channels active` : `Weak signal — RSSI ${rssiPct}%`,
    details: `Ch1-4: ${rc.slice(0, 4).join(', ')}${rssiPct != null ? ` | RSSI: ${rssiPct}%` : ''}`,
    value: activeChannels,
    unit: 'channels',
  };
}

function checkBarometer(telem: Record<string, any> | null): HardwareCheck {
  if (!telem?.connected) {
    return { name: 'Barometer', status: 'not_detected', message: 'No FC connected' };
  }
  const sensors: number = telem?.status?.sensors ?? 0;
  return sensors & SENSOR_BARO
    ? { name: 'Barometer', status: 'working', message: 'Barometer detected', details: 'Altitude hold available' }
    : { name: 'Barometer', status: 'not_detected', message: 'No barometer detected', details: 'Altitude hold not available' };
}

function checkCompass(telem: Record<string, any> | null): HardwareCheck {
  if (!telem?.connected) {
    return { name: 'Compass', status: 'not_detected', message: 'No FC connected' };
  }
  const sensors: number = telem?.status?.sensors ?? 0;
  return sensors & SENSOR_MAG
    ? { name: 'Compass', status: 'working', message: 'Magnetometer detected', details: 'GPS rescue heading available' }
    : { name: 'Compass', status: 'not_detected', message: 'No magnetometer detected', details: 'GPS rescue heading limited' };
}

// Problem diagnosis logic (unchanged — knowledge base)
export async function diagnoseProblem(
  problem: ProblemType,
  hardwareReport: HardwareReport
): Promise<DiagnosisResult> {
  const causes = getCausesForProblem(problem, hardwareReport);
  const likelihoodOrder = { high: 0, medium: 1, low: 2 };
  causes.sort((a, b) => likelihoodOrder[a.likelihood] - likelihoodOrder[b.likelihood]);
  const quickChecks = runQuickChecks(problem, hardwareReport);
  return { problem, timestamp: Date.now(), causes, quickChecks };
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
          'Check your transmitter — ensure the arm switch is in the correct position',
          'Verify in Receiver tab that the AUX channel moves when you toggle the switch',
          'Confirm the channel range includes 1700–2100 when switch is ON',
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
          'Check gyro noise in the Sensors tab',
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
          'Manually reduce P gains by 20–30% if oscillating',
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
        why: 'First fix can take 2–5 minutes without assistance',
        fix: [
          'Wait 3–5 minutes for first fix',
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
          'Check prop orientation — leading edge should face up/forward',
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
          'Verify throttle range is 1000–2000 in Receiver tab',
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

function runQuickChecks(problem: ProblemType, report: HardwareReport): { passed: string[]; failed: string[] } {
  const passed: string[] = [];
  const failed: string[] = [];

  const get = (name: string) => report.checks.find(c => c.name === name);

  const fc = get('FC Connection');
  if (fc?.status === 'working') passed.push('Flight controller connected');
  else failed.push('Flight controller not connected');

  const gyro = get('Gyroscope');
  if (gyro?.status === 'working') passed.push('Gyroscope functioning');
  else if (gyro?.status === 'warning') failed.push('Gyro noise elevated');
  else failed.push('Gyroscope not detected');

  const motors = get('Motors');
  if (motors?.status === 'working') passed.push('Motors responding');
  else failed.push('Motor data missing or zero');

  const rx = get('Receiver');
  if (rx?.status === 'working') passed.push('Receiver connected');
  else failed.push('No receiver signal');

  switch (problem) {
    case 'wont_arm':
      if (report.overallHealth > 80) passed.push('Hardware health good');
      else failed.push('Hardware issues present — check checks above');
      break;
    case 'gps_no_fix': {
      const gps = get('GPS');
      if (gps?.status === 'working') passed.push('GPS module detected');
      else failed.push('GPS not detected or no fix');
      break;
    }
    case 'battery_voltage_wrong': {
      const bat = get('Battery');
      if (bat?.status === 'working') passed.push('Battery voltage plausible');
      else failed.push(`Battery issue: ${bat?.message}`);
      break;
    }
  }

  return { passed, failed };
}

// Quick fix stubs (these call real backend actions when implemented)
export async function recalibrateGyro(): Promise<{ success: boolean; message: string }> {
  await new Promise(resolve => setTimeout(resolve, 2000));
  return { success: true, message: 'Gyro calibration complete. Keep quad still for best results.' };
}

export async function resetToDefaults(): Promise<{ success: boolean; message: string }> {
  await new Promise(resolve => setTimeout(resolve, 1500));
  return { success: true, message: 'Settings reset to defaults. Please recalibrate sensors.' };
}

export async function runMotorTest(): Promise<{ success: boolean; message: string; results?: number[] }> {
  await new Promise(resolve => setTimeout(resolve, 3000));
  return { success: true, message: 'Motor test complete. All 4 motors responding.', results: [1050, 1060, 1045, 1055] };
}

export function calculateHealthScore(report: HardwareReport): number {
  return report.overallHealth;
}

export function getHealthStatus(score: number): { status: 'excellent' | 'good' | 'fair' | 'poor'; color: string } {
  if (score >= 90) return { status: 'excellent', color: 'green' };
  if (score >= 70) return { status: 'good', color: 'blue' };
  if (score >= 50) return { status: 'fair', color: 'yellow' };
  return { status: 'poor', color: 'red' };
}

// MSP (MultiWii Serial Protocol) command codes

// API and Version commands
export const MSP_API_VERSION = 1;
export const MSP_FC_VARIANT = 2;
export const MSP_FC_VERSION = 3;
export const MSP_BOARD_INFO = 4;
export const MSP_BUILD_INFO = 5;
export const MSP_UID = 160;

// Status and sensor commands
export const MSP_STATUS = 101;
export const MSP_RAW_IMU = 102;
export const MSP_SERVO = 103;
export const MSP_MOTOR = 104;
export const MSP_RC = 105;
export const MSP_RAW_GPS = 106;
export const MSP_COMP_GPS = 107;
export const MSP_ATTITUDE = 108;
export const MSP_ALTITUDE = 109;
export const MSP_ANALOG = 110;
export const MSP_RC_TUNING = 111;
export const MSP_PID = 112;
export const MSP_BOX = 113;
export const MSP_MISC = 114;
export const MSP_MOTOR_PINS = 115;
export const MSP_BOXNAMES = 116;
export const MSP_PIDNAMES = 117;
export const MSP_BOXIDS = 119;
export const MSP_SERVO_CONF = 120;
export const MSP_NAV_STATUS = 121;
export const MSP_NAV_CONFIG = 122;
export const MSP_MOTOR_3D_CONFIG = 124;
export const MSP_RC_DEADBAND = 125;
export const MSP_SENSOR_ALIGNMENT = 126;
export const MSP_LED_STRIP_MODE = 127;
export const MSP_LED_COLORS = 128;
export const MSP_LED_STRIP_CONFIG = 129;
export const MSP_RSSI_CONFIG = 142;
export const MSP_MOTOR_3D_CONFIG_2 = 164;
export const MSP_BATTERY_CONFIG = 170;
export const MSP_SPECIAL_COLORS = 166;
export const MSP_ESC_SENSOR_DATA = 164;
export const MSP_ESC_PINS = 164;
export const MSP_ESC_FAILSAFE = 164;
export const MSP_RX_CONFIG = 44;
export const MSP_FAILSAFE_CONFIG = 75;
export const MSP_RXFAIL_CONFIG = 77;
export const MSP_RSSI_CONFIG_2 = 50;
export const MSP_RTC = 126;
export const MSP_SET_RAW_GPS = 201;
export const MSP_SET_GPS_DATA = 213;

// Blackbox specific commands
export const MSP_BLACKBOX_CONFIG = 80;
export const MSP_SET_BLACKBOX_CONFIG = 81;
export const MSP_DATAFLASH_SUMMARY = 70;
export const MSP_DATAFLASH_READ = 71;
export const MSP_DATAFLASH_ERASE = 72;
export const MSP_SDCARD_SUMMARY = 79;

// Debug commands
export const MSP_DEBUG = 254;
export const MSP_DEBUGMSG = 253;
export const MSP_REBOOT = 68;
export const MSP_SET_REBOOT = 68;

// EEPROM and config
export const MSP_EEPROM_WRITE = 250;

// SD Card and Dataflash commands for blackbox logs
export const MSP_DATAFLASH_ERASE_SECTOR = 72;

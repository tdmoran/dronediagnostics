"""MSP Serial connection handler for real drone communication."""

import serial
import serial.tools.list_ports
import asyncio
from typing import Optional, Callable
import logging

from msp.protocol import MSPProtocol
from msp.codes import (
    MSP_RAW_GPS, MSP_COMP_GPS, MSP_GPS_DATA,
    MSP_STATUS, MSP_RAW_IMU, MSP_MOTOR, MSP_RC, MSP_ATTITUDE, MSP_ANALOG,
)

logger = logging.getLogger(__name__)


class MSPSerialConnection:
    """Handle serial communication with MSP-compatible flight controller."""
    
    def __init__(self, port: Optional[str] = None, baudrate: int = 115200):
        self.port = port
        self.baudrate = baudrate
        self.serial: Optional[serial.Serial] = None
        self.protocol = MSPProtocol()
        self.running = False
        self._read_task: Optional[asyncio.Task] = None
        self._callbacks: list[Callable] = []
        
    @staticmethod
    def list_ports() -> list[str]:
        """List available serial ports."""
        return [p.device for p in serial.tools.list_ports.comports()]
    
    def connect(self) -> bool:
        """Connect to serial port."""
        if self.serial and self.serial.is_open:
            return True
            
        try:
            self.serial = serial.Serial(
                port=self.port,
                baudrate=self.baudrate,
                bytesize=serial.EIGHTBITS,
                parity=serial.PARITY_NONE,
                stopbits=serial.STOPBITS_ONE,
                timeout=1
            )
            logger.info(f"Connected to {self.port} at {self.baudrate} baud")
            return True
        except Exception as e:
            logger.error(f"Failed to connect to {self.port}: {e}")
            return False
    
    def disconnect(self):
        """Disconnect from serial port."""
        self.running = False
        if self._read_task:
            self._read_task.cancel()
        if self.serial and self.serial.is_open:
            self.serial.close()
            logger.info("Disconnected from serial port")
    
    def send_msp_command(self, command: int, data: bytes = b'') -> bool:
        """Send MSP command to flight controller."""
        if not self.serial or not self.serial.is_open:
            return False
        
        frame = self.protocol.create_msp_request(command, data)
        try:
            self.serial.write(frame)
            return True
        except Exception as e:
            logger.error(f"Failed to send MSP command: {e}")
            return False
    
    def request_gps_data(self) -> bool:
        """Request GPS data from flight controller."""
        return self.send_msp_command(MSP_RAW_GPS)
    
    def read_response(self, timeout: float = 1.0) -> Optional[tuple[int, bytes]]:
        """Read and parse MSP response."""
        if not self.serial or not self.serial.is_open:
            return None

        # Read header — FC responds with $M> (not $M< which is the request direction)
        header = self.serial.read(3)
        if header != self.protocol.RESPONSE_HEADER:
            return None
        
        # Read size and command
        size_cmd = self.serial.read(2)
        if len(size_cmd) != 2:
            return None
        
        size = size_cmd[0]
        command = size_cmd[1]
        
        # Read payload and checksum
        payload_checksum = self.serial.read(size + 1)
        if len(payload_checksum) != size + 1:
            return None
        
        payload = payload_checksum[:-1]
        checksum = payload_checksum[-1]
        
        # Verify checksum
        checksum_data = bytes([size, command]) + payload
        expected_checksum = self.protocol.calculate_checksum(checksum_data)
        
        if checksum != expected_checksum:
            logger.warning(f"Checksum mismatch: expected {expected_checksum}, got {checksum}")
            return None
        
        return command, payload
    
    def process_response(self, command: int, data: bytes):
        """Process any MSP response and dispatch to protocol parser."""
        try:
            if command == MSP_RAW_GPS:
                result = self.protocol.parse_raw_gps(data)
                logger.debug(f"GPS Position: {result.format_decimal()}")
                for callback in self._callbacks:
                    callback('gps', result)

            elif command == MSP_COMP_GPS:
                result = self.protocol.parse_comp_gps(data)
                logger.debug(f"GPS Computed: dist={result.distance_to_home}m")
                for callback in self._callbacks:
                    callback('gps_computed', result)

            elif command == MSP_GPS_DATA:
                result = self.protocol.parse_gps_data(data)
                logger.debug(f"GPS Extended: HDOP={result.hdop}")
                for callback in self._callbacks:
                    callback('gps', result)

            elif command == MSP_RAW_IMU:
                result = self.protocol.parse_raw_imu(data)
                logger.debug(f"IMU: gyro=({result.gyro_x:.1f},{result.gyro_y:.1f},{result.gyro_z:.1f})")
                for callback in self._callbacks:
                    callback('imu', result)

            elif command == MSP_STATUS:
                result = self.protocol.parse_status(data)
                logger.debug(f"Status: cycle={result.cycle_time}us mode={result.flight_mode}")
                for callback in self._callbacks:
                    callback('status', result)

            elif command == MSP_MOTOR:
                result = self.protocol.parse_motor(data)
                logger.debug(f"Motors: {result.motors[:4]}")
                for callback in self._callbacks:
                    callback('motors', result)

            elif command == MSP_RC:
                result = self.protocol.parse_rc(data)
                logger.debug(f"RC: ch1-4={result.channels[:4]}")
                for callback in self._callbacks:
                    callback('rc', result)

            elif command == MSP_ATTITUDE:
                result = self.protocol.parse_attitude(data)
                logger.debug(f"Attitude: R={result.roll:.1f} P={result.pitch:.1f} Y={result.yaw}")
                for callback in self._callbacks:
                    callback('attitude', result)

            elif command == MSP_ANALOG:
                result = self.protocol.parse_analog(data)
                logger.debug(f"Analog: {result.vbat}V {result.amperage}A rssi={result.rssi}")
                for callback in self._callbacks:
                    callback('battery', result)

        except Exception as e:
            logger.error(f"Error processing MSP response (cmd={command}): {e}")
    
    def add_callback(self, callback: Callable):
        """Add callback for GPS data updates."""
        self._callbacks.append(callback)
    
    def remove_callback(self, callback: Callable):
        """Remove callback."""
        if callback in self._callbacks:
            self._callbacks.remove(callback)
    
    # All MSP commands to poll each cycle
    POLL_COMMANDS = [
        MSP_RAW_IMU,    # 102 – gyro + accel
        MSP_STATUS,     # 101 – cycle time, sensors, mode
        MSP_MOTOR,      # 104 – motor outputs
        MSP_RC,         # 105 – RC channels
        MSP_ATTITUDE,   # 108 – roll/pitch/yaw
        MSP_ANALOG,     # 110 – battery voltage, current, RSSI
        MSP_RAW_GPS,    # 106 – GPS position
    ]

    def start_polling_sync(self, interval: float = 0.1):
        """Synchronous polling loop — call via run_in_executor to avoid blocking the event loop."""
        import time
        self.running = True
        logger.info("Serial polling started")

        while self.running:
            try:
                for cmd in self.POLL_COMMANDS:
                    if not self.running:
                        break
                    if self.send_msp_command(cmd):
                        response = self.read_response(timeout=0.5)
                        if response:
                            command, data = response
                            self.process_response(command, data)

                time.sleep(interval)

            except Exception as e:
                logger.error(f"Polling error: {e}")
                time.sleep(interval)

        logger.info("Serial polling stopped")

    async def start_polling(self, interval: float = 0.1):
        """Async wrapper kept for compatibility — prefer start_polling_sync via run_in_executor."""
        self.running = True

        while self.running:
            try:
                for cmd in self.POLL_COMMANDS:
                    if not self.running:
                        break
                    if self.send_msp_command(cmd):
                        response = self.read_response(timeout=0.5)
                        if response:
                            command, data = response
                            self.process_response(command, data)

                await asyncio.sleep(interval)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Polling error: {e}")
                await asyncio.sleep(interval)


# Global serial connection instance
_serial_connection: Optional[MSPSerialConnection] = None


def get_serial_connection() -> Optional[MSPSerialConnection]:
    """Get global serial connection instance."""
    return _serial_connection


def create_serial_connection(port: Optional[str] = None, baudrate: int = 115200) -> MSPSerialConnection:
    """Create new serial connection."""
    global _serial_connection
    _serial_connection = MSPSerialConnection(port, baudrate)
    return _serial_connection

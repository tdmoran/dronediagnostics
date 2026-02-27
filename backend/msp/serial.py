"""MSP Serial connection handler for real drone communication."""

import serial
import serial.tools.list_ports
import asyncio
from typing import Optional, Callable
import logging

from msp.protocol import MSPProtocol
from msp.codes import MSP_RAW_GPS, MSP_COMP_GPS, MSP_GPS_DATA

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
        
        # Read header
        header = self.serial.read(3)
        if header != self.protocol.HEADER:
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
    
    def process_gps_response(self, command: int, data: bytes):
        """Process GPS-related MSP responses."""
        try:
            if command == MSP_RAW_GPS:
                gps = self.protocol.parse_raw_gps(data)
                logger.debug(f"GPS Position: {gps.format_decimal()}")
                for callback in self._callbacks:
                    callback('gps', gps)
                    
            elif command == MSP_COMP_GPS:
                computed = self.protocol.parse_comp_gps(data)
                logger.debug(f"GPS Computed: dist={computed.distance_to_home}m, dir={computed.direction_to_home}°")
                for callback in self._callbacks:
                    callback('gps_computed', computed)
                    
            elif command == MSP_GPS_DATA:
                gps = self.protocol.parse_gps_data(data)
                logger.debug(f"GPS Extended: HDOP={gps.hdop}")
                for callback in self._callbacks:
                    callback('gps', gps)
                    
        except Exception as e:
            logger.error(f"Error processing GPS response: {e}")
    
    def add_callback(self, callback: Callable):
        """Add callback for GPS data updates."""
        self._callbacks.append(callback)
    
    def remove_callback(self, callback: Callable):
        """Remove callback."""
        if callback in self._callbacks:
            self._callbacks.remove(callback)
    
    async def start_polling(self, interval: float = 0.1):
        """Start polling GPS data in background."""
        self.running = True
        
        while self.running:
            try:
                # Request GPS data
                if self.request_gps_data():
                    # Read response
                    response = self.read_response(timeout=0.5)
                    if response:
                        command, data = response
                        self.process_gps_response(command, data)
                
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

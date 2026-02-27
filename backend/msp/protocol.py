"""MSP (MultiWii Serial Protocol) implementation for GPS data parsing."""

import struct
from dataclasses import dataclass
from typing import Optional, Tuple


@dataclass
class GPSPosition:
    """GPS position data."""
    lat: float          # Latitude in decimal degrees
    lon: float          # Longitude in decimal degrees
    altitude: int       # Altitude in meters
    speed: int          # Speed in cm/s
    course: int         # Course/heading in degrees (0-360)
    fix_type: int       # 0=no fix, 1=2D fix, 2=3D fix
    num_satellites: int # Number of satellites
    hdop: Optional[int] = None  # Horizontal dilution of precision (if available)
    
    @property
    def lat_dms(self) -> Tuple[int, int, float, str]:
        """Convert latitude to DMS (degrees, minutes, seconds, direction)."""
        abs_lat = abs(self.lat)
        degrees = int(abs_lat)
        minutes_float = (abs_lat - degrees) * 60
        minutes = int(minutes_float)
        seconds = (minutes_float - minutes) * 60
        direction = 'N' if self.lat >= 0 else 'S'
        return (degrees, minutes, seconds, direction)
    
    @property
    def lon_dms(self) -> Tuple[int, int, float, str]:
        """Convert longitude to DMS (degrees, minutes, seconds, direction)."""
        abs_lon = abs(self.lon)
        degrees = int(abs_lon)
        minutes_float = (abs_lon - degrees) * 60
        minutes = int(minutes_float)
        seconds = (minutes_float - minutes) * 60
        direction = 'E' if self.lon >= 0 else 'W'
        return (degrees, minutes, seconds, direction)
    
    def format_dms(self) -> str:
        """Format coordinates as DMS string."""
        lat_d, lat_m, lat_s, lat_dir = self.lat_dms
        lon_d, lon_m, lon_s, lon_dir = self.lon_dms
        return f"{lat_d}°{lat_m}'{lat_s:.1f}\"{lat_dir}, {lon_d}°{lon_m}'{lon_s:.1f}\"{lon_dir}"
    
    def format_decimal(self) -> str:
        """Format coordinates as decimal degrees."""
        return f"{self.lat:.6f}, {self.lon:.6f}"
    
    @property
    def fix_status(self) -> str:
        """Get human-readable fix status."""
        status_map = {0: "No Fix", 1: "2D Fix", 2: "3D Fix"}
        return status_map.get(self.fix_type, "Unknown")
    
    @property
    def fix_color(self) -> str:
        """Get color indicator for fix status."""
        color_map = {0: "red", 1: "yellow", 2: "green"}
        return color_map.get(self.fix_type, "gray")


@dataclass
class GPSComputedData:
    """Computed GPS navigation data."""
    distance_to_home: int   # Distance to home in meters
    direction_to_home: int  # Direction to home in degrees (0-360)
    update: bool            # GPS update flag


class MSPProtocol:
    """MSP protocol handler for GPS data."""
    
    # MSP frame structure:
    # $M< (header) + size (1 byte) + command (1 byte) + data (size bytes) + checksum (1 byte)
    HEADER = b'$M<'
    
    def __init__(self):
        self.buffer = bytearray()
        self.current_gps: Optional[GPSPosition] = None
        self.computed_gps: Optional[GPSComputedData] = None
    
    def calculate_checksum(self, data: bytes) -> int:
        """Calculate MSP checksum (XOR of size, command, and all data bytes)."""
        checksum = 0
        for byte in data:
            checksum ^= byte
        return checksum
    
    def parse_raw_gps(self, data: bytes) -> GPSPosition:
        """
        Parse MSP_RAW_GPS (106) response.
        
        Data format (16 bytes):
        - fix_type (uint8): 0=no fix, 1=2D fix, 2=3D fix
        - num_satellites (uint8): Number of satellites
        - lat (int32): Latitude in degrees * 10^7
        - lon (int32): Longitude in degrees * 10^7
        - altitude (uint16): Altitude in meters
        - speed (uint16): Speed in cm/s
        - course (uint16): Course in degrees * 10
        """
        if len(data) < 16:
            raise ValueError(f"MSP_RAW_GPS requires 16 bytes, got {len(data)}")
        
        fix_type = data[0]
        num_satellites = data[1]
        lat = struct.unpack('<i', data[2:6])[0] / 10_000_000.0
        lon = struct.unpack('<i', data[6:10])[0] / 10_000_000.0
        altitude = struct.unpack('<H', data[10:12])[0]
        speed = struct.unpack('<H', data[12:14])[0]
        course = struct.unpack('<H', data[14:16])[0] / 10.0
        
        gps = GPSPosition(
            lat=lat,
            lon=lon,
            altitude=altitude,
            speed=speed,
            course=int(course),
            fix_type=fix_type,
            num_satellites=num_satellites
        )
        self.current_gps = gps
        return gps
    
    def parse_comp_gps(self, data: bytes) -> GPSComputedData:
        """
        Parse MSP_COMP_GPS (107) response.
        
        Data format (5 bytes):
        - distance_to_home (uint16): Distance in meters
        - direction_to_home (uint16): Direction in degrees
        - update (uint8): Update flag
        """
        if len(data) < 5:
            raise ValueError(f"MSP_COMP_GPS requires 5 bytes, got {len(data)}")
        
        distance = struct.unpack('<H', data[0:2])[0]
        direction = struct.unpack('<H', data[2:4])[0]
        update = data[4] != 0
        
        computed = GPSComputedData(
            distance_to_home=distance,
            direction_to_home=direction,
            update=update
        )
        self.computed_gps = computed
        return computed
    
    def parse_gps_data(self, data: bytes) -> GPSPosition:
        """
        Parse MSP_GPS_DATA (109) extended GPS data.
        
        Data format includes HDOP and additional GPS parameters.
        This extends the raw GPS data with HDOP information.
        """
        if len(data) < 18:
            raise ValueError(f"MSP_GPS_DATA requires 18 bytes, got {len(data)}")
        
        # Parse similar to raw GPS but with HDOP
        fix_type = data[0]
        num_satellites = data[1]
        lat = struct.unpack('<i', data[2:6])[0] / 10_000_000.0
        lon = struct.unpack('<i', data[6:10])[0] / 10_000_000.0
        altitude = struct.unpack('<H', data[10:12])[0]
        speed = struct.unpack('<H', data[12:14])[0]
        course = struct.unpack('<H', data[14:16])[0] / 10.0
        hdop = struct.unpack('<H', data[16:18])[0]
        
        gps = GPSPosition(
            lat=lat,
            lon=lon,
            altitude=altitude,
            speed=speed,
            course=int(course),
            fix_type=fix_type,
            num_satellites=num_satellites,
            hdop=hdop
        )
        self.current_gps = gps
        return gps
    
    def create_msp_request(self, command: int, data: bytes = b'') -> bytes:
        """Create an MSP request frame."""
        size = len(data)
        frame = bytearray()
        frame.extend(self.HEADER)
        frame.append(size)
        frame.append(command)
        frame.extend(data)
        
        # Calculate checksum (XOR of size, command, and data)
        checksum_data = bytes([size, command]) + data
        checksum = self.calculate_checksum(checksum_data)
        frame.append(checksum)
        
        return bytes(frame)
    
    def parse_response(self, data: bytes) -> Tuple[int, bytes]:
        """
        Parse an MSP response frame.
        Returns (command, payload) tuple.
        """
        if len(data) < 5:
            raise ValueError("Response too short")
        
        if not data.startswith(self.HEADER):
            raise ValueError("Invalid MSP header")
        
        size = data[3]
        command = data[4]
        payload = data[5:5+size]
        
        if len(payload) != size:
            raise ValueError(f"Payload size mismatch: expected {size}, got {len(payload)}")
        
        # Verify checksum
        expected_checksum = data[5+size] if len(data) > 5+size else 0
        checksum_data = bytes([size, command]) + payload
        calculated_checksum = self.calculate_checksum(checksum_data)
        
        if expected_checksum != calculated_checksum:
            raise ValueError(f"Checksum mismatch: expected {expected_checksum}, got {calculated_checksum}")
        
        return command, payload
    
    def get_current_gps(self) -> Optional[GPSPosition]:
        """Get the most recent GPS position data."""
        return self.current_gps
    
    def get_gps_status(self) -> dict:
        """Get current GPS status for API response."""
        if self.current_gps is None:
            return {
                "has_fix": False,
                "fix_type": 0,
                "fix_status": "No Data",
                "num_satellites": 0,
                "color": "gray"
            }
        
        return {
            "has_fix": self.current_gps.fix_type > 0,
            "fix_type": self.current_gps.fix_type,
            "fix_status": self.current_gps.fix_status,
            "num_satellites": self.current_gps.num_satellites,
            "color": self.current_gps.fix_color
        }

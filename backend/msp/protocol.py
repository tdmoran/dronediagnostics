"""MSP (MultiWii Serial Protocol) implementation for drone telemetry parsing."""

import struct
from dataclasses import dataclass, field
from typing import Optional, Tuple, Dict, List


@dataclass
class IMUData:
    """Raw IMU sensor data from MSP_RAW_IMU (102)."""
    gyro_x: float   # deg/s
    gyro_y: float
    gyro_z: float
    accel_x: float  # g
    accel_y: float
    accel_z: float
    mag_x: int
    mag_y: int
    mag_z: int


@dataclass
class AttitudeData:
    """Attitude data from MSP_ATTITUDE (108)."""
    roll: float     # degrees (-180..180)
    pitch: float    # degrees (-90..90)
    yaw: int        # degrees (0..360)


@dataclass
class StatusData:
    """Flight controller status from MSP_STATUS (101)."""
    cycle_time: int       # us
    i2c_errors: int
    sensors: int          # bitmask: acc=1, baro=2, mag=4, gps=8
    flight_mode: int      # bitmask of active modes
    current_profile: int


@dataclass
class MotorData:
    """Motor output values from MSP_MOTOR (104)."""
    motors: List[int]     # PWM values (typically 1000-2000)


@dataclass
class RCData:
    """RC channel values from MSP_RC (105)."""
    channels: List[int]   # microseconds (1000-2000)


@dataclass
class AnalogData:
    """Analog sensor values from MSP_ANALOG (110)."""
    vbat: float           # volts (raw is decivolts)
    power_meter: int      # mAh consumed
    rssi: int             # 0-1023
    amperage: float       # amps (raw is centiamps)


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
    # $M< (request) / $M> (response) + size (1 byte) + command (1 byte) + data (size bytes) + checksum (1 byte)
    HEADER = b'$M<'           # outgoing request header
    RESPONSE_HEADER = b'$M>'  # incoming response header
    
    def __init__(self):
        self.buffer = bytearray()
        self.current_gps: Optional[GPSPosition] = None
        self.computed_gps: Optional[GPSComputedData] = None
        self.current_imu: Optional[IMUData] = None
        self.current_attitude: Optional[AttitudeData] = None
        self.current_status: Optional[StatusData] = None
        self.current_motors: Optional[MotorData] = None
        self.current_rc: Optional[RCData] = None
        self.current_analog: Optional[AnalogData] = None
    
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
    
    def parse_raw_imu(self, data: bytes) -> IMUData:
        """
        Parse MSP_RAW_IMU (102) response.

        Data format (18 bytes):
        - accel_x/y/z (int16 x3): raw accel, divide by 512 for g
        - gyro_x/y/z (int16 x3): raw gyro, divide by 4.096 for deg/s
        - mag_x/y/z (int16 x3): raw magnetometer
        """
        if len(data) < 18:
            raise ValueError(f"MSP_RAW_IMU requires 18 bytes, got {len(data)}")

        vals = struct.unpack('<9h', data[:18])
        imu = IMUData(
            accel_x=vals[0] / 512.0,
            accel_y=vals[1] / 512.0,
            accel_z=vals[2] / 512.0,
            gyro_x=vals[3] / 4.096,
            gyro_y=vals[4] / 4.096,
            gyro_z=vals[5] / 4.096,
            mag_x=vals[6],
            mag_y=vals[7],
            mag_z=vals[8],
        )
        self.current_imu = imu
        return imu

    def parse_status(self, data: bytes) -> StatusData:
        """
        Parse MSP_STATUS (101) response.

        Data format (11 bytes):
        - cycle_time (uint16)
        - i2c_errors (uint16)
        - sensors (uint16): bitmask
        - flight_mode (uint32): active mode flags
        - current_profile (uint8)
        """
        if len(data) < 11:
            raise ValueError(f"MSP_STATUS requires 11 bytes, got {len(data)}")

        cycle_time = struct.unpack('<H', data[0:2])[0]
        i2c_errors = struct.unpack('<H', data[2:4])[0]
        sensors = struct.unpack('<H', data[4:6])[0]
        flight_mode = struct.unpack('<I', data[6:10])[0]
        current_profile = data[10]

        status = StatusData(
            cycle_time=cycle_time,
            i2c_errors=i2c_errors,
            sensors=sensors,
            flight_mode=flight_mode,
            current_profile=current_profile,
        )
        self.current_status = status
        return status

    def parse_motor(self, data: bytes) -> MotorData:
        """
        Parse MSP_MOTOR (104) response.

        Data format (16 bytes): 8 x uint16 motor values.
        Betaflight typically uses motors 1-4 for a quad.
        """
        if len(data) < 16:
            raise ValueError(f"MSP_MOTOR requires 16 bytes, got {len(data)}")

        motors = list(struct.unpack('<8H', data[:16]))
        motor_data = MotorData(motors=motors)
        self.current_motors = motor_data
        return motor_data

    def parse_rc(self, data: bytes) -> RCData:
        """
        Parse MSP_RC (105) response.

        Data format: N x uint16 channel values (typically 8-18 channels).
        """
        num_channels = len(data) // 2
        if num_channels < 4:
            raise ValueError(f"MSP_RC needs at least 4 channels, got {num_channels}")

        channels = list(struct.unpack(f'<{num_channels}H', data[:num_channels * 2]))
        rc = RCData(channels=channels)
        self.current_rc = rc
        return rc

    def parse_attitude(self, data: bytes) -> AttitudeData:
        """
        Parse MSP_ATTITUDE (108) response.

        Data format (6 bytes):
        - roll (int16): degrees * 10
        - pitch (int16): degrees * 10
        - yaw (int16): degrees
        """
        if len(data) < 6:
            raise ValueError(f"MSP_ATTITUDE requires 6 bytes, got {len(data)}")

        roll = struct.unpack('<h', data[0:2])[0] / 10.0
        pitch = struct.unpack('<h', data[2:4])[0] / 10.0
        yaw = struct.unpack('<h', data[4:6])[0]

        attitude = AttitudeData(roll=roll, pitch=pitch, yaw=yaw)
        self.current_attitude = attitude
        return attitude

    def parse_analog(self, data: bytes) -> AnalogData:
        """
        Parse MSP_ANALOG (110) response.

        Data format (7 bytes):
        - vbat (uint8): battery voltage in 0.1V
        - power_meter (uint16): mAh consumed
        - rssi (uint16): 0-1023
        - amperage (int16): current in 0.01A
        """
        if len(data) < 7:
            raise ValueError(f"MSP_ANALOG requires 7 bytes, got {len(data)}")

        vbat = data[0] / 10.0
        power_meter = struct.unpack('<H', data[1:3])[0]
        rssi = struct.unpack('<H', data[3:5])[0]
        amperage = struct.unpack('<h', data[5:7])[0] / 100.0

        analog = AnalogData(
            vbat=vbat, power_meter=power_meter,
            rssi=rssi, amperage=amperage,
        )
        self.current_analog = analog
        return analog

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

    def get_full_telemetry(self) -> dict:
        """Get all current telemetry data as a dict for broadcasting."""
        result: Dict[str, any] = {}

        if self.current_imu:
            result["gyro"] = {
                "x": round(self.current_imu.gyro_x, 2),
                "y": round(self.current_imu.gyro_y, 2),
                "z": round(self.current_imu.gyro_z, 2),
            }
            result["accel"] = {
                "x": round(self.current_imu.accel_x, 3),
                "y": round(self.current_imu.accel_y, 3),
                "z": round(self.current_imu.accel_z, 3),
            }

        if self.current_attitude:
            result["attitude"] = {
                "roll": round(self.current_attitude.roll, 1),
                "pitch": round(self.current_attitude.pitch, 1),
                "yaw": self.current_attitude.yaw,
            }

        if self.current_status:
            result["status"] = {
                "cycle_time": self.current_status.cycle_time,
                "i2c_errors": self.current_status.i2c_errors,
                "sensors": self.current_status.sensors,
                "flight_mode": self.current_status.flight_mode,
                "current_profile": self.current_status.current_profile,
            }

        if self.current_motors:
            result["motors"] = self.current_motors.motors[:8]

        if self.current_rc:
            result["rc"] = self.current_rc.channels

        if self.current_analog:
            result["battery"] = {
                "voltage": round(self.current_analog.vbat, 1),
                "power_meter": self.current_analog.power_meter,
                "rssi": self.current_analog.rssi,
                "amperage": round(self.current_analog.amperage, 2),
            }

        return result

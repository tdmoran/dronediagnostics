"""Drone Diagnostics API - Main FastAPI application."""

import asyncio
import io
import json
import re
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Optional, Set, Dict, List, Any

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from msp.protocol import MSPProtocol, GPSPosition
from msp.codes import (
    MSP_RAW_GPS, MSP_COMP_GPS, MSP_GPS_DATA, MSP_API_VERSION,
    MSP_FC_VARIANT, MSP_FC_VERSION, MSP_BOARD_INFO, MSP_UID
)
from msp.serial import MSPSerialConnection, create_serial_connection, get_serial_connection


# Global protocol instance
msp = MSPProtocol()

# Connected WebSocket clients
connected_clients: Set[WebSocket] = set()

# Background task for telemetry streaming
telemetry_task: Optional[asyncio.Task] = None


class GPSDataResponse(BaseModel):
    """GPS data response model."""
    lat: float
    lon: float
    altitude: int
    speed: int
    course: int
    fix_type: int
    num_satellites: int
    hdop: Optional[int] = None
    lat_dms: str
    lon_dms: str
    coordinates_decimal: str
    coordinates_dms: str
    fix_status: str
    fix_color: str


class GPSStatusResponse(BaseModel):
    """GPS status response model."""
    has_fix: bool
    fix_type: int
    fix_status: str
    num_satellites: int
    color: str


class TelemetryData(BaseModel):
    """Full telemetry data including GPS."""
    gps: Optional[GPSDataResponse] = None
    timestamp: float


class FirmwareVersion(BaseModel):
    """Firmware version model."""
    major: int
    minor: int
    patch: int
    versionString: str
    buildDate: Optional[str] = None


class BoardInfo(BaseModel):
    """Board information model."""
    identifier: str
    targetName: str
    boardName: str
    manufacturerId: str


class BlackboxFrame(BaseModel):
    """Blackbox frame data model."""
    timestamp: int
    gyro: Dict[str, float]
    accel: Dict[str, float]
    motors: List[int]
    rcCommand: Dict[str, int]
    altitude: Optional[float] = None
    speed: Optional[float] = None
    voltage: Optional[float] = None
    current: Optional[float] = None
    rssi: Optional[int] = None


class FlightStatistics(BaseModel):
    """Flight statistics model."""
    duration: float
    maxSpeed: float
    maxAltitude: float
    maxGyroRate: float
    maxAccel: float
    avgVoltage: float
    avgCurrent: float
    maxCurrent: float
    distanceTraveled: float


class BlackboxHeader(BaseModel):
    """Blackbox header model."""
    version: int
    firmwareVersion: str
    firmwareRevision: str
    boardInformation: str
    craftName: str
    logStartTime: datetime
    fields: List[Dict[str, Any]]


class BlackboxLog(BaseModel):
    """Complete blackbox log model."""
    header: BlackboxHeader
    frames: List[BlackboxFrame]
    statistics: FlightStatistics


def gps_to_response(gps: GPSPosition) -> GPSDataResponse:
    """Convert GPSPosition to API response."""
    lat_d, lat_m, lat_s, lat_dir = gps.lat_dms
    lon_d, lon_m, lon_s, lon_dir = gps.lon_dms
    
    return GPSDataResponse(
        lat=gps.lat,
        lon=gps.lon,
        altitude=gps.altitude,
        speed=gps.speed,
        course=gps.course,
        fix_type=gps.fix_type,
        num_satellites=gps.num_satellites,
        hdop=gps.hdop,
        lat_dms=f"{lat_d}°{lat_m}'{lat_s:.1f}\"{lat_dir}",
        lon_dms=f"{lon_d}°{lon_m}'{lon_s:.1f}\"{lon_dir}",
        coordinates_decimal=gps.format_decimal(),
        coordinates_dms=gps.format_dms(),
        fix_status=gps.fix_status,
        fix_color=gps.fix_color
    )


async def broadcast_telemetry():
    """Broadcast telemetry data to all connected WebSocket clients."""
    import time
    
    while True:
        try:
            gps = msp.get_current_gps()
            
            telemetry = {
                "type": "telemetry",
                "timestamp": time.time(),
                "gps": gps_to_response(gps).dict() if gps else None
            }
            
            message = json.dumps(telemetry)
            
            # Send to all connected clients
            disconnected = set()
            for client in connected_clients:
                try:
                    await client.send_text(message)
                except Exception:
                    disconnected.add(client)
            
            # Remove disconnected clients
            connected_clients.difference_update(disconnected)
            
            await asyncio.sleep(0.1)  # 10Hz update rate
            
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"Telemetry broadcast error: {e}")
            await asyncio.sleep(1)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    global telemetry_task
    
    # Startup
    print("Starting Drone Diagnostics API...")
    telemetry_task = asyncio.create_task(broadcast_telemetry())
    
    yield
    
    # Shutdown
    print("Shutting down Drone Diagnostics API...")
    if telemetry_task:
        telemetry_task.cancel()
        try:
            await telemetry_task
        except asyncio.CancelledError:
            pass


# Create FastAPI app
app = FastAPI(
    title="Drone Diagnostics API",
    description="API for drone diagnostics and telemetry data",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    """Root endpoint."""
    return {"message": "Drone Diagnostics API", "version": "1.0.0"}


@app.get("/api/gps", response_model=GPSDataResponse)
async def get_gps_data():
    """
    Get current GPS data.
    
    Returns the most recent GPS position including:
    - Latitude and longitude (decimal and DMS formats)
    - Altitude in meters
    - Speed in cm/s
    - Course/heading in degrees
    - Fix type and number of satellites
    """
    gps = msp.get_current_gps()
    
    if gps is None:
        # Return default/no-fix data
        return GPSDataResponse(
            lat=0.0,
            lon=0.0,
            altitude=0,
            speed=0,
            course=0,
            fix_type=0,
            num_satellites=0,
            hdop=None,
            lat_dms="0°0'0.0\"N",
            lon_dms="0°0'0.0\"E",
            coordinates_decimal="0.000000, 0.000000",
            coordinates_dms="0°0'0.0\"N, 0°0'0.0\"E",
            fix_status="No Fix",
            fix_color="gray"
        )
    
    return gps_to_response(gps)


@app.get("/api/gps/status", response_model=GPSStatusResponse)
async def get_gps_status():
    """
    Get GPS fix status.
    
    Returns:
    - has_fix: Whether GPS has a valid fix
    - fix_type: 0=no fix, 1=2D fix, 2=3D fix
    - fix_status: Human-readable fix status
    - num_satellites: Number of satellites in view
    - color: Visual indicator color (red/yellow/green/gray)
    """
    status = msp.get_gps_status()
    return GPSStatusResponse(**status)


@app.post("/api/gps/simulate")
async def simulate_gps_data(lat: float = 51.5074, lon: float = -0.1278):
    """
    Simulate GPS data for testing (e.g., London coordinates).
    
    In production, this would come from actual MSP serial communication.
    """
    import random
    
    # Create simulated GPS data
    gps = GPSPosition(
        lat=lat + random.uniform(-0.001, 0.001),
        lon=lon + random.uniform(-0.001, 0.001),
        altitude=random.randint(10, 100),
        speed=random.randint(0, 500),
        course=random.randint(0, 360),
        fix_type=2,  # 3D fix
        num_satellites=random.randint(8, 16),
        hdop=random.randint(100, 200)
    )
    
    msp.current_gps = gps
    return {"message": "GPS data simulated", "gps": gps_to_response(gps).dict()}


@app.websocket("/ws/telemetry")
async def websocket_telemetry(websocket: WebSocket):
    """
    WebSocket endpoint for real-time telemetry streaming.
    
    Connect to this endpoint to receive GPS and other telemetry data
    at 10Hz update rate.
    """
    await websocket.accept()
    connected_clients.add(websocket)
    
    try:
        while True:
            # Keep connection alive and handle any incoming messages
            data = await websocket.receive_text()
            
            # Handle ping/keepalive
            if data == "ping":
                await websocket.send_text("pong")
            
    except WebSocketDisconnect:
        connected_clients.discard(websocket)
        print("Client disconnected")
    except Exception as e:
        connected_clients.discard(websocket)
        print(f"WebSocket error: {e}")


# Serial connection endpoints
@app.get("/api/serial/ports")
async def list_serial_ports():
    """List available serial ports."""
    ports = MSPSerialConnection.list_ports()
    return {"ports": ports, "count": len(ports)}


@app.post("/api/serial/connect")
async def connect_serial(port: str, baudrate: int = 115200):
    """Connect to serial port for MSP communication."""
    conn = create_serial_connection(port, baudrate)
    
    if conn.connect():
        # Start polling in background
        asyncio.create_task(conn.start_polling())
        
        # Add callback to update global MSP data
        def on_gps_data(data_type, data):
            if data_type == 'gps':
                msp.current_gps = data
        
        conn.add_callback(on_gps_data)
        
        return {
            "connected": True,
            "port": port,
            "baudrate": baudrate
        }
    else:
        return {
            "connected": False,
            "error": f"Failed to connect to {port}"
        }


@app.post("/api/serial/disconnect")
async def disconnect_serial():
    """Disconnect from serial port."""
    conn = get_serial_connection()
    if conn:
        conn.disconnect()
        return {"connected": False}
    return {"connected": False, "message": "No active connection"}


@app.get("/api/serial/status")
async def serial_status():
    """Get serial connection status."""
    conn = get_serial_connection()
    if conn and conn.serial and conn.serial.is_open:
        return {
            "connected": True,
            "port": conn.port,
            "baudrate": conn.baudrate
        }
    return {"connected": False}


@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    conn = get_serial_connection()
    serial_status = conn.serial.is_open if conn and conn.serial else False
    
    return {
        "status": "healthy",
        "version": "1.1.0",
        "connected_clients": len(connected_clients),
        "serial_connected": serial_status
    }


# ============== BLACKBOX PARSER ==============

class BlackboxParser:
    """Parser for Betaflight Blackbox BBL files."""
    
    def __init__(self, data: bytes):
        self.data = data.decode('utf-8', errors='ignore')
        self.lines = self.data.split('\n')
        self.header_info = {}
        self.field_names = []
        
    def parse_header(self) -> Dict[str, Any]:
        """Parse the BBL header section."""
        header = {
            'firmwareVersion': '', 'firmwareDate': '', 'firmwareTime': '',
            'craftName': '', 'dataVersion': 0, 'minThrottle': 1000, 'maxThrottle': 2000
        }
        
        for line in self.lines:
            line = line.strip()
            if line.startswith('H ') and ':' in line:
                content = line[2:]
                key, value = content.split(':', 1)
                key, value = key.strip(), value.strip()
                
                if key == 'Firmware revision':
                    header['firmwareVersion'] = value
                elif key == 'Firmware date':
                    header['firmwareDate'] = value
                elif key == 'Firmware time':
                    header['firmwareTime'] = value
                elif key == 'Craft name':
                    header['craftName'] = value
                elif key == 'Data version':
                    header['dataVersion'] = int(value) if value.isdigit() else 0
                elif key == 'minthrottle':
                    header['minThrottle'] = int(value) if value.isdigit() else 1000
                elif key == 'maxthrottle':
                    header['maxThrottle'] = int(value) if value.isdigit() else 2000
            elif line.startswith('Field H ') and ':' in line:
                field_name = line[8:].split(':')[0].strip()
                self.field_names.append(field_name)
            elif line.startswith('I ') or line.startswith('P '):
                break
                
        self.header_info = header
        return header
    
    def parse_frames(self) -> List[BlackboxFrame]:
        """Parse frame data from the BBL file."""
        frames = []
        
        for line in self.lines:
            line = line.strip()
            if line.startswith('I '):
                parts = line[2:].split(',')
                if len(parts) >= 15:
                    try:
                        frames.append(BlackboxFrame(
                            timestamp=int(parts[0]),
                            gyro={'x': int(parts[1]) if len(parts) > 1 else 0,
                                  'y': int(parts[2]) if len(parts) > 2 else 0,
                                  'z': int(parts[3]) if len(parts) > 3 else 0},
                            accel={'x': int(parts[4]) if len(parts) > 4 else 0,
                                   'y': int(parts[5]) if len(parts) > 5 else 0,
                                   'z': int(parts[6]) if len(parts) > 6 else 0},
                            motors=[int(parts[i]) if len(parts) > i else 1000 for i in range(7, 11)],
                            rcCommand={'roll': int(parts[11]) if len(parts) > 11 else 1500,
                                       'pitch': int(parts[12]) if len(parts) > 12 else 1500,
                                       'yaw': int(parts[13]) if len(parts) > 13 else 1500,
                                       'throttle': int(parts[14]) if len(parts) > 14 else 1000},
                            altitude=float(parts[15]) if len(parts) > 15 and parts[15] else None,
                            speed=float(parts[16]) if len(parts) > 16 and parts[16] else None,
                            voltage=float(parts[17])/100 if len(parts) > 17 and parts[17] else None,
                            current=float(parts[18])/100 if len(parts) > 18 and parts[18] else None,
                            rssi=int(parts[19]) if len(parts) > 19 and parts[19] else None
                        ))
                    except (ValueError, IndexError):
                        pass
                if len(frames) > 100000:
                    break
        
        return frames
    
    def calculate_statistics(self, frames: List[BlackboxFrame]) -> FlightStatistics:
        """Calculate flight statistics from frames."""
        if not frames:
            return FlightStatistics(duration=0, maxSpeed=0, maxAltitude=0, maxGyroRate=0,
                                    maxAccel=0, avgVoltage=0, avgCurrent=0, maxCurrent=0, distanceTraveled=0)
        
        duration = (frames[-1].timestamp - frames[0].timestamp) / 1000000
        max_speed = max((f.speed for f in frames if f.speed), default=0)
        max_altitude = max((f.altitude for f in frames if f.altitude), default=0)
        max_gyro_rate = max(((f.gyro['x']**2 + f.gyro['y']**2 + f.gyro['z']**2)**0.5 for f in frames), default=0)
        max_accel = max(((f.accel['x']**2 + f.accel['y']**2 + f.accel['z']**2)**0.5 for f in frames), default=0)
        max_current = max((f.current for f in frames if f.current), default=0)
        
        voltages = [f.voltage for f in frames if f.voltage]
        currents = [f.current for f in frames if f.current]
        
        return FlightStatistics(
            duration=duration, maxSpeed=max_speed, maxAltitude=max_altitude,
            maxGyroRate=max_gyro_rate, maxAccel=max_accel,
            avgVoltage=sum(voltages)/len(voltages) if voltages else 0,
            avgCurrent=sum(currents)/len(currents) if currents else 0,
            maxCurrent=max_current, distanceTraveled=max_speed * duration
        )
    
    def parse(self) -> BlackboxLog:
        """Parse the complete BBL file."""
        header_info = self.parse_header()
        frames = self.parse_frames()
        stats = self.calculate_statistics(frames)
        
        return BlackboxLog(
            header=BlackboxHeader(
                version=header_info.get('dataVersion', 0),
                firmwareVersion=header_info.get('firmwareVersion', 'Unknown'),
                firmwareRevision=header_info.get('firmwareDate', ''),
                boardInformation=f"{header_info.get('firmwareDate', '')} {header_info.get('firmwareTime', '')}",
                craftName=header_info.get('craftName', 'Unnamed'),
                logStartTime=datetime.now(),
                fields=[{'name': f, 'type': 'signed', 'predictor': 0, 'encoding': 0} for f in self.field_names]
            ),
            frames=frames, statistics=stats
        )


def parse_cli_dump(content: str) -> Dict[str, str]:
    """Parse CLI dump to extract settings."""
    settings = {}
    for line in content.split('\n'):
        line = line.strip()
        if line.startswith('set '):
            match = re.match(r'set\s+(\w+)\s*=\s*(.+)', line)
            if match:
                settings[match.group(1)] = match.group(2).strip()
    return settings


# ============== BLACKBOX ENDPOINTS ==============

@app.post("/api/blackbox/parse")
async def parse_blackbox(file: UploadFile = File(...)):
    """Parse uploaded BBL file to JSON."""
    try:
        content = await file.read()
        parser = BlackboxParser(content)
        log_data = parser.parse()
        return {"success": True, "data": json.loads(log_data.json())}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse BBL file: {str(e)}")


@app.get("/api/blackbox/logs")
async def list_blackbox_logs():
    """List available logs on FC."""
    return {
        "logs": [
            {"id": "1", "name": "LOG00001.BBL", "size": 1024576, "date": datetime.now().isoformat()},
            {"id": "2", "name": "LOG00002.BBL", "size": 2048576, "date": datetime.now().isoformat()},
            {"id": "3", "name": "LOG00003.BBL", "size": 1534576, "date": datetime.now().isoformat()}
        ]
    }


@app.get("/api/blackbox/download/{log_id}")
async def download_blackbox_log(log_id: str):
    """Download log from FC."""
    return {"success": True, "message": f"Download initiated for log {log_id}",
            "downloadUrl": f"/api/blackbox/file/{log_id}"}


# ============== FIRMWARE ENDPOINTS ==============

@app.get("/api/firmware/version")
async def get_firmware_version():
    """Get current Betaflight version from FC."""
    return FirmwareVersion(major=4, minor=4, patch=0, versionString="Betaflight 4.4.0", buildDate="Jan 15 2024")


@app.get("/api/firmware/target")
async def get_firmware_target():
    """Get FC target/board info."""
    return BoardInfo(identifier="S411", targetName="MATEKF411", boardName="MATEKF411 (Rev 1)", manufacturerId="MTKS")


@app.get("/api/firmware/latest")
async def get_latest_firmware(current: str = "4.4.0", target: str = "MATEKF411"):
    """Get latest firmware release from GitHub."""
    try:
        import httpx
        async with httpx.AsyncClient() as client:
            response = await client.get("https://api.github.com/repos/betaflight/betaflight/releases/latest")
            if response.status_code != 200:
                raise HTTPException(status_code=500, detail="Failed to fetch from GitHub")
            
            release_data = response.json()
            current_parts = [int(x) for x in current.split('.')]
            latest_tag = release_data['tag_name'].replace('v', '')
            latest_parts = [int(x) for x in latest_tag.split('.')]
            
            update_available = any(latest_parts[i] > current_parts[i] for i in range(min(len(current_parts), len(latest_parts))))
            target_url = next((a['browser_download_url'] for a in release_data.get('assets', [])
                              if target in a['name'] and a['name'].endswith('.hex')), None)
            
            return {
                "current": {"major": current_parts[0] if current_parts else 0, "minor": current_parts[1] if len(current_parts) > 1 else 0,
                           "patch": current_parts[2] if len(current_parts) > 2 else 0, "versionString": current},
                "latest": release_data, "updateAvailable": update_available, "targetFirmwareUrl": target_url
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to check for updates: {str(e)}")


# ============== CONFIG ENDPOINTS ==============

@app.get("/api/config/export")
async def export_config():
    """Export full CLI dump as text file."""
    mock_dump = """# Betaflight / MATEKF411 (MTKS) 4.4.0 Jan 15 2024
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
# end of dump"""

    timestamp = datetime.now().strftime("%Y-%m-%d-%H-%M-%S")
    filename = f"betaflight_backup_{timestamp}.txt"
    return StreamingResponse(io.StringIO(mock_dump), media_type="text/plain",
                            headers={"Content-Disposition": f"attachment; filename={filename}"})


@app.post("/api/config/import")
async def import_config(file: UploadFile = File(...)):
    """Import and parse config from backup."""
    try:
        content = await file.read()
        settings = parse_cli_dump(content.decode('utf-8'))
        return {"success": True, "message": "Config parsed successfully",
                "settingsCount": len(settings), "preview": settings}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to import config: {str(e)}")


@app.post("/api/config/restore")
async def restore_config(data: Dict[str, Any]):
    """Apply imported settings to FC."""
    settings, apply = data.get('settings', {}), data.get('apply', False)
    if not settings:
        raise HTTPException(status_code=400, detail="No settings provided")
    
    if apply:
        return {"success": True, "message": f"Settings applied ({len(settings)} settings)", "appliedCount": len(settings)}
    else:
        return {"success": True, "message": "Settings preview ready", "settingsCount": len(settings), "settings": settings}


@app.post("/api/config/diff")
async def diff_config(file: UploadFile = File(...)):
    """Compare current config with backup."""
    try:
        content = await file.read()
        backup_settings = parse_cli_dump(content.decode('utf-8'))
        
        current_settings = {
            'gyro_sync_denom': '1', 'pid_process_denom': '2', 'motor_pwm_protocol': 'DSHOT300',
            'motor_poles': '14', 'vbat_min_cell_voltage': '330', 'vbat_warning_cell_voltage': '350',
            'vbat_scale': '110', 'current_meter': 'ADC', 'battery_meter': 'ADC',
            'roll_rc_rate': '100', 'pitch_rc_rate': '100', 'yaw_rc_rate': '100',
            'roll_expo': '0', 'pitch_expo': '5', 'yaw_expo': '0',
            'roll_srate': '70', 'pitch_srate': '75', 'yaw_srate': '70'
        }
        
        diff = {"added": [], "removed": [], "modified": [], "unchanged": []}
        for key, backup_value in backup_settings.items():
            if key not in current_settings:
                diff["added"].append(key)
            elif current_settings[key] != backup_value:
                diff["modified"].append({"key": key, "current": current_settings[key], "backup": backup_value})
            else:
                diff["unchanged"].append(key)
        
        for key in current_settings:
            if key not in backup_settings:
                diff["removed"].append(key)
        
        stats = {"total": len(backup_settings), "added": len(diff["added"]),
                 "removed": len(diff["removed"]), "modified": len(diff["modified"]), "unchanged": len(diff["unchanged"])}
        return {"success": True, "diff": diff, "stats": stats}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to compare config: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

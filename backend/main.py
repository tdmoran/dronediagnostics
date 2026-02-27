"""Drone Diagnostics API - Main FastAPI application."""

import asyncio
import json
from contextlib import asynccontextmanager
from typing import Optional, Set

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from msp.protocol import MSPProtocol, GPSPosition
from msp.codes import MSP_RAW_GPS, MSP_COMP_GPS, MSP_GPS_DATA
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
        "connected_clients": len(connected_clients),
        "serial_connected": serial_status
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

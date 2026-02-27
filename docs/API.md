# DroneDiagnostics API Documentation

## Base URL
```
http://localhost:8000
```

## REST Endpoints

### GPS Endpoints

#### Get Current GPS Data
```http
GET /api/gps
```

Returns the most recent GPS position data including latitude, longitude, altitude, speed, course, fix type, and satellite count.

**Response:**
```json
{
  "lat": 51.5074,
  "lon": -0.1278,
  "altitude": 50,
  "speed": 250,
  "course": 90,
  "fix_type": 2,
  "num_satellites": 12,
  "hdop": 150,
  "lat_dms": "51°30'26.6\"N",
  "lon_dms": "0°7'40.1\"W",
  "coordinates_decimal": "51.507400, -0.127800",
  "coordinates_dms": "51°30'26.6\"N, 0°7'40.1\"W",
  "fix_status": "3D Fix",
  "fix_color": "green"
}
```

#### Get GPS Status
```http
GET /api/gps/status
```

Returns a summary of GPS fix status.

**Response:**
```json
{
  "has_fix": true,
  "fix_type": 2,
  "fix_status": "3D Fix",
  "num_satellites": 12,
  "color": "green"
}
```

#### Simulate GPS Data
```http
POST /api/gps/simulate?lat=51.5074&lon=-0.1278
```

Generates simulated GPS data for testing purposes.

**Query Parameters:**
- `lat` (optional): Latitude for simulation center (default: 51.5074)
- `lon` (optional): Longitude for simulation center (default: -0.1278)

**Response:**
```json
{
  "message": "GPS data simulated",
  "gps": { ... }
}
```

### Serial Connection Endpoints

#### List Available Serial Ports
```http
GET /api/serial/ports
```

Returns a list of available serial ports on the system.

**Response:**
```json
{
  "ports": ["/dev/ttyUSB0", "/dev/ttyACM0"],
  "count": 2
}
```

#### Connect to Serial Port
```http
POST /api/serial/connect?port=/dev/ttyUSB0&baudrate=115200
```

Connects to a flight controller via serial port.

**Query Parameters:**
- `port` (required): Serial port path (e.g., `/dev/ttyUSB0`, `COM3`)
- `baudrate` (optional): Baud rate (default: 115200)

**Response:**
```json
{
  "connected": true,
  "port": "/dev/ttyUSB0",
  "baudrate": 115200
}
```

#### Disconnect from Serial Port
```http
POST /api/serial/disconnect
```

Disconnects from the current serial connection.

**Response:**
```json
{
  "connected": false
}
```

#### Get Serial Connection Status
```http
GET /api/serial/status
```

Returns the current serial connection status.

**Response:**
```json
{
  "connected": true,
  "port": "/dev/ttyUSB0",
  "baudrate": 115200
}
```

### System Endpoints

#### Health Check
```http
GET /api/health
```

Returns system health status.

**Response:**
```json
{
  "status": "healthy",
  "connected_clients": 3,
  "serial_connected": true
}
```

## WebSocket Endpoint

### Real-time Telemetry Stream
```
WS /ws/telemetry
```

Connect to this WebSocket endpoint to receive real-time telemetry data at 10Hz.

**Message Format:**
```json
{
  "type": "telemetry",
  "timestamp": 1709071200.123,
  "gps": {
    "lat": 51.5074,
    "lon": -0.1278,
    "altitude": 50,
    "speed": 250,
    "course": 90,
    "fix_type": 2,
    "num_satellites": 12,
    ...
  }
}
```

**Keepalive:**
Send `ping` to receive `pong` response:
```
Client → Server: "ping"
Server → Client: "pong"
```

## MSP Protocol Commands

### GPS Command Codes

| Code | Name | Description |
|------|------|-------------|
| 106 | MSP_RAW_GPS | Raw GPS position data (lat, lon, altitude, speed, course) |
| 107 | MSP_COMP_GPS | Computed GPS data (distance to home, direction to home) |
| 109 | MSP_GPS_DATA | Extended GPS data including HDOP |

### GPS Data Structure (MSP_RAW_GPS)

| Byte | Type | Description |
|------|------|-------------|
| 0 | uint8 | GPS fix type (0=no fix, 1=2D, 2=3D) |
| 1 | uint8 | Number of satellites |
| 2-5 | int32 | Latitude (degrees × 10^7) |
| 6-9 | int32 | Longitude (degrees × 10^7) |
| 10-11 | uint16 | Altitude (meters) |
| 12-13 | uint16 | Speed (cm/s) |
| 14-15 | uint16 | Course (degrees × 10) |

### Coordinate Formats

**Decimal Degrees:**
```
51.507400, -0.127800
```

**Degrees, Minutes, Seconds (DMS):**
```
51°30'26.6"N, 0°7'40.1"W
```

### Fix Type Indicators

| Value | Status | Color |
|-------|--------|-------|
| 0 | No Fix | Red |
| 1 | 2D Fix | Yellow |
| 2 | 3D Fix | Green |

## Error Responses

All endpoints return appropriate HTTP status codes:

- `200 OK` - Request successful
- `400 Bad Request` - Invalid parameters
- `404 Not Found` - Endpoint not found
- `500 Internal Server Error` - Server error

Error responses include a detail message:
```json
{
  "detail": "Error description"
}
```

## CORS

The API is configured with CORS enabled for development:
- Allowed origins: `*` (all origins)
- Allowed methods: `*`
- Allowed headers: `*`

For production, configure appropriate CORS restrictions in `backend/main.py`.

# DroneDiagnostics 🚁

Real-time drone diagnostics and GPS tracking application with MSP protocol support.

![GPS Status](https://img.shields.io/badge/GPS-3D%20Fix-green)
![WebSocket](https://img.shields.io/badge/WebSocket-10Hz-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## Features

- 📡 **GPS Tracking**: Real-time drone position on interactive map (Leaflet)
- 🔌 **MSP Protocol**: Full MultiWii Serial Protocol support for Betaflight/iNav
- ⚡ **WebSocket Telemetry**: Live data streaming at 10Hz
- 📊 **GPS Status**: Fix type, satellite count, HDOP monitoring
- 🗺️ **Coordinates**: Decimal and DMS format display
- 🔗 **Serial Connection**: Direct flight controller communication
- 📱 **Responsive UI**: Works on desktop and mobile

## Quick Start

### Option 1: Using the Startup Script

```bash
# Clone the repository
git clone https://github.com/tdmoran/dronediagnostics.git
cd dronediagnostics

# Start both backend and frontend
./start.sh

# Or start individually:
./start.sh backend   # Backend only
./start.sh frontend  # Frontend only
```

### Option 2: Manual Setup

**Backend:**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python main.py
```
Backend runs at: http://localhost:8000

**Frontend:**
```bash
npm install
npm run dev
```
Frontend runs at: http://localhost:3000

## Usage

### 1. Connect to Flight Controller

1. Open the GPS page: http://localhost:3000/gps
2. Select your serial port from the dropdown
3. Choose the correct baud rate (typically 115200)
4. Click "Connect"

### 2. View GPS Data

- **Map**: Real-time position with drone marker
- **Stats Panel**: Satellites, fix type, HDOP, speed, altitude
- **Coordinates**: Both decimal and DMS formats
- **Status Indicator**: Red/Yellow/Green for fix quality

### 3. Test Without Hardware

Use the "Simulate GPS Data" button on the dashboard to generate test data.

## Project Structure

```
DroneDiagnostics/
├── backend/              # FastAPI Python backend
│   ├── msp/             # MSP protocol implementation
│   │   ├── codes.py     # MSP command codes (106, 107, 109)
│   │   ├── protocol.py  # GPS parsers
│   │   └── serial.py    # Serial connection handler
│   ├── main.py          # FastAPI application
│   └── requirements.txt
├── app/                 # Next.js 14 frontend
│   ├── gps/            # GPS tracking page
│   ├── page.tsx        # Dashboard
│   └── layout.tsx      # Root layout
├── components/          # React components
│   ├── GPSMap.tsx      # Leaflet map
│   ├── GPSStatsPanel.tsx
│   ├── GPSCoordinates.tsx
│   ├── GPSStatusIndicator.tsx
│   └── SerialConnectionManager.tsx
├── hooks/              # Custom React hooks
│   └── useTelemetry.ts # WebSocket handler
├── types/              # TypeScript types
│   └── gps.ts
└── docs/               # Documentation
    └── API.md          # API reference
```

## API Endpoints

### GPS
- `GET /api/gps` - Current GPS data
- `GET /api/gps/status` - GPS fix status
- `POST /api/gps/simulate` - Generate test data

### Serial
- `GET /api/serial/ports` - List available ports
- `POST /api/serial/connect` - Connect to FC
- `POST /api/serial/disconnect` - Disconnect
- `GET /api/serial/status` - Connection status

### WebSocket
- `WS /ws/telemetry` - Real-time telemetry stream (10Hz)

See [docs/API.md](docs/API.md) for complete documentation.

## MSP GPS Commands

| Code | Command | Description |
|------|---------|-------------|
| 106 | MSP_RAW_GPS | Position, altitude, speed, course |
| 107 | MSP_COMP_GPS | Distance/direction to home |
| 109 | MSP_GPS_DATA | Extended data with HDOP |

### GPS Data Fields

- **Latitude/Longitude**: Decimal degrees and DMS formats
- **Altitude**: Meters above sea level
- **Speed**: cm/s (centimeters per second)
- **Course**: Degrees (0-360)
- **Fix Type**: 0=No Fix, 1=2D, 2=3D
- **Satellites**: Number in view
- **HDOP**: Horizontal dilution of precision

## Hardware Compatibility

Tested with:
- Betaflight flight controllers
- iNav flight controllers
- Any MSP-compatible FC

Connection:
- USB-to-UART adapter
- Direct USB (CP2102, CH340, FTDI)

## Technology Stack

- **Backend**: Python 3.9+, FastAPI, WebSockets, PySerial
- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Maps**: Leaflet, React-Leaflet
- **Icons**: Lucide React

## Development

### Adding New MSP Commands

1. Add command code to `backend/msp/codes.py`
2. Add parser to `backend/msp/protocol.py`
3. Add API endpoint to `backend/main.py`
4. Update frontend types in `types/gps.ts`

### Testing Serial Connection

```python
from backend.msp.serial import MSPSerialConnection

conn = MSPSerialConnection('/dev/ttyUSB0', 115200)
if conn.connect():
    print("Connected!")
    conn.request_gps_data()
    response = conn.read_response()
    print(response)
```

## Troubleshooting

### No Serial Ports Detected
- **Linux**: Add user to `dialout` group: `sudo usermod -a -G dialout $USER`
- **macOS**: Install CH340/CP2102 drivers
- **Windows**: Check Device Manager for COM port number

### GPS Not Updating
- Check baud rate matches FC configuration
- Verify MSP is enabled in Betaflight/iNav configurator
- Check that GPS module is connected to FC

### WebSocket Disconnected
- Ensure backend is running on port 8000
- Check firewall settings
- Refresh the page to reconnect

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## License

MIT License - See LICENSE file for details

## Acknowledgments

- MultiWii Serial Protocol documentation
- Betaflight and iNav communities
- Leaflet.js mapping library

---

**"Where we're going, we don't need roads."** — Dr. Emmett Brown 🚁

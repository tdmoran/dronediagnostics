# DroneDiagnostics

Real-time drone diagnostics and GPS tracking application.

## Features

- **GPS Tracking**: Real-time drone position on interactive map
- **MSP Protocol**: Full MultiWii Serial Protocol support for GPS data
- **WebSocket Telemetry**: Live data streaming at 10Hz
- **GPS Status**: Fix type, satellite count, HDOP monitoring
- **Coordinates**: Decimal and DMS format display

## Project Structure

```
DroneDiagnostics/
├── backend/           # FastAPI Python backend
│   ├── msp/          # MSP protocol implementation
│   │   ├── codes.py  # MSP command codes
│   │   └── protocol.py # GPS parsers
│   ├── main.py       # FastAPI app with GPS endpoints
│   └── requirements.txt
├── app/              # Next.js frontend
│   ├── gps/          # GPS tracking page
│   ├── page.tsx      # Dashboard
│   └── layout.tsx    # Root layout with sidebar
├── components/       # React components
│   ├── Sidebar.tsx   # Navigation sidebar
│   ├── GPSMap.tsx    # Leaflet map component
│   ├── GPSStatsPanel.tsx
│   ├── GPSCoordinates.tsx
│   └── GPSStatusIndicator.tsx
├── hooks/            # Custom React hooks
│   └── useTelemetry.ts
├── types/            # TypeScript types
│   └── gps.ts
└── lib/              # Utility functions
    └── utils.ts
```

## Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

Backend runs on http://localhost:8000

### API Endpoints

- `GET /api/gps` - Current GPS data
- `GET /api/gps/status` - GPS fix status
- `POST /api/gps/simulate` - Simulate GPS data (testing)
- `WS /ws/telemetry` - WebSocket telemetry stream

## Frontend Setup

```bash
npm install
npm run dev
```

Frontend runs on http://localhost:3000

## MSP GPS Commands

Implemented MSP command codes:
- `MSP_RAW_GPS (106)` - Raw GPS position data
- `MSP_COMP_GPS (107)` - Computed navigation data
- `MSP_GPS_DATA (109)` - Extended GPS data with HDOP

## GPS Data Fields

- Latitude/Longitude (decimal degrees and DMS)
- Altitude (meters)
- Speed (cm/s)
- Course/Heading (degrees)
- Fix Type (0=no fix, 1=2D, 2=3D)
- Number of Satellites
- HDOP (Horizontal Dilution of Precision)

## Development

The application uses:
- **Backend**: FastAPI + WebSockets
- **Frontend**: Next.js 14 + React + TypeScript
- **Styling**: Tailwind CSS
- **Maps**: Leaflet + React-Leaflet
- **Icons**: Lucide React

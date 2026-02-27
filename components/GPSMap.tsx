'use client';

import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { Icon } from 'leaflet';
import { GPSData } from '@/types/gps';

// Fix Leaflet icon issues in Next.js
import L from 'leaflet';

delete (L.Icon.Default.prototype as any)._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom drone icon
const droneIcon = new Icon({
  iconUrl: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjM2I4MmY2IiBzdHJva2Utd2lkdGg9IjIiPjxwYXRoIGQ9Ik0xMiAyTDQuNSA4LjU1djYuOUwxMiAyMmw3LjUtNi41NXYtNi45TDEyIDJ6Ii8+PHBhdGggZD0iTTEyIDJ2MjAiLz48cGF0aCBkPSJNMTIgMTJsNy41LTMuNDUiLz48cGF0aCBkPSJNMTIgMTJsLTcuNS0zLjQ1Ii8+PC9zdmc+',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16],
});

interface GPSMapProps {
  gps: GPSData | null;
  height?: string;
}

// Component to recenter map when position changes
function MapUpdater({ position }: { position: [number, number] }) {
  const map = useMap();
  
  useEffect(() => {
    map.setView(position, map.getZoom());
  }, [position, map]);
  
  return null;
}

export function GPSMap({ gps, height = '400px' }: GPSMapProps) {
  // Default position (London)
  const defaultPosition: [number, number] = [51.5074, -0.1278];
  const position: [number, number] = gps ? [gps.lat, gps.lon] : defaultPosition;

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden" style={{ height }}>
      <MapContainer
        center={position}
        zoom={15}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {gps && gps.fix_type > 0 && (
          <Marker position={position} icon={droneIcon}>
            <Popup>
              <div className="text-sm">
                <p className="font-semibold">Drone Position</p>
                <p>Lat: {gps.lat.toFixed(6)}</p>
                <p>Lon: {gps.lon.toFixed(6)}</p>
                <p>Altitude: {gps.altitude}m</p>
                <p>Speed: {gps.speed} cm/s</p>
                <p>Course: {gps.course}°</p>
              </div>
            </Popup>
          </Marker>
        )}
        
        <MapUpdater position={position} />
      </MapContainer>
      
      {(!gps || gps.fix_type === 0) && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 pointer-events-none">
          <div className="text-center">
            <p className="text-gray-400 text-lg">No GPS Fix</p>
            <p className="text-gray-600 text-sm">Waiting for satellite lock...</p>
          </div>
        </div>
      )}
    </div>
  );
}

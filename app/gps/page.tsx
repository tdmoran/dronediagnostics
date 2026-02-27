'use client';

import dynamic from 'next/dynamic';
import { useTelemetry } from '@/hooks/useTelemetry';
import { GPSStatusIndicator } from '@/components/GPSStatusIndicator';
import { GPSStatsPanel } from '@/components/GPSStatsPanel';
import { GPSCoordinates } from '@/components/GPSCoordinates';
import { SerialConnectionManager } from '@/components/SerialConnectionManager';
import { useEffect, useState } from 'react';
import { GPSStatus } from '@/types/gps';
import { Activity, Wifi, WifiOff } from 'lucide-react';

// Dynamic import for GPSMap to avoid SSR issues with Leaflet
const GPSMap = dynamic(() => import('@/components/GPSMap').then(mod => mod.GPSMap), {
  ssr: false,
  loading: () => (
    <div className="bg-bf-surface rounded border border-bf-border h-[400px] flex items-center justify-center">
      <div className="text-bf-text-muted">Loading map...</div>
    </div>
  ),
});

export default function GPSPage() {
  const { isConnected, gpsData, error } = useTelemetry();
  const [gpsStatus, setGpsStatus] = useState<GPSStatus | null>(null);

  // Fetch GPS status periodically
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch('/api/gps/status');
        if (response.ok) {
          const status = await response.json();
          setGpsStatus(status);
        }
      } catch (err) {
        console.error('Failed to fetch GPS status:', err);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-bf-text flex items-center gap-2">
            <Activity className="w-6 h-6 text-bf-accent" />
            GPS Tracking
          </h1>
          <p className="text-bf-text-muted mt-1">
            Real-time drone position and telemetry
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Connection Status */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded border ${
            isConnected 
              ? 'bg-bf-success/10 border-bf-success/30 text-bf-success' 
              : 'bg-bf-danger/10 border-bf-danger/30 text-bf-danger'
          }`}>
            {isConnected ? (
              <><Wifi className="w-4 h-4" /> Connected</>
            ) : (
              <><WifiOff className="w-4 h-4" /> Disconnected</>
            )}
          </div>
          
          {/* GPS Status */}
          <GPSStatusIndicator status={gpsStatus} size="md" />
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-bf-danger/10 border border-bf-danger/30 rounded p-4 text-bf-danger">
          {error}
        </div>
      )}

      {/* Map */}
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-bf-text">Position Map</h2>
        <GPSMap gps={gpsData} height="400px" />
      </div>

      {/* Stats, Coordinates, and Serial Connection */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <GPSStatsPanel gps={gpsData} />
        <GPSCoordinates gps={gpsData} />
        <SerialConnectionManager />
      </div>

      {/* Debug Info */}
      {gpsData && (
        <div className="bg-bf-surface rounded p-4 border border-bf-border">
          <h3 className="text-sm font-semibold text-bf-text-muted mb-2">Raw GPS Data</h3>
          <pre className="text-xs text-bf-text-muted overflow-x-auto font-mono">
            {JSON.stringify(gpsData, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

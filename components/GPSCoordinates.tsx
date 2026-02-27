'use client';

import { GPSData } from '@/types/gps';
import { Copy, MapPin } from 'lucide-react';
import { useState } from 'react';

interface GPSCoordinatesProps {
  gps: GPSData | null;
}

export function GPSCoordinates({ gps }: GPSCoordinatesProps) {
  const [copied, setCopied] = useState<'decimal' | 'dms' | null>(null);

  const handleCopy = (type: 'decimal' | 'dms', text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  if (!gps) {
    return (
      <div className="bg-bf-surface rounded p-6 border border-bf-border">
        <h3 className="text-lg font-semibold text-bf-text mb-4 flex items-center gap-2">
          <MapPin className="w-5 h-5 text-bf-accent" />
          Coordinates
        </h3>
        <div className="text-bf-text-muted text-center py-8">
          No GPS data available
        </div>
      </div>
    );
  }

  return (
    <div className="bg-bf-surface rounded p-6 border border-bf-border">
      <h3 className="text-lg font-semibold text-bf-text mb-4 flex items-center gap-2">
        <MapPin className="w-5 h-5 text-bf-accent" />
        Coordinates
      </h3>
      
      <div className="space-y-4">
        {/* Decimal Degrees */}
        <div className="bg-bf-surface-light/50 rounded p-4 border border-bf-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-bf-text-muted">Decimal Degrees</span>
            <button
              onClick={() => handleCopy('decimal', gps.coordinates_decimal)}
              className="flex items-center gap-1 text-xs text-bf-accent hover:text-bf-accent-dark transition-colors"
            >
              <Copy className="w-3 h-3" />
              {copied === 'decimal' ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <div className="font-mono text-bf-text text-lg">
            {gps.coordinates_decimal}
          </div>
          <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
            <div>
              <span className="text-bf-text-muted">Lat: </span>
              <span className="text-bf-success font-mono">{gps.lat.toFixed(6)}°</span>
            </div>
            <div>
              <span className="text-bf-text-muted">Lon: </span>
              <span className="text-bf-accent font-mono">{gps.lon.toFixed(6)}°</span>
            </div>
          </div>
        </div>

        {/* DMS Format */}
        <div className="bg-bf-surface-light/50 rounded p-4 border border-bf-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-bf-text-muted">Degrees, Minutes, Seconds</span>
            <button
              onClick={() => handleCopy('dms', gps.coordinates_dms)}
              className="flex items-center gap-1 text-xs text-bf-accent hover:text-bf-accent-dark transition-colors"
            >
              <Copy className="w-3 h-3" />
              {copied === 'dms' ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <div className="font-mono text-bf-text text-lg">
            {gps.coordinates_dms}
          </div>
          <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
            <div>
              <span className="text-bf-text-muted">Lat: </span>
              <span className="text-bf-success font-mono">{gps.lat_dms}</span>
            </div>
            <div>
              <span className="text-bf-text-muted">Lon: </span>
              <span className="text-bf-accent font-mono">{gps.lon_dms}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

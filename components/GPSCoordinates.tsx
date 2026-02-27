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
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <MapPin className="w-5 h-5 text-blue-500" />
          Coordinates
        </h3>
        <div className="text-gray-500 text-center py-8">
          No GPS data available
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <MapPin className="w-5 h-5 text-blue-500" />
        Coordinates
      </h3>
      
      <div className="space-y-4">
        {/* Decimal Degrees */}
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Decimal Degrees</span>
            <button
              onClick={() => handleCopy('decimal', gps.coordinates_decimal)}
              className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              <Copy className="w-3 h-3" />
              {copied === 'decimal' ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <div className="font-mono text-white text-lg">
            {gps.coordinates_decimal}
          </div>
          <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
            <div>
              <span className="text-gray-500">Lat: </span>
              <span className="text-green-400 font-mono">{gps.lat.toFixed(6)}°</span>
            </div>
            <div>
              <span className="text-gray-500">Lon: </span>
              <span className="text-blue-400 font-mono">{gps.lon.toFixed(6)}°</span>
            </div>
          </div>
        </div>

        {/* DMS Format */}
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Degrees, Minutes, Seconds</span>
            <button
              onClick={() => handleCopy('dms', gps.coordinates_dms)}
              className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              <Copy className="w-3 h-3" />
              {copied === 'dms' ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <div className="font-mono text-white text-lg">
            {gps.coordinates_dms}
          </div>
          <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
            <div>
              <span className="text-gray-500">Lat: </span>
              <span className="text-green-400 font-mono">{gps.lat_dms}</span>
            </div>
            <div>
              <span className="text-gray-500">Lon: </span>
              <span className="text-blue-400 font-mono">{gps.lon_dms}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

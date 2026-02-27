'use client';

import { GPSData } from '@/types/gps';
import { 
  Navigation, 
  Gauge, 
  Mountain, 
  Satellite, 
  Activity,
  Target
} from 'lucide-react';

interface GPSStatsPanelProps {
  gps: GPSData | null;
}

export function GPSStatsPanel({ gps }: GPSStatsPanelProps) {
  if (!gps) {
    return (
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-blue-500" />
          GPS Statistics
        </h3>
        <div className="text-gray-500 text-center py-8">
          Waiting for GPS data...
        </div>
      </div>
    );
  }

  const stats = [
    {
      label: 'Satellites',
      value: gps.num_satellites,
      unit: 'visible',
      icon: <Satellite className="w-5 h-5 text-blue-500" />,
      color: gps.num_satellites >= 8 ? 'text-green-400' : 
             gps.num_satellites >= 4 ? 'text-yellow-400' : 'text-red-400',
    },
    {
      label: 'Fix Type',
      value: gps.fix_status,
      unit: '',
      icon: <Target className="w-5 h-5 text-purple-500" />,
      color: gps.fix_type === 2 ? 'text-green-400' : 
             gps.fix_type === 1 ? 'text-yellow-400' : 'text-red-400',
    },
    {
      label: 'HDOP',
      value: gps.hdop ? (gps.hdop / 100).toFixed(2) : '--',
      unit: gps.hdop ? (gps.hdop < 150 ? '(Good)' : gps.hdop < 300 ? '(Fair)' : '(Poor)') : '',
      icon: <Activity className="w-5 h-5 text-orange-500" />,
      color: gps.hdop && gps.hdop < 150 ? 'text-green-400' : 
             gps.hdop && gps.hdop < 300 ? 'text-yellow-400' : 'text-red-400',
    },
    {
      label: 'Speed',
      value: gps.speed,
      unit: 'cm/s',
      icon: <Gauge className="w-5 h-5 text-cyan-500" />,
      color: 'text-white',
    },
    {
      label: 'Altitude',
      value: gps.altitude,
      unit: 'm',
      icon: <Mountain className="w-5 h-5 text-emerald-500" />,
      color: 'text-white',
    },
    {
      label: 'Course',
      value: `${gps.course}°`,
      unit: getCompassDirection(gps.course),
      icon: <Navigation className="w-5 h-5 text-pink-500" style={{ transform: `rotate(${gps.course}deg)` }} />,
      color: 'text-white',
    },
  ];

  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <Activity className="w-5 h-5 text-blue-500" />
        GPS Statistics
      </h3>
      
      <div className="grid grid-cols-2 gap-4">
        {stats.map((stat) => (
          <div 
            key={stat.label}
            className="bg-gray-800/50 rounded-lg p-4 border border-gray-700"
          >
            <div className="flex items-center gap-2 mb-2">
              {stat.icon}
              <span className="text-sm text-gray-400">{stat.label}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className={cn("text-2xl font-bold", stat.color)}>
                {stat.value}
              </span>
              <span className="text-xs text-gray-500">{stat.unit}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function getCompassDirection(degrees: number): string {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(degrees / 45) % 8;
  return directions[index];
}

// Helper function needed for the component
function cn(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

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
      <div className="bg-bf-surface rounded p-6 border border-bf-border">
        <h3 className="text-lg font-semibold text-bf-text mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-bf-accent" />
          GPS Statistics
        </h3>
        <div className="text-bf-text-muted text-center py-8">
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
      icon: <Satellite className="w-5 h-5 text-bf-accent" />,
      color: gps.num_satellites >= 8 ? 'text-bf-success' : 
             gps.num_satellites >= 4 ? 'text-bf-warning' : 'text-bf-danger',
    },
    {
      label: 'Fix Type',
      value: gps.fix_status,
      unit: '',
      icon: <Target className="w-5 h-5 text-bf-accent" />,
      color: gps.fix_type === 2 ? 'text-bf-success' : 
             gps.fix_type === 1 ? 'text-bf-warning' : 'text-bf-danger',
    },
    {
      label: 'HDOP',
      value: gps.hdop ? (gps.hdop / 100).toFixed(2) : '--',
      unit: gps.hdop ? (gps.hdop < 150 ? '(Good)' : gps.hdop < 300 ? '(Fair)' : '(Poor)') : '',
      icon: <Activity className="w-5 h-5 text-bf-accent" />,
      color: gps.hdop && gps.hdop < 150 ? 'text-bf-success' : 
             gps.hdop && gps.hdop < 300 ? 'text-bf-warning' : 'text-bf-danger',
    },
    {
      label: 'Speed',
      value: gps.speed,
      unit: 'cm/s',
      icon: <Gauge className="w-5 h-5 text-bf-accent" />,
      color: 'text-bf-text',
    },
    {
      label: 'Altitude',
      value: gps.altitude,
      unit: 'm',
      icon: <Mountain className="w-5 h-5 text-bf-accent" />,
      color: 'text-bf-text',
    },
    {
      label: 'Course',
      value: `${gps.course}°`,
      unit: getCompassDirection(gps.course),
      icon: <Navigation className="w-5 h-5 text-bf-accent" style={{ transform: `rotate(${gps.course}deg)` }} />,
      color: 'text-bf-text',
    },
  ];

  return (
    <div className="bg-bf-surface rounded p-6 border border-bf-border">
      <h3 className="text-lg font-semibold text-bf-text mb-4 flex items-center gap-2">
        <Activity className="w-5 h-5 text-bf-accent" />
        GPS Statistics
      </h3>
      
      <div className="grid grid-cols-2 gap-4">
        {stats.map((stat) => (
          <div 
            key={stat.label}
            className="bg-bf-surface-light/50 rounded p-4 border border-bf-border"
          >
            <div className="flex items-center gap-2 mb-2">
              {stat.icon}
              <span className="text-sm text-bf-text-muted">{stat.label}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className={cn("text-2xl font-bold font-mono", stat.color)}>
                {stat.value}
              </span>
              <span className="text-xs text-bf-text-muted">{stat.unit}</span>
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

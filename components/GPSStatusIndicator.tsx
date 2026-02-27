'use client';

import { GPSStatus, FIX_TYPE_COLORS, FIX_TYPE_LABELS } from '@/types/gps';
import { cn } from '@/lib/utils';
import { Satellite, Signal } from 'lucide-react';

interface GPSStatusIndicatorProps {
  status: GPSStatus | null;
  size?: 'sm' | 'md' | 'lg';
  showDetails?: boolean;
}

export function GPSStatusIndicator({ 
  status, 
  size = 'md',
  showDetails = true 
}: GPSStatusIndicatorProps) {
  const sizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-6 h-6',
  };

  const containerSizes = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base',
  };

  if (!status) {
    return (
      <div className={cn(
        "inline-flex items-center gap-2 rounded-full bg-gray-800",
        containerSizes[size]
      )}>
        <div className={cn("rounded-full bg-gray-500", sizeClasses[size])} />
        <span className="text-gray-400">No Data</span>
      </div>
    );
  }

  const colorClass = FIX_TYPE_COLORS[status.fix_type as 0 | 1 | 2] || 'bg-gray-500';
  const label = FIX_TYPE_LABELS[status.fix_type as 0 | 1 | 2] || 'Unknown';

  return (
    <div className={cn(
      "inline-flex items-center gap-3 rounded-lg border",
      status.fix_type === 2 ? 'border-green-800 bg-green-950/30' :
      status.fix_type === 1 ? 'border-yellow-800 bg-yellow-950/30' :
      'border-red-800 bg-red-950/30',
      containerSizes[size]
    )}>
      <div className="flex items-center gap-2">
        <div className={cn(
          "rounded-full animate-pulse",
          colorClass,
          sizeClasses[size]
        )} />
        <span className={cn(
          "font-medium",
          status.fix_type === 2 ? 'text-green-400' :
          status.fix_type === 1 ? 'text-yellow-400' :
          'text-red-400'
        )}>
          {label}
        </span>
      </div>
      
      {showDetails && (
        <div className="flex items-center gap-3 pl-3 border-l border-gray-700">
          <div className="flex items-center gap-1 text-gray-400">
            <Satellite className="w-4 h-4" />
            <span>{status.num_satellites} sats</span>
          </div>
          <div className="flex items-center gap-1 text-gray-400">
            <Signal className={cn(
              "w-4 h-4",
              status.fix_type === 2 ? 'text-green-400' :
              status.fix_type === 1 ? 'text-yellow-400' :
              'text-red-400'
            )} />
            <span>{status.has_fix ? 'Locked' : 'Searching'}</span>
          </div>
        </div>
      )}
    </div>
  );
}

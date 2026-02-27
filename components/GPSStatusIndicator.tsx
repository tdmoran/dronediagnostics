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
        "inline-flex items-center gap-2 rounded bg-bf-surface-light border border-bf-border",
        containerSizes[size]
      )}>
        <div className={cn("rounded-full bg-bf-text-muted", sizeClasses[size])} />
        <span className="text-bf-text-muted">No Data</span>
      </div>
    );
  }

  const colorClass = FIX_TYPE_COLORS[status.fix_type as 0 | 1 | 2] || 'bg-bf-text-muted';
  const label = FIX_TYPE_LABELS[status.fix_type as 0 | 1 | 2] || 'Unknown';

  return (
    <div className={cn(
      "inline-flex items-center gap-3 rounded border",
      status.fix_type === 2 ? 'border-bf-success/30 bg-bf-success/10' :
      status.fix_type === 1 ? 'border-bf-warning/30 bg-bf-warning/10' :
      'border-bf-danger/30 bg-bf-danger/10',
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
          status.fix_type === 2 ? 'text-bf-success' :
          status.fix_type === 1 ? 'text-bf-warning' :
          'text-bf-danger'
        )}>
          {label}
        </span>
      </div>
      
      {showDetails && (
        <div className="flex items-center gap-3 pl-3 border-l border-bf-border">
          <div className="flex items-center gap-1 text-bf-text-muted">
            <Satellite className="w-4 h-4" />
            <span className="font-mono">{status.num_satellites}</span>
            <span>sats</span>
          </div>
          <div className="flex items-center gap-1 text-bf-text-muted">
            <Signal className={cn(
              "w-4 h-4",
              status.fix_type === 2 ? 'text-bf-success' :
              status.fix_type === 1 ? 'text-bf-warning' :
              'text-bf-danger'
            )} />
            <span>{status.has_fix ? 'Locked' : 'Searching'}</span>
          </div>
        </div>
      )}
    </div>
  );
}

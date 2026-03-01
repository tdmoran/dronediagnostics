'use client';

import { usePathname } from 'next/navigation';
import { useTelemetry } from '@/components/TelemetryProvider';

const FONT = "'SF Mono', Monaco, 'Cascadia Code', monospace";

const routeTitles: Record<string, string> = {
  '/': 'Setup',
  '/gps': 'GPS',
  '/telemetry': 'Telemetry',
  '/battery': 'Battery',
  '/radio': 'Radio',
  '/diagnose': 'Diagnose',
  '/blackbox': 'Blackbox',
  '/firmware': 'Firmware',
  '/config': 'Configuration',
  '/settings': 'Settings',
  '/dashboard': 'Dashboard',
};

export function TopBar() {
  const pathname = usePathname();
  const { telemetry, connected } = useTelemetry();

  const pageTitle = routeTitles[pathname] ?? 'Setup';
  const flightMode = telemetry?.status?.flight_mode ?? 0;
  const isArmed = (flightMode & 1) !== 0;

  return (
    <div className="hidden lg:flex items-center h-10 bg-[#1a1a1a] border-b border-[#333] px-4 gap-4 shrink-0">
      {/* Page title */}
      <span
        className="text-sm font-semibold text-[#f2f2f2] uppercase tracking-wider"
        style={{ fontFamily: FONT }}
      >
        {pageTitle}
      </span>

      <div className="flex-1" />

      {/* Arming status badge */}
      <span
        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm ${
          isArmed
            ? 'bg-[#e2123f]/20 text-[#e2123f] border border-[#e2123f]/40'
            : 'bg-[#333] text-[#8c8c8c] border border-[#444]'
        }`}
        style={{ fontFamily: FONT }}
      >
        {isArmed ? 'ARMED' : 'DISABLED'}
      </span>

      {/* Connection badge */}
      <span
        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm ${
          connected
            ? 'bg-[#96e212]/20 text-[#96e212] border border-[#96e212]/40'
            : 'bg-[#333] text-[#8c8c8c] border border-[#444]'
        }`}
        style={{ fontFamily: FONT }}
      >
        {connected ? 'ONLINE' : 'OFFLINE'}
      </span>

      {/* Action buttons */}
      <button
        className="text-[10px] font-semibold uppercase tracking-wider px-3 py-1 rounded-sm bg-[#333] text-[#8c8c8c] hover:bg-[#444] hover:text-[#f2f2f2] transition-colors border border-[#444]"
        style={{ fontFamily: FONT }}
      >
        Calibrate
      </button>

      <button
        className={`text-[10px] font-semibold uppercase tracking-wider px-3 py-1 rounded-sm transition-colors border ${
          isArmed
            ? 'bg-[#e2123f]/20 text-[#e2123f] border-[#e2123f]/40 hover:bg-[#e2123f]/30'
            : 'bg-[#ffbb00]/10 text-[#ffbb00] border-[#ffbb00]/30 hover:bg-[#ffbb00]/20'
        }`}
        style={{ fontFamily: FONT }}
      >
        {isArmed ? 'DISARM' : 'ARM'}
      </button>
    </div>
  );
}

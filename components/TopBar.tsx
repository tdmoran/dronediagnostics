'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTelemetry } from '@/components/TelemetryProvider';
import { Zap, Cpu, Signal } from 'lucide-react';

const FONT = "'SF Mono', Monaco, 'Cascadia Code', monospace";

const routeTitles: Record<string, string> = {
  '/': 'Overview',
  '/dashboard': 'Dashboard',
  '/gps': 'GPS',
  '/telemetry': 'Telemetry',
  '/battery': 'Battery',
  '/radio': 'Radio / Receiver',
  '/pid': 'PID Tuning',
  '/motors': 'Motors',
  '/cli': 'CLI',
  '/diagnose': 'Diagnose',
  '/blackbox': 'Blackbox',
  '/firmware': 'Firmware',
  '/config': 'Configuration',
  '/settings': 'Settings',
};

export function TopBar() {
  const pathname = usePathname();
  const { telemetry, connected } = useTelemetry();

  const pageTitle = routeTitles[pathname] ?? 'Overview';
  const flightMode = telemetry?.status?.flight_mode ?? 0;
  const isArmed = (flightMode & 1) !== 0;
  const voltage = telemetry?.battery?.voltage;
  const cycleTime = telemetry?.status?.cycle_time;
  const rssi = telemetry?.battery?.rssi;

  const voltageColor =
    voltage == null ? '#8c8c8c'
    : voltage > 14 ? '#96e212'
    : voltage > 12 ? '#ffbb00'
    : '#e2123f';

  const rssiPct = rssi != null ? (rssi > 100 ? Math.round(rssi / 10.23) : rssi) : null;

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

      {/* Cycle time */}
      {cycleTime != null && (
        <div className="flex items-center gap-1.5" title="FC Cycle Time">
          <Cpu className="w-3 h-3 text-[#8c8c8c]" />
          <span className="text-[10px] text-[#8c8c8c]" style={{ fontFamily: FONT }}>
            {cycleTime}µs
          </span>
        </div>
      )}

      {/* Battery voltage */}
      {voltage != null && (
        <div className="flex items-center gap-1.5" title="Battery Voltage">
          <Zap className="w-3 h-3" style={{ color: voltageColor }} />
          <span className="text-[10px] font-bold" style={{ fontFamily: FONT, color: voltageColor }}>
            {voltage.toFixed(1)}V
          </span>
        </div>
      )}

      {/* RSSI */}
      {rssiPct != null && (
        <div className="flex items-center gap-1.5" title="RSSI">
          <Signal className="w-3 h-3 text-[#8c8c8c]" />
          <span
            className="text-[10px]"
            style={{
              fontFamily: FONT,
              color: rssiPct > 60 ? '#96e212' : rssiPct > 30 ? '#ffbb00' : '#e2123f',
            }}
          >
            {rssiPct}%
          </span>
        </div>
      )}

      {/* Arming status badge */}
      <span
        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm ${
          isArmed
            ? 'bg-[#e2123f]/20 text-[#e2123f] border border-[#e2123f]/40'
            : 'bg-[#333] text-[#8c8c8c] border border-[#444]'
        }`}
        style={{ fontFamily: FONT }}
      >
        {isArmed ? 'ARMED' : 'DISARMED'}
      </span>

      {/* Connection badge */}
      <span
        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm flex items-center gap-1.5 ${
          connected
            ? 'bg-[#96e212]/20 text-[#96e212] border border-[#96e212]/40'
            : 'bg-[#333] text-[#8c8c8c] border border-[#444]'
        }`}
        style={{ fontFamily: FONT }}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-[#96e212] animate-pulse' : 'bg-[#8c8c8c]'}`} />
        {connected ? 'ONLINE' : 'OFFLINE'}
      </span>

      {/* Connect / port display */}
      {connected && (
        <span className="text-[10px] text-[#8c8c8c] font-mono hidden xl:block truncate max-w-[120px]">
          /dev/ttyUSB0
        </span>
      )}
      {!connected && (
        <Link
          href="/gps"
          className="text-[10px] font-semibold uppercase tracking-wider px-3 py-1 rounded-sm bg-[#96e212]/10 text-[#96e212] border border-[#96e212]/30 hover:bg-[#96e212]/20 transition-colors"
          style={{ fontFamily: FONT }}
        >
          Connect
        </Link>
      )}
    </div>
  );
}

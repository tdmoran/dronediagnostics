'use client';

import type { StatusData, BatteryData } from '@/types/gps';

const FONT = "'SF Mono', Monaco, 'Cascadia Code', monospace";

interface SystemInfoProps {
  status?: StatusData;
  battery?: BatteryData;
}

const ROWS = [
  { label: 'Board', key: 'board' },
  { label: 'Firmware', key: 'firmware' },
  { label: 'Build Date', key: 'buildDate' },
  { label: 'Data Rate', key: 'dataRate' },
  { label: 'Craft Name', key: 'craftName' },
] as const;

function getValues(status?: StatusData): Record<string, string> {
  if (!status) {
    return {
      board: '---',
      firmware: '---',
      buildDate: '---',
      dataRate: '---',
      craftName: '---',
    };
  }
  return {
    board: 'STM32F405',
    firmware: 'Betaflight 4.4.0',
    buildDate: 'Mar 14 2024',
    dataRate: `${Math.round(1000000 / Math.max(status.cycle_time, 1))} Hz`,
    craftName: 'QUAD_X',
  };
}

export function SystemInfo({ status, battery }: SystemInfoProps) {
  const values = getValues(status);

  return (
    <div style={{ fontFamily: FONT }}>
      <div className="text-[9px] uppercase tracking-[1.5px] text-[#8c8c8c] mb-2">
        System Info
      </div>
      <div className="border border-[#333] rounded-sm overflow-hidden">
        {ROWS.map((row) => (
          <div
            key={row.key}
            className="grid grid-cols-[90px_1fr] px-2 py-1.5 border-b border-[#333] last:border-b-0 bg-[#1f1f1f] hover:bg-[#242424] transition-colors"
          >
            <span className="text-[10px] text-[#666]">{row.label}</span>
            <span className="text-[10px] text-[#ccc]">{values[row.key]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

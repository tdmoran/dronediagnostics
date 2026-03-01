"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import {
  LayoutDashboard,
  MapPin,
  Activity,
  Battery,
  Radio,
  Wrench,
  FileText,
  Cpu,
  Settings,
  Cog,
  Wifi,
} from "lucide-react"
import { useTelemetry } from "@/components/TelemetryProvider"

const MONO_FONT = "'SF Mono', Monaco, 'Cascadia Code', monospace"

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
}

interface NavGroup {
  section: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    section: "Monitoring",
    items: [
      { label: "Dashboard", href: "/", icon: <LayoutDashboard className="w-5 h-5" /> },
      { label: "GPS", href: "/gps", icon: <MapPin className="w-5 h-5" /> },
      { label: "Telemetry", href: "/telemetry", icon: <Activity className="w-5 h-5" /> },
      { label: "Battery", href: "/battery", icon: <Battery className="w-5 h-5" /> },
      { label: "Radio", href: "/radio", icon: <Radio className="w-5 h-5" /> },
    ],
  },
  {
    section: "Tools",
    items: [
      { label: "Diagnose", href: "/diagnose", icon: <Wrench className="w-5 h-5" /> },
      { label: "Blackbox", href: "/blackbox", icon: <FileText className="w-5 h-5" /> },
      { label: "Firmware", href: "/firmware", icon: <Cpu className="w-5 h-5" /> },
      { label: "Config", href: "/config", icon: <Wifi className="w-5 h-5" /> },
    ],
  },
  {
    section: "System",
    items: [
      { label: "Settings", href: "/settings", icon: <Settings className="w-5 h-5" /> },
    ],
  },
]

export function DesktopSidebar() {
  const pathname = usePathname()
  const { telemetry, connected } = useTelemetry()

  const cycleTime = telemetry?.status?.cycle_time
  const flightMode = telemetry?.status?.flight_mode ?? 0
  const isArmed = (flightMode & 1) !== 0

  return (
    <aside className="hidden lg:flex w-64 shrink-0 bg-[#141414] border-r border-[#333] h-screen sticky top-0 flex-col overflow-y-auto">
      {/* Logo */}
      <div className="px-6 py-5">
        <h1 className="text-xl font-bold flex items-center gap-2 text-[#f2f2f2]">
          <Cog className="w-6 h-6 text-[#ffbb00]" />
          DroneDiag
        </h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 space-y-6">
        {navGroups.map((group) => (
          <div key={group.section}>
            <p className="text-[#8c8c8c] uppercase text-xs tracking-wider font-semibold px-4 mb-2">
              {group.section}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname === item.href || pathname.startsWith(`${item.href}/`)

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={
                        isActive
                          ? "flex items-center gap-3 px-4 py-2.5 rounded-[4px] bg-[rgba(255,187,0,0.1)] text-[#ffbb00] border-l-[3px] border-l-[#ffbb00] transition-colors"
                          : "flex items-center gap-3 px-4 py-2.5 rounded-[4px] text-[#8c8c8c] hover:bg-[#242424] hover:text-[#f2f2f2] transition-colors"
                      }
                    >
                      {item.icon}
                      <span className="font-medium text-sm">{item.label}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Connection section */}
      <div className="px-4 py-3 border-t border-[#333]">
        <p className="text-[#8c8c8c] uppercase text-[10px] tracking-wider font-semibold mb-2" style={{ fontFamily: MONO_FONT }}>
          Connection
        </p>
        <div className="space-y-1.5" style={{ fontFamily: MONO_FONT }}>
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-[#96e212] animate-pulse' : 'bg-[#e2123f]'}`} />
            <span className="text-[10px] text-[#ccc]">{connected ? 'Connected' : 'Disconnected'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[#666]">Port</span>
            <span className="text-[10px] text-[#8c8c8c]">{connected ? '/dev/ttyUSB0' : '---'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[#666]">Baud</span>
            <span className="text-[10px] text-[#8c8c8c]">115200</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[#666]">Protocol</span>
            <span className="text-[10px] text-[#8c8c8c]">MSP</span>
          </div>
        </div>
      </div>

      {/* System status section */}
      <div className="px-4 py-3 border-t border-[#333]">
        <p className="text-[#8c8c8c] uppercase text-[10px] tracking-wider font-semibold mb-2" style={{ fontFamily: MONO_FONT }}>
          System Status
        </p>
        <div className="space-y-1.5" style={{ fontFamily: MONO_FONT }}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[#666]">Cycle Time</span>
            <span className="text-[10px] text-[#8c8c8c]">{cycleTime ? `${cycleTime}µs` : '---'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[#666]">Arming</span>
            <span
              className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-sm ${
                isArmed
                  ? 'bg-[#e2123f]/20 text-[#e2123f]'
                  : 'bg-[#333] text-[#8c8c8c]'
              }`}
            >
              {isArmed ? 'ARMED' : 'DISABLED'}
            </span>
          </div>
        </div>
        <p className="text-[10px] text-[#666] mt-3" style={{ fontFamily: MONO_FONT }}>v1.0.0</p>
      </div>
    </aside>
  )
}

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

      {/* Bottom section */}
      <div className="px-6 py-4 border-t border-[#333]">
        <div className="flex items-center gap-3 text-sm text-[#8c8c8c]">
          <div className="w-2 h-2 bg-[#96e212] rounded-full animate-pulse" />
          <span>System Online</span>
        </div>
        <p className="text-xs text-[#666] mt-2">v1.0.0</p>
      </div>
    </aside>
  )
}

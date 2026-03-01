import Link from "next/link";
import {
  BarChart3,
  Cpu,
  Settings,
  Wrench,
  Activity,
  MapPin,
  Battery,
  Radio,
  ChevronRight
} from "lucide-react";
import { LiveTelemetrySection } from "@/components/landing/LiveTelemetrySection";

const features = [
  {
    href: "/diagnose",
    icon: <Wrench className="w-6 h-6 text-purple-500" />,
    title: "Diagnose",
    description: "Run diagnostics and get fix suggestions.",
  },
  {
    href: "/blackbox",
    icon: <BarChart3 className="w-6 h-6 text-blue-500" />,
    title: "Blackbox",
    description: "Analyze flight logs and motor data.",
  },
  {
    href: "/firmware",
    icon: <Cpu className="w-6 h-6 text-green-500" />,
    title: "Firmware",
    description: "Check version and download updates.",
  },
  {
    href: "/config",
    icon: <Settings className="w-6 h-6 text-orange-500" />,
    title: "Config",
    description: "Backup and restore settings.",
  },
  {
    href: "/gps",
    icon: <MapPin className="w-6 h-6 text-red-500" />,
    title: "GPS",
    description: "Real-time position and satellite tracking.",
  },
  {
    href: "/telemetry",
    icon: <Activity className="w-6 h-6 text-cyan-500" />,
    title: "Telemetry",
    description: "Live altitude, speed, and sensor data.",
  },
  {
    href: "/battery",
    icon: <Battery className="w-6 h-6 text-yellow-500" />,
    title: "Battery",
    description: "Monitor voltage and power consumption.",
  },
  {
    href: "/radio",
    icon: <Radio className="w-6 h-6 text-pink-500" />,
    title: "Radio",
    description: "Signal strength and RSSI monitoring.",
  },
];

export default function Home() {
  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-white">DroneDiagnostics</h1>
        <p className="text-[#8c8c8c] mt-1 text-sm lg:text-base">
          Blackbox log analysis and firmware management tools for Betaflight
        </p>
      </div>

      {/* Live Telemetry Preview */}
      <LiveTelemetrySection />

      {/* Quick Navigation */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[#8c8c8c]">
            Tools
          </h2>
          <div className="flex-1 h-px bg-[#333]" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
          {features.map((feature) => (
            <Link
              key={feature.href}
              href={feature.href}
              className="group bg-[#1f1f1f] rounded-[4px] border border-[#333] p-3 transition-all duration-200 hover:bg-[#242424] hover:border-[#ffbb00] touch-manipulation"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 bg-[#242424] rounded-[4px] group-hover:bg-[#333] transition-colors">
                  {feature.icon}
                </div>
                <ChevronRight className="w-4 h-4 text-[#8c8c8c] group-hover:text-[#f2f2f2] transition-colors ml-auto" />
              </div>
              <h3 className="text-sm font-semibold text-white">{feature.title}</h3>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">{feature.description}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Status Bar */}
      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 pt-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-[#96e212] rounded-full animate-pulse" />
          <span>System Online</span>
        </div>
        <div className="hidden sm:block w-px h-4 bg-[#333]" />
        <span>Version 1.0.0</span>
        <div className="hidden sm:block w-px h-4 bg-[#333]" />
        <span>Press <kbd className="px-1.5 py-0.5 bg-[#333] rounded text-xs">⌘K</kbd> for commands</span>
      </div>
    </div>
  );
}

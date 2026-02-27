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

const features = [
  {
    href: "/diagnose",
    icon: <Wrench className="w-8 h-8 text-purple-500" />,
    title: "Diagnose",
    description: "Run comprehensive diagnostics on your drone to identify issues and get fix suggestions.",
    color: "hover:border-purple-500/50",
  },
  {
    href: "/blackbox",
    icon: <BarChart3 className="w-8 h-8 text-blue-500" />,
    title: "Blackbox Logs",
    description: "Analyze flight logs, view gyro and motor data, calculate flight statistics.",
    color: "hover:border-blue-500/50",
  },
  {
    href: "/firmware",
    icon: <Cpu className="w-8 h-8 text-green-500" />,
    title: "Firmware",
    description: "Check firmware version, detect board target, download latest updates.",
    color: "hover:border-green-500/50",
  },
  {
    href: "/config",
    icon: <Settings className="w-8 h-8 text-orange-500" />,
    title: "Config",
    description: "Backup and restore settings, compare configurations, export CLI dumps.",
    color: "hover:border-orange-500/50",
  },
  {
    href: "/gps",
    icon: <MapPin className="w-8 h-8 text-red-500" />,
    title: "GPS Tracking",
    description: "Real-time drone position, satellite count, and GPS health monitoring.",
    color: "hover:border-red-500/50",
  },
  {
    href: "/telemetry",
    icon: <Activity className="w-8 h-8 text-cyan-500" />,
    title: "Telemetry",
    description: "Live telemetry data including altitude, speed, battery, and more.",
    color: "hover:border-cyan-500/50",
  },
  {
    href: "/battery",
    icon: <Battery className="w-8 h-8 text-yellow-500" />,
    title: "Battery",
    description: "Monitor battery health, voltage levels, and power consumption.",
    color: "hover:border-yellow-500/50",
  },
  {
    href: "/radio",
    icon: <Radio className="w-8 h-8 text-pink-500" />,
    title: "Radio",
    description: "Configure radio settings, check signal strength, and RSSI monitoring.",
    color: "hover:border-pink-500/50",
  },
];

export default function Home() {
  return (
    <div className="p-4 lg:p-6 space-y-6 lg:space-y-8">
      {/* Header */}
      <div className="page-header">
        <h1 className="text-2xl lg:text-3xl font-bold text-white">DroneDiagnostics</h1>
        <p className="text-gray-400 mt-2 text-sm lg:text-base">
          Blackbox log analysis and firmware management tools for Betaflight
        </p>
      </div>

      {/* Feature Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {features.map((feature) => (
          <Link
            key={feature.href}
            href={feature.href}
            className={`group bg-gray-900 rounded-xl border border-gray-800 p-5 lg:p-6 transition-all duration-200 hover:bg-gray-800/50 ${feature.color} touch-manipulation`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-gray-800 rounded-xl group-hover:bg-gray-700/50 transition-colors">
                {feature.icon}
              </div>
              <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-gray-400 transition-colors" />
            </div>
            <h2 className="text-lg font-semibold text-white mb-2">{feature.title}</h2>
            <p className="text-sm text-gray-400 leading-relaxed">{feature.description}</p>
          </Link>
        ))}
      </div>

      {/* Getting Started Card */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 lg:p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <span className="text-2xl">🚀</span>
          Getting Started
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
          <ol className="space-y-3 text-gray-400">
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-sm flex items-center justify-center font-medium">
                1
              </span>
              <span>Connect your flight controller via USB</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-sm flex items-center justify-center font-medium">
                2
              </span>
              <span>Go to <strong className="text-white">Diagnose</strong> to run health checks</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-sm flex items-center justify-center font-medium">
                3
              </span>
              <span>Check firmware updates in the <strong className="text-white">Firmware</strong> page</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-sm flex items-center justify-center font-medium">
                4
              </span>
              <span>Backup your configuration before making changes</span>
            </li>
          </ol>

          {/* Keyboard Shortcuts */}
          <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
            <h3 className="text-sm font-semibold text-white mb-3">Keyboard Shortcuts</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Command Palette</span>
                <span className="flex items-center gap-1">
                  <kbd className="px-2 py-1 bg-gray-700 rounded text-xs">⌘</kbd>
                  <kbd className="px-2 py-1 bg-gray-700 rounded text-xs">K</kbd>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Connect/Disconnect</span>
                <span className="flex items-center gap-1">
                  <kbd className="px-2 py-1 bg-gray-700 rounded text-xs">⌘</kbd>
                  <kbd className="px-2 py-1 bg-gray-700 rounded text-xs">⇧</kbd>
                  <kbd className="px-2 py-1 bg-gray-700 rounded text-xs">C</kbd>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Arm/Disarm</span>
                <span className="flex items-center gap-1">
                  <kbd className="px-2 py-1 bg-gray-700 rounded text-xs">Space</kbd>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Search</span>
                <span className="flex items-center gap-1">
                  <kbd className="px-2 py-1 bg-gray-700 rounded text-xs">/</kbd>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span>System Online</span>
        </div>
        <div className="hidden sm:block w-px h-4 bg-gray-800" />
        <span>Version 1.0.0</span>
        <div className="hidden sm:block w-px h-4 bg-gray-800" />
        <span>Press <kbd className="px-1.5 py-0.5 bg-gray-800 rounded text-xs">⌘K</kbd> for commands</span>
      </div>
    </div>
  );
}

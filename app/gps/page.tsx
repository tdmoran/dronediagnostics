"use client";

import dynamic from "next/dynamic";
import { useTelemetry } from "@/hooks/useTelemetry";
import { GPSStatusIndicator } from "@/components/GPSStatusIndicator";
import { GPSStatsPanel } from "@/components/GPSStatsPanel";
import { GPSCoordinates } from "@/components/GPSCoordinates";
import { SerialConnectionManager } from "@/components/SerialConnectionManager";
import { useEffect, useState } from "react";
import { GPSStatus } from "@/types/gps";
import { Activity, Wifi, WifiOff } from "lucide-react";
import { SkeletonGPSStats, SkeletonMap } from "@/components/ui/skeleton";

// Dynamic import for GPSMap to avoid SSR issues with Leaflet
const GPSMap = dynamic(
  () => import("@/components/GPSMap").then((mod) => mod.GPSMap),
  {
    ssr: false,
    loading: () => <SkeletonMap />,
  }
);

export default function GPSPage() {
  const { isConnected, gpsData, error } = useTelemetry();
  const [gpsStatus, setGpsStatus] = useState<GPSStatus | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch GPS status periodically
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch("/api/gps/status");
        if (response.ok) {
          const status = await response.json();
          setGpsStatus(status);
        }
      } catch (err) {
        console.error("Failed to fetch GPS status:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-4 lg:p-6 space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 lg:w-6 lg:h-6 text-blue-500" />
            GPS Tracking
          </h1>
          <p className="text-gray-400 mt-1 text-sm lg:text-base">
            Real-time drone position and telemetry
          </p>
        </div>

        <div className="flex items-center gap-2 lg:gap-4">
          {/* Connection Status */}
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm ${
              isConnected
                ? "bg-green-950/30 border-green-800 text-green-400"
                : "bg-red-950/30 border-red-800 text-red-400"
            }`}
          >
            {isConnected ? (
              <>
                <Wifi className="w-4 h-4" /> Connected
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4" /> Disconnected
              </>
            )}
          </div>

          {/* GPS Status */}
          <GPSStatusIndicator status={gpsStatus} size="md" />
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-950/30 border border-red-800 rounded-lg p-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Map */}
      <div className="space-y-2">
        <h2 className="text-base lg:text-lg font-semibold text-white">Position Map</h2>
        {loading ? <SkeletonMap /> : <GPSMap gps={gpsData} height="300px lg:400px" />}
      </div>

      {/* Stats, Coordinates, and Serial Connection - Responsive Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-6">
        {loading ? (
          <>
            <SkeletonGPSStats />
            <SkeletonGPSStats />
            <SkeletonCard />
          </>
        ) : (
          <>
            <GPSStatsPanel gps={gpsData} />
            <GPSCoordinates gps={gpsData} />
            <SerialConnectionManager />
          </>
        )}
      </div>

      {/* Debug Info - Collapsible on mobile */}
      {gpsData && (
        <details className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <summary className="px-4 py-3 text-sm font-semibold text-gray-400 cursor-pointer hover:text-white transition-colors">
            Raw GPS Data
          </summary>
          <pre className="px-4 pb-4 text-xs text-gray-500 overflow-x-auto">
            {JSON.stringify(gpsData, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}

// Simple skeleton card for serial connection
function SkeletonCard() {
  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 animate-pulse">
      <div className="h-6 bg-gray-800 rounded w-3/4 mb-4"></div>
      <div className="h-4 bg-gray-800 rounded w-full mb-2"></div>
      <div className="h-4 bg-gray-800 rounded w-2/3"></div>
    </div>
  );
}

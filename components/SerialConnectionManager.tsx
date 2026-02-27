"use client";

import { useState, useEffect } from "react";
import { Wifi, WifiOff, RefreshCw, Usb } from "lucide-react";
import { useConnectionToasts } from "@/hooks/use-toast";
import { SkeletonCard } from "@/components/ui/skeleton";

interface SerialPort {
  port: string;
  description?: string;
}

interface SerialStatus {
  connected: boolean;
  port?: string;
  baudrate?: number;
}

export function SerialConnectionManager() {
  const [ports, setPorts] = useState<string[]>([]);
  const [status, setStatus] = useState<SerialStatus>({ connected: false });
  const [selectedPort, setSelectedPort] = useState("");
  const [baudrate, setBaudrate] = useState(115200);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  
  const { 
    showConnected, 
    showDisconnected, 
    showConnectionFailed, 
    showCommandTimeout,
    showCalibrationStarted,
    showDownloadStarted
  } = useConnectionToasts();

  const baudrates = [9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600];

  const fetchPorts = async () => {
    try {
      const response = await fetch("/api/serial/ports");
      if (response.ok) {
        const data = await response.json();
        setPorts(data.ports);
      }
    } catch (err) {
      console.error("Failed to fetch ports:", err);
    }
  };

  const fetchStatus = async () => {
    try {
      const response = await fetch("/api/serial/status");
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      }
    } catch (err) {
      console.error("Failed to fetch status:", err);
    }
  };

  useEffect(() => {
    const init = async () => {
      await Promise.all([fetchPorts(), fetchStatus()]);
      setInitialLoading(false);
    };
    init();
    
    const interval = setInterval(fetchStatus, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleConnect = async () => {
    if (!selectedPort) return;

    setLoading(true);
    setError(null);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(
        `/api/serial/connect?port=${encodeURIComponent(selectedPort)}&baudrate=${baudrate}`,
        {
          method: "POST",
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      const data = await response.json();

      if (data.connected) {
        setStatus({ connected: true, port: selectedPort, baudrate });
        showConnected(selectedPort);
      } else {
        const errorMsg = data.error || "Failed to connect";
        setError(errorMsg);
        showConnectionFailed(errorMsg);
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        const timeoutMsg = "Connection timeout";
        setError(timeoutMsg);
        showCommandTimeout();
      } else {
        const errorMsg = "Connection error";
        setError(errorMsg);
        showConnectionFailed(errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);

    try {
      await fetch("/api/serial/disconnect", { method: "POST" });
      setStatus({ connected: false });
      showDisconnected();
    } catch (err) {
      console.error("Disconnect error:", err);
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return <SkeletonCard />;
  }

  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Usb className="w-5 h-5 text-purple-500" />
          Serial Connection
        </h3>
        <button
          onClick={fetchPorts}
          disabled={loading}
          className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 transition-colors min-h-[44px] min-w-[44px] touch-manipulation"
          title="Refresh ports"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Status */}
      <div
        className={`flex items-center gap-3 p-3 rounded-lg border mb-4 ${
          status.connected
            ? "bg-green-950/30 border-green-800"
            : "bg-gray-800/50 border-gray-700"
        }`}
      >
        {status.connected ? (
          <>
            <Wifi className="w-5 h-5 text-green-400" />
            <div>
              <p className="text-green-400 font-medium">Connected</p>
              <p className="text-sm text-gray-400">
                {status.port} @ {status.baudrate} baud
              </p>
            </div>
          </>
        ) : (
          <>
            <WifiOff className="w-5 h-5 text-gray-500" />
            <p className="text-gray-400">Not connected</p>
          </>
        )}
      </div>

      {error && (
        <div className="bg-red-950/30 border border-red-800 rounded-lg p-3 mb-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Connection Controls */}
      {!status.connected ? (
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Serial Port</label>
            <select
              value={selectedPort}
              onChange={(e) => setSelectedPort(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-blue-500 min-h-[44px]"
            >
              <option value="">Select port...</option>
              {ports.map((port) => (
                <option key={port} value={port}>
                  {port}
                </option>
              ))}
            </select>
            {ports.length === 0 && (
              <p className="text-sm text-gray-500 mt-1">No serial ports detected</p>
            )}
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Baud Rate</label>
            <select
              value={baudrate}
              onChange={(e) => setBaudrate(Number(e.target.value))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-blue-500 min-h-[44px]"
            >
              {baudrates.map((rate) => (
                <option key={rate} value={rate}>
                  {rate}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleConnect}
            disabled={!selectedPort || loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white py-3 rounded-lg font-medium transition-colors min-h-[48px] touch-manipulation"
          >
            {loading ? "Connecting..." : "Connect"}
          </button>
        </div>
      ) : (
        <button
          onClick={handleDisconnect}
          disabled={loading}
          className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-700 text-white py-3 rounded-lg font-medium transition-colors min-h-[48px] touch-manipulation"
        >
          {loading ? "Disconnecting..." : "Disconnect"}
        </button>
      )}
    </div>
  );
}

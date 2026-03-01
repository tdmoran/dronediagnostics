"use client";

import { useState, useCallback, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { BlackboxLog } from "../../types/blackbox";
import { SkeletonChart, SkeletonStatCard, SkeletonCard } from "@/components/ui/skeleton";
import { useConnectionToasts } from "@/hooks/use-toast";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function BlackboxPage() {
  const [logData, setLogData] = useState<BlackboxLog | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"gyro" | "motors" | "rc" | "stats">("gyro");
  const [isDragging, setIsDragging] = useState(false);

  const { showDownloadStarted, showDownloadComplete } = useConnectionToasts();

  const handleFileUpload = async (file: File) => {
    if (!file.name.endsWith(".bbl") && !file.name.endsWith(".BBL")) {
      setError("Please upload a .bbl file");
      return;
    }

    setLoading(true);
    setError(null);
    showDownloadStarted(file.name);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${API_URL}/api/blackbox/parse`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to parse log file");
      }

      const result = await response.json();
      setLogData(result.data);
      showDownloadComplete(file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse log");
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        handleFileUpload(file);
      }
    },
    []
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const formatTime = (timestamp: number) => {
    return (timestamp / 1000000).toFixed(2);
  };

  const chartData = useMemo(() => {
    if (!logData) return [];

    return logData.frames.map((frame) => ({
      time: formatTime(frame.timestamp),
      gyroX: frame.gyro.x / 1000,
      gyroY: frame.gyro.y / 1000,
      gyroZ: frame.gyro.z / 1000,
      accelX: frame.accel.x / 1000,
      accelY: frame.accel.y / 1000,
      accelZ: frame.accel.z / 1000,
      motor1: frame.motors[0],
      motor2: frame.motors[1],
      motor3: frame.motors[2],
      motor4: frame.motors[3],
      roll: frame.rcCommand.roll,
      pitch: frame.rcCommand.pitch,
      yaw: frame.rcCommand.yaw,
      throttle: frame.rcCommand.throttle,
      altitude: frame.altitude || 0,
      speed: frame.speed || 0,
      voltage: frame.voltage || 0,
    }));
  }, [logData]);

  return (
    <div className="p-4 lg:p-6 space-y-4 lg:space-y-6">
      <div className="page-header">
        <h1 className="text-xl lg:text-2xl font-bold">Blackbox Log Analysis</h1>
        <p className="text-gray-400 text-sm lg:text-base">
          Upload and analyze Betaflight blackbox logs
        </p>
      </div>

      {/* File Upload */}
      <div className="bg-[#1f1f1f] rounded-[4px] border border-[#333] p-4 lg:p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Upload Log File</h2>
        <div
          className={`border-2 border-dashed rounded-[4px] p-6 lg:p-12 text-center transition-colors ${
            isDragging
              ? "border-[#ffbb00] bg-[rgba(255,187,0,0.1)]"
              : "border-[#333] hover:border-[#8c8c8c]"
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <input
            type="file"
            accept=".bbl,.BBL"
            onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
            style={{ display: "none" }}
            id="file-input"
          />
          <label htmlFor="file-input" className="cursor-pointer block">
            <div className="text-4xl lg:text-5xl mb-4">📁</div>
            <p className="text-base lg:text-lg font-medium text-white mb-2">
              Drop your .bbl file here or click to browse
            </p>
            <p className="text-sm text-gray-500">
              Supports Betaflight blackbox log files (.bbl)
            </p>
          </label>
        </div>

        {loading && (
          <div className="mt-6">
            <SkeletonChart />
          </div>
        )}

        {error && (
          <div className="bg-red-950/30 border border-red-800 rounded-lg p-3 mt-4 text-red-400 text-sm">
            {error}
          </div>
        )}
      </div>

      {logData && (
        <>
          {/* Log Info */}
          <div className="bg-[#1f1f1f] rounded-[4px] border border-[#333] p-4 lg:p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Log Information</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-[#242424] rounded-lg p-4 border border-[#333]">
                <div className="text-2xl font-bold text-[#ffbb00]">
                  {logData.header.firmwareVersion || "Unknown"}
                </div>
                <div className="text-sm text-gray-500">Firmware</div>
              </div>
              <div className="bg-[#242424] rounded-lg p-4 border border-[#333]">
                <div className="text-2xl font-bold text-[#ffbb00]">
                  {logData.header.craftName || "Unnamed"}
                </div>
                <div className="text-sm text-gray-500">Craft Name</div>
              </div>
              <div className="bg-[#242424] rounded-lg p-4 border border-[#333]">
                <div className="text-2xl font-bold text-[#ffbb00]">
                  {logData.frames.length.toLocaleString()}
                </div>
                <div className="text-sm text-gray-500">Frames</div>
              </div>
              <div className="bg-[#242424] rounded-lg p-4 border border-[#333]">
                <div className="text-2xl font-bold text-[#ffbb00]">
                  {logData.header.fields.length}
                </div>
                <div className="text-sm text-gray-500">Fields</div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-[#1f1f1f] rounded-[4px] border border-[#333] p-4 lg:p-6">
            {/* Scrollable tabs on mobile */}
            <div className="flex gap-2 overflow-x-auto pb-2 lg:pb-0 mb-4 scrollbar-hide">
              {[
                { id: "gyro", label: "Gyro & Accel" },
                { id: "motors", label: "Motors" },
                { id: "rc", label: "RC Commands" },
                { id: "stats", label: "Statistics" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors min-h-[44px] ${
                    activeTab === tab.id
                      ? "bg-[#ffbb00] text-[#141414]"
                      : "bg-[#242424] text-[#8c8c8c] hover:bg-[#333]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Gyro & Accel Tab */}
            {activeTab === "gyro" && (
              <div className="space-y-4 lg:space-y-6">
                <div>
                  <h3 className="text-base lg:text-lg font-medium text-white mb-3">
                    Gyroscope Data (deg/s)
                  </h3>
                  <div className="h-[250px] lg:h-[300px] bg-[#141414] rounded-lg border border-[#333] p-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333333" />
                        <XAxis dataKey="time" stroke="#8c8c8c" fontSize={12} />
                        <YAxis stroke="#8c8c8c" fontSize={12} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#1f1f1f",
                            border: "1px solid #333333",
                            borderRadius: "4px",
                          }}
                          labelStyle={{ color: "#f2f2f2" }}
                        />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="gyroX"
                          stroke="#ef4444"
                          dot={false}
                          strokeWidth={1.5}
                          name="Roll"
                        />
                        <Line
                          type="monotone"
                          dataKey="gyroY"
                          stroke="#22c55e"
                          dot={false}
                          strokeWidth={1.5}
                          name="Pitch"
                        />
                        <Line
                          type="monotone"
                          dataKey="gyroZ"
                          stroke="#3b82f6"
                          dot={false}
                          strokeWidth={1.5}
                          name="Yaw"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div>
                  <h3 className="text-base lg:text-lg font-medium text-white mb-3">
                    Accelerometer Data (g)
                  </h3>
                  <div className="h-[250px] lg:h-[300px] bg-[#141414] rounded-lg border border-[#333] p-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333333" />
                        <XAxis dataKey="time" stroke="#8c8c8c" fontSize={12} />
                        <YAxis stroke="#8c8c8c" fontSize={12} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#1f1f1f",
                            border: "1px solid #333333",
                            borderRadius: "4px",
                          }}
                          labelStyle={{ color: "#f2f2f2" }}
                        />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="accelX"
                          stroke="#ef4444"
                          dot={false}
                          strokeWidth={1.5}
                          name="X"
                        />
                        <Line
                          type="monotone"
                          dataKey="accelY"
                          stroke="#22c55e"
                          dot={false}
                          strokeWidth={1.5}
                          name="Y"
                        />
                        <Line
                          type="monotone"
                          dataKey="accelZ"
                          stroke="#3b82f6"
                          dot={false}
                          strokeWidth={1.5}
                          name="Z"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {/* Motors Tab */}
            {activeTab === "motors" && (
              <div>
                <h3 className="text-base lg:text-lg font-medium text-white mb-3">
                  Motor Outputs
                </h3>
                <div className="h-[250px] lg:h-[300px] bg-[#141414] rounded-lg border border-[#333] p-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333333" />
                      <XAxis dataKey="time" stroke="#8c8c8c" fontSize={12} />
                      <YAxis stroke="#8c8c8c" fontSize={12} domain={[1000, 2000]} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#1f1f1f",
                          border: "1px solid #333333",
                          borderRadius: "4px",
                        }}
                        labelStyle={{ color: "#f2f2f2" }}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="motor1"
                        stroke="#ef4444"
                        dot={false}
                        strokeWidth={1.5}
                        name="Motor 1"
                      />
                      <Line
                        type="monotone"
                        dataKey="motor2"
                        stroke="#22c55e"
                        dot={false}
                        strokeWidth={1.5}
                        name="Motor 2"
                      />
                      <Line
                        type="monotone"
                        dataKey="motor3"
                        stroke="#3b82f6"
                        dot={false}
                        strokeWidth={1.5}
                        name="Motor 3"
                      />
                      <Line
                        type="monotone"
                        dataKey="motor4"
                        stroke="#f59e0b"
                        dot={false}
                        strokeWidth={1.5}
                        name="Motor 4"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* RC Commands Tab */}
            {activeTab === "rc" && (
              <div>
                <h3 className="text-base lg:text-lg font-medium text-white mb-3">
                  RC Commands
                </h3>
                <div className="h-[250px] lg:h-[300px] bg-[#141414] rounded-lg border border-[#333] p-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333333" />
                      <XAxis dataKey="time" stroke="#8c8c8c" fontSize={12} />
                      <YAxis stroke="#8c8c8c" fontSize={12} domain={[1000, 2000]} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#1f1f1f",
                          border: "1px solid #333333",
                          borderRadius: "4px",
                        }}
                        labelStyle={{ color: "#f2f2f2" }}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="roll"
                        stroke="#ef4444"
                        dot={false}
                        strokeWidth={1.5}
                        name="Roll"
                      />
                      <Line
                        type="monotone"
                        dataKey="pitch"
                        stroke="#22c55e"
                        dot={false}
                        strokeWidth={1.5}
                        name="Pitch"
                      />
                      <Line
                        type="monotone"
                        dataKey="yaw"
                        stroke="#3b82f6"
                        dot={false}
                        strokeWidth={1.5}
                        name="Yaw"
                      />
                      <Line
                        type="monotone"
                        dataKey="throttle"
                        stroke="#f59e0b"
                        dot={false}
                        strokeWidth={1.5}
                        name="Throttle"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Statistics Tab */}
            {activeTab === "stats" && (
              <div>
                <h3 className="text-base lg:text-lg font-medium text-white mb-4">
                  Flight Statistics
                </h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-[#242424] rounded-lg p-4 border border-[#333]">
                    <div className="text-2xl font-bold text-[#ffbb00]">
                      {logData.statistics.duration.toFixed(1)}s
                    </div>
                    <div className="text-sm text-gray-500">Duration</div>
                  </div>
                  <div className="bg-[#242424] rounded-lg p-4 border border-[#333]">
                    <div className="text-2xl font-bold text-[#ffbb00]">
                      {(logData.statistics.maxSpeed * 3.6).toFixed(1)} km/h
                    </div>
                    <div className="text-sm text-gray-500">Max Speed</div>
                  </div>
                  <div className="bg-[#242424] rounded-lg p-4 border border-[#333]">
                    <div className="text-2xl font-bold text-[#ffbb00]">
                      {logData.statistics.maxAltitude.toFixed(1)}m
                    </div>
                    <div className="text-sm text-gray-500">Max Altitude</div>
                  </div>
                  <div className="bg-[#242424] rounded-lg p-4 border border-[#333]">
                    <div className="text-2xl font-bold text-[#ffbb00]">
                      {(logData.statistics.maxGyroRate / 1000).toFixed(1)}°/s
                    </div>
                    <div className="text-sm text-gray-500">Max Gyro Rate</div>
                  </div>
                  <div className="bg-[#242424] rounded-lg p-4 border border-[#333]">
                    <div className="text-2xl font-bold text-[#ffbb00]">
                      {(logData.statistics.maxAccel / 1000).toFixed(2)}g
                    </div>
                    <div className="text-sm text-gray-500">Max Acceleration</div>
                  </div>
                  <div className="bg-[#242424] rounded-lg p-4 border border-[#333]">
                    <div className="text-2xl font-bold text-[#ffbb00]">
                      {logData.statistics.avgVoltage.toFixed(2)}V
                    </div>
                    <div className="text-sm text-gray-500">Avg Voltage</div>
                  </div>
                  <div className="bg-[#242424] rounded-lg p-4 border border-[#333]">
                    <div className="text-2xl font-bold text-[#ffbb00]">
                      {logData.statistics.avgCurrent.toFixed(1)}A
                    </div>
                    <div className="text-sm text-gray-500">Avg Current</div>
                  </div>
                  <div className="bg-[#242424] rounded-lg p-4 border border-[#333]">
                    <div className="text-2xl font-bold text-[#ffbb00]">
                      {logData.statistics.maxCurrent.toFixed(1)}A
                    </div>
                    <div className="text-sm text-gray-500">Max Current</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

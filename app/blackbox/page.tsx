'use client';

import { useState, useCallback, useMemo } from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { BlackboxLog, BlackboxFrame, FlightStatistics } from '../../types/blackbox';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function BlackboxPage() {
  const [logData, setLogData] = useState<BlackboxLog | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'gyro' | 'motors' | 'rc' | 'stats'>('gyro');
  const [isDragging, setIsDragging] = useState(false);

  const handleFileUpload = async (file: File) => {
    if (!file.name.endsWith('.bbl') && !file.name.endsWith('.BBL')) {
      setError('Please upload a .bbl file');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_URL}/api/blackbox/parse`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to parse log file');
      }

      const result = await response.json();
      setLogData(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse log');
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileUpload(file);
    }
  }, []);

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
    
    return logData.frames.map((frame, index) => ({
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
    <div>
      <div className="page-header">
        <h1>Blackbox Log Analysis</h1>
        <p>Upload and analyze Betaflight blackbox logs</p>
      </div>

      {/* File Upload */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Upload Log File</h2>
        </div>
        <div
          className={`file-upload ${isDragging ? 'dragover' : ''}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <input
            type="file"
            accept=".bbl,.BBL"
            onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
            style={{ display: 'none' }}
            id="file-input"
          />
          <label htmlFor="file-input" style={{ cursor: 'pointer' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📁</div>
            <p style={{ fontSize: '1.125rem', marginBottom: '0.5rem' }}>
              Drop your .bbl file here or click to browse
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              Supports Betaflight blackbox log files (.bbl)
            </p>
          </label>
        </div>

        {loading && (
          <div className="loading">
            <div className="spinner" style={{ marginRight: '1rem' }} />
            <span>Parsing log file...</span>
          </div>
        )}

        {error && (
          <div className="alert alert-danger" style={{ marginTop: '1rem' }}>
            {error}
          </div>
        )}
      </div>

      {logData && (
        <>
          {/* Log Info */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Log Information</h2>
            </div>
            <div className="grid grid-4">
              <div className="stat-card">
                <div className="stat-value">{logData.header.firmwareVersion || 'Unknown'}</div>
                <div className="stat-label">Firmware</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{logData.header.craftName || 'Unnamed'}</div>
                <div className="stat-label">Craft Name</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{logData.frames.length.toLocaleString()}</div>
                <div className="stat-label">Frames</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{logData.header.fields.length}</div>
                <div className="stat-label">Fields</div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="card">
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
              <button
                className={`btn ${activeTab === 'gyro' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setActiveTab('gyro')}
              >
                Gyro & Accel
              </button>
              <button
                className={`btn ${activeTab === 'motors' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setActiveTab('motors')}
              >
                Motors
              </button>
              <button
                className={`btn ${activeTab === 'rc' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setActiveTab('rc')}
              >
                RC Commands
              </button>
              <button
                className={`btn ${activeTab === 'stats' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setActiveTab('stats')}
              >
                Statistics
              </button>
            </div>

            {/* Gyro & Accel Tab */}
            {activeTab === 'gyro' && (
              <div>
                <h3 style={{ marginBottom: '1rem' }}>Gyroscope Data (deg/s)</h3>
                <div className="chart-container">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                      <XAxis dataKey="time" stroke="#94a3b8" />
                      <YAxis stroke="#94a3b8" />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }}
                        labelStyle={{ color: '#f8fafc' }}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="gyroX" stroke="#ef4444" dot={false} strokeWidth={1.5} name="Roll" />
                      <Line type="monotone" dataKey="gyroY" stroke="#22c55e" dot={false} strokeWidth={1.5} name="Pitch" />
                      <Line type="monotone" dataKey="gyroZ" stroke="#3b82f6" dot={false} strokeWidth={1.5} name="Yaw" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <h3 style={{ margin: '2rem 0 1rem' }}>Accelerometer Data (g)</h3>
                <div className="chart-container">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                      <XAxis dataKey="time" stroke="#94a3b8" />
                      <YAxis stroke="#94a3b8" />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }}
                        labelStyle={{ color: '#f8fafc' }}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="accelX" stroke="#ef4444" dot={false} strokeWidth={1.5} name="X" />
                      <Line type="monotone" dataKey="accelY" stroke="#22c55e" dot={false} strokeWidth={1.5} name="Y" />
                      <Line type="monotone" dataKey="accelZ" stroke="#3b82f6" dot={false} strokeWidth={1.5} name="Z" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Motors Tab */}
            {activeTab === 'motors' && (
              <div>
                <h3 style={{ marginBottom: '1rem' }}>Motor Outputs</h3>
                <div className="chart-container">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                      <XAxis dataKey="time" stroke="#94a3b8" />
                      <YAxis stroke="#94a3b8" domain={[1000, 2000]} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }}
                        labelStyle={{ color: '#f8fafc' }}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="motor1" stroke="#ef4444" dot={false} strokeWidth={1.5} name="Motor 1" />
                      <Line type="monotone" dataKey="motor2" stroke="#22c55e" dot={false} strokeWidth={1.5} name="Motor 2" />
                      <Line type="monotone" dataKey="motor3" stroke="#3b82f6" dot={false} strokeWidth={1.5} name="Motor 3" />
                      <Line type="monotone" dataKey="motor4" stroke="#f59e0b" dot={false} strokeWidth={1.5} name="Motor 4" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* RC Commands Tab */}
            {activeTab === 'rc' && (
              <div>
                <h3 style={{ marginBottom: '1rem' }}>RC Commands</h3>
                <div className="chart-container">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                      <XAxis dataKey="time" stroke="#94a3b8" />
                      <YAxis stroke="#94a3b8" domain={[1000, 2000]} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }}
                        labelStyle={{ color: '#f8fafc' }}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="roll" stroke="#ef4444" dot={false} strokeWidth={1.5} name="Roll" />
                      <Line type="monotone" dataKey="pitch" stroke="#22c55e" dot={false} strokeWidth={1.5} name="Pitch" />
                      <Line type="monotone" dataKey="yaw" stroke="#3b82f6" dot={false} strokeWidth={1.5} name="Yaw" />
                      <Line type="monotone" dataKey="throttle" stroke="#f59e0b" dot={false} strokeWidth={1.5} name="Throttle" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Statistics Tab */}
            {activeTab === 'stats' && (
              <div>
                <h3 style={{ marginBottom: '1rem' }}>Flight Statistics</h3>
                <div className="grid grid-4">
                  <div className="stat-card">
                    <div className="stat-value">{logData.statistics.duration.toFixed(1)}s</div>
                    <div className="stat-label">Duration</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">{(logData.statistics.maxSpeed * 3.6).toFixed(1)} km/h</div>
                    <div className="stat-label">Max Speed</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">{logData.statistics.maxAltitude.toFixed(1)}m</div>
                    <div className="stat-label">Max Altitude</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">{(logData.statistics.maxGyroRate / 1000).toFixed(1)}°/s</div>
                    <div className="stat-label">Max Gyro Rate</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">{(logData.statistics.maxAccel / 1000).toFixed(2)}g</div>
                    <div className="stat-label">Max Acceleration</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">{logData.statistics.avgVoltage.toFixed(2)}V</div>
                    <div className="stat-label">Avg Voltage</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">{logData.statistics.avgCurrent.toFixed(1)}A</div>
                    <div className="stat-label">Avg Current</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">{logData.statistics.maxCurrent.toFixed(1)}A</div>
                    <div className="stat-label">Max Current</div>
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

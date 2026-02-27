'use client';

import { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw, Usb } from 'lucide-react';

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
  const [selectedPort, setSelectedPort] = useState('');
  const [baudrate, setBaudrate] = useState(115200);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const baudrates = [9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600];

  const fetchPorts = async () => {
    try {
      const response = await fetch('/api/serial/ports');
      if (response.ok) {
        const data = await response.json();
        setPorts(data.ports);
      }
    } catch (err) {
      console.error('Failed to fetch ports:', err);
    }
  };

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/serial/status');
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      }
    } catch (err) {
      console.error('Failed to fetch status:', err);
    }
  };

  useEffect(() => {
    fetchPorts();
    fetchStatus();
    
    const interval = setInterval(fetchStatus, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleConnect = async () => {
    if (!selectedPort) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/serial/connect?port=${encodeURIComponent(selectedPort)}&baudrate=${baudrate}`, {
        method: 'POST'
      });
      
      const data = await response.json();
      
      if (data.connected) {
        setStatus({ connected: true, port: selectedPort, baudrate });
      } else {
        setError(data.error || 'Failed to connect');
      }
    } catch (err) {
      setError('Connection error');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    
    try {
      await fetch('/api/serial/disconnect', { method: 'POST' });
      setStatus({ connected: false });
    } catch (err) {
      console.error('Disconnect error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-bf-surface rounded p-6 border border-bf-border">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-bf-text flex items-center gap-2">
          <Usb className="w-5 h-5 text-bf-accent" />
          Serial Connection
        </h3>
        <button
          onClick={fetchPorts}
          className="p-2 rounded bg-bf-surface-light hover:bg-bf-border text-bf-text-muted transition-colors border border-bf-border"
          title="Refresh ports"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Status */}
      <div className={`flex items-center gap-3 p-3 rounded border mb-4 ${
        status.connected 
          ? 'bg-bf-success/10 border-bf-success/30' 
          : 'bg-bf-surface-light/50 border-bf-border'
      }`}>
        {status.connected ? (
          <><Wifi className="w-5 h-5 text-bf-success" />
          <div>
            <p className="text-bf-success font-medium">Connected</p>
            <p className="text-sm text-bf-text-muted font-mono">{status.port} @ {status.baudrate} baud</p>
          </div></>
        ) : (
          <><WifiOff className="w-5 h-5 text-bf-text-muted" />
          <p className="text-bf-text-muted">Not connected</p></>
        )}
      </div>

      {error && (
        <div className="bg-bf-danger/10 border border-bf-danger/30 rounded p-3 mb-4 text-bf-danger text-sm">
          {error}
        </div>
      )}

      {/* Connection Controls */}
      {!status.connected ? (
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-bf-text-muted mb-1">Serial Port</label>
            <select
              value={selectedPort}
              onChange={(e) => setSelectedPort(e.target.value)}
              className="w-full bg-bf-bg border border-bf-border rounded px-3 py-2 text-bf-text focus:outline-none focus:border-bf-accent"
            >
              <option value="">Select port...</option>
              {ports.map((port) => (
                <option key={port} value={port}>{port}</option>
              ))}
            </select>
            {ports.length === 0 && (
              <p className="text-sm text-bf-text-muted mt-1">No serial ports detected</p>
            )}
          </div>

          <div>
            <label className="block text-sm text-bf-text-muted mb-1">Baud Rate</label>
            <select
              value={baudrate}
              onChange={(e) => setBaudrate(Number(e.target.value))}
              className="w-full bg-bf-bg border border-bf-border rounded px-3 py-2 text-bf-text focus:outline-none focus:border-bf-accent font-mono"
            >
              {baudrates.map((rate) => (
                <option key={rate} value={rate}>{rate}</option>
              ))}
            </select>
          </div>

          <button
            onClick={handleConnect}
            disabled={!selectedPort || loading}
            className="w-full bg-bf-accent hover:bg-bf-accent-dark disabled:bg-bf-surface-light disabled:text-bf-text-muted text-bf-bg py-2 rounded font-medium transition-colors"
          >
            {loading ? 'Connecting...' : 'Connect'}
          </button>
        </div>
      ) : (
        <button
          onClick={handleDisconnect}
          disabled={loading}
          className="w-full bg-bf-danger hover:bg-bf-danger/80 disabled:bg-bf-surface-light text-white py-2 rounded font-medium transition-colors"
        >
          {loading ? 'Disconnecting...' : 'Disconnect'}
        </button>
      )}
    </div>
  );
}

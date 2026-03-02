'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Settings,
  Wifi,
  Monitor,
  Bell,
  Database,
  Info,
  Save,
  RotateCcw,
  Download,
  Upload,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
  ServerCrash,
  Server,
} from 'lucide-react';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface AppSettings {
  // Connection
  backendUrl: string;
  websocketUrl: string;
  autoReconnect: boolean;
  reconnectInterval: number;

  // Display
  telemetryUpdateRate: '1' | '5' | '10' | '20';
  chartHistoryLength: '30' | '60' | '120';
  showGridLines: boolean;
  temperatureUnit: 'celsius' | 'fahrenheit';
  speedUnit: 'm/s' | 'km/h' | 'mph' | 'knots';
  coordinateFormat: 'decimal' | 'dms';

  // Alerts
  enableAudioAlerts: boolean;
  lowBatteryThreshold: number;
  lowRssiThreshold: number;
  showConnectionNotifications: boolean;

  // Data & Storage
  autoSaveTelemetry: boolean;
  maxLogFileSize: '10MB' | '50MB' | '100MB' | 'unlimited';
}

const DEFAULT_SETTINGS: AppSettings = {
  backendUrl: 'http://localhost:8000',
  websocketUrl: 'ws://localhost:8000/ws/telemetry',
  autoReconnect: true,
  reconnectInterval: 3000,

  telemetryUpdateRate: '10',
  chartHistoryLength: '60',
  showGridLines: true,
  temperatureUnit: 'celsius',
  speedUnit: 'm/s',
  coordinateFormat: 'decimal',

  enableAudioAlerts: false,
  lowBatteryThreshold: 3.5,
  lowRssiThreshold: 30,
  showConnectionNotifications: true,

  autoSaveTelemetry: false,
  maxLogFileSize: '50MB',
};

const STORAGE_KEY = 'dronediag_settings';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function loadFromStorage(): AppSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────

interface SectionCardProps {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}

function SectionCard({ icon, title, children }: SectionCardProps) {
  return (
    <div className="bg-[#1f1f1f] border border-[#333] rounded-lg p-5">
      <h2 className="text-[#ffbb00] font-semibold text-base flex items-center gap-2 mb-4 pb-3 border-b border-[#333]">
        {icon}
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

interface SettingRowProps {
  label: string;
  description?: string;
  children: React.ReactNode;
}

function SettingRow({ label, description, children }: SettingRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 min-h-[40px]">
      <div className="flex-1 min-w-0">
        <p className="text-[#f2f2f2] text-sm font-medium">{label}</p>
        {description && (
          <p className="text-[#8c8c8c] text-xs mt-0.5">{description}</p>
        )}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

interface ToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}

function Toggle({ checked, onChange, disabled = false }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ffbb00] ${
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
      } ${checked ? 'bg-[#ffbb00]' : 'bg-[#3a3a3a]'}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

interface TextInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: 'text' | 'number' | 'url';
  min?: number;
  max?: number;
  step?: number;
  className?: string;
}

function TextInput({ value, onChange, placeholder, type = 'text', min, max, step, className = '' }: TextInputProps) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      min={min}
      max={max}
      step={step}
      className={`bg-[#141414] border border-[#444] text-[#f2f2f2] text-sm rounded px-3 py-1.5 focus:outline-none focus:border-[#ffbb00] transition-colors placeholder-[#555] ${className}`}
    />
  );
}

interface SelectInputProps<T extends string> {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  className?: string;
}

function SelectInput<T extends string>({ value, onChange, options, className = '' }: SelectInputProps<T>) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className={`bg-[#141414] border border-[#444] text-[#f2f2f2] text-sm rounded px-3 py-1.5 focus:outline-none focus:border-[#ffbb00] transition-colors cursor-pointer ${className}`}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

// ─────────────────────────────────────────────
// Backend Health Check
// ─────────────────────────────────────────────

type HealthStatus = 'idle' | 'checking' | 'ok' | 'error';

function BackendHealthCheck({ backendUrl }: { backendUrl: string }) {
  const [status, setStatus] = useState<HealthStatus>('idle');
  const [detail, setDetail] = useState<string>('');

  const check = useCallback(async () => {
    setStatus('checking');
    setDetail('');
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${backendUrl}/api/health`, {
        signal: controller.signal,
        cache: 'no-store',
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const text = await res.text();
        setStatus('ok');
        setDetail(text.slice(0, 80) || 'Healthy');
      } else {
        setStatus('error');
        setDetail(`HTTP ${res.status} ${res.statusText}`);
      }
    } catch (err: unknown) {
      setStatus('error');
      if (err instanceof Error && err.name === 'AbortError') {
        setDetail('Request timed out after 5s');
      } else {
        setDetail('Could not reach backend');
      }
    }
  }, [backendUrl]);

  useEffect(() => {
    check();
  }, [check]);

  const statusConfig = {
    idle: {
      icon: <Server className="w-4 h-4 text-[#8c8c8c]" />,
      text: 'Not checked',
      color: 'text-[#8c8c8c]',
    },
    checking: {
      icon: <RefreshCw className="w-4 h-4 text-[#ffbb00] animate-spin" />,
      text: 'Checking…',
      color: 'text-[#ffbb00]',
    },
    ok: {
      icon: <CheckCircle2 className="w-4 h-4 text-green-400" />,
      text: 'Online',
      color: 'text-green-400',
    },
    error: {
      icon: <ServerCrash className="w-4 h-4 text-red-400" />,
      text: 'Unreachable',
      color: 'text-red-400',
    },
  };

  const cfg = statusConfig[status];

  return (
    <div className="flex items-center gap-3">
      <div className={`flex items-center gap-1.5 text-sm font-medium ${cfg.color}`}>
        {cfg.icon}
        <span>{cfg.text}</span>
      </div>
      {detail && status !== 'checking' && (
        <span className="text-xs text-[#8c8c8c] font-mono truncate max-w-[200px]" title={detail}>
          {detail}
        </span>
      )}
      <button
        type="button"
        onClick={check}
        disabled={status === 'checking'}
        className="text-xs text-[#8c8c8c] hover:text-[#f2f2f2] transition-colors underline underline-offset-2 disabled:opacity-40"
      >
        Re-check
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// Toast / Save Indicator
// ─────────────────────────────────────────────

function SavedBadge({ visible }: { visible: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-sm font-medium text-green-400 transition-opacity duration-500 ${
        visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      <CheckCircle2 className="w-4 h-4" />
      Settings saved
    </span>
  );
}

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [savedVisible, setSavedVisible] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  // Load from localStorage on mount
  useEffect(() => {
    setSettings(loadFromStorage());
  }, []);

  // Generic updater
  function update<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  // Save to localStorage
  function handleSave() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Storage might be full or unavailable - silently proceed
    }

    setSavedVisible(true);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => setSavedVisible(false), 3000);
  }

  // Reset to defaults
  function handleClearSettings() {
    if (!window.confirm('Reset all settings to defaults? This cannot be undone.')) return;
    localStorage.removeItem(STORAGE_KEY);
    setSettings(DEFAULT_SETTINGS);
  }

  // Export as JSON
  function handleExport() {
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dronediag-settings-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Import from JSON
  function handleImportClick() {
    importInputRef.current?.click();
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
        // Reset the file input so the same file can be re-imported
        if (importInputRef.current) importInputRef.current.value = '';
      } catch {
        alert('Failed to parse settings file. Make sure it is a valid JSON file exported from DroneDiagnostics.');
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      {/* ── Page Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#f2f2f2] flex items-center gap-2">
            <Settings className="w-6 h-6 text-[#ffbb00]" />
            Settings
          </h1>
          <p className="text-[#8c8c8c] text-sm mt-1">
            Configure connection, display, and alert preferences.
          </p>
        </div>
      </div>

      {/* ── 1. Connection Settings ── */}
      <SectionCard icon={<Wifi className="w-4 h-4" />} title="Connection Settings">
        <SettingRow label="Backend URL" description="REST API base URL">
          <TextInput
            value={settings.backendUrl}
            onChange={(v) => update('backendUrl', v)}
            placeholder="http://localhost:8000"
            className="w-64"
          />
        </SettingRow>

        <SettingRow label="WebSocket URL" description="Real-time telemetry stream">
          <TextInput
            value={settings.websocketUrl}
            onChange={(v) => update('websocketUrl', v)}
            placeholder="ws://localhost:8000/ws/telemetry"
            className="w-64"
          />
        </SettingRow>

        <SettingRow label="Auto-reconnect" description="Automatically reconnect on disconnect">
          <Toggle
            checked={settings.autoReconnect}
            onChange={(v) => update('autoReconnect', v)}
          />
        </SettingRow>

        <SettingRow
          label="Reconnect interval"
          description="Milliseconds between reconnection attempts"
        >
          <div className="flex items-center gap-2">
            <TextInput
              type="number"
              value={String(settings.reconnectInterval)}
              onChange={(v) => update('reconnectInterval', Math.max(100, parseInt(v) || 3000))}
              min={100}
              max={30000}
              step={500}
              className="w-28"
            />
            <span className="text-[#8c8c8c] text-xs">ms</span>
          </div>
        </SettingRow>
      </SectionCard>

      {/* ── 2. Display Settings ── */}
      <SectionCard icon={<Monitor className="w-4 h-4" />} title="Display Settings">
        <SettingRow label="Telemetry update rate" description="How often the UI refreshes live data">
          <SelectInput
            value={settings.telemetryUpdateRate}
            onChange={(v) => update('telemetryUpdateRate', v)}
            options={[
              { value: '1', label: '1 Hz' },
              { value: '5', label: '5 Hz' },
              { value: '10', label: '10 Hz' },
              { value: '20', label: '20 Hz' },
            ]}
          />
        </SettingRow>

        <SettingRow label="Chart history length" description="Duration of data visible in rolling charts">
          <SelectInput
            value={settings.chartHistoryLength}
            onChange={(v) => update('chartHistoryLength', v)}
            options={[
              { value: '30', label: '30 seconds' },
              { value: '60', label: '60 seconds' },
              { value: '120', label: '120 seconds' },
            ]}
          />
        </SettingRow>

        <SettingRow label="Show grid lines on charts">
          <Toggle
            checked={settings.showGridLines}
            onChange={(v) => update('showGridLines', v)}
          />
        </SettingRow>

        <SettingRow label="Temperature unit">
          <SelectInput
            value={settings.temperatureUnit}
            onChange={(v) => update('temperatureUnit', v)}
            options={[
              { value: 'celsius', label: 'Celsius (°C)' },
              { value: 'fahrenheit', label: 'Fahrenheit (°F)' },
            ]}
          />
        </SettingRow>

        <SettingRow label="Speed unit">
          <SelectInput
            value={settings.speedUnit}
            onChange={(v) => update('speedUnit', v)}
            options={[
              { value: 'm/s', label: 'm/s' },
              { value: 'km/h', label: 'km/h' },
              { value: 'mph', label: 'mph' },
              { value: 'knots', label: 'knots' },
            ]}
          />
        </SettingRow>

        <SettingRow label="Coordinate format" description="GPS coordinate display format">
          <SelectInput
            value={settings.coordinateFormat}
            onChange={(v) => update('coordinateFormat', v)}
            options={[
              { value: 'decimal', label: 'Decimal (51.5074)' },
              { value: 'dms', label: 'DMS (51° 30\' 26.6" N)' },
            ]}
          />
        </SettingRow>
      </SectionCard>

      {/* ── 3. Alerts & Notifications ── */}
      <SectionCard icon={<Bell className="w-4 h-4" />} title="Alerts & Notifications">
        <SettingRow
          label="Enable audio alerts"
          description="Play a sound when a warning threshold is crossed"
        >
          <Toggle
            checked={settings.enableAudioAlerts}
            onChange={(v) => update('enableAudioAlerts', v)}
          />
        </SettingRow>

        <SettingRow
          label="Low battery warning threshold"
          description="Warn when cell voltage drops below this value"
        >
          <div className="flex items-center gap-2">
            <TextInput
              type="number"
              value={String(settings.lowBatteryThreshold)}
              onChange={(v) => update('lowBatteryThreshold', parseFloat(v) || 3.5)}
              min={2.5}
              max={4.2}
              step={0.1}
              className="w-24"
            />
            <span className="text-[#8c8c8c] text-xs">V / cell</span>
          </div>
        </SettingRow>

        <SettingRow
          label="Low RSSI warning threshold"
          description="Warn when signal strength drops below this percentage"
        >
          <div className="flex items-center gap-2">
            <TextInput
              type="number"
              value={String(settings.lowRssiThreshold)}
              onChange={(v) => update('lowRssiThreshold', Math.min(100, Math.max(0, parseInt(v) || 30)))}
              min={0}
              max={100}
              step={1}
              className="w-24"
            />
            <span className="text-[#8c8c8c] text-xs">%</span>
          </div>
        </SettingRow>

        <SettingRow
          label="Connection status notifications"
          description="Show a toast when the backend connects or disconnects"
        >
          <Toggle
            checked={settings.showConnectionNotifications}
            onChange={(v) => update('showConnectionNotifications', v)}
          />
        </SettingRow>
      </SectionCard>

      {/* ── 4. Data & Storage ── */}
      <SectionCard icon={<Database className="w-4 h-4" />} title="Data & Storage">
        <SettingRow
          label="Auto-save telemetry to file"
          description="Continuously write incoming telemetry to a log file"
        >
          <Toggle
            checked={settings.autoSaveTelemetry}
            onChange={(v) => update('autoSaveTelemetry', v)}
          />
        </SettingRow>

        <SettingRow label="Max log file size" description="Rotate or stop logging when this limit is reached">
          <SelectInput
            value={settings.maxLogFileSize}
            onChange={(v) => update('maxLogFileSize', v)}
            options={[
              { value: '10MB', label: '10 MB' },
              { value: '50MB', label: '50 MB' },
              { value: '100MB', label: '100 MB' },
              { value: 'unlimited', label: 'Unlimited' },
            ]}
          />
        </SettingRow>

        {/* Action buttons */}
        <div className="pt-2 border-t border-[#2a2a2a] grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={handleClearSettings}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded bg-[#2a2a2a] border border-[#444] text-[#f2f2f2] text-sm hover:bg-red-900/30 hover:border-red-700 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Clear stored settings
          </button>

          <button
            type="button"
            onClick={handleExport}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded bg-[#2a2a2a] border border-[#444] text-[#f2f2f2] text-sm hover:bg-[#333] hover:border-[#555] transition-colors"
          >
            <Download className="w-4 h-4" />
            Export settings
          </button>

          <button
            type="button"
            onClick={handleImportClick}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded bg-[#2a2a2a] border border-[#444] text-[#f2f2f2] text-sm hover:bg-[#333] hover:border-[#555] transition-colors"
          >
            <Upload className="w-4 h-4" />
            Import settings
          </button>

          {/* Hidden file input for import */}
          <input
            ref={importInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={handleImportFile}
          />
        </div>
      </SectionCard>

      {/* ── 5. About ── */}
      <SectionCard icon={<Info className="w-4 h-4" />} title="About">
        <SettingRow label="App version">
          <span className="text-[#ffbb00] font-mono text-sm font-semibold">v1.0.0</span>
        </SettingRow>

        <div className="space-y-2">
          <p className="text-[#f2f2f2] text-sm font-medium">Backend status</p>
          <BackendHealthCheck backendUrl={settings.backendUrl} />
        </div>

        <div className="pt-2 border-t border-[#2a2a2a] space-y-2">
          <p className="text-[#8c8c8c] text-xs font-medium uppercase tracking-wider">Links</p>
          <div className="flex flex-col gap-2">
            <a
              href="https://github.com/betaflight/betaflight/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-[#8c8c8c] hover:text-[#ffbb00] transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
              GitHub Issues
            </a>
            <a
              href="https://betaflight.com/docs/wiki"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-[#8c8c8c] hover:text-[#ffbb00] transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
              Betaflight Wiki
            </a>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="flex items-start gap-2 p-3 rounded bg-[#141414] border border-[#2a2a2a] mt-2">
          <AlertTriangle className="w-4 h-4 text-[#ffbb00] flex-shrink-0 mt-0.5" />
          <p className="text-[#8c8c8c] text-xs leading-relaxed">
            DroneDiagnostics is a third-party tool and is not affiliated with the Betaflight project.
            Always double-check flight-critical settings on your flight controller directly.
          </p>
        </div>
      </SectionCard>

      {/* ── Sticky Save Bar ── */}
      <div className="sticky bottom-0 -mx-6 px-6 py-4 bg-[#141414]/90 backdrop-blur border-t border-[#333] flex items-center justify-between gap-4">
        <SavedBadge visible={savedVisible} />

        <button
          type="button"
          onClick={handleSave}
          className="flex items-center gap-2 px-6 py-2.5 rounded bg-[#ffbb00] hover:bg-[#e6a800] active:bg-[#cc9700] text-black font-semibold text-sm transition-colors shadow-lg shadow-[#ffbb00]/20 ml-auto"
        >
          <Save className="w-4 h-4" />
          Save Settings
        </button>
      </div>
    </div>
  );
}

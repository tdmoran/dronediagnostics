import Link from 'next/link';

export default function Home() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">DroneDiagnostics</h1>
        <p className="text-bf-text-muted">Blackbox log analysis and firmware management tools for Betaflight</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Link href="/blackbox" className="block bg-bf-surface rounded border border-bf-border p-6 hover:border-bf-accent transition-colors" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">📊 Blackbox Logs</h2>
          </div>
          <p className="text-bf-text-muted text-sm">
            Analyze flight logs, view gyro and motor data, calculate flight statistics.
          </p>
          <div className="mt-4">
            <span className="inline-flex items-center px-4 py-2 bg-bf-accent text-bf-bg font-medium rounded hover:bg-bf-accent-dark transition-colors">
              Open Blackbox
            </span>
          </div>
        </Link>
        
        <Link href="/firmware" className="block bg-bf-surface rounded border border-bf-border p-6 hover:border-bf-accent transition-colors" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">🔧 Firmware</h2>
          </div>
          <p className="text-bf-text-muted text-sm">
            Check firmware version, detect board target, download latest updates.
          </p>
          <div className="mt-4">
            <span className="inline-flex items-center px-4 py-2 bg-bf-accent text-bf-bg font-medium rounded hover:bg-bf-accent-dark transition-colors">
              Manage Firmware
            </span>
          </div>
        </Link>
        
        <Link href="/config" className="block bg-bf-surface rounded border border-bf-border p-6 hover:border-bf-accent transition-colors" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">⚙️ Config</h2>
          </div>
          <p className="text-bf-text-muted text-sm">
            Backup and restore settings, compare configurations, export CLI dumps.
          </p>
          <div className="mt-4">
            <span className="inline-flex items-center px-4 py-2 bg-bf-accent text-bf-bg font-medium rounded hover:bg-bf-accent-dark transition-colors">
              Manage Config
            </span>
          </div>
        </Link>
        
        <Link href="/gps" className="block bg-bf-surface rounded border border-bf-border p-6 hover:border-bf-accent transition-colors" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">📍 GPS</h2>
          </div>
          <p className="text-bf-text-muted text-sm">
            View GPS status, satellite count, coordinates and real-time tracking map.
          </p>
          <div className="mt-4">
            <span className="inline-flex items-center px-4 py-2 bg-bf-accent text-bf-bg font-medium rounded hover:bg-bf-accent-dark transition-colors">
              View GPS
            </span>
          </div>
        </Link>
        
        <Link href="/telemetry" className="block bg-bf-surface rounded border border-bf-border p-6 hover:border-bf-accent transition-colors" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">📡 Telemetry</h2>
          </div>
          <p className="text-bf-text-muted text-sm">
            Monitor real-time flight data, sensors, and system health.
          </p>
          <div className="mt-4">
            <span className="inline-flex items-center px-4 py-2 bg-bf-accent text-bf-bg font-medium rounded hover:bg-bf-accent-dark transition-colors">
              View Telemetry
            </span>
          </div>
        </Link>
        
        <Link href="/diagnose" className="block bg-bf-surface rounded border border-bf-border p-6 hover:border-bf-accent transition-colors" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">🔍 Diagnose</h2>
          </div>
          <p className="text-bf-text-muted text-sm">
            Run diagnostics, check for issues, and get recommendations.
          </p>
          <div className="mt-4">
            <span className="inline-flex items-center px-4 py-2 bg-bf-accent text-bf-bg font-medium rounded hover:bg-bf-accent-dark transition-colors">
              Run Diagnostics
            </span>
          </div>
        </Link>
      </div>
      
      <div className="bg-bf-surface rounded border border-bf-border p-6 mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Getting Started</h2>
        </div>
        <ol className="list-decimal list-inside space-y-2 text-bf-text">
          <li>Connect your flight controller via USB</li>
          <li>Use the <strong className="text-bf-accent">Blackbox</strong> page to upload and analyze flight logs</li>
          <li>Check for firmware updates in the <strong className="text-bf-accent">Firmware</strong> page</li>
          <li>Backup your configuration before making changes in the <strong className="text-bf-accent">Config</strong> page</li>
        </ol>
      </div>
    </div>
  );
}

import Link from 'next/link';

export default function Home() {
  return (
    <div>
      <div className="page-header">
        <h1>DroneDiagnostics</h1>
        <p>Blackbox log analysis and firmware management tools for Betaflight</p>
      </div>
      
      <div className="grid grid-3">
        <Link href="/blackbox" className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="card-header">
            <h2 className="card-title">📊 Blackbox Logs</h2>
          </div>
          <p style={{ color: 'var(--text-muted)' }}>
            Analyze flight logs, view gyro and motor data, calculate flight statistics.
          </p>
          <div style={{ marginTop: '1rem' }}>
            <span className="btn btn-primary">Open Blackbox</span>
          </div>
        </Link>
        
        <Link href="/firmware" className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="card-header">
            <h2 className="card-title">🔧 Firmware</h2>
          </div>
          <p style={{ color: 'var(--text-muted)' }}>
            Check firmware version, detect board target, download latest updates.
          </p>
          <div style={{ marginTop: '1rem' }}>
            <span className="btn btn-primary">Manage Firmware</span>
          </div>
        </Link>
        
        <Link href="/config" className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="card-header">
            <h2 className="card-title">⚙️ Config</h2>
          </div>
          <p style={{ color: 'var(--text-muted)' }}>
            Backup and restore settings, compare configurations, export CLI dumps.
          </p>
          <div style={{ marginTop: '1rem' }}>
            <span className="btn btn-primary">Manage Config</span>
          </div>
        </Link>
      </div>
      
      <div className="card" style={{ marginTop: '2rem' }}>
        <div className="card-header">
          <h2 className="card-title">Getting Started</h2>
        </div>
        <ol style={{ paddingLeft: '1.5rem', lineHeight: '2' }}>
          <li>Connect your flight controller via USB</li>
          <li>Use the <strong>Blackbox</strong> page to upload and analyze flight logs</li>
          <li>Check for firmware updates in the <strong>Firmware</strong> page</li>
          <li>Backup your configuration before making changes in the <strong>Config</strong> page</li>
        </ol>
      </div>
    </div>
  );
}

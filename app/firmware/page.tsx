'use client';

import { useState, useEffect } from 'react';
import { FirmwareInfo, FirmwareUpdateInfo, GitHubRelease } from '../../types/firmware';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function FirmwarePage() {
  const [firmwareInfo, setFirmwareInfo] = useState<FirmwareInfo | null>(null);
  const [updateInfo, setUpdateInfo] = useState<FirmwareUpdateInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState('MATEKF411');

  useEffect(() => {
    fetchFirmwareInfo();
  }, []);

  const fetchFirmwareInfo = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch firmware version
      const versionRes = await fetch(`${API_URL}/api/firmware/version`);
      const version = await versionRes.json();

      // Fetch board info
      const boardRes = await fetch(`${API_URL}/api/firmware/target`);
      const board = await boardRes.json();

      const info: FirmwareInfo = {
        current: version,
        board: board,
        apiVersion: '1.0'
      };

      setFirmwareInfo(info);
      
      // Check for updates
      await checkForUpdates(version.versionString, board.targetName);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch firmware info');
    } finally {
      setLoading(false);
    }
  };

  const checkForUpdates = async (currentVersion: string, targetName: string) => {
    try {
      const response = await fetch(
        `${API_URL}/api/firmware/latest?current=${currentVersion}&target=${targetName}`
      );
      const data = await response.json();
      setUpdateInfo(data);
    } catch (err) {
      console.error('Failed to check for updates:', err);
    }
  };

  const handleRefresh = () => {
    fetchFirmwareInfo();
  };

  const handleDownloadFirmware = () => {
    if (updateInfo?.targetFirmwareUrl) {
      window.open(updateInfo.targetFirmwareUrl, '_blank');
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Firmware Management</h1>
        <p>Check your Betaflight firmware version and manage updates</p>
      </div>

      {/* Current Firmware Card */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Current Firmware</h2>
          <button 
            className="btn btn-secondary"
            onClick={handleRefresh}
            disabled={loading}
          >
            {loading ? 'Refreshing...' : '🔄 Refresh'}
          </button>
        </div>

        {error && (
          <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>
            {error}
          </div>
        )}

        {firmwareInfo ? (
          <div className="grid grid-2">
            <div className="stat-card">
              <div className="stat-value">{firmwareInfo.current.versionString}</div>
              <div className="stat-label">Firmware Version</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{firmwareInfo.board.targetName}</div>
              <div className="stat-label">Board Target</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{firmwareInfo.board.boardName}</div>
              <div className="stat-label">Board Name</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{firmwareInfo.board.manufacturerId}</div>
              <div className="stat-label">Manufacturer ID</div>
            </div>
          </div>
        ) : (
          <div className="loading">
            <div className="spinner" style={{ marginRight: '1rem' }} />
            <span>Reading firmware info...</span>
          </div>
        )}
      </div>

      {/* Update Status */}
      {updateInfo && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Update Available</h2>
            {updateInfo.updateAvailable && (
              <span className="badge badge-warning">Update Available</span>
            )}
            {!updateInfo.updateAvailable && (
              <span className="badge badge-success">Up to Date</span>
            )}
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', gap: '2rem', marginBottom: '1rem' }}>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Current Version</span>
                <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>
                  {updateInfo.current.versionString}
                </div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Latest Version</span>
                <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>
                  {updateInfo.latest?.tag_name || 'Unknown'}
                </div>
              </div>
            </div>

            {updateInfo.latest && (
              <div style={{ marginTop: '1rem' }}>
                <h4 style={{ marginBottom: '0.5rem' }}>Release Notes</h4>
                <div 
                  style={{ 
                    backgroundColor: 'var(--surface-light)', 
                    padding: '1rem', 
                    borderRadius: '0.5rem',
                    maxHeight: '200px',
                    overflow: 'auto',
                    fontSize: '0.875rem',
                    whiteSpace: 'pre-wrap'
                  }}
                >
                  {updateInfo.latest.body.substring(0, 500)}...
                </div>
                <a 
                  href={updateInfo.latest.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--primary)', fontSize: '0.875rem', marginTop: '0.5rem', display: 'inline-block' }}
                >
                  View full release notes on GitHub →
                </a>
              </div>
            )}
          </div>

          {updateInfo.updateAvailable && updateInfo.targetFirmwareUrl && (
            <div>
              <button 
                className="btn btn-primary"
                onClick={handleDownloadFirmware}
                style={{ marginRight: '0.5rem' }}
              >
                ⬇️ Download Firmware for {firmwareInfo?.board.targetName}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Flashing Instructions */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">⚠️ Flashing Instructions</h2>
        </div>

        <div className="alert alert-warning">
          <strong>Warning:</strong> Flashing firmware incorrectly can brick your flight controller. 
          Follow these steps carefully.
        </div>

        <ol style={{ paddingLeft: '1.5rem', lineHeight: '2' }}>
          <li><strong>Backup your configuration</strong> - Go to the Config page and export your settings</li>
          <li><strong>Download the correct firmware</strong> - Make sure the target matches your board (current: {firmwareInfo?.board.targetName || 'Unknown'})</li>
          <li><strong>Use Betaflight Configurator</strong> - Open the official configurator tool</li>
          <li><strong>Enter DFU mode</strong> - Hold the BOOT button while connecting USB, or use the CLI command <code>bl</code></li>
          <li><strong>Flash the firmware</strong> - Select the downloaded .hex file and flash</li>
          <li><strong>Restore configuration</strong> - After flashing, restore your settings from backup</li>
        </ol>

        <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: 'rgba(23, 162, 184, 0.1)', borderRadius: '0.5rem' }}>
          <h4 style={{ marginBottom: '0.5rem', color: 'var(--info)' }}>Troubleshooting</h4>
          <ul style={{ paddingLeft: '1.5rem', lineHeight: '1.8' }}>
            <li>If the board doesn't enter DFU mode, try a different USB cable or port</li>
            <li>Install STM32 drivers if your computer doesn't recognize the device</li>
            <li>Some boards require a specific button combination to enter bootloader mode</li>
            <li>If flashing fails, try erasing the chip before flashing again</li>
          </ul>
        </div>

        <div style={{ marginTop: '1.5rem' }}>
          <a 
            href="https://github.com/betaflight/betaflight/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary"
            style={{ marginRight: '0.5rem' }}
          >
            📦 View All Releases
          </a>
          <a 
            href="https://betaflight.com/docs/wiki/getting-started/installation"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary"
          >
            📖 Official Documentation
          </a>
        </div>
      </div>
    </div>
  );
}

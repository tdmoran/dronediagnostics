'use client';

import { useState, useCallback } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface DiffResult {
  added: string[];
  removed: string[];
  modified: { key: string; current: string; backup: string }[];
  unchanged: string[];
}

interface DiffStats {
  total: number;
  added: number;
  removed: number;
  modified: number;
  unchanged: number;
}

export default function ConfigPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [diffResult, setDiffResult] = useState<DiffResult | null>(null);
  const [diffStats, setDiffStats] = useState<DiffStats | null>(null);
  const [importedSettings, setImportedSettings] = useState<Record<string, string> | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [activeTab, setActiveTab] = useState<'backup' | 'restore' | 'diff'>('backup');

  const handleExport = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/config/export`);
      
      if (!response.ok) {
        throw new Error('Failed to export config');
      }

      // Get the blob and download it
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `betaflight_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setSuccess('Configuration exported successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export config');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (file: File, endpoint: string) => {
    if (!file.name.endsWith('.txt')) {
      setError('Please upload a .txt file');
      return;
    }

    setLoading(true);
    setError(null);
    setDiffResult(null);
    setDiffStats(null);
    setImportedSettings(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to process file');
      }

      const result = await response.json();

      if (endpoint === '/api/config/diff') {
        setDiffResult(result.diff);
        setDiffStats(result.stats);
        setActiveTab('diff');
      } else if (endpoint === '/api/config/import') {
        setImportedSettings(result.preview);
        setSuccess(`Found ${result.settingsCount} settings to restore`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process file');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (apply: boolean) => {
    if (!importedSettings) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/config/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: importedSettings, apply }),
      });

      if (!response.ok) {
        throw new Error('Failed to restore config');
      }

      const result = await response.json();
      setSuccess(result.message);
      setImportedSettings(null);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore config');
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent, endpoint: string) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileUpload(file, endpoint);
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

  return (
    <div>
      <div className="page-header">
        <h1>Configuration Management</h1>
        <p>Backup, restore, and compare your Betaflight configuration</p>
      </div>

      {/* Tabs */}
      <div className="card">
        <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
          <button
            className={`btn ${activeTab === 'backup' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('backup')}
          >
            💾 Backup
          </button>
          <button
            className={`btn ${activeTab === 'restore' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('restore')}
          >
            📥 Restore
          </button>
          <button
            className={`btn ${activeTab === 'diff' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('diff')}
          >
            📊 Compare
          </button>
        </div>

        {error && (
          <div className="alert alert-danger" style={{ marginTop: '1rem' }}>
            {error}
          </div>
        )}

        {success && (
          <div className="alert alert-info" style={{ marginTop: '1rem' }}>
            {success}
          </div>
        )}

        {/* Backup Tab */}
        {activeTab === 'backup' && (
          <div style={{ marginTop: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>Export Configuration</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              Download a complete CLI dump of your current Betaflight configuration. 
              This can be used to restore settings later or compare with other configurations.
            </p>
            
            <button 
              className="btn btn-primary"
              onClick={handleExport}
              disabled={loading}
            >
              {loading ? 'Exporting...' : '💾 Export Config'}
            </button>

            <div className="alert alert-info" style={{ marginTop: '1.5rem' }}>
              <strong>Tip:</strong> Regular backups are recommended before making any changes to your configuration.
            </div>
          </div>
        )}

        {/* Restore Tab */}
        {activeTab === 'restore' && (
          <div style={{ marginTop: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>Restore Configuration</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              Upload a previously exported configuration file to restore your settings.
            </p>

            {!importedSettings ? (
              <div
                className={`file-upload ${isDragging ? 'dragover' : ''}`}
                onDrop={(e) => handleDrop(e, '/api/config/import')}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
              >
                <input
                  type="file"
                  accept=".txt"
                  onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], '/api/config/import')}
                  style={{ display: 'none' }}
                  id="restore-file-input"
                />
                <label htmlFor="restore-file-input" style={{ cursor: 'pointer' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📤</div>
                  <p style={{ fontSize: '1.125rem', marginBottom: '0.5rem' }}>
                    Drop your backup file here or click to browse
                  </p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                    Supports Betaflight CLI dump files (.txt)
                  </p>
                </label>
              </div>
            ) : (
              <div>
                <div className="alert alert-warning" style={{ marginBottom: '1rem' }}>
                  <strong>Warning:</strong> Review the settings before applying. 
                  This will overwrite your current configuration!
                </div>

                <div style={{ maxHeight: '300px', overflow: 'auto', marginBottom: '1rem' }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Setting</th>
                        <th>Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(importedSettings).slice(0, 50).map(([key, value]) => (
                        <tr key={key}>
                          <td style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>{key}</td>
                          <td style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>{value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {Object.keys(importedSettings).length > 50 && (
                    <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem' }}>
                      ... and {Object.keys(importedSettings).length - 50} more settings
                    </p>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button 
                    className="btn btn-danger"
                    onClick={() => handleRestore(true)}
                    disabled={loading}
                  >
                    {loading ? 'Applying...' : '✓ Apply Settings'}
                  </button>
                  <button 
                    className="btn btn-secondary"
                    onClick={() => setImportedSettings(null)}
                    disabled={loading}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Diff Tab */}
        {activeTab === 'diff' && (
          <div style={{ marginTop: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>Compare Configurations</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              Upload a backup file to compare it with your current configuration.
              See what settings have changed between versions.
            </p>

            {!diffResult ? (
              <div
                className={`file-upload ${isDragging ? 'dragover' : ''}`}
                onDrop={(e) => handleDrop(e, '/api/config/diff')}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
              >
                <input
                  type="file"
                  accept=".txt"
                  onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], '/api/config/diff')}
                  style={{ display: 'none' }}
                  id="diff-file-input"
                />
                <label htmlFor="diff-file-input" style={{ cursor: 'pointer' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📊</div>
                  <p style={{ fontSize: '1.125rem', marginBottom: '0.5rem' }}>
                    Drop your backup file here to compare
                  </p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                    Compare with current configuration
                  </p>
                </label>
              </div>
            ) : (
              <div>
                {diffStats && (
                  <div className="grid grid-4" style={{ marginBottom: '1.5rem' }}>
                    <div className="stat-card">
                      <div className="stat-value">{diffStats.total}</div>
                      <div className="stat-label">Total Settings</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-value" style={{ color: 'var(--success)' }}>{diffStats.added}</div>
                      <div className="stat-label">Added</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-value" style={{ color: 'var(--danger)' }}>{diffStats.removed}</div>
                      <div className="stat-label">Removed</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-value" style={{ color: 'var(--warning)' }}>{diffStats.modified}</div>
                      <div className="stat-label">Modified</div>
                    </div>
                  </div>
                )}

                {diffResult.modified.length > 0 && (
                  <div style={{ marginBottom: '1.5rem' }}>
                    <h4 style={{ marginBottom: '0.5rem' }}>Modified Settings</h4>
                    <div style={{ maxHeight: '250px', overflow: 'auto' }}>
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Setting</th>
                            <th>Current</th>
                            <th>Backup</th>
                          </tr>
                        </thead>
                        <tbody>
                          {diffResult.modified.map(({ key, current, backup }) => (
                            <tr key={key}>
                              <td style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>{key}</td>
                              <td style={{ fontFamily: 'monospace', fontSize: '0.875rem', color: 'var(--warning)' }}>{current}</td>
                              <td style={{ fontFamily: 'monospace', fontSize: '0.875rem', color: 'var(--info)' }}>{backup}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {diffResult.added.length > 0 && (
                  <div style={{ marginBottom: '1.5rem' }}>
                    <h4 style={{ marginBottom: '0.5rem' }}>Added Settings</h4>
                    <div style={{ maxHeight: '150px', overflow: 'auto' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                        {diffResult.added.map(key => (
                          <span key={key} className="badge badge-success" style={{ fontFamily: 'monospace' }}>
                            {key}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {diffResult.removed.length > 0 && (
                  <div style={{ marginBottom: '1.5rem' }}>
                    <h4 style={{ marginBottom: '0.5rem' }}>Removed Settings</h4>
                    <div style={{ maxHeight: '150px', overflow: 'auto' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                        {diffResult.removed.map(key => (
                          <span key={key} className="badge badge-danger" style={{ fontFamily: 'monospace' }}>
                            {key}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <button 
                  className="btn btn-secondary"
                  onClick={() => {
                    setDiffResult(null);
                    setDiffStats(null);
                  }}
                >
                  Compare Another File
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Important Notes */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">⚠️ Important Notes</h2>
        </div>
        <ul style={{ paddingLeft: '1.5rem', lineHeight: '2' }}>
          <li><strong>Always backup before major changes</strong> - Keep multiple backups with timestamps</li>
          <li><strong>Version compatibility</strong> - Configs from different firmware versions may not be fully compatible</li>
          <li><strong>Resource mapping</strong> - Be careful when restoring resource mappings (motor pins, UARTs)</li>
          <li><strong>Check before applying</strong> - Always review the diff before applying a restore</li>
          <li><strong>Test after restore</strong> - Verify all functions work correctly after restoring</li>
        </ul>
      </div>
    </div>
  );
}

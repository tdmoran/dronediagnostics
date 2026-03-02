'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  WifiOff,
  Copy,
  Check,
  Download,
  Upload,
  GitCompare,
  AlertTriangle,
  Info,
  Plus,
  Minus,
  RefreshCw,
} from 'lucide-react';

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

// Copy-to-clipboard button (shows a check for 1.5s after copy)
function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard not available
    }
  };

  return (
    <button
      onClick={handleCopy}
      title={`Copy ${label ?? 'value'}`}
      className="ml-1 p-1 rounded text-[#666] hover:text-[#ffbb00] hover:bg-[#333] transition-colors shrink-0"
    >
      {copied ? (
        <Check className="h-3 w-3 text-[#96e212]" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
    </button>
  );
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
  const [fcConnected, setFcConnected] = useState<boolean | null>(null); // null = checking

  // Check FC connection on mount
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const res = await fetch(`${API_URL}/api/health`);
        if (res.ok) {
          const data = await res.json();
          setFcConnected(data.fc_connected ?? data.connected ?? true);
        } else {
          setFcConnected(false);
        }
      } catch {
        setFcConnected(false);
      }
    };
    checkConnection();
  }, []);

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

  // Shared drag-and-drop upload zone
  function UploadZone({
    endpoint,
    hint,
  }: {
    endpoint: string;
    hint: string;
  }) {
    return (
      <div
        className={`relative border-2 border-dashed rounded p-8 text-center transition-all duration-200 cursor-pointer ${
          isDragging
            ? 'border-[#ffbb00] bg-[rgba(255,187,0,0.07)] shadow-[0_0_18px_rgba(255,187,0,0.12)]'
            : 'border-[#333] hover:border-[#555] hover:bg-[#242424]/40'
        }`}
        onDrop={(e) => handleDrop(e, endpoint)}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <input
          type="file"
          accept=".txt"
          onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0], endpoint)}
          style={{ display: 'none' }}
          id={`upload-${endpoint.replace(/\//g, '-')}`}
        />
        <label
          htmlFor={`upload-${endpoint.replace(/\//g, '-')}`}
          className="cursor-pointer flex flex-col items-center gap-3"
        >
          <div
            className={`p-4 rounded-full border-2 transition-colors ${
              isDragging
                ? 'border-[#ffbb00] bg-[rgba(255,187,0,0.15)] text-[#ffbb00]'
                : 'border-[#444] bg-[#242424] text-[#8c8c8c]'
            }`}
          >
            <Upload className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-[#f2f2f2] mb-0.5">
              {isDragging ? 'Release to upload' : 'Drop your backup file here'}
            </p>
            <p className="text-xs text-[#8c8c8c]">
              or <span className="text-[#ffbb00] underline underline-offset-2">click to browse</span>
            </p>
            <p className="text-xs text-[#666] mt-1">{hint}</p>
          </div>
        </label>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-4 lg:space-y-6 max-w-5xl mx-auto">
      <div className="page-header">
        <h1 className="text-xl lg:text-2xl font-bold text-[#f2f2f2]">Configuration Management</h1>
        <p className="text-[#8c8c8c] mt-1 text-sm lg:text-base">
          Backup, restore, and compare your Betaflight configuration
        </p>
      </div>

      {/* Not Connected Banner */}
      <AnimatePresence>
        {fcConnected === false && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-center gap-3 bg-[#1f1f1f] border border-[#e2123f]/50 rounded p-4 text-[#e2123f]"
          >
            <WifiOff className="h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold text-sm">Flight Controller Not Detected</p>
              <p className="text-xs text-[#8c8c8c] mt-0.5">
                Connect your FC via USB to export or restore live configuration. You can still compare offline backup files.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main card */}
      <div className="bg-[#1f1f1f] border border-[#333] rounded">
        {/* Tabs */}
        <div className="flex gap-1 border-b border-[#333] p-3">
          {[
            { id: 'backup' as const, label: 'Backup', Icon: Download },
            { id: 'restore' as const, label: 'Restore', Icon: Upload },
            { id: 'diff' as const, label: 'Compare', Icon: GitCompare },
          ].map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded text-sm font-medium transition-colors ${
                activeTab === id
                  ? 'bg-[#ffbb00] text-[#141414]'
                  : 'text-[#8c8c8c] hover:text-[#f2f2f2] hover:bg-[#242424]'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        <div className="p-5 lg:p-6">
          {/* Global alerts */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="flex items-start gap-3 bg-[#e2123f]/10 border border-[#e2123f]/40 rounded p-3 mb-4 text-[#e2123f] text-sm"
              >
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {success && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="flex items-start gap-3 bg-[#96e212]/10 border border-[#96e212]/40 rounded p-3 mb-4 text-[#96e212] text-sm"
              >
                <Check className="h-4 w-4 shrink-0 mt-0.5" />
                {success}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Backup Tab */}
          {activeTab === 'backup' && (
            <div>
              <h3 className="text-base font-semibold text-[#f2f2f2] mb-2">Export Configuration</h3>
              <p className="text-sm text-[#8c8c8c] mb-5">
                Download a complete CLI dump of your current Betaflight configuration.
                This can be used to restore settings later or compare with other configurations.
              </p>

              <button
                className="flex items-center gap-2 px-4 py-2 rounded text-sm font-medium
                  bg-[#ffbb00] text-[#141414] hover:bg-[#e6a800] transition-colors
                  disabled:opacity-40 disabled:cursor-not-allowed"
                onClick={handleExport}
                disabled={loading}
              >
                {loading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                {loading ? 'Exporting...' : 'Export Config'}
              </button>

              <div className="flex items-start gap-2 mt-5 p-3 bg-[#242424] border border-[#333] rounded text-xs text-[#8c8c8c]">
                <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[#ffbb00]" />
                Regular backups are recommended before making any changes to your configuration.
              </div>
            </div>
          )}

          {/* Restore Tab */}
          {activeTab === 'restore' && (
            <div>
              <h3 className="text-base font-semibold text-[#f2f2f2] mb-2">Restore Configuration</h3>
              <p className="text-sm text-[#8c8c8c] mb-5">
                Upload a previously exported configuration file to restore your settings.
              </p>

              {!importedSettings ? (
                <UploadZone
                  endpoint="/api/config/import"
                  hint="Supports Betaflight CLI dump files (.txt)"
                />
              ) : (
                <div>
                  <div className="flex items-start gap-2 p-3 bg-[#ff9900]/10 border border-[#ff9900]/40 rounded text-xs text-[#ff9900] mb-4">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>
                      <strong>Warning:</strong> Review the settings before applying.
                      This will overwrite your current configuration!
                    </span>
                  </div>

                  <div className="max-h-[300px] overflow-auto rounded border border-[#333] mb-4">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-[#242424] border-b border-[#333]">
                        <tr>
                          <th className="text-left text-[#8c8c8c] font-medium px-3 py-2 w-1/2">Setting</th>
                          <th className="text-left text-[#8c8c8c] font-medium px-3 py-2">Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(importedSettings).slice(0, 50).map(([key, value]) => (
                          <tr key={key} className="border-b border-[#2a2a2a] hover:bg-[#242424] transition-colors">
                            <td className="font-mono text-[#8c8c8c] px-3 py-2">{key}</td>
                            <td className="font-mono text-[#f2f2f2] px-3 py-2 flex items-center">
                              {value}
                              <CopyButton value={value} label={key} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {Object.keys(importedSettings).length > 50 && (
                      <p className="text-center text-xs text-[#666] py-3 border-t border-[#333]">
                        ... and {Object.keys(importedSettings).length - 50} more settings
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      className="flex items-center gap-2 px-4 py-2 rounded text-sm font-medium
                        bg-[#e2123f] text-white hover:bg-[#c5102f] transition-colors
                        disabled:opacity-40 disabled:cursor-not-allowed"
                      onClick={() => handleRestore(true)}
                      disabled={loading}
                    >
                      {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      {loading ? 'Applying...' : 'Apply Settings'}
                    </button>
                    <button
                      className="flex items-center gap-2 px-4 py-2 rounded text-sm font-medium
                        bg-[#242424] border border-[#444] text-[#f2f2f2]
                        hover:border-[#ffbb00] hover:text-[#ffbb00] transition-colors
                        disabled:opacity-40 disabled:cursor-not-allowed"
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
            <div>
              <h3 className="text-base font-semibold text-[#f2f2f2] mb-2">Compare Configurations</h3>
              <p className="text-sm text-[#8c8c8c] mb-5">
                Upload a backup file to compare it with your current configuration.
                See what settings have changed between versions.
              </p>

              {!diffResult ? (
                <UploadZone
                  endpoint="/api/config/diff"
                  hint="Compare with current live configuration"
                />
              ) : (
                <div>
                  {/* Stats row */}
                  {diffStats && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                      {[
                        { label: 'Total', value: diffStats.total, color: '#f2f2f2' },
                        { label: 'Added', value: diffStats.added, color: '#96e212' },
                        { label: 'Removed', value: diffStats.removed, color: '#e2123f' },
                        { label: 'Modified', value: diffStats.modified, color: '#ff9900' },
                      ].map(({ label, value, color }) => (
                        <div
                          key={label}
                          className="bg-[#242424] border border-[#333] rounded p-3 text-center"
                        >
                          <div className="text-2xl font-bold font-mono" style={{ color }}>
                            {value}
                          </div>
                          <div className="text-xs text-[#8c8c8c] mt-1">{label}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Modified settings — color-coded rows */}
                  {diffResult.modified.length > 0 && (
                    <div className="mb-6">
                      <h4 className="text-sm font-semibold text-[#f2f2f2] flex items-center gap-2 mb-3">
                        <span className="inline-block w-2 h-2 rounded-sm bg-[#ff9900]" />
                        Modified Settings
                        <span className="text-xs text-[#8c8c8c] font-normal">({diffResult.modified.length})</span>
                      </h4>
                      <div className="rounded border border-[#333] overflow-hidden max-h-[280px] overflow-y-auto">
                        <table className="w-full text-xs">
                          <thead className="sticky top-0 bg-[#242424] border-b border-[#333]">
                            <tr>
                              <th className="text-left text-[#8c8c8c] font-medium px-3 py-2 w-2/5">Setting</th>
                              <th className="text-left text-[#8c8c8c] font-medium px-3 py-2 w-[30%]">Current</th>
                              <th className="text-left text-[#8c8c8c] font-medium px-3 py-2 w-[30%]">Backup</th>
                            </tr>
                          </thead>
                          <tbody>
                            {diffResult.modified.map(({ key, current, backup }) => (
                              <tr
                                key={key}
                                className="border-b border-[#2a2a2a] bg-[#ff9900]/5 hover:bg-[#ff9900]/10 transition-colors"
                              >
                                <td className="font-mono text-[#f2f2f2] px-3 py-2 border-l-2 border-l-[#ff9900]">
                                  {key}
                                </td>
                                <td className="font-mono text-[#ff9900] px-3 py-2">
                                  <span className="flex items-center">
                                    {current}
                                    <CopyButton value={current} label={`${key} current`} />
                                  </span>
                                </td>
                                <td className="font-mono text-[#8c8c8c] px-3 py-2">
                                  <span className="flex items-center">
                                    {backup}
                                    <CopyButton value={backup} label={`${key} backup`} />
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Added settings */}
                  {diffResult.added.length > 0 && (
                    <div className="mb-6">
                      <h4 className="text-sm font-semibold text-[#f2f2f2] flex items-center gap-2 mb-3">
                        <Plus className="h-3.5 w-3.5 text-[#96e212]" />
                        Added Settings
                        <span className="text-xs text-[#8c8c8c] font-normal">({diffResult.added.length})</span>
                      </h4>
                      <div className="rounded border border-[#96e212]/30 overflow-hidden max-h-[160px] overflow-y-auto">
                        {diffResult.added.map((key) => (
                          <div
                            key={key}
                            className="flex items-center px-3 py-1.5 bg-[#96e212]/5 border-b border-[#96e212]/10
                              border-l-2 border-l-[#96e212] hover:bg-[#96e212]/10 transition-colors"
                          >
                            <Plus className="h-3 w-3 text-[#96e212] mr-2 shrink-0" />
                            <span className="font-mono text-xs text-[#96e212]">{key}</span>
                            <CopyButton value={key} label="key" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Removed settings */}
                  {diffResult.removed.length > 0 && (
                    <div className="mb-6">
                      <h4 className="text-sm font-semibold text-[#f2f2f2] flex items-center gap-2 mb-3">
                        <Minus className="h-3.5 w-3.5 text-[#e2123f]" />
                        Removed Settings
                        <span className="text-xs text-[#8c8c8c] font-normal">({diffResult.removed.length})</span>
                      </h4>
                      <div className="rounded border border-[#e2123f]/30 overflow-hidden max-h-[160px] overflow-y-auto">
                        {diffResult.removed.map((key) => (
                          <div
                            key={key}
                            className="flex items-center px-3 py-1.5 bg-[#e2123f]/5 border-b border-[#e2123f]/10
                              border-l-2 border-l-[#e2123f] hover:bg-[#e2123f]/10 transition-colors"
                          >
                            <Minus className="h-3 w-3 text-[#e2123f] mr-2 shrink-0" />
                            <span className="font-mono text-xs text-[#e2123f]">{key}</span>
                            <CopyButton value={key} label="key" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    className="flex items-center gap-2 px-4 py-2 rounded text-sm font-medium
                      bg-[#242424] border border-[#444] text-[#f2f2f2]
                      hover:border-[#ffbb00] hover:text-[#ffbb00] transition-colors"
                    onClick={() => {
                      setDiffResult(null);
                      setDiffStats(null);
                    }}
                  >
                    <GitCompare className="h-4 w-4" />
                    Compare Another File
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Important Notes */}
      <div className="bg-[#1f1f1f] border border-[#333] rounded p-5 lg:p-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="h-4 w-4 text-[#ff9900]" />
          <h2 className="text-base font-semibold text-[#f2f2f2]">Important Notes</h2>
        </div>
        <ul className="space-y-2 text-sm text-[#8c8c8c] list-none">
          {[
            { strong: 'Always backup before major changes', rest: ' — Keep multiple backups with timestamps' },
            { strong: 'Version compatibility', rest: ' — Configs from different firmware versions may not be fully compatible' },
            { strong: 'Resource mapping', rest: ' — Be careful when restoring resource mappings (motor pins, UARTs)' },
            { strong: 'Check before applying', rest: ' — Always review the diff before applying a restore' },
            { strong: 'Test after restore', rest: ' — Verify all functions work correctly after restoring' },
          ].map(({ strong, rest }) => (
            <li key={strong} className="flex items-start gap-2">
              <span className="text-[#ffbb00] mt-0.5 shrink-0">›</span>
              <span>
                <strong className="text-[#f2f2f2]">{strong}</strong>
                {rest}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

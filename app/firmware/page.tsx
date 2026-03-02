'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RefreshCw,
  CheckCircle2,
  ArrowUpCircle,
  WifiOff,
  Download,
  ExternalLink,
  BookOpen,
  Package,
  AlertTriangle,
} from 'lucide-react';
import { FirmwareInfo, FirmwareUpdateInfo, GitHubRelease } from '../../types/firmware';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Skeleton pulse block
function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-[#2a2a2a] ${className ?? ''}`}
    />
  );
}

// Loading skeleton for the firmware card
function FirmwareSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bg-[#242424] border border-[#333] rounded p-4 space-y-2">
          <SkeletonBlock className="h-7 w-3/4" />
          <SkeletonBlock className="h-4 w-1/2" />
        </div>
      ))}
    </div>
  );
}

export default function FirmwarePage() {
  const [firmwareInfo, setFirmwareInfo] = useState<FirmwareInfo | null>(null);
  const [updateInfo, setUpdateInfo] = useState<FirmwareUpdateInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notConnected, setNotConnected] = useState(false);
  const [target, setTarget] = useState('MATEKF411');

  useEffect(() => {
    fetchFirmwareInfo();
  }, []);

  const fetchFirmwareInfo = async () => {
    setLoading(true);
    setError(null);
    setNotConnected(false);

    try {
      // Fetch firmware version
      const versionRes = await fetch(`${API_URL}/api/firmware/version`);
      const version = await versionRes.json();

      // Detect "not connected" state
      if (
        typeof version.versionString === 'string' &&
        version.versionString.toLowerCase().includes('not connected')
      ) {
        setNotConnected(true);
        setLoading(false);
        return;
      }

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
    <div className="p-4 lg:p-6 space-y-4 lg:space-y-6 max-w-5xl mx-auto">
      {/* Page Header */}
      <div className="page-header">
        <h1 className="text-xl lg:text-2xl font-bold text-[#f2f2f2]">Firmware Management</h1>
        <p className="text-[#8c8c8c] mt-1 text-sm lg:text-base">
          Check your Betaflight firmware version and manage updates
        </p>
      </div>

      {/* Not Connected Banner */}
      <AnimatePresence>
        {notConnected && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-center gap-3 bg-[#1f1f1f] border border-[#e2123f]/50 rounded p-4 text-[#e2123f]"
          >
            <WifiOff className="h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold text-sm">Flight Controller Not Connected</p>
              <p className="text-xs text-[#8c8c8c] mt-0.5">
                Connect your FC via USB and click Refresh to read firmware data.
              </p>
            </div>
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium
                bg-[#242424] border border-[#444] text-[#f2f2f2]
                hover:border-[#ffbb00] hover:text-[#ffbb00] transition-colors
                disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
              Retry
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Current Firmware Card */}
      <div className="bg-[#1f1f1f] border border-[#333] rounded p-5 lg:p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-[#f2f2f2] flex items-center gap-2">
            <Package className="h-4 w-4 text-[#ffbb00]" />
            Current Firmware
          </h2>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium
              bg-[#242424] border border-[#444] text-[#f2f2f2]
              hover:border-[#ffbb00] hover:text-[#ffbb00] transition-colors
              disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {/* Error state */}
        {error && (
          <div className="flex items-start gap-3 bg-[#e2123f]/10 border border-[#e2123f]/40 rounded p-3 mb-4 text-[#e2123f] text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && !firmwareInfo && <FirmwareSkeleton />}

        {/* Loaded state */}
        {!loading && firmwareInfo && (
          <div className="grid grid-cols-2 gap-3 lg:gap-4">
            {[
              { label: 'Firmware Version', value: firmwareInfo.current.versionString },
              { label: 'Board Target', value: firmwareInfo.board.targetName },
              { label: 'Board Name', value: firmwareInfo.board.boardName },
              { label: 'Manufacturer ID', value: firmwareInfo.board.manufacturerId },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="bg-[#242424] border border-[#333] rounded p-4"
              >
                <div
                  className="text-lg font-bold text-[#f2f2f2] font-mono truncate"
                  title={value}
                >
                  {value}
                </div>
                <div className="text-xs text-[#8c8c8c] mt-1">{label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Empty idle state (before first load, no error) */}
        {!loading && !firmwareInfo && !error && !notConnected && (
          <div className="text-center py-8 text-[#666] text-sm">
            Click <span className="text-[#ffbb00]">Refresh</span> to read firmware information.
          </div>
        )}
      </div>

      {/* Update Status */}
      <AnimatePresence>
        {updateInfo && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="bg-[#1f1f1f] border border-[#333] rounded p-5 lg:p-6"
          >
            <h2 className="text-base font-semibold text-[#f2f2f2] mb-5">Version Comparison</h2>

            {/* Side-by-side version comparison */}
            <div className="flex items-center gap-4 mb-6">
              {/* Current version */}
              <div className="flex-1 bg-[#242424] border border-[#333] rounded p-4 text-center">
                <div className="text-xs text-[#8c8c8c] mb-1 uppercase tracking-wide">Current</div>
                <div className="text-2xl font-bold font-mono text-[#f2f2f2]">
                  {updateInfo.current.versionString}
                </div>
              </div>

              {/* Status indicator in the middle */}
              <div className="flex flex-col items-center gap-1 shrink-0">
                {updateInfo.updateAvailable ? (
                  <>
                    <ArrowUpCircle className="h-8 w-8 text-[#ff9900]" />
                    <span className="text-xs text-[#ff9900] font-medium">Update</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-8 w-8 text-[#96e212]" />
                    <span className="text-xs text-[#96e212] font-medium">Up to date</span>
                  </>
                )}
              </div>

              {/* Latest version */}
              <div
                className={`flex-1 bg-[#242424] rounded p-4 text-center border ${
                  updateInfo.updateAvailable
                    ? 'border-[#ff9900]/60'
                    : 'border-[#96e212]/40'
                }`}
              >
                <div className="text-xs text-[#8c8c8c] mb-1 uppercase tracking-wide">Latest</div>
                <div
                  className={`text-2xl font-bold font-mono ${
                    updateInfo.updateAvailable ? 'text-[#ff9900]' : 'text-[#96e212]'
                  }`}
                >
                  {updateInfo.latest?.tag_name || 'Unknown'}
                </div>
              </div>
            </div>

            {/* Release notes */}
            {updateInfo.latest && (
              <div className="mb-5">
                <h4 className="text-sm font-medium text-[#f2f2f2] mb-2">Release Notes</h4>
                <div className="bg-[#141414] border border-[#333] rounded p-3 max-h-[180px] overflow-auto
                  text-xs text-[#8c8c8c] font-mono whitespace-pre-wrap leading-relaxed">
                  {updateInfo.latest.body.substring(0, 500)}...
                </div>
                <a
                  href={updateInfo.latest.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-[#ffbb00] hover:text-[#e6a800] mt-2 transition-colors"
                >
                  View full release notes on GitHub
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}

            {/* Download button */}
            {updateInfo.updateAvailable && updateInfo.targetFirmwareUrl && (
              <button
                onClick={handleDownloadFirmware}
                className="flex items-center gap-2 px-4 py-2 rounded font-medium text-sm
                  bg-[#ffbb00] text-[#141414] hover:bg-[#e6a800] transition-colors"
              >
                <Download className="h-4 w-4" />
                Download Firmware for {firmwareInfo?.board.targetName}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Flashing Instructions */}
      <div className="bg-[#1f1f1f] border border-[#333] rounded p-5 lg:p-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="h-4 w-4 text-[#ff9900]" />
          <h2 className="text-base font-semibold text-[#f2f2f2]">Flashing Instructions</h2>
        </div>

        <div className="flex items-start gap-3 bg-[#ff9900]/10 border border-[#ff9900]/30 rounded p-3 mb-5 text-sm text-[#ff9900]">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            <strong>Warning:</strong> Flashing firmware incorrectly can brick your flight controller.
            Follow these steps carefully.
          </span>
        </div>

        <ol className="space-y-2 text-sm text-[#f2f2f2] list-decimal list-inside leading-relaxed">
          <li><strong>Backup your configuration</strong> — Go to the Config page and export your settings</li>
          <li><strong>Download the correct firmware</strong> — Make sure the target matches your board
            (current: <code className="font-mono text-[#ffbb00] text-xs">{firmwareInfo?.board.targetName || 'Unknown'}</code>)
          </li>
          <li><strong>Use Betaflight Configurator</strong> — Open the official configurator tool</li>
          <li><strong>Enter DFU mode</strong> — Hold the BOOT button while connecting USB, or use the CLI command
            <code className="font-mono text-[#ffbb00] text-xs ml-1">bl</code>
          </li>
          <li><strong>Flash the firmware</strong> — Select the downloaded .hex file and flash</li>
          <li><strong>Restore configuration</strong> — After flashing, restore your settings from backup</li>
        </ol>

        <div className="mt-5 p-3 bg-[#242424] border border-[#333] rounded">
          <h4 className="text-sm font-medium text-[#f2f2f2] mb-2">Troubleshooting</h4>
          <ul className="space-y-1 text-xs text-[#8c8c8c] list-disc list-inside">
            <li>If the board doesn't enter DFU mode, try a different USB cable or port</li>
            <li>Install STM32 drivers if your computer doesn't recognize the device</li>
            <li>Some boards require a specific button combination to enter bootloader mode</li>
            <li>If flashing fails, try erasing the chip before flashing again</li>
          </ul>
        </div>

        <div className="flex flex-wrap gap-3 mt-5">
          <a
            href="https://github.com/betaflight/betaflight/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium
              bg-[#242424] border border-[#444] text-[#f2f2f2]
              hover:border-[#ffbb00] hover:text-[#ffbb00] transition-colors"
          >
            <Package className="h-4 w-4" />
            View All Releases
          </a>
          <a
            href="https://betaflight.com/docs/wiki/getting-started/installation"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium
              bg-[#242424] border border-[#444] text-[#f2f2f2]
              hover:border-[#ffbb00] hover:text-[#ffbb00] transition-colors"
          >
            <BookOpen className="h-4 w-4" />
            Official Documentation
          </a>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTelemetry } from '@/components/TelemetryProvider';

type LineType = 'output' | 'input' | 'comment' | 'error';

interface TerminalLine {
  text: string;
  type: LineType;
}

// ── Demo responses (used when no FC is connected) ───────────────────────────
const DEMO_RESPONSES: Record<string, string> = {
  status: `System Uptime: 00:01:23\nCPU: 23%  Load: 0.52  Cycle time: 125µs  I2C errors: 0\nActive sensors: Gyro Accel Baro\nFlight mode: DISARMED ACRO\nVoltage: 16.80V  Current: 0.0A  Power: 0W`,
  version: `# Betaflight / STM32F7X2 (S7X2) 4.4.3 Dec 11 2023 / 14:04:17 (c8a1a3f) MSP API: 1.45`,
  tasks: `Task list          rate/hz  max/us  avg/us  total/ms\n00 - SYSTEM              9      12      10     45\n01 - GYRO               8000     14      12   5421\n02 - ACCEL              1000      5       4    320\n03 - ATTITUDE           100      18      15    12\n04 - RX                 33      35      28    42`,
  save: `Saving...\nRebooting...`,
  defaults: `## Resetting to defaults...`,
  motors: `Motor  Value\nM1     1000\nM2     1000\nM3     1000\nM4     1000`,
  feature: `# Active features: TELEMETRY AIRMODE OSD DYNAMIC_FILTER`,
  help: `Available commands:\n  diff all   - Show settings different from defaults\n  dump       - Export complete configuration\n  status     - Show FC status and sensor info\n  tasks      - Show task timing\n  version    - Show firmware version\n  get <p>    - Show a specific setting value\n  set <p>=<v>- Change a setting value\n  save       - Persist changes to EEPROM\n  defaults   - Reset all settings to defaults\n  motors     - Show motor values\n  serial     - Show serial port configuration\n  feature    - Show active feature flags\n  rxrange    - Show RC channel ranges\n  help       - Show this help message`,
  serial: `Serial port configuration:\n  UART1: MSP (115200)\n  UART2: GPS (57600)\n  UART3: Disabled\n  UART4: SmartPort (57600)`,
  'diff all': `rateprofile 0\n\n# profile 0\n\nset gyro_lpf1_static_hz = 250\nset gyro_lpf2_static_hz = 500\nset dyn_notch_count = 3\nset dyn_notch_min_hz = 100\nset dyn_notch_max_hz = 500\nset motor_pwm_protocol = DSHOT600\nset debug_mode = NONE\nset pid_process_denom = 2\n\nprofile 0\n\nset p_roll = 45\nset i_roll = 85\nset d_roll = 38\nset f_roll = 100\nset p_pitch = 47\nset i_pitch = 90\nset d_pitch = 42\nset f_pitch = 105\nset p_yaw = 45\nset i_yaw = 85\nset f_yaw = 100`,
  dump: `# dump\n\n# version\n# Betaflight / STM32F7X2 (S7X2) 4.4.3 Dec 11 2023\n\nbatch start\n\nboard_name FOXEERF722V4\nmanufacturer_id FOXE\n\nfeature -RX_PARALLEL_PWM\nfeature TELEMETRY\nfeature AIRMODE\nfeature OSD\nfeature DYNAMIC_FILTER\n\nsave`,
  rxrange: `rxrange 0 1000 2000\nrxrange 1 1000 2000\nrxrange 2 1000 2000\nrxrange 3 1000 2000`,
};

function getLineColor(type: LineType): string {
  switch (type) {
    case 'input':   return 'text-[#ffbb00]';
    case 'comment': return 'text-[#8c8c8c]';
    case 'error':   return 'text-[#ef4444]';
    default:        return 'text-[#22c55e]';
  }
}

function classifyLine(text: string): LineType {
  if (text.trimStart().startsWith('#')) return 'comment';
  if (text.toLowerCase().includes('error') || text.toLowerCase().includes('fail')) return 'error';
  return 'output';
}

export default function CLIPage() {
  const { connected } = useTelemetry();

  const [lines, setLines] = useState<TerminalLine[]>([
    { text: 'Betaflight CLI', type: 'output' },
    { text: '# Type a command or click a quick-command button above', type: 'comment' },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [getParamInput, setGetParamInput] = useState('');
  const [showGetInput, setShowGetInput] = useState(false);
  const [showDefaultsWarning, setShowDefaultsWarning] = useState(false);
  const [flashedButton, setFlashedButton] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // Live CLI WebSocket state
  const [cliConnected, setCliConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const pendingResolveRef = useRef<((text: string) => void) | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef<number>(-1);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  // Auto-connect / auto-disconnect CLI WebSocket when FC connection changes
  useEffect(() => {
    if (connected && !wsRef.current) {
      enterCliMode();
    }
    if (!connected && wsRef.current) {
      exitCliMode();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);

  const appendLines = useCallback((newLines: TerminalLine[]) => {
    setLines((prev) => [...prev, ...newLines]);
  }, []);

  function parseFcResponse(raw: string): TerminalLine[] {
    return raw
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n')
      .map((text): TerminalLine => ({ text, type: classifyLine(text) }));
  }

  // ── Live CLI ───────────────────────────────────────────────────────────────
  function enterCliMode() {
    if (wsRef.current) return;

    const ws = new WebSocket('ws://localhost:8000/ws/cli');

    ws.onopen = () => {
      setCliConnected(true);
      appendLines([{ text: '# ── CLI session opened ──', type: 'comment' }]);
    };

    ws.onmessage = (event) => {
      const raw: string = event.data;

      // If a command is awaiting a response, resolve it
      if (pendingResolveRef.current) {
        pendingResolveRef.current(raw);
        pendingResolveRef.current = null;
        return;
      }

      // Banner / unsolicited messages (e.g. initial CLI greeting)
      appendLines(parseFcResponse(raw));
      setIsProcessing(false);
    };

    ws.onclose = () => {
      setCliConnected(false);
      wsRef.current = null;
      pendingResolveRef.current = null;
      setIsProcessing(false);
      appendLines([{ text: '# ── CLI session closed — MSP telemetry resumed ──', type: 'comment' }]);
    };

    ws.onerror = () => {
      appendLines([{ text: 'CLI WebSocket error — check backend is running', type: 'error' }]);
      setCliConnected(false);
      wsRef.current = null;
      setIsProcessing(false);
    };

    wsRef.current = ws;
  }

  function exitCliMode() {
    if (wsRef.current) {
      try { wsRef.current.send('__exit__'); } catch { /* ignore */ }
      wsRef.current.close();
      wsRef.current = null;
    }
    setCliConnected(false);
  }

  // Send a command over the live WebSocket and wait for the response
  function sendLiveCommand(cmd: string): Promise<string> {
    return new Promise((resolve) => {
      pendingResolveRef.current = resolve;
      wsRef.current!.send(cmd);
    });
  }

  // ── Command processing ────────────────────────────────────────────────────
  const processCommand = useCallback(
    async (cmd: string) => {
      const trimmed = cmd.trim();
      if (!trimmed) return;

      // History
      if (historyRef.current[0] !== trimmed) {
        historyRef.current.unshift(trimmed);
        if (historyRef.current.length > 50) historyRef.current = historyRef.current.slice(0, 50);
      }
      historyIndexRef.current = -1;

      appendLines([{ text: trimmed, type: 'input' }]);
      setIsProcessing(true);

      // ── Live mode ──────────────────────────────────────────────────────────
      if (cliConnected && wsRef.current?.readyState === WebSocket.OPEN) {
        try {
          const response = await sendLiveCommand(trimmed);
          appendLines(parseFcResponse(response));
        } catch {
          appendLines([{ text: 'No response from FC', type: 'error' }]);
        }
        setIsProcessing(false);
        return;
      }

      // ── Demo mode ──────────────────────────────────────────────────────────
      await new Promise<void>((res) => setTimeout(res, 200 + Math.random() * 200));

      const lower = trimmed.toLowerCase();

      if (lower.startsWith('get ')) {
        const param = trimmed.slice(4).trim();
        appendLines([
          { text: `${param} = 0`, type: 'output' },
          { text: `# (demo) actual value from connected FC`, type: 'comment' },
        ]);
      } else if (lower.startsWith('set ')) {
        appendLines([{ text: `# (demo) setting not persisted`, type: 'comment' }]);
      } else {
        const response = DEMO_RESPONSES[lower] ?? DEMO_RESPONSES[trimmed];
        if (response) {
          appendLines(
            response.split('\n').map((text): TerminalLine => ({
              text,
              type: text.startsWith('#') ? 'comment' : 'output',
            }))
          );
        } else {
          appendLines([{ text: `Unknown command: ${trimmed}. Type 'help' for available commands.`, type: 'error' }]);
        }
      }

      setIsProcessing(false);
    },
    [cliConnected, appendLines]
  );

  const handleSend = useCallback(() => {
    if (!inputValue.trim() || isProcessing) return;
    const cmd = inputValue;
    setInputValue('');
    processCommand(cmd);
  }, [inputValue, isProcessing, processCommand]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        handleSend();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const next = historyIndexRef.current + 1;
        if (next < historyRef.current.length) {
          historyIndexRef.current = next;
          setInputValue(historyRef.current[next]);
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const prev = historyIndexRef.current - 1;
        if (prev < 0) {
          historyIndexRef.current = -1;
          setInputValue('');
        } else {
          historyIndexRef.current = prev;
          setInputValue(historyRef.current[prev]);
        }
      }
    },
    [handleSend]
  );

  const flashButton = (id: string) => {
    setFlashedButton(id);
    setTimeout(() => setFlashedButton(null), 400);
  };

  const sendQuickCommand = (cmd: string) => {
    flashButton(cmd);
    setShowGetInput(false);
    setShowDefaultsWarning(false);
    setInputValue('');
    processCommand(cmd);
    inputRef.current?.focus();
  };

  const quickCommands: Array<{
    id: string; label: string; cmd?: string; special?: 'get' | 'defaults'; row: number;
  }> = [
    { id: 'diff all', label: 'Diff All',     cmd: 'diff all', row: 1 },
    { id: 'status',   label: 'FC Status',    cmd: 'status',   row: 1 },
    { id: 'tasks',    label: 'Task Timing',  cmd: 'tasks',    row: 1 },
    { id: 'version',  label: 'FW Version',   cmd: 'version',  row: 1 },
    { id: 'get',      label: 'Get Param',    special: 'get',  row: 2 },
    { id: 'save',     label: 'Save EEPROM',  cmd: 'save',     row: 2 },
    { id: 'defaults', label: 'Reset Defaults', special: 'defaults', row: 2 },
    { id: 'dump',     label: 'Full Dump',    cmd: 'dump',     row: 2 },
    { id: 'motors',   label: 'Motor Values', cmd: 'motors',   row: 3 },
    { id: 'serial',   label: 'Serial Config',cmd: 'serial',   row: 3 },
    { id: 'feature',  label: 'Features',     cmd: 'feature',  row: 3 },
    { id: 'rxrange',  label: 'RC Ranges',    cmd: 'rxrange',  row: 3 },
  ];

  return (
    <div className="min-h-screen bg-[#141414] text-[#f2f2f2] p-6">
      <div className="max-w-5xl mx-auto space-y-4">

        {/* Header */}
        <div className="mb-2">
          <h1 className="text-xl font-semibold tracking-tight text-[#f2f2f2]">CLI Terminal</h1>
          <p className="text-sm text-[#8c8c8c] mt-0.5">
            Betaflight CLI — send commands directly to your flight controller
          </p>
        </div>

        {/* Status banner */}
        {cliConnected ? (
          <div className="flex items-center gap-3 rounded border border-[#22c55e]/30 bg-[#22c55e]/10 px-4 py-2.5">
            <span className="h-2 w-2 rounded-full bg-[#22c55e] animate-pulse shrink-0" />
            <span className="text-sm font-mono text-[#22c55e]">Live — connected to FC</span>
            <span className="ml-auto text-xs font-mono text-[#22c55e]/60">MSP telemetry paused while CLI is open</span>
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded border border-[#ffbb00]/30 bg-[#ffbb00]/10 px-4 py-2.5">
            <span className="mt-1 h-2 w-2 rounded-full bg-[#ffbb00] shrink-0" />
            <span className="text-sm font-mono text-[#ffbb00]">
              {connected ? 'Connecting to CLI…' : 'No FC connected — demo mode. Connect via the sidebar for live CLI.'}
            </span>
          </div>
        )}

        {/* Quick Commands */}
        <div className="rounded border border-[#333] bg-[#1f1f1f] p-4">
          <p className="text-xs font-mono text-[#8c8c8c] mb-3 uppercase tracking-widest">Quick Commands</p>

          {(['Diagnostics', 'Configuration', 'Sensors'] as const).map((rowLabel, rowIdx) => (
            <div key={rowLabel} className="mb-3 last:mb-0">
              <p className="text-[10px] font-mono text-[#8c8c8c]/60 mb-1.5 uppercase tracking-wider">{rowLabel}</p>
              <div className="grid grid-cols-4 gap-2">
                {quickCommands.filter((q) => q.row === rowIdx + 1).map((q) => (
                  <button
                    key={q.id}
                    onClick={() => {
                      if (q.special === 'get') {
                        setShowGetInput((v) => !v); setShowDefaultsWarning(false); flashButton(q.id);
                      } else if (q.special === 'defaults') {
                        setShowDefaultsWarning((v) => !v); setShowGetInput(false); flashButton(q.id);
                      } else if (q.cmd) {
                        sendQuickCommand(q.cmd);
                      }
                    }}
                    className={`border rounded px-3 py-2 text-sm font-mono text-left transition-colors duration-150
                      ${flashedButton === q.id
                        ? 'bg-[#ffbb00]/20 text-[#ffbb00] border-[#ffbb00]/40'
                        : q.special === 'defaults'
                        ? 'bg-[#242424] hover:bg-[#ef4444]/10 text-[#8c8c8c] hover:text-[#ef4444] border-[#333] hover:border-[#ef4444]/40'
                        : 'bg-[#242424] hover:bg-[#333] text-[#8c8c8c] hover:text-[#f2f2f2] border-[#333]'
                      }`}
                  >
                    <span className="text-[#ffbb00]/60 mr-1">#</span>{q.label}
                    <div className="text-[10px] text-[#8c8c8c]/50 mt-0.5">{q.id}</div>
                  </button>
                ))}
              </div>
            </div>
          ))}

          {showGetInput && (
            <div className="flex items-center gap-2 mt-3 p-2 rounded bg-[#242424] border border-[#ffbb00]/30">
              <span className="text-sm font-mono text-[#ffbb00]">get</span>
              <input
                type="text"
                value={getParamInput}
                onChange={(e) => setGetParamInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && getParamInput.trim()) {
                    sendQuickCommand(`get ${getParamInput.trim()}`);
                    setGetParamInput(''); setShowGetInput(false);
                  } else if (e.key === 'Escape') {
                    setShowGetInput(false); setGetParamInput('');
                  }
                }}
                placeholder="param name (e.g. motor_pwm_protocol)"
                autoFocus
                className="flex-1 bg-transparent border-none outline-none text-sm font-mono text-[#f2f2f2] placeholder:text-[#8c8c8c]/50"
              />
              <button
                onClick={() => { if (getParamInput.trim()) { sendQuickCommand(`get ${getParamInput.trim()}`); setGetParamInput(''); setShowGetInput(false); } }}
                className="text-xs font-mono px-2 py-1 rounded bg-[#ffbb00]/20 text-[#ffbb00] hover:bg-[#ffbb00]/30 transition-colors"
              >Run</button>
            </div>
          )}

          {showDefaultsWarning && (
            <div className="flex items-center gap-3 mt-3 p-3 rounded bg-[#ef4444]/10 border border-[#ef4444]/30">
              <span className="text-sm font-mono text-[#ef4444]">This will reset ALL settings to factory defaults. Are you sure?</span>
              <button onClick={() => { sendQuickCommand('defaults'); setShowDefaultsWarning(false); }}
                className="text-xs font-mono px-3 py-1 rounded bg-[#ef4444]/20 text-[#ef4444] hover:bg-[#ef4444]/30 transition-colors whitespace-nowrap">
                Confirm Reset
              </button>
              <button onClick={() => setShowDefaultsWarning(false)}
                className="text-xs font-mono px-3 py-1 rounded bg-[#333] text-[#8c8c8c] hover:text-[#f2f2f2] transition-colors">
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* Terminal */}
        <div className="rounded border border-[#333] bg-[#1f1f1f] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b border-[#333]">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-[#ef4444]/60" />
              <div className="h-3 w-3 rounded-full bg-[#ffbb00]/60" />
              <div className="h-3 w-3 rounded-full bg-[#22c55e]/60" />
              <span className="ml-2 text-xs font-mono text-[#8c8c8c]">betaflight — cli</span>
              <span className={`ml-2 text-[10px] font-mono px-1.5 py-0.5 rounded ${cliConnected ? 'bg-[#22c55e]/20 text-[#22c55e]' : 'bg-[#333] text-[#8c8c8c]'}`}>
                {cliConnected ? 'LIVE' : 'DEMO'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  const text = lines.map((l) => l.text).join('\n');
                  await navigator.clipboard.writeText(text).catch(() => {});
                  setCopySuccess(true);
                  setTimeout(() => setCopySuccess(false), 2000);
                }}
                className="text-xs font-mono px-2 py-1 rounded bg-[#242424] border border-[#333] text-[#8c8c8c] hover:text-[#f2f2f2] hover:border-[#ffbb00]/40 transition-colors"
              >
                {copySuccess ? 'Copied!' : 'Copy All'}
              </button>
              <button
                onClick={() => { setLines([]); inputRef.current?.focus(); }}
                className="text-xs font-mono px-2 py-1 rounded bg-[#242424] border border-[#333] text-[#8c8c8c] hover:text-[#f2f2f2] hover:border-[#ef4444]/40 transition-colors"
              >
                Clear
              </button>
            </div>
          </div>

          <div ref={scrollRef} className="h-[420px] overflow-y-auto bg-[#0a0a0a] p-4 font-mono text-sm leading-relaxed">
            {lines.map((line, i) => (
              <div key={i} className={`whitespace-pre-wrap break-all ${getLineColor(line.type)}`}>
                {line.type === 'input' ? (
                  <><span className="text-[#ffbb00]"># </span><span>{line.text}</span></>
                ) : (
                  line.text === '' ? <span>&nbsp;</span> : line.text
                )}
              </div>
            ))}
            {isProcessing && <div className="text-[#8c8c8c] animate-pulse">...</div>}
            {!isProcessing && (
              <div className="flex items-center">
                <span className="text-[#ffbb00]"># </span>
                <span className="inline-block w-2 h-4 bg-[#ffbb00] animate-pulse ml-px" />
              </div>
            )}
          </div>

          <div className="border-t border-[#333] bg-[#0a0a0a] px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-[#ffbb00] select-none shrink-0">#</span>
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isProcessing}
                placeholder="Type a command… (↑↓ for history)"
                className="flex-1 bg-transparent border-none outline-none font-mono text-sm text-[#ffbb00] placeholder:text-[#8c8c8c]/40 disabled:opacity-50 disabled:cursor-not-allowed"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
              />
              <button
                onClick={handleSend}
                disabled={isProcessing || !inputValue.trim()}
                className="shrink-0 font-mono text-xs px-3 py-1.5 rounded border border-[#333] bg-[#1f1f1f] text-[#8c8c8c] hover:text-[#ffbb00] hover:border-[#ffbb00]/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Send
              </button>
            </div>
          </div>
        </div>

        {/* Tips */}
        <div className="rounded border border-[#333] bg-[#1f1f1f] p-4">
          <p className="text-xs font-mono text-[#8c8c8c] uppercase tracking-widest mb-3">Common CLI Commands</p>
          <div className="grid grid-cols-1 gap-1.5 font-mono text-sm">
            {[
              { cmd: 'diff all',          desc: 'Backup all settings (different from defaults)' },
              { cmd: 'dump',              desc: 'Export complete configuration' },
              { cmd: 'save',              desc: 'Persist changes to EEPROM' },
              { cmd: 'get <param>',       desc: 'Show a specific setting value' },
              { cmd: 'set <param> = <v>', desc: 'Change a setting' },
            ].map(({ cmd, desc }) => (
              <div key={cmd} className="flex items-baseline gap-3">
                <span className="text-[#ffbb00] shrink-0 w-44">{cmd}</span>
                <span className="text-[#8c8c8c]">— {desc}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs font-mono text-[#8c8c8c]/60">
            While CLI is active, MSP telemetry (dashboard, battery, etc.) is paused. Click Exit CLI to resume.
          </p>
        </div>

      </div>
    </div>
  );
}

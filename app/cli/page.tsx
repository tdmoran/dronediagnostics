'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTelemetry } from '@/components/TelemetryProvider';

type LineType = 'output' | 'input' | 'comment' | 'error';

interface TerminalLine {
  text: string;
  type: LineType;
}

const DEMO_RESPONSES: Record<string, string> = {
  status: `System Uptime: 00:01:23
CPU: 23%  Load: 0.52  Cycle time: 125µs  I2C errors: 0
Active sensors: Gyro Accel Baro
Flight mode: DISARMED ACRO
Voltage: 16.80V  Current: 0.0A  Power: 0W`,
  version: `# Betaflight / STM32F7X2 (S7X2) 4.4.3 Dec 11 2023 / 14:04:17 (c8a1a3f) MSP API: 1.45`,
  tasks: `Task list          rate/hz  max/us  avg/us  total/ms
00 - SYSTEM              9      12      10     45
01 - GYRO               8000     14      12   5421
02 - ACCEL              1000      5       4    320
03 - ATTITUDE           100      18      15    12
04 - RX                 33      35      28    42`,
  save: `Saving...
Rebooting...`,
  defaults: `## Resetting to defaults...`,
  motors: `Motor  Value
M1     1000
M2     1000
M3     1000
M4     1000`,
  feature: `# Active features: TELEMETRY AIRMODE OSD DYNAMIC_FILTER`,
  help: `Available commands:
  diff all   - Show settings different from defaults
  dump       - Export complete configuration
  status     - Show FC status and sensor info
  tasks      - Show task timing
  version    - Show firmware version
  get <p>    - Show a specific setting value
  set <p>=<v>- Change a setting value
  save       - Persist changes to EEPROM
  defaults   - Reset all settings to defaults
  motors     - Show motor values
  serial     - Show serial port configuration
  feature    - Show active feature flags
  rxrange    - Show RC channel ranges
  help       - Show this help message`,
  serial: `Serial port configuration:
  UART1: MSP (115200)
  UART2: GPS (57600)
  UART3: Disabled
  UART4: SmartPort (57600)`,
  'diff all': `rateprofile 0

# profile 0

set gyro_lpf1_static_hz = 250
set gyro_lpf2_static_hz = 500
set dyn_notch_count = 3
set dyn_notch_min_hz = 100
set dyn_notch_max_hz = 500
set motor_pwm_protocol = DSHOT600
set debug_mode = NONE
set pid_process_denom = 2

profile 0

set p_roll = 45
set i_roll = 85
set d_roll = 38
set f_roll = 100
set p_pitch = 47
set i_pitch = 90
set d_pitch = 42
set f_pitch = 105
set p_yaw = 45
set i_yaw = 85
set f_yaw = 100`,
  dump: `# dump

# version
# Betaflight / STM32F7X2 (S7X2) 4.4.3 Dec 11 2023 / 14:04:17 (c8a1a3f) MSP API: 1.45

# start the command batch
batch start

board_name FOXEERF722V4
manufacturer_id FOXE

# name: MyQuad

# resources
resource BEEPER 1 C15
resource MOTOR 1 B00
resource MOTOR 2 B01
resource MOTOR 3 E09
resource MOTOR 4 E11

# feature
feature -RX_PARALLEL_PWM
feature TELEMETRY
feature AIRMODE
feature OSD
feature DYNAMIC_FILTER

# save configuration
save`,
  rxrange: `rxrange
rxrange 0 1000 2000
rxrange 1 1000 2000
rxrange 2 1000 2000
rxrange 3 1000 2000`,
};

const INITIAL_LINES: TerminalLine[] = [
  { text: 'Betaflight CLI', type: 'output' },
  { text: '# ', type: 'comment' },
  { text: '# diff all', type: 'comment' },
  { text: '# ', type: 'comment' },
  { text: 'rateprofile 0', type: 'output' },
  { text: '', type: 'output' },
  { text: '# profile 0', type: 'comment' },
  { text: '', type: 'output' },
  { text: 'set gyro_lpf1_static_hz = 250', type: 'output' },
  { text: 'set gyro_lpf2_static_hz = 500', type: 'output' },
  { text: 'set dyn_notch_count = 3', type: 'output' },
  { text: 'set dyn_notch_min_hz = 100', type: 'output' },
  { text: 'set dyn_notch_max_hz = 500', type: 'output' },
  { text: 'set motor_pwm_protocol = DSHOT600', type: 'output' },
  { text: 'set debug_mode = NONE', type: 'output' },
  { text: 'set pid_process_denom = 2', type: 'output' },
  { text: '', type: 'output' },
  { text: 'profile 0', type: 'output' },
  { text: '', type: 'output' },
  { text: 'set p_roll = 45', type: 'output' },
  { text: 'set i_roll = 85', type: 'output' },
  { text: 'set d_roll = 38', type: 'output' },
  { text: 'set f_roll = 100', type: 'output' },
  { text: 'set p_pitch = 47', type: 'output' },
  { text: 'set i_pitch = 90', type: 'output' },
  { text: 'set d_pitch = 42', type: 'output' },
  { text: 'set f_pitch = 105', type: 'output' },
  { text: 'set p_yaw = 45', type: 'output' },
  { text: 'set i_yaw = 85', type: 'output' },
  { text: 'set f_yaw = 100', type: 'output' },
  { text: '', type: 'output' },
  { text: '# ', type: 'comment' },
];

function getLineColor(type: LineType): string {
  switch (type) {
    case 'input':
      return 'text-[#ffbb00]';
    case 'comment':
      return 'text-[#8c8c8c]';
    case 'error':
      return 'text-[#ef4444]';
    case 'output':
    default:
      return 'text-[#22c55e]';
  }
}

export default function CLIPage() {
  const { connected } = useTelemetry();
  const [lines, setLines] = useState<TerminalLine[]>(INITIAL_LINES);
  const [inputValue, setInputValue] = useState('');
  const [getParamInput, setGetParamInput] = useState('');
  const [showGetInput, setShowGetInput] = useState(false);
  const [showDefaultsWarning, setShowDefaultsWarning] = useState(false);
  const [flashedButton, setFlashedButton] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef<number>(-1);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  const appendLines = useCallback((newLines: TerminalLine[]) => {
    setLines((prev) => [...prev, ...newLines]);
  }, []);

  const processCommand = useCallback(
    (cmd: string) => {
      const trimmed = cmd.trim();
      if (!trimmed) return;

      // Add to history
      if (historyRef.current[0] !== trimmed) {
        historyRef.current.unshift(trimmed);
        if (historyRef.current.length > 50) {
          historyRef.current = historyRef.current.slice(0, 50);
        }
      }
      historyIndexRef.current = -1;

      // Echo the input line
      appendLines([{ text: trimmed, type: 'input' }]);

      setIsProcessing(true);

      const delay = 200 + Math.random() * 300;

      setTimeout(() => {
        if (connected) {
          appendLines([
            {
              text: 'Note: Real CLI requires WebSocket passthrough. Running in demo mode.',
              type: 'comment',
            },
          ]);
        }

        const lower = trimmed.toLowerCase();

        // Handle "get <param>" pattern
        if (lower.startsWith('get ')) {
          const param = trimmed.slice(4).trim();
          appendLines([
            {
              text: `${param} = 0`,
              type: 'output',
            },
            {
              text: `# (demo) Actual value depends on connected flight controller`,
              type: 'comment',
            },
          ]);
          setIsProcessing(false);
          return;
        }

        // Handle "set <param> = <value>" pattern
        if (lower.startsWith('set ')) {
          appendLines([
            { text: `Setting applied (demo mode — not persisted)`, type: 'output' },
          ]);
          setIsProcessing(false);
          return;
        }

        const response = DEMO_RESPONSES[lower] ?? DEMO_RESPONSES[trimmed];

        if (response) {
          const responseLines = response.split('\n').map((line): TerminalLine => {
            if (line.startsWith('#') || line.startsWith('##')) {
              return { text: line, type: 'comment' };
            }
            return { text: line, type: 'output' };
          });
          appendLines(responseLines);
        } else {
          appendLines([
            {
              text: `Unknown command: ${trimmed}. Type 'help' for available commands.`,
              type: 'error',
            },
          ]);
        }

        setIsProcessing(false);
      }, delay);
    },
    [connected, appendLines]
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

  const handleClear = () => {
    setLines([]);
    inputRef.current?.focus();
  };

  const handleCopyAll = async () => {
    const text = lines.map((l) => l.text).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      // fallback: do nothing silently
    }
  };

  const quickCommands: Array<{
    id: string;
    label: string;
    cmd?: string;
    special?: 'get' | 'defaults';
    row: number;
  }> = [
    // Row 1: Diagnostics
    { id: 'diff all', label: 'Diff All (Backup)', cmd: 'diff all', row: 1 },
    { id: 'status', label: 'FC Status', cmd: 'status', row: 1 },
    { id: 'tasks', label: 'Task Timing', cmd: 'tasks', row: 1 },
    { id: 'version', label: 'FW Version', cmd: 'version', row: 1 },
    // Row 2: Configuration
    { id: 'get', label: 'Get Param', special: 'get', row: 2 },
    { id: 'save', label: 'Save to EEPROM', cmd: 'save', row: 2 },
    { id: 'defaults', label: 'Reset Defaults', special: 'defaults', row: 2 },
    { id: 'dump', label: 'Full Dump', cmd: 'dump', row: 2 },
    // Row 3: Sensors
    { id: 'motors', label: 'Motor Values', cmd: 'motors', row: 3 },
    { id: 'serial', label: 'Serial Config', cmd: 'serial', row: 3 },
    { id: 'feature', label: 'Feature Flags', cmd: 'feature', row: 3 },
    { id: 'rxrange', label: 'RC Ranges', cmd: 'rxrange', row: 3 },
  ];

  return (
    <div className="min-h-screen bg-[#141414] text-[#f2f2f2] p-6">
      <div className="max-w-5xl mx-auto space-y-4">

        {/* Page Header */}
        <div className="mb-2">
          <h1 className="text-xl font-semibold tracking-tight text-[#f2f2f2]">CLI Terminal</h1>
          <p className="text-sm text-[#8c8c8c] mt-0.5">
            Betaflight CLI — send commands to your flight controller
          </p>
        </div>

        {/* Section 1: Connection Status Banner */}
        {connected ? (
          <div className="flex items-center gap-3 rounded border border-[#22c55e]/30 bg-[#22c55e]/10 px-4 py-2.5">
            <span className="h-2 w-2 rounded-full bg-[#22c55e] shrink-0" />
            <span className="text-sm font-mono text-[#22c55e]">
              Connected to FC via MSP — CLI mode active
            </span>
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded border border-[#ffbb00]/30 bg-[#ffbb00]/10 px-4 py-2.5">
            <span className="mt-0.5 h-2 w-2 rounded-full bg-[#ffbb00] shrink-0" />
            <span className="text-sm font-mono text-[#ffbb00]">
              No flight controller connected — running in demo mode. Connect via serial port to use real CLI.
            </span>
          </div>
        )}

        {/* Section 2: Quick Commands Panel */}
        <div className="rounded border border-[#333] bg-[#1f1f1f] p-4">
          <p className="text-xs font-mono text-[#8c8c8c] mb-3 uppercase tracking-widest">
            Quick Commands
          </p>

          {/* Row 1: Diagnostics */}
          <p className="text-[10px] font-mono text-[#8c8c8c]/60 mb-1.5 uppercase tracking-wider">
            Diagnostics
          </p>
          <div className="grid grid-cols-4 gap-2 mb-3">
            {quickCommands.filter((q) => q.row === 1).map((q) => (
              <button
                key={q.id}
                onClick={() => q.cmd && sendQuickCommand(q.cmd)}
                className={`
                  border border-[#333] rounded px-3 py-2 text-sm font-mono text-left transition-colors duration-150
                  ${flashedButton === q.id
                    ? 'bg-[#ffbb00]/20 text-[#ffbb00] border-[#ffbb00]/40'
                    : 'bg-[#242424] hover:bg-[#333] text-[#8c8c8c] hover:text-[#f2f2f2]'
                  }
                `}
              >
                <span className="text-[#ffbb00]/60 mr-1">#</span>
                {q.label}
                <div className="text-[10px] text-[#8c8c8c]/50 mt-0.5">{q.id}</div>
              </button>
            ))}
          </div>

          {/* Row 2: Configuration */}
          <p className="text-[10px] font-mono text-[#8c8c8c]/60 mb-1.5 uppercase tracking-wider">
            Configuration
          </p>
          <div className="grid grid-cols-4 gap-2 mb-3">
            {quickCommands.filter((q) => q.row === 2).map((q) => (
              <div key={q.id}>
                <button
                  onClick={() => {
                    if (q.special === 'get') {
                      setShowGetInput((v) => !v);
                      setShowDefaultsWarning(false);
                      flashButton(q.id);
                    } else if (q.special === 'defaults') {
                      setShowDefaultsWarning((v) => !v);
                      setShowGetInput(false);
                      flashButton(q.id);
                    } else if (q.cmd) {
                      sendQuickCommand(q.cmd);
                    }
                  }}
                  className={`
                    w-full border border-[#333] rounded px-3 py-2 text-sm font-mono text-left transition-colors duration-150
                    ${flashedButton === q.id
                      ? 'bg-[#ffbb00]/20 text-[#ffbb00] border-[#ffbb00]/40'
                      : q.special === 'defaults'
                      ? 'bg-[#242424] hover:bg-[#ef4444]/10 text-[#8c8c8c] hover:text-[#ef4444] hover:border-[#ef4444]/40'
                      : 'bg-[#242424] hover:bg-[#333] text-[#8c8c8c] hover:text-[#f2f2f2]'
                    }
                  `}
                >
                  <span className="text-[#ffbb00]/60 mr-1">#</span>
                  {q.label}
                  <div className="text-[10px] text-[#8c8c8c]/50 mt-0.5">{q.id}</div>
                </button>
              </div>
            ))}
          </div>

          {/* Get param inline input */}
          {showGetInput && (
            <div className="flex items-center gap-2 mb-3 p-2 rounded bg-[#242424] border border-[#ffbb00]/30">
              <span className="text-sm font-mono text-[#ffbb00]">get</span>
              <input
                type="text"
                value={getParamInput}
                onChange={(e) => setGetParamInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && getParamInput.trim()) {
                    sendQuickCommand(`get ${getParamInput.trim()}`);
                    setGetParamInput('');
                    setShowGetInput(false);
                  } else if (e.key === 'Escape') {
                    setShowGetInput(false);
                    setGetParamInput('');
                  }
                }}
                placeholder="param name (e.g. motor_pwm_protocol)"
                autoFocus
                className="flex-1 bg-transparent border-none outline-none text-sm font-mono text-[#f2f2f2] placeholder:text-[#8c8c8c]/50"
              />
              <button
                onClick={() => {
                  if (getParamInput.trim()) {
                    sendQuickCommand(`get ${getParamInput.trim()}`);
                    setGetParamInput('');
                    setShowGetInput(false);
                  }
                }}
                className="text-xs font-mono px-2 py-1 rounded bg-[#ffbb00]/20 text-[#ffbb00] hover:bg-[#ffbb00]/30 transition-colors"
              >
                Run
              </button>
            </div>
          )}

          {/* Defaults warning */}
          {showDefaultsWarning && (
            <div className="flex items-center gap-3 mb-3 p-3 rounded bg-[#ef4444]/10 border border-[#ef4444]/30">
              <span className="text-sm font-mono text-[#ef4444]">
                This will reset ALL settings to factory defaults. Are you sure?
              </span>
              <button
                onClick={() => {
                  sendQuickCommand('defaults');
                  setShowDefaultsWarning(false);
                }}
                className="text-xs font-mono px-3 py-1 rounded bg-[#ef4444]/20 text-[#ef4444] hover:bg-[#ef4444]/30 transition-colors whitespace-nowrap"
              >
                Confirm Reset
              </button>
              <button
                onClick={() => setShowDefaultsWarning(false)}
                className="text-xs font-mono px-3 py-1 rounded bg-[#333] text-[#8c8c8c] hover:text-[#f2f2f2] transition-colors"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Row 3: Sensors */}
          <p className="text-[10px] font-mono text-[#8c8c8c]/60 mb-1.5 uppercase tracking-wider">
            Sensors
          </p>
          <div className="grid grid-cols-4 gap-2">
            {quickCommands.filter((q) => q.row === 3).map((q) => (
              <button
                key={q.id}
                onClick={() => q.cmd && sendQuickCommand(q.cmd)}
                className={`
                  border border-[#333] rounded px-3 py-2 text-sm font-mono text-left transition-colors duration-150
                  ${flashedButton === q.id
                    ? 'bg-[#ffbb00]/20 text-[#ffbb00] border-[#ffbb00]/40'
                    : 'bg-[#242424] hover:bg-[#333] text-[#8c8c8c] hover:text-[#f2f2f2]'
                  }
                `}
              >
                <span className="text-[#ffbb00]/60 mr-1">#</span>
                {q.label}
                <div className="text-[10px] text-[#8c8c8c]/50 mt-0.5">{q.id}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Section 3: Main Terminal */}
        <div className="rounded border border-[#333] bg-[#1f1f1f] overflow-hidden">
          {/* Terminal toolbar */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-[#333] bg-[#1f1f1f]">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-[#ef4444]/60" />
              <div className="h-3 w-3 rounded-full bg-[#ffbb00]/60" />
              <div className="h-3 w-3 rounded-full bg-[#22c55e]/60" />
              <span className="ml-2 text-xs font-mono text-[#8c8c8c]">betaflight — cli</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyAll}
                className="text-xs font-mono px-2 py-1 rounded bg-[#242424] border border-[#333] text-[#8c8c8c] hover:text-[#f2f2f2] hover:border-[#ffbb00]/40 transition-colors"
              >
                {copySuccess ? 'Copied!' : 'Copy All'}
              </button>
              <button
                onClick={handleClear}
                className="text-xs font-mono px-2 py-1 rounded bg-[#242424] border border-[#333] text-[#8c8c8c] hover:text-[#f2f2f2] hover:border-[#ef4444]/40 transition-colors"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Terminal output area */}
          <div
            ref={scrollRef}
            className="h-[400px] overflow-y-auto bg-[#0a0a0a] p-4 font-mono text-sm leading-relaxed"
          >
            {lines.map((line, i) => (
              <div key={i} className={`whitespace-pre-wrap break-all ${getLineColor(line.type)}`}>
                {line.type === 'input' ? (
                  <>
                    <span className="text-[#ffbb00]"># </span>
                    <span>{line.text}</span>
                  </>
                ) : (
                  line.text === '' ? <span>&nbsp;</span> : line.text
                )}
              </div>
            ))}

            {/* Processing indicator */}
            {isProcessing && (
              <div className="text-[#8c8c8c] animate-pulse">...</div>
            )}

            {/* Cursor */}
            {!isProcessing && (
              <div className="flex items-center">
                <span className="text-[#ffbb00]"># </span>
                <span className="inline-block w-2 h-4 bg-[#ffbb00] animate-pulse ml-px" />
              </div>
            )}
          </div>

          {/* Section 4: Command Input */}
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
                placeholder="Type a command... (Up/Down for history)"
                className="
                  flex-1 bg-transparent border-none outline-none
                  font-mono text-sm text-[#ffbb00] placeholder:text-[#8c8c8c]/40
                  disabled:opacity-50 disabled:cursor-not-allowed
                "
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
              />
              <button
                onClick={handleSend}
                disabled={isProcessing || !inputValue.trim()}
                className="
                  shrink-0 font-mono text-xs px-3 py-1.5 rounded
                  border border-[#333] bg-[#1f1f1f]
                  text-[#8c8c8c] hover:text-[#ffbb00] hover:border-[#ffbb00]/40
                  disabled:opacity-40 disabled:cursor-not-allowed
                  transition-colors
                "
              >
                Send
              </button>
            </div>
          </div>
        </div>

        {/* Section 5: CLI Tips Card */}
        <div className="rounded border border-[#333] bg-[#1f1f1f] p-4">
          <p className="text-xs font-mono text-[#8c8c8c] uppercase tracking-widest mb-3">
            Common CLI Commands
          </p>
          <div className="grid grid-cols-1 gap-1.5 font-mono text-sm">
            {[
              { cmd: 'diff all', desc: 'Backup all settings (different from defaults)' },
              { cmd: 'dump', desc: 'Export complete configuration' },
              { cmd: 'save', desc: 'Persist changes to EEPROM' },
              { cmd: 'get <param>', desc: 'Show a specific setting value' },
              { cmd: 'set <param> = <value>', desc: 'Change a setting' },
            ].map(({ cmd, desc }) => (
              <div key={cmd} className="flex items-baseline gap-3">
                <span className="text-[#ffbb00] shrink-0 w-40">{cmd}</span>
                <span className="text-[#8c8c8c]">— {desc}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs font-mono text-[#8c8c8c]/60">
            In production, connect via serial port for real CLI communication with your flight controller.
          </p>
        </div>

      </div>
    </div>
  );
}

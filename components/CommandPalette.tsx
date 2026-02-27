"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { 
  Search, 
  Home, 
  Activity, 
  MapPin, 
  Battery, 
  Radio, 
  Settings, 
  Wrench,
  FileText,
  Cpu,
  Plug,
  Download,
  RotateCcw,
  Command,
  X
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

import { cn } from "@/lib/utils"
import { Dialog, DialogContent } from "@/components/ui/dialog"

interface CommandItem {
  id: string
  title: string
  description?: string
  icon?: React.ReactNode
  shortcut?: string[]
  action: () => void
  category: string
}

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  recentCommands?: string[]
  onCommandRun?: (commandId: string) => void
}

export function CommandPalette({
  open,
  onOpenChange,
  recentCommands = [],
  onCommandRun,
}: CommandPaletteProps) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = React.useState("")
  const [selectedIndex, setSelectedIndex] = React.useState(0)
  const inputRef = React.useRef<HTMLInputElement>(null)

  // Define all available commands
  const commands: CommandItem[] = React.useMemo(() => [
    // Navigation
    {
      id: "nav-home",
      title: "Go to Dashboard",
      description: "View main dashboard",
      icon: <Home className="w-5 h-5" />,
      shortcut: ["G", "D"],
      category: "Navigation",
      action: () => router.push("/"),
    },
    {
      id: "nav-diagnose",
      title: "Go to Diagnose",
      description: "Run diagnostics on your drone",
      icon: <Wrench className="w-5 h-5" />,
      shortcut: ["G", "Diag"],
      category: "Navigation",
      action: () => router.push("/diagnose"),
    },
    {
      id: "nav-gps",
      title: "Go to GPS",
      description: "View GPS tracking and telemetry",
      icon: <MapPin className="w-5 h-5" />,
      shortcut: ["G", "GPS"],
      category: "Navigation",
      action: () => router.push("/gps"),
    },
    {
      id: "nav-telemetry",
      title: "Go to Telemetry",
      description: "View real-time telemetry data",
      icon: <Activity className="w-5 h-5" />,
      shortcut: ["G", "T"],
      category: "Navigation",
      action: () => router.push("/telemetry"),
    },
    {
      id: "nav-battery",
      title: "Go to Battery",
      description: "Check battery status and health",
      icon: <Battery className="w-5 h-5" />,
      shortcut: ["G", "B"],
      category: "Navigation",
      action: () => router.push("/battery"),
    },
    {
      id: "nav-radio",
      title: "Go to Radio",
      description: "Configure radio settings",
      icon: <Radio className="w-5 h-5" />,
      shortcut: ["G", "R"],
      category: "Navigation",
      action: () => router.push("/radio"),
    },
    {
      id: "nav-blackbox",
      title: "Go to Blackbox",
      description: "Analyze flight logs",
      icon: <FileText className="w-5 h-5" />,
      shortcut: ["G", "BB"],
      category: "Navigation",
      action: () => router.push("/blackbox"),
    },
    {
      id: "nav-firmware",
      title: "Go to Firmware",
      description: "Manage firmware updates",
      icon: <Cpu className="w-5 h-5" />,
      shortcut: ["G", "F"],
      category: "Navigation",
      action: () => router.push("/firmware"),
    },
    {
      id: "nav-config",
      title: "Go to Config",
      description: "Configuration settings",
      icon: <Settings className="w-5 h-5" />,
      shortcut: ["G", "C"],
      category: "Navigation",
      action: () => router.push("/config"),
    },
    {
      id: "nav-settings",
      title: "Go to Settings",
      description: "Application settings",
      icon: <Settings className="w-5 h-5" />,
      shortcut: ["G", "S"],
      category: "Navigation",
      action: () => router.push("/settings"),
    },
    // Actions
    {
      id: "action-connect",
      title: "Connect to Serial Port",
      description: "Open serial connection dialog",
      icon: <Plug className="w-5 h-5" />,
      shortcut: ["⌘", "⇧", "C"],
      category: "Actions",
      action: () => {
        // Trigger connection action
        const event = new CustomEvent("serial-connect-request")
        window.dispatchEvent(event)
      },
    },
    {
      id: "action-download-logs",
      title: "Download Blackbox Logs",
      description: "Download flight logs from drone",
      icon: <Download className="w-5 h-5" />,
      category: "Actions",
      action: () => {
        const event = new CustomEvent("blackbox-download-request")
        window.dispatchEvent(event)
      },
    },
    {
      id: "action-calibrate",
      title: "Calibrate Sensors",
      description: "Run gyro and accelerometer calibration",
      icon: <RotateCcw className="w-5 h-5" />,
      category: "Actions",
      action: () => {
        const event = new CustomEvent("calibrate-request")
        window.dispatchEvent(event)
      },
    },
    {
      id: "action-reload",
      title: "Reload Application",
      description: "Reload the page",
      icon: <RotateCcw className="w-5 h-5" />,
      shortcut: ["⌘", "R"],
      category: "Actions",
      action: () => window.location.reload(),
    },
  ], [router])

  // Filter commands based on search query
  const filteredCommands = React.useMemo(() => {
    if (!searchQuery.trim()) {
      // Show recent commands first, then all commands
      const recent = recentCommands
        .map(id => commands.find(c => c.id === id))
        .filter(Boolean) as CommandItem[]
      
      const otherCommands = commands.filter(c => !recentCommands.includes(c.id))
      return [...recent, ...otherCommands]
    }

    const query = searchQuery.toLowerCase()
    return commands.filter(
      cmd =>
        cmd.title.toLowerCase().includes(query) ||
        cmd.description?.toLowerCase().includes(query) ||
        cmd.category.toLowerCase().includes(query)
    )
  }, [commands, searchQuery, recentCommands])

  // Group commands by category
  const groupedCommands = React.useMemo(() => {
    const groups: Record<string, CommandItem[]> = {}
    filteredCommands.forEach(cmd => {
      if (!groups[cmd.category]) {
        groups[cmd.category] = []
      }
      groups[cmd.category].push(cmd)
    })
    return groups
  }, [filteredCommands])

  // Handle keyboard navigation
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault()
          setSelectedIndex(prev => 
            Math.min(prev + 1, filteredCommands.length - 1)
          )
          break
        case "ArrowUp":
          e.preventDefault()
          setSelectedIndex(prev => Math.max(prev - 1, 0))
          break
        case "Enter":
          e.preventDefault()
          const selectedCommand = filteredCommands[selectedIndex]
          if (selectedCommand) {
            handleCommandSelect(selectedCommand)
          }
          break
        case "Escape":
          onOpenChange(false)
          break
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [open, filteredCommands, selectedIndex, onOpenChange])

  // Reset selection when search changes
  React.useEffect(() => {
    setSelectedIndex(0)
  }, [searchQuery])

  // Focus input when opened
  React.useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  const handleCommandSelect = (command: CommandItem) => {
    command.action()
    onCommandRun?.(command.id)
    onOpenChange(false)
    setSearchQuery("")
  }

  // Render shortcut keys
  const renderShortcut = (keys: string[]) => (
    <span className="flex items-center gap-1">
      {keys.map((key, i) => (
        <kbd
          key={i}
          className="px-1.5 py-0.5 text-xs bg-gray-800 border border-gray-700 rounded text-gray-400"
        >
          {key}
        </kbd>
      ))}
    </span>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 gap-0 bg-gray-900 border-gray-800">
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-800">
          <Search className="w-5 h-5 text-gray-500" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search commands..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent text-white placeholder-gray-500 outline-none text-lg"
          />
          <button
            onClick={() => onOpenChange(false)}
            className="p-1 hover:bg-gray-800 rounded text-gray-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Command List */}
        <div className="max-h-[400px] overflow-y-auto py-2">
          {filteredCommands.length === 0 ? (
            <div className="py-8 text-center text-gray-500">
              No commands found
            </div>
          ) : (
            Object.entries(groupedCommands).map(([category, cmds], groupIndex) => {
              const prevCommandsCount = Object.values(groupedCommands)
                .slice(0, groupIndex)
                .flat().length
              
              return (
                <div key={category}>
                  <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {category}
                    {category === "Navigation" && recentCommands.length > 0 && !searchQuery && (
                      <span className="ml-2 text-blue-400">• Recent</span>
                    )}
                  </div>
                  {cmds.map((command, cmdIndex) => {
                    const globalIndex = prevCommandsCount + cmdIndex
                    const isSelected = globalIndex === selectedIndex
                    
                    return (
                      <motion.button
                        key={command.id}
                        layout
                        onClick={() => handleCommandSelect(command)}
                        className={cn(
                          "w-full px-4 py-3 flex items-center gap-3 text-left transition-colors",
                          isSelected 
                            ? "bg-blue-600 text-white" 
                            : "text-gray-300 hover:bg-gray-800"
                        )}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                      >
                        <span className={cn(
                          "p-2 rounded-lg",
                          isSelected ? "bg-blue-500" : "bg-gray-800"
                        )}>
                          {command.icon}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">{command.title}</div>
                          {command.description && (
                            <div className={cn(
                              "text-sm truncate",
                              isSelected ? "text-blue-200" : "text-gray-500"
                            )}>
                              {command.description}
                            </div>
                          )}
                        </div>
                        {command.shortcut && (
                          <div className={isSelected ? "text-blue-200" : ""}>
                            {renderShortcut(command.shortcut)}
                          </div>
                        )}
                      </motion.button>
                    )
                  })}
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-800 flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-800 border border-gray-700 rounded">↑</kbd>
              <kbd className="px-1.5 py-0.5 bg-gray-800 border border-gray-700 rounded">↓</kbd>
              <span className="ml-1">to navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-800 border border-gray-700 rounded">↵</kbd>
              <span className="ml-1">to select</span>
            </span>
          </div>
          <span className="flex items-center gap-1">
            <Command className="w-3 h-3" />
            <span>K to open</span>
          </span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
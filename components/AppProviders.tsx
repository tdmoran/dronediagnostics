"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { CommandPalette } from "@/components/CommandPalette"
import { useToast, useConnectionToasts } from "@/hooks/use-toast"
import { useAppKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts"
import { ToastContainer } from "@/components/ui/toast"

// Hook to track recent commands
function useRecentCommands(maxRecent = 5) {
  const [recentCommands, setRecentCommands] = React.useState<string[]>([])

  const addRecentCommand = React.useCallback((commandId: string) => {
    setRecentCommands((prev) => {
      // Remove if already exists
      const filtered = prev.filter((id) => id !== commandId)
      // Add to front
      return [commandId, ...filtered].slice(0, maxRecent)
    })
  }, [maxRecent])

  return { recentCommands, addRecentCommand }
}

// Hook to handle connection state
function useConnectionState() {
  const [isConnected, setIsConnected] = React.useState(false)
  const [isArmed, setIsArmed] = React.useState(false)
  const { showConnected, showDisconnected, showConnectionFailed } = useConnectionToasts()

  const toggleConnection = React.useCallback(() => {
    if (isConnected) {
      setIsConnected(false)
      showDisconnected()
    } else {
      // Simulate connection attempt
      setTimeout(() => {
        setIsConnected(true)
        showConnected("COM3")
      }, 500)
    }
  }, [isConnected, showConnected, showDisconnected])

  const toggleArm = React.useCallback(() => {
    if (!isConnected) {
      showConnectionFailed("Not connected to flight controller")
      return
    }
    
    if (confirm(isArmed ? "Disarm the drone?" : "Arm the drone?")) {
      setIsArmed(!isArmed)
    }
  }, [isConnected, isArmed, showConnectionFailed])

  return {
    isConnected,
    isArmed,
    toggleConnection,
    toggleArm,
  }
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [commandPaletteOpen, setCommandPaletteOpen] = React.useState(false)
  const [isModalOpen, setIsModalOpen] = React.useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const { toasts, dismiss } = useToast()
  const { recentCommands, addRecentCommand } = useRecentCommands()
  const { isConnected, isArmed, toggleConnection, toggleArm } = useConnectionState()

  // Handle search focus
  const handleFocusSearch = React.useCallback(() => {
    // Try to find and focus a search input
    const searchInput = document.querySelector('[data-search="true"]') as HTMLInputElement
    if (searchInput) {
      searchInput.focus()
    }
  }, [])

  // Handle modal close
  const handleCloseModal = React.useCallback(() => {
    setIsModalOpen(false)
    // Dispatch event to close any open modals
    const event = new CustomEvent("close-all-modals")
    window.dispatchEvent(event)
  }, [])

  // Setup keyboard shortcuts
  useAppKeyboardShortcuts({
    onCommandPalette: () => setCommandPaletteOpen(true),
    onConnectToggle: toggleConnection,
    onArmToggle: toggleArm,
    onCloseModal: handleCloseModal,
    onFocusSearch: handleFocusSearch,
    isModalOpen: isModalOpen || commandPaletteOpen,
    isConnected,
    isArmed,
  })

  // Listen for modal open events
  React.useEffect(() => {
    const handleModalOpen = () => setIsModalOpen(true)
    const handleModalClose = () => setIsModalOpen(false)
    
    window.addEventListener("modal-open", handleModalOpen)
    window.addEventListener("modal-close", handleModalClose)
    
    return () => {
      window.removeEventListener("modal-open", handleModalOpen)
      window.removeEventListener("modal-close", handleModalClose)
    }
  }, [])

  // Listen for custom events from command palette
  React.useEffect(() => {
    const handleSerialConnect = () => {
      toggleConnection()
    }
    
    const handleCalibrate = () => {
      const { showCalibrationStarted } = useConnectionToasts()
      showCalibrationStarted("gyro")
    }

    window.addEventListener("serial-connect-request", handleSerialConnect)
    window.addEventListener("calibrate-request", handleCalibrate)
    
    return () => {
      window.removeEventListener("serial-connect-request", handleSerialConnect)
      window.removeEventListener("calibrate-request", handleCalibrate)
    }
  }, [toggleConnection])

  return (
    <>
      {children}
      
      {/* Command Palette */}
      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        recentCommands={recentCommands}
        onCommandRun={addRecentCommand}
      />
      
      {/* Toast Container with actual toasts */}
      <ToastContainer 
        toasts={toasts.map(t => ({ ...t, onClose: () => dismiss(t.id) }))}
        position="bottom-right" 
      />
    </>
  )
}
"use client"

import { useEffect, useCallback, useRef } from "react"

interface KeyboardShortcut {
  key: string
  ctrl?: boolean
  cmd?: boolean
  shift?: boolean
  alt?: boolean
  handler: (e: KeyboardEvent) => void
  preventDefault?: boolean
}

interface UseKeyboardShortcutsOptions {
  shortcuts: KeyboardShortcut[]
  enabled?: boolean
}

export function useKeyboardShortcuts({
  shortcuts,
  enabled = true,
}: UseKeyboardShortcutsOptions) {
  const shortcutsRef = useRef(shortcuts)
  
  // Update ref when shortcuts change
  useEffect(() => {
    shortcutsRef.current = shortcuts
  }, [shortcuts])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!enabled) return

    const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0
    
    for (const shortcut of shortcutsRef.current) {
      const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase()
      
      // Check modifier keys
      const ctrlMatch = shortcut.ctrl === undefined || 
        (isMac ? e.metaKey : e.ctrlKey) === shortcut.ctrl
      const shiftMatch = shortcut.shift === undefined || e.shiftKey === shortcut.shift
      const altMatch = shortcut.alt === undefined || e.altKey === shortcut.alt
      
      // For Cmd key on Mac
      const cmdMatch = shortcut.cmd === undefined || 
        (isMac ? e.metaKey : e.ctrlKey) === shortcut.cmd

      if (keyMatch && ctrlMatch && shiftMatch && altMatch && cmdMatch) {
        if (shortcut.preventDefault !== false) {
          e.preventDefault()
        }
        shortcut.handler(e)
        break
      }
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown, enabled])
}

// Predefined shortcuts for the drone diagnostics app
export function useAppKeyboardShortcuts({
  onCommandPalette,
  onConnectToggle,
  onArmToggle,
  onCloseModal,
  onFocusSearch,
  isModalOpen = false,
  isConnected = false,
  isArmed = false,
}: {
  onCommandPalette?: () => void
  onConnectToggle?: () => void
  onArmToggle?: () => void
  onCloseModal?: () => void
  onFocusSearch?: () => void
  isModalOpen?: boolean
  isConnected?: boolean
  isArmed?: boolean
}) {
  const shortcuts: KeyboardShortcut[] = [
    // Command palette - Cmd/Ctrl+K
    {
      key: "k",
      cmd: true,
      handler: () => onCommandPalette?.(),
      preventDefault: true,
    },
    // Connect/Disconnect - Cmd/Ctrl+Shift+C
    {
      key: "c",
      cmd: true,
      shift: true,
      handler: () => onConnectToggle?.(),
      preventDefault: true,
    },
    // Focus search - /
    {
      key: "/",
      handler: () => {
        if (!isModalOpen) {
          onFocusSearch?.()
        }
      },
      preventDefault: true,
    },
    // Close modal - Escape
    {
      key: "Escape",
      handler: () => {
        if (isModalOpen) {
          onCloseModal?.()
        }
      },
    },
  ]

  // Space for arm/disarm - only when modal is not open
  if (!isModalOpen) {
    shortcuts.push({
      key: " ",
      handler: (e) => {
        e.preventDefault()
        onArmToggle?.()
      },
      preventDefault: true,
    })
  }

  useKeyboardShortcuts({ shortcuts })

  return {
    shortcuts,
    helpText: [
      { keys: ["⌘/Ctrl", "K"], description: "Open command palette" },
      { keys: ["⌘/Ctrl", "⇧", "C"], description: "Connect/Disconnect" },
      { keys: ["Space"], description: "Arm/Disarm (with confirmation)" },
      { keys: ["/"], description: "Focus search" },
      { keys: ["Esc"], description: "Close modal/panel" },
    ],
  }
}

// Hook for global shortcuts that work everywhere
export function useGlobalKeyboardShortcuts() {
  useKeyboardShortcuts({
    shortcuts: [
      {
        key: "?",
        shift: true,
        handler: () => {
          // Show keyboard shortcuts help
          const event = new CustomEvent("show-shortcuts-help")
          window.dispatchEvent(event)
        },
      },
    ],
  })
}

export type { KeyboardShortcut }
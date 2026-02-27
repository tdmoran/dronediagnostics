"use client"

import * as React from "react"
import type { ToastProps } from "@/components/ui/toast"

interface Toast extends Omit<ToastProps, "onClose"> {
  id: string
  duration?: number
}

interface ToastContextType {
  toasts: Toast[]
  toast: (props: Omit<Toast, "id">) => string
  dismiss: (id: string) => void
  dismissAll: () => void
  success: (title: string, description?: string) => string
  error: (title: string, description?: string) => string
  info: (title: string, description?: string) => string
  warning: (title: string, description?: string) => string
}

const ToastContext = React.createContext<ToastContextType | undefined>(undefined)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([])

  const dismiss = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = React.useCallback((props: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).substring(2, 9)
    const newToast = { ...props, id, duration: props.duration || 5000 }
    
    setToasts((prev) => [...prev, newToast])
    
    if (newToast.duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, newToast.duration)
    }
    
    return id
  }, [])

  const dismissAll = React.useCallback(() => {
    setToasts([])
  }, [])

  const success = React.useCallback((title: string, description?: string) => {
    return toast({ title, description, variant: "success", duration: 5000 })
  }, [toast])

  const error = React.useCallback((title: string, description?: string) => {
    return toast({ title, description, variant: "error", duration: 8000 })
  }, [toast])

  const info = React.useCallback((title: string, description?: string) => {
    return toast({ title, description, variant: "info", duration: 5000 })
  }, [toast])

  const warning = React.useCallback((title: string, description?: string) => {
    return toast({ title, description, variant: "warning", duration: 6000 })
  }, [toast])

  const contextValue = React.useMemo(
    () => ({ toasts, toast, dismiss, dismissAll, success, error, info, warning }),
    [toasts, toast, dismiss, dismissAll, success, error, info, warning]
  )

  return React.createElement(
    ToastContext.Provider,
    { value: contextValue },
    children
  )
}

export function useToast() {
  const context = React.useContext(ToastContext)
  if (context === undefined) {
    throw new Error("useToast must be used within a ToastProvider")
  }
  return context
}

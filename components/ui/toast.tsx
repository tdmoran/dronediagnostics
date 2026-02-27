"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"

import { cn } from "@/lib/utils"

const toastVariants = cva(
  "group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-lg border p-4 pr-8 shadow-lg transition-all",
  {
    variants: {
      variant: {
        default: "border-gray-700 bg-gray-900 text-white",
        success: "border-green-800 bg-green-950/90 text-green-100",
        error: "border-red-800 bg-red-950/90 text-red-100",
        warning: "border-yellow-800 bg-yellow-950/90 text-yellow-100",
        info: "border-blue-800 bg-blue-950/90 text-blue-100",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const toastIconVariants = cva("h-5 w-5", {
  variants: {
    variant: {
      default: "text-gray-400",
      success: "text-green-400",
      error: "text-red-400",
      warning: "text-yellow-400",
      info: "text-blue-400",
    },
  },
  defaultVariants: {
    variant: "default",
  },
})

interface ToastProps extends React.HTMLAttributes<HTMLDivElement>,
  VariantProps<typeof toastVariants> {
  title?: string
  description?: string
  onClose?: () => void
  icon?: React.ReactNode
}

function Toast({
  className,
  variant = "default",
  title,
  description,
  onClose,
  icon,
}: ToastProps) {
  const IconComponent = {
    default: Info,
    success: CheckCircle,
    error: AlertCircle,
    warning: AlertTriangle,
    info: Info,
  }[variant || "default"]

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.9 }}
      transition={{ duration: 0.2 }}
      className={cn(toastVariants({ variant }), className)}
    >
      <div className="flex items-start gap-3">
        {icon || <IconComponent className={cn(toastIconVariants({ variant }), "mt-0.5")} />}
        <div className="flex-1">
          {title && <div className="font-semibold text-sm">{title}</div>}
          {description && <div className="text-sm opacity-90">{description}</div>}
        </div>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="absolute right-2 top-2 rounded-md p-1 opacity-0 transition-opacity hover:bg-white/10 group-hover:opacity-100"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </motion.div>
  )
}

interface ToastContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  toasts: Array<ToastProps & { id: string }>
  position?: "top-left" | "top-center" | "top-right" | "bottom-left" | "bottom-center" | "bottom-right"
}

function ToastContainer({
  className,
  toasts,
  position = "bottom-right",
  ...props
}: ToastContainerProps) {
  const positionClasses = {
    "top-left": "top-0 left-0",
    "top-center": "top-0 left-1/2 -translate-x-1/2",
    "top-right": "top-0 right-0",
    "bottom-left": "bottom-0 left-0",
    "bottom-center": "bottom-0 left-1/2 -translate-x-1/2",
    "bottom-right": "bottom-0 right-0",
  }

  return (
    <div
      className={cn(
        "fixed z-[100] flex flex-col gap-2 p-4 max-w-sm w-full pointer-events-none",
        positionClasses[position],
        className
      )}
      {...props}
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <Toast {...toast} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  )
}

export { Toast, ToastContainer, toastVariants, toastIconVariants }
export type { ToastProps }
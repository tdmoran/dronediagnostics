"use client"

import * as React from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"

interface PageProgressProps {
  className?: string
  color?: string
  height?: number
}

function PageProgressInner({
  className,
  color = "bg-[#ffbb00]",
  height = 3,
}: PageProgressProps) {
  const [progress, setProgress] = React.useState(0)
  const [isVisible, setIsVisible] = React.useState(false)
  const pathname = usePathname()
  const searchParams = useSearchParams()

  React.useEffect(() => {
    let timeoutId: NodeJS.Timeout
    let progressInterval: NodeJS.Timeout

    const startLoading = () => {
      setIsVisible(true)
      setProgress(0)

      progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return 90
          }
          const increment = prev < 30 ? 15 : prev < 60 ? 8 : 3
          return Math.min(prev + increment, 90)
        })
      }, 100)
    }

    const completeLoading = () => {
      clearInterval(progressInterval)
      setProgress(100)

      timeoutId = setTimeout(() => {
        setIsVisible(false)
        setProgress(0)
      }, 300)
    }

    startLoading()
    const completeTimeout = setTimeout(completeLoading, 300)

    return () => {
      clearInterval(progressInterval)
      clearTimeout(timeoutId)
      clearTimeout(completeTimeout)
    }
  }, [pathname, searchParams])

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className={`fixed top-0 left-0 right-0 z-[100] ${className}`}
          style={{ height }}
        >
          <div className="absolute inset-0 bg-[#333]/30" />
          <motion.div
            className={`h-full ${color} shadow-[0_0_10px_rgba(255,187,0,0.5)]`}
            initial={{ width: "0%" }}
            animate={{ width: `${progress}%` }}
            transition={{ width: { duration: 0.3, ease: "easeOut" } }}
          />
          <motion.div
            className="absolute top-0 bottom-0 w-20 bg-gradient-to-r from-transparent via-white/30 to-transparent"
            initial={{ left: "-20%" }}
            animate={{ left: "120%" }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function PageProgress(props: PageProgressProps) {
  return (
    <React.Suspense fallback={null}>
      <PageProgressInner {...props} />
    </React.Suspense>
  )
}

// Loading spinner component
interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg" | "xl"
  className?: string
  text?: string
}

export function LoadingSpinner({
  size = "md",
  className,
  text,
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "w-5 h-5",
    md: "w-8 h-8",
    lg: "w-12 h-12",
    xl: "w-16 h-16",
  }

  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <div className={`relative ${sizeClasses[size]}`}>
        <div className="absolute inset-0 rounded-full border-2 border-[#333]" />
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#ffbb00]"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        />
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="w-2 h-2 bg-[#ffbb00] rounded-full" />
        </motion.div>
      </div>
      {text && (
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-gray-400">
          {text}
        </motion.p>
      )}
    </div>
  )
}

// Full page loading state
interface FullPageLoaderProps {
  text?: string
  subtext?: string
}

export function FullPageLoader({ text = "Loading...", subtext }: FullPageLoaderProps) {
  return (
    <div className="min-h-screen bg-[#141414] flex items-center justify-center">
      <div className="text-center">
        <LoadingSpinner size="xl" />
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-6 text-xl font-semibold text-white"
        >
          {text}
        </motion.h2>
        {subtext && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-2 text-gray-400"
          >
            {subtext}
          </motion.p>
        )}
      </div>
    </div>
  )
}

// Suspense fallback component
export function SuspenseFallback() {
  return (
    <div className="flex items-center justify-center min-h-[200px]">
      <LoadingSpinner text="Loading..." />
    </div>
  )
}
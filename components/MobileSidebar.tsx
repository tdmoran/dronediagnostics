"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { 
  LayoutDashboard, 
  MapPin, 
  Settings, 
  Activity,
  Battery,
  Radio,
  Wrench,
  Menu,
  X,
  FileText,
  Cpu,
  ChevronRight
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface SidebarItem {
  label: string
  href: string
  icon: React.ReactNode
}

const sidebarItems: SidebarItem[] = [
  {
    label: "Dashboard",
    href: "/",
    icon: <LayoutDashboard className="w-5 h-5" />,
  },
  {
    label: "Diagnose",
    href: "/diagnose",
    icon: <Wrench className="w-5 h-5" />,
  },
  {
    label: "GPS",
    href: "/gps",
    icon: <MapPin className="w-5 h-5" />,
  },
  {
    label: "Telemetry",
    href: "/telemetry",
    icon: <Activity className="w-5 h-5" />,
  },
  {
    label: "Battery",
    href: "/battery",
    icon: <Battery className="w-5 h-5" />,
  },
  {
    label: "Radio",
    href: "/radio",
    icon: <Radio className="w-5 h-5" />,
  },
  {
    label: "Blackbox",
    href: "/blackbox",
    icon: <FileText className="w-5 h-5" />,
  },
  {
    label: "Firmware",
    href: "/firmware",
    icon: <Cpu className="w-5 h-5" />,
  },
  {
    label: "Settings",
    href: "/settings",
    icon: <Settings className="w-5 h-5" />,
  },
]

interface MobileSidebarProps {
  className?: string
}

export function MobileSidebar({ className }: MobileSidebarProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const pathname = usePathname()

  // Close sidebar when route changes
  React.useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  // Prevent body scroll when sidebar is open
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = "unset"
    }
    return () => {
      document.body.style.overflow = "unset"
    }
  }, [isOpen])

  return (
    <>
      {/* Mobile Menu Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(true)}
        className={cn(
          "lg:hidden fixed top-4 left-4 z-40",
          "h-11 w-11 min-h-[44px] min-w-[44px]", // Touch-friendly size
          "bg-gray-900/80 backdrop-blur-sm border border-gray-800",
          "hover:bg-gray-800",
          className
        )}
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </Button>

      {/* Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar Drawer */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed top-0 left-0 bottom-0 w-[280px] bg-gray-950 z-50 lg:hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <h1 className="text-lg font-bold text-white flex items-center gap-2">
                <Activity className="w-6 h-6 text-blue-500" />
                DroneDiagnostics
              </h1>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                className="h-11 w-11 min-h-[44px] min-w-[44px] hover:bg-gray-800"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Navigation */}
            <nav className="p-4">
              <ul className="space-y-1">
                {sidebarItems.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
                  
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setIsOpen(false)}
                        className={cn(
                          "flex items-center justify-between gap-3 px-4 py-3.5 rounded-xl transition-colors",
                          "min-h-[48px]", // Touch-friendly
                          isActive 
                            ? "bg-blue-600 text-white" 
                            : "text-gray-400 hover:bg-gray-900 hover:text-white"
                        )}
                      >
                        <span className="flex items-center gap-3">
                          {item.icon}
                          <span className="font-medium">{item.label}</span>
                        </span>
                        {isActive && (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </nav>

            {/* Footer */}
            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-800">
              <div className="flex items-center gap-3 text-sm text-gray-400">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span>System Online</span>
              </div>
              <p className="text-xs text-gray-600 mt-2">v1.0.0</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

// Swipe indicator for mobile users
export function MobileSwipeHint() {
  const [visible, setVisible] = React.useState(true)

  React.useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 3000)
    return () => clearTimeout(timer)
  }, [])

  if (!visible) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 lg:hidden"
    >
      <div className="bg-gray-900/90 backdrop-blur-sm text-white text-xs px-4 py-2 rounded-full border border-gray-800 flex items-center gap-2">
        <Menu className="w-4 h-4" />
        <span>Tap to open menu</span>
      </div>
    </motion.div>
  )
}
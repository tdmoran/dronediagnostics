"use client"

import * as React from "react"
import { AlertTriangle, RefreshCw, Home, Bug } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error, errorInfo: null }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ error, errorInfo })
    
    // Log error to console
    console.error("Error caught by boundary:", error, errorInfo)
    
    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo)
    
    // Send error to analytics or logging service
    if (typeof window !== "undefined") {
      const errorEvent = new CustomEvent("app-error", {
        detail: {
          error: error.toString(),
          stack: error.stack,
          componentStack: errorInfo.componentStack,
          timestamp: new Date().toISOString(),
          url: window.location.href,
          userAgent: navigator.userAgent,
        },
      })
      window.dispatchEvent(errorEvent)
    }
  }

  handleReload = () => {
    window.location.reload()
  }

  handleGoHome = () => {
    window.location.href = "/"
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default error UI
      return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
          <Card className="max-w-lg w-full border-red-900/50 bg-gray-900">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-red-950/50 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
              <CardTitle className="text-xl text-white">Something went wrong</CardTitle>
              <CardDescription className="text-gray-400">
                We&apos;ve encountered an unexpected error. Don&apos;t worry, your drone data is safe.
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {/* Error details (collapsible) */}
              {this.state.error && (
                <details className="group">
                  <summary className="flex items-center gap-2 text-sm text-gray-500 cursor-pointer hover:text-gray-300 transition-colors">
                    <Bug className="w-4 h-4" />
                    <span>Error details</span>
                    <span className="ml-auto text-xs group-open:rotate-180 transition-transform">
                      ▼
                    </span>
                  </summary>
                  <div className="mt-3 p-3 bg-gray-950 rounded-lg border border-gray-800 overflow-auto">
                    <pre className="text-xs text-red-400 font-mono whitespace-pre-wrap break-all">
                      {this.state.error.toString()}
                    </pre>
                    {this.state.errorInfo && (
                      <pre className="text-xs text-gray-600 font-mono mt-2 whitespace-pre-wrap">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    )}
                  </div>
                </details>
              )}

              {/* Quick actions */}
              <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-800">
                <h4 className="text-sm font-medium text-white mb-2">Try these steps:</h4>
                <ul className="text-sm text-gray-400 space-y-1 list-disc list-inside">
                  <li>Reload the page to reset the application</li>
                  <li>Check your serial connection</li>
                  <li>Go back to the dashboard and try again</li>
                  <li>If the problem persists, contact support</li>
                </ul>
              </div>
            </CardContent>

            <CardFooter className="flex gap-3">
              <Button
                onClick={this.handleReload}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Reload Page
              </Button>
              <Button
                onClick={this.handleGoHome}
                variant="outline"
                className="flex-1 border-gray-700 hover:bg-gray-800"
              >
                <Home className="w-4 h-4 mr-2" />
                Go Home
              </Button>
            </CardFooter>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}

// Error boundary for specific sections/components
function SectionErrorBoundary({
  children,
  title = "Section Error",
  description = "This section encountered an error",
}: {
  children: React.ReactNode
  title?: string
  description?: string
}) {
  return (
    <ErrorBoundary
      fallback={
        <Card className="border-red-900/50 bg-gray-900">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-950/50 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <CardTitle className="text-lg text-white">{title}</CardTitle>
                <CardDescription className="text-gray-400">{description}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardFooter>
            <Button
              onClick={() => window.location.reload()}
              variant="outline"
              className="w-full border-gray-700 hover:bg-gray-800"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Reload Section
            </Button>
          </CardFooter>
        </Card>
      }
    >
      {children}
    </ErrorBoundary>
  )
}

// Hook to trigger error boundary from functional components
function useErrorBoundary() {
  const [error, setError] = React.useState<Error | null>(null)

  if (error) {
    throw error
  }

  return setError
}

export { ErrorBoundary, SectionErrorBoundary, useErrorBoundary }
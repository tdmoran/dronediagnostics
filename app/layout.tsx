import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/hooks/use-toast";
import { ToastContainer } from "@/components/ui/toast";
import { CommandPalette } from "@/components/CommandPalette";
import { MobileSidebar, MobileSwipeHint } from "@/components/MobileSidebar";
import { PageProgress } from "@/components/PageProgress";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppProviders } from "@/components/AppProviders";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "DroneDiagnostics - Betaflight Tools",
  description: "Blackbox log analysis and firmware management for Betaflight",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-950 text-white`}>
        <ErrorBoundary>
          <ToastProvider>
            <AppProviders>
              {/* Page loading progress bar */}
              <PageProgress color="bg-blue-500" height={3} />
              
              {/* Mobile navigation */}
              <MobileSidebar />
              <MobileSwipeHint />
              
              {/* Main layout */}
              <div className="flex min-h-screen">
                {/* Desktop sidebar - hidden on mobile */}
                <aside className="hidden lg:block w-64 bg-gray-900 border-r border-gray-800 min-h-screen fixed left-0 top-0">
                  <nav className="p-4">
                    <div className="mb-6 px-4">
                      <h1 className="text-xl font-bold flex items-center gap-2">
                        <span className="text-blue-500">🚁</span>
                        DroneDiagnostics
                      </h1>
                    </div>
                    <ul className="space-y-1">
                      <li>
                        <a href="/" className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-colors">
                          <span>🏠</span> Dashboard
                        </a>
                      </li>
                      <li>
                        <a href="/diagnose" className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-colors">
                          <span>🔧</span> Diagnose
                        </a>
                      </li>
                      <li>
                        <a href="/gps" className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-colors">
                          <span>📍</span> GPS
                        </a>
                      </li>
                      <li>
                        <a href="/telemetry" className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-colors">
                          <span>📊</span> Telemetry
                        </a>
                      </li>
                      <li>
                        <a href="/battery" className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-colors">
                          <span>🔋</span> Battery
                        </a>
                      </li>
                      <li>
                        <a href="/radio" className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-colors">
                          <span>📡</span> Radio
                        </a>
                      </li>
                      <li>
                        <a href="/blackbox" className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-colors">
                          <span>📁</span> Blackbox
                        </a>
                      </li>
                      <li>
                        <a href="/firmware" className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-colors">
                          <span>⚙️</span> Firmware
                        </a>
                      </li>
                      <li>
                        <a href="/config" className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-colors">
                          <span>🔩</span> Config
                        </a>
                      </li>
                      <li>
                        <a href="/settings" className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-colors">
                          <span>🎛️</span> Settings
                        </a>
                      </li>
                    </ul>
                  </nav>
                </aside>

                {/* Main content */}
                <main className="flex-1 lg:ml-64 p-4 lg:p-6">
                  {children}
                </main>
              </div>
              
              {/* Toast notifications */}
              <ToastContainer toasts={[]} position="bottom-right" />
              
              {/* Command palette is rendered inside AppProviders */}
            </AppProviders>
          </ToastProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}

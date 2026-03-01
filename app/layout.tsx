import type { Metadata } from "next";
import { Open_Sans } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/hooks/use-toast";
import { ToastContainer } from "@/components/ui/toast";
import { CommandPalette } from "@/components/CommandPalette";
import { MobileSidebar, MobileSwipeHint } from "@/components/MobileSidebar";
import { PageProgress } from "@/components/PageProgress";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { DesktopSidebar } from "@/components/DesktopSidebar";
import { AppProviders } from "@/components/AppProviders";
import { TelemetryProvider } from "@/components/TelemetryProvider";
import { TopBar } from "@/components/TopBar";

const openSans = Open_Sans({ subsets: ["latin"], weight: ["400", "600", "700"] });

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
      <body className={`${openSans.className} bg-[#141414] text-[#f2f2f2]`}>
        <ErrorBoundary>
          <ToastProvider>
            <AppProviders>
              <TelemetryProvider>
                {/* Page loading progress bar */}
                <PageProgress color="bg-[#ffbb00]" height={3} />

                {/* Mobile navigation */}
                <MobileSidebar />
                <MobileSwipeHint />

                {/* Main layout */}
                <div className="flex min-h-screen">
                  {/* Desktop sidebar - hidden on mobile */}
                  <DesktopSidebar />

                  {/* Content area with top bar */}
                  <div className="flex-1 min-w-0 flex flex-col">
                    <TopBar />
                    <main className="flex-1 min-w-0">
                      {children}
                    </main>
                  </div>
                </div>

                {/* Toast notifications */}
                <ToastContainer toasts={[]} position="bottom-right" />
              </TelemetryProvider>

              {/* Command palette is rendered inside AppProviders */}
            </AppProviders>
          </ToastProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}

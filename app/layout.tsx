import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

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
      <body className={inter.className}>
        <nav className="navbar">
          <div className="nav-brand">
            <span className="nav-icon">🚁</span>
            <span>DroneDiagnostics</span>
          </div>
          <div className="nav-links">
            <a href="/">Home</a>
            <a href="/blackbox">Blackbox</a>
            <a href="/firmware">Firmware</a>
            <a href="/config">Config</a>
          </div>
        </nav>
        <main className="main-content">
          {children}
        </main>
      </body>
    </html>
  );
}

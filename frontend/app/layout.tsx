import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ETL QA Agent",
  description: "Agente QA autonomo per ETL BigQuery",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div className="min-h-screen flex flex-col">
          <header
            className="h-14 border-b border-border sticky top-0 z-20"
            style={{
              background: "var(--blur-bg)",
              backdropFilter: "saturate(180%) blur(12px)",
              WebkitBackdropFilter: "saturate(180%) blur(12px)",
            }}
          >
            <div className="h-full max-w-[1280px] mx-auto px-6 flex items-center justify-between">
              <a href="/" className="group flex items-center gap-2.5 font-semibold tracking-tight text-[14px]">
                <span className="relative inline-flex items-center justify-center w-6 h-6 rounded-md bg-fg text-bg shadow-sm overflow-hidden">
                  <span className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-white/20" />
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 relative" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 7h16" />
                    <path d="M4 12h10" />
                    <path d="M4 17h16" />
                    <circle cx="18" cy="12" r="2.5" fill="currentColor" />
                  </svg>
                </span>
                <span>
                  ETL QA
                  <span className="ml-1.5 text-2xs font-mono font-normal text-fg-subtle align-middle">Agent</span>
                </span>
              </a>
              <div className="flex items-center gap-2 text-2xs font-mono text-fg-subtle">
                <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-border bg-bg-elevated/60">
                  <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                  vertex-ai
                </span>
                <span className="hidden sm:inline">gemini-2.5-pro</span>
              </div>
            </div>
          </header>
          <main className="flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ACN Tester Agent",
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
          <header className="h-12 border-b border-border bg-bg sticky top-0 z-10">
            <div className="h-full max-w-[1280px] mx-auto px-6 flex items-center justify-between">
              <a href="/" className="flex items-center gap-2 font-semibold tracking-tight text-[14px]">
                <span className="inline-block w-[14px] h-[14px] border border-fg bg-fg" />
                ACN Tester Agent
              </a>
              <div className="text-2xs font-mono text-fg-subtle">
                vertex-ai
              </div>
            </div>
          </header>
          <main className="flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}

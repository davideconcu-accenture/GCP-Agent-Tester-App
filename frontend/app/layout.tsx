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
          <header className="h-14 border-b border-border bg-bg/70 backdrop-blur-xl backdrop-saturate-150 sticky top-0 z-20 shadow-elev-sm">
            <div className="h-full max-w-[1280px] mx-auto px-6 flex items-center justify-between">
              <a
                href="/"
                className="flex items-center gap-2.5 font-semibold tracking-tight text-[14px] group"
              >
                <span
                  className="inline-grid place-items-center w-7 h-7 font-bold text-[22px] leading-none transition-all duration-300 ease-out-soft group-hover:scale-110"
                  style={{ color: "var(--acn-purple)", letterSpacing: "-0.05em" }}
                  aria-hidden
                >
                  &gt;
                </span>
                <span>ACN Tester Agent</span>
              </a>
              <div className="text-2xs font-mono text-fg-subtle uppercase tracking-wider">
                vertex&nbsp;ai
              </div>
            </div>
          </header>
          <main className="flex-1 animate-fade">{children}</main>
        </div>
      </body>
    </html>
  );
}

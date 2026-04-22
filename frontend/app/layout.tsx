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
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div className="min-h-screen flex flex-col">
          <header className="border-b border-border px-6 py-4 flex items-center justify-between">
            <a href="/" className="flex items-center gap-2 font-semibold text-text hover:opacity-80">
              <span className="w-2 h-2 rounded-full bg-accent" />
              ETL QA Agent
            </a>
            <div className="text-xs text-muted">Gemini 2.5 Pro · Vertex AI · BigQuery</div>
          </header>
          <main className="flex-1 flex flex-col">{children}</main>
        </div>
      </body>
    </html>
  );
}

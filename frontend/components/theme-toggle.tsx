"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Theme = "light" | "dark";

function getInitialTheme(): Theme {
  if (typeof document === "undefined") return "light";
  const attr = document.documentElement.getAttribute("data-theme");
  return attr === "dark" ? "dark" : "light";
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setTheme(getInitialTheme());
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("acn-theme", next);
    } catch {
      /* ignore */
    }
  }

  // Evita flash: non rendere finché il client non è pronto.
  if (!mounted) {
    return (
      <button
        aria-hidden
        tabIndex={-1}
        className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-border bg-bg-elev opacity-0"
      />
    );
  }

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      title={isDark ? "Passa al tema chiaro" : "Passa al tema scuro"}
      aria-label={isDark ? "Passa al tema chiaro" : "Passa al tema scuro"}
      className={cn(
        "h-7 w-7 inline-flex items-center justify-center rounded-md",
        "border border-border bg-bg-elev text-fg-muted shadow-elev-sm",
        "btn-press hover:text-accent hover:border-border-strong hover:shadow-elev-md",
        "transition-colors duration-200",
      )}
    >
      {isDark ? (
        // Sole — visibile in tema scuro per indicare "passa a chiaro"
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2" />
          <path d="M12 20v2" />
          <path d="m4.93 4.93 1.41 1.41" />
          <path d="m17.66 17.66 1.41 1.41" />
          <path d="M2 12h2" />
          <path d="M20 12h2" />
          <path d="m6.34 17.66-1.41 1.41" />
          <path d="m19.07 4.93-1.41 1.41" />
        </svg>
      ) : (
        // Luna — visibile in tema chiaro per indicare "passa a scuro"
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}

import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        "bg-subtle": "var(--bg-subtle)",
        "bg-elev": "var(--bg-elev)",
        border: "var(--border)",
        "border-strong": "var(--border-strong)",
        fg: "var(--fg)",
        "fg-muted": "var(--fg-muted)",
        "fg-subtle": "var(--fg-subtle)",
        accent: "var(--accent)",
        "accent-fg": "var(--accent-fg)",
        "accent-soft": "var(--accent-soft)",
        "accent-ring": "var(--accent-ring)",
        success: "var(--success)",
        danger: "var(--danger)",
        warning: "var(--warning)",
      },
      fontFamily: {
        sans: ["Geist", "Inter", "system-ui", "sans-serif"],
        mono: ["Geist Mono", "ui-monospace", "monospace"],
      },
      fontSize: {
        "2xs": ["11px", { lineHeight: "14px" }],
      },
      borderRadius: {
        DEFAULT: "6px",
      },
      boxShadow: {
        "elev-sm":   "var(--shadow-sm)",
        "elev-md":   "var(--shadow-md)",
        "elev-lg":   "var(--shadow-lg)",
        "elev-xl":   "var(--shadow-xl)",
        "elev-glow": "var(--shadow-glow)",
      },
      transitionTimingFunction: {
        "out-soft": "cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
};

export default config;

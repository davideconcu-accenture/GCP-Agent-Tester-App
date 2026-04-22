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
        bg: "#0a0b0d",
        surface: "#111215",
        surface2: "#16181c",
        surface3: "#1c1f24",
        border: "rgba(255,255,255,0.08)",
        border2: "rgba(255,255,255,0.14)",
        muted: "#8a8f98",
        text: "#f5f5f7",
        accent: "#6b8afd",
        ok: "#34d399",
        warn: "#fbbf24",
        err: "#f87171",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;

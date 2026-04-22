import type { NextConfig } from "next";

// Static export: il bundle finisce in /out e viene servito dal backend FastAPI in prod.
// In dev il frontend parla direttamente con http://localhost:8080 (vedi lib/api.ts).
const config: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
};

export default config;

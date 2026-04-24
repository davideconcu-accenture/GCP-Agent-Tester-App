import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTs(ts?: number | string | null): string {
  if (!ts) return "";
  const d = typeof ts === "number" ? new Date(ts * 1000) : new Date(ts);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("it-IT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function relativeTs(ts?: number | string | null): string {
  if (!ts) return "";
  const d = typeof ts === "number" ? new Date(ts * 1000) : new Date(ts);
  const ms = Date.now() - d.getTime();
  if (isNaN(ms)) return "";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s fa`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m fa`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h fa`;
  return formatTs(ts);
}

export type UIStatus = "pending" | "running" | "completed" | "failed" | "cancelled" | string;

export function statusDot(s: UIStatus): "neutral" | "running" | "success" | "danger" | "warning" {
  if (s === "running") return "running";
  if (s === "completed") return "success";
  if (s === "failed") return "danger";
  if (s === "cancelled") return "warning";
  return "neutral";
}

export function statusLabel(status?: UIStatus): string {
  return {
    running: "In esecuzione",
    completed: "Completato",
    failed: "Fallito",
    cancelled: "Interrotto",
    pending: "In coda",
  }[status || ""] || status || "—";
}

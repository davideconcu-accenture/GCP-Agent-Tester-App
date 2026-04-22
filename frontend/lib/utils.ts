import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTs(ts?: number | string): string {
  if (!ts) return "";
  const d = typeof ts === "number" ? new Date(ts * 1000) : new Date(ts);
  return d.toLocaleString("it-IT", { hour12: false });
}

export function statusColor(status?: string): string {
  switch (status) {
    case "running": return "bg-accent/20 text-accent border-accent/40";
    case "completed": return "bg-ok/20 text-ok border-ok/40";
    case "failed": return "bg-err/20 text-err border-err/40";
    case "pending": return "bg-muted/20 text-muted border-muted/40";
    default: return "bg-muted/20 text-muted border-muted/40";
  }
}

export function statusLabel(status?: string): string {
  return {
    running: "In esecuzione",
    completed: "Completato",
    failed: "Fallito",
    pending: "In attesa",
  }[status || ""] || status || "—";
}

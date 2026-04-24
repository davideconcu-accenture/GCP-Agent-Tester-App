// Thin API client.
// In dev il frontend gira su :3000 e il backend su :8080.
// In prod il backend serve anche il frontend, quindi stesso origin.

export const API_BASE =
  typeof window !== "undefined" && window.location.port === "3000"
    ? "http://localhost:8080"
    : "";

export type RunEvent =
  | { type: "status"; status: string; summary?: string | null; ts?: number }
  | { type: "agent_text"; text: string; final?: boolean; ts?: number }
  | { type: "tool_call"; name: string; args: Record<string, unknown>; ts?: number }
  | { type: "tool_response"; name: string; preview: string; ts?: number }
  | { type: "tool_start"; name: string; purpose?: string; ts?: number }
  | { type: "tool_end"; name: string; ts?: number; [k: string]: unknown }
  | { type: "artifact"; kind: ArtifactKind; data: any; ts?: number }
  | { type: "error"; message: string; trace?: string; ts?: number };

export type ArtifactKind =
  | "test_plan"
  | "test_results"
  | "fix_proposal"
  | "pr_opened"
  | "final_report";

export interface RunSummary {
  id: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  request: string;
  etl_hint?: string | null;
  model?: string | null;
  summary?: string | null;
  created_at?: any;
  updated_at?: any;
}

export const GEMINI_MODELS: { value: string; label: string }[] = [
  { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro (più accurato)" },
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash (più veloce)" },
  { value: "gemini-2.0-flash-001", label: "Gemini 2.0 Flash" },
  { value: "gemini-2.0-flash-lite-001", label: "Gemini 2.0 Flash Lite" },
];
export const DEFAULT_GEMINI_MODEL = "gemini-2.5-pro";

export interface RunDetail extends RunSummary {
  events: RunEvent[];
  artifacts: Partial<Record<ArtifactKind, any>>;
}

export async function listEtls(): Promise<{ etls: string[] }> {
  const r = await fetch(`${API_BASE}/api/etls`);
  if (!r.ok) throw new Error(`GET /api/etls ${r.status}`);
  return r.json();
}

export async function listRuns(): Promise<{ runs: RunSummary[] }> {
  const r = await fetch(`${API_BASE}/api/runs`);
  if (!r.ok) throw new Error(`GET /api/runs ${r.status}`);
  return r.json();
}

export async function getRun(id: string): Promise<RunDetail> {
  const r = await fetch(`${API_BASE}/api/runs/${id}`);
  if (!r.ok) throw new Error(`GET /api/runs/${id} ${r.status}`);
  return r.json();
}

export async function createRun(
  request: string,
  etl?: string,
  model?: string,
): Promise<{ run_id: string }> {
  const r = await fetch(`${API_BASE}/api/runs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ request, etl: etl || null, model: model || null }),
  });
  if (!r.ok) throw new Error(`POST /api/runs ${r.status}`);
  return r.json();
}

export async function deleteRun(id: string): Promise<void> {
  const r = await fetch(`${API_BASE}/api/runs/${id}`, { method: "DELETE" });
  if (!r.ok && r.status !== 404) {
    throw new Error(`DELETE /api/runs/${id} ${r.status}`);
  }
}

export async function stopRun(id: string): Promise<void> {
  const r = await fetch(`${API_BASE}/api/runs/${id}/stop`, { method: "POST" });
  if (!r.ok) {
    throw new Error(`POST /api/runs/${id}/stop ${r.status}`);
  }
}

export function streamRun(
  id: string,
  onEvent: (ev: RunEvent) => void,
  onClose?: () => void,
): () => void {
  const es = new EventSource(`${API_BASE}/api/runs/${id}/stream`);
  es.onmessage = (e) => {
    try {
      onEvent(JSON.parse(e.data));
    } catch {
      /* ignora messaggi malformati */
    }
  };
  es.onerror = () => {
    es.close();
    onClose?.();
  };
  return () => es.close();
}

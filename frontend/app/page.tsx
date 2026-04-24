"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Input,
  Label,
  Select,
  Textarea,
  Dot,
  Badge,
} from "@/components/ui";
import {
  createRun,
  deleteRun,
  listEtls,
  listRuns,
  type RunSummary,
  GEMINI_MODELS,
  DEFAULT_GEMINI_MODEL,
} from "@/lib/api";
import { cn, relativeTs, statusDot, statusLabel } from "@/lib/utils";

export default function HomePage() {
  const router = useRouter();
  const [etls, setEtls] = useState<string[]>([]);
  const [runs, setRuns] = useState<RunSummary[] | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [deleting, setDeleting] = useState<Set<string>>(new Set());

  async function refresh() {
    try {
      const { runs } = await listRuns();
      setRuns(runs);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    listEtls().then(({ etls }) => setEtls(etls)).catch(() => setEtls([]));
    refresh();
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, []);

  async function handleDelete(id: string) {
    if (!confirm("Eliminare definitivamente questa richiesta?")) return;
    setDeleting((prev) => new Set(prev).add(id));
    // Optimistic UI update.
    setRuns((prev) => (prev ? prev.filter((r) => r.id !== id) : prev));
    try {
      await deleteRun(id);
    } catch {
      // Se fallisce, ricarica la lista.
      refresh();
    } finally {
      setDeleting((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  return (
    <div className="max-w-[1280px] mx-auto px-6 py-10 w-full">
      {/* Heading */}
      <div className="flex items-end justify-between mb-8 gap-4">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight leading-tight">Storico Richieste</h1>
          <p className="text-[13px] text-fg-muted mt-1">
            Storico delle analisi eseguite dall'agente.
          </p>
        </div>
        <Button onClick={() => setSheetOpen(true)} size="md">
          Nuova Richiesta
          <kbd className="ml-1 text-2xs font-mono opacity-60">N</kbd>
        </Button>
      </div>

      {/* Table */}
      <RunsTable runs={runs} onDelete={handleDelete} deleting={deleting} />

      {/* Sheet nuovo run */}
      {sheetOpen && (
        <NewRunSheet
          etls={etls}
          onClose={() => setSheetOpen(false)}
          onCreated={(id) => router.push(`/run?id=${id}`)}
        />
      )}

      {/* Shortcut N per aprire il sheet */}
      <ShortcutListener
        onOpen={() => setSheetOpen(true)}
        disabled={sheetOpen}
      />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────

function RunsTable({
  runs,
  onDelete,
  deleting,
}: {
  runs: RunSummary[] | null;
  onDelete: (id: string) => void;
  deleting: Set<string>;
}) {
  if (runs === null) {
    return (
      <div className="border border-border rounded overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-[52px] border-b border-border last:border-b-0 bg-bg-subtle animate-pulse" />
        ))}
      </div>
    );
  }

  if (runs.length === 0) {
    return (
      <div className="border border-border rounded py-16 text-center">
        <div className="text-[14px] font-medium text-fg">Nessuna richiesta ancora</div>
        <div className="text-[13px] text-fg-muted mt-1">Premi N o clicca "Nuova Richiesta" per iniziare.</div>
      </div>
    );
  }

  return (
    <div className="border border-border rounded overflow-hidden">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="bg-bg-subtle border-b border-border text-2xs font-mono uppercase tracking-wider text-fg-subtle">
            <th className="text-left font-normal px-4 py-2 w-[110px]">Stato</th>
            <th className="text-left font-normal px-4 py-2">Richiesta</th>
            <th className="text-left font-normal px-4 py-2 w-[180px]">ETL</th>
            <th className="text-left font-normal px-4 py-2 w-[120px]">Quando</th>
            <th className="text-right font-normal px-4 py-2 w-[56px]"></th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => (
            <tr
              key={r.id}
              className={cn(
                "border-b border-border last:border-b-0 hover:bg-bg-subtle cursor-pointer transition-colors group",
                deleting.has(r.id) && "opacity-40",
              )}
              onClick={() => (window.location.href = `/run?id=${r.id}`)}
            >
              <td className="px-4 py-3">
                <span className="inline-flex items-center gap-1.5 text-[13px]">
                  <Dot variant={statusDot(r.status)} pulse={r.status === "running"} />
                  <span className="text-fg">{statusLabel(r.status)}</span>
                </span>
              </td>
              <td className="px-4 py-3 text-fg truncate max-w-0">
                <div className="truncate">{r.request}</div>
              </td>
              <td className="px-4 py-3 text-fg-muted font-mono text-2xs">
                {r.etl_hint || "—"}
              </td>
              <td className="px-4 py-3 text-fg-muted text-2xs">
                {relativeTs(r.created_at as any)}
              </td>
              <td className="px-2 py-3 text-right">
                <button
                  aria-label="Elimina"
                  title="Elimina questa richiesta"
                  disabled={deleting.has(r.id)}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(r.id);
                  }}
                  className="h-7 w-7 inline-flex items-center justify-center rounded text-fg-subtle opacity-0 group-hover:opacity-100 hover:bg-danger/10 hover:text-danger transition-all disabled:opacity-30"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18" />
                    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    <path d="M10 11v6" />
                    <path d="M14 11v6" />
                  </svg>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────

function NewRunSheet({
  etls,
  onClose,
  onCreated,
}: {
  etls: string[];
  onClose: () => void;
  onCreated: (runId: string) => void;
}) {
  const [etl, setEtl] = useState("");
  const [model, setModel] = useState<string>(DEFAULT_GEMINI_MODEL);
  const [request, setRequest] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        document.getElementById("submit-run")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit() {
    if (!request.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const { run_id } = await createRun(request.trim(), etl || undefined, model || undefined);
      onCreated(run_id);
    } catch (e: any) {
      setError(e.message || "Errore nella creazione del run");
      setSubmitting(false);
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/55 backdrop-blur-[2px] z-40 animate-rise"
        onClick={onClose}
        style={{ animationDuration: "120ms" }}
      />
      <div className="fixed top-0 right-0 bottom-0 w-full sm:w-[480px] bg-bg border-l border-border z-50 flex flex-col animate-rise shadow-2xl">
        <div className="h-12 px-5 flex items-center justify-between border-b border-border">
          <h2 className="text-[14px] font-semibold tracking-tight">Nuova Richiesta</h2>
          <button
            onClick={onClose}
            className="text-fg-subtle hover:text-fg text-[18px] leading-none"
            aria-label="Chiudi"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div>
            <Label htmlFor="etl">ETL (opzionale)</Label>
            <Select id="etl" value={etl} onChange={(e) => setEtl(e.target.value)}>
              <option value="">— scegli o lascia decidere all'agente —</option>
              {etls.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </Select>
            <p className="text-2xs text-fg-subtle mt-1.5">
              Se non selezioni nulla, l'agente scandirà il repo e sceglierà l'ETL più pertinente.
            </p>
          </div>

          <div>
            <Label htmlFor="model">Modello Gemini</Label>
            <Select id="model" value={model} onChange={(e) => setModel(e.target.value)}>
              {GEMINI_MODELS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </Select>
            <p className="text-2xs text-fg-subtle mt-1.5">
              Pro è più preciso ma più lento. Flash è più rapido, utile per richieste semplici.
            </p>
          </div>

          <div>
            <Label htmlFor="request">Descrizione</Label>
            <Textarea
              id="request"
              rows={10}
              autoFocus
              value={request}
              onChange={(e) => setRequest(e.target.value)}
              placeholder={"Es: I saldi dei conti correnti risultano incoerenti dopo l'ultimo run.\n\nVerifica l'ETL saldi_correnti e confrontali con i movimenti."}
            />
          </div>

          {error && (
            <div className="text-[12px] text-danger border border-danger/30 bg-danger/5 rounded px-2.5 py-2">
              {error}
            </div>
          )}
        </div>

        <div className="h-14 px-5 border-t border-border flex items-center justify-between bg-bg-subtle">
          <div className="text-2xs font-mono text-fg-subtle">
            <kbd className="px-1 py-0.5 border border-border rounded">Esc</kbd>
            <span className="mx-1">chiudi</span>
            <kbd className="ml-2 px-1 py-0.5 border border-border rounded">⌘↵</kbd>
            <span className="ml-1">avvia</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose}>Annulla</Button>
            <Button id="submit-run" onClick={submit} disabled={!request.trim() || submitting}>
              {submitting ? "Avvio…" : "Avvia analisi"}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

function ShortcutListener({ onOpen, disabled }: { onOpen: () => void; disabled: boolean }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (disabled) return;
      if ((e.key === "n" || e.key === "N") && !e.metaKey && !e.ctrlKey) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        e.preventDefault();
        onOpen();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onOpen, disabled]);
  return null;
}

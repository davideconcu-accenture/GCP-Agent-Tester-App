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
  Kbd,
} from "@/components/ui";
import {
  createRun,
  listEtls,
  listModels,
  listRuns,
  type ModelInfo,
  type RunSummary,
} from "@/lib/api";
import { cn, relativeTs, statusDot, statusLabel } from "@/lib/utils";

export default function HomePage() {
  const router = useRouter();
  const [etls, setEtls] = useState<string[]>([]);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [defaultModel, setDefaultModel] = useState<string>("");
  const [runs, setRuns] = useState<RunSummary[] | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

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
    listModels()
      .then(({ models, default: def }) => {
        setModels(models);
        setDefaultModel(def);
      })
      .catch(() => {
        setModels([]);
        setDefaultModel("");
      });
    refresh();
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="max-w-[1280px] mx-auto px-6 py-12 w-full">
      {/* Heading */}
      <div className="flex items-end justify-between mb-8 gap-4">
        <div>
          <div className="flex items-center gap-2 text-2xs font-mono text-fg-subtle mb-2 uppercase tracking-wider">
            <span className="w-6 h-px bg-fg-subtle/40" />
            Dashboard
          </div>
          <h1 className="text-[32px] font-semibold tracking-tight leading-tight">Segnalazioni</h1>
          <p className="text-[14px] text-fg-muted mt-1.5">
            Storico delle analisi eseguite dall'agente QA.
          </p>
        </div>
        <Button onClick={() => setSheetOpen(true)} size="md">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="w-3.5 h-3.5">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Nuova segnalazione
          <Kbd className="ml-1 bg-white/10 border-white/20 text-accent-fg">N</Kbd>
        </Button>
      </div>

      {/* Table */}
      <RunsTable runs={runs} />

      {/* Sheet nuovo run */}
      {sheetOpen && (
        <NewRunSheet
          etls={etls}
          models={models}
          defaultModel={defaultModel}
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

function RunsTable({ runs }: { runs: RunSummary[] | null }) {
  if (runs === null) {
    return (
      <div className="border border-border rounded-lg overflow-hidden bg-bg-elevated shadow-sm">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-[56px] border-b border-border last:border-b-0 bg-bg-subtle/50 animate-pulse" />
        ))}
      </div>
    );
  }

  if (runs.length === 0) {
    return (
      <div className="border border-border rounded-lg bg-bg-elevated shadow-sm py-20 text-center">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-bg-subtle border border-border mb-4">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5 text-fg-subtle">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <div className="text-[15px] font-medium text-fg">Nessun run ancora</div>
        <div className="text-[13px] text-fg-muted mt-1.5">
          Premi <Kbd>N</Kbd> o clicca <span className="text-fg">Nuova segnalazione</span> per iniziare.
        </div>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-bg-elevated shadow-sm">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="bg-bg-subtle/60 border-b border-border text-2xs font-mono uppercase tracking-wider text-fg-subtle">
            <th className="text-left font-medium px-4 py-2.5 w-[130px]">Stato</th>
            <th className="text-left font-medium px-4 py-2.5">Richiesta</th>
            <th className="text-left font-medium px-4 py-2.5 w-[200px]">ETL</th>
            <th className="text-left font-medium px-4 py-2.5 w-[120px]">Quando</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => (
            <tr
              key={r.id}
              className="border-b border-border last:border-b-0 hover:bg-bg-subtle/60 cursor-pointer transition-colors group"
              onClick={() => (window.location.href = `/run?id=${r.id}`)}
            >
              <td className="px-4 py-3.5">
                <span className="inline-flex items-center gap-2 text-[13px]">
                  <Dot variant={statusDot(r.status)} pulse={r.status === "running"} />
                  <span className="text-fg font-medium">{statusLabel(r.status)}</span>
                </span>
              </td>
              <td className="px-4 py-3.5 text-fg truncate max-w-0">
                <div className="truncate group-hover:text-fg">{r.request}</div>
              </td>
              <td className="px-4 py-3.5 text-fg-muted font-mono text-2xs">
                {r.etl_hint ? (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-bg-subtle border border-border">
                    {r.etl_hint}
                  </span>
                ) : "—"}
              </td>
              <td className="px-4 py-3.5 text-fg-muted text-2xs font-mono">
                {relativeTs(r.created_at as any)}
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
  models,
  defaultModel,
  onClose,
  onCreated,
}: {
  etls: string[];
  models: ModelInfo[];
  defaultModel: string;
  onClose: () => void;
  onCreated: (runId: string) => void;
}) {
  const [etl, setEtl] = useState("");
  const [model, setModel] = useState<string>(defaultModel);
  const [request, setRequest] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Se il default arriva dopo il mount, aggiorniamo la selezione.
  useEffect(() => {
    if (defaultModel && !model) setModel(defaultModel);
  }, [defaultModel, model]);

  const selectedModelInfo = models.find((m) => m.id === model);

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
      const { run_id } = await createRun(
        request.trim(),
        etl || undefined,
        model || undefined,
      );
      onCreated(run_id);
    } catch (e: any) {
      setError(e.message || "Errore nella creazione del run");
      setSubmitting(false);
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-fg/20 backdrop-blur-[2px] z-40 animate-rise"
        onClick={onClose}
        style={{ animationDuration: "180ms" }}
      />
      <div className="fixed top-0 right-0 bottom-0 w-full sm:w-[500px] bg-bg-elevated border-l border-border z-50 flex flex-col animate-rise shadow-lg">
        <div className="h-14 px-5 flex items-center justify-between border-b border-border">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex w-6 h-6 rounded-md bg-accent items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="w-3.5 h-3.5 text-accent-fg">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </span>
            <h2 className="text-[14px] font-semibold tracking-tight">Nuova segnalazione</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-md flex items-center justify-center text-fg-subtle hover:text-fg hover:bg-bg-subtle transition-colors"
            aria-label="Chiudi"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-4 h-4">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div>
            <Label htmlFor="model">Modello</Label>
            <Select id="model" value={model} onChange={(e) => setModel(e.target.value)}>
              {models.length === 0 && <option value="">— default —</option>}
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}{m.id === defaultModel ? "  (default)" : ""}
                </option>
              ))}
            </Select>
            {selectedModelInfo && (
              <div className="mt-2 flex items-start gap-2">
                <Badge variant={
                  selectedModelInfo.tier === "pro" ? "warning" :
                  selectedModelInfo.tier === "fast" ? "info" :
                  "success"
                }>
                  {selectedModelInfo.tier}
                </Badge>
                <p className="text-2xs text-fg-subtle leading-relaxed flex-1 pt-0.5">
                  {selectedModelInfo.desc}
                </p>
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="etl">ETL (opzionale)</Label>
            <Select id="etl" value={etl} onChange={(e) => setEtl(e.target.value)}>
              <option value="">— scegli o lascia decidere all'agente —</option>
              {etls.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </Select>
            <p className="text-2xs text-fg-subtle mt-2 leading-relaxed">
              Se non selezioni nulla, l'agente scandirà il repo e sceglierà l'ETL più pertinente.
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
            <div className="text-[12px] text-danger border border-danger/30 bg-danger-soft rounded-md px-3 py-2.5 flex items-start gap-2">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 shrink-0 mt-0.5">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4M12 16h.01" />
              </svg>
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="h-16 px-5 border-t border-border flex items-center justify-between bg-bg-subtle/50">
          <div className="text-2xs font-mono text-fg-subtle flex items-center gap-1.5">
            <Kbd>Esc</Kbd>
            <span>chiudi</span>
            <span className="mx-1.5 text-fg-subtle/50">·</span>
            <Kbd>⌘↵</Kbd>
            <span>avvia</span>
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

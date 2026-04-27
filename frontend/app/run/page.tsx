"use client";

import { Fragment, useEffect, useMemo, useState, Suspense, useRef } from "react";
import { useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Badge, Dot, KeyValue, Section, Button } from "@/components/ui";
import {
  getRun,
  streamRun,
  stopRun,
  type RunDetail,
  type RunEvent,
  type ArtifactKind,
} from "@/lib/api";
import { cn, formatTs, relativeTs, statusDot, statusLabel } from "@/lib/utils";

export default function Page() {
  return (
    <Suspense fallback={<div className="px-6 py-10 text-fg-muted text-[13px]">Caricamento…</div>}>
      <RunView />
    </Suspense>
  );
}

function RunView() {
  const sp = useSearchParams();
  const id = sp.get("id") || "";
  const [run, setRun] = useState<RunDetail | null>(null);
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [artifacts, setArtifacts] = useState<RunDetail["artifacts"]>({});
  const [status, setStatus] = useState<string>("pending");
  const [summary, setSummary] = useState<string | null>(null);
  const [tab, setTab] = useState<"stream" | "results" | "fix" | "report">("stream");
  const [stopping, setStopping] = useState(false);

  const canStop = status === "running" || status === "pending";

  async function handleStop() {
    if (!id || !canStop || stopping) return;
    if (!window.confirm("Interrompere l'esecuzione del run? L'operazione non può essere annullata.")) return;
    setStopping(true);
    try {
      await stopRun(id);
      // Lo status viene aggiornato via SSE, ma diamo un feedback subito.
    } catch (e) {
      // Ripristina lo stato del pulsante se la richiesta fallisce.
      setStopping(false);
      alert("Impossibile interrompere il run: " + (e as Error).message);
    }
  }

  // Se il run cambia stato (via SSE), resetta il loading del pulsante.
  useEffect(() => {
    if (!canStop) setStopping(false);
  }, [canStop]);

  useEffect(() => {
    if (!id) return;
    let unsub: (() => void) | null = null;
    let alive = true;

    getRun(id).then((r) => {
      if (!alive) return;
      setRun(r);
      setEvents(r.events || []);
      setArtifacts(r.artifacts || {});
      setStatus(r.status);
      setSummary(r.summary || null);

      const seen = (r.events || []).length;
      let i = 0;
      unsub = streamRun(id, (ev) => {
        if (i++ < seen) return;
        apply(ev);
      });
    }).catch(() => {});

    function apply(ev: RunEvent) {
      if (ev.type === "status") {
        setStatus(ev.status);
        if (ev.summary !== undefined) setSummary(ev.summary ?? null);
        return;
      }
      if (ev.type === "artifact") {
        setArtifacts((a) => ({ ...a, [ev.kind]: ev.data }));
        return;
      }
      setEvents((e) => [...e, ev]);
    }

    return () => { alive = false; unsub?.(); };
  }, [id]);

  // Switch automatico al tab giusto quando arriva un artefatto rilevante.
  // Usiamo un ref così scatta una sola volta: se l'utente torna su Stream
  // dopo la fine del run, resta lì.
  const didAutoSwitchRef = useRef(false);
  useEffect(() => {
    if (didAutoSwitchRef.current) return;
    if (artifacts.test_results && tab === "stream" && status === "completed") {
      didAutoSwitchRef.current = true;
      setTab("results");
    }
  }, [artifacts.test_results, status, tab]);

  const counts = useMemo(() => {
    const r: any[] = (artifacts.test_results as any)?.results || [];
    return r.reduce((a: Record<string, number>, x: any) => {
      a[x.status] = (a[x.status] || 0) + 1;
      return a;
    }, {});
  }, [artifacts.test_results]);

  if (!id) {
    return <div className="px-6 py-10 text-fg-muted text-[13px]">ID run mancante.</div>;
  }

  return (
    <div className="w-full">
      {/* Hero */}
      <div className="px-6 pt-8 pb-6 border-b border-border relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none opacity-50"
          style={{ background: "radial-gradient(900px 360px at 90% -20%, var(--accent-soft), transparent 70%)" }}
        />
        <div className="relative">
        <a href="/" className="text-2xs font-mono text-fg-subtle hover:text-accent inline-flex items-center gap-1 mb-3 transition-colors">
          ← dashboard
        </a>
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <h1 className="text-[22px] font-semibold tracking-tight leading-snug flex-1 min-w-0 break-words">
            {run?.request || "Caricamento…"}
          </h1>
          <div className="flex items-center gap-3 shrink-0 pt-1">
            <span className="inline-flex items-center gap-2 text-[13px]">
              <Dot variant={statusDot(status)} pulse={status === "running"} />
              <span className="font-medium">{statusLabel(status)}</span>
            </span>
            {canStop && (
              <button
                onClick={handleStop}
                disabled={stopping}
                title="Interrompi l'esecuzione del run"
                className={cn(
                  "h-8 px-3 text-[13px] inline-flex items-center gap-1.5 border rounded-md btn-press shadow-elev-sm",
                  "bg-bg-elev border-danger/40 text-danger hover:bg-danger/5 hover:border-danger/70 hover:shadow-elev-md",
                  stopping && "opacity-50 cursor-not-allowed pointer-events-none",
                )}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <rect x="6" y="6" width="12" height="12" rx="1" />
                </svg>
                {stopping ? "Interruzione…" : "Interrompi"}
              </button>
            )}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-0 text-[13px] max-w-3xl">
          <KeyValue k="Run" v={<span className="font-mono text-2xs">{id}</span>} />
          <KeyValue k="ETL" v={run?.etl_hint ? <span className="font-mono text-2xs">{run.etl_hint}</span> : <span className="text-fg-subtle">— auto —</span>} />
          <KeyValue k="Modello" v={run?.model ? <span className="font-mono text-2xs">{run.model}</span> : <span className="text-fg-subtle">— default —</span>} />
          <KeyValue k="Creato" v={formatTs(run?.created_at as any) || "—"} />
          <KeyValue k="Aggiornato" v={run?.updated_at ? relativeTs(run.updated_at as any) : "—"} />
        </div>

        {summary && (
          <div className="mt-5 text-[13px] leading-relaxed text-fg border-l-2 border-accent pl-3 max-w-3xl bg-accent-soft/40 rounded-r-md py-2 pr-3">
            {summary}
          </div>
        )}
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 border-b border-border sticky top-14 bg-bg/80 backdrop-blur-xl backdrop-saturate-150 z-[5] shadow-elev-sm">
        <div className="flex items-center gap-1 -mb-px">
          <Tab active={tab === "stream"} onClick={() => setTab("stream")} label="Stream" count={events.filter(e => e.type === "tool_call").length || undefined} />
          <Tab active={tab === "results"} onClick={() => setTab("results")} label="Risultati test" count={Object.values(counts).reduce((a: number, b: any) => a + b, 0) || undefined} disabled={!artifacts.test_plan && !artifacts.test_results} />
          <Tab active={tab === "fix"} onClick={() => setTab("fix")} label="Fix & PR" disabled={!artifacts.fix_proposal && !artifacts.pr_opened} />
          <Tab active={tab === "report"} onClick={() => setTab("report")} label="Report" disabled={!artifacts.final_report} />
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-6">
        {tab === "stream" && (
          <StreamTab
            events={events}
            status={status}
            meta={{ id, request: run?.request, model: run?.model, etl: run?.etl_hint }}
          />
        )}
        {tab === "results" && (
          <ResultsTab
            plan={artifacts.test_plan}
            results={artifacts.test_results}
            counts={counts}
            runStatus={status}
            runId={id}
          />
        )}
        {tab === "fix" && <FixTab fix={artifacts.fix_proposal} pr={artifacts.pr_opened} />}
        {tab === "report" && (
          <ReportTab
            report={artifacts.final_report}
            runId={id}
            request={run?.request}
          />
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────

function Tab({ active, onClick, label, count, disabled }: { active: boolean; onClick: () => void; label: string; count?: number; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "h-11 px-3.5 text-[13px] tracking-tight border-b-2 transition-all duration-200 ease-out-soft inline-flex items-center gap-2 relative",
        active
          ? "border-accent text-accent font-medium"
          : "border-transparent text-fg-muted hover:text-fg hover:border-border-strong",
        disabled && "opacity-30 cursor-not-allowed hover:text-fg-muted hover:border-transparent",
      )}
    >
      {label}
      {count !== undefined && (
        <span
          className={cn(
            "text-2xs font-mono px-1.5 py-0.5 rounded transition-colors",
            active ? "bg-accent-soft text-accent" : "bg-bg-subtle text-fg-subtle",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

// ═══ Download helpers ═══════════════════════════════════════════════════════

function triggerDownload(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows: (string | number | null | undefined)[][]): string {
  return rows.map((r) => r.map(csvEscape).join(",")).join("\r\n");
}

function streamToMarkdown(events: RunEvent[], meta: { id: string; request?: string; status?: string; model?: string | null; etl?: string | null }): string {
  const lines: string[] = [];
  lines.push(`# Stream — run ${meta.id}`);
  lines.push("");
  if (meta.request) lines.push(`**Richiesta**: ${meta.request}`);
  if (meta.etl) lines.push(`**ETL**: \`${meta.etl}\``);
  if (meta.model) lines.push(`**Modello**: \`${meta.model}\``);
  if (meta.status) lines.push(`**Stato finale**: ${meta.status}`);
  lines.push(`**Esportato**: ${new Date().toISOString()}`);
  lines.push("");
  lines.push("---");
  lines.push("");

  let textBuf = "";
  const flushText = () => {
    if (textBuf.trim()) {
      lines.push(textBuf.trim());
      lines.push("");
    }
    textBuf = "";
  };

  for (const e of events) {
    if (e.type === "agent_text") {
      textBuf += (e as any).text;
    } else if (e.type === "tool_call") {
      flushText();
      lines.push(`### → tool_call: \`${e.name}\``);
      const args = (e as any).args || {};
      const entries = Object.entries(args);
      if (entries.length === 0) {
        lines.push("_nessun argomento_");
      } else {
        lines.push("```");
        for (const [k, v] of entries) {
          const s = typeof v === "string" ? v : JSON.stringify(v);
          lines.push(`${k}: ${s}`);
        }
        lines.push("```");
      }
      lines.push("");
    } else if (e.type === "tool_response") {
      flushText();
      lines.push(`### ← tool_response: \`${e.name}\``);
      lines.push("```");
      lines.push(String((e as any).preview || ""));
      lines.push("```");
      lines.push("");
    } else if (e.type === "error") {
      flushText();
      lines.push(`### ⚠ errore`);
      lines.push("```");
      lines.push(String((e as any).message || ""));
      lines.push("```");
      lines.push("");
    }
  }
  flushText();
  return lines.join("\n");
}

function IconButton({
  onClick,
  title,
  children,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="h-7 px-2.5 text-2xs font-mono inline-flex items-center gap-1.5 border border-border rounded text-fg-muted hover:text-fg hover:border-border-strong hover:bg-bg-subtle transition-colors"
    >
      {children}
    </button>
  );
}

// ═══ Stream tab ═════════════════════════════════════════════════════════════

function StreamTab({ events, status, meta }: { events: RunEvent[]; status: string; meta: { id: string; request?: string; model?: string | null; etl?: string | null } }) {
  // Unione reasoning + tool in una timeline cronologica unica.
  const items = useMemo(() => {
    const out: Array<
      | { kind: "text"; text: string; ts?: number }
      | { kind: "tool_call"; name: string; args: any; ts?: number }
      | { kind: "tool_response"; name: string; preview: string; ts?: number }
    > = [];
    let buf = "";

    const flush = (ts?: number) => {
      if (buf) {
        out.push({ kind: "text", text: buf, ts });
        buf = "";
      }
    };

    for (const e of events) {
      if (e.type === "agent_text") {
        buf += (e as any).text;
      } else if (e.type === "tool_call") {
        flush(e.ts);
        out.push({ kind: "tool_call", name: e.name, args: (e as any).args, ts: e.ts });
      } else if (e.type === "tool_response") {
        flush(e.ts);
        out.push({ kind: "tool_response", name: e.name, preview: (e as any).preview, ts: e.ts });
      }
    }
    flush();
    return out;
  }, [events]);

  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (status === "running") endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [items.length, status]);

  const downloadStream = () => {
    const md = streamToMarkdown(events, { id: meta.id, request: meta.request, status, model: meta.model, etl: meta.etl });
    triggerDownload(`stream-${meta.id}.md`, md, "text/markdown;charset=utf-8");
  };

  if (items.length === 0) {
    return (
      <div className="py-20 text-center text-fg-muted text-[13px]">
        <Dot variant="running" pulse />
        <span className="ml-2">In attesa dei primi output dell'agente…</span>
      </div>
    );
  }

  const isEnded = status === "completed" || status === "failed" || status === "cancelled";

  return (
    <div className="max-w-3xl">
      {isEnded && (
        <div className="flex items-center justify-end mb-4">
          <IconButton onClick={downloadStream} title="Scarica lo stream come file Markdown">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Scarica .md
          </IconButton>
        </div>
      )}
      {items.map((it, i) => (
        <div key={i} className="animate-rise mb-5">
          {it.kind === "text" && (
            <div className="prose-plain">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{it.text}</ReactMarkdown>
              {i === items.length - 1 && status === "running" && (
                <span className="inline-block w-[7px] h-[14px] bg-fg ml-0.5 animate-blink align-middle" />
              )}
            </div>
          )}
          {it.kind === "tool_call" && (
            <div className="border border-border rounded overflow-hidden">
              <div className="h-8 px-3 bg-bg-subtle border-b border-border flex items-center gap-2 text-2xs font-mono">
                <span className="text-fg-subtle">→ tool</span>
                <span className="font-semibold text-fg">{it.name}</span>
              </div>
              <ToolArgs args={it.args} />
            </div>
          )}
          {it.kind === "tool_response" && (
            <div className="border border-border rounded overflow-hidden">
              <div className="h-8 px-3 bg-bg-subtle border-b border-border flex items-center gap-2 text-2xs font-mono">
                <span className="text-success">← risultato</span>
                <span className="text-fg-muted">{it.name}</span>
              </div>
              <pre className="px-3 py-2 text-2xs font-mono text-fg-muted overflow-x-auto whitespace-pre-wrap break-all">
                {it.preview}
              </pre>
            </div>
          )}
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
}

function ToolArgs({ args }: { args: any }) {
  const entries = Object.entries(args || {});
  if (entries.length === 0) return <div className="px-3 py-2 text-2xs font-mono text-fg-subtle italic">nessun argomento</div>;
  return (
    <div className="divide-y divide-border">
      {entries.map(([k, v]) => {
        const s = typeof v === "string" ? v : JSON.stringify(v);
        const multi = s.length > 80 || s.includes("\n");
        return (
          <div key={k} className={cn("px-3 py-1.5 text-2xs font-mono", multi && "flex-col")}>
            <span className="text-fg-subtle mr-2">{k}</span>
            <span className={cn("text-fg", multi && "block mt-1 whitespace-pre-wrap break-all")}>{s}</span>
          </div>
        );
      })}
    </div>
  );
}

// ═══ Results tab ════════════════════════════════════════════════════════════

type TestStatus = "PASS" | "FAIL" | "ERROR" | "IGNORED" | "RUNNING" | "PENDING";

function testStatusBadge(s: TestStatus) {
  if (s === "PASS") return <Badge variant="success">pass</Badge>;
  if (s === "FAIL") return <Badge variant="danger">fail</Badge>;
  if (s === "ERROR") return <Badge variant="warning">error</Badge>;
  if (s === "IGNORED") return <Badge variant="neutral">ignored</Badge>;
  if (s === "RUNNING") {
    return (
      <span className="inline-flex items-center gap-1.5 text-2xs font-mono uppercase tracking-wider text-fg-muted">
        <Dot variant="running" pulse />
        in corso
      </span>
    );
  }
  return <Badge variant="neutral">in coda</Badge>;
}

function ResultsTab({
  plan,
  results,
  counts,
  runStatus,
  runId,
}: {
  plan: any;
  results: any;
  counts: Record<string, number>;
  runStatus: string;
  runId: string;
}) {
  const tests: any[] = plan?.tests || [];
  const resList: any[] = results?.results || [];
  const resById = Object.fromEntries(resList.map((r: any) => [r.id, r]));

  // Merge: ogni test planned, con il suo risultato se presente.
  // Se non c'è un plan (caso raro), fallback ai soli risultati.
  const rows = tests.length > 0
    ? tests.map((t) => ({ ...t, result: resById[t.id] }))
    : resList.map((r) => ({ ...r, result: r }));

  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const downloadCsv = () => {
    const header = ["id", "name", "category", "priority", "pass_condition", "status", "evidence", "row_count", "query"];
    const dataRows: (string | number | null | undefined)[][] = rows.map((t: any) => {
      const res = t.result;
      const rawStatus: string | undefined = res?.status;
      const status = rawStatus ?? (runStatus === "running" || runStatus === "pending" ? "RUNNING" : "PENDING");
      return [
        t.id ?? "",
        t.name ?? "",
        t.category ?? "",
        t.priority ?? "",
        t.pass_condition ?? "",
        status,
        res?.evidence ?? "",
        typeof res?.row_count === "number" ? res.row_count : "",
        t.query ?? "",
      ];
    });
    // BOM per Excel → gli UTF-8 accentati si vedono bene
    const csv = "\uFEFF" + toCsv([header, ...dataRows]);
    triggerDownload(`test-results-${runId}.csv`, csv, "text/csv;charset=utf-8");
  };

  if (rows.length === 0) {
    return <div className="text-fg-muted text-[13px]">Nessun test ancora.</div>;
  }

  return (
    <div className="space-y-6 w-full">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {plan?.rationale ? (
          <div className="text-[13px] text-fg-muted italic border-l-2 border-border pl-3 flex-1 min-w-[240px]">
            {plan.rationale}
          </div>
        ) : <div />}
        <IconButton onClick={downloadCsv} title="Scarica i test come CSV (apribile in Excel)">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Scarica CSV
        </IconButton>
      </div>

      {Object.keys(counts).length > 0 && (
        <div className="flex items-center gap-2">
          {counts.PASS ? <Badge variant="success">pass · {counts.PASS}</Badge> : null}
          {counts.FAIL ? <Badge variant="danger">fail · {counts.FAIL}</Badge> : null}
          {counts.ERROR ? <Badge variant="warning">error · {counts.ERROR}</Badge> : null}
          {counts.IGNORED ? <Badge variant="neutral">ignored · {counts.IGNORED}</Badge> : null}
        </div>
      )}

      <div className="border border-border rounded overflow-hidden">
        <table className="w-full text-[13px] table-fixed">
          <thead>
            <tr className="bg-bg-subtle border-b border-border text-2xs font-mono uppercase tracking-wider text-fg-subtle">
              <th className="text-left font-normal px-3 py-2 w-[110px]">Esito</th>
              <th className="text-left font-normal px-3 py-2">Test</th>
              <th className="text-left font-normal px-3 py-2 w-[160px]">Categoria</th>
              <th className="text-left font-normal px-3 py-2 w-[90px]">Priorità</th>
              <th className="text-right font-normal px-3 py-2 w-[100px]">Query</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t: any) => {
              const res = t.result;
              const rawStatus: string | undefined = res?.status;
              const status: TestStatus = rawStatus
                ? (rawStatus as TestStatus)
                : (runStatus === "running" || runStatus === "pending" ? "RUNNING" : "PENDING");
              const hasQuery = typeof t.query === "string" && t.query.trim().length > 0;
              const isOpen = expanded.has(t.id);
              return (
                <Fragment key={t.id}>
                  <tr className="border-b border-border last:border-b-0 align-top">
                    <td className="px-3 py-3 whitespace-nowrap">
                      {testStatusBadge(status)}
                    </td>
                    <td className="px-3 py-3">
                      <div className="text-fg font-medium break-words">{t.name || t.id}</div>
                      {t.description && <div className="text-fg-muted text-[12px] mt-0.5 break-words">{t.description}</div>}
                      {res?.evidence && <div className="text-fg-subtle text-2xs mt-1.5 font-mono break-words whitespace-pre-wrap">{res.evidence}</div>}
                      {typeof res?.row_count === "number" && (
                        <div className="text-fg-subtle text-2xs mt-1 font-mono">rows: {res.row_count}</div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-2xs font-mono text-fg-muted">{t.category || "—"}</td>
                    <td className="px-3 py-3 text-2xs font-mono text-fg-muted">{t.priority || "—"}</td>
                    <td className="px-3 py-3 text-right">
                      {hasQuery ? (
                        <button
                          onClick={() => toggle(t.id)}
                          className="text-2xs font-mono text-fg-subtle hover:text-fg inline-flex items-center gap-1"
                        >
                          {isOpen ? "nascondi" : "mostra"}
                          <span className={cn("inline-block transition-transform", isOpen && "rotate-180")}>▾</span>
                        </button>
                      ) : (
                        <span className="text-2xs font-mono text-fg-subtle">—</span>
                      )}
                    </td>
                  </tr>
                  {hasQuery && isOpen && (
                    <tr className="border-b border-border last:border-b-0 bg-bg-subtle">
                      <td colSpan={5} className="px-3 py-3">
                        <div className="text-2xs font-mono uppercase tracking-wider text-fg-subtle mb-2">
                          Query SQL
                          {t.pass_condition && (
                            <span className="ml-3 normal-case tracking-normal text-fg-muted">
                              pass_condition: <code className="text-fg">{t.pass_condition}</code>
                            </span>
                          )}
                        </div>
                        <pre className="text-2xs font-mono text-fg px-3 py-2 bg-bg border border-border rounded overflow-auto max-h-[360px] whitespace-pre leading-relaxed">
                          {t.query}
                        </pre>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══ Fix tab ════════════════════════════════════════════════════════════════

function FixTab({ fix, pr }: { fix: any; pr: any }) {
  if (!fix && !pr) return <div className="text-fg-muted text-[13px]">Nessun fix proposto.</div>;

  return (
    <div className="space-y-6 w-full">
      {fix && (
        <>
          <div>
            <div className="text-2xs font-mono uppercase tracking-wider text-fg-subtle mb-2">Root cause</div>
            <div className="text-[14px] leading-relaxed">{fix.root_cause}</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-[13px]">
            <KeyValue k="File" v={<span className="font-mono text-2xs">{fix.file_path}</span>} />
            <KeyValue k="Validato" v={
              fix.validation_passed
                ? <Badge variant="success">sì</Badge>
                : <Badge variant="warning">no</Badge>
            } />
            {fix.validation_notes && <div className="col-span-full text-[13px] text-fg-muted">{fix.validation_notes}</div>}
          </div>

          <Section title="SQL corretto">
            <pre className="text-2xs font-mono text-fg px-4 py-3 overflow-auto max-h-[400px] whitespace-pre leading-relaxed">
              {fix.fixed_sql}
            </pre>
          </Section>
        </>
      )}

      {pr && !pr.error && (
        <Section title="Pull Request" action={
          <Button size="sm" variant="secondary" onClick={() => window.open(pr.url, "_blank")}>
            Apri su GitHub →
          </Button>
        }>
          <div className="p-4 space-y-2 text-[13px]">
            <KeyValue k="PR" v={<a href={pr.url} target="_blank" rel="noreferrer" className="underline">#{pr.number}</a>} />
            <KeyValue k="Branch" v={<code className="text-2xs font-mono">{pr.branch}</code>} />
          </div>
        </Section>
      )}

      {pr?.error && (
        <div className="border border-danger/30 bg-danger/5 rounded p-3 text-[13px] text-danger">
          {pr.error}
        </div>
      )}
    </div>
  );
}

// ═══ Report tab ═════════════════════════════════════════════════════════════

function ReportTab({
  report,
  runId,
  request,
}: {
  report: any;
  runId: string;
  request?: string;
}) {
  if (!report) return <div className="text-fg-muted text-[13px]">Nessun report ancora.</div>;

  const markdown: string = report.markdown || "";

  const downloadReport = () => {
    triggerDownload(`report-${runId}.md`, markdown, "text/markdown;charset=utf-8");
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-end gap-2 mb-4 max-w-4xl">
        <IconButton onClick={downloadReport} title="Scarica il report in Markdown">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Scarica .md
        </IconButton>
      </div>
      <div className="prose-plain max-w-4xl">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
      </div>
    </div>
  );
}

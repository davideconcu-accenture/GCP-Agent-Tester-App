"use client";

import { useEffect, useMemo, useState, Suspense, useRef, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Badge, Dot, KeyValue, Section, Panel, Button, Chevron } from "@/components/ui";
import {
  getRun,
  streamRun,
  type RunDetail,
  type RunEvent,
  type ArtifactKind,
} from "@/lib/api";
import { cn, formatTs, relativeTs, statusDot, statusLabel } from "@/lib/utils";

export default function Page() {
  return (
    <Suspense fallback={<div className="max-w-[1280px] mx-auto px-6 py-10 text-fg-muted text-[13px]">Caricamento…</div>}>
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

  // Switch automatico al tab giusto quando arriva un artefatto rilevante
  useEffect(() => {
    if (artifacts.test_results && tab === "stream" && status === "completed") setTab("results");
  }, [artifacts.test_results, status, tab]);

  const counts = useMemo(() => {
    const r: any[] = (artifacts.test_results as any)?.results || [];
    return r.reduce((a: Record<string, number>, x: any) => {
      a[x.status] = (a[x.status] || 0) + 1;
      return a;
    }, {});
  }, [artifacts.test_results]);

  if (!id) {
    return <div className="max-w-[1280px] mx-auto px-6 py-10 text-fg-muted text-[13px]">ID run mancante.</div>;
  }

  return (
    <div className="max-w-[1280px] mx-auto w-full">
      {/* Hero */}
      <div className="px-6 pt-10 pb-7">
        <a href="/" className="text-2xs font-mono text-fg-subtle hover:text-fg inline-flex items-center gap-1.5 mb-4 transition-colors">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-3 h-3">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          dashboard
        </a>
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <h1 className="text-[26px] font-semibold tracking-tight leading-snug flex-1 min-w-0 break-words">
            {run?.request || "Caricamento…"}
          </h1>
          <span className="inline-flex items-center gap-2 text-[13px] shrink-0 pt-1.5 px-3 py-1.5 rounded-md bg-bg-elevated border border-border shadow-sm">
            <Dot variant={statusDot(status)} pulse={status === "running"} />
            <span className="font-medium">{statusLabel(status)}</span>
          </span>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-0 text-[13px] max-w-3xl">
          <KeyValue k="Run" v={<span className="font-mono text-2xs">{id}</span>} />
          <KeyValue k="Modello" v={(run as any)?.model ? <span className="font-mono text-2xs px-1.5 py-0.5 rounded bg-bg-subtle border border-border">{(run as any).model}</span> : <span className="text-fg-subtle">—</span>} />
          <KeyValue k="ETL" v={run?.etl_hint ? <span className="font-mono text-2xs px-1.5 py-0.5 rounded bg-bg-subtle border border-border">{run.etl_hint}</span> : <span className="text-fg-subtle">— auto —</span>} />
          <KeyValue k="Creato" v={formatTs(run?.created_at as any) || "—"} />
          <KeyValue k="Aggiornato" v={run?.updated_at ? relativeTs(run.updated_at as any) : "—"} />
        </div>

        {summary && (
          <div className="mt-6 max-w-3xl">
            <Panel elevated className="p-4">
              <div className="flex items-start gap-2.5">
                <span className="inline-flex w-5 h-5 rounded-md bg-fg/5 items-center justify-center shrink-0 mt-0.5">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3 text-fg-muted">
                    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                  </svg>
                </span>
                <div className="text-[13px] leading-relaxed text-fg flex-1">{summary}</div>
              </div>
            </Panel>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div
        className="px-6 border-b border-border sticky top-14 z-[5]"
        style={{
          background: "var(--blur-bg)",
          backdropFilter: "saturate(180%) blur(12px)",
          WebkitBackdropFilter: "saturate(180%) blur(12px)",
        }}
      >
        <div className="flex items-center gap-1 -mb-px">
          <Tab active={tab === "stream"} onClick={() => setTab("stream")} label="Stream" count={events.filter(e => e.type === "tool_call").length || undefined} />
          <Tab active={tab === "results"} onClick={() => setTab("results")} label="Risultati test" count={Object.values(counts).reduce((a: number, b: any) => a + b, 0) || undefined} disabled={!artifacts.test_plan && !artifacts.test_results} />
          <Tab active={tab === "fix"} onClick={() => setTab("fix")} label="Fix & PR" disabled={!artifacts.fix_proposal && !artifacts.pr_opened} />
          <Tab active={tab === "report"} onClick={() => setTab("report")} label="Report" disabled={!artifacts.final_report} />
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-8">
        {tab === "stream" && <StreamTab events={events} status={status} />}
        {tab === "results" && <ResultsTab plan={artifacts.test_plan} results={artifacts.test_results} counts={counts} />}
        {tab === "fix" && <FixTab fix={artifacts.fix_proposal} pr={artifacts.pr_opened} />}
        {tab === "report" && <ReportTab report={artifacts.final_report} />}
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
        "h-11 px-3.5 text-[13px] font-medium tracking-tight border-b-2 transition-all duration-150 inline-flex items-center gap-2",
        active ? "border-fg text-fg" : "border-transparent text-fg-muted hover:text-fg hover:border-border-strong",
        disabled && "opacity-30 cursor-not-allowed hover:text-fg-muted hover:border-transparent",
      )}
    >
      {label}
      {count !== undefined && (
        <span className={cn(
          "text-2xs font-mono px-1.5 py-0.5 rounded",
          active ? "bg-fg/10 text-fg" : "bg-bg-subtle text-fg-subtle",
        )}>{count}</span>
      )}
    </button>
  );
}

// ═══ Stream tab ═════════════════════════════════════════════════════════════

function StreamTab({ events, status }: { events: RunEvent[]; status: string }) {
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

  if (items.length === 0) {
    return (
      <div className="py-24 text-center">
        <div className="inline-flex flex-col items-center gap-3 text-fg-muted text-[13px]">
          <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-bg-subtle border border-border">
            <Dot variant="running" pulse />
          </span>
          <span>In attesa dei primi output dell'agente…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((it, i) => (
        <div key={i} className="animate-rise">
          {it.kind === "text" && (
            <div className="prose-plain max-w-3xl">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{it.text}</ReactMarkdown>
              {i === items.length - 1 && status === "running" && (
                <span className="inline-block w-[7px] h-[14px] bg-fg ml-0.5 animate-blink align-middle" />
              )}
            </div>
          )}
          {it.kind === "tool_call" && (
            <ToolCard kind="call" name={it.name} ts={it.ts}>
              <ToolArgs args={it.args} />
            </ToolCard>
          )}
          {it.kind === "tool_response" && (
            <ToolCard kind="response" name={it.name} ts={it.ts}>
              <pre className="px-4 py-3 text-2xs font-mono text-fg-muted overflow-x-auto whitespace-pre-wrap break-all leading-relaxed max-h-[420px] overflow-y-auto">
                {it.preview}
              </pre>
            </ToolCard>
          )}
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
}

// Card collassabile per tool_call / tool_response. Default CHIUSA.
function ToolCard({
  kind,
  name,
  ts,
  children,
}: {
  kind: "call" | "response";
  name: string;
  ts?: number;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const isCall = kind === "call";

  return (
    <div className={cn(
      "border border-border rounded-lg overflow-hidden bg-bg-elevated transition-shadow",
      open ? "shadow-sm" : "shadow-none hover:shadow-sm",
    )}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full h-10 px-3.5 flex items-center gap-2.5 hover:bg-bg-subtle/60 transition-colors group"
      >
        <Chevron open={open} className="text-fg-subtle group-hover:text-fg-muted shrink-0" />
        <span className={cn(
          "inline-flex items-center gap-1.5 text-2xs font-mono px-2 py-0.5 rounded-md shrink-0",
          isCall
            ? "bg-info-soft text-info border border-info/20"
            : "bg-success-soft text-success border border-success/20",
        )}>
          <span className="text-[10px]">{isCall ? "→" : "←"}</span>
          {isCall ? "call" : "result"}
        </span>
        <span className="font-mono text-[13px] text-fg font-medium truncate">{name}</span>
        <span className="ml-auto text-2xs font-mono text-fg-subtle shrink-0">
          {open ? "nascondi" : "mostra"}
        </span>
      </button>
      {open && (
        <div className="border-t border-border bg-bg-subtle/30 animate-rise" style={{ animationDuration: "140ms" }}>
          {children}
        </div>
      )}
    </div>
  );
}

function ToolArgs({ args }: { args: any }) {
  const entries = Object.entries(args || {});
  if (entries.length === 0) return <div className="px-4 py-3 text-2xs font-mono text-fg-subtle italic">nessun argomento</div>;
  return (
    <div className="divide-y divide-border">
      {entries.map(([k, v]) => {
        const s = typeof v === "string" ? v : JSON.stringify(v, null, 2);
        const multi = s.length > 80 || s.includes("\n");
        return (
          <div key={k} className="px-4 py-2.5 text-2xs font-mono">
            <div className="flex items-start gap-3">
              <span className="text-fg-subtle uppercase tracking-wider shrink-0 pt-0.5 min-w-[80px]">{k}</span>
              <span className={cn("text-fg flex-1", multi ? "block whitespace-pre-wrap break-all leading-relaxed" : "")}>{s}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═══ Results tab ════════════════════════════════════════════════════════════

function ResultsTab({ plan, results, counts }: { plan: any; results: any; counts: Record<string, number> }) {
  const tests: any[] = plan?.tests || [];
  const resList: any[] = results?.results || [];
  const resById = Object.fromEntries(resList.map((r: any) => [r.id, r]));

  if (tests.length === 0 && resList.length === 0) {
    return <div className="text-fg-muted text-[13px]">Nessun test ancora.</div>;
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {plan?.rationale && (
        <div className="text-[13px] text-fg-muted italic border-l-2 border-border pl-3">
          {plan.rationale}
        </div>
      )}

      {Object.keys(counts).length > 0 && (
        <div className="flex items-center gap-2">
          {counts.PASS ? <Badge variant="success">pass · {counts.PASS}</Badge> : null}
          {counts.FAIL ? <Badge variant="danger">fail · {counts.FAIL}</Badge> : null}
          {counts.ERROR ? <Badge variant="warning">error · {counts.ERROR}</Badge> : null}
          {counts.IGNORED ? <Badge variant="neutral">ignored · {counts.IGNORED}</Badge> : null}
        </div>
      )}

      <div className="border border-border rounded-lg overflow-hidden bg-bg-elevated shadow-sm">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-bg-subtle/60 border-b border-border text-2xs font-mono uppercase tracking-wider text-fg-subtle">
              <th className="text-left font-medium px-4 py-2.5 w-[100px]">Esito</th>
              <th className="text-left font-medium px-4 py-2.5">Test</th>
              <th className="text-left font-medium px-4 py-2.5 w-[160px]">Categoria</th>
              <th className="text-left font-medium px-4 py-2.5 w-[90px]">Priorità</th>
            </tr>
          </thead>
          <tbody>
            {(resList.length > 0 ? resList : tests).map((t: any) => {
              const res = resById[t.id] || (resList.length === 0 ? null : t);
              const status = res?.status;
              return (
                <tr key={t.id} className="border-b border-border last:border-b-0 align-top hover:bg-bg-subtle/40 transition-colors">
                  <td className="px-4 py-3.5">
                    {status ? (
                      <Badge variant={
                        status === "PASS" ? "success" :
                        status === "FAIL" ? "danger" :
                        status === "ERROR" ? "warning" : "neutral"
                      }>
                        {status.toLowerCase()}
                      </Badge>
                    ) : (
                      <span className="text-2xs font-mono text-fg-subtle">…</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="text-fg font-medium text-[13.5px]">{t.name}</div>
                    {t.description && <div className="text-fg-muted text-[12.5px] mt-1 leading-relaxed">{t.description}</div>}
                    {res?.evidence && (
                      <div className="text-fg-subtle text-2xs mt-2 font-mono px-2 py-1 rounded bg-bg-subtle border border-border inline-block">
                        {res.evidence}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-2xs font-mono text-fg-muted">{t.category || "—"}</td>
                  <td className="px-4 py-3.5 text-2xs font-mono text-fg-muted">{t.priority || "—"}</td>
                </tr>
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
    <div className="space-y-6 max-w-4xl">
      {fix && (
        <>
          <Panel elevated className="p-5">
            <div className="text-2xs font-mono uppercase tracking-wider text-fg-subtle mb-2.5 flex items-center gap-2">
              <span className="w-4 h-px bg-fg-subtle/40" />
              Root cause
            </div>
            <div className="text-[14px] leading-relaxed text-fg">{fix.root_cause}</div>
          </Panel>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-[13px]">
            <KeyValue k="File" v={<span className="font-mono text-2xs px-1.5 py-0.5 rounded bg-bg-subtle border border-border">{fix.file_path}</span>} />
            <KeyValue k="Validato" v={
              fix.validation_passed
                ? <Badge variant="success">sì</Badge>
                : <Badge variant="warning">no</Badge>
            } />
            {fix.validation_notes && <div className="col-span-full text-[13px] text-fg-muted leading-relaxed">{fix.validation_notes}</div>}
          </div>

          <Section title="SQL corretto">
            <pre className="text-2xs font-mono text-fg px-4 py-3 overflow-auto max-h-[420px] whitespace-pre leading-relaxed bg-bg-subtle/30">
              {fix.fixed_sql}
            </pre>
          </Section>
        </>
      )}

      {pr && !pr.error && (
        <Section title="Pull Request" action={
          <Button size="sm" variant="secondary" onClick={() => window.open(pr.url, "_blank")}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-3 h-3">
              <path d="M15 3h6v6M10 14L21 3M21 14v7H3V3h7" />
            </svg>
            Apri su GitHub
          </Button>
        }>
          <div className="p-4 space-y-1 text-[13px]">
            <KeyValue k="PR" v={<a href={pr.url} target="_blank" rel="noreferrer" className="text-fg underline underline-offset-2 decoration-border-strong hover:decoration-fg">#{pr.number}</a>} />
            <KeyValue k="Branch" v={<code className="text-2xs font-mono px-1.5 py-0.5 rounded bg-bg-subtle border border-border">{pr.branch}</code>} />
          </div>
        </Section>
      )}

      {pr?.error && (
        <div className="border border-danger/30 bg-danger-soft rounded-md p-3.5 text-[13px] text-danger flex items-start gap-2.5">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 shrink-0 mt-0.5">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
          <span className="leading-relaxed">{pr.error}</span>
        </div>
      )}
    </div>
  );
}

// ═══ Report tab ═════════════════════════════════════════════════════════════

function ReportTab({ report }: { report: any }) {
  if (!report) return <div className="text-fg-muted text-[13px]">Nessun report ancora.</div>;
  return (
    <Panel elevated className="p-7 max-w-3xl">
      <div className="prose-plain">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{report.markdown || ""}</ReactMarkdown>
      </div>
    </Panel>
  );
}

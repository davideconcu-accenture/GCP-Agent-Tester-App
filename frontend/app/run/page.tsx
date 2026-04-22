"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  MinusCircle,
  GitPullRequest,
  FileText,
  Wrench,
  ListChecks,
  ClipboardList,
  Loader2,
} from "lucide-react";
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
} from "@/components/ui";
import {
  getRun,
  streamRun,
  type RunDetail,
  type RunEvent,
  type ArtifactKind,
} from "@/lib/api";
import { cn, formatTs, statusColor, statusLabel } from "@/lib/utils";

export default function RunPage() {
  return (
    <Suspense fallback={<div className="p-8 text-muted text-sm">Caricamento…</div>}>
      <RunPageInner />
    </Suspense>
  );
}

function RunPageInner() {
  const sp = useSearchParams();
  const id = sp.get("id") || "";
  const [run, setRun] = useState<RunDetail | null>(null);
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [artifacts, setArtifacts] = useState<RunDetail["artifacts"]>({});
  const [status, setStatus] = useState<string>("pending");
  const [summary, setSummary] = useState<string | null>(null);

  // Bootstrap: prendo lo stato corrente poi mi attacco allo stream.
  useEffect(() => {
    if (!id) return;
    let unsub: (() => void) | null = null;
    let alive = true;

    getRun(id)
      .then((r) => {
        if (!alive) return;
        setRun(r);
        setEvents(r.events || []);
        setArtifacts(r.artifacts || {});
        setStatus(r.status);
        setSummary(r.summary || null);

        // Il server SSE ci rimanderà gli eventi storici; per evitare duplicati
        // tracciamo quanti ne abbiamo già ricevuti dal GET iniziale.
        const seen = (r.events || []).length;
        let i = 0;
        unsub = streamRun(id, (ev) => {
          if (i++ < seen) return; // skippa replay iniziale
          applyEvent(ev);
        });
      })
      .catch(() => {});

    function applyEvent(ev: RunEvent) {
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

    return () => {
      alive = false;
      unsub?.();
    };
  }, [id]);

  const reasoning = useMemo(
    () =>
      events
        .filter((e): e is Extract<RunEvent, { type: "agent_text" }> => e.type === "agent_text")
        .map((e) => e.text)
        .join(""),
    [events],
  );

  const toolEvents = events.filter(
    (e) => e.type === "tool_call" || e.type === "tool_response" || e.type === "tool_start" || e.type === "tool_end",
  );

  return (
    <div className="flex-1 px-6 py-8 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <a href="/" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text mb-2">
            <ArrowLeft className="w-4 h-4" /> Torna alla dashboard
          </a>
          <h1 className="text-xl font-semibold text-text">
            {run?.request || "Caricamento…"}
          </h1>
          <div className="flex items-center gap-3 mt-2 text-xs text-muted">
            {run?.etl_hint && <span>ETL: {run.etl_hint}</span>}
            <span>Run #{id}</span>
            {run?.created_at && <span>{formatTs(run.created_at as any)}</span>}
          </div>
        </div>
        <Badge className={cn(statusColor(status), "text-sm")}>
          {status === "running" && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
          {statusLabel(status)}
        </Badge>
      </div>

      {summary && (
        <div className="mb-6 p-4 rounded-lg border border-border bg-surface2 text-sm text-text">
          {summary}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Colonna sinistra: reasoning + timeline */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Ragionamento dell'agente</CardTitle>
              {status === "running" && <Loader2 className="w-4 h-4 animate-spin text-accent" />}
            </CardHeader>
            <CardBody>
              {reasoning ? (
                <div className="prose-dark text-sm">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{reasoning}</ReactMarkdown>
                </div>
              ) : (
                <div className="text-sm text-muted italic">In attesa del primo output…</div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Timeline tool</CardTitle>
              <span className="text-xs text-muted">{toolEvents.length} eventi</span>
            </CardHeader>
            <CardBody className="p-0">
              <ul className="divide-y divide-border max-h-[500px] overflow-y-auto">
                {toolEvents.map((e, i) => (
                  <li key={i} className="px-5 py-2.5 text-xs">
                    {e.type === "tool_call" && (
                      <div>
                        <span className="text-accent font-mono">→ {e.name}</span>
                        <span className="text-muted ml-2">
                          {summarizeArgs((e as any).args)}
                        </span>
                      </div>
                    )}
                    {e.type === "tool_response" && (
                      <div>
                        <span className="text-ok font-mono">← {e.name}</span>
                        <span className="text-muted ml-2 font-mono">
                          {((e as any).preview || "").slice(0, 120)}
                        </span>
                      </div>
                    )}
                    {(e.type === "tool_start" || e.type === "tool_end") && (
                      <div className="text-muted font-mono">
                        {e.type === "tool_start" ? "▸" : "✓"} {(e as any).name}
                        {(e as any).purpose ? ` — ${(e as any).purpose}` : ""}
                      </div>
                    )}
                  </li>
                ))}
                {toolEvents.length === 0 && (
                  <li className="px-5 py-6 text-sm text-muted text-center">
                    Nessun tool ancora invocato.
                  </li>
                )}
              </ul>
            </CardBody>
          </Card>
        </div>

        {/* Colonna destra: artefatti */}
        <div className="space-y-6">
          <ArtifactPanel
            icon={<ClipboardList className="w-4 h-4 text-accent" />}
            title="Piano test"
            kind="test_plan"
            data={artifacts.test_plan}
            render={renderTestPlan}
          />
          <ArtifactPanel
            icon={<ListChecks className="w-4 h-4 text-accent" />}
            title="Risultati test"
            kind="test_results"
            data={artifacts.test_results}
            render={renderTestResults}
          />
          <ArtifactPanel
            icon={<Wrench className="w-4 h-4 text-accent" />}
            title="Fix proposto"
            kind="fix_proposal"
            data={artifacts.fix_proposal}
            render={renderFixProposal}
          />
          <ArtifactPanel
            icon={<GitPullRequest className="w-4 h-4 text-accent" />}
            title="Pull Request"
            kind="pr_opened"
            data={artifacts.pr_opened}
            render={renderPR}
          />
          <ArtifactPanel
            icon={<FileText className="w-4 h-4 text-accent" />}
            title="Report finale"
            kind="final_report"
            data={artifacts.final_report}
            render={renderReport}
          />
        </div>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────

function summarizeArgs(args: Record<string, unknown> | undefined): string {
  if (!args) return "";
  const entries = Object.entries(args);
  if (entries.length === 0) return "";
  return entries
    .map(([k, v]) => `${k}=${truncate(String(v), 60)}`)
    .join(", ");
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + "…" : s;
}

function ArtifactPanel<T>({
  icon,
  title,
  kind,
  data,
  render,
}: {
  icon: React.ReactNode;
  title: string;
  kind: ArtifactKind;
  data: T | undefined;
  render: (d: T) => React.ReactNode;
}) {
  if (!data) return null;
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          {icon}
          <CardTitle>{title}</CardTitle>
        </div>
      </CardHeader>
      <CardBody>{render(data)}</CardBody>
    </Card>
  );
}

function statusIcon(s: string) {
  switch (s) {
    case "PASS": return <CheckCircle2 className="w-4 h-4 text-ok" />;
    case "FAIL": return <XCircle className="w-4 h-4 text-err" />;
    case "ERROR": return <AlertTriangle className="w-4 h-4 text-warn" />;
    case "IGNORED": return <MinusCircle className="w-4 h-4 text-muted" />;
    default: return null;
  }
}

function renderTestPlan(d: any) {
  const tests: any[] = d.tests || [];
  return (
    <div className="space-y-2">
      {d.rationale && <p className="text-xs text-muted italic">{d.rationale}</p>}
      <ul className="space-y-2">
        {tests.map((t) => (
          <li key={t.id} className="text-xs border border-border rounded-md p-3">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="font-medium text-text">{t.name}</span>
              <Badge className="border-border2 text-muted">{t.priority}</Badge>
            </div>
            <div className="text-muted mb-2">{t.description}</div>
            <div className="text-[10px] text-muted uppercase tracking-wide">{t.category}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function renderTestResults(d: any) {
  const results: any[] = d.results || [];
  const counts = results.reduce((acc: Record<string, number>, r: any) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});
  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        {["PASS", "FAIL", "ERROR", "IGNORED"].map((s) =>
          counts[s] ? (
            <Badge
              key={s}
              className={cn(
                s === "PASS" && "bg-ok/20 text-ok border-ok/40",
                s === "FAIL" && "bg-err/20 text-err border-err/40",
                s === "ERROR" && "bg-warn/20 text-warn border-warn/40",
                s === "IGNORED" && "bg-muted/20 text-muted border-muted/40",
              )}
            >
              {s}: {counts[s]}
            </Badge>
          ) : null,
        )}
      </div>
      <ul className="space-y-2">
        {results.map((r) => (
          <li key={r.id} className="text-xs border border-border rounded-md p-3">
            <div className="flex items-start gap-2">
              {statusIcon(r.status)}
              <div className="min-w-0 flex-1">
                <div className="font-medium text-text">{r.name}</div>
                {r.evidence && <div className="text-muted mt-1">{r.evidence}</div>}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function renderFixProposal(d: any) {
  return (
    <div className="space-y-3 text-xs">
      <div>
        <div className="text-muted uppercase text-[10px] tracking-wide mb-1">Root cause</div>
        <div className="text-text">{d.root_cause}</div>
      </div>
      <div>
        <div className="text-muted uppercase text-[10px] tracking-wide mb-1">File</div>
        <code className="bg-surface2 px-2 py-0.5 rounded">{d.file_path}</code>
      </div>
      <Badge
        className={
          d.validation_passed
            ? "bg-ok/20 text-ok border-ok/40"
            : "bg-warn/20 text-warn border-warn/40"
        }
      >
        {d.validation_passed ? "Validato" : "Non validato"}
      </Badge>
      {d.validation_notes && <p className="text-muted">{d.validation_notes}</p>}
      <details className="mt-2">
        <summary className="cursor-pointer text-accent">Mostra diff SQL</summary>
        <pre className="mt-2 max-h-64 overflow-auto bg-surface2 p-2 rounded font-mono text-[11px]">
          {d.fixed_sql}
        </pre>
      </details>
    </div>
  );
}

function renderPR(d: any) {
  if (d.error) return <div className="text-err text-xs">{d.error}</div>;
  return (
    <div className="text-sm">
      <a
        href={d.url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-2 text-accent hover:underline"
      >
        <GitPullRequest className="w-4 h-4" /> PR #{d.number}
      </a>
      <div className="text-xs text-muted mt-1">Branch: <code>{d.branch}</code></div>
    </div>
  );
}

function renderReport(d: any) {
  return (
    <div className="prose-dark text-sm max-h-[500px] overflow-y-auto">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{d.markdown || ""}</ReactMarkdown>
    </div>
  );
}

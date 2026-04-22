"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send, Clock } from "lucide-react";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  Textarea,
  Badge,
} from "@/components/ui";
import { createRun, listEtls, listRuns, type RunSummary } from "@/lib/api";
import { formatTs, statusColor, statusLabel } from "@/lib/utils";

export default function HomePage() {
  const router = useRouter();
  const [etls, setEtls] = useState<string[]>([]);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [etl, setEtl] = useState("");
  const [request, setRequest] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      const { runs } = await listRuns();
      setRuns(runs);
    } catch (e: any) {
      // Se il backend non è pronto, silenzioso
    }
  }

  useEffect(() => {
    listEtls()
      .then(({ etls }) => setEtls(etls))
      .catch(() => setEtls([]));
    refresh();
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!request.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const { run_id } = await createRun(request.trim(), etl || undefined);
      router.push(`/run?id=${run_id}`);
    } catch (err: any) {
      setError(err.message || "Errore");
      setSubmitting(false);
    }
  }

  return (
    <div className="flex-1 px-6 py-8 max-w-6xl mx-auto w-full">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Nuovo run */}
        <Card>
          <CardHeader>
            <CardTitle>Nuova segnalazione</CardTitle>
          </CardHeader>
          <CardBody>
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <Label htmlFor="etl">ETL di riferimento (opzionale)</Label>
                <Select
                  id="etl"
                  value={etl}
                  onChange={(e) => setEtl(e.target.value)}
                >
                  <option value="">— scegli o lascia all'agente —</option>
                  {etls.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="request">Descrivi il problema o la verifica</Label>
                <Textarea
                  id="request"
                  rows={6}
                  value={request}
                  onChange={(e) => setRequest(e.target.value)}
                  placeholder="Es: I saldi dei conti correnti sembrano sbagliati dopo l'ultimo run. Controlla l'ETL saldi_correnti."
                />
              </div>
              {error && <div className="text-sm text-err">{error}</div>}
              <Button type="submit" disabled={submitting || !request.trim()}>
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Avvio…
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" /> Avvia analisi
                  </>
                )}
              </Button>
            </form>
          </CardBody>
        </Card>

        {/* Storico */}
        <Card>
          <CardHeader>
            <CardTitle>Run recenti</CardTitle>
            <Clock className="w-4 h-4 text-muted" />
          </CardHeader>
          <CardBody className="p-0">
            {runs.length === 0 && (
              <div className="p-8 text-center text-sm text-muted">
                Nessun run ancora. Avvia la prima segnalazione a sinistra.
              </div>
            )}
            <ul className="divide-y divide-border">
              {runs.map((r) => (
                <li key={r.id}>
                  <a
                    href={`/run?id=${r.id}`}
                    className="flex items-start gap-3 px-5 py-3 hover:bg-surface2 transition-colors"
                  >
                    <Badge className={statusColor(r.status)}>
                      {statusLabel(r.status)}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-text truncate">
                        {r.request}
                      </div>
                      <div className="text-xs text-muted mt-0.5 flex items-center gap-2">
                        {r.etl_hint && <span>{r.etl_hint}</span>}
                        <span>·</span>
                        <span>{formatTs(r.created_at as any)}</span>
                      </div>
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

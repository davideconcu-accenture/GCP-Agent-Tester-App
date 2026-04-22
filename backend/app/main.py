"""
FastAPI entrypoint.

Endpoint:
    POST   /api/runs                       crea un run e lo lancia in background
    GET    /api/runs                       lista storico run
    GET    /api/runs/{id}                  dettaglio + eventi + artefatti
    GET    /api/runs/{id}/stream           SSE degli eventi live (reconnectable)
    GET    /api/etls                       lista cartelle ETL nel repo
    GET    /healthz

In produzione serve anche gli asset statici Next.js (export `out/`) mountati sotto /.
"""

from __future__ import annotations

import asyncio
import json
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from app import store
from app.config import AVAILABLE_MODELS, get_settings
from app.runner import launch_background
from app.tools import list_available_etls


app = FastAPI(title="ETL QA Agent")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── API ──────────────────────────────────────────────────────────────────────

class CreateRunRequest(BaseModel):
    request: str
    etl: str | None = None
    model: str | None = None  # id del modello Gemini scelto nella UI


@app.post("/api/runs")
async def create_run(body: CreateRunRequest):
    if not body.request.strip():
        raise HTTPException(400, "richiesta vuota")

    # Valida il modello se specificato (whitelist dal catalogo)
    model = body.model or None
    if model:
        valid_ids = {m["id"] for m in AVAILABLE_MODELS}
        if model not in valid_ids:
            raise HTTPException(400, f"modello non valido: {model}")

    run_id = store.create_run(body.request, body.etl, model=model)
    launch_background(run_id, body.request, body.etl, model_override=model)
    return {"run_id": run_id}


@app.get("/api/models")
async def api_list_models():
    """Catalogo modelli disponibili + default attivo (da env)."""
    return {
        "models": AVAILABLE_MODELS,
        "default": get_settings().gemini_model,
    }


@app.get("/api/runs")
async def list_runs():
    return {"runs": store.list_runs(limit=50)}


@app.get("/api/runs/{run_id}")
async def get_run(run_id: str):
    run = store.get_run(run_id)
    if run is None:
        raise HTTPException(404, "run non trovato")
    return run


@app.get("/api/runs/{run_id}/stream")
async def stream_run(run_id: str, request: Request):
    run = store.get_run(run_id)
    if run is None:
        raise HTTPException(404, "run non trovato")

    async def event_source():
        # Replay eventi già registrati (per reconnect).
        for ev in run.get("events", []):
            yield _sse(ev)
        # Se già finito, chiudi.
        if run.get("status") in {"completed", "failed"}:
            yield _sse({"type": "status", "status": run["status"], "summary": run.get("summary")})
            return

        # Sottoscrivi agli eventi live.
        q = await store.subscribe(run_id)
        try:
            while True:
                if await request.is_disconnected():
                    break
                try:
                    ev = await asyncio.wait_for(q.get(), timeout=15.0)
                except asyncio.TimeoutError:
                    # heartbeat per tenere viva la connessione
                    yield ": keepalive\n\n"
                    continue
                yield _sse(ev)
                if ev.get("type") == "status" and ev.get("status") in {"completed", "failed"}:
                    break
        finally:
            await store.unsubscribe(run_id, q)

    return StreamingResponse(
        event_source(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.get("/api/etls")
async def api_list_etls():
    try:
        return list_available_etls()
    except Exception as e:
        raise HTTPException(500, str(e))


@app.get("/healthz")
async def healthz():
    return {"ok": True}


def _sse(event: dict) -> str:
    return f"data: {json.dumps(event, default=str)}\n\n"


# ── Static (build Next.js export) ────────────────────────────────────────────
# In produzione il Dockerfile copia `frontend/out` qui sotto.
_STATIC_DIR = Path(__file__).resolve().parent.parent / "static"
if _STATIC_DIR.exists():
    app.mount("/", StaticFiles(directory=_STATIC_DIR, html=True), name="frontend")

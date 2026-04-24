"""
Storage e pub/sub per i run dell'agente.

- Firestore: persistenza dello stato di ogni run (richiesta, status, eventi, artefatti).
- In-memory bus: distribuzione real-time degli eventi ai client SSE connessi.

Uno stesso evento viene sempre scritto su Firestore E pubblicato nel bus.
Così un client che si collega dopo può ricostruire la storia completa dal DB.
"""

from __future__ import annotations

import asyncio
import time
import uuid
from contextvars import ContextVar
from typing import Any, AsyncIterator

from google.cloud import firestore

from app.config import get_settings


# ── ContextVar per sapere il run in corso dentro i tool ─────────────────────
CURRENT_RUN_ID: ContextVar[str] = ContextVar("CURRENT_RUN_ID", default="")


# ── Firestore client (lazy) ──────────────────────────────────────────────────
_db: firestore.Client | None = None


def _get_db() -> firestore.Client:
    global _db
    if _db is None:
        _db = firestore.Client(project=get_settings().gcp_project_id)
    return _db


def _col():
    return _get_db().collection(get_settings().firestore_collection)


# ── Event bus in-memory ──────────────────────────────────────────────────────
# Un run -> molte code (una per ogni client SSE connesso).
_subscribers: dict[str, set[asyncio.Queue]] = {}
_lock = asyncio.Lock()


async def subscribe(run_id: str) -> asyncio.Queue:
    """Un client SSE chiama questo per ricevere gli eventi live."""
    async with _lock:
        q: asyncio.Queue = asyncio.Queue()
        _subscribers.setdefault(run_id, set()).add(q)
        return q


async def unsubscribe(run_id: str, q: asyncio.Queue) -> None:
    async with _lock:
        if run_id in _subscribers:
            _subscribers[run_id].discard(q)
            if not _subscribers[run_id]:
                del _subscribers[run_id]


def _publish_sync(run_id: str, event: dict[str, Any]) -> None:
    """Pubblica sull'event bus (chiamabile da contesto sincrono)."""
    subs = _subscribers.get(run_id, set())
    for q in list(subs):
        try:
            q.put_nowait(event)
        except asyncio.QueueFull:
            pass


# ── API pubblica ─────────────────────────────────────────────────────────────

def create_run(request_text: str, etl_hint: str | None = None, model: str | None = None) -> str:
    """Crea un nuovo run su Firestore e ne restituisce l'ID."""
    run_id = uuid.uuid4().hex[:12]
    _col().document(run_id).set({
        "id": run_id,
        "status": "pending",
        "request": request_text,
        "etl_hint": etl_hint,
        "model": model,
        "created_at": firestore.SERVER_TIMESTAMP,
        "updated_at": firestore.SERVER_TIMESTAMP,
        "events": [],
        "artifacts": {},
        "summary": None,
    })
    return run_id


def get_run(run_id: str) -> dict[str, Any] | None:
    doc = _col().document(run_id).get()
    return doc.to_dict() if doc.exists else None


def delete_run(run_id: str) -> bool:
    """Elimina un run dalla storia. Ritorna True se era presente."""
    ref = _col().document(run_id)
    snap = ref.get()
    if not snap.exists:
        return False
    ref.delete()
    # Rimuovi eventuali sottoscrittori pendenti (se ancora vivi).
    subs = _subscribers.pop(run_id, set())
    for q in list(subs):
        try:
            q.put_nowait({"type": "status", "status": "deleted"})
        except asyncio.QueueFull:
            pass
    return True


def list_runs(limit: int = 50) -> list[dict[str, Any]]:
    q = _col().order_by("created_at", direction=firestore.Query.DESCENDING).limit(limit)
    return [d.to_dict() for d in q.stream()]


def set_status(run_id: str, status: str, summary: str | None = None) -> None:
    patch: dict[str, Any] = {
        "status": status,
        "updated_at": firestore.SERVER_TIMESTAMP,
    }
    if summary is not None:
        patch["summary"] = summary
    _col().document(run_id).update(patch)
    _publish_sync(run_id, {"type": "status", "status": status, "summary": summary})


def append_event(run_id: str, event_type: str, payload: dict[str, Any]) -> None:
    """Scrive un evento nel run (Firestore + bus in-memory).

    No-op se run_id è vuoto: i tool possono essere chiamati anche fuori da un run
    (es. endpoint /api/etls), e in quel caso non abbiamo un documento su cui scrivere.
    """
    if not run_id:
        return
    event = {
        "type": event_type,
        "ts": time.time(),
        **payload,
    }
    _col().document(run_id).update({
        "events": firestore.ArrayUnion([event]),
        "updated_at": firestore.SERVER_TIMESTAMP,
    })
    _publish_sync(run_id, event)


def save_artifact(run_id: str, kind: str, data: Any) -> None:
    """Salva un artefatto strutturato (piano test, risultati, fix, PR, report)."""
    if not run_id:
        return
    _col().document(run_id).update({
        f"artifacts.{kind}": data,
        "updated_at": firestore.SERVER_TIMESTAMP,
    })
    _publish_sync(run_id, {"type": "artifact", "kind": kind, "data": data})
    # Teniamo traccia anche come evento, per ricostruire la timeline.
    _col().document(run_id).update({
        "events": firestore.ArrayUnion([{
            "type": "artifact",
            "kind": kind,
            "ts": time.time(),
        }])
    })

"""
Runner che fa girare l'agente ADK per un dato run_id.

Esegue in background (task asyncio spawnato da FastAPI), setta il ContextVar
`CURRENT_RUN_ID` così che i tool possano scrivere eventi e artefatti nel run
giusto, e inoltra gli eventi del Runner ADK (token streaming, tool_call,
tool_response) verso il bus via `store.append_event`.
"""

from __future__ import annotations

import asyncio
import traceback

from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

from app.agent import build_agent
from app.config import get_settings
from app.store import CURRENT_RUN_ID, append_event, set_status


APP_NAME = "etl-qa-agent"
_USER_ID = "web"  # tutti i run sono anonimi, stessa "sessione utente"


async def execute_run(run_id: str, request_text: str, etl_hint: str | None, model: str | None = None) -> None:
    """Esegue un run in background, inoltrando gli eventi nel bus."""
    token = CURRENT_RUN_ID.set(run_id)
    try:
        set_status(run_id, "running")

        agent = build_agent(model=model)
        session_service = InMemorySessionService()
        await session_service.create_session(
            app_name=APP_NAME,
            user_id=_USER_ID,
            session_id=run_id,
        )
        runner = Runner(
            agent=agent,
            app_name=APP_NAME,
            session_service=session_service,
        )

        user_message = request_text
        if etl_hint:
            user_message = f"ETL di riferimento: {etl_hint}\n\nRichiesta:\n{request_text}"

        content = types.Content(
            role="user",
            parts=[types.Part.from_text(text=user_message)],
        )

        async for event in runner.run_async(
            user_id=_USER_ID,
            session_id=run_id,
            new_message=content,
        ):
            _forward_event(run_id, event)

        set_status(run_id, "completed")

    except Exception as e:
        append_event(run_id, "error", {"message": str(e), "trace": traceback.format_exc()[-2000:]})
        set_status(run_id, "failed", summary=str(e))
    finally:
        CURRENT_RUN_ID.reset(token)


def _forward_event(run_id: str, event) -> None:
    """
    Estrae i bit interessanti da un ADK Event e li spinge nel bus.

    Gli eventi ADK contengono `content.parts`: ogni part può essere testo
    (ragionamento/risposta finale), function_call (tool invocato) o
    function_response (risultato del tool).
    """
    content = getattr(event, "content", None)
    if not content or not getattr(content, "parts", None):
        return

    for part in content.parts:
        text = getattr(part, "text", None)
        if text:
            append_event(run_id, "agent_text", {"text": text, "final": _is_final(event)})
            continue

        fc = getattr(part, "function_call", None)
        if fc:
            append_event(run_id, "tool_call", {
                "name": fc.name,
                "args": dict(fc.args) if fc.args else {},
            })
            continue

        fr = getattr(part, "function_response", None)
        if fr:
            append_event(run_id, "tool_response", {
                "name": fr.name,
                "preview": _preview(fr.response),
            })


def _is_final(event) -> bool:
    """`is_final_response` in ADK può essere un metodo o una property: proteggiti."""
    try:
        attr = getattr(event, "is_final_response", False)
        return bool(attr() if callable(attr) else attr)
    except Exception:
        return False


def _preview(obj, limit: int = 600) -> str:
    try:
        s = str(obj)
    except Exception:
        return "<unprintable>"
    return s[:limit] + ("…" if len(s) > limit else "")


def launch_background(run_id: str, request_text: str, etl_hint: str | None, model: str | None = None) -> None:
    """Lancia il run in background senza attendere (usato da FastAPI)."""
    asyncio.create_task(execute_run(run_id, request_text, etl_hint, model))

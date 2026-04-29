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
from app.store import (
    CURRENT_RUN_ID,
    append_event,
    register_task,
    set_status,
    unregister_task,
)


APP_NAME = "etl-qa-agent"
_USER_ID = "web"  # tutti i run sono anonimi, stessa "sessione utente"

# Catena di fallback in caso di 429 RESOURCE_EXHAUSTED. Ordinata per qualità
# decrescente: se Pro è saturo passiamo a Flash, poi a Flash 2.0.
_FALLBACK_CHAIN = [
    "gemini-3.1-pro-preview",
    "gemini-2.5-pro",
    "gemini-2.5-flash",
    "gemini-2.0-flash-001",
]
_BACKOFF_BEFORE_FALLBACK_S = 2.0


async def execute_run(run_id: str, request_text: str, etl_hint: str | None, model: str | None = None) -> None:
    """Esegue un run in background, inoltrando gli eventi nel bus.

    Su 429 RESOURCE_EXHAUSTED, ricade automaticamente sul modello successivo
    della catena `_FALLBACK_CHAIN` riusando la stessa `InMemorySessionService`,
    così i tool call già completati restano in sessione e non vengono rieseguiti.
    """
    token = CURRENT_RUN_ID.set(run_id)
    try:
        set_status(run_id, "running")

        session_service = InMemorySessionService()
        await session_service.create_session(
            app_name=APP_NAME,
            user_id=_USER_ID,
            session_id=run_id,
        )

        user_message = request_text
        if etl_hint:
            user_message = f"ETL di riferimento: {etl_hint}\n\nRichiesta:\n{request_text}"

        initial_content = types.Content(
            role="user",
            parts=[types.Part.from_text(text=user_message)],
        )

        s = get_settings()
        starting_model = model or s.gemini_model
        models_to_try = _build_fallback_chain(starting_model)

        # Al primo giro mandiamo la richiesta dell'utente; ai retry una breve
        # nota "continua" perché la richiesta originale è già nello state della
        # session ADK e non va duplicata.
        next_message: types.Content = initial_content
        last_error: BaseException | None = None

        for idx, current_model in enumerate(models_to_try):
            if idx > 0:
                append_event(run_id, "agent_text", {
                    "text": (
                        f"\n\n---\n**[Sistema]** Quota esaurita sul modello precedente "
                        f"(429). Fallback su `{current_model}`, riprendo dal punto in cui "
                        f"mi sono fermato.\n\n---\n\n"
                    ),
                    "final": False,
                })
                await asyncio.sleep(_BACKOFF_BEFORE_FALLBACK_S)

            agent = build_agent(model=current_model)
            runner = Runner(
                agent=agent,
                app_name=APP_NAME,
                session_service=session_service,
            )

            try:
                async for event in runner.run_async(
                    user_id=_USER_ID,
                    session_id=run_id,
                    new_message=next_message,
                ):
                    _forward_event(run_id, event)
                set_status(run_id, "completed")
                return
            except BaseException as e:
                if not _is_quota_exhausted(e):
                    raise
                last_error = e
                next_message = types.Content(
                    role="user",
                    parts=[types.Part.from_text(
                        text="Continua il workflow dal punto in cui ti sei fermato."
                    )],
                )

        # Tutta la catena ha fallito con 429.
        msg = (
            f"Quota esaurita su tutti i modelli di fallback "
            f"({', '.join(models_to_try)}). Riprova più tardi."
        )
        append_event(run_id, "error", {"message": msg, "trace": str(last_error)[-2000:] if last_error else ""})
        set_status(run_id, "failed", summary=msg)
        return

    except asyncio.CancelledError:
        # Cancellazione richiesta dall'utente tramite il pulsante "Interrompi".
        append_event(run_id, "error", {"message": "Run interrotto dall'utente."})
        set_status(run_id, "cancelled", summary="Run interrotto dall'utente.")
        # Non rilanciamo: il task termina in modo pulito.
    except Exception as e:
        append_event(run_id, "error", {"message": str(e), "trace": traceback.format_exc()[-2000:]})
        set_status(run_id, "failed", summary=str(e))
    finally:
        CURRENT_RUN_ID.reset(token)
        unregister_task(run_id)


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


def _build_fallback_chain(starting_model: str) -> list[str]:
    """Catena di modelli da provare in caso di 429.

    Se il modello scelto è in `_FALLBACK_CHAIN`, parti da lì e scendi di qualità.
    Se è custom (es. anteprima), prova prima quello e poi tutta la catena standard.
    """
    if starting_model in _FALLBACK_CHAIN:
        idx = _FALLBACK_CHAIN.index(starting_model)
        return _FALLBACK_CHAIN[idx:]
    return [starting_model] + _FALLBACK_CHAIN


def _is_quota_exhausted(exc: BaseException) -> bool:
    """Riconosce un 429 RESOURCE_EXHAUSTED da qualunque livello dello stack.

    L'eccezione può arrivare da `google.api_core.exceptions.ResourceExhausted`
    (chiamate gRPC), da `google.genai.errors.ClientError` (chiamate REST della
    SDK genai) o, in extremis, essere wrappata da ADK in qualcos'altro: per
    quest'ultimo caso si fa string-match sul messaggio.
    """
    try:
        from google.api_core import exceptions as gax_exceptions
        if isinstance(exc, gax_exceptions.ResourceExhausted):
            return True
    except ImportError:
        pass

    try:
        from google.genai import errors as genai_errors  # type: ignore
        if isinstance(exc, genai_errors.ClientError):
            code = getattr(exc, "code", None) or getattr(exc, "status_code", None)
            if code == 429:
                return True
            if "RESOURCE_EXHAUSTED" in str(exc):
                return True
    except ImportError:
        pass

    msg = str(exc)
    return "RESOURCE_EXHAUSTED" in msg or " 429 " in msg or msg.startswith("429 ")


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
    task = asyncio.create_task(execute_run(run_id, request_text, etl_hint, model))
    register_task(run_id, task)

"""
Runner che fa girare l'agente ADK per un dato run_id.

Esegue in background (task asyncio spawnato da FastAPI), setta il ContextVar
`CURRENT_RUN_ID` così che i tool possano scrivere eventi e artefatti nel run
giusto, e inoltra gli eventi del Runner ADK (token streaming, tool_call,
tool_response) verso il bus via `store.append_event`.

Strategia anti-429 (RESOURCE_EXHAUSTED su Vertex AI):
 1. Retry con backoff esponenziale sullo stesso modello (config-driven).
 2. Se esauriti i tentativi e il modello primario è *-pro (quote tight),
    fallback automatico al modello `gemini_fallback_model` (default Flash)
    e altro giro di retry. Ogni tentativo è segnalato nello stream agente.

Vedi: https://google.github.io/adk-docs/agents/models/google-gemini/#error-code-429-resource_exhausted
"""

from __future__ import annotations

import asyncio
import traceback

from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.api_core.exceptions import ResourceExhausted
from google.genai import types

from app.agent import build_agent
from app.config import get_settings
from app.store import CURRENT_RUN_ID, append_event, set_status


APP_NAME = "etl-qa-agent"
_USER_ID = "web"  # tutti i run sono anonimi, stessa "sessione utente"


async def execute_run(
    run_id: str,
    request_text: str,
    etl_hint: str | None,
    model_override: str | None = None,
) -> None:
    """Esegue un run in background, con retry su 429 e fallback di modello.

    `model_override` (se passato) ha precedenza sul default da env,
    ed è tipicamente scelto dall'utente nell'UI.
    """
    token = CURRENT_RUN_ID.set(run_id)
    try:
        set_status(run_id, "running")
        s = get_settings()

        # Catena di modelli: primario (override o env) + fallback (se diverso)
        primary = model_override or s.gemini_model
        models_chain: list[str] = [primary]
        if s.gemini_fallback_model and s.gemini_fallback_model != primary:
            models_chain.append(s.gemini_fallback_model)

        last_err: Exception | None = None
        attempt_counter = 0

        for model_idx, model in enumerate(models_chain):
            for attempt in range(s.retry_max_attempts):
                attempt_counter += 1
                try:
                    await _run_agent_once(
                        run_id=run_id,
                        request_text=request_text,
                        etl_hint=etl_hint,
                        model=model,
                        session_suffix=f"-a{attempt_counter}",
                    )
                    set_status(run_id, "completed")
                    return

                except ResourceExhausted as e:
                    last_err = e
                    is_last_attempt_this_model = attempt == s.retry_max_attempts - 1
                    is_last_model = model_idx == len(models_chain) - 1

                    if is_last_attempt_this_model and is_last_model:
                        # Fine dei tentativi: esci dal loop e solleva sotto
                        raise

                    if is_last_attempt_this_model:
                        # Passa al prossimo modello (fallback)
                        next_model = models_chain[model_idx + 1]
                        _notify(
                            run_id,
                            f"Quote Vertex AI esaurite su `{model}` dopo "
                            f"{s.retry_max_attempts} tentativi. "
                            f"Fallback a `{next_model}` e riparto.",
                        )
                        break  # esce dal for interno → prossimo modello

                    delay = s.retry_base_delay_s * (3 ** attempt)
                    _notify(
                        run_id,
                        f"Vertex AI 429 (RESOURCE_EXHAUSTED) su `{model}` "
                        f"[tentativo {attempt + 1}/{s.retry_max_attempts}]. "
                        f"Ritento tra {delay:.0f}s…",
                    )
                    await asyncio.sleep(delay)

        # Se siamo qui, i tentativi sono finiti senza successo né eccezione
        raise last_err or RuntimeError("Run terminato senza esito")

    except Exception as e:
        append_event(run_id, "error", {
            "message": str(e),
            "trace": traceback.format_exc()[-2000:],
        })
        # Messaggio user-friendly nel summary
        if isinstance(e, ResourceExhausted):
            summary = (
                "Quote Vertex AI esaurite su tutti i modelli provati. "
                "Riprova fra qualche minuto o aumenta la quota nel progetto."
            )
        else:
            summary = str(e)
        set_status(run_id, "failed", summary=summary)
    finally:
        CURRENT_RUN_ID.reset(token)


async def _run_agent_once(
    *,
    run_id: str,
    request_text: str,
    etl_hint: str | None,
    model: str,
    session_suffix: str,
) -> None:
    """Un singolo tentativo completo di esecuzione dell'agente."""
    agent = build_agent(model_override=model)
    session_service = InMemorySessionService()
    session_id = f"{run_id}{session_suffix}"
    await session_service.create_session(
        app_name=APP_NAME,
        user_id=_USER_ID,
        session_id=session_id,
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
        session_id=session_id,
        new_message=content,
    ):
        _forward_event(run_id, event)


def _notify(run_id: str, message: str) -> None:
    """Manda un avviso allo stream dell'agente in modo visibile nella UI."""
    append_event(run_id, "agent_text", {"text": f"\n\n⚠️ {message}\n\n"})


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


def launch_background(
    run_id: str,
    request_text: str,
    etl_hint: str | None,
    model_override: str | None = None,
) -> None:
    """Lancia il run in background senza attendere (usato da FastAPI)."""
    asyncio.create_task(
        execute_run(run_id, request_text, etl_hint, model_override=model_override)
    )

"""
Tool esposti all'agente ADK.

Sono semplici funzioni Python con type hint + docstring: ADK le wrapper
in `FunctionTool` automaticamente. Gli eventi e gli artefatti vengono scritti
via `store.CURRENT_RUN_ID` + `store.save_artifact / append_event`.

Nessuna modalità mock: tutte le chiamate sono reali (BigQuery, GitHub).
"""

from __future__ import annotations

import time
from typing import Any

from github import Github, GithubException
from google.cloud import bigquery

from app.config import get_settings
from app.store import CURRENT_RUN_ID, append_event, save_artifact


# ── Client lazy (una istanza per processo) ──────────────────────────────────
_bq: bigquery.Client | None = None
_gh: Github | None = None


def _bq_client() -> bigquery.Client:
    global _bq
    if _bq is None:
        _bq = bigquery.Client(project=get_settings().gcp_project_id)
    return _bq


def _gh_repo():
    global _gh
    s = get_settings()
    if _gh is None:
        _gh = Github(s.github_token) if s.github_token else Github()
    return _gh.get_repo(s.github_repo)


def _run_id() -> str:
    return CURRENT_RUN_ID.get()


# ═════════════════════════════════════════════════════════════════════════════
# ETL DISCOVERY — esplora il repo GitHub con gli SQL
# ═════════════════════════════════════════════════════════════════════════════

def list_available_etls() -> dict[str, Any]:
    """
    Elenca le cartelle ETL disponibili nel repository SQL su GitHub.

    Returns:
        Dict con `etls`: lista di nomi di cartelle (es. "etl-banca-italiana").
    """
    repo = _gh_repo()
    s = get_settings()
    contents = repo.get_contents("", ref=s.github_branch)
    etls = [c.name for c in contents if c.type == "dir" and not c.name.startswith(".")]
    append_event(_run_id(), "tool_end", {"name": "list_available_etls", "count": len(etls)})
    return {"etls": etls, "repo": s.github_repo, "branch": s.github_branch}


def read_sql_code(etl_name: str) -> dict[str, Any]:
    """
    Legge tutti i file .sql dentro la cartella di un ETL sul repo GitHub.

    Args:
        etl_name: Nome della cartella ETL (es. "etl-banca-italiana").

    Returns:
        Dict con `files`: lista di {path, content} dei file SQL trovati.
    """
    repo = _gh_repo()
    s = get_settings()
    files: list[dict[str, str]] = []

    def _walk(path: str) -> None:
        for c in repo.get_contents(path, ref=s.github_branch):
            if c.type == "dir":
                _walk(c.path)
            elif c.name.endswith(".sql"):
                files.append({
                    "path": c.path,
                    "content": c.decoded_content.decode("utf-8", errors="replace"),
                })

    try:
        _walk(etl_name)
    except GithubException as e:
        return {"error": f"Impossibile leggere ETL '{etl_name}': {e}"}

    append_event(_run_id(), "tool_end", {"name": "read_sql_code", "etl": etl_name, "files": len(files)})
    return {"etl": etl_name, "files": files}


# ═════════════════════════════════════════════════════════════════════════════
# BIGQUERY — esegue query read-only sul dataset banca_raw
# ═════════════════════════════════════════════════════════════════════════════

def execute_bigquery_query(query: str, purpose: str) -> dict[str, Any]:
    """
    Esegue una query BigQuery read-only. Usala per verificare regole business,
    null check, duplicati, integrità referenziale, correttezza dei join.

    Args:
        query: SQL SELECT (solo SELECT / WITH ammessi).
        purpose: Una frase che descrive cosa stai testando.

    Returns:
        Dict con `columns`, `rows` (max 50), `row_count`, oppure `error`.
    """
    append_event(_run_id(), "tool_start", {"name": "execute_bigquery_query", "purpose": purpose})

    # Guardrail: solo read-only
    stripped = query.strip().upper()
    if not (stripped.startswith("SELECT") or stripped.startswith("WITH")):
        return {"error": "Solo query SELECT/WITH sono ammesse."}

    try:
        job = _bq_client().query(query)
        results = list(job.result(max_results=200))
    except Exception as e:
        err = str(e)
        append_event(_run_id(), "tool_end", {"name": "execute_bigquery_query", "error": err[:200]})
        return {"error": err}

    if not results:
        append_event(_run_id(), "tool_end", {"name": "execute_bigquery_query", "rows": 0})
        return {"columns": [], "rows": [], "row_count": 0}

    columns = list(results[0].keys())
    rows = [[_to_jsonable(r[c]) for c in columns] for r in results[:50]]
    append_event(_run_id(), "tool_end", {"name": "execute_bigquery_query", "rows": len(results)})

    return {
        "columns": columns,
        "rows": rows,
        "row_count": len(results),
        "truncated": len(results) > 50,
    }


def _to_jsonable(v: Any) -> Any:
    if v is None or isinstance(v, (str, int, float, bool)):
        return v
    return str(v)


# ═════════════════════════════════════════════════════════════════════════════
# GITHUB — apre una PR con il fix
# ═════════════════════════════════════════════════════════════════════════════

def create_github_pr(
    branch_name: str,
    file_path: str,
    new_content: str,
    pr_title: str,
    pr_body: str,
    commit_message: str,
) -> dict[str, Any]:
    """
    Crea un branch, committa il file corretto e apre una Pull Request.

    Eseguita in un'unica chiamata per semplicità: branch -> commit -> PR.

    Args:
        branch_name: Nome del branch (es. "fix/etl-vendite-arrotondamento").
        file_path: Path del file SQL dentro il repo (es. "etl-banca/stg_clienti.sql").
        new_content: Contenuto corretto completo del file.
        pr_title: Titolo della PR (tipo "fix(etl-vendite): corretto CONCAT nome").
        pr_body: Body della PR in Markdown (italiano).
        commit_message: Messaggio di commit.

    Returns:
        Dict con `url`, `number`, `branch` della PR creata, oppure `error`.
    """
    append_event(_run_id(), "tool_start", {"name": "create_github_pr", "branch": branch_name})
    repo = _gh_repo()
    s = get_settings()

    try:
        # 1. Crea branch da base
        base = repo.get_branch(s.github_branch)
        try:
            repo.create_git_ref(ref=f"refs/heads/{branch_name}", sha=base.commit.sha)
        except GithubException as e:
            if e.status != 422:  # 422 = branch già esistente, ok
                raise

        # 2. Crea o aggiorna file sul branch
        try:
            existing = repo.get_contents(file_path, ref=branch_name)
            repo.update_file(
                path=file_path,
                message=commit_message,
                content=new_content,
                sha=existing.sha,
                branch=branch_name,
            )
        except GithubException:
            repo.create_file(
                path=file_path,
                message=commit_message,
                content=new_content,
                branch=branch_name,
            )

        # 3. Apri PR
        pr = repo.create_pull(
            title=pr_title,
            body=pr_body,
            head=branch_name,
            base=s.github_branch,
        )

        result = {
            "url": pr.html_url,
            "number": pr.number,
            "branch": branch_name,
        }
        save_artifact(_run_id(), "pr_opened", result)
        return result

    except Exception as e:
        err = f"Errore apertura PR: {e}"
        append_event(_run_id(), "tool_end", {"name": "create_github_pr", "error": err[:200]})
        return {"error": err}


# ═════════════════════════════════════════════════════════════════════════════
# ARTIFACT EMITTERS — pubblicano output strutturati al frontend
# ═════════════════════════════════════════════════════════════════════════════

def emit_test_plan(tests: list[dict[str, Any]], rationale: str) -> dict[str, str]:
    """
    Pubblica il piano di test al frontend. Chiamala UNA VOLTA dopo aver pianificato
    i test ma prima di eseguirli.

    Args:
        tests: Lista di test. Ogni test ha: id, name, category, priority,
               description, query, pass_condition (es. "zero_rows").
        rationale: Riga di motivazione sul perché hai scelto questi test.

    Returns:
        {"status": "ok"}.
    """
    save_artifact(_run_id(), "test_plan", {"tests": tests, "rationale": rationale})
    return {"status": "ok"}


def emit_test_results(results: list[dict[str, Any]]) -> dict[str, str]:
    """
    Pubblica i risultati dell'esecuzione dei test al frontend.

    Args:
        results: Lista di risultati. Ogni item: id, name, status
                 ("PASS"|"FAIL"|"ERROR"|"IGNORED"), evidence (testo breve),
                 row_count (opzionale).

    Returns:
        {"status": "ok"}.
    """
    save_artifact(_run_id(), "test_results", {"results": results})
    return {"status": "ok"}


def emit_fix_proposal(
    root_cause: str,
    file_path: str,
    original_sql: str,
    fixed_sql: str,
    fixes_tests: list[str],
    validation_passed: bool,
    validation_notes: str,
) -> dict[str, str]:
    """
    Pubblica la proposta di fix al frontend.

    Args:
        root_cause: Spiegazione della causa radice (italiano, 2-5 righe).
        file_path: Path del file SQL da correggere nel repo.
        original_sql: SQL originale completo.
        fixed_sql: SQL corretto completo.
        fixes_tests: Lista degli id dei test che questo fix dovrebbe risolvere.
        validation_passed: True se hai evidenza concreta che il fix funzioni.
        validation_notes: Note sulla validazione effettuata.

    Returns:
        {"status": "ok"}.
    """
    save_artifact(_run_id(), "fix_proposal", {
        "root_cause": root_cause,
        "file_path": file_path,
        "original_sql": original_sql,
        "fixed_sql": fixed_sql,
        "fixes_tests": fixes_tests,
        "validation_passed": validation_passed,
        "validation_notes": validation_notes,
    })
    return {"status": "ok"}


def save_final_report(markdown: str) -> dict[str, str]:
    """
    Salva il report finale Markdown del run. È l'ultimo step prima del done.

    Args:
        markdown: Report completo in Markdown (italiano).

    Returns:
        {"status": "ok"}.
    """
    save_artifact(_run_id(), "final_report", {"markdown": markdown, "ts": time.time()})
    return {"status": "ok"}

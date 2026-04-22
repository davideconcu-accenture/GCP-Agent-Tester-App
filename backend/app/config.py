"""Configurazione centralizzata. Tutto viene letto da variabili d'ambiente."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Google Cloud / Vertex AI
    # NB: us-central1 ha quote Gemini MOLTO più ampie di us-west1.
    # Flash è più che sufficiente per tool-calling + ragionamento su SQL strutturato
    # e ha quote ~10x rispetto a Pro: scelto come default per ridurre 429.
    gcp_project_id: str = "phrasal-method-484415-g7"
    gcp_location: str = "us-central1"
    gemini_model: str = "gemini-2.5-flash"

    # Fallback automatico se il modello principale satura (429 RESOURCE_EXHAUSTED).
    # Se il primario è già Flash, questo valore viene usato comunque come ulteriore tentativo.
    gemini_fallback_model: str = "gemini-2.5-flash"

    # Retry policy per 429 Vertex AI
    retry_max_attempts: int = 3
    retry_base_delay_s: float = 5.0   # 5s, 15s, 45s

    # BigQuery
    bq_dataset: str = "banca_raw"

    # GitHub — repo ETL (stesso per lettura SQL e apertura PR)
    github_token: str = ""
    github_repo: str = "davideconcu-accenture/Agent-GCP-ETL-Code"
    github_branch: str = "main"

    # Firestore (stato run)
    firestore_collection: str = "etl_agent_runs"

    # Runtime
    max_agent_iterations: int = 40
    max_output_tokens: int = 8192


@lru_cache
def get_settings() -> Settings:
    return Settings()


# Catalogo modelli offerto nella UI. Ordine = ordine mostrato.
AVAILABLE_MODELS: list[dict[str, str]] = [
    {
        "id": "gemini-2.5-flash",
        "label": "Gemini 2.5 Flash",
        "desc": "Veloce ed economico, quote ampie — raccomandato per ETL QA",
        "tier": "balanced",
    },
    {
        "id": "gemini-2.5-flash-lite",
        "label": "Gemini 2.5 Flash Lite",
        "desc": "Massima velocità e costo minimo, ragionamento ridotto",
        "tier": "fast",
    },
    {
        "id": "gemini-2.5-pro",
        "label": "Gemini 2.5 Pro",
        "desc": "Ragionamento massimo, ma quote strette (429 frequenti)",
        "tier": "pro",
    },
    {
        "id": "gemini-2.0-flash-001",
        "label": "Gemini 2.0 Flash",
        "desc": "Generazione precedente, fallback stabile",
        "tier": "fast",
    },
]

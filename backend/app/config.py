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
    gcp_project_id: str = "phrasal-method-484415-g7"
    gcp_location: str = "us-west1"
    gemini_model: str = "gemini-2.5-pro"

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

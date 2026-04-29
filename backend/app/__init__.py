"""
Inizializzazione del pacchetto `app`.

Carica il `.env` e indirizza il client `google-genai` (usato da ADK) verso
Vertex AI invece dell'API Gemini pubblica. Senza queste env vars la libreria
cerca una `GOOGLE_API_KEY` e fallisce con:
    "No API key was provided. Please pass a valid API key."
"""

import os

from dotenv import load_dotenv

load_dotenv()

# Indirizza google-genai su Vertex AI (no API key, usa ADC).
os.environ.setdefault("GOOGLE_GENAI_USE_VERTEXAI", "TRUE")
os.environ.setdefault(
    "GOOGLE_CLOUD_PROJECT",
    os.environ.get("GCP_PROJECT_ID", "phrasal-method-484415-g7"),
)
os.environ.setdefault(
    "GOOGLE_CLOUD_LOCATION",
    os.environ.get("GCP_LOCATION", "us-west1"),
)

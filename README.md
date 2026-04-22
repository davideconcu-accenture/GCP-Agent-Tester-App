# ETL QA Agent

Agente autonomo che riceve una richiesta/segnalazione, pianifica una batteria di test
sugli ETL BigQuery, li esegue, interpreta i risultati, individua la causa nel codice
SQL su GitHub e apre una Pull Request con il fix.

## Architettura

- **Agente**: singolo `LlmAgent` Google ADK su Vertex AI (Gemini 2.5 Pro).
- **Backend**: FastAPI con SSE streaming. Stato e storico in Firestore.
- **Frontend**: Next.js 15 + shadcn/ui + Tailwind.
- **Deploy**: singolo container Cloud Run (il backend serve anche gli asset statici del frontend).

## Struttura

```
backend/       FastAPI + ADK agent + tools
frontend/      Next.js 15 (App Router)
Dockerfile     multi-stage (build frontend -> embed nel backend)
deploy.sh      gcloud run deploy
```

## Setup locale

```bash
cp .env.example .env        # compila GITHUB_TOKEN
gcloud auth application-default login
gcloud auth application-default set-quota-project phrasal-method-484415-g7

# Backend
cd backend
uv sync                      # o: pip install -e .
uv run uvicorn app.main:app --reload --port 8080

# Frontend (altro terminale)
cd frontend
pnpm install
pnpm dev
```

## Deploy

```bash
./deploy.sh
```

Il token GitHub viene letto da Secret Manager (`etl-agent-github-token`).

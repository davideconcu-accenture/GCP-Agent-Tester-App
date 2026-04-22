# ─── Stage 1: build frontend (Next.js static export) ─────────────────────────
FROM node:20-alpine AS frontend
WORKDIR /fe
COPY frontend/package.json ./
RUN npm install --no-audit --no-fund --legacy-peer-deps
COPY frontend/ ./
RUN npm run build

# ─── Stage 2: backend runtime ────────────────────────────────────────────────
FROM python:3.11-slim AS backend
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
      curl build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install deps
COPY backend/pyproject.toml ./
RUN pip install --no-cache-dir \
    "fastapi>=0.115.0" \
    "uvicorn[standard]>=0.32.0" \
    "pydantic>=2.9.0" \
    "pydantic-settings>=2.5.0" \
    "python-dotenv>=1.0.0" \
    "google-adk>=0.4.0" \
    "google-cloud-aiplatform>=1.70.0" \
    "google-cloud-bigquery>=3.25.0" \
    "google-cloud-firestore>=2.19.0" \
    "PyGithub>=2.4.0"

# App code
COPY backend/app ./app

# Static Next.js export dallo stage 1
COPY --from=frontend /fe/out ./static

EXPOSE 8080
ENV PORT=8080

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]

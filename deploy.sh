#!/bin/bash
# Deploy su Cloud Run — singolo container backend + frontend statico.
#
# Prerequisiti una-tantum:
#   gcloud services enable run.googleapis.com cloudbuild.googleapis.com \
#     firestore.googleapis.com aiplatform.googleapis.com bigquery.googleapis.com \
#     secretmanager.googleapis.com --project=phrasal-method-484415-g7
#
#   # Firestore in modalità Native (una volta sola per progetto):
#   gcloud firestore databases create --location=eur3 --project=phrasal-method-484415-g7
#
#   # Token GitHub in Secret Manager:
#   echo -n "$GITHUB_TOKEN" | gcloud secrets create etl-agent-github-token \
#     --data-file=- --project=phrasal-method-484415-g7
#
# Ruoli service account runtime (Cloud Run default):
#   - roles/aiplatform.user
#   - roles/bigquery.jobUser + bigquery.dataViewer sul dataset banca_raw
#   - roles/datastore.user (Firestore)
#   - roles/secretmanager.secretAccessor sul secret etl-agent-github-token

set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:-phrasal-method-484415-g7}"
REGION="${CLOUD_RUN_REGION:-europe-west1}"
SERVICE="${SERVICE_NAME:-etl-qa-agent}"
IMAGE="gcr.io/$PROJECT_ID/$SERVICE"

echo "→ Build immagine $IMAGE"
gcloud builds submit --tag "$IMAGE" --project "$PROJECT_ID" .

echo "→ Deploy su Cloud Run ($REGION)"
gcloud run deploy "$SERVICE" \
  --image "$IMAGE" \
  --region "$REGION" \
  --project "$PROJECT_ID" \
  --platform managed \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --port 8080 \
  --timeout 3600 \
  --concurrency 20 \
  --max-instances 3 \
  --set-env-vars "GCP_PROJECT_ID=$PROJECT_ID,GCP_LOCATION=us-west1,GEMINI_MODEL=gemini-2.5-pro,BQ_DATASET=banca_raw,GITHUB_REPO=davideconcu-accenture/Agent-GCP-ETL-Code,GITHUB_BRANCH=main,FIRESTORE_COLLECTION=etl_agent_runs" \
  --set-secrets "GITHUB_TOKEN=etl-agent-github-token:latest"

URL=$(gcloud run services describe "$SERVICE" --region "$REGION" --project "$PROJECT_ID" --format 'value(status.url)')
echo
echo "✓ Deploy completato: $URL"

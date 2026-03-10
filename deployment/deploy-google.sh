#!/usr/bin/env bash
set -euo pipefail

# Google Cloud Run deploy script.
# Usage:
#   PROJECT_ID=your-project REGION=asia-south1 SERVICE_NAME=pavavak \
#   bash deployment/deploy-google.sh

PROJECT_ID="${PROJECT_ID:-}"
REGION="${REGION:-asia-south1}"
SERVICE_NAME="${SERVICE_NAME:-pavavak}"
IMAGE_NAME="${IMAGE_NAME:-gcr.io/${PROJECT_ID}/${SERVICE_NAME}}"
PORT="${PORT:-3000}"

if [[ -z "$PROJECT_ID" ]]; then
  echo "PROJECT_ID is required."
  echo "Example:"
  echo "PROJECT_ID=my-gcp-project REGION=asia-south1 SERVICE_NAME=pavavak bash deployment/deploy-google.sh"
  exit 1
fi

if ! command -v gcloud >/dev/null 2>&1; then
  echo "gcloud CLI is required."
  exit 1
fi

echo "[1/4] Set gcloud project"
gcloud config set project "$PROJECT_ID"

echo "[2/4] Build container image"
gcloud builds submit --tag "$IMAGE_NAME" .

echo "[3/4] Deploy to Cloud Run"
gcloud run deploy "$SERVICE_NAME" \
  --image "$IMAGE_NAME" \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --port "$PORT"

echo "[4/4] Show service URL"
gcloud run services describe "$SERVICE_NAME" \
  --region "$REGION" \
  --format='value(status.url)'

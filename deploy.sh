#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# One-time GCP setup + deploy script for the Mark & Ari wedding website.
# Run each section manually the first time, then use Cloud Build for deploys.
# ---------------------------------------------------------------------------
set -euo pipefail

PROJECT_ID="${1:?Usage: ./deploy.sh <PROJECT_ID> [REGION]}"
REGION="${2:-us-central1}"
SERVICE="wedding-website"
REPO="wedding"
SQL_INSTANCE="wedding-db"
DB_NAME="wedding"
DB_USER="wedding_app"
IMAGE="$REGION-docker.pkg.dev/$PROJECT_ID/$REPO/$SERVICE"

echo "==> Project: $PROJECT_ID  Region: $REGION"

# ── 1. Enable APIs ──────────────────────────────────────────────────────────
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com \
  --project="$PROJECT_ID"

# ── 2. Artifact Registry repo ───────────────────────────────────────────────
gcloud artifacts repositories create "$REPO" \
  --repository-format=docker \
  --location="$REGION" \
  --project="$PROJECT_ID" 2>/dev/null || echo "Repo already exists."

# ── 3. Cloud SQL (PostgreSQL 15) ────────────────────────────────────────────
gcloud sql instances create "$SQL_INSTANCE" \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region="$REGION" \
  --project="$PROJECT_ID" 2>/dev/null || echo "SQL instance already exists."

gcloud sql databases create "$DB_NAME" \
  --instance="$SQL_INSTANCE" \
  --project="$PROJECT_ID" 2>/dev/null || echo "Database already exists."

DB_PASS=$(openssl rand -base64 24)
gcloud sql users create "$DB_USER" \
  --instance="$SQL_INSTANCE" \
  --password="$DB_PASS" \
  --project="$PROJECT_ID" 2>/dev/null || echo "User already exists."

INSTANCE_CONNECTION="$PROJECT_ID:$REGION:$SQL_INSTANCE"
DATABASE_URL="postgresql://$DB_USER:$DB_PASS@/$DB_NAME?host=/cloudsql/$INSTANCE_CONNECTION"

# ── 4. Store DB URL in Secret Manager ───────────────────────────────────────
echo -n "$DATABASE_URL" | gcloud secrets create wedding-db-url \
  --data-file=- \
  --project="$PROJECT_ID" 2>/dev/null || \
  echo -n "$DATABASE_URL" | gcloud secrets versions add wedding-db-url \
    --data-file=- \
    --project="$PROJECT_ID"

# ── 5. Grant Cloud Run SA access to the secret ──────────────────────────────
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
CR_SA="$PROJECT_NUMBER-compute@developer.gserviceaccount.com"

gcloud secrets add-iam-policy-binding wedding-db-url \
  --member="serviceAccount:$CR_SA" \
  --role="roles/secretmanager.secretAccessor" \
  --project="$PROJECT_ID"

# ── 6. Build & push image ───────────────────────────────────────────────────
gcloud builds submit \
  --tag "$IMAGE:latest" \
  --project="$PROJECT_ID" .

# ── 7. Deploy to Cloud Run ──────────────────────────────────────────────────
gcloud run deploy "$SERVICE" \
  --image="$IMAGE:latest" \
  --region="$REGION" \
  --platform=managed \
  --allow-unauthenticated \
  --port=8080 \
  --min-instances=0 \
  --max-instances=5 \
  --memory=256Mi \
  --cpu=1 \
  --set-secrets="DATABASE_URL=wedding-db-url:latest" \
  --add-cloudsql-instances="$INSTANCE_CONNECTION" \
  --project="$PROJECT_ID"

echo ""
echo "==> Done! Seed the database with:"
echo "    DATABASE_URL=\"$DATABASE_URL\" node database/seed.js"
echo ""
echo "==> Service URL:"
gcloud run services describe "$SERVICE" \
  --region="$REGION" \
  --project="$PROJECT_ID" \
  --format='value(status.url)'

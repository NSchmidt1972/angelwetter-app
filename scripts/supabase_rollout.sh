#!/usr/bin/env bash
set -euo pipefail

PROJECT_REF="${PROJECT_REF:-pfrvxmywfbnmdbvcduvx}"
PROJECT_URL="https://${PROJECT_REF}.supabase.co"

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "ERROR: SUPABASE_ACCESS_TOKEN is not set."
  exit 1
fi

if [[ -z "${SUPABASE_DB_PASSWORD:-}" ]]; then
  echo "ERROR: SUPABASE_DB_PASSWORD is not set."
  exit 1
fi

echo "[1/4] Verifying Supabase CLI..."
npx supabase --version >/dev/null

echo "[2/4] Linking project ${PROJECT_REF}..."
npx supabase link --project-ref "${PROJECT_REF}" --password "${SUPABASE_DB_PASSWORD}"

echo "[3/4] Pushing migrations..."
npx supabase db push

if [[ "${DEPLOY_FUNCTIONS:-1}" == "1" ]]; then
  if [[ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" && -n "${ONESIGNAL_APP_ID:-}" && -n "${ONESIGNAL_API_KEY:-}" ]]; then
    echo "[4/4] Setting function secrets..."
    if [[ -n "${EDGE_SECRET:-}" ]]; then
      npx supabase secrets set --project-ref "${PROJECT_REF}" \
        SUPABASE_URL="${PROJECT_URL}" \
        SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY}" \
        ONESIGNAL_APP_ID="${ONESIGNAL_APP_ID}" \
        ONESIGNAL_API_KEY="${ONESIGNAL_API_KEY}" \
        EDGE_SECRET="${EDGE_SECRET}"
    else
      npx supabase secrets set --project-ref "${PROJECT_REF}" \
        SUPABASE_URL="${PROJECT_URL}" \
        SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY}" \
        ONESIGNAL_APP_ID="${ONESIGNAL_APP_ID}" \
        ONESIGNAL_API_KEY="${ONESIGNAL_API_KEY}"
    fi
  else
    echo "[4/4] Skipping secrets: set SUPABASE_SERVICE_ROLE_KEY + ONESIGNAL_APP_ID + ONESIGNAL_API_KEY to enable."
  fi

  echo "[4/4] Deploying Edge Function sendCatchPush..."
  npx supabase functions deploy sendCatchPush --project-ref "${PROJECT_REF}"
fi

echo "Done. Project ${PROJECT_REF} is migrated."

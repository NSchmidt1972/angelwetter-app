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

echo "[1/5] Verifying Supabase CLI..."
npx supabase --version >/dev/null

echo "[2/5] Linking project ${PROJECT_REF}..."
npx supabase link --project-ref "${PROJECT_REF}" --password "${SUPABASE_DB_PASSWORD}"

echo "[3/5] Pushing migrations..."
npx supabase db push

if [[ "${DEPLOY_FUNCTIONS:-1}" == "1" ]]; then
  echo "[4/5] Setting function secrets..."

  add_secret_if_set() {
    local key="$1"
    local value="${!key:-}"
    if [[ -n "${value}" ]]; then
      SECRET_ARGS+=("${key}=${value}")
    fi
  }

  SECRET_ARGS=("SUPABASE_URL=${PROJECT_URL}")
  add_secret_if_set "SUPABASE_SERVICE_ROLE_KEY"
  add_secret_if_set "ONESIGNAL_APP_ID"
  add_secret_if_set "ONESIGNAL_API_KEY"
  add_secret_if_set "OPENWEATHER_PRIMARY_KEY"
  add_secret_if_set "OPENWEATHER_SECONDARY_KEY"
  add_secret_if_set "EDGE_SECRET"
  add_secret_if_set "OPS_ALERT_SECRET"
  add_secret_if_set "OPS_ALERT_WEBHOOK_URL"
  add_secret_if_set "OPS_ALERT_URL"
  add_secret_if_set "OPS_ALERT_MIN_SEVERITY"
  add_secret_if_set "OPS_ALERT_WEB_URL"

  if [[ "${#SECRET_ARGS[@]}" -gt 1 ]]; then
    npx supabase secrets set --project-ref "${PROJECT_REF}" "${SECRET_ARGS[@]}"
  else
    echo "[4/5] Skipping secrets: no optional secret env vars set."
  fi

  if [[ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
    echo "WARN: SUPABASE_SERVICE_ROLE_KEY is missing (required by sendCatchPush + weatherProxy)."
  fi
  if [[ -z "${ONESIGNAL_APP_ID:-}" || -z "${ONESIGNAL_API_KEY:-}" ]]; then
    echo "WARN: ONESIGNAL_APP_ID/ONESIGNAL_API_KEY missing (sendCatchPush will fail)."
  fi
  if [[ -z "${OPENWEATHER_PRIMARY_KEY:-}" ]]; then
    echo "WARN: OPENWEATHER_PRIMARY_KEY missing (weatherProxy will fail)."
  fi

  echo "[5/5] Deploying Edge Functions sendCatchPush + weatherProxy + opsAlert..."
  npx supabase functions deploy sendCatchPush --project-ref "${PROJECT_REF}"
  npx supabase functions deploy weatherProxy --project-ref "${PROJECT_REF}"
  npx supabase functions deploy opsAlert --project-ref "${PROJECT_REF}"
fi

echo "Done. Project ${PROJECT_REF} is migrated."

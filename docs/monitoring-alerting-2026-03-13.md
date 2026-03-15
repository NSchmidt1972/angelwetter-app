# Monitoring & Alerting Nachweis (P0 Punkt 4)

Datum: 2026-03-13  
Projekt: `kirevrwmmthqgceprbhl` (Angelwetter App)

## Umsetzung

- Zentraler Alert-Ingress: Supabase Edge Function `opsAlert` (deployt mit `--no-verify-jwt`).
- Frontend-Monitoring:
  - Globale Handler für `window.error` und `unhandledrejection`.
  - Versand über `src/services/opsAlert.js` an `opsAlert` mit Release-Tag.
- Edge-Function-Monitoring:
  - `supabase/functions/weatherProxy/index.ts`: Alerts bei ENV-/Provider-Fehlern.
  - `supabase/functions/sendCatchPush/index.ts`: Alerts bei ENV-/OneSignal-/Unhandled-Fehlern.
- AI-Endpunkt-Monitoring:
  - `ai/server.py`: globaler FastAPI-Exception-Handler + explizite Alerts bei kritischen Predict-Fehlern.
  - Versand an `opsAlert` via `OPS_ALERT_URL` (Fallback: `${SUPABASE_URL}/functions/v1/opsAlert`).

## Alarmkanal

- Aktiver Kanal: OneSignal Push nur an aktive Mitglieder mit Rolle `admin` und aktiver Push-Subscription.
- Optional zusätzlich unterstützbar: Webhook (`OPS_ALERT_WEBHOOK_URL`, z. B. Slack).

## Persistente Alert-Events (Triage)

- `opsAlert` schreibt jeden Alert zusätzlich in `public.ops_alert_events`.
- Felder für Ursachenanalyse: `request_id`, `source`, `service`, `severity`, `message`, `context`, `channels`, `created_at`.
- Zugriff: nur `authenticated`-User mit Admin-/Vorstand-Rolle (RLS via `public.is_any_admin()`), plus `service_role`.

Beispielabfragen:

```sql
-- 1) Einzelnen Alarm aus Push/Webhook anhand request_id auflösen
select created_at, source, service, severity, message, context, channels
from public.ops_alert_events
where request_id = 'cb35b6c5-7d43-441a-89d1-3b3231211334'::uuid;

-- 2) Letzte Fehler pro Service (Frontend/Edge/AI)
select created_at, source, service, severity, message, request_id
from public.ops_alert_events
where severity in ('error', 'critical')
order by created_at desc
limit 50;
```

## Live-Verifikation

Ausgelöster Testalarm (direkter POST an `opsAlert`) am 2026-03-13:

```json
{
  "ok": true,
  "notified": true,
  "request_id": "cb35b6c5-7d43-441a-89d1-3b3231211334",
  "channels": {
    "webhook": { "sent": false, "status": null },
    "one_signal": { "sent": true, "recipients": 10 }
  }
}
```

Interpretation:
- Alerting-Pfad ist aktiv.
- Mindestens ein Alarmkanal ist verifiziert (`one_signal.sent=true`).

## Konfiguration

Relevante Supabase-Function-Secrets:

- `OPS_ALERT_SECRET`
- `OPS_ALERT_MIN_SEVERITY`
- `OPS_ALERT_WEB_URL`
- optional: `OPS_ALERT_WEBHOOK_URL`
- bestehend genutzt: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ONESIGNAL_APP_ID`, `ONESIGNAL_API_KEY`

Relevante App-/AI-Variablen:

- Frontend: `VITE_ENABLE_OPS_ALERTS=1`
- AI: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (oder `SUPABASE_KEY`), optional `OPS_ALERT_SECRET`, optional `OPS_ALERT_URL`

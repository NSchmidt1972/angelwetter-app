# Secret Rotation Runbook (P0 Go-Live Punkt 2)

Stand: 2026-03-13

Dieses Runbook deckt die verpflichtende Rotation nach der Weather-Proxy-Umstellung ab:
- OpenWeather
- Supabase
- OneSignal

## 1) Vorbereitung

- [ ] Neue Secrets in den jeweiligen Provider-Portalen erzeugt.
- [ ] Alte Secrets noch aktiv, bis Rollout + Smoke-Test fertig sind.
- [ ] Verantwortliche Person und Zeitfenster dokumentiert.

## 2) Deploy-/Secret-Update

Der vorhandene Rollout-Flow akzeptiert jetzt auch OpenWeather-Secrets:
- `scripts/supabase_rollout.sh`
- setzt (falls vorhanden): `SUPABASE_SERVICE_ROLE_KEY`, `ONESIGNAL_APP_ID`, `ONESIGNAL_API_KEY`, `OPENWEATHER_PRIMARY_KEY`, `OPENWEATHER_SECONDARY_KEY`, `EDGE_SECRET`
- deployt: `sendCatchPush` und `weatherProxy`

Beispiel:

```bash
SUPABASE_ACCESS_TOKEN=... \
SUPABASE_DB_PASSWORD=... \
SUPABASE_SERVICE_ROLE_KEY=... \
ONESIGNAL_APP_ID=... \
ONESIGNAL_API_KEY=... \
OPENWEATHER_PRIMARY_KEY=... \
OPENWEATHER_SECONDARY_KEY=... \
bash scripts/supabase_rollout.sh
```

## 3) Pflicht-Rotation je System

- [ ] OpenWeather: `OPENWEATHER_PRIMARY_KEY` (und optional `OPENWEATHER_SECONDARY_KEY`) neu gesetzt.
- [ ] Supabase: neue `anon`/`service_role` Key-Generation abgeschlossen und alle Consumer aktualisiert:
  Frontend (`VITE_SUPABASE_ANON_KEY`), AI-Backend (`SUPABASE_SERVICE_ROLE_KEY`), Edge Functions (`SUPABASE_SERVICE_ROLE_KEY`).
- [ ] OneSignal: neuer REST API Key (`ONESIGNAL_API_KEY`) gesetzt.

## 4) Verifikation

- [ ] Wetterabruf im Frontend funktioniert (Flow: Forecast laden / Fang speichern).
- [ ] Push-Flow funktioniert (`sendCatchPush` erfolgreich).
- [ ] Keine alte Secret-Version mehr in aktiven Environments.

## 5) Alt-Secrets deaktivieren

- [ ] Alte OpenWeather-Keys deaktiviert.
- [ ] Alte Supabase-Keys ungültig gemacht.
- [ ] Alter OneSignal-API-Key widerrufen.

## 6) Nachweis

- [ ] Rotationsdatum dokumentiert.
- [ ] Verantwortliche dokumentiert.
- [ ] Betroffene Environments dokumentiert (Prod/Staging).

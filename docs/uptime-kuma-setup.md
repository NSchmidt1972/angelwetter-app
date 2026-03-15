# Uptime Kuma Setup (Prod) - Angelwetter

Stand: 2026-03-14  
Scope: `app.asv-rotauge.de`, `ai.asv-rotauge.de`, Supabase Edge Functions (Prod-Projekt `kirevrwmmthqgceprbhl`)

## Ziel

Produktions-Uptime fuer App und API-Endpunkte mit verifizierten Alarmen abdecken.

Passend zu Go-Live-Checkliste (`docs/Golive.md`):
- Checks auf `/`, Auth-Route und Health-Endpunkt
- 1-5 Minuten Takt
- Alarmierung einmal getestet

## Empfohlene globale Kuma-Defaults

- Interval: `60s` (kritische Endpunkte), `300s` (sekundaer)
- Timeout: `10s`
- Retries: `2`
- Max Redirects: `5`
- TLS Verification: `on`
- Graceful window (optional): `1` minute

## Monitor-Matrix (anlegen)

| Name | Typ | URL | Methode | Erwartung | Intervall |
|---|---|---|---|---|---|
| `prod-fe-root` | HTTP(s) | `https://app.asv-rotauge.de/` | GET | Status `2xx`, Keyword `Angelwetter` | 60s |
| `prod-fe-auth-route` | HTTP(s) | `https://app.asv-rotauge.de/asv-rotauge/auth` | GET | Status `2xx` | 60s |
| `prod-fe-robots` | HTTP(s) | `https://app.asv-rotauge.de/robots.txt` | GET | Status `2xx`, Keyword `User-agent` | 300s |
| `prod-fe-onesignal-worker` | HTTP(s) | `https://app.asv-rotauge.de/push/onesignal/OneSignalSDKWorker.js` | GET | Status `2xx`, Keyword `OneSignalSDK.sw.js` | 60s |
| `prod-ai-health` | HTTP(s) | `https://ai.asv-rotauge.de/health` | GET | Status `2xx`, Keyword `"status":"ok"` | 60s |
| `prod-ai-predict` | HTTP(s) | `https://ai.asv-rotauge.de/predict` | POST JSON | Status `2xx`, Keyword `"prediction"` | 60s |
| `prod-edge-weatherproxy-authguard` | HTTP(s) | `https://kirevrwmmthqgceprbhl.supabase.co/functions/v1/weatherProxy` | POST | Status `401` | 60s |
| `prod-edge-sendcatchpush-authguard` | HTTP(s) | `https://kirevrwmmthqgceprbhl.supabase.co/functions/v1/sendCatchPush` | POST | Status `401` | 60s |
| `prod-edge-opsalert-authguard` | HTTP(s) | `https://kirevrwmmthqgceprbhl.supabase.co/functions/v1/opsAlert` | POST | Status `401` | 60s |

Hinweis zu den drei `authguard`-Checks:
- Die Endpunkte sind "up", wenn sie ohne gueltige Auth kontrolliert `401` liefern.
- Dadurch pruefst du Erreichbarkeit + Runtime, ohne Service-Keys in Kuma zu speichern.

Wichtig:
- In Uptime Kuma ist default oft `Accepted Status Codes = 200-299`.
- Fuer diese drei Monitore muss das auf `401-401` (oder `401`) umgestellt werden, sonst bleiben sie rot.

## Request Bodies (fuer POST-Monitore)

### `prod-ai-predict`

Header:
- `Content-Type: application/json`

Body:

```json
{
  "temp": 12.4,
  "pressure": 1014,
  "humidity": 78,
  "wind": 2.7,
  "wind_deg": 135,
  "moon_phase": 0.42
}
```

### `prod-edge-*` authguard

Header:
- `Content-Type: application/json`

Body:

```json
{"probe":"uptime-kuma"}
```

Expected status jeweils explizit auf `401` setzen.

## Kuma-Konfiguration fuer 401-Monitore (damit sie nicht rot sind)

Pro `prod-edge-*-authguard` Monitor:

1. Monitor Type: `HTTP(s)`.
2. URL + Methode (`POST`) setzen.
3. Request Body und Header (`Content-Type: application/json`) setzen.
4. In `Advanced` oder `HTTP Options`:
   - `Accepted Status Codes` auf `401-401` setzen.
5. Optional:
   - Keyword-Pruefung bei diesen Monitoren deaktivieren (nicht noetig fuer Authguard).

Wenn dein Kuma-Build kein benutzerdefiniertes Status-Feld anbietet:
- Alternative A: Monitor auf echten Health-Endpunkt mit `200` umstellen (z. B. `prod-ai-health`).
- Alternative B: Fuer Edge einen dedizierten internen Health-Endpoint (nur Ops-IP/Secret) mit `200` bereitstellen.

## Alerting in Kuma

1. Mindestens einen Notification-Channel hinterlegen (z. B. Mail, Slack, Telegram).
2. Alle `prod-*` Monitore diesem Channel zuordnen.
3. Optional "resend interval" setzen (z. B. alle 30 Minuten bei laufendem Incident).

## Verifikation (Pflicht vor Haken in GoLive)

1. Einen Monitor absichtlich brechen (z. B. falscher erwarteter Status bei `prod-fe-root`).
2. Warten bis Alert ausgeloest wird.
3. Alarm-Eingang im Zielkanal bestaetigen.
4. Konfiguration zuruecksetzen.
5. Recovery-Alert pruefen.

Protokollieren:
- Datum/Uhrzeit
- getesteter Monitor
- Alarmkanal
- Ergebnis (Alert + Recovery angekommen: ja/nein)

## Abnahme-Checkliste (copy/paste)

- [ ] `prod-fe-root` aktiv
- [ ] `prod-fe-auth-route` aktiv
- [ ] `prod-ai-health` aktiv
- [ ] Alle weiteren `prod-*` Monitore aktiv
- [ ] Notification-Channel angebunden
- [ ] Testalarm erfolgreich verifiziert
- [ ] Test-Recovery erfolgreich verifiziert
- [ ] Verweis in Go-Live-Doku gesetzt

## Optional (P1)

- Zusaeztlicher DNS-Monitor pro Domain (`app.asv-rotauge.de`, `ai.asv-rotauge.de`)
- Regionale Browser-Checks (separates Tool, z. B. Checkly/Better Stack Browser Checks)
- SLO-Auswertung auf Basis Kuma-Historie (monatlich)

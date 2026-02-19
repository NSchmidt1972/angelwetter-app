# app.petriundcloud.de

Angelwetter ist eine React/Vite PWA für Fangmeldungen, Auswertungen und Push-Benachrichtigungen. Supabase liefert Auth, Datenbank und Edge Functions; OneSignal versorgt die Pushes.

## Voraussetzungen
- Node.js 20+ und npm
- Supabase-Projekt mit passendem Schema (siehe Ordner `sql/` und `supabase/`)
- `.env.local` mit deinen Schlüsseln (nie committen)

## Lokale Entwicklung
1. `cp .env.example .env.local` und Variablen ausfüllen.
2. `npm install`
3. `npm run dev` startet Vite auf Port 5173 (per `--host` im Netzwerk erreichbar).
4. `npm run lint` für einen schnellen ESLint-Check.
5. `npm run build` erzeugt das Production-Bundle unter `dist/`.

## Wichtige Umgebungsvariablen
- `VITE_SUPABASE_URL` – Basis-URL deiner Supabase-Instanz (ohne Slash am Ende).
- `VITE_SUPABASE_ANON_KEY` – öffentlicher Anon-Key für das Frontend.
- `SUPABASE_URL` – Supabase-URL für das AI-Backend (`ai/server.py`, `ai/train.py`).
- `SUPABASE_SERVICE_ROLE_KEY` – Service-Role-Key für das AI-Backend (nur Server/Train, nie ins Frontend).
- `VITE_DEFAULT_CLUB_ID` – optionaler Fallback-Verein, wenn kein Mapping greift.
- `VITE_AI_BASE_URL` – optionaler AI-Endpunkt (Default: `https://ai.asv-rotauge.de`).
- `VITE_FORECAST_RETRY_ATTEMPTS` – zusätzliche Retry-Versuche im Forecast-Frontend bei transienten Fehlern (Default: `1`, Range: `0`-`3`).
- `VITE_FORECAST_RETRY_DELAY_MS` – Wartezeit zwischen Forecast-Retries in Millisekunden (Default: `450`, Range: `0`-`5000`).
- `VITE_APP_VERSION`, `VITE_BUILD_DATE`, `VITE_GIT_COMMIT` – optional, falls du Build-Metadaten selbst setzen willst.

## Deployment & Releases
- `./deploy-github.sh` committet und pusht den aktuellen Stand (Commit-Message enthält Datum/Uhrzeit).
- `./release.sh <version>` taggt, pusht und legt ein GitHub-Release an. Erfordert `GITHUB_TOKEN` und `jq`.
- Service Worker & PWA kommen aus `vite-plugin-pwa`; Supabase-Requests werden über die in `.env.local` hinterlegte Domain gecacht.

## Hinweise
- Die App nutzt OneSignal (Web SDK v16) für Pushes und Supabase Edge Functions für Wetter-Zusammenfassungen. Achte darauf, die jeweiligen Keys/IDs nur per `.env.local` zu setzen.
- Produktiv-Builds erhalten Build-Infos (Commit, Datum, Version) automatisch über `vite.config.js`.

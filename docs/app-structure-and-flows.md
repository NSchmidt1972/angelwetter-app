# Angelwetter App: Struktur und Funktionsweise

Stand: Februar 2026  
Scope: Frontend (`src/`), relevante Supabase-/OneSignal-Integration, zentrale Datenflüsse.

## 1) Kurzüberblick

Die App ist eine React/Vite-PWA für:
- Fangmeldungen (inkl. Schneidersessions)
- Auswertungen/Statistiken
- KI-basierte Fangprognosen
- Push-Benachrichtigungen
- Vereins-/Admin-Bereiche

Technik:
- React 19 + React Router
- Vite + `vite-plugin-pwa`
- TailwindCSS + CSS-Tokens/Themes
- Supabase (Auth, DB, Storage, Edge Functions)
- OneSignal Web SDK v16

## 2) Laufzeit-Start (Boot-Sequenz)

Relevante Dateien:
- `src/main.jsx`
- `src/App.jsx`
- `src/AppRoutes.jsx`
- `src/AuthContext.jsx`

Ablauf:
1. `main.jsx` lädt globale Styles (`tokens.css`, `light.css`, `dark.css`, `base.css`) und mountet `AuthProvider`.
2. `App.jsx` mountet global genau einmal `PushInit` und rendert `AppContent`.
3. `AuthContext` lädt Session über Supabase (`auth.getSession`) und hört auf Auth-Änderungen.
4. `AppContent` lädt Profil, setzt Rollenflags und rendert `AppRoutes`.
5. `AppRoutes` mappt `/:clubSlug/*` auf Club-kontextuelle Routen und prüft den Club über `clubs`-Tabelle.

## 3) Routing, Layouts und Zugriff

Relevante Dateien:
- `src/AppRoutes.jsx`
- `src/AppLayout.jsx`
- `src/AdminLayout.jsx`
- `src/config/navItems.js`

Prinzip:
- Mandantenfähig über URL-Slug: `/:clubSlug/...`
- Zwei Hauptlayouts:
  - `AppLayout`: normale App inkl. Navbar + AchievementLayer
  - `AdminLayout`: separater Admin-Bereich

Zugriffslogik:
- `isAdmin`: Developer-Mail oder Profilrolle `admin`
- `canAccessBoard`: `admin` oder `vorstand`
- `isSuperAdmin`: aktuell nur Developer-Mail im Frontend-Flag
- Guard-Komponenten:
  - `RequireManagement` für Vorstand/Admin-Seiten
  - `RequireSuperAdmin` für Superadmin-Seite

## 4) Ordnerstruktur (fachlich)

### `src/pages`
Routencontainer/Orchestrierung, z. B.:
- `Home`, `Catches`, `Analysis`, `Forecast`
- `BoardOverview`, `AdminOverview`, `SuperAdmin`

### `src/features`
Feature-spezifische Logik/Komponenten:
- `adminOverview/`
- `analysis/`
- `boardOverview/`
- `forecast/`
- `funfacts/`

### `src/components`
Querschnitts-/UI- und Legacy-Komponenten:
- Navbar, Form-Teile, Dialoge, Weather-Widgets
- `ui/` mit `Button`, `Card`, `Input`

### `src/services`
Datenzugriff/Fachservices:
- `catchService`, `blankService`, `boardService`, `fishes`, `crayfishService`, `weatherService`, `aiService`, `storage`

### `src/hooks`
Querschnittshooks:
- Auth/UX/PWA (`useServiceWorkerUpdate`, etc.)
- OneSignal-Status (`usePushStatus`)
- Einige Hooks sind nur Re-Exports auf `features` (z. B. `useForecast`)

### `src/onesignal`
OneSignal-Integrationslayer:
- SDK-Lader und Deferred-Queue
- SW-Helfer
- Legacy-Loader/Sync

### `src/styles`
Design-Tokens und Theme-Layer:
- `tokens.css`
- `themes/light.css`, `themes/dark.css`
- `base.css`

## 5) Wichtige Feature-Flows

## 5.1 Fang speichern

Relevante Dateien:
- `src/components/FishCatchForm.jsx`
- `src/services/catchService.js`
- `src/services/weather.js`
- `src/services/imageProcessing.js`
- `src/services/storage.js`

Ablauf:
1. Formular validieren.
2. Wetter laden (`loadWeatherForPosition`).
3. Foto optional verarbeiten/uploaden.
4. Fang in `fishes` speichern (inkl. `club_id`).
5. Optional Edge Function `sendCatchPush` triggern (`supabase.functions.invoke`).
6. Optional Achievement-Check.

## 5.2 Schneidersession speichern

Relevante Dateien:
- `src/services/blankService.js`

Ablauf:
1. Session prüfen (`auth.getSession`).
2. Edge Function `blank_weather_summary` via REST aufrufen.
3. Eintrag mit `blank=true` in `fishes` speichern.

## 5.3 Analyse

Relevante Dateien:
- `src/pages/Analysis.jsx`
- `src/features/analysis/hooks/useAnalysisData.js`
- `src/features/analysis/components/*`

Ablauf:
1. Daten laden (`fishes` + `fetchWeather`).
2. Filtern nach Sichtbarkeit, Nutzer, Fischart.
3. Statistiken aggregieren (Monat, Wetter, Sessions).
4. Darstellung über Feature-Komponenten.

## 5.4 Forecast/KI

Relevante Dateien:
- `src/pages/Forecast.jsx`
- `src/features/forecast/hooks/useForecast.js`
- `src/features/forecast/services/forecastApi.js`
- `src/services/aiService.js`
- `src/services/weatherService.js`

Ablauf:
1. Aktuelle Wetterdaten aus `weather_cache` lesen.
2. KI-Prognosen gegen `VITE_AI_BASE_URL` rechnen (`/predict`).
3. Tagesprognosen batchweise laden.
4. Ergebnis in KI-Karte + 7-Tage-Ausblick rendern.

## 6) Supabase: Architektur und Nutzung

## 6.1 Client und Mandantenkontext

Relevante Dateien:
- `src/supabaseClient.js`
- `src/utils/clubId.js`

Details:
- Supabase-Client wird aus `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` erzeugt.
- `club_id` wird zentral über `getActiveClubId()` bestimmt:
  - `localStorage.activeClubId`
  - Host-Mapping
  - `VITE_DEFAULT_CLUB_ID`

## 6.2 Auth/Profil

Relevante Dateien:
- `src/AuthContext.jsx`
- `src/components/AuthForm.jsx`
- `src/App.jsx`

Details:
- Login/Signup über Supabase Auth.
- Registrierung ist Whitelist-gebunden (`whitelist_emails`).
- Profil liegt in `profiles` und wird club-spezifisch gelesen.
- `App.jsx` schreibt User-Aktivität periodisch in `user_activity`.

## 6.3 Häufig verwendete Tabellen (Frontend)

Aus dem aktuellen Code:
- `fishes`
- `profiles`
- `whitelist_emails`
- `push_subscriptions`
- `user_activity`
- `clubs`
- `memberships`
- `weather_cache`
- `page_views`
- `crayfish_catches`

Storage:
- Bucket `fischfotos` (Upload + Public URL)

## 6.4 Edge Functions

Relevante Dateien:
- `supabase/functions/sendCatchPush/index.ts`
- `src/services/blankService.js` (Aufruf `blank_weather_summary`)

`sendCatchPush`:
- liest aktive `push_subscriptions` eines Clubs
- filtert Sender raus
- sendet an OneSignal Notification API
- benötigt serverseitig: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ONESIGNAL_APP_ID`, `ONESIGNAL_API_KEY`

## 6.5 SQL-Helfer/Migrationen

Relevante Dateien:
- `sql/create_page_views.sql`
- `sql/update_profiles_roles.sql`
- `sql/superadmin_access.sql`
- `sql/backfill_push_subscriptions_angler_name.sql`

## 7) OneSignal: Architektur und Funktionsweise

## 7.1 Aktiver Integrationspfad

Relevante Dateien:
- `src/components/PushInit.jsx`
- `src/hooks/usePushStatus.js`
- `src/onesignal/deferred.js`
- `src/onesignal/sdkLoader.js`
- `src/onesignal/swHelpers.js`
- `src/components/navbar/PushMenuButton.jsx`

Ablauf:
1. `PushInit` wird global in `App.jsx` gemountet.
2. OneSignal-SDK wird deferred geladen.
3. OneSignal initialisiert, SW-Registration sichergestellt.
4. Subscription-Änderungen werden beobachtet.
5. Subscription wird in `push_subscriptions` upserted.
6. UI-Toggle (`PushMenuButton`) nutzt `usePushStatus` für subscribe/unsubscribe.

## 7.2 Service Worker Zusammenspiel

Relevante Dateien:
- `src/sw.js` (PWA-Worker, importiert OneSignal SW SDK)
- `public/OneSignalSDKWorker.js` (zusätzlicher Worker-Stub)
- `public/OneSignalSDKUpdaterWorker.js`

Aktueller Hauptpfad läuft über `src/sw.js` + `PushInit`-Konfiguration (`SERVICE_WORKER_INFO` aus `swHelpers`).

## 7.3 Legacy/Altpfad (derzeit nicht zentral genutzt)

Relevante Dateien:
- `src/hooks/useOneSignal.js`
- `src/onesignal/OneSignalLoader.js`
- `src/onesignal/OneSignalSync.js`

Diese Dateien existieren weiterhin, sind aber nicht der primäre Pfad für die aktuelle Push-Steuerung.

## 8) PWA und Update-Mechanik

Relevante Dateien:
- `vite.config.js`
- `src/sw.js`
- `src/hooks/useServiceWorkerUpdate.js`
- `src/utils/sw.js`

Details:
- `vite-plugin-pwa` mit `injectManifest`.
- SW cached App-Assets, Supabase-GET, Wettericons, Fangfotos.
- Navbar kann verfügbare SW-Updates anzeigen und anwenden.

## 9) Styling-Architektur

Relevante Dateien:
- `src/styles/tokens.css`
- `src/styles/themes/light.css`
- `src/styles/themes/dark.css`
- `src/styles/base.css`
- `src/hooks/useDarkMode.js`

Details:
- Design Tokens in `tokens.css`
- Theme-Variablen für light/dark
- Darkmode via `html.dark` (persistiert in `localStorage`)

## 10) Umgebungsvariablen und Konfiguration

Frontend zwingend:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Optional:
- `VITE_DEFAULT_CLUB_ID`
- `VITE_AI_BASE_URL`
- Build-Metadaten (`VITE_APP_VERSION`, etc.)

Server/AI/Edge:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ONESIGNAL_APP_ID` (Edge Function)
- `ONESIGNAL_API_KEY` (Edge Function)

Hinweis:
- OneSignal App-ID ist im Frontend aktuell hartkodiert (z. B. `PushInit`, `OneSignalLoader`).

## 11) Relevante Hinweise für Weiterentwicklung

- Architektur-Regeln stehen zusätzlich in `docs/architecture.md`.
- Feature-Slicing ist bereits weit umgesetzt (`analysis`, `forecast`, `boardOverview`, `adminOverview`).
- Bei neuen Features:
  - Page als Container halten
  - Fachlogik in Feature-Hooks/Services
  - gemeinsame UI in `components/ui`
- Keine optischen Änderungen in Struktur-Refactors ohne expliziten Auftrag.

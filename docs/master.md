# Docs Master (All-in-One)

Automatisch zusammengefuehrt aus `docs/*.md`.

## Inhalt

- [onboarding](#onboarding)
- [architecture](#architecture)
- [app-structure-and-flows](#app-structure-and-flows)
- [screen-map](#screen-map)
- [design-handbook](#design-handbook)
- [design-tokens](#design-tokens)
- [ux-developer](#ux-developer)
- [ux-checklist](#ux-checklist)
- [migration-supabase-onesignal](#migration-supabase-onesignal)
- [multitenant-index](#multitenant-index)
- [multitenant-4wochen-roadmap](#multitenant-4wochen-roadmap)
- [multitenant-ticket-checkliste](#multitenant-ticket-checkliste)
- [funfacts-forecast-readme](#funfacts-forecast-readme)


---

## onboarding

# Onboarding (Kurzversion)

Diese Datei ist der schnelle Einstieg für neue Entwickler:innen in der Angelwetter-App.

Für Details: `docs/app-structure-and-flows.md` und `docs/architecture.md`.

## 1) Ziel der App

- Fangmeldungen inkl. Schneidersessions
- Statistik/Analyse
- KI-Fangprognose
- Push-Benachrichtigungen (OneSignal)
- Vereins-/Admin-Bereiche

## 2) Lokales Setup (5 Minuten)

1. Voraussetzungen:
- Node.js 20+
- npm

2. Umgebungsvariablen:
- `cp .env.example .env.local`
- In `.env.local` mindestens setzen:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`

3. Start:
- `npm install`
- `npm run dev`

4. Checks:
- `npm run lint`
- `npm run build`

## 3) Schnellüberblick Code-Struktur

- `src/pages/*`: Routen-Container (Orchestrierung)
- `src/features/*`: Feature-spezifische Logik/Komponenten
- `src/components/*`: Shared/UI/Legacy-Komponenten
- `src/services/*`: Datenzugriff & externe Services
- `src/hooks/*`: wiederverwendbare Hooks
- `src/onesignal/*`: OneSignal-Integrationslayer
- `src/styles/*`: Tokens/Themes/Base

Aktuell wichtige Features:
- `src/features/analysis/`
- `src/features/forecast/`
- `src/features/boardOverview/`
- `src/features/adminOverview/`

## 4) App-Flow in 60 Sekunden

1. `src/main.jsx` mountet `AuthProvider` + Styles.
2. `src/App.jsx` mountet global `PushInit` und lädt Profil/Role.
3. `src/AppRoutes.jsx` löst Club-Slug auf und rendert Layout + Seiten.
4. `src/AppLayout.jsx` startet PageView-Tracking und Navbar.

## 5) Supabase: Was du wissen musst

Client:
- `src/supabaseClient.js`

Club-Kontext:
- `src/utils/clubId.js` (`getActiveClubId()` überall für Mandantenkontext)

Häufige Tabellen:
- `fishes`, `profiles`, `whitelist_emails`, `push_subscriptions`
- `user_activity`, `weather_cache`, `page_views`, `crayfish_catches`
- `clubs`, `memberships`

Storage:
- Bucket `fischfotos` (siehe `src/services/storage.js`)

## 6) OneSignal: Aktiver Pfad

Wichtig:
- `src/components/PushInit.jsx` (globale Initialisierung)
- `src/hooks/usePushStatus.js` (Subscribe/Unsubscribe + Status)
- `src/components/navbar/PushMenuButton.jsx` (UI)
- `src/onesignal/deferred.js`, `src/onesignal/sdkLoader.js`, `src/onesignal/swHelpers.js`

Push-Subscriptions werden in `push_subscriptions` gespeichert/aktualisiert.

## 7) Häufige Workflows

Neue Seite:
1. Route in `src/AppRoutes.jsx`
2. Navigation in `src/config/navItems.js`
3. Page als Container halten, Logik in `features/<name>/...`

Neue Supabase-Abfrage:
1. Immer `club_id` berücksichtigen (`getActiveClubId()`)
2. Fehler robust behandeln (`console.warn` + UI-Fehlerzustand)

Refactor:
1. Nur strukturell, wenn kein UI-Change gewünscht
2. Danach immer `npm run lint` + `npm run build`

## 8) Do / Don’t (wichtig)

Do:
- Kleine, fachlich benannte Komponenten/Hooks in `features/`
- Page-Dateien als Orchestrierung lassen
- Änderungen mit Build/Lint absichern

Don’t:
- Keine unnötigen Abstraktionen für Einmal-Code
- Kein Hard-Reset/Revert fremder Änderungen
- Keine Designänderungen bei Struktur-Tasks

## 9) Erste sinnvolle Tickets für neue Teammitglieder

1. Kleinen UI-Block aus einer großen Page in Feature-Komponente auslagern.
2. Einen Datenzugriff von Page in Feature-Hook verschieben.
3. Einen kleinen Service-Call robust machen (Error-Handling + Loading-State).

## 10) Wenn du hängen bleibst

- Architekturregeln: `docs/architecture.md`
- Vollständiger technischer Überblick: `docs/app-structure-and-flows.md`



---

## architecture

# Frontend Architecture

## Ziel
Die Struktur soll Wartbarkeit verbessern, ohne unnötige Abstraktion zu erzeugen.

## Grundprinzip
- `src/pages/*`: Route-Container (Orchestrierung, State-Weitergabe, Seitenaufbau).
- `src/features/<feature>/*`: Fachlogik und UI einer Domäne (z. B. `analysis`, `forecast`, `adminOverview`).
- `src/components/ui/*`: Generische, domänenneutrale UI-Bausteine.
- `src/styles/*`: Tokens, Themes, Basis-Styles.

## Wann auslagern in `features/`
Eine Auslagerung ist sinnvoll, wenn mindestens einer der Punkte zutrifft:
- Eine Page wird groß und mischt Datenladen, Berechnung und UI (Richtwert: >300 Zeilen).
- Ein Block hat eigene Fachlogik und ist klar benennbar (z. B. `PageViewsSection`, `DailyOutlookCard`).
- Die gleiche Logik/Struktur wird an mehreren Stellen benötigt.
- Änderungen an einem Bereich verursachen regelmäßig Seiteneffekte in der Page.

## Wann nicht auslagern
Nicht auslagern, wenn:
- Es nur eine sehr kleine, einmalige Darstellung ohne eigene Logik ist.
- Eine Abstraktion nur dazu dient, „mehr Struktur“ zu haben.
- Der neue Layer keinen klaren Wartungsvorteil bringt.

## Hook-Regel
- Datenabruf + fachliche Ableitungen gehören in Feature-Hooks (z. B. `useAnalysisData`, `useForecast`).
- UI-nahe Dinge (z. B. Scroll-Refs, lokale Expand/Collapse-States) dürfen in der Page/Komponente bleiben.

## Service-Regel
- Externe API/Supabase-Aufrufe im Feature über schmale Service-Wrapper kapseln.
- Bestehende globale Services dürfen intern weiterverwendet werden, wenn kein Bruch nötig ist.

## Definition of Done für Refactors
- Keine optischen Änderungen ohne expliziten Auftrag.
- `npm run lint` und `npm run build` müssen grün sein.
- Dateibenennung fachlich eindeutig (kein generisches `Helper1`, `Section2`).



---

## app-structure-and-flows

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



---

## screen-map

# Screen Map (Route -> Screen -> UI-Verantwortung)

Zweck: Schnelle Übersicht für Design- und UI-Reviews.

Kontext:
- Architekturregeln: `docs/architecture.md`
- Designregeln: `docs/design-handbook.md`
- Gesamtsystem: `docs/app-structure-and-flows.md`

## 1) Routing-Basis

- Mandantenpfad: `/:clubSlug/*` (z. B. `/asv-rotauge/dashboard`)
- Root-Redirect: `/` -> `/asv-rotauge`
- Zwei Hauptlayouts:
  - `AppLayout` (`src/AppLayout.jsx`) für normale App-Screens
  - `AdminLayout` (`src/AdminLayout.jsx`) für Admin-Hub/-Verwaltung

## 2) Öffentliche Screens (ohne Login)

| Route | Screen | Primäre Datei | Layout |
|---|---|---|---|
| `/update-password` | Passwort aktualisieren | `src/pages/UpdatePassword.jsx` | ohne AppLayout |
| `/reset-done` | Reset-Bestätigung | `src/pages/ResetDone.jsx` | ohne AppLayout |
| `/auth-verified` | E-Mail bestätigt | `src/pages/AuthVerified.jsx` | ohne AppLayout |
| `/forgot-password` | Passwort vergessen | `src/pages/ForgotPassword.jsx` | ohne AppLayout |
| `/:clubSlug` (ausgeloggt) | Login/Registrierung | `src/components/AuthForm.jsx` | via `ClubGuard` |
| `/:clubSlug/auth` | Login/Registrierung | `src/components/AuthForm.jsx` | via `ClubGuard` |

## 3) App-Screens (eingeloggt, `AppLayout`)

| Route (`/:clubSlug/...`) | Menülabel | Screen | Primäre Datei | Wichtigste UI-Bausteine |
|---|---|---|---|---|
| `dashboard` | Wetter | Home | `src/pages/Home.jsx` | Weather-Komponenten (`src/components/weather/*`) |
| `new-catch` | `+ 🐠` | Fang eintragen | `src/components/FishCatchForm.jsx` | Form-Teile (`src/components/form/*`), Dialoge |
| `crayfish` | `+ 🦞` (nur Vorstand/Admin) | Krebsformular | `src/pages/CrayfishForm.jsx` | Formular + Vorschau |
| `catches` | Fangliste | Catch List | `src/components/catchlist/CatchList.jsx` | Catch Cards, Edit-Modal, Lightbox |
| `analysis` | Analyse | Statistik/Analyse | `src/pages/Analysis.jsx` | `src/features/analysis/components/*` |
| `statistik` | Analyse (Alias) | Statistik/Analyse | `src/pages/Analysis.jsx` | `src/features/analysis/components/*` |
| `leaderboard` | Rangliste | Leaderboard | `src/pages/Leaderboard.jsx` | Tabellen/Kennzahlen |
| `top-fishes` | Top 10 | Top Fische | `src/pages/TopFishes.jsx` | Ranking-Listen |
| `calendar` | Kalender | Kalender | `src/pages/Calendar.jsx` | Monats-/Terminansicht |
| `map` | Karte | Fangkarte | `src/pages/MapView.jsx` | Leaflet-Map + Marker |
| `forecast` | Prognose | KI-Forecast | `src/pages/Forecast.jsx` | `src/features/forecast/components/*` |
| `regeln` | Regeln | Regulations | `src/pages/Regulations.jsx` | Text-/Content-Seiten |
| `downloads` | Downloads | Downloads | `src/pages/DownloadsPage.jsx` | Karten + Downloadaktionen |
| `fun` | Fun-Facts | Fun Facts | `src/pages/FunFacts.jsx` | `src/features/funfacts/*` |
| `vorstand` | 👥 Vorstand | Board Overview | `src/pages/BoardOverview.jsx` | `src/features/boardOverview/components/*` |
| `admin2` | (Profilmenü) | Admin Overview | `src/pages/AdminOverview.jsx` | `src/features/adminOverview/components/*` |
| `superadmin` | (direkt) | Superadmin | `src/pages/SuperAdmin.jsx` | Club-/Membership-Übersichten |
| `settings` | Einstellungen | Settings | `src/pages/SettingsPage.jsx` | Theme/Account-Einstellungen |

## 4) Admin-Screens (`AdminLayout`)

| Route (`/:clubSlug/...`) | Zugriff | Screen | Primäre Datei |
|---|---|---|---|
| `admin` | eingeloggt (Admin-Hub) | Administration | `src/pages/Admin.jsx` |
| `admin/members` | eingeloggt | Mitgliederverwaltung | `src/pages/AdminMembersManage.jsx` |
| `admin/verein` | eingeloggt | Verein & App | `src/pages/AdminVereinManage.jsx` |

## 5) Globale UI, die auf vielen Screens sichtbar ist

| Bereich | Primäre Dateien | Relevanz für Design |
|---|---|---|
| Top-Navigation/Header | `src/components/Navbar.jsx`, `src/components/navbar/*` | Hauptnavigation, Mobile-Menü, Profilmenü |
| Push-Toggle im Menü | `src/components/navbar/PushMenuButton.jsx` | Zustände `aktiv/deaktiviert/blocked/loading` |
| App-Container + Achievements | `src/AppLayout.jsx`, `src/achievements/*` | Seitenabstand, Overlay-Effekte |
| UI-Primitives | `src/components/ui/*` | Basis für konsistente Komponentenstile |

## 6) Zugriffs-/Sichtbarkeitsregeln (Design-relevant)

- `crayfish` und `vorstand` sind nur sichtbar bei `canAccessBoard`/Admin.
- `admin2` ist im Profilmenü nur für Admin sichtbar.
- `superadmin` ist zusätzlich geschützt.
- Nicht eingeloggt: nur Auth/Recovery-Screens.

Relevante Datei:
- `src/AppRoutes.jsx`

## 7) Design-Review-Cluster (empfohlen)

Für effiziente Reviews nach Bereichen:

1. Navigation & globale Shell
- `Navbar`, `DesktopNav`, `MobileMenu`, `UserMenu`

2. Capture Flow
- `FishCatchForm`, `CrayfishForm`, Dialoge, Upload/Foto

3. Data & Insights
- `Analysis`, `Forecast`, `Leaderboard`, `TopFishes`

4. Governance / Admin
- `BoardOverview`, `AdminOverview`, `AdminMembersManage`, `AdminVereinManage`

## 8) Schnell-Checkliste pro Screen-Review

- Light + Dark korrekt?
- Mobile + Desktop Layout stabil?
- Zustände vorhanden (hover/focus/disabled/loading/error)?
- Textkontraste und Fokus sichtbar?
- Navigation zurück/weiter klar?



---

## design-handbook

# Design Handbook

Zweck: Diese Datei richtet sich an Designer:innen und Frontend-Entwickler:innen, die am Look & Feel arbeiten.

Technischer Kontext:
- Struktur/Architektur: `docs/architecture.md`
- Gesamtüberblick inkl. Supabase/OneSignal: `docs/app-structure-and-flows.md`
- Onboarding: `docs/onboarding.md`

## 1) Was hier als "Design" gilt

In diesem Projekt bedeutet Design:
- visuelle Hierarchie (Typografie, Farben, Abstände)
- Komponentenverhalten (Hover, Active, Disabled, Error)
- Responsive-Verhalten und Layoutlogik
- Dark/Light-Theming
- Motion und Übergänge

Nicht enthalten:
- Geschäftslogik
- Datenabfragen
- Rollen-/Berechtigungslogik

## 2) Wo Designer im Code arbeiten

Primäre Dateien:
- `src/styles/tokens.css`  
  Design-Tokens (Farben, Radius, Shadow, Spacing)
- `src/styles/themes/light.css`
- `src/styles/themes/dark.css`
- `src/styles/base.css`
- `src/index.css`  
  globale Tailwind-Basis und Utility-Animationen

Komponentenebene:
- `src/components/ui/`  
  Generische primitives (`Button`, `Card`, `Input`)
- `src/components/navbar/`  
  Hauptnavigation-UI
- `src/features/*/components/`  
  Feature-spezifische UI-Sektionen

## 3) Aktueller Stand der Design-Architektur

- Die App nutzt heute überwiegend Tailwind-Klassen direkt in JSX.
- Tokens/Themes sind vorhanden, aber noch nicht überall systematisch verdrahtet.
- Darkmode läuft über `html.dark` (`src/hooks/useDarkMode.js`).
- Tailwind Dark Mode ist auf `class` gestellt (`tailwind.config.cjs`).

Konsequenz:
- Visuelle Änderungen müssen aktuell oft in Komponentenklassen erfolgen.
- Für neue Designarbeit gilt: wo sinnvoll, Token-basiert statt hardcodiert erweitern.

## 4) Breakpoints und Responsive-Regeln

Standard-Tailwind-Breakpoints sind aktiv (`sm`, `md`, `lg`, `xl`, `2xl`), plus projektspezifisch:
- `tablet: 768px`
- `laptop: 1024px`
- `desktop: 1280px`

Regel:
- Mobile-first designen.
- Dichte Tabellen/Statistiken als horizontale Scroll-Container absichern.
- Interaktive Controls auf Mobile mindestens 44px Touch-Höhe/Ziel.

## 5) Seiten- und Bereichsverantwortung

Wichtige visuelle Bereiche:
- Navigation/Header: `src/components/Navbar.jsx`, `src/components/navbar/*`
- Dashboard/Home: `src/pages/Home.jsx`
- Analyse: `src/pages/Analysis.jsx` + `src/features/analysis/components/*`
- Forecast: `src/pages/Forecast.jsx` + `src/features/forecast/components/*`
- Vorstand/Admin: `src/features/boardOverview/components/*`, `src/features/adminOverview/components/*`

Regel:
- Bei visuellen Änderungen zuerst den zuständigen Feature-Ordner prüfen.
- Keine großen Style-Blöcke in `pages` aufbauen; UI in Feature-Komponenten halten.

## 6) Zustände und Interaktion

Jede neue UI-Komponente soll mindestens diese Zustände haben:
- default
- hover
- focus-visible
- active/pressed (bei Toggle/Buttons)
- disabled
- loading (falls async)
- error (falls Eingabe/Request-bezogen)

Darkmode:
- Jeder Zustand muss in Light und Dark lesbar bleiben.
- Fokus-Indikatoren dürfen im Darkmode nicht schwächer werden.

## 7) Accessibility-Basis (Pflicht)

- Kontrast für Text/Controls im Zielkontext ausreichend halten.
- Keyboard-Navigation:
  - sichtbarer Fokus (`focus-visible`)
  - keine Fokusfalle
- Semantik:
  - Buttons bleiben Buttons
  - Labels für Inputs vorhanden
  - `aria-expanded`, `aria-pressed` bei Toggles/Dropdowns
- Textgröße:
  - keine kritischen Infos nur in sehr kleinen Schriftgraden

## 8) Motion-Richtlinien

- Motion sparsam, funktional einsetzen:
  - Öffnen/Schließen
  - Ladezustand
  - Kontextwechsel
- Dauer kurz halten (ca. 150–300ms als Richtwert).
- Keine rein dekorativen Daueranimationen in Kernflows.
- Bei bestehenden Utility-Animationen (`src/index.css`) konsistent bleiben.

## 9) Empfohlener Design-Workflow

1. Scope definieren:
- Welche Seite/Komponente?
- Rein visuell oder auch Interaktion?

2. Token prüfen:
- Gibt es bereits passende Token?
- Wenn nein: Token ergänzen, nicht nur Klassen "härten".

3. Komponente anpassen:
- Zuerst in `src/components/ui/*` oder `src/features/<feature>/components/*`.

4. States + Responsive prüfen:
- Light/Dark
- Mobile/Desktop
- Keyboard/Fokus

5. Abschluss:
- `npm run lint`
- `npm run build`

## 10) Definition of Done für Design-Änderungen

- Visuell konsistent mit bestehender UI-Sprache.
- Alle relevanten Zustände umgesetzt.
- Keine Regression in Light/Dark.
- Keine Layoutbrüche auf Mobile.
- Lint/Build grün.
- Dokumentation aktualisiert, wenn neue Tokens oder Regeln eingeführt wurden.

## 11) Was aktuell sinnvoll als nächster Design-Schritt ist

1. Tokens stärker nutzen:
- Bestehende Tailwind-Hardcodes schrittweise auf semantische Token mappen.

2. UI-Primitives konkretisieren:
- `Button`, `Input`, `Card` um vordefinierte Varianten erweitern.

3. Komponentenkatalog in docs:
- Für Kernkomponenten Beispiele für Zustände und Nutzung dokumentieren.



---

## design-tokens

# Design Tokens

Quelle im Code:
- `src/styles/tokens.css`
- `src/styles/themes/light.css`
- `src/styles/themes/dark.css`

Hinweis:
- Aktuell werden Tokens nur teilweise in Komponenten verwendet.
- Viele Komponenten nutzen direkte Tailwind-Klassen.
- Zielbild: neue Designarbeit möglichst token-basiert erweitern.

## 1) Core Tokens (`:root` in `tokens.css`)

## Farben

| Token | Wert | Zweck |
|---|---|---|
| `--color-bg` | `#f9fafb` | Seitenhintergrund (light) |
| `--color-surface` | `#ffffff` | Cards/Container (light) |
| `--color-text` | `#1f2937` | Primärer Text (light) |
| `--color-text-muted` | `#6b7280` | Sekundärer Text |
| `--color-border` | `#d1d5db` | Standard-Rand |
| `--color-primary` | `#2563eb` | Primärfarbe |
| `--color-primary-contrast` | `#ffffff` | Text auf Primärfarbe |
| `--color-success` | `#16a34a` | Erfolg |
| `--color-warning` | `#d97706` | Warnung |
| `--color-danger` | `#dc2626` | Fehler/Destruktiv |

## Radius

| Token | Wert |
|---|---|
| `--radius-sm` | `0.375rem` |
| `--radius-md` | `0.5rem` |
| `--radius-lg` | `0.75rem` |

## Schatten

| Token | Wert |
|---|---|
| `--shadow-sm` | `0 1px 2px rgba(0, 0, 0, 0.05)` |
| `--shadow-md` | `0 4px 6px rgba(0, 0, 0, 0.1)` |
| `--shadow-lg` | `0 10px 15px rgba(0, 0, 0, 0.1)` |

## Spacing

| Token | Wert |
|---|---|
| `--space-1` | `0.25rem` |
| `--space-2` | `0.5rem` |
| `--space-3` | `0.75rem` |
| `--space-4` | `1rem` |
| `--space-6` | `1.5rem` |
| `--space-8` | `2rem` |

## 2) Theme-Tokens

## Light Theme

Definiert in `src/styles/themes/light.css`.

| Theme Token | Mapping |
|---|---|
| `--theme-bg` | `var(--color-bg)` |
| `--theme-surface` | `var(--color-surface)` |
| `--theme-text` | `var(--color-text)` |
| `--theme-text-muted` | `var(--color-text-muted)` |
| `--theme-border` | `var(--color-border)` |

Selektoren:
- `:root`
- `html[data-theme="light"]`

## Dark Theme

Definiert in `src/styles/themes/dark.css`.

| Theme Token | Wert |
|---|---|
| `--theme-bg` | `#111827` |
| `--theme-surface` | `#1f2937` |
| `--theme-text` | `#f3f4f6` |
| `--theme-text-muted` | `#d1d5db` |
| `--theme-border` | `#374151` |

Selektoren:
- `html.dark`
- `html[data-theme="dark"]`

## 3) Aktivierung von Darkmode

- Hook: `src/hooks/useDarkMode.js`
- Persistenz: `localStorage.darkMode` (`"true"`/`"false"`)
- Mechanik: `document.documentElement.classList.toggle("dark", next)`

Tailwind:
- `darkMode: 'class'` in `tailwind.config.cjs`

## 4) Breakpoints

Zusätzliche Screens in `tailwind.config.cjs`:

| Name | Breite |
|---|---|
| `tablet` | `768px` |
| `laptop` | `1024px` |
| `desktop` | `1280px` |

Zusätzlich bleiben die Standard-Tailwind-Breakpoints nutzbar (`sm`, `md`, `lg`, `xl`, `2xl`).

## 5) Aktuelle Lücke (wichtig)

Obwohl Tokens vorhanden sind, basiert die Mehrheit der Komponenten noch auf direkten Tailwind-Farbklassen.

Empfehlung für neue Designarbeit:
1. Neue visuelle Regeln zuerst als Token ergänzen.
2. Dann Komponenten schrittweise auf diese Token mappen.
3. Keine Big-Bang-Migration; inkrementell pro Feature.

## 6) Vorgehen beim Hinzufügen neuer Tokens

1. Token in `src/styles/tokens.css` ergänzen.
2. Falls theme-abhängig, Mapping in `light.css` und `dark.css` erweitern.
3. Mindestens eine Referenzkomponente anpassen.
4. Dokumentation hier aktualisieren.
5. `npm run lint` und `npm run build` ausführen.



---

## ux-developer

# UX Developer Guide

Zielgruppe: UX-orientierte Frontend-Entwicklung (Interaktion, Zustände, Flows, Usability).

Referenzen:
- Strukturregeln: `docs/architecture.md`
- Designregeln: `docs/design-handbook.md`
- Token-Referenz: `docs/design-tokens.md`
- Screen-Mapping: `docs/screen-map.md`

## 1) UX-Rolle im Projekt

Als UX Developer verantwortest du vor allem:
- Task-Flows (z. B. Fang speichern, Login, Push aktivieren)
- Zustandslogik (loading/success/error/empty/disabled)
- Interaktionsklarheit (Feedback, Fokus, Navigation, Recovery)
- Accessibility und mobile Bedienbarkeit

Nicht primär:
- Datenmodellierung/Supabase-Schema
- Business-Rollenlogik

## 2) UX-Leitprinzipien (projektweit)

1. Klarheit vor Cleverness  
   Jeder Screen muss sofort zeigen: "Was kann ich hier tun?"

2. Sichtbarer Zustand  
   Jede Async-Aktion braucht visuelles Feedback.

3. Reversibilität  
   Nutzer sollen Fehler korrigieren können (zurücksetzen, abbrechen, schließen).

4. Mobile-first  
   Primäre Flows müssen auf Mobilgeräten ohne Reibung funktionieren.

5. Konsistenz  
   Gleiche Interaktion = gleiches Verhalten (Buttons, Toggles, Dialoge, Tabellen).

## 3) Kern-UX-Flows in der App

## 3.1 Auth-Flow

Relevante Datei:
- `src/components/AuthForm.jsx`

UX-Anforderungen:
- klare Modi: Login vs Registrierung
- eindeutige Fehlermeldungen (z. B. Credentials, E-Mail-Bestätigung)
- Password-Recovery ohne Sackgasse

## 3.2 Fang erfassen

Relevante Dateien:
- `src/components/FishCatchForm.jsx`
- `src/services/catchService.js`
- `src/services/blankService.js`

UX-Anforderungen:
- Validierung vor Submit
- zweistufige Entscheidung "entnommen?" bleibt nachvollziehbar
- Upload-/Speicherstatus sichtbar
- Success führt direkt in sinnvollen Folgeschritt (`/catches`)

## 3.3 Analyse/Forecast

Relevante Dateien:
- `src/pages/Analysis.jsx` + `src/features/analysis/*`
- `src/pages/Forecast.jsx` + `src/features/forecast/*`

UX-Anforderungen:
- klare Filterwirkung (z. B. Fischfilter)
- erklärende Leerlaufzustände ("keine Daten")
- bei nachgeladener KI: progressive Darstellung statt "alles blockieren"

## 3.4 Push-Aktivierung

Relevante Dateien:
- `src/components/navbar/PushMenuButton.jsx`
- `src/hooks/usePushStatus.js`
- `src/components/PushInit.jsx`

UX-Anforderungen:
- Status klar differenzieren:
  - nicht unterstützt
  - blockiert
  - deaktiviert
  - aktiviert
- primäre Aktion darf nie "stumm" scheitern
- ID/Debug-Infos nur unterstützend, nicht primär

## 3.5 SW-Update-Flow

Relevante Dateien:
- `src/hooks/useServiceWorkerUpdate.js`
- `src/utils/sw.js`

UX-Anforderungen:
- Update-Banner nur zeigen, wenn tatsächlich relevant
- Nutzerentscheidung respektieren
- Update-Anwendung mit klarer Rückmeldung (Reload-Erwartung transparent)

## 4) Zustände: verpflichtendes UX-Muster

Für jede interaktive Komponente/Section prüfen:
- `idle`
- `loading`
- `success` (oder normaler Datenzustand)
- `empty`
- `error`
- `disabled` (falls Eingabe/Aktion nicht möglich)

Faustregel:
- Kein "unsichtbarer" Fehlerzustand (nur Console reicht nicht).
- Kein Action-Button ohne Rückmeldung bei langen Requests.

## 5) Accessibility-Basics (Pflicht)

- Tastaturbedienung vollständig möglich
- Fokus klar sichtbar (`focus-visible`)
- `aria-*` für Toggles, Menüs, expand/collapse
- ausreichende Text-/State-Kontraste in Light und Dark
- Touch-Ziele ausreichend groß auf Mobile

## 6) Navigation und Orientierung

Globale Navigation:
- `src/components/Navbar.jsx`
- `src/components/navbar/*`

UX-Regeln:
- aktive Route sichtbar
- mobile Menüs dürfen Body-Scroll sauber sperren/freigeben
- Dropdowns schließen konsistent bei Outside-Click
- nach kritischen Aktionen sinnvoll weiterleiten (nicht auf "toten" Screen)

## 7) Microcopy-Richtlinien

- kurz, konkret, handlungsorientiert
- Fehlertext: Problem + nächster Schritt
- Loading-Text: "was passiert gerade?"
- keine internen Begriffe/Techniktexte für Endnutzer

Beispiel gut:
- "Benachrichtigungen im Browser blockiert. Bitte im Browser erlauben."

## 8) UX-Qualitätscheck vor Merge

1. Happy Path getestet?
2. Empty State sichtbar und verständlich?
3. Error State sichtbar und recoverable?
4. Mobile getestet?
5. Darkmode getestet?
6. Keyboard/Fokus geprüft?
7. `npm run lint` und `npm run build` grün?

## 9) UX-Debt: wann sofort handeln

Sofort adressieren, wenn:
- Nutzeraktion ohne Feedback bleibt
- Datenverlust möglich ist (z. B. ungespeicherte Eingaben ohne Warnung)
- Interaktion nur per Maus funktioniert
- zentrale Flows auf Mobile abbrechen/überlappen

## 10) Änderungsstrategie (pragmatisch)

- Kleine UX-Verbesserungen inkrementell pro Feature
- Keine "Big Bang"-Redesigns ohne abgestimmtes Designziel
- Bei Struktur-Tasks: keine Optikänderung ohne expliziten Auftrag
- Bei UX-Tasks: Verhalten/Feedback verbessern, ohne unnötige Architektur-Umbauten



---

## ux-checklist

# UX Checklist (pro PR)

Kurzcheck für UX-relevante Änderungen.  
Ergänzung zu: `docs/ux-developer.md`

## 1) Scope

- [ ] Ziel der Änderung in 1 Satz klar (welcher Nutzer-Flow wird verbessert?)
- [ ] Änderung betrifft tatsächlich UX (nicht nur interne Refactor-Logik)

## 2) Zustände

- [ ] `loading` sichtbar
- [ ] `success`/Normalzustand konsistent
- [ ] `empty` verständlich
- [ ] `error` verständlich + recoverable
- [ ] `disabled`-Zustände klar erkennbar

## 3) Interaktion

- [ ] Primäre Aktion klar erkennbar
- [ ] Aktion gibt direktes Feedback
- [ ] Keine "stummen" Fehler (nur Console ist nicht genug)
- [ ] Abbruch/Schließen/Zurück funktioniert erwartbar

## 4) Navigation

- [ ] Nach Aktionen sinnvolle Weiterleitung/Verbleib
- [ ] Aktiver Kontext bleibt sichtbar (z. B. aktive Route, geöffnete Sektion)
- [ ] Kein Navigations-Dead-End erzeugt

## 5) Accessibility

- [ ] Tastaturbedienung möglich
- [ ] Fokus sichtbar (`focus-visible`)
- [ ] Relevante `aria-*` gesetzt (Toggle/Expand/Menu)
- [ ] Kontrast in Light/Dark ausreichend
- [ ] Touch-Ziele auf Mobile ausreichend groß

## 6) Responsive + Theme

- [ ] Mobile getestet
- [ ] Desktop getestet
- [ ] Darkmode getestet
- [ ] Keine Layoutbrüche bei typischen Breakpoints

## 7) Microcopy

- [ ] Texte kurz und handlungsorientiert
- [ ] Fehlermeldung enthält Ursache + nächsten Schritt
- [ ] Kein unnötiger Technikjargon im UI

## 8) Technischer Abschluss

- [ ] `npm run lint` grün
- [ ] `npm run build` grün
- [ ] Relevante Doku bei Bedarf aktualisiert (`docs/ux-developer.md`, `docs/screen-map.md`)

## 9) Review-Notiz (optional)

- Risiko:
- Getestete Flows:
- Offene UX-Fragen:



---

## migration-supabase-onesignal

# Migration Runbook: Supabase + OneSignal

Stand: 2026-02-16  
Ziel: Sauberer Umstieg von Legacy-Setup auf verkaufsreife Multi-Tenant-Basis
Einstieg: `docs/multitenant-index.md`

## Entscheidungsrahmen
1. Supabase: neues Projekt fuer `staging` und danach neues `production`.
2. OneSignal: getrennte Apps fuer `staging` und `production`.
3. Migration nicht "Big Bang", sondern kontrolliert mit Test- und Freeze-Phasen.

## Zielarchitektur
1. Environments:
   - `dev` (lokal)
   - `staging` (vollstaendige Vorabnahme)
   - `production` (Kundenbetrieb)
2. Jede Umgebung hat eigene Keys:
   - Supabase URL/Anon Key
   - Supabase Service Role Key (nur Server)
   - OneSignal App ID/API Key
3. Keine geteilten Secrets zwischen Environments.

## Voraussetzungen
1. Zugang zu altem Supabase-Projekt (Schema + Datenexport).
2. Rechte zum Anlegen neuer Supabase-Projekte.
3. Rechte fuer Supabase Functions Deploy.
4. Zugriff auf OneSignal Dashboard.
5. Testnutzer fuer mindestens 2 Clubs:
   - Mitglied A, Admin A
   - Mitglied B, Admin B
   - Superadmin

## Workstream A: Supabase Migration

### A1. Neues `staging`-Projekt aufsetzen
1. Neues Supabase-Projekt anlegen.
2. Basis-Konfiguration setzen:
   - Auth Provider/Email Templates
   - Storage Buckets
   - Edge Functions Secrets
3. Projekt-Variablen in `.env`/CI hinterlegen.

### A2. Schema und Policies per Migrationen aufbauen
1. Alle Tabellen als idempotente SQL-Migrationen abbilden.
2. Alle RLS-Policies als idempotente Migrationen abbilden.
3. Hilfsfunktionen (`is_superadmin`, `is_club_admin`, etc.) per Migration ausrollen.
4. Edge Function `sendCatchPush` im neuen Projekt deployen.

Regel:
1. Keine produktionskritische Struktur nur manuell im Dashboard konfigurieren.

### A3. Seed und Basiskonfiguration
1. `clubs`-Datensaetze importieren/erstellen.
2. Basis-`memberships` und `superadmins` setzen.
3. Optionale Referenzdaten und Defaults anlegen.

### A4. Datenmigration aus Legacy
Empfohlene Reihenfolge:
1. `clubs`
2. `profiles`
3. `memberships`
4. `whitelist_emails`
5. `fishes`
6. `crayfish_catches`
7. `user_activity`
8. `push_subscriptions` (optional neu aufbauen)

Hinweise:
1. IDs unveraendert uebernehmen, wenn moeglich.
2. Nach jedem Schritt referentielle Integritaet pruefen.
3. Backfill-Skripte fuer fehlende Felder dokumentieren.

### A5. Staging-Verifikation
1. `MT-001` bis `MT-008` in `staging` testen.
2. Security-Tests:
   - kein Cross-Club Read
   - kein Cross-Club Write
   - kein fremdclub Push
3. Performance-Schnellcheck auf Kernseiten.

Gate:
1. Ohne gruenes Security-Protokoll kein Prod-Cutover.

## Workstream B: OneSignal Migration

### B1. OneSignal-Struktur
1. App `angelwetter-staging` anlegen.
2. App `angelwetter-production` anlegen (neu oder bestehend weiterfuehren).

### B2. Secret- und Function-Verkabelung
1. `ONESIGNAL_APP_ID` und `ONESIGNAL_API_KEY` je Environment setzen.
2. In Supabase Functions pro Environment die korrekten Secrets hinterlegen.
3. End-to-End-Test mit Testgeraeten pro Club.

### B3. Segmentierung und Tags
1. Tags standardisieren:
   - `club_id`
   - optional spaeter `waterbody_id`
   - optional `role`
2. Versandlogik serverseitig immer auf Club-Scope begrenzen.

### B4. Bestehende Prod-OneSignal-App: Entscheidung
1. Viele aktive Nutzer vorhanden:
   - bestehende Prod-App weiterverwenden, nur haerten und segmentieren.
2. Kleine Nutzerbasis / Relaunch:
   - neue Prod-App anlegen, Re-Opt-in einplanen.

## Cutover Plan (Production)

### C1. T-7 bis T-2 Tage
1. Finaler Staging-Testdurchlauf.
2. Datenmigration dry run in Testumgebung.
3. Monitoring/Log-Queries vorbereiten.
4. Nutzerkommunikation vorbereiten (Wartungsfenster + ggf. Push-Reaktivierung).

### C2. T-1 Tag
1. Prod-Migration freigeben (Change Approval).
2. Backup/Snapshot vom Legacy-Projekt erstellen.
3. Rollback-Entscheidungskriterien final bestaetigen.

### C3. Cutover-Tag (T)
1. Write-Freeze im Legacy-System aktivieren.
2. Finalen Delta-Export durchfuehren.
3. Delta ins neue Prod-Projekt importieren.
4. App-Secrets/Umgebungsvariablen auf neues Prod umstellen.
5. Smoke Tests:
   - Login/Signup
   - Fang anlegen
   - Admin-Zugriff
   - Push-Versand
6. Write-Freeze aufheben.

### C4. T+1 bis T+7
1. Erhoehte Beobachtung von Logs/Fehlerquoten.
2. Taeglicher Security-Sanity-Check.
3. Offene Incidents priorisiert beheben.

## Rollback-Plan
Trigger:
1. Kritischer Auth-Fehler.
2. Nachweisbarer Cross-Tenant-Leak.
3. Kernfunktionalitaet nicht verfuegbar.

Rollback-Schritte:
1. Write-Freeze erneut aktivieren.
2. Secrets auf Legacy-Prod zurueckstellen.
3. Nutzerverkehr zurueck auf Legacy leiten.
4. Incident-Postmortem erstellen.

## Abnahmekriterien (Migration abgeschlossen)
1. Alle produktiven Kernfluesse laufen im neuen Projekt stabil.
2. `MT-001` bis `MT-008` sind in Prod verifiziert.
3. Kein Cross-Tenant-Zugriff in Testprotokollen.
4. Push funktioniert club-spezifisch im Zielsystem.
5. Rollback wurde als Drill mindestens einmal simuliert.

## Verantwortlichkeiten (empfohlen)
1. Tech Lead:
   - Architektur-Entscheidungen, Go/No-Go.
2. Backend/DB Owner:
   - Migrationen, RLS, Datenimport.
3. Frontend Owner:
   - Env-Umschaltung, Guard-Checks, End-to-End-UI-Tests.
4. Ops/Release Owner:
   - Cutover-Kommunikation, Monitoring, Incident-Steuerung.

## Verknuepfung zu bestehenden Dokumenten
1. Ticketliste: `docs/multitenant-ticket-checkliste.md`
2. 4-Wochen-Plan Phase 1/2: `docs/multitenant-4wochen-roadmap.md`



---

## multitenant-index

# Multi-Tenant Doku-Index

Stand: 2026-02-16

## Schnellnavigation
1. Ticket-Details und Definition of Done:
   - `docs/multitenant-ticket-checkliste.md`
2. Zeitplan (kompakt):
   - `docs/multitenant-4wochen-roadmap.md`
3. Migration/Cutover/Rollback:
   - `docs/migration-supabase-onesignal.md`

## Empfohlene Lesereihenfolge
1. `docs/multitenant-ticket-checkliste.md`
2. `docs/multitenant-4wochen-roadmap.md`
3. `docs/migration-supabase-onesignal.md`

## Pflege-Regeln
1. Ticketinhalte nur in der Ticketliste pflegen (Single Source of Truth).
2. Roadmap nur als Timeline pflegen, ohne technische Detailduplikate.
3. Runbook nur fuer operative Migration/Cutover-Aenderungen pflegen.

## Scope-Grenze
1. Club-Isolation: `MT-001` bis `MT-008`.
2. Mehrgewaesser-Ausbau: `MT-009` bis `MT-013`.



---

## multitenant-4wochen-roadmap

# Multi-Tenant Roadmap (Kurzfassung)

Stand: 2026-02-16  
Start: Montag, 16. Februar 2026  
Zweck: Management-Timeline. Die fachliche Detailquelle bleibt die Ticketliste.

## Dokumentrolle
1. Diese Datei enthaelt nur Zeitplan, Prioritaeten und Gates.
2. Ticket-Details stehen in `docs/multitenant-ticket-checkliste.md`.
3. Migrationsdetails stehen in `docs/migration-supabase-onesignal.md`.

## Phase 1: 4 Wochen bis Verkaufsfreigabe

### Woche 1 (16.02.2026-22.02.2026)
1. `MT-001` Push-Function absichern.
2. `MT-002` Admin-Routen rollenbasiert sperren.

Gate:
1. Kein fremdclub Push.
2. Kein unberechtigter Zugriff auf `/:clubSlug/admin*`.

### Woche 2 (23.02.2026-01.03.2026)
1. `MT-004` Signup club-spezifisch absichern.
2. `MT-007` RLS-Matrix und Policy-Gaps aufbauen.

Gate:
1. Kein clubfremder Signup.
2. RLS-Gap-Liste ist vollstaendig priorisiert.

### Woche 3 (02.03.2026-08.03.2026)
1. `MT-003` `page_views` tenant-faehig machen.
2. `MT-007` fehlende Policies produktiv schliessen.

Gate:
1. Analytics nur innerhalb des aktiven Clubs.
2. Serverseitige Isolation ist durchgaengig.

### Woche 4 (09.03.2026-15.03.2026)
1. `MT-006` Query-Hygiene abschliessen.
2. `MT-005` Superadmin auf Backend-Quelle umstellen.
3. `MT-008` End-to-End Testpaket durchlaufen.

Go/No-Go:
1. Cross-Tenant-Leaks = 0.
2. Rechte sind serverseitig erzwungen.
3. Testprotokoll ist reproduzierbar.

## Phase 2 danach: Mehrgewaesser-Ausbau (6 Wochen)
1. Block A (Woche 1-2): `MT-009` Datenmodell + Backfill.
2. Block B (Woche 3-4): `MT-010` RLS-Hierarchie + `MT-011` App-Kontext.
3. Block C (Woche 5-6): `MT-012` Regelwerk/Push + `MT-013` Cross-Gewaesser-Tests.

Abnahme:
1. Rechte und Daten sind pro Gewaesser isoliert.
2. Push und Regeln laufen im korrekten Gewaesser-Scope.

## Optional parallel oder danach: iPhone/App Store
Erst starten, wenn Phase-1-Gates gruen sind.



---

## multitenant-ticket-checkliste

# Multi-Tenant Hardening: Ticket-Checkliste

Stand: 2026-02-16
Scope: Frontend, Supabase SQL/RLS, Edge Functions
Einstieg: `docs/multitenant-index.md`

## Ziel
Die App soll mandantenfest sein: keine Datenleaks zwischen Clubs, keine unautorisierten Admin-Zugriffe, keine cross-tenant Side Effects.

## Priorisierung
- P0: Sicherheitskritisch, vor naechstem Release zwingend.
- P1: Wichtig fuer saubere Tenant-Isolation.
- P2: Stabilisierung, Tests, Betrieb.

## Ticket 1 (P0): Push-Edge-Function autorisieren
ID: `MT-001`

Problem:
- `sendCatchPush` vertraut `club_id` aus Request-Body.
- Bei fehlendem/optionalem Secret kann ein Client Pushes fuer fremde Clubs ausloesen.

Betroffene Dateien:
- `supabase/functions/sendCatchPush/index.ts`

Aufgaben:
1. Caller-Identitaet aus JWT ableiten (kein blindes Vertrauen in Body-Felder).
2. Vor Versand Membership-Pruefung fuer `club_id` erzwingen:
   - User muss in `memberships` aktiv sein fuer diesen Club.
   - Optional: nur Rollen `admin`/`vorstand` duerfen manuell Push triggern.
3. Bei fehlender Berechtigung mit `403` abbrechen.
4. Optionales `EDGE_SECRET` entweder verpflichtend machen oder entfernen und nur JWT-Auth nutzen.
5. Security-Logs strukturieren (ohne sensible Daten).

Definition of Done:
1. Unberechtigter User kann keinen Push fuer fremden Club triggern.
2. Berechtigter User kann Push nur fuer eigene Club-Scopes triggern.
3. Negative/Positive Tests dokumentiert (z. B. mit curl/Postman).

---

## Ticket 2 (P0): Admin-Routen hart rollenbasiert schuetzen
ID: `MT-002`

Problem:
- Admin-Routen unter `/:clubSlug/admin*` sind aktuell nur durch Login geschuetzt.

Betroffene Dateien:
- `src/AppRoutes.jsx`
- ggf. `src/App.jsx` (Role-Flags)

Aufgaben:
1. Routen `admin`, `admin/members`, `admin/verein` mit Role-Guard kapseln.
2. Zugriff nur fuer `admin` und `vorstand` erlauben (oder vereinbartes Zielmodell).
3. Einheitliche Forbidden-Darstellung fuer unerlaubte Zugriffe.
4. Guard nicht nur UI-seitig, sondern konsistent mit Backend/RLS-Logik halten.

Definition of Done:
1. Normales Mitglied bekommt bei direkter URL keinen Zugriff auf `admin*`.
2. Vorstand/Admin kommt weiterhin auf alle vorgesehenen Admin-Seiten.
3. Routing-Regressionen geprueft.

---

## Ticket 3 (P0): Page-Views tenant-faehig machen
ID: `MT-003`

Problem:
- `page_views` ist ohne `club_id` modelliert und wird global gelesen.

Betroffene Dateien:
- `sql/create_page_views.sql` (oder neue Migration)
- `src/hooks/usePageViewTracker.js`
- `src/pages/AdminOverview.jsx`

Aufgaben:
1. DB-Migration:
   - `page_views.club_id uuid` ergaenzen.
   - Index auf `(club_id, created_at)` anlegen.
2. Tracker erweitert `insert` um `club_id`.
3. Admin-Auswertungen filtern strikt auf `club_id`.
4. Bestehende Daten:
   - Migrationsstrategie festlegen (legacy rows null lassen, backfill falls moeglich).
5. RLS fuer `page_views` ergaenzen (select/insert nur fuer eigene Membership-Scopes).

Definition of Done:
1. Page-View-Dashboard zeigt nur Daten des aktiven Clubs.
2. Cross-tenant Abruf liefert keine fremden Events.
3. Migration laeuft ohne Datenverlust durch.

---

## Ticket 4 (P1): Signup club-spezifisch absichern
ID: `MT-004`

Problem:
- Whitelist-Check erfolgt derzeit nur ueber `email`, nicht ueber `email + club_id`.
- Profilanlage nutzt `getActiveClubId()` statt robust aufgeloestem Club aus URL-Slug.

Betroffene Dateien:
- `src/components/AuthForm.jsx`

Aufgaben:
1. Beim Signup Club-ID aus `clubSlug` robust aufloesen (wie Login-Pfad).
2. Whitelist nur mit `(email, club_id)` pruefen.
3. Profil mit exakt dieser `resolvedClubId` erstellen.
4. Fehlertexte trennen:
   - Club unbekannt
   - Email fuer Club nicht freigeschaltet
5. Optional: Unique Constraint fuer `whitelist_emails (email, club_id)` sicherstellen.

Definition of Done:
1. Email-Freigabe in Club A erlaubt keine Registrierung in Club B.
2. Signup ist deterministisch auch bei stale/localStorage-Werten.
3. Bestehender Login-Flow bleibt intakt.

---

## Ticket 5 (P1): Superadmin auf Backend-Quelle umstellen
ID: `MT-005`

Problem:
- Superadmin wird im Frontend ueber harte E-Mail geregelt.

Betroffene Dateien:
- `src/App.jsx`
- `src/pages/SuperAdmin.jsx`
- `sql/superadmin_access.sql` (bestehende Funktion `is_superadmin()`)

Aufgaben:
1. Frontend-Hardcode entfernen.
2. Superadmin-Status aus DB/Funktion beziehen (z. B. RPC auf `is_superadmin()` oder Profil-Claim).
3. Guard-Logik in Routen darauf umstellen.
4. Fallback-Handling bei Ladefehlern definieren (deny by default).

Definition of Done:
1. Superadmin-Zugriff folgt DB-Status, nicht E-Mail-String.
2. Entfernen/Hinzufuegen in `superadmins` wirkt ohne Code-Deploy.

---

## Ticket 6 (P1): Query-Hygiene fuer `profiles` und weitere Tabellen
ID: `MT-006`

Problem:
- Einzelne Reads laufen ohne expliziten `club_id`-Filter.

Betroffene Stellen (mindestens):
- `src/pages/AdminOverview.jsx`

Aufgaben:
1. Alle sensitiven Selects reviewen und explizit `club_id` filtern, wo fachlich erforderlich.
2. Fuer Tabellen ohne `club_id` klaeren:
   - global gewollt oder Modellfehler.
3. RLS als harte Leitplanke dokumentieren: Frontend-Filter ist nur zweite Schutzschicht.

Definition of Done:
1. Keine sensible Query ohne eindeutigen Tenant-Scope.
2. Review-Liste im PR dokumentiert (Query-by-Query).

---

## Ticket 7 (P1): RLS-Abdeckung vervollstaendigen
ID: `MT-007`

Problem:
- Vorhandene RLS-Migration deckt nicht sichtbar alle genutzten Tabellen ab.

Betroffene Bereiche:
- SQL-Migrationen im `sql/`-Ordner
- alle produktiv genutzten Tabellen aus Frontend/Functions

Aufgaben:
1. Tabelle-fuer-Tabelle Matrix erstellen:
   - select/insert/update/delete erlaubt fuer welche Rollen/Scopes.
2. Fehlende Policies fuer relevante Tabellen ergaenzen:
   - mindestens `profiles`, `whitelist_emails`, `page_views`
   - optional je nach Nutzung: `weather_cache`, `fish_reactions`, weitere.
3. `alter table ... enable row level security` fuer alle relevanten Tabellen verifizieren.
4. Policies idempotent als Migrationen ablegen.

Definition of Done:
1. Vollstaendige RLS-Matrix vorhanden und mit produktivem Schema abgeglichen.
2. Fremdclub-Zugriff ist per RLS technisch ausgeschlossen.

---

## Ticket 8 (P2): Multi-Tenant Testpaket (Regression + Security)
ID: `MT-008`

Problem:
- Ohne gezielte Tests koennen Cross-Tenant-Regressions unbemerkt wieder auftauchen.

Aufgaben:
1. Testnutzer in mindestens 2 Clubs aufsetzen:
   - Mitglied A, Admin A, Mitglied B, Admin B, Superadmin.
2. Kernfaelle automatisiert oder halbautomatisiert pruefen:
   - Admin-Routen Zugriff
   - Reads/Writes pro Tabelle
   - Push-Trigger Isolation
   - Page-View Isolation
3. Security Smoke Tests fuer Edge Function und RLS dokumentieren.

Definition of Done:
1. Wiederholbare Test-Checkliste vorhanden.
2. Alle P0/P1 Tickets haben nachweisbare gruenen Testdurchlauf.

---

## Erweiterung: Mehrere Gewaesser pro Verein
Wenn ein Verein mehrere Gewaesser hat, reicht `club_id` als einziger Scope nicht mehr aus.
Dann wird ein zweiter fachlicher Scope benoetigt: `waterbody_id`.

Leitregel:
1. Club trennt Mandanten gegeneinander.
2. Gewaesser trennt Daten und Berechtigungen innerhalb eines Clubs.
3. Policies und Queries muessen beide Scopes beruecksichtigen, wo fachlich relevant.

---

## Ticket 9 (P1): Datenmodell fuer Gewaesser einfuehren
ID: `MT-009`

Problem:
- Es gibt noch keine explizite Gewaesser-Entitaet.

Betroffene Bereiche:
- SQL-Migrationen im `sql/`-Ordner
- Tabellen mit Fang-/Regel-/Analytics-Bezug

Aufgaben:
1. Tabelle `waterbodies` anlegen:
   - `id`, `club_id`, `name`, optional `slug`, `is_active`, Timestamps.
2. Relevante Tabellen um `waterbody_id` erweitern:
   - mindestens `fishes`, `crayfish_catches`, `page_views` (optional je Use Case weitere).
3. Foreign Keys und sinnvolle Indexe auf `(club_id, waterbody_id, timestamp)` ergaenzen.
4. Default-Gewaesser je Club fuer Bestand definieren.

Definition of Done:
1. Jeder neue Datensatz mit Gewaesserbezug kann eindeutig einem Gewaesser zugeordnet werden.
2. Backfill-Strategie fuer Bestandsdaten ist dokumentiert und getestet.

---

## Ticket 10 (P1): RLS fuer Club + Gewaesser-Hierarchie erweitern
ID: `MT-010`

Problem:
- Aktuelle RLS prueft primaer Club-Scope, aber nicht feingranular pro Gewaesser.

Betroffene Bereiche:
- RLS-Policies und Hilfsfunktionen in SQL

Aufgaben:
1. Membership-Modell fuer Gewaesserzugriff festlegen:
   - Variante A: Zugriff auf alle Gewaesser eines Clubs.
   - Variante B: explizite Zuordnung pro Gewaesser.
2. RLS-Policies so erweitern, dass Datenzugriff nur fuer erlaubte `(club_id, waterbody_id)` Kombinationen moeglich ist.
3. Admin-Ausnahmen klar definieren (z. B. Vorstand sieht alle Gewaesser im Club).

Definition of Done:
1. Ein User ohne Gewaesser-Recht kann Daten dieses Gewaessers nicht lesen/schreiben.
2. Admin-/Vorstandsregeln funktionieren wie fachlich vereinbart.

---

## Ticket 11 (P1): Aktiven Gewaesser-Kontext in der App einfuehren
ID: `MT-011`

Problem:
- Es gibt aktuell nur `activeClubId`, aber keinen globalen `activeWaterbodyId`.

Betroffene Bereiche:
- `src/utils/clubId.js` (Konzeptvorbild)
- Routing/UI/State-Hooks

Aufgaben:
1. Zentrale Utility fuer `getActiveWaterbodyId()/setActiveWaterbodyId()` einfuehren.
2. UI-Switcher fuer Gewaesser bereitstellen (sichtbar und persistent).
3. Datenabfragen standardmaessig auf aktives Gewaesser filtern.
4. Fallback-Verhalten klar definieren, wenn kein Gewaesser gewaehlt ist.

Definition of Done:
1. User kann zwischen Gewaessern wechseln, ohne Club-Kontext zu verlieren.
2. Jede relevante Ansicht zeigt nur Daten des aktiven Gewaessers oder klar gekennzeichnete Gesamtsicht.

---

## Ticket 12 (P2): Regelwerk und Push auf Gewaesser-Ebene
ID: `MT-012`

Problem:
- Regeln und Benachrichtigungen sind bislang nicht systematisch pro Gewaesser geschnitten.

Betroffene Bereiche:
- Regelwerk-Logik
- Push-Trigger/Empfaengerfilter

Aufgaben:
1. Schonzeit, Mindestmass, Entnahme-Limits optional pro Gewaesser modellieren.
2. Push-Events um `waterbody_id` ergaenzen und nur relevante Empfaenger adressieren.
3. Externe Fangauswertung/Kartenlayer auf Gewaesserkontext abstimmen.

Definition of Done:
1. Regelpruefungen sind pro Gewaesser korrekt.
2. Pushes koennen auf Gewaesser zielgenau eingeschraenkt werden.

---

## Ticket 13 (P2): Testmatrix um Cross-Gewaesser-Faelle erweitern
ID: `MT-013`

Problem:
- Bisherige Tests decken primar Cross-Club, nicht Cross-Gewaesser innerhalb eines Clubs ab.

Aufgaben:
1. Testfaelle fuer mindestens 2 Gewaesser im selben Club definieren.
2. Faelle fuer differenzierte Rechte pruefen:
   - User mit Zugriff auf Gewaesser A, nicht B.
   - Vorstand/Admin mit Zugriff auf beide.
3. Analytics-, Push- und Admin-Views auf Gewaesserisolation verifizieren.

Definition of Done:
1. Cross-Gewaesser-Leaks sind testbar ausgeschlossen.
2. Testpaket ist reproduzierbar und Bestandteil der Release-Abnahme.

---

## Empfohlene Umsetzungsreihenfolge
1. `MT-001`
2. `MT-002`
3. `MT-003`
4. `MT-004`
5. `MT-007`
6. `MT-005`
7. `MT-006`
8. `MT-008`
9. `MT-009`
10. `MT-010`
11. `MT-011`
12. `MT-012`
13. `MT-013`

## Abnahme-Kriterien fuer das Gesamtprojekt
1. Kein User kann Daten eines fremden Clubs lesen oder schreiben.
2. Kein User kann Side Effects (Push, Tracking, Admin-Aktionen) fuer fremde Clubs ausloesen.
3. Rollenrechte sind serverseitig erzwungen (RLS/Function-Auth), nicht nur im Frontend.
4. Tenant-Isolation ist per Tests belegt.
5. Bei Mehrgewaesser-Vereinen sind Daten, Rechte und Benachrichtigungen pro Gewaesser isoliert.



---

## funfacts-forecast-readme

# FunFacts & Prognose: Portierungs-README

## Ziel
Diese README beschreibt die umgesetzte Logik für:
- `FunFactsCards` (Statistiken + Rankings aus Fangdaten)
- `Forecast` (KI-Prognose für jetzt + 7-Tage-Ausblick)

Damit kannst du die Fachlogik in einer anderen App nachbauen, ohne an UI oder Routing dieses Projekts gebunden zu sein.

## Relevante Dateien
- FunFacts-Seite: `src/pages/FunFacts.jsx`
- FunFacts-UI: `src/features/funfacts/FunFactsCards.jsx`
- FunFacts-Logik: `src/features/funfacts/useFunFactsData.js`
- FunFacts-Konstanten: `src/features/funfacts/constants.js`
- FunFacts-Helfer: `src/features/funfacts/utils.js`
- Wetter-Normalisierung: `src/utils/weatherParsing.js`
- Datenquelle Fänge: `src/hooks/useValidFishes.js`
- Forecast-Hook: `src/features/forecast/hooks/useForecast.js`
- Forecast-API-Wrapper: `src/features/forecast/services/forecastApi.js`
- KI-Service: `src/services/aiService.js`
- Wetterquelle Forecast: `src/services/weatherService.js`
- Modellzeitstempel-Merge: `src/features/forecast/services/predictionModelInfo.js`

## Teil 1: FunFacts

## 1. Datenbasis und Vorfilter
`useFunFactsData` arbeitet auf drei Ebenen:
1. `fishes`: sichtbare Rohdaten inkl. Blanks.
2. `validFishes`: nur echte Fänge (kein Blank, bekannte Art, Größe > 0).
3. `statsFishes`: zusätzlich Ausschluss via `count_in_stats=false`, `under_min_size=true`, `out_of_season=true`.

Zusätzliche Ortsgruppen:
- `ferkensbruchFishes`: nur Fänge am Ferkensbruch (via `normalizePlace` + Alias-Regeln).
- `ferkensbruchAllFishes`: wie oben, aber inkl. Blanks.

Sichtbarkeitslogik kommt aus `useValidFishes`:
- Nicht-Vertraute: nur Daten ab `PUBLIC_FROM`.
- Vertraute: optional kompletter Verlauf (`dataFilter=all`).

## 2. Wetter-Normalisierung für Auswertungen
`parseWeather(fish)` macht heterogene Wetterstrukturen vergleichbar und liefert:
- `textLower`
- `moonPhase`
- `tempC`
- `rainMm`
- `windSpeed`
- `windGust`

Wichtige Punkte:
- JSON-String in `fish.weather` wird geparst.
- Temperatur wird auf °C normalisiert (Kelvin/Fahrenheit-Erkennung).
- Regen kann aus Text oder mm-Werten kommen.

Darauf bauen auf:
- `isRainyCatch`
- `isSunnyCatch`
- `extractTempC`
- `extractMoonPhase`

## 3. Kennzahlen in `useFunFactsData`
Es werden viele unabhängige `useMemo`-Rankings berechnet. Kernbeispiele:
- Rekorde: größter/kleinster/schwerster Fisch, meiste Fänge pro Tag/Stunde
- Vielfalt: meiste Arten pro Tag/Stunde, Top-3 Arten
- Zeitmuster: Wochentag, Nachtfänge, Early-Bird, längste Serie/Pause
- Wetter: Regen/Sonne, Vollmond/Neumond, heißester/kältester/extremster Wetterfang
- Spezialtitel: Raubfisch-König, Hecht-Meister, Zander-Queen, Aal-Magier, Grundel-Champion
- Community: Angel-Queen, Rekordjäger, Foto-Künstler
- Meta: `funCardChampion` zählt Namensnennungen aus allen Gewinnerlisten

Wichtige Konstanten:
- `MIN_EFFICIENCY_DAYS = 3`
- `PREDATOR_SET = {barsch, aal, hecht, zander, wels}`
- Wetter-Extremscore über `WEATHER_KEYWORD_SCORES`, `COMFORT_TEMP_C`, `TEMP_TOLERANCE`, `WIND_COMFORT`

## 4. UI-Struktur der FunCards
`FunFactsCards.jsx` ist rein präsentational:
- Erwartet ein großes `data`-Objekt aus `useFunFactsData`.
- Baut ein `cards`-Array mit allen Themen.
- Ordnet Cards über `CARD_GROUPS` in Sektionen.
- Rendert pro Sektion ein Grid mit nummerierten `SectionCard`s.

Portierungstipp:
- Fachlogik in einen service/hook auslagern.
- UI nur an das Ergebnisobjekt binden.
- So kannst du dieselbe Logik in React Native, Next.js oder Vue wiederverwenden.

## Teil 2: Prognose-Logik

## 1. Datenquellen
- Wetter: `weather_cache` (`id = latest`) via `getLatestWeather()`.
- KI-Endpunkt: `${VITE_AI_BASE_URL}/predict` (Fallback: `https://ai.asv-rotauge.de`).

## 2. Input-Mapping fürs Modell
`toModelInput(source)` mappt auf:
- `temp`
- `pressure`
- `wind`
- `humidity`
- `wind_deg`
- `moon_phase`
- `dt`
- `timestamp` (ISO)

Für "jetzt" wird `moon_phase` aus `daily[0]` ergänzt.

## 3. Ablauf in `useForecast`
1. Wetter laden (`getLatestForecastWeather`).
2. Sofort Basestate setzen:
- `weatherData` für die "Jetzt"-Karte
- `dailyPredictions` mit Wetterdaten, aber `aiPrediction: null`
3. Parallel starten:
- Einzelprognose für "jetzt"
- Batch/Fallback-Prognosen für die restlichen Tage
4. Ergebnisse in `dailyPredictions[index].aiPrediction` einhängen.

## 4. Robustheit
- Retry-Mechanismus bei transienten Fehlern:
- Status `408`, `429`, `>=500`
- Netzwerk/Timeout/Fetch-Fehler
- Konfigurierbar via:
- `VITE_FORECAST_RETRY_ATTEMPTS` (0-3)
- `VITE_FORECAST_RETRY_DELAY_MS` (0-5000)

- `AbortController` + `requestId` vermeiden Race-Conditions und stale Updates.
- Fehlerzustand ist scoped:
- `scope: "weather"` (Wetterausfall)
- `scope: "ai"` (nur KI-Ausfall)

## 5. Erwartete KI-Response (minimal)
Für Forecast-UI benötigt:
- `probability` (0-100)
- `prediction` (1 = Fang wahrscheinlich, 0 = eher Blank)
- `per_fish_type` (Map `Fischart -> Prozent`)
- optional `trend`, `stats`, Modell-Zeitstempel

Zusatz:
- `withModelTimestamps(...)` füllt fehlende Zeitstempel aus mehreren möglichen Feldern auf.

## Portierung in eine andere App (empfohlen)
1. Wetter- und Fangdatenquellen anbinden.
2. `weatherParsing`-Logik übernehmen, damit Alt-/Mischdaten stabil laufen.
3. FunFacts-Berechnung als reinen Service/Hook übernehmen.
4. Forecast-Hook mit Retry/Abort 1:1 übernehmen.
5. UI separat bauen, nur gegen folgende Datenverträge:
- `funFactsResult` (alle Rankings + Kennzahlen)
- `forecastState = { loading, weatherData, aiPrediction, dailyPredictions, forecastError, reload }`

## Schnell-Check nach Portierung
- Kommt bei fehlender KI trotzdem Wetter-UI?
- Bleiben alte Requests ohne Einfluss bei schnellem Reload?
- Sind Blanks/Min-Size/Out-of-Season korrekt aus den Stats gefiltert?
- Funktionieren Mond-/Regen-/Sonnen-Erkennung bei alten Datensätzen?
- Ist `per_fish_type` im 7-Tage-Ausblick korrekt sortiert und darstellbar?


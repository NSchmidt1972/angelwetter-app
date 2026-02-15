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

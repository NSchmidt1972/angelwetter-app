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

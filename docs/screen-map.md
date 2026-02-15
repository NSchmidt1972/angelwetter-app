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

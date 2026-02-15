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

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

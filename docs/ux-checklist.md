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

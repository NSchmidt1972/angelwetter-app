# Go-Live Checkliste

Stand: 2026-03-12
Projekt: Angelwetter App

## P0 vor Go-Live (Must-have)

- [x] Weather-API-Keys aus dem Frontend entfernen und über Backend/Edge Function kapseln.
  Aktuell betroffen: `src/api/weather.js`.
- [x] Nach Umstellung alle potentiell exponierten Secrets rotieren.
  Mindestens: OpenWeather, Supabase, OneSignal.
  Runbook: `docs/secret-rotation.md`.
- [x] Supabase RLS-/Rechte-Audit für produktive Tabellen und RPCs durchführen.
  Ergebnis dokumentieren (erlaubte Rollen, erlaubte Operationen).
  Ergebnis: `docs/supabase-rls-audit-2026-03-13.md`.
  Live-Remediation angewendet über `supabase/migrations/20260313173000_060_live_rls_lockdown.sql`.
- [x] Fehler-Monitoring und Alerts für Frontend, Edge Functions und AI-Endpunkt aktivieren.
  Implementiert über `opsAlert` (Supabase Edge Function) mit Wiring in Frontend (`src/services/opsAlert.js`), Edge Functions (`weatherProxy`, `sendCatchPush`) und AI (`ai/server.py`).
  Triage-Persistenz: `public.ops_alert_events` (inkl. `request_id`, `source`, `service`, `context`, Channel-Ergebnis).
  Alarmkanal verifiziert am 2026-03-13: OneSignal (`request_id`: `cb35b6c5-7d43-441a-89d1-3b3231211334`).
  Nachweis/Doku: `docs/monitoring-alerting-2026-03-13.md`.
- [ ] Backup- und Restore-Test der produktiven Datenbank durchführen.
  Restore muss einmal erfolgreich nachgewiesen sein.
- [ ] CI-Release-Gate verbindlich setzen.
  `lint`, `build` und `test:ux:func` müssen vor Release grün sein.
- [ ] Rollback-Plan dokumentieren.
  Enthalten: letzte stabile Version, Migrationsstrategie, Verantwortliche.
- [ ] Produktions-Umgebung von Dev/Test sauber trennen.
  Keine Dev-IDs/Keys in Prod; vollständige `.env`-Dokumentation vorhanden.
- [ ] Datenschutz-/Rechtstexte und Push-Einwilligungsfluss prüfen.
  Insbesondere für Tracking/Page-Views und Benachrichtigungen.
- [ ] Finalen Prod-Smoke-Test auf echten Geräten/Browsern durchführen.
  Pflichtflows: Login, Fang speichern, Forecast laden, Push an/aus.

## P1 nach Go-Live (stark empfohlen)

- [ ] Push-Stack konsolidieren und Legacy-Pfade entfernen.
  Kandidaten: `src/hooks/useOneSignal.js`, `src/onesignal/OneSignalLoader.js`, `src/onesignal/OneSignalSync.js`.
- [ ] Wetter-Datenpfade vereinheitlichen.
  Kandidaten: `src/api/weather.js`, `src/services/weather.js`, `src/services/weatherService.js`.
- [ ] Große Dateien in kleinere Domänenmodule aufteilen.
  Priorität: `App`, `AppRoutes`, `onesignalService`, `AdminOverview`, FunFacts-Feature.
- [ ] Layer-Grenzen schärfen: keine Page-in-Page-Abhängigkeiten.
  Beispiel: `src/pages/BoardOverview.jsx` nutzt `src/pages/AdminMembersManage.jsx`.
- [ ] Unit-Tests für kritische Hooks/Services ergänzen.
  Fokus: Auth, Push, Forecast, Club-Kontext, Retry/Timeout-Logik.
- [ ] SLOs/SLIs definieren und regelmäßig überwachen.
  Beispiele: Login-Erfolgsrate, Save-Catch-Fehlerrate, Push-Sync-Fehlerquote.

## Konkrete Monitoring- und Testvorschlaege (P0/P1/P2)

### P0 (vor Go-Live, verbindlich)

- [ ] Error-Tracking aktivieren (Frontend + Supabase Edge Functions + AI-Endpunkt).
  Tool-Vorschlag: Sentry.
  Done-Definition: Testfehler wird in allen 3 Bereichen mit Release-Tag angezeigt; Alarm geht an Mail/Slack.
- [ ] Uptime-Monitoring fuer App und API-Endpunkte aktivieren.
  Tool-Vorschlag: Better Stack Uptime oder Uptime Kuma.
  Done-Definition: Checks auf `/`, Auth-Route und Health-Endpunkt laufen im 1-5-Min-Takt und alarmieren verifiziert.
- [ ] Strukturierte Logs mit Korrelation einführen.
  Tool-Vorschlag: JSON-Logs + Supabase Log Explorer (optional Export nach Loki/Datadog).
  Done-Definition: Jeder Request hat `request_id`, `route`, `status`, `duration_ms` und ist fuer Incident-Analyse filterbar.
- [ ] Kern-SLOs inklusive Alerts festlegen.
  Tool-Vorschlag: Dashboard in Grafana oder Better Stack.
  Zielwerte Start: Verfuegbarkeit >= 99.5%, p95 API < 800 ms, Fehlerquote < 2%.
  Done-Definition: Alarme feuern bei Schwellwert-Ueberschreitung und sind einmal per Testalarm verifiziert.
- [ ] Release-Gate um UX-Qualitaet erweitern.
  Bestehende Kommandos: `npm run lint`, `npm run build`, `npm run test:ux:func`, `npm run test:ux:lighthouse`.
  Done-Definition: Release wird bei einem roten Schritt blockiert.
- [ ] Produktions-Smoke-Test nach jedem Deploy standardisieren.
  Tool-Vorschlag: Playwright-Profil fuer Prod-Smoke (kritische Happy-Paths).
  Done-Definition: Login, Forecast, Fang speichern, Push an/aus laufen automatisiert gegen Prod/Staging.

### P1 (in den ersten 2-6 Wochen)

- [ ] Unit- und Integrationstests fuer kritische Services/Hooks ausbauen.
  Tool-Vorschlag: Vitest + Testing Library.
  Fokus: Auth-Flow, Weather-Service, OneSignal-Sync, Retry/Timeout.
  Done-Definition: Kritische Module haben stabile Testabdeckung; neue Regressionen werden in CI gefunden.
- [ ] Real User Monitoring (RUM) fuer Web Vitals erfassen.
  Tool-Vorschlag: `web-vitals` + Event-Tracking nach Supabase/Analytics.
  Done-Definition: INP/LCP/CLS pro Route im Dashboard sichtbar, inkl. p75-Werte.
- [ ] UX-Agent Qualitaetsmetriken einfuehren.
  Metriken: Task-Success-Rate, Fallback-Rate, Agent-Latenz, Kosten pro Session, Retry-Rate.
  Done-Definition: Metriken sind je Prompt-/Model-Version vergleichbar.
- [ ] Accessibility-Regression als festen CI-Check fuehren.
  Tooling vorhanden: `@axe-core/playwright` in `tests/ux-agent/specs/auth-and-ux.spec.js`.
  Done-Definition: Keine `serious`/`critical` Violations auf Hauptflows.
- [ ] Incident-Prozess und On-Call leichtgewichtig dokumentieren.
  Inhalte: Severity-Schema, Reaktionszeit, Runbooks fuer "Login down", "Forecast down", "Push down".
  Done-Definition: Ein Teammitglied kann nur mit Doku einen Incident sauber abarbeiten.

### P2 (nach Stabilisierung, Optimierung)

- [ ] Synthetische Journeys fuer mehrere Standorte/Geraete hinzufuegen.
  Tool-Vorschlag: Checkly oder Better Stack Browser Checks.
  Done-Definition: Regionale Probleme (DNS/CDN/Edge) werden vor Nutzerbeschwerden erkannt.
- [ ] Contract-Tests fuer externe APIs (z. B. Wetterprovider) einfuehren.
  Tool-Vorschlag: Pact oder schema-basierte Response-Guards.
  Done-Definition: Breaking API-Aenderungen schlagen vor Deploy fehl.
- [ ] Monatlichen Restore-Drill und Security-Review etablieren.
  Scope: Backup-Restore, Key-Rotation, RLS-Stichprobe, Dependency-Vulnerability-Scan.
  Done-Definition: Protokoll mit Datum, Befund, Owner und Frist fuer Findings liegt vor.

## Abnahme

- [ ] P0 vollständig abgeschlossen.
- [ ] Go-Live Entscheidung dokumentiert (Datum, Verantwortliche, offene Restrisiken).

## Hosting-Check robots.txt

- [ ] Deployment enthält `public/robots.txt` als echte Datei im Webroot.
- [ ] `https://app.asv-rotauge.de/robots.txt` liefert HTTP `200` mit `Content-Type: text/plain`.
- [ ] CDN/Ingress-Rewrite-Regeln schließen `/robots.txt` vom SPA-Fallback auf `/index.html` aus.

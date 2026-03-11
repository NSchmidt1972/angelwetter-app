# Go-Live Checkliste

Stand: 2026-03-10
Projekt: Angelwetter App

## P0 vor Go-Live (Must-have)

- [ ] Weather-API-Keys aus dem Frontend entfernen und über Backend/Edge Function kapseln.
  Aktuell betroffen: `src/api/weather.js`.
- [ ] Nach Umstellung alle potentiell exponierten Secrets rotieren.
  Mindestens: OpenWeather, Supabase, OneSignal.
- [ ] Supabase RLS-/Rechte-Audit für produktive Tabellen und RPCs durchführen.
  Ergebnis dokumentieren (erlaubte Rollen, erlaubte Operationen).
- [ ] Fehler-Monitoring und Alerts für Frontend, Edge Functions und AI-Endpunkt aktivieren.
  Mindestens ein funktionierender Alarmkanal (z. B. Mail/Slack) muss verifiziert sein.
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

## Abnahme

- [ ] P0 vollständig abgeschlossen.
- [ ] Go-Live Entscheidung dokumentiert (Datum, Verantwortliche, offene Restrisiken).

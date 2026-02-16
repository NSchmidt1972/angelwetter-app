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

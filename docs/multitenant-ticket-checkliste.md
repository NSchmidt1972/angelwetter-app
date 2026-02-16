# Multi-Tenant Hardening: Ticket-Checkliste

Stand: 2026-02-16
Scope: Frontend, Supabase SQL/RLS, Edge Functions

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

## Empfohlene Umsetzungsreihenfolge
1. `MT-001`
2. `MT-002`
3. `MT-003`
4. `MT-004`
5. `MT-007`
6. `MT-005`
7. `MT-006`
8. `MT-008`

## Abnahme-Kriterien fuer das Gesamtprojekt
1. Kein User kann Daten eines fremden Clubs lesen oder schreiben.
2. Kein User kann Side Effects (Push, Tracking, Admin-Aktionen) fuer fremde Clubs ausloesen.
3. Rollenrechte sind serverseitig erzwungen (RLS/Function-Auth), nicht nur im Frontend.
4. Tenant-Isolation ist per Tests belegt.

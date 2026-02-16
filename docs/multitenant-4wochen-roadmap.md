# Multi-Tenant Roadmap (Kurzfassung)

Stand: 2026-02-16  
Start: Montag, 16. Februar 2026  
Zweck: Management-Timeline. Die fachliche Detailquelle bleibt die Ticketliste.

## Dokumentrolle
1. Diese Datei enthaelt nur Zeitplan, Prioritaeten und Gates.
2. Ticket-Details stehen in `docs/multitenant-ticket-checkliste.md`.
3. Migrationsdetails stehen in `docs/migration-supabase-onesignal.md`.

## Phase 1: 4 Wochen bis Verkaufsfreigabe

### Woche 1 (16.02.2026-22.02.2026)
1. `MT-001` Push-Function absichern.
2. `MT-002` Admin-Routen rollenbasiert sperren.

Gate:
1. Kein fremdclub Push.
2. Kein unberechtigter Zugriff auf `/:clubSlug/admin*`.

### Woche 2 (23.02.2026-01.03.2026)
1. `MT-004` Signup club-spezifisch absichern.
2. `MT-007` RLS-Matrix und Policy-Gaps aufbauen.

Gate:
1. Kein clubfremder Signup.
2. RLS-Gap-Liste ist vollstaendig priorisiert.

### Woche 3 (02.03.2026-08.03.2026)
1. `MT-003` `page_views` tenant-faehig machen.
2. `MT-007` fehlende Policies produktiv schliessen.

Gate:
1. Analytics nur innerhalb des aktiven Clubs.
2. Serverseitige Isolation ist durchgaengig.

### Woche 4 (09.03.2026-15.03.2026)
1. `MT-006` Query-Hygiene abschliessen.
2. `MT-005` Superadmin auf Backend-Quelle umstellen.
3. `MT-008` End-to-End Testpaket durchlaufen.

Go/No-Go:
1. Cross-Tenant-Leaks = 0.
2. Rechte sind serverseitig erzwungen.
3. Testprotokoll ist reproduzierbar.

## Phase 2 danach: Mehrgewaesser-Ausbau (6 Wochen)
1. Block A (Woche 1-2): `MT-009` Datenmodell + Backfill.
2. Block B (Woche 3-4): `MT-010` RLS-Hierarchie + `MT-011` App-Kontext.
3. Block C (Woche 5-6): `MT-012` Regelwerk/Push + `MT-013` Cross-Gewaesser-Tests.

Abnahme:
1. Rechte und Daten sind pro Gewaesser isoliert.
2. Push und Regeln laufen im korrekten Gewaesser-Scope.

## Optional parallel oder danach: iPhone/App Store
Erst starten, wenn Phase-1-Gates gruen sind.

# Supabase RLS-/Rechte-Audit (Live + Remediation)

Stand: 2026-03-13  
Projekt: `kirevrwmmthqgceprbhl` (`https://kirevrwmmthqgceprbhl.supabase.co`)

## Scope und Methode

- Live-Schema-Dump vor Remediation: `/tmp/kire-public.sql`
- Live-Schema-Dump nach Remediation: `/tmp/kire-public-after.sql`
- Remediation angewendet via:
  `supabase/migrations/20260313173000_060_live_rls_lockdown.sql`

## Ergebnis Vorher/Nachher

| Kennzahl | Vorher | Nachher |
|---|---:|---:|
| Public-Tabellen mit RLS enabled | 21/21 | 21/21 |
| Anzahl Policies gesamt | 84 | 72 |
| Policies ohne `TO` (PUBLIC) | 45 | 0 |
| Tabellen mit `anon` DML (`SELECT/INSERT/UPDATE/DELETE`) | 21 | 0 |
| `anon` Table-Grant | DML auf alle Tabellen | nur `SELECT` auf `clubs` |
| Funktionen mit `anon` `GRANT ALL` | 17 | 1 (`is_email_whitelisted`) |

## Live-Befund nach Remediation

- Kritische Ueberberechtigungen sind geschlossen:
  - keine `PUBLIC`-Policies mehr,
  - keine `anon`-Schreibrechte mehr auf Tabellen,
  - `anon`-Funktionszugriff auf ein Minimum reduziert.
- Erlaubte anonyme DB-Pfade sind jetzt explizit:
  - `SELECT` auf `public.clubs` (Club-Aufloesung),
  - `EXECUTE` auf `public.is_email_whitelisted(text, uuid)` (Signup-Whitelist-Check).
- RPC-Rechte fuer Admin-Statistikfunktionen sind nicht mehr fuer `anon` gesetzt:
  - `admin_page_view_years`,
  - `admin_page_view_monthly_counts`.

## Rollen-/Operationsmatrix (nach Remediation)

### `anon`

- Tabellen:
  - `clubs`: `SELECT`
  - alle anderen Tabellen: kein Grant
- Funktionen:
  - `is_email_whitelisted(text, uuid)`: `EXECUTE`
  - alle anderen relevanten RPCs: kein `anon`-Grant

### `authenticated`

- Tabellenzugriffe laufen ueber RLS-Policies mit Club-/Rollenpruefung.
- Zentrale Muster:
  - Mitglied: lesen/schreiben in Clubdaten nur im eigenen Club-Kontext.
  - Admin/Vorstand: erweiterte Rechte fuer Board-/Admin-Tabellen.
  - Superadmin: volle Administrative Rechte.

### `service_role`

- Serverseitige Rolle, weiterhin mit erweiterten Rechten fuer Edge/Backend.
- Muss als Hochrisiko-Secret behandelt und regelmaessig rotiert werden.

## Offene Hinweise

- Die Migration wurde direkt live angewendet; wenn gewuenscht, kann dieselbe Migration
  auf weitere Umgebungen (z. B. Staging) analog ausgerollt werden.
- Fuer langfristige Drift-Kontrolle empfiehlt sich ein regelmaessiger Live-Diff
  (z. B. monatlich) gegen den erwarteten Migrationsstand.

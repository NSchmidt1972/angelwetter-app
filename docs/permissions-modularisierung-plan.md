# Berechtigungen & Feature-Freischaltungen: Analyse und Umbauplan

## 1. Ist-Analyse (Projektstand)

### 1.1 Bereits vorhanden
- Multi-Club-Basis ist bereits in Supabase vorhanden:
  - `clubs`
  - `memberships`
  - `profiles`
  - `superadmins`
- Rollenwerte sind bereits etabliert: `gast`, `mitglied`, `tester`, `vorstand`, `admin` (plus `inactive`).
- RLS ist bereits aktiv und umfasst viele Tabellen (`fishes`, `profiles`, `memberships`, `page_views`, `push_subscriptions`, ...).
- Club-Kontext ist im Frontend bereits vorbereitet (`src/utils/clubId.js`, `ClubGuard` in `src/routes/ProtectedRoutes.jsx`).

### 1.2 Aktuelle Schwächen / technische Schulden
- Rollenlogik ist verteilt statt zentral:
  - `src/App.jsx`: Ableitung von `isAdmin`/`canAccessBoard` aus `profile.role`.
  - `src/routes/ProtectedRoutes.jsx`: eigene Guards (`RequireManagement`, `RequireSuperAdmin`).
  - `src/config/navItems.js` + `src/components/Navbar.jsx`: Sichtbarkeit über Flags statt zentrale Permission-API.
  - Mehrfach vorhandene Rollen-Normalisierung (z. B. in `AdminMembersManage` und `features/boardOverview/utils`).
- Feature-Freischaltung existiert nicht persistent:
  - `src/pages/AdminVereinManage.jsx` hat nur lokalen UI-State (`Set`) ohne DB-Speicherung.
- Rollenquelle ist inkonsistent:
  - `memberships.role` und `profiles.role` existieren parallel.
  - Aktuell nutzt die App hauptsächlich `profiles.role`; langfristig sollte `memberships` führend sein.
- Harte Sonderlogik ist weiterhin vorhanden:
  - `src/pages/AdminMembersManage.jsx`: Admin-Rolle darf nur für Namen `Nicol Schmidt` vergeben werden.
  - `src/components/Navbar.jsx`: Datenfilter nur für `Nicol Schmidt`.
  - `src/pages/AdminOverview.jsx`: Sonderkonstante `PAGE_VIEW_EXCLUDED_ANGLER = 'nicol schmidt'`.
- Feature-Zugriffe sind aktuell nicht explizit route-basiert abgesichert (z. B. Forecast/Map/Analysis/Push).

### 1.3 Einordnung zur User-Anforderung
- Die gewünschte Rollenstruktur ist bereits datenmodellseitig fast vorhanden.
- Der größte Gap ist **fehlende zentrale Permission-Schicht + fehlende `club_features` Persistenz + fehlende Feature-Guards**.
- Zusätzlich muss die Rollenquelle konsolidiert werden (weg von ad-hoc `profile.role`-Checks).

---

## 2. Zielarchitektur (für dieses Projekt)

## 2.1 Datenmodell (Supabase)
Hinweis: Das Projekt hat bereits `memberships`. Daher ist es sinnvoll, **bestehende Tabelle weiterzuverwenden**, statt eine neue `club_memberships` parallel einzuführen.

- Bestehend weiter nutzen:
  - `clubs` (fachlich identisch zu deiner gewünschten Struktur)
  - `memberships` (entspricht `club_memberships`)
- Neu einführen:
  - `club_features`
    - `id uuid primary key default gen_random_uuid()`
    - `club_id uuid not null references clubs(id) on delete cascade`
    - `feature_key text not null`
    - `enabled boolean not null default false`
    - `created_at timestamptz not null default now()`
    - `updated_at timestamptz not null default now()`
    - `unique(club_id, feature_key)`
    - `check(feature_key in (...))`
  - `club_role_features` (zweite Ebene: Feature pro Rolle im Club)
    - `id uuid primary key default gen_random_uuid()`
    - `club_id uuid not null references clubs(id) on delete cascade`
    - `role text not null`
    - `feature_key text not null`
    - `enabled boolean not null default true`
    - `created_at timestamptz not null default now()`
    - `updated_at timestamptz not null default now()`
    - `unique(club_id, role, feature_key)`
    - `check(role in ('gast','mitglied','tester','vorstand','admin'))`
    - `check(feature_key in (...))`

Feature-Key-Set (zentral):
- `forecast`
- `map`
- `push`
- `leaderboard`
- `analysis`
- `admin_tools`
- `catch_logging`
- `weather`

## 2.2 Rollenhierarchie (zentral)
- `gast < mitglied < tester < vorstand < admin`
- `inactive` bleibt als technischer Sonderstatus außerhalb der Hierarchie.

## 2.3 Frontend Permission Layer
Neue zentrale Schicht:
- `src/permissions/roles.js`
- `src/permissions/features.js`
- `src/permissions/PermissionContext.jsx`
- `src/permissions/usePermissions.js`
- `src/components/guards/RequireRole.jsx`
- `src/components/guards/RequireFeature.jsx`
- `src/components/guards/RequireClubAccess.jsx`

`usePermissions()` soll liefern:
- `currentClub`
- `memberships`
- `membership` (aktiv im aktuellen Club)
- `role`
- `roleLevel`
- `features` (Map/Set)
- `hasRole(roleName)`
- `hasAtLeastRole(roleName)`
- `hasFeature(featureKey)`
- `hasFeatureForRole(featureKey)` (wertet Club-Feature + Rollen-Override aus)
- `canAccess(routeOrFeature)`
- `loading`, `error`

## 2.4 Club-Konzept (erste Ausbaustufe)
- Aktiver Club bleibt zunächst `currentClub`.
- Auswahlstrategie v1:
  1. Club aus URL (`/:clubSlug`) + `ClubGuard`
  2. Fallback: erster aktiver Membership-Club
- UI-Clubswitcher nur vorbereitet (nicht vollständig ausbauen in diesem Schritt).

## 2.5 Freigabelogik (Priorität)
- Regel 1: Ist ein Feature in `club_features` deaktiviert, ist es für alle Rollen im Club deaktiviert.
- Regel 2: Ist das Club-Feature aktiv, entscheidet `club_role_features` pro Rolle über an/aus (falls Eintrag vorhanden).
- Regel 3: Fehlt ein Rollen-Eintrag, gilt Default `enabled = true` für dieses Rollen-Feature.
- Regel 4: Für sensible Bereiche gilt zusätzlich Mindestrolle (z. B. `admin_tools` mindestens `vorstand`), auch wenn Feature aktiv ist.

## 2.6 Admin-Seite für Freigaben
- Neue Seite: `/:clubSlug/admin/permissions`
- Zugriff: nur `vorstand`, `admin` des jeweiligen Clubs
- Bereich A: Club-Module (Toggles aus `club_features`)
- Bereich B: Rollenmatrix pro Modul (Toggles aus `club_role_features`)
- Darstellung: Zeilen = Feature, Spalten = Rollen (`gast`, `mitglied`, `tester`, `vorstand`, `admin`)
- Sicherheitsnetz: Speicherung nur serverseitig erlaubt, UI ist nur Bedienoberfläche

## 2.7 Superadmin-Seite für Club-Anlage
- Erweiterung der Superadmin-Verwaltung um Club-Management:
  - Route: `/superadmin/clubs`
  - Detailroute: `/superadmin/clubs/:clubId`
  - Zugriff: nur `superadmin`
- Funktionen:
  - neuen Club anlegen (`slug`, `name`, optional `host`, `is_active`)
  - Club aktiv/inaktiv schalten
  - Standardmodule für neuen Club initial setzen (`club_features`)
  - optionale Rollen-Defaults pro Feature setzen (`club_role_features`)
- Ergebnis: Neue Clubs müssen nicht mehr manuell im Supabase Table Editor angelegt werden.

## 2.8 SaaS Routing-Modell (empfohlen)
- Trennung in zwei Ebenen:
  - `Control Plane` (global, ohne Tenant-Slug): nur Owner/Superadmin
  - `Tenant App` (mit Tenant-Slug): normale Nutzung pro Club
- Empfohlene Routen:
  - Control Plane: `/superadmin`, `/superadmin/clubs`, `/superadmin/clubs/:clubId`
  - Tenant App: `/:clubSlug/dashboard`, `/:clubSlug/admin/*`, `/:clubSlug/admin/permissions`
- Vorteil:
  - keine künstliche Bindung globaler Administration an einen „aktuellen Club“
  - klarer, saas-üblicher Verantwortungsbereich zwischen Plattform und Tenant

---

## 3. Schritt-für-Schritt-Umsetzungsplan (ohne Coding in diesem Schritt)

## Phase 0: Baseline & Konsolidierung
1. Rollen- und Feature-Konstanten final definieren (keine Magic Strings mehr).
2. Festlegen: `memberships.role` wird führende Rollenquelle.
3. `profiles.role` vorerst kompatibel weiterführen (Read-Fallback), mittelfristig entkoppeln.

## Phase 1: DB-Migration für Features
1. Neue Migration anlegen für `club_features` und `club_role_features`.
2. Index + Unique + Check-Constraint setzen.
3. `updated_at` Trigger ergänzen.
4. Initial-Seeding pro Club:
   - `club_features`: gewünschte Club-Defaults
   - `club_role_features`: optionale Rollen-Defaults (wenn leer, greifen Defaultregeln)

## Phase 2: RLS/Funktionen für Berechtigungen
1. SQL-Helferfunktionen ergänzen:
   - `role_level(p_role text)`
   - `is_role_at_least(p_club_id uuid, p_min_role text)`
   - `is_feature_enabled(p_club_id uuid, p_feature_key text)`
   - `is_role_feature_enabled(p_club_id uuid, p_role text, p_feature_key text)`
2. RLS für `club_features` und `club_role_features`:
   - `select`: Club-Mitglied oder Superadmin
   - `insert/update/delete`: `vorstand/admin` im Club oder Superadmin
3. Bestehende Policies prüfen/verschärfen:
   - Gast darf lesen, aber nicht alles schreiben (z. B. `fishes_insert` auf mindestens `mitglied`)
   - Verwaltungstabellen nur `vorstand/admin`
4. Edge Functions (insb. `sendCatchPush`) um Feature- und Rollenprüfung ergänzen:
   - `push`-Feature muss im Club aktiviert sein
   - optional Mindestrolle für Push-Auslösung

## Phase 3: PermissionProvider im Frontend
1. `PermissionProvider` hinzufügen und in `src/main.jsx` unterhalb `AuthProvider` einhängen.
2. Provider lädt:
   - aktive Membership(s)
   - aktuelle Club-Features
   - Rollen-Feature-Overrides des aktiven Clubs
3. Fallbacks implementieren:
   - keine Membership -> Rolle `gast` + restriktive Defaults
   - fehlende Feature-Zeilen -> default `false`
   - fehlende Rollen-Feature-Zeilen -> default `true` (bei aktivem Club-Feature)
4. Loading/Error-States zentral kapseln.

## Phase 4: UI-/Routing-Umbau auf zentrale Checks
1. `App.jsx`:
   - `isAdmin`/`canAccessBoard`-Ableitung entfernen
   - stattdessen `usePermissions()` verwenden
2. `AppRoutes`/`ProtectedRoutes`:
   - neue Guard-Komponenten einsetzen (`RequireRole`, `RequireFeature`, `RequireClubAccess`)
   - globale Control-Plane-Routen ohne `clubSlug` ergänzen (`/superadmin/*`)
3. `Navbar` + `navItemsFor`:
   - Sichtbarkeit über `hasFeatureForRole` + `hasAtLeastRole`
4. Admin-Bereiche:
   - `/admin`, `/admin/*`, `/admin2`, `/vorstand` auf rollenbasierte Guards umstellen
5. Feature-seitige Seiten absichern:
   - `analysis`, `map`, `forecast`, `leaderboard`, `weather`, `catch_logging`, `push` usw.
6. Neue Route integrieren:
   - `/:clubSlug/admin/permissions` mit `RequireRole('vorstand')`

## Phase 5: Superadmin Club-Management
1. Superadmin-Bereich als globale Control Plane ausbauen (`/superadmin/*`).
2. `SuperAdminClubsPage` unter `/superadmin/clubs` implementieren.
3. `SuperAdminClubDetailPage` unter `/superadmin/clubs/:clubId` implementieren.
4. Guarding nur über `is_superadmin`, ohne Club-Membership-Abhängigkeit.
5. UI zum Anlegen eines Clubs implementieren:
   - Eingaben: `slug`, `name`, optional `host`, `is_active`
   - Validierung: Slug-Format und Eindeutigkeit
6. Bootstrap beim Club-Anlegen:
   - `clubs`-Insert
   - Default-Features in `club_features`
   - optionale Rollen-Defaults in `club_role_features`
7. Optional: initialen Vorstand/Admin als Membership für den neuen Club setzen.
8. Optional: Deep-Link zur Tenant-Permissions-Seite (`/:clubSlug/admin/permissions`) aus der Detailansicht.

## Phase 6: Sonderlogik abbauen
1. Namensbasierte Admin-Freigaben entfernen:
   - `AdminMembersManage` (`Nicol Schmidt`-Sonderfall)
2. Namensbasierte UI-Sonderfälle entkoppeln oder als Feature flaggen:
   - `Navbar` Datenfilter-Sonderfall
   - `AdminOverview` Exclude-Konstante
3. Doppelte Rollen-Normalisierung eliminieren (ein Modul als Single Source of Truth).

## Phase 7: Admin UI für Feature-Freischaltungen
1. Neue Seite `AdminPermissionsPage` unter `/:clubSlug/admin/permissions` anlegen.
2. Bereich A: Club-Feature-Toggles (`club_features`) mit DB-Anbindung.
3. Bereich B: Rollenmatrix (`club_role_features`) mit DB-Anbindung.
4. `AdminVereinManage` optional als Vereinsdesign-Seite behalten oder auf `permissions` verlinken.
5. Toggle-UI mit optimistic update + rollback bei Fehler.
6. Änderungshistorie optional später (nicht v1-kritisch).

## Phase 8: Tests & Rollout
1. Unit-Tests für:
   - Rollenhierarchie (`hasAtLeastRole`)
   - Featureauflösung
2. Integrations-/Route-Tests:
   - gesperrte Route => deny view
   - deaktiviertes Feature => nicht sichtbar + nicht erreichbar
3. RLS-Tests (SQL/Testskript):
   - Gast darf lesen, nicht schreiben
   - Mitglied darf Fangdaten erstellen
   - Vorstand/Admin dürfen Verwaltungsfunktionen
4. Migrations-Rollout:
   - zuerst DB + RLS
   - dann Frontend aktivieren
   - danach Legacy-Checks entfernen

---

## 4. Konkrete Einstiegsstellen im aktuellen Code

Primär anzupassen:
- `src/App.jsx`
- `src/AppRoutes.jsx`
- `src/routes/ProtectedRoutes.jsx`
- `src/routes/ControlPlaneRoutes.jsx` (neu, empfohlen)
- `src/components/Navbar.jsx`
- `src/config/navItems.js`
- `src/AuthContext.jsx` (nur Schnittstelle prüfen; Permissions separat halten)
- `src/pages/AdminVereinManage.jsx`
- `src/pages/AdminPermissionsPage.jsx` (neu)
- `src/pages/SuperAdmin.jsx`
- `src/pages/SuperAdminClubsPage.jsx` (neu, empfohlen)
- `src/pages/SuperAdminClubDetailPage.jsx` (neu, empfohlen)
- `src/AdminLayout.jsx` (neuer Admin-Navigationspunkt)
- `src/pages/AdminMembersManage.jsx`
- `src/pages/Home.jsx` (admin-spezifische Temperaturanzeige auf `hasAtLeastRole` umstellen)
- `supabase/functions/sendCatchPush/index.ts`
- neue Supabase-Migration für `club_features`, `club_role_features` + Policy-Update

Sekundär zu prüfen:
- `src/pages/Analysis.jsx`
- `src/pages/MapView.jsx`
- `src/pages/Forecast.jsx`
- `src/pages/Leaderboard.jsx`
- `src/components/PushInit.jsx`
- `src/onesignal/*`

---

## 5. Vorschlag für SQL-Bausteine (Planungsstand)

## 5.1 Tabelle `club_features` (neu)
```sql
create table if not exists public.club_features (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  feature_key text not null,
  enabled boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint club_features_unique unique (club_id, feature_key),
  constraint club_features_feature_key_check check (
    feature_key in (
      'forecast','map','push','leaderboard',
      'analysis','admin_tools','catch_logging','weather'
    )
  )
);

create index if not exists club_features_club_idx on public.club_features (club_id);
```

## 5.2 Tabelle `club_role_features` (neu)
```sql
create table if not exists public.club_role_features (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  role text not null,
  feature_key text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint club_role_features_unique unique (club_id, role, feature_key),
  constraint club_role_features_role_check check (
    role in ('gast','mitglied','tester','vorstand','admin')
  ),
  constraint club_role_features_feature_key_check check (
    feature_key in (
      'forecast','map','push','leaderboard',
      'analysis','admin_tools','catch_logging','weather'
    )
  )
);

create index if not exists club_role_features_club_idx on public.club_role_features (club_id);
```

## 5.3 Rollen-Helferfunktion
```sql
create or replace function public.role_level(p_role text)
returns int
language sql
immutable
as $$
  select case lower(coalesce(trim(p_role), ''))
    when 'gast' then 10
    when 'mitglied' then 20
    when 'tester' then 30
    when 'vorstand' then 40
    when 'admin' then 50
    else 0
  end;
$$;
```

## 5.4 Role/Feature Checks
```sql
create or replace function public.is_role_at_least(p_club_id uuid, p_min_role text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_superadmin()
    or exists (
      select 1
      from public.memberships m
      where m.user_id = auth.uid()
        and m.club_id = p_club_id
        and m.is_active = true
        and public.role_level(m.role) >= public.role_level(p_min_role)
    );
$$;

create or replace function public.is_feature_enabled(p_club_id uuid, p_feature_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.club_features f
    where f.club_id = p_club_id
      and f.feature_key = p_feature_key
      and f.enabled = true
  );
$$;

create or replace function public.is_role_feature_enabled(p_club_id uuid, p_role text, p_feature_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_feature_enabled(p_club_id, p_feature_key)
    and coalesce((
      select rf.enabled
      from public.club_role_features rf
      where rf.club_id = p_club_id
        and rf.role = p_role
        and rf.feature_key = p_feature_key
      limit 1
    ), true);
$$;
```

## 5.5 RLS-Idee `club_features` + `club_role_features`
```sql
alter table public.club_features enable row level security;
alter table public.club_role_features enable row level security;

create policy club_features_select
on public.club_features
for select
to authenticated
using (
  public.is_superadmin() or public.is_club_member(club_id)
);

create policy club_features_manage
on public.club_features
for all
to authenticated
using (
  public.is_superadmin() or public.is_role_at_least(club_id, 'vorstand')
)
with check (
  public.is_superadmin() or public.is_role_at_least(club_id, 'vorstand')
);

create policy club_role_features_select
on public.club_role_features
for select
to authenticated
using (
  public.is_superadmin() or public.is_club_member(club_id)
);

create policy club_role_features_manage
on public.club_role_features
for all
to authenticated
using (
  public.is_superadmin() or public.is_role_at_least(club_id, 'vorstand')
)
with check (
  public.is_superadmin() or public.is_role_at_least(club_id, 'vorstand')
);
```

## 5.6 Optional: Club-Bootstrap-Funktion (Superadmin)
```sql
create or replace function public.create_club_with_defaults(
  p_slug text,
  p_name text,
  p_host text default null,
  p_is_active boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club_id uuid;
begin
  if not public.is_superadmin() then
    raise exception 'forbidden';
  end if;

  insert into public.clubs (slug, name, host, is_active)
  values (lower(trim(p_slug)), trim(p_name), nullif(trim(coalesce(p_host, '')), ''), p_is_active)
  returning id into v_club_id;

  insert into public.club_features (club_id, feature_key, enabled)
  values
    (v_club_id, 'weather', true),
    (v_club_id, 'catch_logging', true),
    (v_club_id, 'forecast', true),
    (v_club_id, 'map', true),
    (v_club_id, 'leaderboard', true),
    (v_club_id, 'analysis', true),
    (v_club_id, 'push', false),
    (v_club_id, 'admin_tools', true)
  on conflict (club_id, feature_key) do update
  set enabled = excluded.enabled;

  return v_club_id;
end;
$$;

grant execute on function public.create_club_with_defaults(text, text, text, boolean)
to authenticated, service_role;
```

---

## 6. Warum dieser Plan skalierbar ist
- Zentrale Permission-API im Frontend verhindert verstreute Sonderlogik.
- Rollen- und Feature-Definitionen liegen jeweils an einer Stelle.
- `club_features` erlaubt pro Club modulare Freischaltung ohne Code-Deploy.
- `club_role_features` erlaubt feingranulare Freigaben pro Rolle ohne Code-Deploy.
- Superadmin-Clubmanagement ermöglicht reproduzierbares Onboarding neuer Clubs.
- Trennung von globaler Control Plane und Tenant-App entspricht gängigen SaaS-Architekturen.
- RLS + Edge-Checks sichern nicht nur UI, sondern auch Datenzugriffe.
- Multi-Club wird strukturell vorbereitet, ohne die erste Ausbaustufe zu überladen.

---

## 7. Nächster Schritt nach Freigabe
Wenn du den Plan bestätigst, erfolgt die Umsetzung in genau dieser Reihenfolge:
1. DB-Migrationen (`club_features`, `club_role_features` + Helper + Policies)
2. PermissionProvider + Hooks + Guards
3. Routing-Refactor mit SaaS-Trennung (`/superadmin/*` global, `/:clubSlug/*` tenant)
4. Superadmin-Clubmanagement (Club anlegen + Feature-Bootstrap)
5. Neue Admin-Permissions-Seite mit Club- und Rollenfreigaben
6. Abbau der Sonderlogik + Testabsicherung

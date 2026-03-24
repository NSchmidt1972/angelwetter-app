-- Multi-tenant Testaccounts Seed
-- Zweck:
-- 1) Whitelist-Einträge für 2 Clubs setzen
-- 2) Bereits existierende auth.users (per E-Mail) in profiles + memberships eintragen
-- 3) Optional Superadmin markieren
--
-- Voraussetzung:
-- Die Testnutzer existieren bereits in auth.users (z. B. per normalem Signup oder im Auth-Dashboard).

-- Club-IDs werden dynamisch über die Slugs aufgelöst.

-- 0) Whitelist für Signup in beiden Clubs
with club_map as (
  select slug, id
  from public.clubs
  where slug in ('asv-rotauge', 'demo-club')
)
insert into public.whitelist_emails (club_id, email)
select
  cm.id as club_id,
  src.email
from (
  values
    ('asv-rotauge', 'nicol@schmidt-2006.de'),
    ('demo-club', 'blackberry@schmidt-2006.de')
) as src(club_slug, email)
join club_map cm on cm.slug = src.club_slug
on conflict (email, club_id) do nothing;

-- 1) Mapping per E-Mail -> roles/memberships/profiles setzen
--    Passe E-Mail/Name/Rolle bei Bedarf an.
do $$
declare
  rec record;
  v_user_id uuid;
  v_club_id uuid;
begin
  for rec in
    select *
    from (
      values
        -- email,                      display_name,     club_slug,     role,    is_active, is_superadmin
        ('nicol@schmidt-2006.de',      'Nicol Schmidt',  'asv-rotauge', 'admin', true,      true),
        ('blackberry@schmidt-2006.de', 'Blackberry',     'demo-club',   'admin', true,      false)
    ) as t(email, display_name, club_slug, role, is_active, is_superadmin)
  loop
    select u.id
      into v_user_id
      from auth.users u
     where lower(u.email) = lower(rec.email)
     limit 1;

    if v_user_id is null then
      raise notice 'Auth user fehlt: % (bitte zuerst in Auth anlegen).', rec.email;
      continue;
    end if;

    select c.id
      into v_club_id
      from public.clubs c
     where c.slug = rec.club_slug
     limit 1;

    if v_club_id is null then
      raise notice 'Club fehlt: % (bitte zuerst in public.clubs anlegen).', rec.club_slug;
      continue;
    end if;

    insert into public.profiles (id, club_id, name, role)
    values (v_user_id, v_club_id, rec.display_name, rec.role)
    on conflict (id, club_id)
    do update set
      name = excluded.name,
      role = excluded.role,
      updated_at = timezone('utc', now());

    insert into public.memberships (user_id, club_id, role, is_active)
    values (v_user_id, v_club_id, rec.role, rec.is_active)
    on conflict (user_id, club_id)
    do update set
      role = excluded.role,
      is_active = excluded.is_active,
      updated_at = timezone('utc', now());

    if rec.is_superadmin then
      insert into public.superadmins (user_id)
      values (v_user_id)
      on conflict (user_id) do nothing;
    end if;
  end loop;
end
$$;

-- 2) Kontrolle: Ergebnis je Testnutzer
select
  u.email,
  m.club_id,
  c.slug as club_slug,
  m.role as membership_role,
  m.is_active,
  p.name as profile_name,
  p.role as profile_role,
  (sa.user_id is not null) as is_superadmin
from auth.users u
left join public.memberships m on m.user_id = u.id
left join public.profiles p on p.id = u.id and p.club_id = m.club_id
left join public.clubs c on c.id = m.club_id
left join public.superadmins sa on sa.user_id = u.id
where lower(u.email) in (
  'nicol@schmidt-2006.de',
  'blackberry@schmidt-2006.de'
)
order by u.email, c.slug;

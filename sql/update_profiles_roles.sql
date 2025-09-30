-- SQL Helper: Rollen für Vorstand / Admin setzen
-- Bitte im Supabase SQL Editor ausführen oder als Migration verwenden.

-- 1) Optional: Constraint für bekannte Rollen aktualisieren
--    (stellt sicher, dass "mitglied", "gast", "tester" und "inactive" gespeichert werden können)
do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_role_check'
  ) then
    alter table public.profiles
      drop constraint profiles_role_check;
  end if;

  alter table public.profiles
    add constraint profiles_role_check
    check (role is null or role in ('mitglied', 'vorstand', 'admin', 'gast', 'tester', 'inactive'));
end;
$$;

-- 2) Aktuelle Rollen vergeben
--    Beispiel: Entwickler-Admin per UUID (auth.users.id) hinterlegen
update public.profiles
set role = 'admin'
where id = '00000000-0000-0000-0000-000000000000'; -- TODO: eigene UUID einsetzen

--    Beispiel: Vorstand-Rollen freischalten
update public.profiles
set role = 'vorstand'
where id in (
  '11111111-1111-1111-1111-111111111111', -- TODO: echte UUIDs eintragen
  '22222222-2222-2222-2222-222222222222'
);

-- Hinweise:
-- * Die UUID entspricht der Benutzer-ID aus auth.users bzw. supabase.auth Nutzerliste.
-- * Nach dem Update sind die neuen Rollen direkt im Frontend aktiv.

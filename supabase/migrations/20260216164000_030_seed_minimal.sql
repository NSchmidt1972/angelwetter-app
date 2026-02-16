-- Minimal seed for staging bootstrapping
-- NOTE: Keep deterministic IDs to match existing frontend fallback config.

insert into public.clubs (id, slug, name, host, is_active)
values
  ('00000000-0000-0000-0000-000000000001', 'asv-rotauge', 'ASV Rotauge', 'app.asv-rotauge.de', true),
  ('00000000-0000-0000-0000-000000000002', 'demo-club', 'Demo Club', null, true)
on conflict (id) do update
set
  slug = excluded.slug,
  name = excluded.name,
  host = excluded.host,
  is_active = excluded.is_active,
  updated_at = timezone('utc', now());

-- Optional bootstrap examples (replace placeholders):
-- insert into public.superadmins (user_id)
-- values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
-- on conflict do nothing;

-- insert into public.whitelist_emails (club_id, email)
-- values
--   ('00000000-0000-0000-0000-000000000001', 'member@example.org'),
--   ('00000000-0000-0000-0000-000000000002', 'member2@example.org')
-- on conflict (email, club_id) do nothing;

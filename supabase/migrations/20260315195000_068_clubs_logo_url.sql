begin;

alter table public.clubs
  add column if not exists logo_url text;

commit;

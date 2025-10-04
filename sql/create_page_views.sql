-- Tabelle für Seitenaufrufe (Tracking)
create table if not exists public.page_views (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default timezone('utc', now()),
  path text not null,
  full_path text,
  angler text,
  session_id text,
  metadata jsonb default '{}'::jsonb
);

create index if not exists page_views_created_at_idx on public.page_views using brin (created_at);
create index if not exists page_views_path_idx on public.page_views (path);

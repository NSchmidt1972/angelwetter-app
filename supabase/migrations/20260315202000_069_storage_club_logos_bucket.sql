begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'club-logos',
  'club-logos',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists club_logos_public_read on storage.objects;
create policy club_logos_public_read
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'club-logos');

drop policy if exists club_logos_superadmin_insert on storage.objects;
create policy club_logos_superadmin_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'club-logos'
  and public.is_superadmin()
);

drop policy if exists club_logos_superadmin_update on storage.objects;
create policy club_logos_superadmin_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'club-logos'
  and public.is_superadmin()
)
with check (
  bucket_id = 'club-logos'
  and public.is_superadmin()
);

drop policy if exists club_logos_superadmin_delete on storage.objects;
create policy club_logos_superadmin_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'club-logos'
  and public.is_superadmin()
);

commit;

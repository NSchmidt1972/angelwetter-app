begin;

drop policy if exists waterbody_sensors_manage on public.waterbody_sensors;
create policy waterbody_sensors_manage
on public.waterbody_sensors
for all
to authenticated
using (public.is_superadmin())
with check (public.is_superadmin());

commit;

begin;

insert into public.fish_regions (id, label, is_active)
values ('ferkensbruch', 'Vereinsgewässer', true)
on conflict (id) do update
set
  label = excluded.label,
  is_active = true;

commit;

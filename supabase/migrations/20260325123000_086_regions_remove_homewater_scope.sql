begin;

insert into public.fish_regions (id, label, is_active)
values ('inland', 'Binnen (Deutschland)', true)
on conflict (id) do update
set
  label = excluded.label,
  is_active = true;

delete from public.fish_regions
where id = 'ferkensbruch';

commit;

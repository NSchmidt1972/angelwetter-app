-- Befüllt fehlende Anglernamen in bestehende Push-Subscription-Einträgen.
-- Vor dem Ausführen prüfen, dass die Spalte "angler_name" existiert.

update public.push_subscriptions ps
set angler_name = p.name
from public.profiles p
where p.id = ps.user_id
  and (ps.angler_name is null or ps.angler_name <> p.name);

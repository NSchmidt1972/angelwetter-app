begin;

create or replace function public.is_role_feature_enabled(
  p_club_id uuid,
  p_role text,
  p_feature_key text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_feature_enabled(p_club_id, p_feature_key)
    and coalesce(
      (
        select crf.enabled
        from public.club_role_features crf
        where crf.club_id = p_club_id
          and crf.role = lower(trim(coalesce(p_role, '')))
          and crf.feature_key = lower(trim(coalesce(p_feature_key, '')))
        limit 1
      ),
      case
        when lower(trim(coalesce(p_feature_key, ''))) = 'water_temperature' then false
        else true
      end
    );
$$;

commit;

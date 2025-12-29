// src/services/fishes.js
import { supabase } from '../supabaseClient';
import { getActiveClubId } from '@/utils/clubId';

export const baseSelect =
  'id, angler, fish, size, weight, note, timestamp, weather, photo_url, location_name, lat, lon, is_marilou, blank';

export async function listFishes({ from, to, onlyMine, anglerName }) {
  const clubId = getActiveClubId();
  let q = supabase
    .from('fishes')
    .select(baseSelect)
    .eq('club_id', clubId)
    .order('timestamp', { ascending: false })
    .range(from, to)
    .eq('blank', false)
    .neq('is_marilou', true);

  if (onlyMine) q = q.eq('angler', anglerName);
  return q;
}

export async function countFishes({ onlyMine, anglerName, fromIso, includeLobberich = true }) {
  const clubId = getActiveClubId();
  let q = supabase
    .from('fishes')
    .select('*', { count: 'exact', head: true })
    .eq('club_id', clubId)
    .eq('blank', false)
    .neq('is_marilou', true);

  if (onlyMine) {
    q = q.eq('angler', anglerName);
  } else if (includeLobberich) {
    q = q.or('location_name.is.null,location_name.ilike.%lobberich%');
  }

  if (fromIso) q = q.gte('timestamp', fromIso);
  return q;
}

export async function updateFish(id, { fish, size, note, photo_url, location_name, lat, lon }) {
  const clubId = getActiveClubId();
  return supabase
    .from('fishes')
    .update({ fish, size, note, photo_url, location_name, lat, lon })
    .eq('id', id)
    .eq('club_id', clubId);
}
export async function deleteFish(id) {
  const clubId = getActiveClubId();
  return supabase.from('fishes').delete().eq('id', id).eq('club_id', clubId);
}

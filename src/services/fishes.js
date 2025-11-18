// src/services/fishes.js
import { supabase } from '../supabaseClient';

export const baseSelect =
  'id, angler, fish, size, weight, note, timestamp, weather, photo_url, location_name, lat, lon, is_marilou, blank';

export async function listFishes({ from, to, onlyMine, anglerName }) {
  let q = supabase
    .from('fishes')
    .select(baseSelect)
    .order('timestamp', { ascending: false })
    .range(from, to)
    .eq('blank', false)
    .neq('is_marilou', true);

  if (onlyMine) q = q.eq('angler', anglerName);
  return q;
}

export async function countFishes({ onlyMine, anglerName, fromIso, includeLobberich = true }) {
  let q = supabase
    .from('fishes')
    .select('*', { count: 'exact', head: true })
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
  return supabase
    .from('fishes')
    .update({ fish, size, note, photo_url, location_name, lat, lon })
    .eq('id', id);
}
export async function deleteFish(id) {
  return supabase.from('fishes').delete().eq('id', id);
}

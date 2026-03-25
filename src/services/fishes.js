// src/services/fishes.js
import { supabase } from '../supabaseClient';
import { getActiveClubId } from '@/utils/clubId';

export const baseSelect =
  'id, angler, fish, size, weight, note, timestamp, weather, photo_url, location_name, lat, lon, waterbody_id, is_marilou, blank, share_public_non_home';

export const FISH_SELECT = Object.freeze({
  CATCHES: baseSelect,
  VALIDATION:
    'id, angler, fish, size, weight, timestamp, location_name, lat, lon, waterbody_id, weather, photo_url, blank, is_marilou, count_in_stats, under_min_size, out_of_season',
  TOP: 'id, angler, fish, size, timestamp, location_name, lat, lon, waterbody_id, blank, is_marilou',
  ANALYSIS: 'id, angler, fish, size, timestamp, location_name, lat, lon, waterbody_id, blank, is_marilou, weather',
  MAP: 'id, angler, fish, size, timestamp, lat, lon, waterbody_id',
});

export function fetchClubFishesQuery({ select = baseSelect, options } = {}) {
  const clubId = getActiveClubId();
  return supabase
    .from('fishes')
    .select(select, options)
    .eq('club_id', clubId);
}

export async function listFishes({ from, to, onlyMine, anglerName }) {
  let q = fetchClubFishesQuery({ select: FISH_SELECT.CATCHES })
    .order('timestamp', { ascending: false })
    .range(from, to)
    .eq('blank', false)
    .neq('is_marilou', true);

  if (onlyMine) q = q.eq('angler', anglerName);
  return q;
}

export async function countFishes({ onlyMine, anglerName, fromIso }) {
  let q = fetchClubFishesQuery({ select: 'id', options: { count: 'exact', head: true } })
    .eq('blank', false)
    .neq('is_marilou', true);

  if (onlyMine) {
    q = q.eq('angler', anglerName);
  }

  if (fromIso) q = q.gte('timestamp', fromIso);
  return q;
}

export async function updateFish(id, {
  fish,
  size,
  note,
  photo_url,
  location_name,
  lat,
  lon,
  waterbody_id,
  share_public_non_home,
}) {
  const clubId = getActiveClubId();
  const patch = {
    fish,
    size,
    note,
    photo_url,
    location_name,
    lat,
    lon,
    waterbody_id,
    share_public_non_home,
  };
  Object.keys(patch).forEach((key) => {
    if (patch[key] === undefined) delete patch[key];
  });

  return supabase
    .from('fishes')
    .update(patch)
    .eq('id', id)
    .eq('club_id', clubId);
}

export async function updateFishExternalVisibility(id, sharePublic) {
  const clubId = getActiveClubId();
  return supabase
    .from('fishes')
    .update({ share_public_non_home: !!sharePublic })
    .eq('id', id)
    .eq('club_id', clubId);
}
export async function deleteFish(id) {
  const clubId = getActiveClubId();
  return supabase.from('fishes').delete().eq('id', id).eq('club_id', clubId);
}

import { supabase } from '@/supabaseClient';
import { getActiveClubId } from '@/utils/clubId';

function normalizePositiveInt(value, fallback, { min = 1, max = 2000 } = {}) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

export async function fetchWaterTemperatureHistory({
  clubId = getActiveClubId(),
  days = 7,
  limit = 500,
} = {}) {
  if (!clubId) return [];

  const p_days = normalizePositiveInt(days, 7, { min: 1, max: 30 });
  const p_limit = normalizePositiveInt(limit, 500, { min: 1, max: 2000 });

  const { data, error } = await supabase.rpc('get_water_temperature_history', {
    p_club_id: clubId,
    p_days,
    p_limit,
  });

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function fetchLatestWaterTemperature({
  clubId = getActiveClubId(),
  days = 2,
} = {}) {
  const history = await fetchWaterTemperatureHistory({ clubId, days, limit: 2000 });
  return history.length ? history[history.length - 1] : null;
}

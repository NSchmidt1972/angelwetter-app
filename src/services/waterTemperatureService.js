import { supabase } from '@/supabaseClient';
import { getActiveClubId } from '@/utils/clubId';

function normalizePositiveInt(value, fallback, { min = 1, max = 2000 } = {}) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function isMissingColumnError(error, columnName) {
  const message = String(error?.message || '').toLowerCase();
  return String(error?.code || '') === '42703' && message.includes(String(columnName || '').toLowerCase());
}

function isMissingFunctionError(error, functionName) {
  const message = String(error?.message || '').toLowerCase();
  return String(error?.code || '') === '42883' && message.includes(String(functionName || '').toLowerCase());
}

function toTimestampMs(value) {
  if (!value) return NaN;
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) ? ts : NaN;
}

function toFiniteNumberOrNull(value) {
  if (value == null) return null;
  const normalized = typeof value === 'string' ? value.trim() : value;
  if (normalized === '') return null;
  const num = typeof normalized === 'number' ? normalized : Number(normalized);
  return Number.isFinite(num) ? num : null;
}

function normalizeRows(rows, { days }) {
  const list = (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      temperature_c: toFiniteNumberOrNull(row?.temperature_c),
      measured_at: row?.measured_at ?? row?.created_at ?? null,
    }))
    .filter((row) => row.temperature_c != null && Number.isFinite(toTimestampMs(row?.measured_at)))
    .sort((a, b) => toTimestampMs(a.measured_at) - toTimestampMs(b.measured_at));

  if (!list.length) return [];

  const sinceMs = Date.now() - normalizePositiveInt(days, 7, { min: 1, max: 365 }) * 24 * 60 * 60 * 1000;
  const inRange = list.filter((row) => toTimestampMs(row.measured_at) >= sinceMs);
  if (inRange.length) return inRange;

  // Fallback: mindestens den letzten verfügbaren Messwert liefern.
  return [list[list.length - 1]];
}

async function fetchWaterTemperatureHistoryDirect({ limit }) {
  const p_limit = normalizePositiveInt(limit, 500, { min: 1, max: 2000 });

  const selectVariants = [
    { select: 'temperature_c, measured_at, created_at', hasCreatedAt: true },
    { select: 'temperature_c, measured_at', hasCreatedAt: false },
  ];

  for (const variant of selectVariants) {
    let query = supabase
      .from('temperature_log')
      .select(variant.select)
      .not('temperature_c', 'is', null)
      .order('measured_at', { ascending: false, nullsFirst: false })
      .limit(p_limit);

    if (variant.hasCreatedAt) {
      query = query.order('created_at', { ascending: false, nullsFirst: false });
    }

    const { data, error } = await query;
    if (!error) return Array.isArray(data) ? data : [];
    if (!(variant.hasCreatedAt && isMissingColumnError(error, 'created_at'))) {
      throw error;
    }
  }

  return [];
}

export async function fetchWaterTemperatureHistory({
  clubId = getActiveClubId(),
  days = 7,
  limit = 500,
  waterbodyId = null,
  fallbackToClubDefault = true,
} = {}) {
  if (!clubId) return [];

  const p_days = normalizePositiveInt(days, 7, { min: 1, max: 30 });
  const p_limit = normalizePositiveInt(limit, 500, { min: 1, max: 2000 });
  const normalizedWaterbodyId =
    waterbodyId == null ? null : String(waterbodyId).trim() || null;

  let rpcError = null;
  if (normalizedWaterbodyId) {
    try {
      const { data, error } = await supabase.rpc('get_water_temperature_history_for_waterbody', {
        p_club_id: clubId,
        p_waterbody_id: normalizedWaterbodyId,
        p_days,
        p_limit,
        p_fallback_to_club: fallbackToClubDefault !== false,
      });

      if (error) {
        if (!isMissingFunctionError(error, 'get_water_temperature_history_for_waterbody')) {
          rpcError = error;
        }
      } else {
        const normalizedScopedRows = normalizeRows(data, { days: p_days });
        if (normalizedScopedRows.length > 0 || fallbackToClubDefault === false) {
          return normalizedScopedRows;
        }
      }
    } catch (error) {
      if (!isMissingFunctionError(error, 'get_water_temperature_history_for_waterbody')) {
        rpcError = error;
      }
    }
  }

  try {
    const { data, error } = await supabase.rpc('get_water_temperature_history', {
      p_club_id: clubId,
      p_days,
      p_limit,
    });

    if (error) {
      rpcError = error;
    } else {
      const normalizedRpcRows = normalizeRows(data, { days: p_days });
      if (normalizedRpcRows.length) return normalizedRpcRows;
    }
  } catch (error) {
    rpcError = error;
  }

  try {
    const directRows = await fetchWaterTemperatureHistoryDirect({ limit: p_limit });
    const normalizedDirectRows = normalizeRows(directRows, { days: p_days });
    if (normalizedDirectRows.length) return normalizedDirectRows;
  } catch (directError) {
    if (rpcError) {
      throw rpcError;
    }
    throw directError;
  }

  if (rpcError) {
    throw rpcError;
  }

  return [];
}

export async function fetchLatestWaterTemperature({
  clubId = getActiveClubId(),
  days = 2,
  waterbodyId = null,
  fallbackToClubDefault = true,
} = {}) {
  const history = await fetchWaterTemperatureHistory({
    clubId,
    days,
    limit: 2000,
    waterbodyId,
    fallbackToClubDefault,
  });
  return history.length ? history[history.length - 1] : null;
}

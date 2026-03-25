import { supabase } from '@/supabaseClient';
import { getActiveClubId } from '@/utils/clubId';

const SENSOR_TYPE_TEMPERATURE = 'temperature';

const SENSOR_SELECT = [
  'id',
  'club_id',
  'waterbody_id',
  'sensor_type',
  'device_id',
  'topic',
  'is_active',
  'valid_from',
  'valid_to',
  'created_at',
  'updated_at',
].join(', ');

function resolveClubId(clubId) {
  const resolved = clubId || getActiveClubId();
  if (!resolved) throw new Error('Kein aktiver Verein gefunden.');
  return resolved;
}

function asNullableString(value) {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

function isMissingTableError(error) {
  const code = String(error?.code || '');
  const message = String(error?.message || '').toLowerCase();
  return code === '42P01' || message.includes('waterbody_sensors');
}

function isMissingTemperatureLogTableError(error) {
  const code = String(error?.code || '');
  const message = String(error?.message || '').toLowerCase();
  return code === '42P01' || message.includes('temperature_log');
}

function mapSensorRow(row) {
  return {
    id: row?.id ?? null,
    club_id: row?.club_id ?? null,
    waterbody_id: row?.waterbody_id ?? null,
    sensor_type: row?.sensor_type ?? SENSOR_TYPE_TEMPERATURE,
    device_id: asNullableString(row?.device_id),
    topic: asNullableString(row?.topic),
    is_active: row?.is_active !== false,
    valid_from: row?.valid_from ?? null,
    valid_to: row?.valid_to ?? null,
    created_at: row?.created_at ?? null,
    updated_at: row?.updated_at ?? null,
  };
}

export async function listWaterbodyTemperatureSensorsByClub(clubId, { activeOnly = true } = {}) {
  const effectiveClubId = resolveClubId(clubId);
  let query = supabase
    .from('waterbody_sensors')
    .select(SENSOR_SELECT)
    .eq('club_id', effectiveClubId)
    .eq('sensor_type', SENSOR_TYPE_TEMPERATURE);

  if (activeOnly) {
    query = query
      .eq('is_active', true)
      .is('valid_to', null);
  }

  const { data, error } = await query
    .order('valid_from', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    if (isMissingTableError(error)) return [];
    throw new Error(error.message || 'Sensor-Zuordnungen konnten nicht geladen werden.');
  }

  const rows = Array.isArray(data) ? data.map(mapSensorRow) : [];
  const byWaterbody = new Map();
  rows.forEach((row) => {
    if (!row?.waterbody_id) return;
    if (byWaterbody.has(row.waterbody_id)) return;
    byWaterbody.set(row.waterbody_id, row);
  });
  return Array.from(byWaterbody.values());
}

export async function saveWaterbodyTemperatureSensorAssignment({
  clubId,
  waterbodyId,
  deviceId,
  topic,
  isActive = true,
}) {
  const effectiveClubId = resolveClubId(clubId);
  const effectiveWaterbodyId = asNullableString(waterbodyId);
  if (!effectiveWaterbodyId) throw new Error('Gewässer-ID fehlt.');

  const normalizedDeviceId = asNullableString(deviceId);
  const normalizedTopic = asNullableString(topic);
  const shouldActivate = isActive !== false && Boolean(normalizedDeviceId);
  const nowIso = new Date().toISOString();

  const { data: currentRows, error: currentError } = await supabase
    .from('waterbody_sensors')
    .select(SENSOR_SELECT)
    .eq('club_id', effectiveClubId)
    .eq('waterbody_id', effectiveWaterbodyId)
    .eq('sensor_type', SENSOR_TYPE_TEMPERATURE)
    .eq('is_active', true)
    .is('valid_to', null)
    .order('valid_from', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1);

  if (currentError) {
    if (isMissingTableError(currentError)) return null;
    throw new Error(currentError.message || 'Sensor-Zuordnung konnte nicht geladen werden.');
  }
  const current = Array.isArray(currentRows) && currentRows.length > 0 ? mapSensorRow(currentRows[0]) : null;

  if (!shouldActivate) {
    if (current?.id) {
      const { error: deactivateError } = await supabase
        .from('waterbody_sensors')
        .update({
          is_active: false,
          valid_to: nowIso,
        })
        .eq('id', current.id)
        .eq('club_id', effectiveClubId);
      if (deactivateError) {
        if (isMissingTableError(deactivateError)) return null;
        throw new Error(deactivateError.message || 'Sensor-Zuordnung konnte nicht deaktiviert werden.');
      }
    }
    return null;
  }

  if (
    current
    && current.device_id === normalizedDeviceId
    && (current.topic || null) === (normalizedTopic || null)
    && current.is_active
    && !current.valid_to
  ) {
    return current;
  }

  if (current?.id) {
    const { error: deactivateError } = await supabase
      .from('waterbody_sensors')
      .update({
        is_active: false,
        valid_to: nowIso,
      })
      .eq('id', current.id)
      .eq('club_id', effectiveClubId);
    if (deactivateError) {
      if (isMissingTableError(deactivateError)) return null;
      throw new Error(deactivateError.message || 'Vorherige Sensor-Zuordnung konnte nicht beendet werden.');
    }
  }

  const { data: inserted, error: insertError } = await supabase
    .from('waterbody_sensors')
    .insert({
      club_id: effectiveClubId,
      waterbody_id: effectiveWaterbodyId,
      sensor_type: SENSOR_TYPE_TEMPERATURE,
      device_id: normalizedDeviceId,
      topic: normalizedTopic,
      is_active: true,
      valid_from: nowIso,
      valid_to: null,
    })
    .select(SENSOR_SELECT)
    .single();

  if (insertError) {
    if (isMissingTableError(insertError)) return null;
    throw new Error(insertError.message || 'Sensor-Zuordnung konnte nicht gespeichert werden.');
  }
  return mapSensorRow(inserted);
}

export async function listRecentTemperatureSensorCandidates({ limit = 200 } = {}) {
  const maxRows = Number.isFinite(Number(limit))
    ? Math.max(1, Math.min(1000, Number(limit)))
    : 200;

  const { data, error } = await supabase
    .from('temperature_log')
    .select('device_id, topic, measured_at, created_at')
    .not('device_id', 'is', null)
    .order('measured_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false, nullsFirst: false })
    .limit(maxRows);

  if (error) {
    if (isMissingTemperatureLogTableError(error)) return [];
    throw new Error(error.message || 'Sensor-Vorschläge konnten nicht geladen werden.');
  }

  const rows = Array.isArray(data) ? data : [];
  const byKey = new Map();
  rows.forEach((row) => {
    const deviceId = asNullableString(row?.device_id);
    if (!deviceId) return;
    const topic = asNullableString(row?.topic);
    const measuredAt = row?.measured_at ?? row?.created_at ?? null;
    const key = `${deviceId}||${topic || ''}`;
    if (byKey.has(key)) return;
    byKey.set(key, {
      device_id: deviceId,
      topic,
      measured_at: measuredAt,
    });
  });

  return Array.from(byKey.values());
}

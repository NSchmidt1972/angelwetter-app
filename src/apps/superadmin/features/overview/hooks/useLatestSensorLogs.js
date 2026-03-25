import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/supabaseClient';
import { reverseGeocode } from '@/utils/geo';
import {
  formatNumber,
  parseCoordinate,
} from '@/apps/superadmin/features/overview/utils/overviewUtils';

const SENSOR_TYPE_TEMPERATURE = 'temperature';

function asNonEmptyText(value) {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

function normalizeDeviceId(value) {
  return asNonEmptyText(value);
}

function isMissingTableError(error, tableName) {
  const code = String(error?.code || '');
  const message = String(error?.message || '').toLowerCase();
  return code === '42P01' || message.includes(String(tableName || '').toLowerCase());
}

function buildLatestAssignmentByDevice(rows, clubNameById, waterbodyNameById) {
  const byDevice = {};
  (rows || []).forEach((row) => {
    const deviceId = normalizeDeviceId(row?.device_id);
    if (!deviceId || byDevice[deviceId]) return;
    byDevice[deviceId] = {
      deviceId,
      clubId: row?.club_id ?? null,
      waterbodyId: row?.waterbody_id ?? null,
      clubName: asNonEmptyText(clubNameById.get(row?.club_id)) || null,
      waterbodyName: asNonEmptyText(waterbodyNameById.get(row?.waterbody_id)) || null,
    };
  });
  return byDevice;
}

function buildSensorContext(logRow, assignmentByDevice) {
  const deviceId = normalizeDeviceId(logRow?.device_id);
  if (!deviceId) {
    return {
      deviceId: null,
      clubName: null,
      waterbodyName: null,
    };
  }
  const assignment = assignmentByDevice?.[deviceId] || null;
  return {
    deviceId,
    clubName: assignment?.clubName || null,
    waterbodyName: assignment?.waterbodyName || null,
  };
}

export function useLatestSensorLogs() {
  const [latestSensorLogsLoading, setLatestSensorLogsLoading] = useState(true);
  const [latestSensorLogsError, setLatestSensorLogsError] = useState('');
  const [latestSensorLogs, setLatestSensorLogs] = useState({
    batt: null,
    gps: null,
    temperature: null,
    gpsLocationName: null,
    sensorAssignmentsByDevice: {},
  });
  const [latestSensorLogErrors, setLatestSensorLogErrors] = useState({
    batt: '',
    gps: '',
    temperature: '',
  });

  useEffect(() => {
    let active = true;

    async function loadLatestSensorLogs() {
      setLatestSensorLogsLoading(true);
      setLatestSensorLogsError('');

      try {
        const [battResult, gpsResult, temperatureResult] = await Promise.all([
          supabase
            .from('batt_log')
            .select('voltage_v, percent, created_at, measured_at, device_id')
            .order('created_at', { ascending: false })
            .limit(1),
          supabase
            .from('gps_log')
            .select('created_at, fix_time_utc, lat, lon, device_id')
            .order('created_at', { ascending: false })
            .limit(1),
          supabase
            .from('temperature_log')
            .select('created_at, measured_at, temperature_c, device_id')
            .order('measured_at', { ascending: false })
            .limit(1),
        ]);

        if (!active) return;

        const battLatest = Array.isArray(battResult.data) ? battResult.data[0] || null : null;
        const gpsLatest = Array.isArray(gpsResult.data) ? gpsResult.data[0] || null : null;
        const temperatureLatest = Array.isArray(temperatureResult.data)
          ? temperatureResult.data[0] || null
          : null;

        const gpsLat = parseCoordinate(gpsLatest?.lat);
        const gpsLon = parseCoordinate(gpsLatest?.lon);
        const gpsLocationName =
          gpsLat !== null && gpsLon !== null ? await reverseGeocode(gpsLat, gpsLon) : null;

        if (!active) return;

        const deviceIds = Array.from(
          new Set([
            normalizeDeviceId(battLatest?.device_id),
            normalizeDeviceId(gpsLatest?.device_id),
            normalizeDeviceId(temperatureLatest?.device_id),
          ].filter(Boolean)),
        );

        let sensorAssignmentsByDevice = {};
        if (deviceIds.length > 0) {
          const sensorResult = await supabase
            .from('waterbody_sensors')
            .select('club_id, waterbody_id, device_id, valid_from, created_at, is_active, valid_to')
            .in('device_id', deviceIds)
            .eq('sensor_type', SENSOR_TYPE_TEMPERATURE)
            .eq('is_active', true)
            .is('valid_to', null)
            .order('valid_from', { ascending: false, nullsFirst: false })
            .order('created_at', { ascending: false, nullsFirst: false });

          if (sensorResult.error) {
            if (!isMissingTableError(sensorResult.error, 'waterbody_sensors')) {
              throw sensorResult.error;
            }
          } else {
            const sensorRows = Array.isArray(sensorResult.data) ? sensorResult.data : [];
            const clubIds = Array.from(new Set(sensorRows.map((row) => row?.club_id).filter(Boolean)));
            const waterbodyIds = Array.from(
              new Set(sensorRows.map((row) => row?.waterbody_id).filter(Boolean)),
            );

            const [clubsResult, waterbodiesResult] = await Promise.all([
              clubIds.length > 0
                ? supabase.from('clubs').select('id, name').in('id', clubIds)
                : Promise.resolve({ data: [], error: null }),
              waterbodyIds.length > 0
                ? supabase.from('waterbodies').select('id, name').in('id', waterbodyIds)
                : Promise.resolve({ data: [], error: null }),
            ]);

            if (clubsResult.error) {
              throw clubsResult.error;
            }
            if (waterbodiesResult.error && !isMissingTableError(waterbodiesResult.error, 'waterbodies')) {
              throw waterbodiesResult.error;
            }

            const clubNameById = new Map(
              (Array.isArray(clubsResult.data) ? clubsResult.data : []).map((row) => [row.id, row.name]),
            );
            const waterbodyNameById = new Map(
              (Array.isArray(waterbodiesResult.data) ? waterbodiesResult.data : []).map((row) => [
                row.id,
                row.name,
              ]),
            );

            sensorAssignmentsByDevice = buildLatestAssignmentByDevice(
              sensorRows,
              clubNameById,
              waterbodyNameById,
            );
          }
        }

        const nextLogErrors = {
          batt: battResult.error?.message || '',
          gps: gpsResult.error?.message || '',
          temperature: temperatureResult.error?.message || '',
        };

        const hasAnyError = Object.values(nextLogErrors).some(Boolean);
        if (hasAnyError) {
          setLatestSensorLogsError('Sensor-Logs konnten nicht vollständig geladen werden.');
          console.error('[SuperAdmin] sensor logs load error:', {
            batt: battResult.error,
            gps: gpsResult.error,
            temperature: temperatureResult.error,
          });
        }

        setLatestSensorLogErrors(nextLogErrors);
        setLatestSensorLogs({
          batt: battLatest,
          gps: gpsLatest,
          temperature: temperatureLatest,
          gpsLocationName: gpsLocationName || null,
          sensorAssignmentsByDevice,
        });
      } catch (loadError) {
        if (!active) return;

        console.error('[SuperAdmin] sensor logs unexpected load error:', loadError);
        setLatestSensorLogs({
          batt: null,
          gps: null,
          temperature: null,
          gpsLocationName: null,
          sensorAssignmentsByDevice: {},
        });
        setLatestSensorLogErrors({
          batt: '',
          gps: '',
          temperature: '',
        });
        setLatestSensorLogsError(loadError?.message || String(loadError));
      } finally {
        if (active) setLatestSensorLogsLoading(false);
      }
    }

    void loadLatestSensorLogs();

    return () => {
      active = false;
    };
  }, []);

  const battValueText = useMemo(() => {
    if (!latestSensorLogs.batt) return '—';

    const percent = formatNumber(latestSensorLogs.batt.percent, 0);
    const voltage = formatNumber(latestSensorLogs.batt.voltage_v, 2);
    const parts = [];

    if (percent !== null) parts.push(`${percent}%`);
    if (voltage !== null) parts.push(`${voltage} V`);

    return parts.length > 0 ? parts.join(' · ') : '—';
  }, [latestSensorLogs.batt]);

  const gpsValueText = useMemo(() => {
    if (!latestSensorLogs.gps) return null;

    const lat = parseCoordinate(latestSensorLogs.gps.lat);
    const lon = parseCoordinate(latestSensorLogs.gps.lon);

    if (lat === null || lon === null) return 'Keine Koordinaten';
    return latestSensorLogs.gpsLocationName || 'Unbekannt';
  }, [latestSensorLogs.gps, latestSensorLogs.gpsLocationName]);

  const temperatureValueText = useMemo(() => {
    if (!latestSensorLogs.temperature) return '—';

    const value = formatNumber(latestSensorLogs.temperature.temperature_c, 2);
    return value !== null ? `${value} °C` : '—';
  }, [latestSensorLogs.temperature]);

  const battSensorContext = useMemo(
    () => buildSensorContext(latestSensorLogs.batt, latestSensorLogs.sensorAssignmentsByDevice),
    [latestSensorLogs.batt, latestSensorLogs.sensorAssignmentsByDevice],
  );
  const gpsSensorContext = useMemo(
    () => buildSensorContext(latestSensorLogs.gps, latestSensorLogs.sensorAssignmentsByDevice),
    [latestSensorLogs.gps, latestSensorLogs.sensorAssignmentsByDevice],
  );
  const temperatureSensorContext = useMemo(
    () => buildSensorContext(latestSensorLogs.temperature, latestSensorLogs.sensorAssignmentsByDevice),
    [latestSensorLogs.temperature, latestSensorLogs.sensorAssignmentsByDevice],
  );

  return {
    latestSensorLogsLoading,
    latestSensorLogsError,
    latestSensorLogs,
    latestSensorLogErrors,
    battValueText,
    gpsValueText,
    temperatureValueText,
    battSensorContext,
    gpsSensorContext,
    temperatureSensorContext,
  };
}

import { useEffect, useState } from 'react';
import { supabase } from '@/supabaseClient';
import {
  CLUB_SELECT_VARIANTS,
  isMissingClubIsActiveError,
  isMissingClubLogoUrlError,
  isMissingClubWeatherCoordsError,
  normalizeClubWithSchemaSupport,
} from '@/apps/superadmin/features/clubs/utils/clubSchemaCompat';
import { isMissingWeatherProxyMetricsTableError } from '@/apps/superadmin/features/overview/utils/overviewUtils';

function isMissingFishesWaterbodyIdError(error) {
  const code = String(error?.code || '');
  const message = String(error?.message || '').toLowerCase();
  return code === '42703' && message.includes('waterbody_id') && message.includes('fishes');
}

function isMissingWaterbodySensorsTableError(error) {
  const code = String(error?.code || '');
  const message = String(error?.message || '').toLowerCase();
  return code === '42P01' || message.includes('waterbody_sensors');
}

function isMissingWaterbodiesTableError(error) {
  const code = String(error?.code || '');
  const message = String(error?.message || '').toLowerCase();
  return code === '42P01' || message.includes('waterbodies');
}

function asNullableText(value) {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

function toTimestampMs(value) {
  if (!value) return Number.NEGATIVE_INFINITY;
  const ms = Date.parse(String(value));
  return Number.isFinite(ms) ? ms : Number.NEGATIVE_INFINITY;
}

function mapLatestByDevice(rows, { primaryTimestampKey, fallbackTimestampKey = 'created_at' } = {}) {
  const byDevice = {};
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const deviceId = asNullableText(row?.device_id);
    if (!deviceId) return;

    const rowTs = Math.max(
      toTimestampMs(primaryTimestampKey ? row?.[primaryTimestampKey] : null),
      toTimestampMs(fallbackTimestampKey ? row?.[fallbackTimestampKey] : null),
    );
    const existing = byDevice[deviceId];
    const existingTs = existing
      ? Math.max(
        toTimestampMs(primaryTimestampKey ? existing?.[primaryTimestampKey] : null),
        toTimestampMs(fallbackTimestampKey ? existing?.[fallbackTimestampKey] : null),
      )
      : Number.NEGATIVE_INFINITY;

    if (!existing || rowTs > existingTs) {
      byDevice[deviceId] = row;
    }
  });
  return byDevice;
}

export function useOverviewCoreData() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [clubs, setClubs] = useState([]);
  const [memberships, setMemberships] = useState([]);
  const [fishes, setFishes] = useState([]);
  const [weatherRequestRows, setWeatherRequestRows] = useState([]);
  const [waterbodySensorAssignments, setWaterbodySensorAssignments] = useState([]);
  const [sensorTelemetryByDevice, setSensorTelemetryByDevice] = useState({});
  const [supportsWeatherMetrics, setSupportsWeatherMetrics] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadOverviewData() {
      setLoading(true);
      setError('');

      try {
        const clubsPromise = (async () => {
          let loadedVariant = null;
          let clubRows = [];
          let lastError = null;

          for (const variant of CLUB_SELECT_VARIANTS) {
            const result = await supabase
              .from('clubs')
              .select(variant.select)
              .order('name', { ascending: true });

            if (!result.error) {
              loadedVariant = variant;
              clubRows = result.data || [];
              break;
            }

            const tolerableError =
              isMissingClubIsActiveError(result.error) ||
              isMissingClubWeatherCoordsError(result.error) ||
              isMissingClubLogoUrlError(result.error);

            if (!tolerableError) throw result.error;
            lastError = result.error;
          }

          if (!loadedVariant) {
            throw lastError || new Error('Clubs konnten nicht geladen werden.');
          }

          return clubRows.map((row) => normalizeClubWithSchemaSupport(row, loadedVariant));
        })();

        const fishesPromise = (async () => {
          const withWaterbody = await supabase
            .from('fishes')
            .select('id, club_id, waterbody_id, angler, fish, timestamp, blank, taken');
          if (!withWaterbody.error) return withWaterbody.data || [];

          if (!isMissingFishesWaterbodyIdError(withWaterbody.error)) {
            throw withWaterbody.error;
          }

          const fallback = await supabase
            .from('fishes')
            .select('id, club_id, angler, fish, timestamp, blank, taken');
          if (fallback.error) throw fallback.error;
          return (fallback.data || []).map((row) => ({ ...row, waterbody_id: null }));
        })();

        const waterbodySensorAssignmentsPromise = (async () => {
          const sensorsResult = await supabase
            .from('waterbody_sensors')
            .select('club_id, waterbody_id, device_id, valid_from, created_at')
            .eq('sensor_type', 'temperature')
            .eq('is_active', true)
            .is('valid_to', null)
            .order('valid_from', { ascending: false, nullsFirst: false })
            .order('created_at', { ascending: false, nullsFirst: false });

          if (sensorsResult.error) {
            if (isMissingWaterbodySensorsTableError(sensorsResult.error)) return [];
            throw sensorsResult.error;
          }

          const sensorRows = Array.isArray(sensorsResult.data) ? sensorsResult.data : [];
          if (sensorRows.length === 0) return [];

          const waterbodyIds = Array.from(
            new Set(sensorRows.map((row) => row?.waterbody_id).filter(Boolean)),
          );

          let waterbodyNameById = new Map();
          if (waterbodyIds.length > 0) {
            const waterbodiesResult = await supabase
              .from('waterbodies')
              .select('id, name')
              .in('id', waterbodyIds);
            if (waterbodiesResult.error) {
              if (!isMissingWaterbodiesTableError(waterbodiesResult.error)) {
                throw waterbodiesResult.error;
              }
            } else {
              waterbodyNameById = new Map(
                (Array.isArray(waterbodiesResult.data) ? waterbodiesResult.data : []).map((row) => [
                  row.id,
                  asNullableText(row?.name),
                ]),
              );
            }
          }

          const latestByWaterbody = new Map();
          sensorRows.forEach((row) => {
            const waterbodyId = row?.waterbody_id;
            const deviceId = asNullableText(row?.device_id);
            if (!waterbodyId || !deviceId || latestByWaterbody.has(waterbodyId)) return;
            latestByWaterbody.set(waterbodyId, {
              club_id: row?.club_id ?? null,
              waterbody_id: waterbodyId,
              waterbody_name: waterbodyNameById.get(waterbodyId) || null,
              device_id: deviceId,
            });
          });

          return Array.from(latestByWaterbody.values());
        })();

        const [clubData, membershipsResult, fishesData, metricsResult, sensorAssignmentsData] = await Promise.all([
          clubsPromise,
          supabase.from('memberships').select('user_id, club_id, role, is_active'),
          fishesPromise,
          supportsWeatherMetrics
            ? supabase.from('weather_proxy_metrics_daily').select('club_id, openweather_call_count')
            : Promise.resolve({ data: [], error: null }),
          waterbodySensorAssignmentsPromise,
        ]);

        if (membershipsResult.error) throw membershipsResult.error;
        if (metricsResult.error && !isMissingWeatherProxyMetricsTableError(metricsResult.error)) {
          throw metricsResult.error;
        }

        if (!active) return;

        setClubs(clubData || []);
        setMemberships(membershipsResult.data || []);
        setFishes(fishesData || []);
        const nextSensorAssignments = Array.isArray(sensorAssignmentsData) ? sensorAssignmentsData : [];
        setWaterbodySensorAssignments(nextSensorAssignments);

        const sensorDeviceIds = Array.from(
          new Set(nextSensorAssignments.map((row) => asNullableText(row?.device_id)).filter(Boolean)),
        );

        if (sensorDeviceIds.length > 0) {
          const [battResult, gpsResult, temperatureResult] = await Promise.all([
            supabase
              .from('batt_log')
              .select('device_id, measured_at, created_at, percent, voltage_v')
              .in('device_id', sensorDeviceIds)
              .order('measured_at', { ascending: false, nullsFirst: false })
              .order('created_at', { ascending: false, nullsFirst: false })
              .limit(500),
            supabase
              .from('gps_log')
              .select('device_id, fix_time_utc, created_at, lat, lon, fix')
              .in('device_id', sensorDeviceIds)
              .order('fix_time_utc', { ascending: false, nullsFirst: false })
              .order('created_at', { ascending: false, nullsFirst: false })
              .limit(500),
            supabase
              .from('temperature_log')
              .select('device_id, measured_at, created_at, temperature_c')
              .in('device_id', sensorDeviceIds)
              .order('measured_at', { ascending: false, nullsFirst: false })
              .order('created_at', { ascending: false, nullsFirst: false })
              .limit(500),
          ]);

          if (battResult.error) throw battResult.error;
          if (gpsResult.error) throw gpsResult.error;
          if (temperatureResult.error) throw temperatureResult.error;

          const battByDevice = mapLatestByDevice(battResult.data, {
            primaryTimestampKey: 'measured_at',
            fallbackTimestampKey: 'created_at',
          });
          const gpsByDevice = mapLatestByDevice(gpsResult.data, {
            primaryTimestampKey: 'fix_time_utc',
            fallbackTimestampKey: 'created_at',
          });
          const temperatureByDevice = mapLatestByDevice(temperatureResult.data, {
            primaryTimestampKey: 'measured_at',
            fallbackTimestampKey: 'created_at',
          });

          const nextSensorTelemetryByDevice = {};
          sensorDeviceIds.forEach((deviceId) => {
            nextSensorTelemetryByDevice[deviceId] = {
              batt: battByDevice[deviceId] || null,
              gps: gpsByDevice[deviceId] || null,
              temperature: temperatureByDevice[deviceId] || null,
            };
          });
          if (!active) return;
          setSensorTelemetryByDevice(nextSensorTelemetryByDevice);
        } else {
          if (!active) return;
          setSensorTelemetryByDevice({});
        }

        if (!active) return;
        if (metricsResult.error && isMissingWeatherProxyMetricsTableError(metricsResult.error)) {
          setSupportsWeatherMetrics(false);
          setWeatherRequestRows([]);
        } else {
          setWeatherRequestRows(Array.isArray(metricsResult.data) ? metricsResult.data : []);
        }
      } catch (loadError) {
        console.error('[SuperAdmin] load error:', loadError);
        if (!active) return;
        setError(loadError?.message || String(loadError));
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadOverviewData();

    return () => {
      active = false;
    };
  }, [supportsWeatherMetrics]);

  return {
    loading,
    error,
    clubs,
    memberships,
    fishes,
    weatherRequestRows,
    waterbodySensorAssignments,
    sensorTelemetryByDevice,
    supportsWeatherMetrics,
  };
}

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/supabaseClient';
import { reverseGeocode } from '@/utils/geo';
import {
  formatNumber,
  parseCoordinate,
} from '@/apps/superadmin/features/overview/utils/overviewUtils';

export function useLatestSensorLogs() {
  const [latestSensorLogsLoading, setLatestSensorLogsLoading] = useState(true);
  const [latestSensorLogsError, setLatestSensorLogsError] = useState('');
  const [latestSensorLogs, setLatestSensorLogs] = useState({
    batt: null,
    gps: null,
    temperature: null,
    gpsLocationName: null,
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
            .select('voltage_v, percent, created_at, measured_at')
            .order('created_at', { ascending: false })
            .limit(1),
          supabase
            .from('gps_log')
            .select('created_at, fix_time_utc, lat, lon')
            .order('created_at', { ascending: false })
            .limit(1),
          supabase
            .from('temperature_log')
            .select('created_at, measured_at, temperature_c')
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
        });
      } catch (loadError) {
        if (!active) return;

        console.error('[SuperAdmin] sensor logs unexpected load error:', loadError);
        setLatestSensorLogs({
          batt: null,
          gps: null,
          temperature: null,
          gpsLocationName: null,
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

  return {
    latestSensorLogsLoading,
    latestSensorLogsError,
    latestSensorLogs,
    latestSensorLogErrors,
    battValueText,
    gpsValueText,
    temperatureValueText,
  };
}

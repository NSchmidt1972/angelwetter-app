import { useEffect, useState } from 'react';
import { supabase } from '@/supabaseClient';

export function useAdminTelemetry({ showTelemetry = true }) {
  const [telemetryLoading, setTelemetryLoading] = useState(true);
  const [telemetryError, setTelemetryError] = useState('');
  const [battLatest, setBattLatest] = useState(null);
  const [battCount, setBattCount] = useState(null);
  const [gpsLatest, setGpsLatest] = useState(null);
  const [gpsCount, setGpsCount] = useState(null);
  const [temperatureLatest, setTemperatureLatest] = useState(null);
  const [temperatureCount, setTemperatureCount] = useState(null);

  useEffect(() => {
    let active = true;
    if (!showTelemetry) {
      setTelemetryLoading(false);
      setTelemetryError('');
      return () => {
        active = false;
      };
    }

    async function loadTelemetryLogs() {
      setTelemetryLoading(true);
      setTelemetryError('');

      try {
        const [
          battLatestResult,
          battCountResult,
          gpsLatestResult,
          gpsCountResult,
          temperatureLatestResult,
          temperatureCountResult,
        ] = await Promise.all([
          supabase
            .from('batt_log')
            .select('voltage_v, percent, created_at, measured_at, device_id, topic, valid')
            .order('created_at', { ascending: false })
            .limit(1),
          supabase
            .from('batt_log')
            .select('id', { count: 'exact', head: true }),
          supabase
            .from('gps_log')
            .select('device_id, topic, created_at, fix_time_utc, lat, lon, fix, sats, sats_used, sats_view')
            .order('created_at', { ascending: false })
            .limit(1),
          supabase
            .from('gps_log')
            .select('id', { count: 'exact', head: true }),
          supabase
            .from('temperature_log')
            .select('device_id, topic, created_at, measured_at, temperature_c')
            .order('measured_at', { ascending: false })
            .limit(1),
          supabase
            .from('temperature_log')
            .select('id', { count: 'exact', head: true }),
        ]);

        if (!active) return;

        setBattLatest(Array.isArray(battLatestResult?.data) ? battLatestResult.data[0] || null : null);
        setBattCount(Number.isInteger(battCountResult?.count) ? battCountResult.count : null);
        setGpsLatest(Array.isArray(gpsLatestResult?.data) ? gpsLatestResult.data[0] || null : null);
        setGpsCount(Number.isInteger(gpsCountResult?.count) ? gpsCountResult.count : null);
        setTemperatureLatest(
          Array.isArray(temperatureLatestResult?.data) ? temperatureLatestResult.data[0] || null : null,
        );
        setTemperatureCount(Number.isInteger(temperatureCountResult?.count) ? temperatureCountResult.count : null);

        const errors = [
          battLatestResult?.error,
          battCountResult?.error,
          gpsLatestResult?.error,
          gpsCountResult?.error,
          temperatureLatestResult?.error,
          temperatureCountResult?.error,
        ].filter(Boolean);

        if (errors.length > 0) {
          const message = errors
            .map((err) => err?.message)
            .filter(Boolean)
            .join(' | ');
          setTelemetryError(message || 'Sensor-Logs konnten nicht vollständig geladen werden.');
          console.error('Sensor-Logs: Laden fehlgeschlagen', errors);
        }
      } catch (error) {
        if (!active) return;
        const message = error?.message || 'Sensor-Logs konnten nicht geladen werden.';
        setTelemetryError(message);
        console.error('Sensor-Logs: Unerwarteter Fehler', error);
      } finally {
        if (active) setTelemetryLoading(false);
      }
    }

    void loadTelemetryLogs();
    return () => {
      active = false;
    };
  }, [showTelemetry]);

  return {
    telemetryLoading,
    telemetryError,
    battLatest,
    battCount,
    gpsLatest,
    gpsCount,
    temperatureLatest,
    temperatureCount,
  };
}

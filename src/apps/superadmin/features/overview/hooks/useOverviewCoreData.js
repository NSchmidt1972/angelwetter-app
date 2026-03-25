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

export function useOverviewCoreData() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [clubs, setClubs] = useState([]);
  const [memberships, setMemberships] = useState([]);
  const [fishes, setFishes] = useState([]);
  const [weatherRequestRows, setWeatherRequestRows] = useState([]);
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

        const [clubData, membershipsResult, fishesData, metricsResult] = await Promise.all([
          clubsPromise,
          supabase.from('memberships').select('user_id, club_id, role, is_active'),
          fishesPromise,
          supportsWeatherMetrics
            ? supabase.from('weather_proxy_metrics_daily').select('club_id, openweather_call_count')
            : Promise.resolve({ data: [], error: null }),
        ]);

        if (membershipsResult.error) throw membershipsResult.error;
        if (metricsResult.error && !isMissingWeatherProxyMetricsTableError(metricsResult.error)) {
          throw metricsResult.error;
        }

        if (!active) return;

        setClubs(clubData || []);
        setMemberships(membershipsResult.data || []);
        setFishes(fishesData || []);

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
    supportsWeatherMetrics,
  };
}

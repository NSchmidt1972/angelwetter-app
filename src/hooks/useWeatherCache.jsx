// src/hooks/useWeatherCache.jsx
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/supabaseClient';
import { getActiveClubId } from '@/utils/clubId';

const WeatherContext = createContext(null);

const WEATHER_ID = 'latest';
const INITIAL_DELAY_MS = 400;
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

function schedule(callback, delay) {
  if (typeof window === 'undefined') {
    callback();
    return () => {};
  }
  const timerId = window.setTimeout(callback, delay);
  return () => window.clearTimeout(timerId);
}

function isDocumentVisible() {
  return typeof document === 'undefined' || document.visibilityState === 'visible';
}

async function fetchLatestWeather() {
  const clubId = getActiveClubId();
  const { data, error } = await supabase
    .from('weather_cache')
    .select('data, updated_at')
    .eq('club_id', clubId)
    .eq('id', WEATHER_ID)
    .single();

  if (error) throw error;
  return {
    data: data?.data ?? null,
    savedAt: data?.updated_at ? new Date(data.updated_at).getTime() : Date.now(),
  };
}

export function WeatherProvider({ children }) {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);

  const refreshInternal = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const latest = await fetchLatestWeather();
      setWeather(latest);
      setError(null);
      return true;
    } catch (err) {
      console.warn('⚠️ Wetter konnte nicht aus Supabase geladen werden:', err?.message ?? err);
      setError(err);
      return false;
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const updateWeather = useCallback((next) => {
    setWeather((prev) => (typeof next === 'function' ? next(prev) : next));
  }, []);

  useEffect(() => {
    let disposed = false;

    const runInitial = () => {
      if (!disposed && isDocumentVisible()) {
        void refreshInternal();
      }
    };

    const cancelInitial = schedule(runInitial, INITIAL_DELAY_MS);

    if (typeof window !== 'undefined') {
      intervalRef.current = window.setInterval(() => {
        if (!disposed && isDocumentVisible()) {
          void refreshInternal({ silent: true });
        }
      }, REFRESH_INTERVAL_MS);
    }

    const handleVisibilityChange = () => {
      if (!disposed && isDocumentVisible()) {
        void refreshInternal({ silent: true });
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      disposed = true;
      cancelInitial?.();
      if (intervalRef.current != null && typeof window !== 'undefined') {
        window.clearInterval(intervalRef.current);
      }
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, [refreshInternal]);

  const value = useMemo(
    () => ({
      weather,
      loading,
      error,
      refresh: (options) => refreshInternal(options ?? {}),
      updateWeather,
    }),
    [weather, loading, error, refreshInternal, updateWeather]
  );

  return <WeatherContext.Provider value={value}>{children}</WeatherContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useWeatherCache() {
  const context = useContext(WeatherContext);
  if (!context) {
    throw new Error('useWeatherCache must be used within a WeatherProvider');
  }
  return context;
}

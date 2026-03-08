// src/hooks/useWeatherCache.jsx
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/supabaseClient';
import { getActiveClubId } from '@/utils/clubId';
import { withTimeout } from '@/utils/async';
import { useAppResumeTick } from '@/hooks/useAppResumeSync';

const WeatherContext = createContext(null);

const WEATHER_ID = 'latest';
const INITIAL_DELAY_MS = 400;
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const WEATHER_TIMEOUT_MS = 10000;

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
  const { data, error } = await withTimeout(
    supabase
      .from('weather_cache')
      .select('data, updated_at')
      .eq('club_id', clubId)
      .eq('id', WEATHER_ID)
      .single(),
    WEATHER_TIMEOUT_MS,
    'Wetter-Request timeout'
  );

  if (error) throw error;
  return {
    data: data?.data ?? null,
    savedAt: data?.updated_at ? new Date(data.updated_at).getTime() : Date.now(),
  };
}

export function WeatherProvider({ children }) {
  const resumeTick = useAppResumeTick();
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);
  const refreshPromiseRef = useRef(null);

  const refreshInternal = useCallback(async ({ silent = false } = {}) => {
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    if (!silent) setLoading(true);
    const refreshPromise = (async () => {
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
    })();

    refreshPromiseRef.current = refreshPromise.finally(() => {
      refreshPromiseRef.current = null;
    });
    return refreshPromiseRef.current;
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

    return () => {
      disposed = true;
      cancelInitial?.();
      if (intervalRef.current != null && typeof window !== 'undefined') {
        window.clearInterval(intervalRef.current);
      }
    };
  }, [refreshInternal]);

  useEffect(() => {
    if (resumeTick === 0) return;
    if (!isDocumentVisible()) return;
    void refreshInternal({ silent: true });
  }, [resumeTick, refreshInternal]);

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

// src/hooks/useWeatherCache.jsx
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/supabaseClient';
import { getActiveClubId } from '@/utils/clubId';
import { withTimeout } from '@/utils/async';
import { useAppResumeTick } from '@/hooks/useAppResumeSync';

const WeatherContext = createContext(null);

const WEATHER_ID = 'latest';
const WEATHER_SESSION_CACHE_KEY = 'weather_latest_session_v1';
const INITIAL_DELAY_MS = 400;
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const WEATHER_TIMEOUT_MS = 10000;
const INITIAL_RETRY_DELAY_MS = 8000;

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

function readSessionWeather() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(WEATHER_SESSION_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.data) return null;
    return {
      data: parsed.data,
      savedAt: Number(parsed.savedAt) || Date.now(),
    };
  } catch {
    return null;
  }
}

function writeSessionWeather(value) {
  if (typeof window === 'undefined') return;
  try {
    if (!value?.data) {
      window.sessionStorage.removeItem(WEATHER_SESSION_CACHE_KEY);
      return;
    }
    window.sessionStorage.setItem(WEATHER_SESSION_CACHE_KEY, JSON.stringify(value));
  } catch {
    /* ignore storage errors */
  }
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
  const [weather, setWeather] = useState(() => readSessionWeather());
  const [loading, setLoading] = useState(() => !readSessionWeather());
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);
  const refreshPromiseRef = useRef(null);
  const initialRetryRef = useRef(null);
  const weatherRef = useRef(weather);

  useEffect(() => {
    weatherRef.current = weather;
  }, [weather]);

  const refreshInternal = useCallback(async ({ silent = false } = {}) => {
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    if (!silent) setLoading(true);
    const refreshPromise = (async () => {
      try {
        const latest = await fetchLatestWeather();
        setWeather(latest);
        writeSessionWeather(latest);
        setError(null);
        return true;
      } catch (err) {
        console.warn('⚠️ Wetter konnte nicht aus Supabase geladen werden:', err?.message ?? err);
        const hasFallback = Boolean(weatherRef.current?.data);
        if (!hasFallback) {
          setError(err);
        }
        return hasFallback;
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
        void refreshInternal().then((ok) => {
          if (ok || disposed || !isDocumentVisible()) return;
          if (initialRetryRef.current != null && typeof window !== 'undefined') {
            window.clearTimeout(initialRetryRef.current);
          }
          if (typeof window !== 'undefined') {
            initialRetryRef.current = window.setTimeout(() => {
              if (!disposed && isDocumentVisible()) {
                void refreshInternal({ silent: true });
              }
            }, INITIAL_RETRY_DELAY_MS);
          }
        });
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
      if (initialRetryRef.current != null && typeof window !== 'undefined') {
        window.clearTimeout(initialRetryRef.current);
      }
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

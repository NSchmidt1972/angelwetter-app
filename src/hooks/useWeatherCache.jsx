// src/hooks/useWeatherCache.jsx
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/supabaseClient';
import { getActiveClubId } from '@/utils/clubId';
import { withTimeout } from '@/utils/async';
import { useAppResumeTick } from '@/hooks/useAppResumeSync';
import { fetchWeather } from '@/services/weatherService';

const WeatherContext = createContext(null);

const WEATHER_ID = 'latest';
const WEATHER_SESSION_CACHE_KEY_PREFIX = 'weather_latest_session_v2';
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

function getSessionCacheKey(clubId) {
  return `${WEATHER_SESSION_CACHE_KEY_PREFIX}:${clubId || 'default'}`;
}

function isValidWeatherPayload(payload) {
  return Boolean(
    payload &&
      typeof payload === 'object' &&
      payload.current &&
      Array.isArray(payload.daily) &&
      Array.isArray(payload.hourly)
  );
}

function readSessionWeather(clubId = null) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(getSessionCacheKey(clubId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (!isValidWeatherPayload(parsed.data)) return null;
    return {
      data: parsed.data,
      savedAt: Number(parsed.savedAt) || Date.now(),
      clubId: parsed.clubId || clubId || null,
    };
  } catch {
    return null;
  }
}

function writeSessionWeather(clubId = null, value) {
  if (typeof window === 'undefined') return;
  try {
    const key = getSessionCacheKey(clubId);
    if (!isValidWeatherPayload(value?.data)) {
      window.sessionStorage.removeItem(key);
      return;
    }
    window.sessionStorage.setItem(
      key,
      JSON.stringify({
        data: value.data,
        savedAt: Number(value.savedAt) || Date.now(),
        clubId: value.clubId || clubId || null,
      })
    );
  } catch {
    /* ignore storage errors */
  }
}

async function fetchLatestWeather(clubId) {
  if (!clubId) return null;
  const { data, error } = await withTimeout(
    supabase
      .from('weather_cache')
      .select('data, updated_at')
      .eq('club_id', clubId)
      .eq('id', WEATHER_ID)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    WEATHER_TIMEOUT_MS,
    'Wetter-Request timeout'
  );

  if (error) throw error;
  if (!isValidWeatherPayload(data?.data)) return null;
  return {
    data: data.data,
    savedAt: data?.updated_at ? new Date(data.updated_at).getTime() : Date.now(),
    clubId,
  };
}

export function WeatherProvider({ children }) {
  const resumeTick = useAppResumeTick();
  const [activeClubId, setActiveClubIdState] = useState(() => getActiveClubId());
  const [weather, setWeather] = useState(() => readSessionWeather(getActiveClubId()));
  const [loading, setLoading] = useState(() => !readSessionWeather(getActiveClubId()));
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);
  const refreshPromiseRef = useRef(null);
  const refreshPromiseClubIdRef = useRef(null);
  const initialRetryRef = useRef(null);
  const weatherRef = useRef(weather);
  const activeClubIdRef = useRef(activeClubId);

  useEffect(() => {
    weatherRef.current = weather;
  }, [weather]);

  useEffect(() => {
    activeClubIdRef.current = activeClubId;
  }, [activeClubId]);

  const refreshInternal = useCallback(async ({ silent = false, clubId: providedClubId = null } = {}) => {
    const clubId = providedClubId || activeClubIdRef.current || getActiveClubId();
    if (refreshPromiseRef.current && refreshPromiseClubIdRef.current === clubId) {
      return refreshPromiseRef.current;
    }

    if (!silent) setLoading(true);
    const refreshPromise = (async () => {
      try {
        let latest = await fetchLatestWeather(clubId);
        if (!latest) {
          const liveData = await withTimeout(fetchWeather(null), WEATHER_TIMEOUT_MS, 'Wetter-Live-Request timeout');
          if (!isValidWeatherPayload(liveData)) {
            throw new Error('Wetterdaten unvollständig');
          }
          latest = {
            data: liveData,
            savedAt: Date.now(),
            clubId,
          };
        }
        if (activeClubIdRef.current !== clubId) {
          return true;
        }
        setWeather(latest);
        writeSessionWeather(clubId, latest);
        setError(null);
        return true;
      } catch (err) {
        console.warn('⚠️ Wetter konnte nicht aus Supabase geladen werden:', err?.message ?? err);
        const hasFallback =
          Boolean(weatherRef.current?.data) &&
          (!weatherRef.current?.clubId || weatherRef.current.clubId === clubId);
        if (!hasFallback) {
          setError(err);
        }
        return hasFallback;
      } finally {
        if (!silent && activeClubIdRef.current === clubId) setLoading(false);
      }
    })();

    refreshPromiseClubIdRef.current = clubId;
    let wrappedPromise = null;
    wrappedPromise = refreshPromise.finally(() => {
      if (refreshPromiseRef.current === wrappedPromise) {
        refreshPromiseRef.current = null;
        refreshPromiseClubIdRef.current = null;
      }
    });
    refreshPromiseRef.current = wrappedPromise;
    return wrappedPromise;
  }, []);

  const updateWeather = useCallback((next) => {
    setWeather((prev) => {
      const resolved = typeof next === 'function' ? next(prev) : next;
      if (!resolved?.data || !isValidWeatherPayload(resolved.data)) return prev;
      const normalized = {
        data: resolved.data,
        savedAt: Number(resolved.savedAt) || Date.now(),
        clubId: resolved.clubId || activeClubIdRef.current || getActiveClubId(),
      };
      writeSessionWeather(normalized.clubId, normalized);
      return normalized;
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleClubContextChange = () => {
      const nextClubId = getActiveClubId();
      setActiveClubIdState((prev) => (prev === nextClubId ? prev : nextClubId));
    };
    window.addEventListener('angelwetter:club-context-changed', handleClubContextChange);
    return () => {
      window.removeEventListener('angelwetter:club-context-changed', handleClubContextChange);
    };
  }, []);

  useEffect(() => {
    const sessionWeather = readSessionWeather(activeClubId);
    setWeather(sessionWeather);
    setError(null);
    setLoading(!sessionWeather);
    if (!isDocumentVisible()) return;
    void refreshInternal({
      silent: Boolean(sessionWeather),
      clubId: activeClubId,
    });
  }, [activeClubId, refreshInternal]);

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
    const nextClubId = getActiveClubId();
    if (nextClubId && nextClubId !== activeClubIdRef.current) {
      setActiveClubIdState(nextClubId);
    }
    void refreshInternal({ silent: true, clubId: nextClubId });
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

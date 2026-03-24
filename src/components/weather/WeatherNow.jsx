// src/components/weather/WeatherNow.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CurrentPanel from '@/components/weather/CurrentPanel';
import HourlyScroller from '@/components/weather/HourlyScroller';
import DailyScroller from '@/components/weather/DailyScroller';
import {
  getModelInfo,
  isAiCircuitOpen,
  isAiUnavailableError,
  predictForWeather,
} from '@/services/aiService';
import SegmentedSpinner from '@/components/weather/SegmentedSpinner';

// --- prediction utils (unverändert gelassen) ---
const PREDICTION_TTL_MS = 12 * 60 * 60 * 1000;
const PREDICTION_CACHE_KEY = 'ai_pred_cache_v3';
const MODEL_FINGERPRINT_SESSION_KEY = 'ai_model_fingerprint_v1';
const REQUIRED_AI_MODEL_VERSION = '2026-02-14-main-max-agg-v10';
const MAX_CONCURRENCY = 3;
const INITIAL_HOURS = 12;
const CHUNK_HOURS = 6;
const INITIAL_DAYS = 3;
const CHUNK_DAYS = 2;
const MAX_PREDICTION_RETRIES = 1;

function idleCall(cb) {
  let callbackCleanup;
  const run = () => {
    const maybeCleanup = cb();
    if (typeof maybeCleanup === 'function') {
      callbackCleanup = maybeCleanup;
    }
  };

  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    const id = window.requestIdleCallback(run, { timeout: 800 });
    return () => {
      window.cancelIdleCallback?.(id);
      callbackCleanup?.();
    };
  }
  const t = setTimeout(run, 200);
  return () => {
    clearTimeout(t);
    callbackCleanup?.();
  };
}
function makeKey(w) {
  return [
    w.date, w.hour,
    Math.round(w.temp), w.pressure, Math.round((w.wind || 0) * 10) / 10,
    w.humidity, w.wind_deg, w.moon_phase
  ].join('|');
}

function getFingerprintVersion(fingerprint) {
  if (!fingerprint) return '';
  return String(fingerprint).split('|')[0] || '';
}

function isVersionOnlyFingerprint(fingerprint) {
  const value = String(fingerprint || '');
  return Boolean(value) && !value.includes('|');
}

function isCompatibleFingerprint(requiredFingerprint, cachedFingerprint) {
  if (!requiredFingerprint) return Boolean(cachedFingerprint);
  if (!cachedFingerprint) return false;
  if (requiredFingerprint === cachedFingerprint) return true;
  const requiredVersion = getFingerprintVersion(requiredFingerprint);
  const cachedVersion = getFingerprintVersion(cachedFingerprint);
  return Boolean(requiredVersion && cachedVersion && requiredVersion === cachedVersion && isVersionOnlyFingerprint(cachedFingerprint));
}

function readStoredModelFingerprint() {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.sessionStorage.getItem(MODEL_FINGERPRINT_SESSION_KEY);
    return value || null;
  } catch {
    return null;
  }
}

function writeStoredModelFingerprint(fingerprint) {
  if (typeof window === 'undefined') return;
  try {
    if (!fingerprint) {
      window.sessionStorage.removeItem(MODEL_FINGERPRINT_SESSION_KEY);
      return;
    }
    window.sessionStorage.setItem(MODEL_FINGERPRINT_SESSION_KEY, fingerprint);
  } catch {
    // ignore quota/security errors
  }
}

function mapDailyToPredictionInput(day) {
  const dayDate = new Date(day.dt * 1000);
  return {
    temp: day.temp.day,
    pressure: day.pressure,
    wind: day.wind_speed,
    humidity: day.humidity,
    wind_deg: day.wind_deg,
    moon_phase: day.moon_phase,
    hour: 12,
    date: dayDate.toISOString().slice(0, 10),
    dt: day.dt,
    timestamp: dayDate.toISOString(),
  };
}

function mapHourlyToPredictionInput(hour, moonPhase) {
  const hourDate = new Date(hour.dt * 1000);
  return {
    temp: hour.temp,
    pressure: hour.pressure,
    wind: hour.wind_speed,
    humidity: hour.humidity,
    wind_deg: hour.wind_deg,
    moon_phase: moonPhase,
    hour: hourDate.getHours(),
    date: hourDate.toISOString().slice(0, 10),
    dt: hour.dt,
    timestamp: hourDate.toISOString(),
  };
}

function normalizeIso(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function predictionFingerprint(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const apiVersion = String(payload?.api_model_version || '');
  const trainedAt = normalizeIso(
    payload?.trained_at
      || payload?.model_trained_at
      || payload?.last_trained_at
      || payload?.models?.main?.trained_at
      || payload?.stats?.trained_at
      || payload?.metadata?.trained_at
  ) || '';
  const fishModelsAt = normalizeIso(
    payload?.stats?.per_fish_model_trained_at
      || payload?.metadata?.per_fish_model_trained_at
      || payload?.models?.per_fish_type?.trained_at
  ) || '';
  const calibratorsAt = normalizeIso(
    payload?.stats?.calibrators_trained_at
      || payload?.metadata?.calibrators_trained_at
      || payload?.models?.calibrators?.trained_at
  ) || '';
  const raw = `${apiVersion}|${trainedAt}|${fishModelsAt}|${calibratorsAt}`;
  return raw.replace(/^\|+|\|+$/g, '') || null;
}

function modelInfoFingerprint(modelInfo) {
  if (!modelInfo || typeof modelInfo !== 'object') return null;
  const apiVersion = String(modelInfo?.api_model_version || '');
  const trainedAt = normalizeIso(
    modelInfo?.trained_at
      || modelInfo?.main_from_species_trained_at
      || modelInfo?.main_base_trained_at
  ) || '';
  const fishModelsAt = normalizeIso(modelInfo?.per_fish_model_trained_at) || '';
  const calibratorsAt = normalizeIso(modelInfo?.calibrators_trained_at) || '';
  const raw = `${apiVersion}|${trainedAt}|${fishModelsAt}|${calibratorsAt}`;
  return raw.replace(/^\|+|\|+$/g, '') || null;
}

function usePredictionCache() {
  const ref = useRef(null);

  if (!ref.current) {
    try {
      ref.current = JSON.parse(localStorage.getItem(PREDICTION_CACHE_KEY) || '{}');
    } catch (err) {
      console.warn('Vorhersage-Cache konnte nicht geladen werden:', err);
      ref.current = {};
    }
  }

  const get = useCallback((key, requiredFingerprint = null, { allowFingerprintFallback = false } = {}) => {
    const entry = ref.current[key];
    if (!entry) return null;
    if (Date.now() - entry.ts > PREDICTION_TTL_MS) return null;
    const cachedVersion = entry?.v?.api_model_version;
    if (cachedVersion !== REQUIRED_AI_MODEL_VERSION) return null;
    const cachedFingerprint = entry?.fp || predictionFingerprint(entry?.v);
    if (requiredFingerprint) {
      if (!isCompatibleFingerprint(requiredFingerprint, cachedFingerprint)) return null;
      return entry.v;
    }
    if (!allowFingerprintFallback) return null;
    return entry.v;
  }, []);

  const set = useCallback((key, value, { fingerprint = null } = {}) => {
    ref.current[key] = { ts: Date.now(), v: value, fp: fingerprint || predictionFingerprint(value) };
  }, []);

  const purge = useCallback(({ requiredFingerprint = null } = {}) => {
    const keys = Object.keys(ref.current || {});
    let changed = false;
    keys.forEach((key) => {
      const entry = ref.current[key];
      const expired = !entry || (Date.now() - entry.ts > PREDICTION_TTL_MS);
      const wrongVersion = entry?.v?.api_model_version !== REQUIRED_AI_MODEL_VERSION;
      const fingerprint = entry?.fp || predictionFingerprint(entry?.v);
      const wrongFingerprint = Boolean(requiredFingerprint)
        && !isCompatibleFingerprint(requiredFingerprint, fingerprint);
      if (expired || wrongVersion || wrongFingerprint) {
        delete ref.current[key];
        changed = true;
      }
    });
    return changed;
  }, []);

  const persist = useCallback(() => {
    try {
      localStorage.setItem(PREDICTION_CACHE_KEY, JSON.stringify(ref.current));
    } catch (err) {
      console.warn('Vorhersage-Cache konnte nicht persistiert werden:', err);
    }
  }, []);

  return useMemo(() => ({ get, set, purge, persist }), [get, set, purge, persist]);
}
async function fetchPrediction(weather, signal) {
  return predictForWeather(weather, { signal });
}
async function runBatched(tasks, limit = MAX_CONCURRENCY) {
  const out = new Array(tasks.length);
  let i = 0;
  async function worker() {
    while (i < tasks.length) {
      const idx = i++;
      try {
        out[idx] = await tasks[idx]();
      } catch (err) {
        console.warn('Vorhersage-Worker fehlgeschlagen:', err);
        out[idx] = null;
      }
    }
  }
  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => worker());
  await Promise.all(workers);
  return out;
}

function hasOwnPrediction(map, index) {
  return Object.prototype.hasOwnProperty.call(map, index);
}

function hasCompatiblePrediction(map, index, requiredFingerprint = null) {
  if (!hasOwnPrediction(map, index)) return false;
  if (!requiredFingerprint) return true;
  const fingerprint = predictionFingerprint(map[index]);
  return isCompatibleFingerprint(requiredFingerprint, fingerprint);
}

function isAbortError(error) {
  const message = String(error?.message || '');
  return error?.name === 'AbortError' || /aborted|abort/i.test(message);
}

export default function WeatherNow({
  data,
  loading = false,
  waterTemperature = null,
  waterTemperatureHistory = [],
  waterTemperatureLoading = false,
  showWaterTemperature = false,
}) {

  // Daily (inkl. AI)
  const [dailyBase, setDailyBase] = useState([]);
  const [dailyPreds, setDailyPreds] = useState({});
  const [dailyVisibleCount, setDailyVisibleCount] = useState(INITIAL_DAYS);

  // Hourly Basis + KI + Sichtbarkeit
  const [hourlyBase, setHourlyBase] = useState([]);
  const [hourPreds, setHourPreds] = useState({});
  const [visibleCount, setVisibleCount] = useState(INITIAL_HOURS);

  const hoursToRender = useMemo(
    () => hourlyBase.slice(0, Math.min(visibleCount, hourlyBase.length)),
    [hourlyBase, visibleCount]
  );
  const daysToRender = useMemo(() => {
    const visible = dailyBase.slice(0, Math.min(dailyVisibleCount, dailyBase.length));
    return visible.map((day, idx) => ({ ...day, aiPrediction: dailyPreds[idx] ?? null }));
  }, [dailyBase, dailyPreds, dailyVisibleCount]);

  const cache = usePredictionCache();
  const [modelFingerprint, setModelFingerprint] = useState(() => readStoredModelFingerprint());
  const modelFingerprintRef = useRef(modelFingerprint);
  const hourlyRef = useRef(null);
  const dailyRef = useRef(null);
  const dailyAttemptsRef = useRef({});
  const hourlyAttemptsRef = useRef({});
  const dailyInFlightRef = useRef(new Set());
  const hourlyInFlightRef = useRef(new Set());
  const aiUnavailableLoggedRef = useRef(false);

  useEffect(() => {
    modelFingerprintRef.current = modelFingerprint;
  }, [modelFingerprint]);

  // Basisdaten ohne KI
  useEffect(() => {
    if (!data?.data?.daily || !data?.data?.current || !data?.data?.hourly) return;
    const dailySlice = data.data.daily.slice(0, 7);
    const hourlySlice = data.data.hourly.slice(0, 24);
    const moonPhase = dailySlice[0]?.moon_phase ?? null;
    const activeFingerprint = modelFingerprintRef.current;
    const hydratedDailyPreds = {};
    const hydratedHourlyPreds = {};

    for (let i = 0; i < dailySlice.length; i++) {
      const weatherInput = mapDailyToPredictionInput(dailySlice[i]);
      const key = makeKey(weatherInput);
      const cached = cache.get(key, activeFingerprint, { allowFingerprintFallback: true });
      if (cached) hydratedDailyPreds[i] = cached;
    }
    for (let i = 0; i < hourlySlice.length; i++) {
      const weatherInput = mapHourlyToPredictionInput(hourlySlice[i], moonPhase);
      const key = makeKey(weatherInput);
      const cached = cache.get(key, activeFingerprint, { allowFingerprintFallback: true });
      if (cached) hydratedHourlyPreds[i] = cached;
    }

    setDailyBase(dailySlice);
    setDailyVisibleCount(Math.min(INITIAL_DAYS, dailySlice.length));
    setDailyPreds(hydratedDailyPreds);
    setHourlyBase(hourlySlice);
    setVisibleCount(Math.min(INITIAL_HOURS, hourlySlice.length));
    setHourPreds(hydratedHourlyPreds);
    dailyAttemptsRef.current = {};
    hourlyAttemptsRef.current = {};
    dailyInFlightRef.current.clear();
    hourlyInFlightRef.current.clear();
    if (hourlyRef.current) hourlyRef.current.scrollLeft = 0;
    if (dailyRef.current) dailyRef.current.scrollLeft = 0;
  }, [data, cache]);

  useEffect(() => {
    if (!data?.data) return;
    const ac = new AbortController();
    let active = true;

    (async () => {
      try {
        const info = await getModelInfo({ signal: ac.signal });
        if (!active) return;
        const fingerprint = modelInfoFingerprint(info);
        if (!fingerprint) return;
        setModelFingerprint((prev) => (prev === fingerprint ? prev : fingerprint));
        writeStoredModelFingerprint(fingerprint);
        const changed = cache.purge({ requiredFingerprint: fingerprint });
        if (changed) cache.persist();
      } catch (err) {
        if (!isAbortError(err) && !isAiUnavailableError(err)) {
          console.warn('ModelInfo für Cache-Invalidierung fehlgeschlagen:', err);
        }
      }
    })();

    return () => {
      active = false;
      ac.abort();
    };
  }, [data, cache]);

  // KI-Prognosen: sichtbare Daily-Karten
  useEffect(() => {
    if (!dailyBase.length || dailyVisibleCount <= 0) return;
    if (isAiCircuitOpen()) return;
    const cancelIdle = idleCall(() => {
      const ac = new AbortController();
      const { signal } = ac;
      const trackedIndices = [];
      (async () => {
        const maxVisible = Math.min(dailyVisibleCount, dailyBase.length);
        const indices = [];
        for (let i = 0; i < maxVisible; i++) {
          if (hasCompatiblePrediction(dailyPreds, i, modelFingerprint)) continue;
          if (dailyInFlightRef.current.has(i)) continue;
          const retries = dailyAttemptsRef.current[i] || 0;
          if (retries >= MAX_PREDICTION_RETRIES) continue;
          indices.push(i);
        }
        if (!indices.length) return;
        trackedIndices.push(...indices);
        indices.forEach((i) => dailyInFlightRef.current.add(i));

        const tasks = indices.map((i) => {
          const day = dailyBase[i];
          const w = mapDailyToPredictionInput(day);
          const key = makeKey(w);
          return async () => {
            const c = cache.get(key, modelFingerprint, { allowFingerprintFallback: true });
            if (c) return { i, pred: c };
            try {
              const pred = await fetchPrediction(w, signal);
              cache.set(key, pred, { fingerprint: modelFingerprint });
              return { i, pred: pred ?? null };
            } catch (err) {
              if (isAbortError(err)) {
                return { i, pred: null, failed: true };
              }
              if (isAiUnavailableError(err)) {
                if (!aiUnavailableLoggedRef.current) {
                  console.warn('AI-Prognose derzeit nicht erreichbar (CORS/503).');
                  aiUnavailableLoggedRef.current = true;
                }
                return { i, pred: null, failed: true };
              }
              console.warn('Daily-Vorhersage fehlgeschlagen:', err?.message || err);
              return { i, pred: null, failed: true };
            }
          };
        });

        const results = await runBatched(tasks);
        setDailyPreds((prev) => {
          const next = { ...prev };
          results.forEach((r) => {
            if (!r) return;
            if (r.failed) {
              dailyAttemptsRef.current[r.i] = (dailyAttemptsRef.current[r.i] || 0) + 1;
              return;
            }
            dailyAttemptsRef.current[r.i] = 0;
            next[r.i] = r.pred;
          });
          return next;
        });
        indices.forEach((i) => dailyInFlightRef.current.delete(i));
        cache.persist();
      })();
      return () => {
        ac.abort();
        trackedIndices.forEach((i) => dailyInFlightRef.current.delete(i));
      };
    });
    return () => { if (typeof cancelIdle === 'function') cancelIdle(); };
  }, [dailyBase, dailyVisibleCount, dailyPreds, cache, modelFingerprint]);

  // KI-Prognosen: sichtbare Stunden
  useEffect(() => {
    if (!hourlyBase.length || visibleCount <= 0) return;
    if (isAiCircuitOpen()) return;

    const cancelIdle = idleCall(() => {
      const ac = new AbortController();
      const { signal } = ac;
      const trackedIndices = [];

      (async () => {
        const moonPhase = data?.data?.daily?.[0]?.moon_phase ?? null;
        const indices = [];
        for (let i = 0; i < Math.min(visibleCount, hourlyBase.length); i++) {
          if (hasCompatiblePrediction(hourPreds, i, modelFingerprint)) continue;
          if (hourlyInFlightRef.current.has(i)) continue;
          const retries = hourlyAttemptsRef.current[i] || 0;
          if (retries >= MAX_PREDICTION_RETRIES) continue;
          indices.push(i);
        }
        if (!indices.length) return;
        trackedIndices.push(...indices);
        indices.forEach((i) => hourlyInFlightRef.current.add(i));

        const tasks = indices.map(i => {
          const h = hourlyBase[i];
          const w = mapHourlyToPredictionInput(h, moonPhase);
          const key = makeKey(w);
          return async () => {
            const c = cache.get(key, modelFingerprint, { allowFingerprintFallback: true });
            if (c) return { i, pred: c };
            try {
              const pred = await fetchPrediction(w, signal);
              cache.set(key, pred, { fingerprint: modelFingerprint });
              return { i, pred: pred ?? null };
            } catch (err) {
              if (isAbortError(err)) {
                return { i, pred: null, failed: true };
              }
              if (isAiUnavailableError(err)) {
                if (!aiUnavailableLoggedRef.current) {
                  console.warn('AI-Prognose derzeit nicht erreichbar (CORS/503).');
                  aiUnavailableLoggedRef.current = true;
                }
                return { i, pred: null, failed: true };
              }
              console.warn('Stunden-Vorhersage fehlgeschlagen:', err?.message || err);
              return { i, pred: null, failed: true };
            }
          };
        });

        const results = await runBatched(tasks);
        setHourPreds(prev => {
          const next = { ...prev };
          results.forEach((r) => {
            if (!r) return;
            if (r.failed) {
              hourlyAttemptsRef.current[r.i] = (hourlyAttemptsRef.current[r.i] || 0) + 1;
              return;
            }
            hourlyAttemptsRef.current[r.i] = 0;
            next[r.i] = r.pred;
          });
          return next;
        });
        indices.forEach((i) => hourlyInFlightRef.current.delete(i));
        cache.persist();
      })();

      return () => {
        ac.abort();
        trackedIndices.forEach((i) => hourlyInFlightRef.current.delete(i));
      };
    });

    return () => { if (typeof cancelIdle === 'function') cancelIdle(); };
  }, [visibleCount, hourlyBase, hourPreds, cache, data, modelFingerprint]);

  const loadMoreHours = useCallback(() => {
    setVisibleCount((vc) => {
      const next = Math.min(vc + CHUNK_HOURS, hourlyBase.length);
      return next === vc ? vc : next;
    });
  }, [hourlyBase.length]);

  // Infinite-Scroll: sichtbare Stunden erhöhen
  const onHourlyScroll = useCallback((e) => {
    const el = e.currentTarget;
    const nearEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 120;
    if (!nearEnd) return;
    loadMoreHours();
  }, [loadMoreHours]);

  const loadMoreDays = useCallback(() => {
    setDailyVisibleCount((vc) => {
      const next = Math.min(vc + CHUNK_DAYS, dailyBase.length);
      return next === vc ? vc : next;
    });
  }, [dailyBase.length]);

  const onDailyScroll = useCallback((e) => {
    const el = e.currentTarget;
    const nearEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 120;
    if (!nearEnd) return;
    loadMoreDays();
  }, [loadMoreDays]);

  useEffect(() => {
    const el = dailyRef.current;
    if (!el || dailyVisibleCount >= dailyBase.length) return;
    if (el.scrollWidth <= el.clientWidth + 8) {
      loadMoreDays();
    }
  }, [dailyVisibleCount, dailyBase.length, loadMoreDays]);

  if (!data?.data) {
    if (loading) {
      return (
        <div className="p-6 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 shadow-md rounded-xl max-w-6xl mx-auto">
          <div className="flex items-center justify-center gap-3 text-gray-600 dark:text-gray-300">
            <SegmentedSpinner className="h-6 w-6" />
            <span className="font-medium">Wetterdaten werden geladen...</span>
          </div>
        </div>
      );
    }
    return (
      <div className="p-4 bg-white dark:bg-gray-900 text-center text-red-600 rounded-xl shadow max-w-xl mx-auto">
        ⚠️ Keine Wetterdaten verfügbar.
        <br />
        Die Daten konnten nicht von Supabase geladen werden.
      </div>
    );
  }

  const now = data.data.current;
  const days = daysToRender || [];

  return (
    <div className="p-6 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 shadow-md rounded-xl max-w-6xl mx-auto">
      <CurrentPanel
        now={now}
        daily={data.data.daily}
        savedAt={data.savedAt}
        waterTemperature={waterTemperature}
        waterTemperatureHistory={waterTemperatureHistory}
        waterTemperatureLoading={waterTemperatureLoading}
        showWaterTemperature={showWaterTemperature}
      />
      <HourlyScroller
        hours={hoursToRender}
        hourPreds={hourPreds}
        onScroll={onHourlyScroll}
        scrollRef={hourlyRef}
        hasMore={visibleCount < hourlyBase.length}
        onLoadMore={loadMoreHours}
      />
      <DailyScroller
        days={days}
        onScroll={onDailyScroll}
        scrollRef={dailyRef}
      />
    </div>
  );
}

// src/components/weather/WeatherNow.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CurrentPanel from '@/components/weather/CurrentPanel';
import HourlyScroller from '@/components/weather/HourlyScroller';
import DailyScroller from '@/components/weather/DailyScroller';
import { predictForWeather } from '@/services/aiService';
import SegmentedSpinner from '@/components/weather/SegmentedSpinner';

// --- prediction utils (unverändert gelassen) ---
const PREDICTION_TTL_MS = 12 * 60 * 60 * 1000;
const PREDICTION_CACHE_KEY = 'ai_pred_cache_v3';
const REQUIRED_AI_MODEL_VERSION = '2026-02-14-main-max-agg-v10';
const MAX_CONCURRENCY = 3;
const INITIAL_HOURS = 12;
const CHUNK_HOURS = 6;
const INITIAL_DAYS = 3;
const CHUNK_DAYS = 2;

function idleCall(cb) {
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    const id = window.requestIdleCallback(cb, { timeout: 800 });
    return () => window.cancelIdleCallback?.(id);
  }
  const t = setTimeout(cb, 200);
  return () => clearTimeout(t);
}
function makeKey(w) {
  return [
    w.date, w.hour,
    Math.round(w.temp), w.pressure, Math.round((w.wind || 0) * 10) / 10,
    w.humidity, w.wind_deg, w.moon_phase
  ].join('|');
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

  const get = useCallback((key) => {
    const entry = ref.current[key];
    if (!entry) return null;
    if (Date.now() - entry.ts > PREDICTION_TTL_MS) return null;
    const cachedVersion = entry?.v?.api_model_version;
    if (cachedVersion !== REQUIRED_AI_MODEL_VERSION) return null;
    return entry.v;
  }, []);

  const set = useCallback((key, value) => {
    ref.current[key] = { ts: Date.now(), v: value };
  }, []);

  const persist = useCallback(() => {
    try {
      localStorage.setItem(PREDICTION_CACHE_KEY, JSON.stringify(ref.current));
    } catch (err) {
      console.warn('Vorhersage-Cache konnte nicht persistiert werden:', err);
    }
  }, []);

  return useMemo(() => ({ get, set, persist }), [get, set, persist]);
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

export default function WeatherNow({ data, onRefresh, loading = false }) {

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
  const hourlyRef = useRef(null);
  const dailyRef = useRef(null);

  // ⏱ Auto-Refresh (nur sichtbar & online)
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== 'visible') return;
      if ('onLine' in navigator && !navigator.onLine) return;
      onRefresh?.();
    };
    const id = setInterval(tick, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [onRefresh]);

  // Basisdaten ohne KI
  useEffect(() => {
    if (!data?.data?.daily || !data?.data?.current || !data?.data?.hourly) return;
    const dailySlice = data.data.daily.slice(0, 7);
    setDailyBase(dailySlice);
    setDailyVisibleCount(Math.min(INITIAL_DAYS, dailySlice.length));
    setDailyPreds({});
    const slice = data.data.hourly.slice(0, 24);
    setHourlyBase(slice);
    setVisibleCount(Math.min(INITIAL_HOURS, slice.length));
    setHourPreds({});
    if (hourlyRef.current) hourlyRef.current.scrollLeft = 0;
    if (dailyRef.current) dailyRef.current.scrollLeft = 0;
  }, [data, cache]);

  // KI-Prognosen: sichtbare Daily-Karten
  useEffect(() => {
    if (!dailyBase.length || dailyVisibleCount <= 0) return;
    const cancelIdle = idleCall(() => {
      const ac = new AbortController();
      const { signal } = ac;
      (async () => {
        const maxVisible = Math.min(dailyVisibleCount, dailyBase.length);
        const indices = [];
        for (let i = 0; i < maxVisible; i++) {
          if (dailyPreds[i] == null) indices.push(i);
        }
        if (!indices.length) return;

        const tasks = indices.map((i) => {
          const day = dailyBase[i];
          const dayDate = new Date(day.dt * 1000);
          const w = {
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
          const key = makeKey(w);
          return async () => {
            const c = cache.get(key);
            if (c) return { i, pred: c };
            const pred = await fetchPrediction(w, signal);
            cache.set(key, pred);
            return { i, pred };
          };
        });

        const results = await runBatched(tasks);
        setDailyPreds((prev) => {
          const next = { ...prev };
          results.forEach((r) => { if (r) next[r.i] = r.pred; });
          return next;
        });
        cache.persist();
      })();
      return () => ac.abort();
    });
    return () => { if (typeof cancelIdle === 'function') cancelIdle(); };
  }, [dailyBase, dailyVisibleCount, dailyPreds, cache]);

  // KI-Prognosen: sichtbare Stunden
  useEffect(() => {
    if (!hourlyBase.length || visibleCount <= 0) return;

    const cancelIdle = idleCall(() => {
      const ac = new AbortController();
      const { signal } = ac;

      (async () => {
        const moonPhase = data?.data?.daily?.[0]?.moon_phase ?? null;
        const indices = [];
        for (let i = 0; i < Math.min(visibleCount, hourlyBase.length); i++) {
          if (hourPreds[i] == null) indices.push(i);
        }
        if (!indices.length) return;

        const tasks = indices.map(i => {
          const h = hourlyBase[i];
          const hDate = new Date(h.dt * 1000);
          const w = {
            temp: h.temp,
            pressure: h.pressure,
            wind: h.wind_speed,
            humidity: h.humidity,
            wind_deg: h.wind_deg,
            moon_phase: moonPhase,
            hour: hDate.getHours(),
            date: hDate.toISOString().slice(0, 10),
            dt: h.dt,
            timestamp: hDate.toISOString(),
          };
          const key = makeKey(w);
          return async () => {
            const c = cache.get(key);
            if (c) return { i, pred: c };
            const pred = await fetchPrediction(w, signal);
            cache.set(key, pred);
            return { i, pred };
          };
        });

        const results = await runBatched(tasks);
        setHourPreds(prev => {
          const next = { ...prev };
          results.forEach(r => { if (r) next[r.i] = r.pred; });
          return next;
        });
        cache.persist();
      })();

      return () => ac.abort();
    });

    return () => { if (typeof cancelIdle === 'function') cancelIdle(); };
  }, [visibleCount, hourlyBase, hourPreds, cache, data]);

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

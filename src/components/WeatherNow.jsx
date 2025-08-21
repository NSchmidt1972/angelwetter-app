import { useEffect, useMemo, useRef, useState } from 'react';

// --- helpers ---
function getMoonDescription(phase) {
  if (phase === 0 || phase === 1) return '🌑 Neumond';
  if (phase > 0 && phase < 0.25) return '🌒 Zunehmender Sichelmond';
  if (phase === 0.25) return '🌓 Erstes Viertel';
  if (phase > 0.25 && phase < 0.5) return '🌔 Zunehmender Dreiviertelmond';
  if (phase === 0.5) return '🌕 Vollmond';
  if (phase > 0.5 && phase < 0.75) return '🌖 Abnehmender Dreiviertelmond';
  if (phase === 0.75) return '🌗 Letztes Viertel';
  if (phase > 0.75 && phase < 1) return '🌘 Abnehmender Sichelmond';
  return '❓ Unbekannt';
}
function windDirection(deg) {
  const dirs = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(deg / 45) % 8];
}
const weekday = (dt) => new Date(dt * 1000).toLocaleDateString('de-DE', { weekday: 'short' });
const hour = (dt) => new Date(dt * 1000).toLocaleTimeString('de-DE', { hour: '2-digit' });

// --- prediction utils ---
const PREDICTION_TTL_MS = 12 * 60 * 60 * 1000;
const PREDICTION_CACHE_KEY = 'ai_pred_cache_v1';
const MAX_CONCURRENCY = 3;
const INITIAL_HOURS = 12;
const CHUNK_HOURS = 6;

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
    try { ref.current = JSON.parse(localStorage.getItem(PREDICTION_CACHE_KEY) || '{}'); }
    catch { ref.current = {}; }
  }
  const get = (k) => {
    const e = ref.current[k];
    if (!e) return null;
    if (Date.now() - e.ts > PREDICTION_TTL_MS) return null;
    return e.v;
  };
  const set = (k, v) => { ref.current[k] = { ts: Date.now(), v }; };
  const persist = () => { try { localStorage.setItem(PREDICTION_CACHE_KEY, JSON.stringify(ref.current)); } catch {} };
  return { get, set, persist };
}

async function fetchPrediction(weather, signal) {
  const res = await fetch('https://ai.asv-rotauge.de/predict', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(weather),
    signal
  });
  return res.json();
}

async function runBatched(tasks, limit = MAX_CONCURRENCY) {
  const out = new Array(tasks.length);
  let i = 0;
  async function worker() {
    while (i < tasks.length) {
      const idx = i++;
      try { out[idx] = await tasks[idx](); } catch { out[idx] = null; }
    }
  }
  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => worker());
  await Promise.all(workers);
  return out;
}

// ⭐ visuelle Bewertung
function FishRating({ probability }) {
  const rating = Math.round((parseFloat(probability) / 100) * 5);
  const filled = isNaN(rating) ? 0 : Math.max(0, Math.min(rating, 5));
  const empty = 5 - filled;
  return (
    <span className="inline-flex gap-[2px] align-middle">
      {Array.from({ length: filled }).map((_, i) => (
        <span key={`f${i}`} className="text-green-700 dark:text-green-300">🐟</span>
      ))}
      {Array.from({ length: empty }).map((_, i) => (
        <span key={`e${i}`} className="text-gray-400 dark:text-gray-600" style={{ filter: 'grayscale(100%) brightness(0.6)' }}>
          🐟
        </span>
      ))}
    </span>
  );
}

export default function WeatherNow({ data, onRefresh }) {
  const [autoUpdated, setAutoUpdated] = useState(false);

  // --- Daily ---
  const [dailyWithPrediction, setDailyWithPrediction] = useState([]);

  // --- Hourly: Basis + KI-Preds per Index + sichtbare Anzahl ---
  const [hourlyBase, setHourlyBase] = useState([]);
  const [hourPreds, setHourPreds] = useState({}); // index -> prediction
  const [visibleCount, setVisibleCount] = useState(INITIAL_HOURS);

  const [currentPrediction, setCurrentPrediction] = useState(null);

  const cache = usePredictionCache();
  const hourlyRef = useRef(null);

  // ⏱ Auto-Refresh (nur sichtbar & online)
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== 'visible') return;
      if ('onLine' in navigator && !navigator.onLine) return;
      setAutoUpdated(true);
      onRefresh?.();
      setTimeout(() => setAutoUpdated(false), 1500);
    };
    const id = setInterval(tick, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [onRefresh]);

  // Basisdaten ohne KI sofort anzeigen
  useEffect(() => {
    if (!data?.data?.daily || !data?.data?.current || !data?.data?.hourly) return;
    setDailyWithPrediction(data.data.daily);
    const slice = data.data.hourly.slice(0, 24);
    setHourlyBase(slice);
    setVisibleCount(Math.min(INITIAL_HOURS, slice.length));
    setHourPreds({});
    setCurrentPrediction(null);
    // nach links scrollen (Start)
    if (hourlyRef.current) hourlyRef.current.scrollLeft = 0;
  }, [data]);

  // KI-Prognosen: DAILY (idle), komplett (leichtgewichtig)
  useEffect(() => {
    if (!data?.data?.daily) return;
    const cancelIdle = idleCall(() => {
      const ac = new AbortController();
      const { signal } = ac;
      (async () => {
        const enriched = await runBatched(
          data.data.daily.map(day => {
            const dayDate = new Date(day.dt * 1000);
            const w = {
              temp: day.temp.day,
              pressure: day.pressure,
              wind: day.wind_speed,
              humidity: day.humidity,
              wind_deg: day.wind_deg,
              moon_phase: day.moon_phase,
              hour: 12,
              date: dayDate.toISOString().slice(0, 10)
            };
            const key = makeKey(w);
            return async () => {
              const c = cache.get(key);
              if (c) return { ...day, aiPrediction: c };
              const pred = await fetchPrediction(w, signal);
              cache.set(key, pred);
              return { ...day, aiPrediction: pred };
            };
          })
        );
        setDailyWithPrediction(enriched);
        cache.persist();
      })();
      return () => ac.abort();
    });
    return () => { if (typeof cancelIdle === 'function') cancelIdle(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.data?.daily]);

  // KI-Prognose: CURRENT (idle)
  useEffect(() => {
    if (!data?.data?.current || !data?.data?.daily) return;
    const cancelIdle = idleCall(() => {
      const ac = new AbortController();
      const { signal } = ac;
      (async () => {
        const moonPhase = data.data.daily?.[0]?.moon_phase ?? null;
        const cDate = new Date(data.data.current.dt * 1000);
        const w = {
          temp: data.data.current.temp,
          pressure: data.data.current.pressure,
          wind: data.data.current.wind_speed,
          humidity: data.data.current.humidity,
          wind_deg: data.data.current.wind_deg,
          moon_phase: moonPhase,
          hour: cDate.getHours(),
          date: cDate.toISOString().slice(0, 10)
        };
        const key = makeKey(w);
        const c = cache.get(key);
        if (c) { setCurrentPrediction(c); return; }
        try {
          const pred = await fetchPrediction(w, signal);
          cache.set(key, pred);
          setCurrentPrediction(pred);
          cache.persist();
        } catch {}
      })();
      return () => ac.abort();
    });
    return () => { if (typeof cancelIdle === 'function') cancelIdle(); };
  }, [data]);

  // KI-Prognosen für **sichtbare Stunden** (idle, on-demand, batched)
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
            date: hDate.toISOString().slice(0, 10)
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
    // bewusst nur auf sichtbare Anzahl + Basis reagieren
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleCount, hourlyBase]);

  // Horizontaler Infinite-Scroll: beim Erreichen des Endes vergrößern wir visibleCount
  const onHourlyScroll = (e) => {
    const el = e.currentTarget;
    const nearEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 120; // 120px Schwelle
    if (!nearEnd) return;
    setVisibleCount(vc => {
      const next = Math.min(vc + CHUNK_HOURS, hourlyBase.length);
      return next === vc ? vc : next;
    });
  };

  if (!data?.data) {
    return (
      <div className="p-4 bg-white dark:bg-gray-900 text-center text-red-600 rounded-xl shadow max-w-xl mx-auto">
        ⚠️ Keine Wetterdaten verfügbar.
        <br />
        Die Daten konnten nicht von Supabase geladen werden.
      </div>
    );
  }

  const now = data.data.current;
  const savedAt = data.savedAt;
  const savedAtString = savedAt
    ? new Date(savedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    : '';
  const desc = now.weather[0].description;
  const iconUrl = `https://openweathermap.org/img/wn/${now.weather[0].icon}@2x.png`;
  const moonText = getMoonDescription(data.data.daily?.[0]?.moon_phase ?? -1);

  const hoursToRender = useMemo(
    () => hourlyBase.slice(0, Math.min(visibleCount, hourlyBase.length)),
    [hourlyBase, visibleCount]
  );

  return (
    <div className="p-6 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 shadow-md rounded-xl max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">
          {autoUpdated ? (
            <span className="text-green-600 dark:text-green-400 animate-pulse">🔄 Aktualisierung...</span>
          ) : (
            <span className="text-blue-700 dark:text-blue-300">🌤 Aktuelles Wetter</span>
          )}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">{savedAtString} Uhr</p>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 mb-6">
        <img src={iconUrl} alt={desc} className="w-24 h-24 mx-auto sm:mx-0" loading="lazy" decoding="async" />
        <div className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
          <p className="text-lg font-semibold">{now.temp.toFixed(0)} °C – {desc}</p>
          <p>🌅 Sonnenaufgang: {new Date(now.sunrise * 1000).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr</p>
          <p>🌄 Sonnenuntergang: {new Date(now.sunset * 1000).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr</p>
          <p>🧪 Luftdruck: {now.pressure} hPa • 💦 Luftfeuchte: {now.humidity}%</p>
          <p>💨 Wind: {now.wind_speed} m/s aus {windDirection(now.wind_deg)}</p>
          <p>🔆 UV-Index: {now.uvi}</p>
          <p>🌙 Mondphase: {moonText}</p>
          {currentPrediction?.probability != null && (
            <p className="text-sm text-green-700 dark:text-green-300 font-semibold">
              🎯 {Number(currentPrediction.probability).toFixed(0)} % <FishRating probability={currentPrediction.probability} />
            </p>
          )}
        </div>
      </div>

      <h3 className="text-lg font-semibold mt-4 mb-2 text-gray-700 dark:text-gray-200">🕒 Stündliche Vorhersage</h3>
      <div
        ref={hourlyRef}
        onScroll={onHourlyScroll}
        className="flex overflow-x-auto gap-4 pb-4"
      >
        {hoursToRender.map((h, idx) => {
          const pred = hourPreds[idx];
          return (
            <div key={idx} className="min-w-[160px] bg-gray-100 dark:bg-gray-800 rounded-xl p-4 shadow-sm text-center flex-shrink-0 hover:shadow-md transition">
              <p className="font-bold">{hour(h.dt)}</p>
              <img
                src={`https://openweathermap.org/img/wn/${h.weather?.[0]?.icon}@2x.png`}
                alt={h.weather?.[0]?.description}
                className="mx-auto w-12 h-12"
                loading="lazy"
                decoding="async"
              />
              <p className="text-sm">{h.weather?.[0]?.description}</p>
              <p className="text-lg font-semibold">{h.temp?.toFixed ? h.temp.toFixed(0) : Math.round(h.temp)} °C</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                🌧 {Math.round((h.pop || 0) * 100)} %
                {h.pop > 0 && h.rain?.['1h'] && <> • 💧 {h.rain['1h'].toFixed(1)} mm</>}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">🧪 {h.pressure} hPa • 💦 {h.humidity}%</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                🧭 {windDirection(h.wind_deg)} ({h.wind_speed?.toFixed ? h.wind_speed.toFixed(1) : Math.round(h.wind_speed * 10) / 10} m/s)
              </p>
              {pred?.probability != null && (
                <p className="text-sm text-green-700 dark:text-green-300 font-semibold mt-1">
                  🎯 {Number(pred.probability).toFixed(0)} % <FishRating probability={pred.probability} />
                </p>
              )}
            </div>
          );
        })}
      </div>

      <h3 className="text-lg font-semibold mt-2 mb-2 text-gray-700 dark:text-gray-200">🗓 7-Tage-Vorhersage</h3>
      <div className="flex overflow-x-auto gap-4 pb-4">
        {(dailyWithPrediction || []).slice(0, 7).map((day, index) => (
          <div key={index} className="min-w-[200px] bg-gray-100 dark:bg-gray-800 rounded-xl p-4 shadow-sm text-center flex-shrink-0 hover:shadow-md transition">
            <p className="font-bold">{weekday(day.dt)}</p>
            <img
              src={`https://openweathermap.org/img/wn/${day.weather?.[0]?.icon}@2x.png`}
              alt={day.weather?.[0]?.description}
              className="mx-auto w-12 h-12"
              loading="lazy"
              decoding="async"
            />
            <p className="text-sm">{day.weather?.[0]?.description}</p>
            <p className="text-lg font-semibold">
              {day.temp?.day?.toFixed ? day.temp.day.toFixed(0) : Math.round(day.temp.day)} °C
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              🌧 {Math.round((day.pop || 0) * 100)} %
              {day.pop > 0 && day.rain && <> • 💧 {Number(day.rain).toFixed(1)} mm</>}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">🧪 {day.pressure} hPa • 💦 {day.humidity}%</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              🧭 {windDirection(day.wind_deg)} ({day.wind_speed?.toFixed ? day.wind_speed.toFixed(1) : Math.round(day.wind_speed * 10) / 10} m/s)
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">{getMoonDescription(day.moon_phase)}</p>
            {day.aiPrediction?.probability != null && (
              <p className="text-sm text-green-700 dark:text-green-300 font-semibold mt-2">
                🎯 {Number(day.aiPrediction.probability).toFixed(0)} % <FishRating probability={day.aiPrediction.probability} />
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

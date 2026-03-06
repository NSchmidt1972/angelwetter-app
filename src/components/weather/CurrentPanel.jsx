// src/components/weather/CurrentPanel.jsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { owmIconUrl, degToDir, moonPhaseText } from '@/utils/weatherFormat';

function weekdayShortUpper(date) {
  const labels = ['SO', 'MO', 'DI', 'MI', 'DO', 'FR', 'SA'];
  return labels[date.getDay()] || '';
}

function buildWaterHistory(history) {
  if (!Array.isArray(history) || !history.length) return [];
  const points = history
    .map((item) => {
      const value = Number(item?.temperature_c);
      const measuredAt = item?.measured_at ? new Date(item.measured_at) : null;
      if (!Number.isFinite(value) || !measuredAt || Number.isNaN(measuredAt.getTime())) return null;
      return {
        key: `${measuredAt.toISOString()}-${value}`,
        measuredAt,
        temperature: value,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.measuredAt - b.measuredAt);

  const reduced = [];
  let currentDayKey = null;
  let previousTempForDay = null;

  for (const point of points) {
    const dayKey = [
      point.measuredAt.getFullYear(),
      String(point.measuredAt.getMonth() + 1).padStart(2, '0'),
      String(point.measuredAt.getDate()).padStart(2, '0'),
    ].join('-');

    if (dayKey !== currentDayKey) {
      currentDayKey = dayKey;
      previousTempForDay = point.temperature;
      reduced.push(point);
      continue;
    }

    if (Math.abs(point.temperature - previousTempForDay) < 0.0001) continue;
    previousTempForDay = point.temperature;
    reduced.push(point);
  }

  return reduced;
}

function buildWaterStats(history) {
  if (!Array.isArray(history) || !history.length) return null;

  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  let count = 0;

  for (const item of history) {
    const value = Number(item?.temperature_c);
    if (!Number.isFinite(value)) continue;
    min = Math.min(min, value);
    max = Math.max(max, value);
    sum += value;
    count += 1;
  }

  if (!count) return null;
  return { min, max, avg: sum / count };
}

function WaterTempHistoryModal({ open, onClose, historyPoints, stats = null, loading = false }) {
  const chartScrollRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const chart = useMemo(() => {
    if (!historyPoints.length) return null;

    const pointSpacing = 24;
    const width = Math.max(760, Math.min(6000, historyPoints.length * pointSpacing));
    const height = 250;
    const pad = { top: 18, right: 18, bottom: 34, left: 40 };
    const innerWidth = width - pad.left - pad.right;
    const innerHeight = height - pad.top - pad.bottom;

    const values = historyPoints.map((point) => point.temperature);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = Math.max(max - min, 1);
    const tickCount = 4;
    const baselineY = pad.top + innerHeight;

    const points = historyPoints.map((point, index) => {
      const x = historyPoints.length === 1
        ? pad.left + innerWidth / 2
        : pad.left + (index / (historyPoints.length - 1)) * innerWidth;
      const y = pad.top + ((max - point.temperature) / range) * innerHeight;
      return { ...point, x, y };
    });

    const polyline = points.map((point) => `${point.x},${point.y}`).join(' ');
    const areaPath = points.length > 1
      ? `M ${points[0].x} ${baselineY} L ${polyline.replace(/ /g, ' L ')} L ${points[points.length - 1].x} ${baselineY} Z`
      : null;
    const yTicks = Array.from({ length: tickCount + 1 }, (_, idx) => {
      const ratio = idx / tickCount;
      const value = max - ratio * (max - min);
      const y = pad.top + ratio * innerHeight;
      return { value, y };
    });
    const xTicks = [];
    const seenDays = new Set();
    for (const point of points) {
      const key = [
        point.measuredAt.getFullYear(),
        point.measuredAt.getMonth(),
        point.measuredAt.getDate(),
      ].join('-');
      if (seenDays.has(key)) continue;
      seenDays.add(key);
      xTicks.push({
        key,
        x: point.x,
        label: weekdayShortUpper(point.measuredAt),
      });
    }

    return {
      width,
      height,
      points,
      polyline,
      areaPath,
      yTicks,
      xTicks,
      min,
      max,
      baselineY,
    };
  }, [historyPoints]);

  useEffect(() => {
    if (!open || !chart) return undefined;
    const scrollEl = chartScrollRef.current;
    if (!scrollEl) return undefined;
    const maxScrollLeft = Math.max(0, scrollEl.scrollWidth - scrollEl.clientWidth);
    if (maxScrollLeft <= 0) return undefined;

    if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) {
      scrollEl.scrollLeft = maxScrollLeft;
      return undefined;
    }

    let startTime = 0;
    let animateFrameId = 0;
    scrollEl.scrollLeft = 0;

    const animate = (now) => {
      if (!startTime) startTime = now;
      const progress = Math.min((now - startTime) / 700, 1);
      const eased = 1 - ((1 - progress) ** 3);
      scrollEl.scrollLeft = maxScrollLeft * eased;
      if (progress < 1) {
        animateFrameId = window.requestAnimationFrame(animate);
      }
    };

    const startFrameId = window.requestAnimationFrame(() => {
      animateFrameId = window.requestAnimationFrame(animate);
    });

    return () => {
      window.cancelAnimationFrame(startFrameId);
      window.cancelAnimationFrame(animateFrameId);
    };
  }, [open, chart]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-3xl rounded-xl bg-white p-5 shadow-xl dark:bg-gray-800"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Wassertemperatur-Verlauf der letzten 7 Tage"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">🌊 Wassertemperatur-Verlauf</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">Letzte 7 Tage (alle Messpunkte)</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Popup schließen"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 text-base font-semibold leading-none text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            X
          </button>
        </div>

        {loading ? (
          <p className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-900/50 dark:text-gray-200">
            Verlauf wird geladen...
          </p>
        ) : !chart ? (
          <p className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-900/50 dark:text-gray-200">
            Keine Wassertemperaturdaten aus den letzten 7 Tagen verfügbar.
          </p>
        ) : (
          <>
            {stats && (
              <div className="mb-3 flex flex-wrap gap-2 text-xs sm:text-sm">
                <span className="rounded-full border border-cyan-300 bg-cyan-100 px-3 py-1 text-cyan-900 dark:border-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-100">
                  Min: {stats.min.toFixed(1)} °C
                </span>
                <span className="rounded-full border border-cyan-300 bg-cyan-100 px-3 py-1 text-cyan-900 dark:border-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-100">
                  Max: {stats.max.toFixed(1)} °C
                </span>
                <span className="rounded-full border border-cyan-300 bg-cyan-100 px-3 py-1 text-cyan-900 dark:border-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-100">
                  Durchschnitt: {stats.avg.toFixed(1)} °C
                </span>
              </div>
            )}

            <div className="relative rounded-lg border border-cyan-100 bg-cyan-50/40 dark:border-cyan-900/40 dark:bg-cyan-950/20">
              <div
                ref={chartScrollRef}
                className="overflow-x-auto p-3 pb-4"
              >
                <svg
                  viewBox={`0 0 ${chart.width} ${chart.height}`}
                  className="h-64 w-auto min-w-full"
                  style={{ width: `${chart.width}px` }}
                  role="img"
                  aria-label="Liniengrafik der Wassertemperatur"
                >
                  {chart.yTicks.map((tick, idx) => (
                    <g key={`tick-${idx}`}>
                      <line
                        x1="40"
                        x2={chart.width - 18}
                        y1={tick.y}
                        y2={tick.y}
                        stroke="currentColor"
                        className="text-cyan-200/80 dark:text-cyan-800/40"
                      />
                    </g>
                  ))}

                  {chart.areaPath && (
                    <path
                      d={chart.areaPath}
                      className="fill-cyan-300/35 dark:fill-cyan-500/20"
                    />
                  )}
                  <polyline
                    points={chart.polyline}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    className="text-cyan-600 dark:text-cyan-300"
                  />
                  {chart.points.map((point) => (
                    <g key={point.key}>
                      <circle
                        cx={point.x}
                        cy={point.y}
                        r="4"
                        className="fill-cyan-600 dark:fill-cyan-300"
                      />
                    </g>
                  ))}
                  <line
                    x1="40"
                    x2={chart.width - 18}
                    y1={chart.baselineY}
                    y2={chart.baselineY}
                    stroke="currentColor"
                    className="text-cyan-300 dark:text-cyan-700"
                  />
                  {chart.xTicks.map((tick) => (
                    <g key={`x-${tick.key}`}>
                      <line
                        x1={tick.x}
                        x2={tick.x}
                        y1={chart.baselineY}
                        y2={chart.baselineY + 5}
                        stroke="currentColor"
                        className="text-cyan-500 dark:text-cyan-300"
                      />
                      <text
                        x={tick.x}
                        y={chart.baselineY + 18}
                        textAnchor="middle"
                        className="fill-cyan-700 text-[11px] font-semibold dark:fill-cyan-300"
                      >
                        {tick.label}
                      </text>
                    </g>
                  ))}
                </svg>
              </div>
              <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-11 bg-gradient-to-l from-cyan-50/95 to-cyan-50/65 dark:from-cyan-950/90 dark:to-cyan-950/55" />
              <svg
                viewBox={`0 0 40 ${chart.height}`}
                className="pointer-events-none absolute right-0 top-3 z-20 h-64 w-10"
                aria-hidden="true"
              >
                {chart.yTicks.map((tick, idx) => (
                  <text
                    key={`right-tick-${idx}`}
                    x="36"
                    y={tick.y + 4}
                    textAnchor="end"
                    className="fill-cyan-700 text-[11px] dark:fill-cyan-300"
                  >
                    {tick.value.toFixed(1)}
                  </text>
                ))}
              </svg>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function CurrentPanel({
  now,
  daily,
  savedAt,
  waterTemperature,
  waterTemperatureHistory = [],
  waterTemperatureLoading = false,
  showWaterTemperature = false,
}) {
  const [showHistory, setShowHistory] = useState(false);

  const savedAtString = savedAt
    ? new Date(savedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    : '';
  const desc = now.weather[0].description;
  const iconUrl = owmIconUrl(now.weather[0].icon);
  const moonText = moonPhaseText(daily?.[0]?.moon_phase ?? -1);
  const waterTempValueRaw = waterTemperature?.temperature_c
    ?? now?.water_temp
    ?? now?.waterTemp
    ?? now?.water_temperature;
  const waterTempValue = Number(waterTempValueRaw);
  const hasWaterTemp = Number.isFinite(waterTempValue);
  const measuredAtRaw = waterTemperature?.measured_at
    ?? now?.water_temp_measured_at
    ?? now?.waterTempMeasuredAt
    ?? null;
  const measuredAtDate = measuredAtRaw ? new Date(measuredAtRaw) : null;
  const measuredAtString = measuredAtDate && !Number.isNaN(measuredAtDate.getTime())
    ? measuredAtDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    : '';
  const waterTempLabel = hasWaterTemp
    ? `${waterTempValue.toFixed(1)} °C`
    : waterTemperatureLoading
      ? 'lädt...'
      : '—';
  const historyPoints = useMemo(
    () => buildWaterHistory(waterTemperatureHistory),
    [waterTemperatureHistory]
  );
  const historyStats = useMemo(
    () => buildWaterStats(waterTemperatureHistory),
    [waterTemperatureHistory]
  );

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">
          <span className="text-blue-700 dark:text-blue-300">🌤 Aktuelles Wetter</span>
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">{savedAtString} Uhr</p>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 mb-6">
        <img
          src={iconUrl}
          alt={desc}
          className="w-24 h-24 mx-auto sm:mx-0"
          loading="eager"
          fetchPriority="high"
          decoding="async"
        />
        <div className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
          <p className="text-lg font-semibold">{now.temp.toFixed(0)} °C – {desc}</p>
          {showWaterTemperature && (
            <button
              type="button"
              onClick={() => setShowHistory(true)}
              className="w-full rounded-2xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-left text-cyan-900 transition hover:bg-cyan-100 sm:w-fit sm:min-w-[320px] dark:border-cyan-800/70 dark:bg-cyan-950/40 dark:text-cyan-100 dark:hover:bg-cyan-900/40"
            >
              <span className="flex items-center justify-between gap-3">
                <span className="whitespace-nowrap font-semibold">🌊 Wassertemperatur</span>
                <span className="whitespace-nowrap text-base font-semibold">{waterTempLabel}</span>
              </span>
              <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-cyan-700 dark:text-cyan-300">
                {measuredAtString && (
                  <span className="whitespace-nowrap">gemessen {measuredAtString} Uhr</span>
                )}
                <span className="whitespace-nowrap font-semibold">Verlauf 7 Tage</span>
              </span>
            </button>
          )}
          <p>🌅 Sonnenaufgang: {new Date(now.sunrise * 1000).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr</p>
          <p>🌄 Sonnenuntergang: {new Date(now.sunset * 1000).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr</p>
          <p>🧪 Luftdruck: {now.pressure} hPa • 💦 Luftfeuchte: {now.humidity}%</p>
          <p>💨 Wind: {now.wind_speed} m/s aus {degToDir(now.wind_deg)}</p>
          <p>🔆 UV-Index: {now.uvi}</p>
          <p>🌙 Mondphase: {moonText}</p>
        </div>
      </div>

      <WaterTempHistoryModal
        open={showHistory}
        onClose={() => setShowHistory(false)}
        historyPoints={historyPoints}
        stats={historyStats}
        loading={waterTemperatureLoading}
      />
    </>
  );
}

import { useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';
import { getActiveClubId } from '@/utils/clubId';
import { fetchWeather } from '../api/weather';
import PageContainer from '../components/PageContainer';

function windDirection(deg) {
  const dirs = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(deg / 45) % 8];
}

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

const monthNames = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
];

export default function Analysis({ anglerName }) {
  const [fishes, setFishes] = useState([]);
  const [weatherNow, setWeatherNow] = useState(null);
  const [selectedYear, setSelectedYear] = useState(null);
  const [onlyMine, setOnlyMine] = useState(false);

  // NEW: Fisch-Filter nur für Wetterauswertungen
  const [selectedFish, setSelectedFish] = useState('Alle');

  const currentMonthIndex = new Date().getMonth();
  const monthRefs = useRef([]);

  useEffect(() => {
    async function loadData() {
      const clubId = getActiveClubId();
      const { data, error } = await supabase.from('fishes').select('*').eq('club_id', clubId);
      if (error) {
        console.error("Fehler beim Laden der Fänge:", error);
        return;
      }

      const PUBLIC_FROM = new Date('2025-06-01');
      const vertraute = ['Nicol Schmidt', 'Laura Rittlinger'];
      const istVertrauter = vertraute.includes(anglerName);
      const filterSetting = localStorage.getItem('dataFilter') ?? 'recent';

      const filtered = data.filter(f => {
        if (f.is_marilou) return false;

        const fangDatum = new Date(f.timestamp);
        if (!istVertrauter && fangDatum < PUBLIC_FROM) return false;
        if (istVertrauter && filterSetting !== 'all' && fangDatum < PUBLIC_FROM) return false;

        const istEigenerFang = f.angler === anglerName;
        const ort = f.location_name?.toLowerCase().trim() ?? '';
        const ortIstFerkensbruch = f.location_name == null || ort.includes('lobberich');

        return onlyMine ? istEigenerFang : ortIstFerkensbruch;
      });

      setFishes(filtered);
    }

    fetchWeather().then(setWeatherNow);
    loadData();
  }, [anglerName, onlyMine]);

  // Basis: gültige Fänge (für Gesamtauswertungen / Monate immer ALLE Fische)
  const baseValidFishes = fishes.filter(f =>
    !f.blank && f.fish && f.fish.trim().toLowerCase() !== 'unbekannt'
  );

  const totalFishes = baseValidFishes.length;

  const blankSessions = fishes.filter(f => f.blank === true).length;

  const catchSessionKeys = new Set();
  fishes.forEach(f => {
    if (f.blank) return;
    const ts = new Date(f.timestamp);
    if (Number.isNaN(ts.getTime())) return;
    const datePart = ts.toISOString().slice(0, 10);
    const anglerKey = (f.angler || 'Unbekannt').trim() || 'Unbekannt';
    catchSessionKeys.add(`${anglerKey}__${datePart}`);
  });
  const catchSessions = catchSessionKeys.size;

  const totalSessions = blankSessions + catchSessions;
  const blankSessionRatio = totalSessions > 0 ? ((blankSessions / totalSessions) * 100).toFixed(1) : '0.0';

  // Wetter-Fischoptionen
  const fishOptions = Array.from(
    new Set(
      baseValidFishes
        .map(f => f.fish?.trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b, 'de'));

  // Für die Wetter-Statistiken ggf. nach Fisch filtern
  const weatherValidFishes = selectedFish === 'Alle'
    ? baseValidFishes
    : baseValidFishes.filter(f => f.fish?.trim() === selectedFish);

  // Monats-Statistiken (bewusst auf Basis ALLER gültigen Fänge)
  const yearMonthStats = baseValidFishes.reduce((map, f) => {
    const date = new Date(f.timestamp);
    const year = date.getFullYear();
    const month = date.getMonth();
    const type = f.fish.trim();

    if (!map[year]) map[year] = {};
    if (!map[year][month]) map[year][month] = {};
    map[year][month][type] = (map[year][month][type] || 0) + 1;

    return map;
  }, {});

  const sortedYears = Object.keys(yearMonthStats).sort((a, b) => b - a);

  useEffect(() => {
    if (!selectedYear && sortedYears.length > 0) {
      setSelectedYear(sortedYears[0]);
    }
  }, [sortedYears, selectedYear]);

  useEffect(() => {
    if (monthRefs.current[currentMonthIndex]) {
      monthRefs.current[currentMonthIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center'
      });
    }
  }, [selectedYear, currentMonthIndex]);

  const yearTotalStats = selectedYear
    ? Object.values(yearMonthStats[selectedYear] || {}).reduce((acc, monthStat) => {
        Object.entries(monthStat).forEach(([fish, count]) => {
          acc[fish] = (acc[fish] || 0) + count;
        });
        return acc;
      }, {})
    : {};
  const yearTotalCount = Object.values(yearTotalStats).reduce((sum, count) => sum + count, 0);

  // --- Wetter-Statistiken (auf Basis weatherValidFishes) ---
  const statsReducer = (groupFn) => (map, f) => {
    const key = groupFn(f);
    if (!key) return map;
    map[key] = (map[key] || 0) + 1;
    return map;
  };

  const hourStats = weatherValidFishes.reduce(statsReducer(f => {
    const h = new Date(f.timestamp).getHours();
    return `${h.toString().padStart(2, '0')}:00–${(h + 1).toString().padStart(2, '0')}:00`;
  }), {});

  const tempStats = weatherValidFishes.reduce(statsReducer(f => {
    const t = f.weather?.temp;
    return t != null ? `${Math.floor(t / 5) * 5}–${Math.floor(t / 5) * 5 + 5} °C` : null;
  }), {});

  const pressureStats = weatherValidFishes.reduce(statsReducer(f => {
    const p = f.weather?.pressure;
    return p != null ? `${Math.floor(p / 10) * 10}–${Math.floor(p / 10) * 10 + 9} hPa` : null;
  }), {});

  const windStats = weatherValidFishes.reduce(statsReducer(f => {
    const w = f.weather?.wind;
    return w != null ? `${Math.floor(w / 3) * 3}–${Math.floor(w / 3) * 3 + 3} m/s` : null;
  }), {});

  const windDirStats = weatherValidFishes.reduce(statsReducer(f => {
    const deg = f.weather?.wind_deg;
    return deg != null ? windDirection(deg) : null;
  }), {});

  const humidityStats = weatherValidFishes.reduce(statsReducer(f => {
    const h = f.weather?.humidity;
    return h != null ? `${Math.floor(h / 10) * 10}–${Math.floor(h / 10) * 10 + 9} %` : null;
  }), {});

  const descStats = weatherValidFishes.reduce(
    statsReducer(f => f.weather?.description?.toLowerCase().trim() || 'unbekannt'),
    {}
  );

  const moonStats = weatherValidFishes.reduce(statsReducer(f => {
    const phase = f.weather?.moon_phase;
    return phase == null ? 'unbekannt' : getMoonDescription(phase);
  }), {});

  const findMatchingKey = (value, stats) => {
    if (value == null || !stats) return null;
    return Object.keys(stats).find(label => {
      const cleaned = label.replace(/[^<>=0-9–-]/g, '');
      const rangeMatch = label.match(/(-?\d+)\s*[–-]\s*(-?\d+)/);
      if (rangeMatch) {
        const [, min, max] = rangeMatch;
        return value >= parseInt(min) && value <= parseInt(max);
      }
      if (/^<\s*\d+/.test(cleaned)) {
        const limit = parseInt(cleaned.replace('<', ''));
        return value < limit;
      }
      if (/^(≥|>=)\s*\d+/.test(cleaned)) {
        const limit = parseInt(cleaned.replace(/[^\d]/g, ''));
        return value >= limit;
      }
      const numMatch = label.match(/\d+/);
      if (numMatch) {
        const target = parseInt(numMatch[0]);
        return Math.abs(target - value) <= 1;
      }
      return false;
    }) ?? null;
  };

  const nowHour = weatherNow?.current?.dt ? new Date(weatherNow.current.dt * 1000).getHours() : null;
  const nowLabel = nowHour != null ? `${nowHour.toString().padStart(2, '0')}:00–${(nowHour + 1).toString().padStart(2, '0')}:00` : null;

  const activeKeys = {
    time: nowLabel,
    temp: findMatchingKey(weatherNow?.current?.temp, tempStats),
    pressure: findMatchingKey(weatherNow?.current?.pressure, pressureStats),
    wind: findMatchingKey(weatherNow?.current?.wind_speed, windStats),
    windDir: weatherNow?.current?.wind_deg != null ? windDirection(weatherNow.current.wind_deg) : null,
    humidity: findMatchingKey(weatherNow?.current?.humidity, humidityStats),
    description: weatherNow?.current?.weather?.[0]?.description?.toLowerCase().trim() ?? null,
    moon: weatherNow?.daily?.[0]?.moon_phase != null ? getMoonDescription(weatherNow.daily[0].moon_phase) : null
  };

  // Icons passend zur Auswahl
  const descIconMap = {};
  for (const f of weatherValidFishes) {
    const desc = f.weather?.description?.toLowerCase().trim();
    const icon = f.weather?.icon;
    if (desc && icon && !descIconMap[desc]) {
      descIconMap[desc] = icon;
    }
  }

  const renderStatList = (title, stats, activeKey) => (
    <div className="mb-6">
      <h3 className="text-lg font-semibold text-blue-700 dark:text-blue-300 mb-2">{title}</h3>
      <ul className="bg-white dark:bg-gray-800 shadow rounded-lg divide-y divide-gray-200 dark:divide-gray-700">
        {Object.entries(stats).sort((a, b) => b[1] - a[1]).map(([label, count]) => {
          const iconCode = descIconMap[label];
          const iconUrl = iconCode ? `https://openweathermap.org/img/wn/${iconCode}.png` : null;

          return (
            <li
              key={label}
              className={`flex justify-between items-center px-4 py-2 text-sm ${activeKey === label ? 'bg-green-100 dark:bg-green-900 font-bold' : ''}`}
            >
              <div className="flex items-center gap-2">
                {iconUrl && (
                  <img src={iconUrl} alt={label} className="w-6 h-6" />
                )}
                <span>
                  {label} {activeKey === label && <span className="ml-2 text-green-600 dark:text-green-400 text-xs">(Jetzt)</span>}
                </span>
              </div>
              <span className="font-mono text-gray-700 dark:text-gray-300">{count}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );

  return (
    <PageContainer>
      <h2 className="text-3xl font-bold mb-6 text-center text-blue-700 dark:text-blue-300">📊 Statistik & Analyse</h2>

      <div className="flex justify-center items-center gap-4 mb-4 text-sm text-gray-600 dark:text-gray-300">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={onlyMine} onChange={() => setOnlyMine(prev => !prev)} className="accent-blue-600" />
          Nur meine Fänge
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-700 dark:text-gray-300 max-w-xl mx-auto mb-8 bg-white dark:bg-gray-800 rounded-xl p-4 shadow">
        <div className="flex items-center gap-2">
          <span className="text-xl">🐟</span>
          <span>Gesamtanzahl Fische:</span>
          <span className="ml-auto font-bold text-right">{totalFishes}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xl">📅</span>
          <span>Sessions mit Fang:</span>
          <span className="ml-auto font-bold text-right">{catchSessions}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xl">❌</span>
          <span>Schneidersessions:</span>
          <span className="ml-auto font-bold text-right">{blankSessions}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xl">📉</span>
          <span>Schneider-Anteil:</span>
          <span className="ml-auto font-bold text-right">{blankSessionRatio}%</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6 justify-center">
        {sortedYears.map(year => (
          <button
            key={year}
            onClick={() => setSelectedYear(year)}
            className={`px-4 py-1 rounded-full border transition ${year === selectedYear
              ? 'bg-blue-600 text-white font-semibold'
              : 'bg-white dark:bg-gray-800 text-blue-700 dark:text-blue-300 border-blue-400 hover:bg-blue-100 dark:hover:bg-gray-700'
              }`}
          >
            {year}
          </button>
        ))}
      </div>

      {selectedYear && (
        <div className="overflow-x-auto">
          <div className="flex overflow-x-auto space-x-4 pb-2">
            {Object.entries(yearMonthStats[selectedYear] || {})
              .sort(([a], [b]) => a - b)
              .map(([monthIndex, types]) => {
                const i = parseInt(monthIndex);
                return (
                  <div
                    key={monthIndex}
                    ref={(el) => {
                      if (i === currentMonthIndex) monthRefs.current[i] = el;
                    }}
                    className={`min-w-[200px] rounded-lg p-4 text-center flex-shrink-0 shadow transition ${i === currentMonthIndex
                      ? 'border-2 border-blue-500 bg-white dark:bg-gray-800'
                      : 'border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                      }`}
                  >
                    <h3 className="text-base font-bold mb-2 text-gray-800 dark:text-gray-100">{monthNames[i]}</h3>
                    <p className="text-xs italic text-gray-500 dark:text-gray-400 mb-2">
                      (gesamt: {Object.values(types).reduce((sum, c) => sum + c, 0)})
                    </p>

                    <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                      {Object.entries(types)
                        .sort((a, b) => b[1] - a[1])
                        .map(([fish, count]) => (
                          <li key={fish} className="flex justify-between px-2 py-1 text-sm">
                            <span>{fish}</span>
                            <span className="font-mono text-gray-700 dark:text-gray-300">{count}</span>
                          </li>
                        ))}
                    </ul>
                  </div>
                );
              })}
            {yearTotalCount > 0 && (
              <div
                className="min-w-[220px] rounded-lg p-4 text-center flex-shrink-0 shadow border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
              >
                <h3 className="text-base font-bold mb-1 text-gray-800 dark:text-gray-100">Gesamt {selectedYear}</h3>
                <p className="text-xs italic text-gray-500 dark:text-gray-400 mb-2">
                  (gesamt: {yearTotalCount})
                </p>
                <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                  {Object.entries(yearTotalStats)
                    .sort((a, b) => b[1] - a[1])
                    .map(([fish, count]) => (
                      <li key={fish} className="flex justify-between px-2 py-1 text-sm">
                        <span>{fish}</span>
                        <span className="font-mono text-gray-700 dark:text-gray-300">{count}</span>
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- Fisch-Auswahl NUR für Wetterauswertungen --- */}
      <div className="max-w-4xl mx-auto mt-10 mb-4">
        <label className="block text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">
          Wetterauswertungen filtern nach Fisch
        </label>
        <div className="flex items-center gap-3">
          <select
            value={selectedFish}
            onChange={(e) => setSelectedFish(e.target.value)}
            className="w-full md:w-80 px-3 py-2 rounded-lg border border-blue-300 dark:border-blue-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="Alle">Alle</option>
            {fishOptions.map((fo) => (
              <option key={fo} value={fo}>{fo}</option>
            ))}
          </select>
          {selectedFish !== 'Alle' && (
            <button
              onClick={() => setSelectedFish('Alle')}
              className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-sm hover:bg-gray-200 dark:hover:bg-gray-700"
              title="Filter zurücksetzen"
            >
              Zurücksetzen
            </button>
          )}
        </div>
       
      </div>

      {/* --- Wetterstatistiken (gefiltert) --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto mt-6">
        {renderStatList("🌡 Temperaturbereiche",     tempStats,     activeKeys.temp)}
        {renderStatList("🧪 Luftdruck",              pressureStats, activeKeys.pressure)}
        {renderStatList("💨 Windstärken",            windStats,     activeKeys.wind)}
        {renderStatList("🧭 Windrichtungen",         windDirStats,  activeKeys.windDir)}
        {renderStatList("💦 Luftfeuchtigkeit",       humidityStats, activeKeys.humidity)}
        {renderStatList("🌦 Wetterbeschreibung",     descStats,     activeKeys.description)}
        {renderStatList("🌙 Mondphasen",             moonStats,     activeKeys.moon)}
        {renderStatList("⏰ Fangzeiten",             hourStats,     activeKeys.time)}
      </div>
    </PageContainer>
  );
}

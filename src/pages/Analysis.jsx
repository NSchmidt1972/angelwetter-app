// src/pages/Analysis.jsx
import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

function windDirection(deg) {
  const dirs = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(deg / 45) % 8];
}

function getMoonDescription(phase) {
  if (phase === 0 || phase === 1) return '🌑 Neumond';
  if (phase < 0.25) return '🌒 zunehmend';
  if (phase === 0.25) return '🌓 erstes Viertel';
  if (phase < 0.5) return '🌔 zunehmend';
  if (phase === 0.5) return '🌕 Vollmond';
  if (phase < 0.75) return '🌖 abnehmend';
  if (phase === 0.75) return '🌗 letztes Viertel';
  return '🌘 abnehmend';
}

function getMonthName(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('de-DE', { month: 'long' });
}

function getDayOnly(dateStr) {
  return new Date(dateStr).toISOString().split('T')[0];
}

export default function Analysis() {
  const [fishes, setFishes] = useState([]);

  useEffect(() => {
    async function loadData() {
      const { data, error } = await supabase.from('fishes').select('*');
      if (!error) setFishes(data);
    }
    loadData();
  }, []);

  if (fishes.length === 0) {
    return <p className="text-center text-gray-500 mt-6">Keine Fänge zum Auswerten.</p>;
  }

  const isValidFish = f =>
    !f.blank &&
    f.fish &&
    f.fish.trim().toLowerCase() !== 'unbekannt' &&
    f.angler &&
    f.angler.trim().toLowerCase() !== 'unbekannt';

  const validFishes = fishes.filter(isValidFish);

  const fangtage = new Set(
    validFishes.map(f => `${f.angler}__${getDayOnly(f.timestamp)}`)
  );
  const schneidertage = new Set(
    fishes.filter(f => f.blank).map(f => `${f.angler}__${getDayOnly(f.timestamp)}`)
  );

  const statsReducer = (groupFn) => (map, f) => {
    const key = groupFn(f);
    if (!key) return map;
    map[key] = (map[key] || 0) + 1;
    return map;
  };

  const tempStats = validFishes.reduce(statsReducer(f => {
    const t = f.weather?.temp;
    return t != null ? `${Math.floor(t / 5) * 5}–${Math.floor(t / 5) * 5 + 4}°C` : null;
  }), {});

  const pressureStats = validFishes.reduce(statsReducer(f => {
    const p = f.weather?.pressure;
    if (p == null) return null;
    if (p < 1000) return '<1000 hPa';
    if (p < 1015) return '1000–1014 hPa';
    return '≥1015 hPa';
  }), {});

  const windStats = validFishes.reduce(statsReducer(f => {
    const w = f.weather?.wind;
    if (w == null) return null;
    if (w <= 1) return '0–1 m/s';
    if (w <= 3) return '1–3 m/s';
    return '>3 m/s';
  }), {});

  const windDirStats = validFishes.reduce(statsReducer(f => {
    const deg = f.weather?.wind_deg;
    return deg != null ? windDirection(deg) : null;
  }), {});

  const humidityStats = validFishes.reduce(statsReducer(f => {
    const h = f.weather?.humidity;
    if (h == null) return null;
    if (h < 40) return '<40 %';
    if (h < 60) return '40–59 %';
    if (h < 80) return '60–79 %';
    return '≥80 %';
  }), {});

  const descStats = validFishes.reduce(statsReducer(f => f.weather?.description || 'unbekannt'), {});
  const moonStats = validFishes.reduce(statsReducer(f => {
    const phase = f.weather?.moon_phase;
    if (phase == null) return 'unbekannt';
    return getMoonDescription(phase);
  }), {});

  const totalFishCount = validFishes.length;

  const fishTypeStats = validFishes.reduce((map, f) => {
    const type = f.fish.trim();
    map[type] = (map[type] || 0) + 1;
    return map;
  }, {});

  const monthlyStats = validFishes.reduce((map, f) => {
    const month = getMonthName(f.timestamp);
    const type = f.fish.trim();
    if (!map[month]) map[month] = {};
    map[month][type] = (map[month][type] || 0) + 1;
    return map;
  }, {});

  const sortedMonthly = Object.entries(monthlyStats).sort((a, b) =>
    new Date(`1 ${a[0]} 2000`) - new Date(`1 ${b[0]} 2000`)
  );

  const descWithIcon = {};
  validFishes.forEach(f => {
    const desc = f.weather?.description;
    const icon = f.weather?.icon;
    if (desc && icon && !descWithIcon[desc]) {
      descWithIcon[desc] = icon;
    }
  });

  const renderStatList = (title, stats) => (
    <div className="mb-6">
      <h3 className="text-lg font-semibold text-blue-700 mb-2">{title}</h3>
      <ul className="bg-white shadow rounded-lg divide-y divide-gray-200">
        {Object.entries(stats)
          .sort((a, b) => b[1] - a[1])
          .map(([label, count]) => (
            <li key={label} className="flex justify-between px-4 py-2 text-sm">
              {title === "🌦 Wetterbeschreibung" ? (
                <span className="flex items-center gap-2">
                  {descWithIcon[label] && (
                    <img
                      src={`https://openweathermap.org/img/wn/${descWithIcon[label]}@2x.png`}
                      alt={label}
                      className="w-6 h-6"
                    />
                  )}
                  {label}
                </span>
              ) : (
                <span>{label}</span>
              )}
              <span className="font-mono text-gray-700">{count}x</span>
            </li>
          ))}
      </ul>
    </div>
  );

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h2 className="text-3xl font-bold mb-6 text-center text-blue-700">📊 Auswertung Fänge und Wetter</h2>

      <div className="max-w-2xl mx-auto mb-10">
        <p className="text-center text-gray-700 text-lg mb-4">
          Insgesamt <span className="font-bold">{totalFishCount}</span> Fische gefangen.<br />
          Fangtage: <span className="font-bold">{fangtage.size}</span>, Schneidertage: <span className="font-bold">{schneidertage.size}</span> – das sind {((schneidertage.size / (fangtage.size + schneidertage.size)) * 100).toFixed(1)} % Schneidertage
        </p>
        <ul className="bg-white shadow rounded-lg divide-y divide-gray-200">
          {Object.entries(fishTypeStats)
            .sort((a, b) => b[1] - a[1])
            .map(([type, count]) => (
              <li key={type} className="flex justify-between px-4 py-2 text-sm">
                <span>{type}</span>
                <span className="font-mono text-gray-700">{count}x</span>
              </li>
            ))}
        </ul>
      </div>

      <div className="max-w-4xl mx-auto mb-10">
        <h2 className="text-xl font-semibold text-blue-700 mb-4">📅 Monatsstatistik</h2>
        <div className="space-y-6">
          {sortedMonthly.map(([month, types]) => (
            <div key={month} className="bg-white shadow rounded-lg p-4">
              <h3 className="text-md font-bold text-gray-800 mb-2">{month}</h3>
              <ul className="divide-y divide-gray-200">
                {Object.entries(types)
                  .sort((a, b) => b[1] - a[1])
                  .map(([fish, count]) => (
                    <li key={fish} className="flex justify-between px-2 py-1 text-sm">
                      <span>{fish}</span>
                      <span className="font-mono text-gray-700">{count}x</span>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        {renderStatList("🌡 Temperaturbereiche", tempStats)}
        {renderStatList("🧪 Luftdruck", pressureStats)}
        {renderStatList("💨 Windstärken", windStats)}
        {renderStatList("🧭 Windrichtungen", windDirStats)}
        {renderStatList("💦 Luftfeuchtigkeit", humidityStats)}
        {renderStatList("🌦 Wetterbeschreibung", descStats)}
        {renderStatList("🌙 Mondphasen", moonStats)}
      </div>
    </div>
  );
}

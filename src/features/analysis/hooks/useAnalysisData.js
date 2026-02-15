import { useEffect, useState } from 'react';
import { supabase } from '@/supabaseClient';
import { fetchWeather } from '@/api/weather';
import { getActiveClubId } from '@/utils/clubId';
import {
  buildDescIconMap,
  findMatchingKey,
  getMoonDescription,
  windDirection,
} from '@/features/analysis/utils';

export default function useAnalysisData({ anglerName }) {
  const [fishes, setFishes] = useState([]);
  const [weatherNow, setWeatherNow] = useState(null);
  const [selectedYear, setSelectedYear] = useState(null);
  const [onlyMine, setOnlyMine] = useState(false);
  const [selectedFish, setSelectedFish] = useState('Alle');

  useEffect(() => {
    let isActive = true;

    async function loadData() {
      const clubId = getActiveClubId();
      const { data, error } = await supabase.from('fishes').select('*').eq('club_id', clubId);
      if (error) {
        console.error('Fehler beim Laden der Fänge:', error);
        return;
      }

      const PUBLIC_FROM = new Date('2025-06-01');
      const vertraute = ['Nicol Schmidt', 'Laura Rittlinger'];
      const istVertrauter = vertraute.includes(anglerName);
      const filterSetting = localStorage.getItem('dataFilter') ?? 'recent';

      const filtered = data.filter((fishEntry) => {
        if (fishEntry.is_marilou) return false;

        const fangDatum = new Date(fishEntry.timestamp);
        if (!istVertrauter && fangDatum < PUBLIC_FROM) return false;
        if (istVertrauter && filterSetting !== 'all' && fangDatum < PUBLIC_FROM) return false;

        const istEigenerFang = fishEntry.angler === anglerName;
        const ort = fishEntry.location_name?.toLowerCase().trim() ?? '';
        const ortIstFerkensbruch = fishEntry.location_name == null || ort.includes('lobberich');

        return onlyMine ? istEigenerFang : ortIstFerkensbruch;
      });

      if (!isActive) return;
      setFishes(filtered);
    }

    fetchWeather().then((weather) => {
      if (!isActive) return;
      setWeatherNow(weather);
    });
    loadData();

    return () => {
      isActive = false;
    };
  }, [anglerName, onlyMine]);

  const baseValidFishes = fishes.filter(
    (fishEntry) => !fishEntry.blank && fishEntry.fish && fishEntry.fish.trim().toLowerCase() !== 'unbekannt'
  );
  const totalFishes = baseValidFishes.length;

  const blankSessions = fishes.filter((fishEntry) => fishEntry.blank === true).length;

  const catchSessionKeys = new Set();
  fishes.forEach((fishEntry) => {
    if (fishEntry.blank) return;
    const ts = new Date(fishEntry.timestamp);
    if (Number.isNaN(ts.getTime())) return;
    const datePart = ts.toISOString().slice(0, 10);
    const anglerKey = (fishEntry.angler || 'Unbekannt').trim() || 'Unbekannt';
    catchSessionKeys.add(`${anglerKey}__${datePart}`);
  });
  const catchSessions = catchSessionKeys.size;

  const totalSessions = blankSessions + catchSessions;
  const blankSessionRatio = totalSessions > 0 ? ((blankSessions / totalSessions) * 100).toFixed(1) : '0.0';

  const fishOptions = Array.from(
    new Set(
      baseValidFishes
        .map((fishEntry) => fishEntry.fish?.trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b, 'de'));

  const weatherValidFishes = selectedFish === 'Alle'
    ? baseValidFishes
    : baseValidFishes.filter((fishEntry) => fishEntry.fish?.trim() === selectedFish);

  const yearMonthStats = baseValidFishes.reduce((map, fishEntry) => {
    const date = new Date(fishEntry.timestamp);
    const year = date.getFullYear();
    const month = date.getMonth();
    const type = fishEntry.fish.trim();

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

  const yearTotalStats = selectedYear
    ? Object.values(yearMonthStats[selectedYear] || {}).reduce((acc, monthStat) => {
        Object.entries(monthStat).forEach(([fish, count]) => {
          acc[fish] = (acc[fish] || 0) + count;
        });
        return acc;
      }, {})
    : {};
  const yearTotalCount = Object.values(yearTotalStats).reduce((sum, count) => sum + count, 0);

  const statsReducer = (groupFn) => (map, fishEntry) => {
    const key = groupFn(fishEntry);
    if (!key) return map;
    map[key] = (map[key] || 0) + 1;
    return map;
  };

  const hourStats = weatherValidFishes.reduce(
    statsReducer((fishEntry) => {
      const h = new Date(fishEntry.timestamp).getHours();
      return `${h.toString().padStart(2, '0')}:00–${(h + 1).toString().padStart(2, '0')}:00`;
    }),
    {}
  );
  const tempStats = weatherValidFishes.reduce(
    statsReducer((fishEntry) => {
      const t = fishEntry.weather?.temp;
      return t != null ? `${Math.floor(t / 5) * 5}–${Math.floor(t / 5) * 5 + 5} °C` : null;
    }),
    {}
  );
  const pressureStats = weatherValidFishes.reduce(
    statsReducer((fishEntry) => {
      const p = fishEntry.weather?.pressure;
      return p != null ? `${Math.floor(p / 10) * 10}–${Math.floor(p / 10) * 10 + 9} hPa` : null;
    }),
    {}
  );
  const windStats = weatherValidFishes.reduce(
    statsReducer((fishEntry) => {
      const w = fishEntry.weather?.wind;
      return w != null ? `${Math.floor(w / 3) * 3}–${Math.floor(w / 3) * 3 + 3} m/s` : null;
    }),
    {}
  );
  const windDirStats = weatherValidFishes.reduce(
    statsReducer((fishEntry) => {
      const deg = fishEntry.weather?.wind_deg;
      return deg != null ? windDirection(deg) : null;
    }),
    {}
  );
  const humidityStats = weatherValidFishes.reduce(
    statsReducer((fishEntry) => {
      const h = fishEntry.weather?.humidity;
      return h != null ? `${Math.floor(h / 10) * 10}–${Math.floor(h / 10) * 10 + 9} %` : null;
    }),
    {}
  );
  const descStats = weatherValidFishes.reduce(
    statsReducer((fishEntry) => fishEntry.weather?.description?.toLowerCase().trim() || 'unbekannt'),
    {}
  );
  const moonStats = weatherValidFishes.reduce(
    statsReducer((fishEntry) => {
      const phase = fishEntry.weather?.moon_phase;
      return phase == null ? 'unbekannt' : getMoonDescription(phase);
    }),
    {}
  );

  const nowHour = weatherNow?.current?.dt ? new Date(weatherNow.current.dt * 1000).getHours() : null;
  const nowLabel = nowHour != null
    ? `${nowHour.toString().padStart(2, '0')}:00–${(nowHour + 1).toString().padStart(2, '0')}:00`
    : null;

  const activeKeys = {
    time: nowLabel,
    temp: findMatchingKey(weatherNow?.current?.temp, tempStats),
    pressure: findMatchingKey(weatherNow?.current?.pressure, pressureStats),
    wind: findMatchingKey(weatherNow?.current?.wind_speed, windStats),
    windDir: weatherNow?.current?.wind_deg != null ? windDirection(weatherNow.current.wind_deg) : null,
    humidity: findMatchingKey(weatherNow?.current?.humidity, humidityStats),
    description: weatherNow?.current?.weather?.[0]?.description?.toLowerCase().trim() ?? null,
    moon: weatherNow?.daily?.[0]?.moon_phase != null
      ? getMoonDescription(weatherNow.daily[0].moon_phase)
      : null,
  };

  const descIconMap = buildDescIconMap(weatherValidFishes);

  return {
    selectedYear,
    setSelectedYear,
    onlyMine,
    setOnlyMine,
    selectedFish,
    setSelectedFish,
    totalFishes,
    catchSessions,
    blankSessions,
    blankSessionRatio,
    sortedYears,
    yearMonthStats,
    yearTotalStats,
    yearTotalCount,
    fishOptions,
    tempStats,
    pressureStats,
    windStats,
    windDirStats,
    humidityStats,
    descStats,
    moonStats,
    hourStats,
    activeKeys,
    descIconMap,
  };
}

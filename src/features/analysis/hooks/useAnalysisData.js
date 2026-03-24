import { useEffect, useState } from 'react';
import { fetchWeather } from '@/services/weatherService';
import { useAppResumeTick } from '@/hooks/useAppResumeSync';
import { useLocalStorageValue } from '@/hooks/useLocalStorageValue';
import { useClubCoordinates } from '@/hooks/useClubCoordinates';
import {
  ANALYSIS_YEAR_FILTER_ALL,
  buildDescIconMap,
  findMatchingKey,
  getMoonDescription,
  windDirection,
} from '@/features/analysis/utils';
import { isMarilouAngler, isTrustedAngler, isVisibleByDate } from '@/utils/visibilityPolicy';
import { isHomeWaterEntry } from '@/utils/location';
import { isValuableFishEntry } from '@/utils/fishValidation';
import { FISH_SELECT, fetchClubFishesQuery } from '@/services/fishes';

function isFishInYear(fishEntry, year) {
  const ts = fishEntry?.timestamp ? new Date(fishEntry.timestamp) : null;
  if (!ts || Number.isNaN(ts.getTime())) return false;
  return ts.getFullYear() === year;
}

function readWaterTemp(entry) {
  const raw = entry?.weather?.water_temp
    ?? entry?.weather?.water_temperature
    ?? entry?.weather?.waterTemp
    ?? null;
  if (raw == null) return null;
  const normalized = typeof raw === 'string' ? raw.trim() : raw;
  if (normalized === '') return null;
  const value = typeof normalized === 'number' ? normalized : Number(normalized);
  return Number.isFinite(value) ? value : null;
}

export default function useAnalysisData({ anglerName }) {
  const resumeTick = useAppResumeTick({ enabled: true });
  const [filterSetting] = useLocalStorageValue('dataFilter', 'recent');
  const currentYear = new Date().getFullYear();
  const [fishes, setFishes] = useState([]);
  const [weatherNow, setWeatherNow] = useState(null);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [onlyMine, setOnlyMine] = useState(false);
  const [selectedFish, setSelectedFish] = useState('Alle');
  const { clubCoords, reload: reloadClubCoords } = useClubCoordinates({
    timeoutLabel: 'Analysis Club-Koordinaten timeout',
    onError: (error) => {
      console.warn('Analysis: Club-Koordinaten konnten nicht geladen werden:', error?.message || error);
    },
  });

  useEffect(() => {
    void reloadClubCoords();
  }, [reloadClubCoords, resumeTick]);

  useEffect(() => {
    let isActive = true;

    async function loadData() {
      const { data, error } = await fetchClubFishesQuery({ select: FISH_SELECT.ANALYSIS });
      if (error) {
        console.error('Fehler beim Laden der Fänge:', error);
        return;
      }
      const entries = Array.isArray(data) ? data : [];

      const istVertrauter = isTrustedAngler(anglerName);
      const isMarilouViewer = isMarilouAngler(anglerName);

      const filtered = entries.filter((fishEntry) => {
        const isMarilouCatch = fishEntry?.is_marilou || isMarilouAngler(fishEntry?.angler);
        if (isMarilouCatch && !isMarilouViewer) return false;
        if (!isVisibleByDate(fishEntry?.timestamp, { isTrusted: istVertrauter, filterSetting })) return false;

        const istEigenerFang = fishEntry.angler === anglerName;
        const istHeimgewaesser = isHomeWaterEntry(fishEntry, { clubCoords });

        return onlyMine ? istEigenerFang : istHeimgewaesser;
      });

      if (!isActive) return;
      setFishes(filtered);
    }

    fetchWeather()
      .then((weather) => {
        if (!isActive) return;
        setWeatherNow(weather);
      })
      .catch((error) => {
        if (!isActive) return;
        console.warn('Wetter konnte nicht geladen werden:', error?.message || error);
        setWeatherNow(null);
      });
    loadData();

    return () => {
      isActive = false;
    };
  }, [anglerName, clubCoords, filterSetting, onlyMine, resumeTick]);

  const sortedYears = Array.from(
    new Set(
      [currentYear, ...fishes]
        .map((fishEntry) => {
          if (typeof fishEntry === 'number') return fishEntry;
          const date = fishEntry?.timestamp ? new Date(fishEntry.timestamp) : null;
          if (!date || Number.isNaN(date.getTime())) return null;
          return date.getFullYear();
        })
        .filter(Number.isFinite)
    )
  ).sort((a, b) => b - a);

  useEffect(() => {
    if (
      selectedYear !== ANALYSIS_YEAR_FILTER_ALL
      && !sortedYears.includes(Number(selectedYear))
    ) {
      setSelectedYear(currentYear);
    }
  }, [currentYear, sortedYears, selectedYear]);

  const yearScopedFishes = selectedYear === ANALYSIS_YEAR_FILTER_ALL
    ? fishes
    : fishes.filter((fishEntry) => isFishInYear(fishEntry, Number(selectedYear)));

  const baseValidFishes = fishes.filter((fishEntry) => isValuableFishEntry(fishEntry));
  const summaryValidFishes = yearScopedFishes.filter((fishEntry) => isValuableFishEntry(fishEntry));
  const totalFishes = summaryValidFishes.length;

  const blankSessions = yearScopedFishes.filter((fishEntry) => fishEntry.blank === true).length;

  const catchSessionKeys = new Set();
  yearScopedFishes.forEach((fishEntry) => {
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
    if (Number.isNaN(date.getTime())) return map;
    const year = date.getFullYear();
    const month = date.getMonth();
    const type = fishEntry.fish.trim();

    if (!map[year]) map[year] = {};
    if (!map[year][month]) map[year][month] = {};
    map[year][month][type] = (map[year][month][type] || 0) + 1;

    return map;
  }, {});
  const yearTotalStats = selectedYear === ANALYSIS_YEAR_FILTER_ALL
    ? Object.values(yearMonthStats).reduce((acc, months) => {
        Object.values(months || {}).forEach((monthStat) => {
          Object.entries(monthStat || {}).forEach(([fish, count]) => {
            acc[fish] = (acc[fish] || 0) + count;
          });
        });
        return acc;
      }, {})
    : Object.values(yearMonthStats[selectedYear] || {}).reduce((acc, monthStat) => {
        Object.entries(monthStat).forEach(([fish, count]) => {
          acc[fish] = (acc[fish] || 0) + count;
        });
        return acc;
      }, {});
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
  const waterTempStats = weatherValidFishes.reduce(
    statsReducer((fishEntry) => {
      const t = readWaterTemp(fishEntry);
      return t != null ? `${Math.floor(t / 2) * 2}–${Math.floor(t / 2) * 2 + 2} °C` : null;
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
    waterTemp: findMatchingKey(
      readWaterTemp({ weather: weatherNow?.current || null }),
      waterTempStats
    ),
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
    waterTempStats,
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

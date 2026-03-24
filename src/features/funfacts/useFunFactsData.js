/* eslint-disable react-hooks/exhaustive-deps */
import { useMemo } from 'react';
import { useValidFishes } from '../../hooks/useValidFishes';
import { localDayKey, monthKey } from '../../utils/dateUtils';
import {
  extractMoonPhase,
  extractTempC,
  isRainyCatch,
  isSunnyCatch,
  parseWeather,
} from '../../utils/weatherParsing';
import {
  formatDateDE,
  formatTimeDE,
} from '../../utils/formatters';
import {
  MIN_EFFICIENCY_DAYS,
  PREDATOR_SET,
  WEATHER_KEYWORD_SCORES,
  COMFORT_TEMP_C,
  TEMP_TOLERANCE,
  WIND_COMFORT,
} from './constants';
import { getWeatherDescription, normalizePlace, parseLocaleNumber } from './utils';
import { PUBLIC_FROM as DEFAULT_PUBLIC_FROM, TRUSTED_ANGLERS } from '@/constants/visibility';
import { HOME_WATER_LABEL, isHomeWaterEntry } from '@/utils/location';
import { useClubCoordinates } from '@/hooks/useClubCoordinates';

const FEMALE_FIRSTNAMES = new Set(['laura', 'marilou', 'julia']);
const WEEKDAY_LABELS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

function extractCatchYear(timestamp) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;
  return date.getFullYear();
}

function normalizeSelectedYear(value) {
  if (value === 'all') return 'all';
  if (typeof value === 'number' && Number.isInteger(value)) return value;
  if (typeof value === 'string' && /^\d{4}$/.test(value.trim())) return Number(value);
  return 'all';
}

export function useFunFactsData({
  PUBLIC_FROM = DEFAULT_PUBLIC_FROM,
  vertraute = TRUSTED_ANGLERS,
  selectedYear = new Date().getFullYear(),
}) {
  const { fishes, validFishes, loading, loadError } = useValidFishes({ PUBLIC_FROM, vertraute });
  const { clubCoords } = useClubCoordinates({
    timeoutLabel: 'FunFacts Club-Koordinaten timeout',
    listenToClubContextChange: true,
    onError: (error) => {
      console.warn('[useFunFactsData] Club-Koordinaten konnten nicht geladen werden:', error?.message || error);
    },
  });

  const yearFilter = normalizeSelectedYear(selectedYear);

  const availableYears = useMemo(() => {
    const years = new Set();
    (fishes || []).forEach((entry) => {
      const year = extractCatchYear(entry?.timestamp);
      if (Number.isInteger(year)) years.add(year);
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [fishes]);

  const yearFilteredFishes = useMemo(
    () =>
      (fishes || []).filter((entry) => {
        if (yearFilter === 'all') return true;
        return extractCatchYear(entry?.timestamp) === yearFilter;
      }),
    [fishes, yearFilter],
  );

  const yearFilteredValidFishes = useMemo(
    () =>
      (validFishes || []).filter((entry) => {
        if (yearFilter === 'all') return true;
        return extractCatchYear(entry?.timestamp) === yearFilter;
      }),
    [validFishes, yearFilter],
  );

  const homeWaterFishes = useMemo(
    () => yearFilteredValidFishes.filter((f) => isHomeWaterEntry(f, { clubCoords })),
    [yearFilteredValidFishes, clubCoords],
  );

  const homeWaterAllFishes = useMemo(
    () => yearFilteredFishes.filter((f) => isHomeWaterEntry(f, { clubCoords })),
    [yearFilteredFishes, clubCoords],
  );

  const buildStatsFishes = (list) => {
    return (list || []).filter((f) => {
      if (typeof f.count_in_stats === 'boolean') return f.count_in_stats;
      if (f.under_min_size === true || f.out_of_season === true) return false;
      return true;
    });
  };

  const statsFishes = useMemo(
    () => buildStatsFishes(homeWaterFishes),
    [homeWaterFishes],
  );

  const statsFishesAllLocations = useMemo(
    () => buildStatsFishes(yearFilteredValidFishes),
    [yearFilteredValidFishes],
  );

  const mostInOneDay = useMemo(() => {
    const byAnglerDay = {};
    statsFishes.forEach((f) => {
      const key = `${f.angler || 'Unbekannt'}__${localDayKey(new Date(f.timestamp))}`;
      (byAnglerDay[key] ||= []).push(f);
    });

    let bestCount = 0;
    let winners = [];
    Object.entries(byAnglerDay).forEach(([key, entries]) => {
      const count = entries.length;
      if (count > bestCount) {
        bestCount = count;
        winners = [{ key, entries }];
      } else if (count === bestCount) {
        winners.push({ key, entries });
      }
    });

    return {
      count: bestCount,
      items: winners.map(({ key, entries }) => {
        const [angler, day] = key.split('__');
        return {
          angler,
          day,
          examples: entries
            .slice()
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)),
        };
      }),
    };
  }, [statsFishes]);

  const biggest = useMemo(() => {
    if (statsFishes.length === 0) return null;

    let max = -Infinity;
    statsFishes.forEach((f) => {
      const s = parseFloat(f.size);
      if (!Number.isNaN(s) && s > max) max = s;
    });
    const top = statsFishes.filter((f) => parseFloat(f.size) === max);
    return { size: max, items: top };
  }, [statsFishes]);

  const smallest = useMemo(() => {
    if (statsFishes.length === 0) return null;

    let min = Infinity;
    statsFishes.forEach((f) => {
      const s = parseFloat(f.size);
      if (!Number.isNaN(s) && s > 0 && s < min) min = s;
    });
    const bottom = statsFishes.filter((f) => parseFloat(f.size) === min);
    return { size: min, items: bottom };
  }, [statsFishes]);

  const mostInOneHour = useMemo(() => {
    const byAnglerHour = {};
    statsFishes.forEach((f) => {
      const dt = new Date(f.timestamp);
      const hourStart = new Date(
        dt.getFullYear(),
        dt.getMonth(),
        dt.getDate(),
        dt.getHours(),
        0,
        0,
        0,
      );
      const hourKey = `${localDayKey(hourStart)}T${String(hourStart.getHours()).padStart(2, '0')}`;
      const key = `${f.angler || 'Unbekannt'}__${hourKey}`;

      (byAnglerHour[key] ||= { entries: [], hourStart }).entries.push(f);
    });

    let best = 0;
    let winners = [];
    Object.entries(byAnglerHour).forEach(([key, obj]) => {
      const count = obj.entries.length;
      if (count > best) {
        best = count;
        winners = [{ key, entries: obj.entries, hourStart: obj.hourStart }];
      } else if (count === best) {
        winners.push({ key, entries: obj.entries, hourStart: obj.hourStart });
      }
    });

    return {
      count: best,
      items: winners.map(({ key, entries, hourStart }) => {
        const [angler] = key.split('__');
        return {
          angler,
          hourLabel: `${formatDateDE(hourStart)} ${formatTimeDE(hourStart)}`,
          examples: entries
            .slice()
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)),
        };
      }),
    };
  }, [statsFishes]);

  const totalPerAnglerDay = useMemo(() => {
    const map = {};
    statsFishes.forEach((f) => {
      const key = `${f.angler || 'Unbekannt'}__${localDayKey(new Date(f.timestamp))}`;
      map[key] = (map[key] || 0) + 1;
    });
    return map;
  }, [statsFishes]);

  const mostSpeciesInOneDay = useMemo(() => {
    const speciesMap = {};
    statsFishes.forEach((f) => {
      const key = `${f.angler || 'Unbekannt'}__${localDayKey(new Date(f.timestamp))}`;
      const fishType = (f.fish || '').trim();
      if (!fishType) return;
      (speciesMap[key] ||= new Set()).add(fishType);
    });

    let best = 0;
    let winners = [];
    Object.entries(speciesMap).forEach(([key, set]) => {
      const count = set.size;
      if (count > best) {
        best = count;
        winners = [{ key, species: [...set] }];
      } else if (count === best) {
        winners.push({ key, species: [...set] });
      }
    });

    return {
      count: best,
      items: winners.map(({ key, species }) => {
        const [angler, day] = key.split('__');
        const totalThatDay = totalPerAnglerDay[key] || species.length;
        return { angler, day, species: species.sort(), totalThatDay };
      }),
    };
  }, [statsFishes, totalPerAnglerDay]);

  const mostMonsterFishes = useMemo(() => {
    const counts = {};
    statsFishes.forEach((f) => {
      const size = parseFloat(f.size);
      if (!Number.isNaN(size) && size > 80) {
        const who = f.angler || 'Unbekannt';
        counts[who] = (counts[who] || 0) + 1;
      }
    });

    let best = 0;
    let winners = [];
    Object.entries(counts).forEach(([angler, count]) => {
      if (count > best) {
        best = count;
        winners = [{ angler, count }];
      } else if (count === best) {
        winners.push({ angler, count });
      }
    });

    return { count: best, items: winners };
  }, [statsFishes, totalPerAnglerDay]);

  const mostFishesDay = useMemo(() => {
    if (statsFishes.length === 0) return { count: 0, days: [] };

    const byDay = {};
    statsFishes.forEach((f) => {
      const key = localDayKey(new Date(f.timestamp));
      if (!byDay[key]) byDay[key] = { count: 0, anglers: new Set() };
      byDay[key].count += 1;
      byDay[key].anglers.add(f.angler);
    });

    let best = 0;
    let winners = [];
    Object.entries(byDay).forEach(([day, data]) => {
      if (data.count > best) {
        best = data.count;
        winners = [{ day, count: data.count, anglers: Array.from(data.anglers) }];
      } else if (data.count === best) {
        winners.push({ day, count: data.count, anglers: Array.from(data.anglers) });
      }
    });

    return { count: best, days: winners };
  }, [statsFishes]);

  const mostFishesMonth = useMemo(() => {
    if (statsFishes.length === 0) return { count: 0, months: [] };
    const byMonth = {};
    statsFishes.forEach((f) => {
      const key = monthKey(new Date(f.timestamp));
      byMonth[key] = (byMonth[key] || 0) + 1;
    });

    let best = 0;
    let winners = [];
    Object.entries(byMonth).forEach(([m, count]) => {
      if (count > best) {
        best = count;
        winners = [{ month: m, count }];
      } else if (count === best) {
        winners.push({ month: m, count });
      }
    });

    return { count: best, months: winners };
  }, [statsFishes]);

  const mostTopTenFishesMonth = useMemo(() => {
    if (statsFishes.length === 0) {
      return { bestCount: 0, bestMonths: [], ranking: [], topEntries: [], topTen: [] };
    }

    const withSize = statsFishes
      .map((fish) => {
        const rawSize =
          typeof fish.size === 'number'
            ? fish.size
            : parseFloat(String(fish.size ?? '').replace(',', '.'));
        const size = Number.isFinite(rawSize) ? rawSize : null;
        const species = (fish.fish || '').trim() || 'Unbekannt';
        return {
          fish,
          size,
          species,
        };
      })
      .filter((entry) => entry.size != null && entry.size > 0);

    if (withSize.length === 0) {
      return { bestCount: 0, bestMonths: [], ranking: [], topEntries: [], topTen: [] };
    }

    const bySpecies = new Map();
    withSize.forEach((entry) => {
      const list = bySpecies.get(entry.species) || [];
      list.push(entry);
      bySpecies.set(entry.species, list);
    });

    const topEntries = [];
    bySpecies.forEach((list, species) => {
      const sorted = list
        .slice()
        .sort((a, b) => {
          if (b.size !== a.size) return b.size - a.size;
          const timeA = new Date(a.fish.timestamp).getTime();
          const timeB = new Date(b.fish.timestamp).getTime();
          if (Number.isFinite(timeA) && Number.isFinite(timeB)) return timeA - timeB;
          if (Number.isFinite(timeA)) return -1;
          if (Number.isFinite(timeB)) return 1;
          return 0;
        })
        .slice(0, 10);

      sorted.forEach((entry, index) => {
        topEntries.push({
          ...entry,
          species,
          speciesRank: index + 1,
        });
      });
    });

    const monthCounts = new Map();
    topEntries.forEach(({ fish }) => {
      const dt = new Date(fish.timestamp);
      if (Number.isNaN(dt.getTime())) return;
      const key = monthKey(dt);
      monthCounts.set(key, (monthCounts.get(key) || 0) + 1);
    });

    const months = Array.from(monthCounts.entries()).map(([month, count]) => ({ month, count }));
    if (months.length === 0) {
      return { bestCount: 0, bestMonths: [], ranking: [], topEntries, topTen: topEntries };
    }

    const bestCount = Math.max(...months.map((m) => m.count));
    const bestMonths = months
      .filter((m) => m.count === bestCount)
      .sort((a, b) => a.month.localeCompare(b.month));
    const ranking = [...months].sort((a, b) => b.count - a.count || a.month.localeCompare(b.month));

    return { bestCount, bestMonths, ranking, topEntries, topTen: topEntries };
  }, [statsFishes]);

  const topTenAnglers = useMemo(() => {
    const list =
      mostTopTenFishesMonth.topEntries ||
      mostTopTenFishesMonth.topTen ||
      [];
    if (!Array.isArray(list) || list.length === 0) {
      return { ranking: [], top3: [], max: 0, leaders: [] };
    }

    const stats = new Map();
    list.forEach(({ fish, size, species, speciesRank }) => {
      if (!fish) return;
      const rawName = (fish.angler || 'Unbekannt').trim();
      if (!rawName) return;
      const entry = stats.get(rawName) || {
        angler: rawName,
        count: 0,
        positions: [],
        bestSize: -Infinity,
        bestFish: null,
        bestRank: Infinity,
      };
      entry.count += 1;
      entry.positions.push({ species, rank: speciesRank });
      if (typeof size === 'number' && size > entry.bestSize) {
        entry.bestSize = size;
        entry.bestFish = fish;
      }
      if (typeof speciesRank === 'number' && speciesRank < entry.bestRank) {
        entry.bestRank = speciesRank;
      }
      stats.set(rawName, entry);
    });

    const ranking = Array.from(stats.values())
      .map((entry) => ({
        ...entry,
        bestSize: Number.isFinite(entry.bestSize) ? entry.bestSize : null,
        positions: entry.positions
          .slice()
          .sort(
            (a, b) =>
              (a.rank ?? Infinity) - (b.rank ?? Infinity) ||
              a.species.localeCompare(b.species, 'de'),
          ),
      }))
      .sort(
        (a, b) =>
          b.count - a.count ||
          (a.bestRank ?? Infinity) - (b.bestRank ?? Infinity) ||
          (b.bestSize ?? 0) - (a.bestSize ?? 0) ||
          a.angler.localeCompare(b.angler, 'de'),
      );

    const max = ranking.length > 0 ? ranking[0].count : 0;
    const leaders = ranking.filter((entry) => entry.count === max);

    return {
      ranking,
      top3: ranking.slice(0, 3),
      max,
      leaders,
    };
  }, [mostTopTenFishesMonth.topEntries, mostTopTenFishesMonth.topTen]);

  const topMonthsByAvgSize = useMemo(() => {
    if (statsFishes.length === 0) return { items: [] };

    const monthData = new Map();

    statsFishes.forEach((f) => {
      if (f.under_min_size === true) return;

      const dt = new Date(f.timestamp);
      if (Number.isNaN(dt.getTime())) return;

      const size =
        typeof f.size === 'number'
          ? f.size
          : parseFloat(String(f.size ?? '').replace(',', '.'));
      if (!Number.isFinite(size) || size <= 0) return;

      const month = monthKey(dt);
      let entry = monthData.get(month);
      if (!entry) {
        entry = { sum: 0, count: 0, species: new Map() };
        monthData.set(month, entry);
      }

      entry.sum += size;
      entry.count += 1;

      const speciesName = (f.fish || '').trim();
      if (speciesName) {
        const bySpecies = entry.species;
        const speciesEntry = bySpecies.get(speciesName) || { sum: 0, count: 0 };
        speciesEntry.sum += size;
        speciesEntry.count += 1;
        bySpecies.set(speciesName, speciesEntry);
      }
    });

    const items = Array.from(monthData.entries())
      .map(([month, entry]) => {
        const species = Array.from(entry.species.entries())
          .map(([name, info]) => ({
            species: name,
            avgSize: info.count > 0 ? info.sum / info.count : 0,
            count: info.count,
          }))
          .sort((a, b) => b.avgSize - a.avgSize || b.count - a.count || a.species.localeCompare(b.species, 'de'));
        return {
          month,
          avgSize: entry.count > 0 ? entry.sum / entry.count : 0,
          species,
        };
      })
      .sort((a, b) => b.avgSize - a.avgSize || a.month.localeCompare(b.month))
      .slice(0, 3);

    return { items };
  }, [statsFishes]);

  const mostFishesWeekday = useMemo(() => {
    if (statsFishes.length === 0) return { items: [] };

    const counts = Array.from({ length: 7 }, () => 0);
    statsFishes.forEach((f) => {
      const dt = new Date(f.timestamp);
      if (!Number.isNaN(dt.getTime())) counts[dt.getDay()] += 1;
    });

    const max = Math.max(...counts);
    const items = counts
      .map((count, day) => ({
        day,
        count,
        label: WEEKDAY_LABELS[day] ?? `Wochentag ${day}`,
        isBest: count === max,
      }))
      .sort((a, b) => b.count - a.count || a.day - b.day);

    return { items };
  }, [statsFishes]);

  const mostSpeciesInOneHour = useMemo(() => {
    const speciesByKey = {};
    const listByKey = {};
    statsFishes.forEach((f) => {
      const dt = new Date(f.timestamp);
      const hourLabel = `${localDayKey(dt)} ${String(dt.getHours()).padStart(2, '0')}:00`;
      const key = `${f.angler || 'Unbekannt'}__${hourLabel}`;
      const fishType = (f.fish || '').trim();
      if (!fishType) return;
      (speciesByKey[key] ||= new Set()).add(fishType);
      (listByKey[key] ||= []).push(f);
    });

    let best = 0;
    let winners = [];
    Object.entries(speciesByKey).forEach(([key, set]) => {
      const count = set.size;
      if (count > best) {
        best = count;
        winners = [key];
      } else if (count === best) {
        winners.push(key);
      }
    });

    const items = winners.map((key) => {
      const [angler, hourLabel] = key.split('__');
      const species = Array.from(speciesByKey[key]).sort();
      const totalThatHour = (listByKey[key] || []).length;
      const [dayPart, timePart] = hourLabel.split(' ');
      const label = `${formatDateDE(`${dayPart}T00:00:00`)} ${timePart} Uhr`;
      return { angler, hourLabel: label, species, totalThatHour };
    });

    return { count: best, items };
  }, [statsFishes]);

  const mostPlacesAngler = useMemo(() => {
    const placesByAngler = {};
    statsFishesAllLocations.forEach((f) => {
      const who = (f.angler || 'Unbekannt').trim();
      if (!who) return;
      const place = normalizePlace(f, { clubCoords });
      if (!place) return;
      (placesByAngler[who] ||= new Set()).add(place);
    });

    const entries = Object.entries(placesByAngler)
      .map(([angler, set]) => {
        const places = [...set].sort();
        const onlyHomeWater = places.length === 1 && places[0] === HOME_WATER_LABEL;
        if (onlyHomeWater) return null;
        return { angler, places, count: places.length };
      })
      .filter(Boolean);

    if (entries.length === 0) return { count: 0, winners: [], ranking: [] };

    const best = Math.max(...entries.map((e) => e.count));
    const winners = entries.filter((e) => e.count === best);
    const ranking = [...entries].sort((a, b) => b.count - a.count || a.angler.localeCompare(b.angler));

    return { count: best, winners, ranking };
  }, [statsFishesAllLocations, clubCoords]);

  const predatorKing = useMemo(() => {
    const totals = {};
    const perSpecies = {};
    statsFishes.forEach((f) => {
      const type = (f.fish || '').toLowerCase().trim();
      if (!PREDATOR_SET.has(type)) return;
      const size = parseFloat(f.size);
      if (Number.isNaN(size) || size <= 0) return;

      const who = (f.angler || 'Unbekannt').trim();
      totals[who] = (totals[who] || 0) + size;
      const speciesForAngler = (perSpecies[who] ||= {});
      const detail = (speciesForAngler[type] ||= { sum: 0, count: 0 });
      detail.sum += size;
      detail.count += 1;
    });

    const entries = Object.entries(totals).map(([angler, sum]) => ({
      angler,
      sum,
      perSpecies: perSpecies[angler] || {},
    }));
    if (entries.length === 0) return { max: 0, winners: [], ranking: [] };

    entries.sort((a, b) => b.sum - a.sum || a.angler.localeCompare(b.angler));
    const max = entries[0].sum;
    const winners = entries.filter((e) => Math.abs(e.sum - max) < 1e-9);
    return { max, winners, ranking: entries };
  }, [statsFishes]);

  const heaviestFish = useMemo(() => {
    const withWeight = homeWaterAllFishes
      .map((f) => ({ fish: f, weight: parseLocaleNumber(f?.weight) }))
      .filter(({ fish, weight }) => fish?.blank !== true && Number.isFinite(weight) && weight > 0);
    if (withWeight.length === 0) return null;

    let maxW = -Infinity;
    withWeight.forEach(({ weight }) => {
      if (weight > maxW) maxW = weight;
    });

    const items = withWeight
      .filter(({ weight }) => weight === maxW)
      .map(({ fish }) => fish);
    return { weight: maxW, items };
  }, [homeWaterAllFishes]);

  const mostEfficientAngler = useMemo(() => {
    if (homeWaterAllFishes.length === 0) return { max: 0, winners: [], ranking: [] };

    const daysByAngler = {};
    homeWaterAllFishes.forEach((f) => {
      const who = (f.angler || 'Unbekannt').trim();
      if (!who) return;
      (daysByAngler[who] ||= new Set()).add(localDayKey(new Date(f.timestamp)));
    });

    const fishByAngler = {};
    statsFishes.forEach((f) => {
      const who = (f.angler || 'Unbekannt').trim();
      fishByAngler[who] = (fishByAngler[who] || 0) + 1;
    });

    const entries = Object.keys(daysByAngler)
      .map((who) => {
        const days = daysByAngler[who].size;
        const fish = fishByAngler[who] || 0;
        const ratio = days > 0 ? fish / days : 0;
        return { angler: who, ratio, fish, days };
      })
      .filter((e) => e.days >= MIN_EFFICIENCY_DAYS);

    if (entries.length === 0) return { max: 0, winners: [], ranking: [] };
    entries.sort(
      (a, b) =>
        b.ratio - a.ratio ||
        b.fish - a.fish ||
        a.days - b.days ||
        a.angler.localeCompare(b.angler),
    );
    const max = entries[0].ratio;
    const winners = entries.filter((e) => Math.abs(e.ratio - max) < 1e-9);
    return { max, winners, ranking: entries };
  }, [homeWaterAllFishes, statsFishes]);

  const mostRotaugen = useMemo(() => {
    const isRotauge = (name) => {
      const s = (name || '').toLowerCase().trim();
      return (
        s === 'rotauge' ||
        s === 'rotaugen' ||
        s === 'plötze' ||
        s === 'ploetze' ||
        s.includes('rotauge')
      );
    };
    const counts = {};
    statsFishes.forEach((f) => {
      if (!isRotauge(f.fish)) return;
      const who = (f.angler || 'Unbekannt').trim();
      counts[who] = (counts[who] || 0) + 1;
    });

    const entries = Object.entries(counts).map(([angler, count]) => ({ angler, count }));
    if (entries.length === 0) return { max: 0, winners: [], ranking: [] };

    entries.sort((a, b) => b.count - a.count || a.angler.localeCompare(b.angler));
    const max = entries[0].count;
    const winners = entries.filter((e) => e.count === max);
    return { max, winners, ranking: entries };
  }, [statsFishes]);

  const mostAtFullMoon = useMemo(() => {
    const counts = {};
    const isFullMoon = (phase, eps = 0.06) => phase != null && Math.abs(phase - 0.5) <= eps;

    statsFishes.forEach((f) => {
      const phase = extractMoonPhase(f);
      if (!isFullMoon(phase)) return;
      const who = (f.angler || 'Unbekannt').trim();
      counts[who] = (counts[who] || 0) + 1;
    });

    const entries = Object.entries(counts).map(([angler, count]) => ({ angler, count }));
    if (entries.length === 0) return { max: 0, winners: [], ranking: [] };
    entries.sort((a, b) => b.count - a.count || a.angler.localeCompare(b.angler));
    const max = entries[0].count;
    const winners = entries.filter((e) => e.count === max);
    return { max, winners, ranking: entries };
  }, [statsFishes]);

  const mostAtNewMoon = useMemo(() => {
    const counts = {};
    const isNewMoon = (phase, eps = 0.06) =>
      phase != null && (phase <= eps || phase >= 1 - eps);

    statsFishes.forEach((f) => {
      const phase = extractMoonPhase(f);
      if (!isNewMoon(phase)) return;
      const who = (f.angler || 'Unbekannt').trim();
      counts[who] = (counts[who] || 0) + 1;
    });

    const entries = Object.entries(counts).map(([angler, count]) => ({ angler, count }));
    if (entries.length === 0) return { max: 0, winners: [], ranking: [] };
    entries.sort((a, b) => b.count - a.count || a.angler.localeCompare(b.angler));
    const max = entries[0].count;
    const winners = entries.filter((e) => e.count === max);
    return { max, winners, ranking: entries };
  }, [statsFishes]);

  const nightOwls = useMemo(() => {
    if (statsFishes.length === 0) return { winners: [], ranking: [], total: 0 };

    const counts = {};
    const lastMinutes = {};
    const samples = {};

    const toTimeLabel = (mins) =>
      formatTimeDE(new Date(1970, 0, 1, Math.floor(mins / 60), mins % 60));

    statsFishes.forEach((f) => {
      const who = (f.angler || 'Unbekannt').trim();
      if (!who) return;
      const dt = new Date(f.timestamp);
      const h = dt.getHours();
      const isNight = h >= 22 || h < 4;
      if (!isNight) return;
      const mins = h * 60 + dt.getMinutes();
      counts[who] = (counts[who] || 0) + 1;
      if (lastMinutes[who] == null || mins > lastMinutes[who]) {
        lastMinutes[who] = mins;
        samples[who] = f;
      }
    });

    const entries = Object.keys(counts).map((angler) => ({
      angler,
      count: counts[angler],
      lastMinutes: lastMinutes[angler] ?? null,
      lastTimeLabel: lastMinutes[angler] != null ? toTimeLabel(lastMinutes[angler]) : null,
      sample: samples[angler] ?? null,
    }));
    entries.sort(
      (a, b) =>
        b.count - a.count ||
        b.lastMinutes - a.lastMinutes ||
        a.angler.localeCompare(b.angler),
    );

    const winners = entries.length ? entries.filter((e) => e.count === entries[0].count) : [];
    const total = entries.reduce((s, e) => s + e.count, 0);
    return { winners, ranking: entries, total };
  }, [statsFishes]);

  const earlyBird = useMemo(() => {
    if (statsFishes.length === 0)
      return { minMin: null, winners: [], ranking: [], window: { start: '04:00', end: '09:00' } };

    const START_MIN = 4 * 60;
    const END_MIN = 9 * 60;
    const bestByAngler = {};
    const earlyCounts = {};

    statsFishes.forEach((f) => {
      const who = (f.angler || 'Unbekannt').trim();
      if (!who) return;
      const dt = new Date(f.timestamp);
      const minutes = dt.getHours() * 60 + dt.getMinutes();
      if (minutes < START_MIN || minutes >= END_MIN) return;
      if (!bestByAngler[who] || minutes < bestByAngler[who].minutes) {
        bestByAngler[who] = { minutes, entry: f };
      }
      earlyCounts[who] = (earlyCounts[who] || 0) + 1;
    });

    const toTimeLabel = (mins) =>
      formatTimeDE(new Date(1970, 0, 1, Math.floor(mins / 60), mins % 60));

    const entries = Object.entries(bestByAngler).map(([angler, { minutes, entry }]) => ({
      angler,
      minutes,
      timeLabel: toTimeLabel(minutes),
      early: earlyCounts[angler] || 0,
      sample: entry,
    }));
    if (entries.length === 0)
      return { minMin: null, winners: [], ranking: [], window: { start: '04:00', end: '09:00' } };

    entries.sort(
      (a, b) =>
        a.minutes - b.minutes ||
        b.early - a.early ||
        a.angler.localeCompare(b.angler),
    );
    const minMin = entries[0].minutes;
    const winners = entries.filter((e) => e.minutes === minMin);
    return { minMin, winners, ranking: entries, window: { start: '04:00', end: '09:00' } };
  }, [statsFishes]);

  const mostInRain = useMemo(() => {
    const counts = {};
    const examples = {};
    statsFishes.forEach((f) => {
      if (!isRainyCatch(f)) return;
      const who = (f.angler || 'Unbekannt').trim();
      counts[who] = (counts[who] || 0) + 1;
      (examples[who] ||= []).push(f);
    });

    const entries = Object.entries(counts).map(([angler, count]) => ({
      angler,
      count,
      examples: (examples[angler] || [])
        .slice()
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
        .slice(0, 5),
    }));
    if (entries.length === 0) return { max: 0, winners: [], ranking: [] };

    entries.sort((a, b) => b.count - a.count || a.angler.localeCompare(b.angler));
    const max = entries[0].count;
    const winners = entries.filter((e) => e.count === max);
    return { max, winners, ranking: entries };
  }, [statsFishes]);

  const sunshineOnly = useMemo(() => {
    if (statsFishes.length === 0) return { winners: [], ranking: [] };
    const totalBy = {};
    const sunnyBy = {};
    statsFishes.forEach((f) => {
      const who = (f.angler || 'Unbekannt').trim();
      if (!who) return;
      totalBy[who] = (totalBy[who] || 0) + 1;
      if (isSunnyCatch(f)) sunnyBy[who] = (sunnyBy[who] || 0) + 1;
    });

    const entries = Object.keys(totalBy)
      .map((who) => ({
        angler: who,
        total: totalBy[who],
        sunny: sunnyBy[who] || 0,
      }))
      .filter((e) => e.total > 0 && e.sunny === e.total);

    entries.sort((a, b) => b.total - a.total || a.angler.localeCompare(b.angler));
    return { winners: entries, ranking: entries };
  }, [statsFishes]);

  const topThreeSpecies = useMemo(() => {
    const counts = {};
    homeWaterFishes.forEach((f) => {
      const s = (f.fish || '').trim();
      if (!s) return;
      counts[s] = (counts[s] || 0) + 1;
    });

    const entries = Object.entries(counts).map(([species, count]) => ({ species, count }));
    entries.sort((a, b) => b.count - a.count || a.species.localeCompare(b.species));

    const items = entries.slice(0, 3);
    const max = items[0]?.count || 0;
    return { items, max, ranking: entries };
  }, [homeWaterFishes]);

  const averageSizeByAngler = useMemo(() => {
    if (statsFishes.length === 0) return { top3: [], ranking: [] };

    const sums = {};
    const counts = {};
    statsFishes.forEach((f) => {
      const size = parseFloat(f.size);
      if (Number.isNaN(size) || size <= 0) return;
      const who = (f.angler || 'Unbekannt').trim();
      sums[who] = (sums[who] || 0) + size;
      counts[who] = (counts[who] || 0) + 1;
    });

    const entries = Object.keys(sums).map((angler) => {
      const count = counts[angler] || 0;
      const average = count > 0 ? sums[angler] / count : 0;
      return {
        angler,
        avg: average,
        average,
        count,
      };
    });

    entries.sort(
      (a, b) =>
        b.avg - a.avg ||
        b.count - a.count ||
        a.angler.localeCompare(b.angler),
    );

    return { top3: entries.slice(0, 3), ranking: entries };
  }, [statsFishes]);

  const longestBreakBetweenCatchDays = useMemo(() => {
    if (statsFishes.length === 0) return { gap: 0, winners: [], ranking: [] };

    const daysByAngler = {};
    statsFishes.forEach((f) => {
      const who = (f.angler || 'Unbekannt').trim();
      if (!who) return;
      const day = localDayKey(new Date(f.timestamp));
      (daysByAngler[who] ||= new Set()).add(day);
    });

    const entries = Object.entries(daysByAngler).map(([angler, daySet]) => {
      const days = [...daySet].sort();
      if (days.length < 2) {
        return { angler, gap: 0, lastGap: 0, days: daySet.size };
      }

      let maxGap = 0;
      let gapStart = days[0];
      let gapEnd = days[0];
      let lastGap = 0;

      for (let i = 1; i < days.length; i += 1) {
        const prev = new Date(`${days[i - 1]}T00:00:00`);
        const curr = new Date(`${days[i]}T00:00:00`);
        const diff = (curr - prev) / (1000 * 60 * 60 * 24);
        if (diff > maxGap) {
          maxGap = diff;
          gapStart = days[i - 1];
          gapEnd = days[i];
        }
        lastGap = diff;
      }
      return { angler, gap: maxGap, from: gapStart, to: gapEnd, lastGap, days: daySet.size };
    });

    const filtered = entries.filter(Boolean);
    if (filtered.length === 0) return { gap: 0, winners: [], ranking: [] };

    filtered.sort(
      (a, b) =>
        b.gap - a.gap ||
        b.days - a.days ||
        b.lastGap - a.lastGap ||
        a.angler.localeCompare(b.angler),
    );

    const gap = filtered[0].gap;
    const winners = filtered.filter((e) => e.gap === gap);
    return { gap, winners, ranking: filtered };
  }, [statsFishes]);

  const longestCatchStreak = useMemo(() => {
    if (statsFishes.length === 0) return { len: 0, winners: [], ranking: [] };

    const daysByAngler = {};
    statsFishes.forEach((f) => {
      const who = (f.angler || 'Unbekannt').trim();
      if (!who) return;
      const day = localDayKey(new Date(f.timestamp));
      (daysByAngler[who] ||= new Set()).add(day);
    });

    const parseDay = (value) => new Date(`${value}T00:00:00`);

    const entries = Object.entries(daysByAngler).map(([angler, daySet]) => {
      const dayStrings = [...daySet].sort();
      if (dayStrings.length === 0) return null;

      let maxLen = 1;
      let bestStart = dayStrings[0];
      let bestEnd = dayStrings[0];

      let currentLen = 1;
      let currentStart = dayStrings[0];

      for (let i = 1; i < dayStrings.length; i += 1) {
        const prev = parseDay(dayStrings[i - 1]);
        const curr = parseDay(dayStrings[i]);
        const diff = (curr - prev) / (1000 * 60 * 60 * 24);

        if (diff === 1) {
          currentLen += 1;
        } else {
          currentLen = 1;
          currentStart = dayStrings[i];
        }

        if (currentLen > maxLen) {
          maxLen = currentLen;
          bestStart = currentStart;
          bestEnd = dayStrings[i];
        }
      }

      return {
        angler,
        len: maxLen,
        total: dayStrings.length,
        from: bestStart,
        to: bestEnd,
      };
    });

    const filtered = entries.filter(Boolean);
    if (filtered.length === 0) return { len: 0, winners: [], ranking: [] };

    filtered.sort(
      (a, b) =>
        b.len - a.len ||
        b.total - a.total ||
        a.angler.localeCompare(b.angler),
    );

    const len = filtered[0].len;
    const winners = filtered.filter((e) => e.len === len);
    return { len, winners, ranking: filtered };
  }, [statsFishes]);

  const fishPairs = useMemo(() => {
    if (statsFishes.length === 0) return { winners: [], top3: [], lauraNicol: null };

    const sessions = {};
    statsFishes.forEach((f) => {
      const key = `${localDayKey(new Date(f.timestamp))}__${f.lat?.toFixed(3)}_${f.lon?.toFixed(3)}`;
      (sessions[key] ||= []).push(f);
    });

    const pairCounts = {};
    Object.values(sessions).forEach((sessionFishes) => {
      const anglers = [...new Set(sessionFishes.map((f) => f.angler).filter(Boolean))];
      if (anglers.length < 2) return;
      for (let i = 0; i < anglers.length; i++) {
        for (let j = i + 1; j < anglers.length; j++) {
          const a = anglers[i];
          const b = anglers[j];
          const key = [a, b].sort().join(' & ');
          pairCounts[key] = (pairCounts[key] || 0) + sessionFishes.length;
        }
      }
    });

    const sorted = Object.entries(pairCounts)
      .map(([pair, count]) => {
        const [a, b] = pair.split(' & ');
        return { a, b, count };
      })
      .sort((x, y) => y.count - x.count);

    let top3 = sorted.slice(0, 3);
    const lauraNicolKey = ['Laura Rittlinger', 'Nicol Schmidt'].sort().join(' & ');
    const lauraNicol = sorted.find((p) => [p.a, p.b].sort().join(' & ') === lauraNicolKey);
    if (lauraNicol && !top3.some((p) => [p.a, p.b].sort().join(' & ') === lauraNicolKey)) {
      top3 = [...top3, lauraNicol];
    }

    return {
      winners: sorted.length > 0 ? [sorted[0]] : [],
      top3,
      lauraNicol,
    };
  }, [statsFishes]);

  const zanderQueen = useMemo(() => {
    const onlyZander = statsFishes
      .map((f) => ({ f, size: typeof f.size === 'number' ? f.size : parseFloat(f.size) }))
      .filter(
        (x) => x.f.fish?.trim().toLowerCase() === 'zander' && !Number.isNaN(x.size) && x.size > 0,
      );

    if (onlyZander.length === 0) return { winners: [], maxSize: null };

    const maxSize = Math.max(...onlyZander.map((x) => x.size));
    const winners = onlyZander
      .filter((x) => Math.abs(x.size - maxSize) < 1e-6)
      .map((x) => ({
        angler: (x.f.angler || 'Unbekannt').trim() || 'Unbekannt',
        fish: x.f,
        size: x.size,
      }))
      .sort((a, b) => a.angler.localeCompare(b.angler, 'de'));

    return { winners, maxSize };
  }, [statsFishes]);

  const pikeMaster = useMemo(() => {
    const onlyPike = statsFishes
      .map((f) => ({
        f,
        size: typeof f.size === 'number' ? f.size : parseFloat(f.size),
        fishName: (f.fish || '').trim().toLowerCase(),
      }))
      .filter(
        (x) =>
          (x.fishName === 'hecht' || x.fishName.includes('hecht')) &&
          !Number.isNaN(x.size) &&
          x.size > 0,
      );

    if (onlyPike.length === 0) return { winners: [], maxSize: null };

    const maxSize = Math.max(...onlyPike.map((x) => x.size));
    const winners = onlyPike
      .filter((x) => Math.abs(x.size - maxSize) < 1e-6)
      .map((x) => ({
        angler: (x.f.angler || 'Unbekannt').trim() || 'Unbekannt',
        fish: x.f,
        size: x.size,
      }))
      .sort((a, b) => a.angler.localeCompare(b.angler, 'de'));

    return { winners, maxSize };
  }, [statsFishes]);

  const eelWizard = useMemo(() => {
    const onlyEels = statsFishes.filter((f) => f.fish?.trim().toLowerCase() === 'aal');
    if (onlyEels.length === 0) return null;

    const byAngler = {};
    onlyEels.forEach((f) => {
      const who = (f.angler || 'Unbekannt').trim();
      const entry = (byAngler[who] ||= { count: 0, sizeSum: 0, sizeCount: 0, maxSize: null });

      entry.count += 1;

      const size = parseFloat(f.size);
      if (!Number.isNaN(size) && size > 0) {
        entry.sizeSum += size;
        entry.sizeCount += 1;
        entry.maxSize = entry.maxSize === null ? size : Math.max(entry.maxSize, size);
      }
    });

    const sorted = Object.entries(byAngler)
      .map(([angler, data]) => {
        const averageSize = data.sizeCount > 0 ? data.sizeSum / data.sizeCount : null;
        return {
          angler,
          count: data.count,
          averageSize,
          averageSizeRounded: averageSize !== null ? Math.round(averageSize) : null,
          sizeCount: data.sizeCount,
          maxSize: data.maxSize,
        };
      })
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        if ((b.averageSize ?? 0) !== (a.averageSize ?? 0)) {
          return (b.averageSize ?? 0) - (a.averageSize ?? 0);
        }
        return a.angler.localeCompare(b.angler);
      });

    return sorted.length > 0 ? sorted[0] : null;
  }, [statsFishes]);

  const grundelChampion = useMemo(() => {
    const onlyGrundeln = homeWaterFishes.filter((f) => f.fish?.trim().toLowerCase() === 'grundel');
    if (onlyGrundeln.length === 0) return null;

    const byAngler = {};
    onlyGrundeln.forEach((f) => {
      const who = (f.angler || 'Unbekannt').trim();
      byAngler[who] = (byAngler[who] || 0) + 1;
    });

    const sorted = Object.entries(byAngler)
      .map(([angler, count]) => ({ angler, count }))
      .sort((a, b) => b.count - a.count);

    return sorted[0];
  }, [homeWaterFishes]);

  const foreignAnglers = useMemo(() => {
    if (yearFilteredValidFishes.length === 0) return { top3: [] };

    const byAngler = {};
    for (const f of yearFilteredValidFishes) {
      if (isHomeWaterEntry(f, { clubCoords })) continue;

      const normalizedPlace = normalizePlace(f, { clubCoords });

      const locRaw = (f.location_name || '').trim();
      const loc = locRaw || normalizedPlace;
      if (!loc) continue;

      const who = (f.angler || 'Unbekannt').trim();
      if (!byAngler[who]) {
        byAngler[who] = { total: 0, byFish: {}, byLocation: {} };
      }
      byAngler[who].total += 1;

      const species = f.fish || 'Unbekannt';
      byAngler[who].byFish[species] = (byAngler[who].byFish[species] || 0) + 1;
      byAngler[who].byLocation[loc] = (byAngler[who].byLocation[loc] || 0) + 1;
    }

    const ranking = Object.entries(byAngler)
      .map(([angler, stats]) => ({ angler, ...stats }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 3);

    return { top3: ranking };
  }, [yearFilteredValidFishes, clubCoords]);

  const schneiderKoenig = useMemo(() => {
    const counts = {};
    homeWaterAllFishes.forEach((f) => {
      if (f.blank) {
        const who = (f.angler || 'Unbekannt').trim();
        counts[who] = (counts[who] || 0) + 1;
      }
    });

    const entries = Object.entries(counts).map(([angler, count]) => ({ angler, count }));
    if (entries.length === 0) return { max: 0, winners: [], ranking: [] };

    entries.sort((a, b) => b.count - a.count || a.angler.localeCompare(b.angler));
    const max = entries[0].count;
    const winners = entries.filter((e) => e.count === max);
    return { max, winners, ranking: entries };
  }, [homeWaterAllFishes]);

  const worstBlankMonth = useMemo(() => {
    if (homeWaterAllFishes.length === 0) return { max: 0, winners: [], ranking: [] };

    const byMonth = {};
    const seenSessions = new Set();
    for (const f of homeWaterAllFishes) {
      if (!f.blank) continue;
      const dt = new Date(f.timestamp);
      if (Number.isNaN(dt.getTime())) continue;

      const month = monthKey(dt);
      const day = localDayKey(dt);
      const angler = (f.angler || 'Unbekannt').trim() || 'Unbekannt';
      const sessionKey = `${month}__${angler}__${day}`;
      if (seenSessions.has(sessionKey)) continue;
      seenSessions.add(sessionKey);

      byMonth[month] = (byMonth[month] || 0) + 1;
    }

    const entries = Object.entries(byMonth).map(([month, count]) => ({ month, count }));
    if (entries.length === 0) return { max: 0, winners: [], ranking: [] };

    entries.sort((a, b) => b.count - a.count || a.month.localeCompare(b.month));
    const max = entries[0].count;
    const winners = entries.filter((e) => e.count === max);
    const ranking = entries;
    return { max, winners, ranking };
  }, [homeWaterAllFishes]);

  const hottestCatch = useMemo(() => {
    const withTemp = homeWaterFishes
      .map((f) => ({ f, t: extractTempC(f), size: parseFloat(f.size) }))
      .filter((x) => x.t != null && !Number.isNaN(x.size) && x.size > 0);

    if (withTemp.length === 0) return null;

    const maxT = Math.max(...withTemp.map((x) => x.t));
    const atMaxT = withTemp.filter((x) => Math.abs(x.t - maxT) < 1e-9);
    const maxSize = Math.max(...atMaxT.map((x) => x.size));
    const winners = atMaxT.filter((x) => Math.abs(x.size - maxSize) < 1e-9).map((x) => x.f);

    return { tempC: maxT, size: maxSize, items: winners };
  }, [homeWaterFishes]);

  const frostCatch = useMemo(() => {
    const withTemp = homeWaterFishes
      .map((f) => ({ f, t: extractTempC(f), size: parseFloat(f.size) }))
      .filter((x) => x.t != null);

    if (withTemp.length === 0) return null;

    const minT = Math.min(...withTemp.map((x) => x.t));
    const items = withTemp
      .filter((x) => Math.abs(x.t - minT) < 1e-9)
      .sort((a, b) => {
        const sizeA = Number.isFinite(a.size) ? a.size : -Infinity;
        const sizeB = Number.isFinite(b.size) ? b.size : -Infinity;
        if (sizeB !== sizeA) return sizeB - sizeA;
        const timeA = new Date(a.f.timestamp).getTime();
        const timeB = new Date(b.f.timestamp).getTime();
        if (Number.isFinite(timeA) && Number.isFinite(timeB)) return timeA - timeB;
        return 0;
      })
      .map((x) => x.f);

    return { tempC: minT, items };
  }, [homeWaterFishes]);

  const extremeWeatherCatch = useMemo(() => {
    if (homeWaterFishes.length === 0) return null;

    const entries = homeWaterFishes
      .map((f) => {
        const parsed = parseWeather(f) || {};
        const { textLower = '', tempC = null, rainMm = null, windSpeed = null, windGust = null } = parsed;
        let score = 0;
        const highlights = [];
        const seen = new Set();
        const addHighlight = (label) => {
          if (label && !seen.has(label)) {
            seen.add(label);
            highlights.push(label);
          }
        };

        if (typeof tempC === 'number') {
          const delta = Math.abs(tempC - COMFORT_TEMP_C);
          const effective = Math.max(0, delta - TEMP_TOLERANCE);
          if (effective >= 0.5) {
            score += effective * 1.4;
            addHighlight(`${tempC >= COMFORT_TEMP_C ? 'Hitze' : 'Kälte'}: ${tempC.toFixed(1)}°C`);
          }
          if (tempC <= 0) {
            score += 3;
            addHighlight('Frost');
          } else if (tempC >= 30) {
            score += 3;
            addHighlight('Brütende Wärme');
          }
        }

        if (typeof rainMm === 'number') {
          const rainScore = rainMm * 3;
          if (rainScore > 0) {
            score += rainScore;
            addHighlight(`${rainMm >= 10 ? 'Wolkenbruch' : 'Regen'}: ${rainMm.toFixed(1)} mm`);
          }
        } else if (isRainyCatch(f)) {
          score += 5;
          addHighlight('Regen laut Beschreibung');
        }

        if (typeof windSpeed === 'number') {
          const over = Math.max(0, windSpeed - WIND_COMFORT);
          if (over > 0.1) {
            score += over * 2.5;
            addHighlight(`Wind: ${windSpeed.toFixed(1)} m/s`);
          }
        }

        if (typeof windGust === 'number') {
          const ref = typeof windSpeed === 'number' ? Math.max(windSpeed, WIND_COMFORT) : WIND_COMFORT;
          const overGust = Math.max(0, windGust - ref);
          if (overGust > 0.1) {
            score += overGust * 1.7;
            addHighlight(`Böen: ${windGust.toFixed(1)} m/s`);
          }
        }

        if (textLower) {
          WEATHER_KEYWORD_SCORES.forEach(({ regex, score: bonus, label }) => {
            if (regex.test(textLower)) {
              score += bonus;
              addHighlight(label);
            }
          });
        }

        if (highlights.length === 0 || score <= 0) return null;

        const weatherDesc = getWeatherDescription(f, textLower);
        return {
          fish: f,
          score,
          highlights,
          weatherDesc,
        };
      })
      .filter(Boolean);

    if (entries.length === 0) return null;

    const ranking = entries.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const timeA = new Date(a.fish.timestamp).getTime();
      const timeB = new Date(b.fish.timestamp).getTime();
      if (!Number.isNaN(timeA) && !Number.isNaN(timeB)) return timeA - timeB;
      return 0;
    });

    const bestScore = ranking[0].score;
    const winners = ranking.filter((entry) => Math.abs(entry.score - bestScore) < 1e-6);

    return {
      bestScore,
      ranking,
      winners,
    };
  }, [homeWaterFishes]);

  const activitySummary = useMemo(() => {
    if (homeWaterAllFishes.length === 0) {
      return {
        catchSessions: 0,
        blankSessions: 0,
        totalCatchCount: 0,
        blankShare: 0,
        avgCatchesPerCatchDay: 0,
      };
    }

    const cutoff = PUBLIC_FROM ? new Date(PUBLIC_FROM).getTime() : null;
    const catchSessionsSet = new Set();
    const blankSessionsSet = new Set();
    let totalCatchCount = 0;

    homeWaterAllFishes.forEach((entry) => {
      const ts = entry?.timestamp ? new Date(entry.timestamp) : null;
      const timeOk = ts && !Number.isNaN(ts.getTime()) && (cutoff == null || ts.getTime() >= cutoff);
      if (!timeOk) return;

      const dateKey = ts.toISOString().slice(0, 10);
      const anglerKey = (entry?.angler || 'Unbekannt').trim() || 'Unbekannt';
      const fishName = entry?.fish ? String(entry.fish).trim() : '';
      const isBlank = entry?.blank === true;
      const hasFish = fishName && fishName.toLowerCase() !== 'unbekannt' && entry.blank !== true;

      if (isBlank) {
        blankSessionsSet.add(`${anglerKey}__${dateKey}`);
        return;
      }

      if (!hasFish) return;
      totalCatchCount += 1;
      catchSessionsSet.add(`${anglerKey}__${dateKey}`);
    });

    const catchSessions = catchSessionsSet.size;
    const blankSessions = blankSessionsSet.size;
    const totalSessions = catchSessions + blankSessions;
    const blankShare = totalSessions > 0 ? blankSessions / totalSessions : 0;
    const avgCatchesPerCatchDay = catchSessions > 0 ? totalCatchCount / catchSessions : 0;

    return {
      catchSessions,
      blankSessions,
      totalCatchCount,
      blankShare,
      avgCatchesPerCatchDay,
    };
  }, [homeWaterAllFishes, PUBLIC_FROM]);

  const avgPerAnglerDayByMonth = useMemo(() => {
    if (statsFishes.length === 0) {
      return { months: [], maxAvg: 0 };
    }

    const perMonth = new Map();
    statsFishes.forEach((f) => {
      const timestamp = new Date(f.timestamp);
      if (Number.isNaN(timestamp.getTime())) return;

      const month = monthKey(timestamp);
      const dayKey = localDayKey(timestamp);
      const angler = (f.angler || 'Unbekannt').trim() || 'Unbekannt';
      const key = `${angler}|${dayKey}`;

      const dayCounts = perMonth.get(month) || new Map();
      dayCounts.set(key, (dayCounts.get(key) || 0) + 1);
      perMonth.set(month, dayCounts);
    });

    const months = Array.from(perMonth.entries())
      .map(([month, counts]) => {
        let totalFishes = 0;
        counts.forEach((cnt) => {
          totalFishes += cnt;
        });
        const totalAnglerDays = counts.size;
        const avg = totalAnglerDays ? totalFishes / totalAnglerDays : 0;
        return { month, avg, totalAnglerDays, totalFishes };
      })
      .sort((a, b) => a.month.localeCompare(b.month));

    const maxAvg = months.reduce((max, entry) => Math.max(max, entry.avg), 0);

    return { months, maxAvg };
  }, [statsFishes]);

  const angelQueen = useMemo(() => {
    if (statsFishes.length === 0) return { winners: [], ranking: [] };

    const strip = (s) =>
      (s || '')
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .trim();

    const counts = {};
    statsFishes.forEach((f) => {
      const who = (f.angler || 'Unbekannt').trim();
      if (!who) return;
      const first = strip(who).split(/\s+/)[0];
      const key = first.toLowerCase();
      if (!FEMALE_FIRSTNAMES.has(key)) return;

      if (!counts[key]) counts[key] = { label: first, count: 0 };
      counts[key].count += 1;
    });

    const ranking = Object.values(counts).sort(
      (a, b) => b.count - a.count || a.label.localeCompare(b.label, 'de'),
    );

    if (ranking.length === 0) return { winners: [], ranking: [] };

    const best = ranking[0].count;
    const winners = ranking.filter((e) => e.count === best);

    return {
      winners: winners.map((e) => ({ angler: e.label, total: e.count })),
      ranking: ranking.map((e) => ({ angler: e.label, total: e.count })),
    };
  }, [statsFishes]);

  const photoArtist = useMemo(() => {
    if (statsFishes.length === 0) return { winners: [], ranking: [] };

    const counts = {};
    statsFishes.forEach((f) => {
      const who = (f.angler || 'Unbekannt').trim();
      const hasPhoto = typeof f.photo_url === 'string' && f.photo_url.trim().length > 0;
      if (!who || !hasPhoto) return;
      if (!counts[who]) counts[who] = { angler: who, total: 0 };
      counts[who].total += 1;
    });

    const ranking = Object.values(counts).sort(
      (a, b) => b.total - a.total || a.angler.localeCompare(b.angler, 'de'),
    );
    if (ranking.length === 0) return { winners: [], ranking: [] };

    const best = ranking[0].total;
    const winners = ranking.filter((e) => e.total === best);

    return { winners, ranking };
  }, [statsFishes]);

  const recordHunter = useMemo(() => {
    if (statsFishes.length === 0) return { winners: [], ranking: [] };

    const bySpecies = {};
    statsFishes.forEach((f) => {
      const species = (f.fish || '').trim();
      const who = (f.angler || 'Unbekannt').trim();
      const size =
        typeof f.size === 'number' ? f.size : parseFloat(String(f.size || '').replace(',', '.'));
      if (!species || !who || !Number.isFinite(size)) return;

      if (!bySpecies[species]) {
        bySpecies[species] = { max: size, holders: new Set([who]) };
      } else {
        if (size > bySpecies[species].max) {
          bySpecies[species].max = size;
          bySpecies[species].holders = new Set([who]);
        } else if (size === bySpecies[species].max) {
          bySpecies[species].holders.add(who);
        }
      }
    });

    const counts = {};
    Object.entries(bySpecies).forEach(([species, info]) => {
      const max = info.max;
      info.holders.forEach((who) => {
        if (!counts[who]) counts[who] = { angler: who, total: 0, totalLength: 0, species: [] };
        counts[who].total += 1;
        counts[who].totalLength += max;
        counts[who].species.push({ name: species, max });
      });
    });

    const ranking = Object.values(counts).sort(
      (a, b) =>
        b.total - a.total ||
        b.totalLength - a.totalLength ||
        a.angler.localeCompare(b.angler, 'de'),
    );
    if (ranking.length === 0) return { winners: [], ranking: [] };

    const best = ranking[0].total;
    const winners = ranking.filter((e) => e.total === best);

    return { winners, ranking };
  }, [statsFishes]);

  const funCardChampion = useMemo(() => {
    const counts = new Map();
    const add = (name, weight = 1) => {
      const trimmed = (name || '').trim();
      if (!trimmed) return;
      if (/^unbekannt$/i.test(trimmed)) return;
      counts.set(trimmed, (counts.get(trimmed) || 0) + weight);
    };
    const addList = (list, selector) => {
      if (!Array.isArray(list)) return;
      list.forEach((item) => {
        const val = selector ? selector(item) : item;
        if (Array.isArray(val)) val.forEach((v) => add(v));
        else add(val);
      });
    };

    addList(mostInOneDay.items, (item) => item?.angler);
    addList(biggest?.items, (item) => item?.angler);
    addList(smallest?.items, (item) => item?.angler);
    addList(mostInOneHour.items, (item) => item?.angler);
    addList(mostSpeciesInOneDay.items, (item) => item?.angler);
    addList(mostMonsterFishes.items, (item) => item?.angler);
    addList(mostFishesDay.days, (item) => item?.anglers);
    addList(mostFishesMonth.months, () => null);
    addList(mostTopTenFishesMonth.topTen, (item) => item?.fish?.angler);
    addList(topTenAnglers.top3, (item) => item?.angler);
    addList(topTenAnglers.leaders, (item) => item?.angler);
    addList(topMonthsByAvgSize.items, () => null);
    addList(mostFishesWeekday.items, () => null);
    addList(mostSpeciesInOneHour.items, (item) => item?.angler);
    addList(mostPlacesAngler.winners, (item) => item?.angler);
    addList(predatorKing.winners, (item) => item?.angler);
    addList(heaviestFish?.items, (item) => item?.angler);
    addList(mostEfficientAngler.winners, (item) => item?.angler);
    addList(mostRotaugen.winners, (item) => item?.angler);
    addList(pikeMaster.winners, (item) => item?.angler);
    addList(mostAtFullMoon.winners, (item) => item?.angler);
    addList(mostAtNewMoon.winners, (item) => item?.angler);
    addList(nightOwls.winners, (item) => item?.angler);
    addList(earlyBird.winners, (item) => item?.angler);
    addList(mostInRain.winners, (item) => item?.angler);
    addList(sunshineOnly.winners, (item) => item?.angler);
    addList(topThreeSpecies.items, () => null);
    addList(averageSizeByAngler.ranking.slice(0, 3), (item) => item?.angler);
    addList(longestBreakBetweenCatchDays.winners, (item) => item?.angler);
    addList(longestCatchStreak.winners, (item) => item?.angler);
    addList(fishPairs.winners, (item) => [item?.a, item?.b]);
    addList(fishPairs.top3, (item) => [item?.a, item?.b]);
    addList(zanderQueen.winners, (item) => item?.angler);
    addList(eelWizard ? [eelWizard] : [], (item) => item?.angler);
    addList(grundelChampion ? [grundelChampion] : [], (item) => item?.angler);
    addList(foreignAnglers.top3, (item) => item?.angler);
    addList(schneiderKoenig.winners, (item) => item?.angler);
    addList(worstBlankMonth.winners, () => null);
    addList(hottestCatch?.items, (item) => item?.angler);
    addList(frostCatch?.items, (item) => item?.angler);
    addList(extremeWeatherCatch?.ranking?.slice(0, 3), (item) => item?.fish?.angler);
    addList(angelQueen.winners, (item) => item?.angler);
    addList(photoArtist.winners, (item) => item?.angler);
    addList(recordHunter.winners, (item) => item?.angler);

    const ranking = Array.from(counts.entries())
      .map(([angler, count]) => ({ angler, count }))
      .sort((a, b) => b.count - a.count || a.angler.localeCompare(b.angler));

    const totalMentions = ranking.reduce((sum, entry) => sum + entry.count, 0);
    const max = ranking.length > 0 ? ranking[0].count : 0;

    return {
      ranking,
      top3: ranking.slice(0, 3),
      totalMentions,
      max,
    };
  }, [
    mostInOneDay,
    biggest,
    smallest,
    mostInOneHour,
    mostSpeciesInOneDay,
    mostMonsterFishes,
    mostFishesDay,
    mostFishesMonth,
    mostTopTenFishesMonth,
    topTenAnglers,
    topMonthsByAvgSize,
    mostFishesWeekday,
    mostSpeciesInOneHour,
    mostPlacesAngler,
    predatorKing,
    heaviestFish,
    mostEfficientAngler,
    mostRotaugen,
    pikeMaster,
    mostAtFullMoon,
    mostAtNewMoon,
    nightOwls,
    earlyBird,
    mostInRain,
    sunshineOnly,
    topThreeSpecies,
    averageSizeByAngler,
    longestBreakBetweenCatchDays,
    longestCatchStreak,
    fishPairs,
    zanderQueen,
    eelWizard,
    grundelChampion,
    foreignAnglers,
    schneiderKoenig,
    worstBlankMonth,
    hottestCatch,
    frostCatch,
    extremeWeatherCatch,
    activitySummary,
    avgPerAnglerDayByMonth,
    angelQueen,
    photoArtist,
    recordHunter,
  ]);

  return {
    fishes,
    validFishes,
    homeWaterFishes,
    homeWaterAllFishes,
    statsFishes,
    yearFilter,
    availableYears,
    loading,
    loadError,
    mostInOneDay,
    biggest,
    smallest,
    mostInOneHour,
    mostSpeciesInOneDay,
    mostMonsterFishes,
    mostFishesDay,
    mostFishesMonth,
    mostTopTenFishesMonth,
    topTenAnglers,
    topMonthsByAvgSize,
    mostFishesWeekday,
    mostSpeciesInOneHour,
    mostPlacesAngler,
    predatorKing,
    heaviestFish,
    mostEfficientAngler,
    mostRotaugen,
    mostAtFullMoon,
    mostAtNewMoon,
    nightOwls,
    earlyBird,
    mostInRain,
    sunshineOnly,
    topThreeSpecies,
    averageSizeByAngler,
    longestBreakBetweenCatchDays,
    longestCatchStreak,
    fishPairs,
    zanderQueen,
    pikeMaster,
    eelWizard,
    grundelChampion,
    foreignAnglers,
    schneiderKoenig,
    worstBlankMonth,
    hottestCatch,
    frostCatch,
    extremeWeatherCatch,
    activitySummary,
    avgPerAnglerDayByMonth,
    angelQueen,
    photoArtist,
    recordHunter,
    funCardChampion,
  };
}
 

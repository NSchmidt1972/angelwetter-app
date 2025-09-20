// src/pages/FunFacts.jsx
import React, { useMemo, useState } from 'react';
import PageContainer from '../components/PageContainer';

// Daten/Hooks & Utils
import { useValidFishes } from '../hooks/useValidFishes';
import { localDayKey, monthKey, monthLabel } from '../utils/dateUtils';
import { isRainyCatch, isSunnyCatch, extractTempC, extractMoonPhase, parseWeather } from '../utils/weatherParsing';
import {
  formatDateDE,
  formatDateTimeDE,
  formatDayLabelDE,
  formatTimeDE,
  formatDayShortDE,
} from "../utils/formatters";

// ------------------ Konstanten ------------------
const PUBLIC_FROM = new Date('2025-06-01');
const vertraute = ['Nicol Schmidt', 'Laura Rittlinger'];

const PREDATOR_SET = new Set(['barsch', 'aal', 'hecht', 'zander', 'wels']);
const PREDATOR_LABELS = {
  barsch: 'Barsch',
  aal: 'Aal',
  hecht: 'Hecht',
  zander: 'Zander',
  wels: 'Wels',
};

// ------------------ Helpers (lokal) ------------------
const PLACE_ALIASES = [
  [/lob+er+ich/i, 'Ferkensbruch'],
  [/ferkens?bruch/i, 'Ferkensbruch'],
  [/^\s*(null|undefined|-)\s*$/i, 'Ferkensbruch'],
];
function normalizePlace(f) {
  const raw = (f.location_name ?? '').toString().trim();
  if (!raw) return 'Ferkensbruch';
  for (const [re, name] of PLACE_ALIASES) {
    if (re.test(raw)) return name;
  }
  return raw.replace(/\s+/g, ' ');
}


const WEATHER_KEYWORD_SCORES = [
  { regex: /(gewitter|thunder|storm|sturm|orkan|blitz)/i, score: 25, label: 'Gewitter/Sturm' },
  { regex: /(hagel|hail)/i, score: 18, label: 'Hagel' },
  { regex: /(schnee|snow|eisregen|sleet|glatteis)/i, score: 14, label: 'Schnee/Eis' },
  { regex: /(starke[rn]? regen|heftiger regen|downpour|wolkenbruch|heavy rain)/i, score: 12, label: 'Heftiger Regen (Text)' },
  { regex: /(böe|böen|gust|gale|orkanartig)/i, score: 10, label: 'Sturmböen' },
  { regex: /(nebel|fog|dunst)/i, score: 6, label: 'Dichter Nebel' },
];

const COMFORT_TEMP_C = 18;
const TEMP_TOLERANCE = 2; // kleiner Korridor ohne Strafpunkte
const WIND_COMFORT = 4; // m/s – darüber wird's ungemütlicher

function ucfirst(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function getWeatherDescription(f, fallbackLower) {
  const candidates = [];
  const pushStr = (val) => {
    if (typeof val === 'string' && val.trim()) candidates.push(val.trim());
  };

  pushStr(f?.weather_description);
  pushStr(f?.weather_desc);
  pushStr(f?.weatherText);
  pushStr(f?.conditions);

  if (typeof f?.weather === 'string') pushStr(f.weather);
  else if (f?.weather && typeof f.weather === 'object') {
    pushStr(f.weather.description);
    pushStr(f.weather.summary);
    pushStr(f.weather.text);
    pushStr(f.weather?.weather?.[0]?.description);
    pushStr(f.weather?.weather?.[0]?.main);
    pushStr(f.weather?.current?.weather?.[0]?.description);
    pushStr(f.weather?.current?.weather?.[0]?.main);
  }

  if (candidates.length > 0) return ucfirst(candidates[0]);
  if (typeof fallbackLower === 'string' && fallbackLower.trim()) return ucfirst(fallbackLower.trim());
  return null;
}



// Stabile „Shuffle“-Reihenfolge pro Mount
function useStableShuffleSeed() {
  const [seed] = useState(() => Math.random());
  return seed;
}
function shuffleStable(array, seed) {
  let s = Math.floor(seed * 1e9) || 1;
  const rand = () => ((s = (s * 48271) % 0x7fffffff) / 0x7fffffff);
  return array
    .map((item) => ({ item, rnd: rand() }))
    .sort((a, b) => a.rnd - b.rnd)
    .map(({ item }) => item);
}

// ------------------ UI Bausteine ------------------
const Card = React.memo(function Card({ title, children }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
      <h3 className="text-lg font-semibold text-blue-700 dark:text-blue-300 mb-2">
        {title}
      </h3>
      {children}
    </div>
  );
});

const Pill = ({ children }) => (
  <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
    {children}
  </span>
);

// ===================================================
//                     Komponente
// ===================================================
export default function FunFacts() {
  // 1) Immer zuerst: Daten holen
  // useValidFishes liefert:
  // - fishes: alle sichtbaren Roh-Fänge (inkl. z. B. für „Blank“-Auswertungen)
  // - validFishes: nur Fänge, die in Statistiken zählen (z. B. count_in_stats = true)
  const { fishes, validFishes, loading, loadError } = useValidFishes({ PUBLIC_FROM, vertraute });


 // 1.5) Nur Fänge, die wirklich in die Statistiken sollen
 //     (DB-Flag bevorzugt; Fallback für ältere Datensätze)
 const statsFishes = useMemo(() => {
 return (validFishes || []).filter((f) => {
   if (typeof f.count_in_stats === 'boolean') return f.count_in_stats;
    if (f.under_min_size === true || f.out_of_season === true) return false;
     return true;
   });
 }, [validFishes]);

  // 2) Seed *immer* oben, niemals nach einem Early-Return!
  const seed = useStableShuffleSeed();

  // ---------- 1) Meiste Fische an einem Tag (pro Angler & Tag)
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

  // ---------- 2) Größter Fisch
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

  // ---------- 3) Kleinster Fisch (> 0)
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

  // ---------- 4) Meiste Fische in einer Stunde (pro Angler & Stunden-Bucket)
  const mostInOneHour = useMemo(() => {
    const byAnglerHour = {};
    statsFishes.forEach((f) => {
      const dt = new Date(f.timestamp);
      // Stunde auf :00 trimmen
      const hourStart = new Date(
        dt.getFullYear(),
        dt.getMonth(),
        dt.getDate(),
        dt.getHours(),
        0, 0, 0
      );
      // Stabiler, technischer Key (ohne Locale, ohne Leerzeichen)
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
          // Für die UI: „dd.mm.yyyy HH:MM“
          hourLabel: `${formatDateDE(hourStart)} ${formatTimeDE(hourStart)}`,
          examples: entries
            .slice()
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)),
        };
      }),
    };
  }, [statsFishes]);

  // Hilfs-Map Gesamtanzahl pro (Angler, Tag)
  const totalPerAnglerDay = useMemo(() => {
    const map = {};
    statsFishes.forEach((f) => {
      const key = `${f.angler || 'Unbekannt'}__${localDayKey(new Date(f.timestamp))}`;
      map[key] = (map[key] || 0) + 1;
    });
    return map;
  }, [statsFishes]);

  // ---------- 5) Meiste verschiedene Fischarten an einem Tag
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

  // ---------- 6) Meiste Monsterfische (> 80 cm) pro Angler
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
  }, [statsFishes]);

  // ---------- 7) Tag mit den meisten Fischen (gesamt)
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

  // ---------- 8) Monat mit den meisten Fischen (gesamt)
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

  // ---------- 8b) Monate mit den durchschnittlich größten Fischen
  const topMonthsByAvgSize = useMemo(() => {
    if (statsFishes.length === 0) return { items: [] };

    const monthData = new Map();

    statsFishes.forEach((f) => {
      const place = normalizePlace(f);
      if (place !== 'Ferkensbruch') return; // nur Fänge aus Lobberich (alias Ferkensbruch)

      if (f.under_min_size === true) return; // nur maßige Fische

      const dt = new Date(f.timestamp);
      if (Number.isNaN(dt.getTime())) return;

      const size = typeof f.size === 'number'
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

    const ranked = Array.from(monthData.entries())
      .map(([month, data]) => {
        if (data.count === 0) return null;

        const avgSize = data.sum / data.count;
        const speciesList = Array.from(data.species.entries())
          .map(([species, info]) => ({
            species,
            avgSize: info.count > 0 ? info.sum / info.count : 0,
            count: info.count,
          }))
          .filter((s) => s.avgSize > 0)
          .sort(
            (a, b) =>
              b.avgSize - a.avgSize ||
              b.count - a.count ||
              a.species.localeCompare(b.species, 'de')
          );

        return {
          month,
          avgSize,
          count: data.count,
          topSpecies: speciesList[0] || null,
          species: speciesList,
        };
      })
      .filter(Boolean)
      .sort(
        (a, b) =>
          b.avgSize - a.avgSize ||
          b.count - a.count ||
          a.month.localeCompare(b.month)
      );

    return { items: ranked.slice(0, 3) };
  }, [statsFishes]);

  // ---------- 9) Bester Wochentag (gesamt)
  const mostFishesWeekday = useMemo(() => {
    if (statsFishes.length === 0) return { max: 0, items: [] };

    const counts = new Array(7).fill(0); // 0=Mo … 6=So
    const toMon0 = (jsDay) => (jsDay + 6) % 7; // JS: 0=So → 0=Mo

    statsFishes.forEach((f) => {
      const d = new Date(f.timestamp);
      counts[toMon0(d.getDay())] += 1;
    });

    const labels = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
    const max = Math.max(...counts);

    const items = counts
      .map((count, i) => ({ label: labels[i], count }))
      .sort((a, b) => (b.count - a.count) || a.label.localeCompare(b.label))
      .map((it) => ({ ...it, isBest: it.count === max && max > 0 }));

    return { max, items };
  }, [statsFishes]);

  // ---------- 10) Meiste verschiedene Fischarten in 1 Stunde
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
      return { angler, hourLabel, species, totalThatHour };
    });

    return { count: best, items };
  }, [statsFishes]);

  // ---------- 11) Meiste unterschiedlichen Orte pro Angler (ohne „nur Ferkensbruch“)
  const mostPlacesAngler = useMemo(() => {
    const placesByAngler = {};
    statsFishes.forEach((f) => {
      const who = (f.angler || 'Unbekannt').trim();
      if (!who) return;
      const place = normalizePlace(f);
      if (!place) return;
      (placesByAngler[who] ||= new Set()).add(place);
    });

    const entries = Object.entries(placesByAngler)
      .map(([angler, set]) => {
        const places = [...set].sort();
        const onlyFerkensbruch = places.length === 1 && places[0] === 'Ferkensbruch';
        if (onlyFerkensbruch) return null;
        return { angler, places, count: places.length };
      })
      .filter(Boolean);

    if (entries.length === 0) return { count: 0, winners: [], ranking: [] };

    const best = Math.max(...entries.map((e) => e.count));
    const winners = entries.filter((e) => e.count === best);
    const ranking = [...entries].sort((a, b) => (b.count - a.count) || a.angler.localeCompare(b.angler));

    return { count: best, winners, ranking };
  }, [statsFishes]);

  // ---------- 12) Raubfisch-König: Summe Längen Prädatoren
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

  // ---------- 13) Schwerster Fisch (Gewicht)
  const heaviestFish = useMemo(() => {
    const withWeight = validFishes.filter((f) => {
      const w = parseFloat(f.weight);
      return !Number.isNaN(w) && w > 0;
    });
    if (withWeight.length === 0) return null;

    let maxW = -Infinity;
    withWeight.forEach((f) => {
      const w = parseFloat(f.weight);
      if (w > maxW) maxW = w;
    });

    const items = withWeight.filter((f) => parseFloat(f.weight) === maxW);
    return { weight: maxW, items };
  }, [validFishes]);

  // ---------- 14) Effizienz: Fische pro Fangtag
  const mostEfficientAngler = useMemo(() => {
    if (fishes.length === 0) return { max: 0, winners: [], ranking: [] };

    const daysByAngler = {};
    fishes.forEach((f) => {
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
      .filter((e) => e.days > 0);

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
  }, [fishes, statsFishes]);

  // ---------- 15) Meiste Rotaugen
  const mostRotaugen = useMemo(() => {
    const isRotauge = (name) => {
      const s = (name || '').toLowerCase().trim();
      return s === 'rotauge' || s === 'rotaugen' || s === 'plötze' || s === 'ploetze' || s.includes('rotauge');
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

  // ---------- 16) Vollmond – wer fängt am meisten?
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

  // ---------- 17) Nachteulen: 22–04 Uhr
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

  // ---------- 18) Early Bird: 04–09 Uhr
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

  // ---------- 19) Wer fängt am meisten bei Regen?
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

  // ---------- 20) Wer angelt ausschließlich bei Sonnenschein?
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

  // ---------- 21) Top 3 Fischarten
  const topThreeSpecies = useMemo(() => {
    const counts = {};
    statsFishes.forEach((f) => {
      const s = (f.fish || '').trim();
      if (!s) return;
      counts[s] = (counts[s] || 0) + 1;
    });

    const list = Object.entries(counts)
      .map(([species, count]) => ({ species, count }))
      .sort((a, b) => b.count - a.count || a.species.localeCompare(b.species));

    const top3 = list.slice(0, 3);
    const max = top3[0]?.count || 0;
    return { max, items: top3 };
  }, [statsFishes]);

  // ---------- 22) Längste Pause zwischen Fangtagen
  const longestBreakBetweenCatchDays = useMemo(() => {
    if (statsFishes.length === 0) return { gap: 0, winners: [], ranking: [] };

    const daysByAngler = {};
    statsFishes.forEach((f) => {
      const who = (f.angler || 'Unbekannt').trim();
      if (!who) return;
      const day = localDayKey(new Date(f.timestamp));
      (daysByAngler[who] ||= new Set()).add(day);
    });

    const parseDay = (k) => new Date(`${k}T00:00:00`);
    const diffDays = (a, b) => Math.round((parseDay(b) - parseDay(a)) / 86400000);

    const entries = [];
    Object.entries(daysByAngler).forEach(([angler, set]) => {
      const days = [...set].sort();
      if (days.length < 2) return;
      let maxGap = 0;
      let from = days[0],
          to = days[0];
      for (let i = 0; i < days.length - 1; i++) {
        const gap = diffDays(days[i], days[i + 1]);
        if (gap > maxGap) {
          maxGap = gap;
          from = days[i];
          to = days[i + 1];
        }
      }
      entries.push({ angler, gap: maxGap, from, to, totalCatchDays: days.length });
    });

    if (entries.length === 0) return { gap: 0, winners: [], ranking: [] };
    entries.sort((a, b) => b.gap - a.gap || a.angler.localeCompare(b.angler));
    const best = entries[0].gap;
    const winners = entries.filter((e) => e.gap === best);
    return { gap: best, winners, ranking: entries };
  }, [statsFishes]);

  // ---------- 23) Längste Fangserie
  const longestCatchStreak = useMemo(() => {
    if (statsFishes.length === 0) return { len: 0, winners: [], ranking: [] };

    const daysByAngler = {};
    statsFishes.forEach((f) => {
      const who = (f.angler || 'Unbekannt').trim();
      if (!who) return;
      const day = localDayKey(new Date(f.timestamp));
      (daysByAngler[who] ||= new Set()).add(day);
    });

    const parseDay = (k) => new Date(`${k}T00:00:00`);
    const diffDays = (a, b) => Math.round((parseDay(b) - parseDay(a)) / 86400000);

    const entries = [];
    Object.entries(daysByAngler).forEach(([angler, set]) => {
      const days = [...set].sort();
      if (days.length === 0) return;

      let maxLen = 1,
          bestStart = days[0],
          bestEnd = days[0];
      let curLen = 1,
          curStart = days[0],
          curEnd = days[0];

      for (let i = 1; i < days.length; i++) {
        if (diffDays(days[i - 1], days[i]) === 1) {
          curLen += 1;
          curEnd = days[i];
        } else {
          if (curLen > maxLen) {
            maxLen = curLen;
            bestStart = curStart;
            bestEnd = curEnd;
          }
          curLen = 1;
          curStart = days[i];
          curEnd = days[i];
        }
      }
      if (curLen > maxLen) {
        maxLen = curLen;
        bestStart = curStart;
        bestEnd = curEnd;
      }

      entries.push({ angler, length: maxLen, from: bestStart, to: bestEnd, totalCatchDays: days.length });
    });

    if (entries.length === 0) return { len: 0, winners: [], ranking: [] };
    entries.sort((a, b) => b.length - a.length || a.angler.localeCompare(b.angler));
    const best = entries[0].length;
    const winners = entries.filter((e) => e.length === best);
    return { len: best, winners, ranking: entries };
  }, [statsFishes]);

  // ---------- 24) Paare (gemeinsame Sessions)
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
          const a = anglers[i], b = anglers[j];
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

  // ---------- 25) Zander-Queen (größter Zanderfang)
  const zanderQueen = useMemo(() => {
    const onlyZander = statsFishes
      .map((f) => ({ f, size: typeof f.size === 'number' ? f.size : parseFloat(f.size) }))
      .filter((x) => x.f.fish?.trim().toLowerCase() === 'zander' && !Number.isNaN(x.size) && x.size > 0);

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

  // ---------- 26) Aal-Magier
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

  // ---------- 27) Grundel-Champion
  const grundelChampion = useMemo(() => {
    const onlyGrundeln = validFishes.filter((f) => f.fish?.trim().toLowerCase() === 'grundel');
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
  }, [validFishes]);

  // ---------- 28) Wer angelt gern woanders? (per location_name)
  const foreignAnglers = useMemo(() => {
    if (validFishes.length === 0) return { top3: [] };

    const byAngler = {};
    for (const f of validFishes) {
      const loc = (f.location_name || '').trim();
      if (!loc || ['Ferkensbruch', 'Lobberich'].includes(loc)) continue;

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
  }, [validFishes]);

  // ---------- 29) Schneiderkönig
  const schneiderKoenig = useMemo(() => {
    const counts = {};
    fishes.forEach((f) => {
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
  }, [fishes]);

  // ---------- 30) Schlechtester Monat (meiste Schneidertage)
  const worstBlankMonth = useMemo(() => {
    if (fishes.length === 0) return { max: 0, winners: [], ranking: [] };

    const byMonth = {};
    for (const f of fishes) {
      if (!f.blank) continue;
      const key = monthKey(new Date(f.timestamp));
      byMonth[key] = (byMonth[key] || 0) + 1;
    }

    const entries = Object.entries(byMonth).map(([month, count]) => ({ month, count }));
    if (entries.length === 0) return { max: 0, winners: [], ranking: [] };

    entries.sort((a, b) => b.count - a.count || a.month.localeCompare(b.month));
    const max = entries[0].count;
    const winners = entries.filter((e) => e.count === max);
    const ranking = entries;
    return { max, winners, ranking };
  }, [fishes]);

  // ---------- 31) Heißester Fang
  const hottestCatch = useMemo(() => {
    const withTemp = validFishes
      .map((f) => ({ f, t: extractTempC(f), size: parseFloat(f.size) }))
      .filter((x) => x.t != null && !Number.isNaN(x.size) && x.size > 0);

    if (withTemp.length === 0) return null;

    const maxT = Math.max(...withTemp.map((x) => x.t));
    const atMaxT = withTemp.filter((x) => Math.abs(x.t - maxT) < 1e-9);
    const maxSize = Math.max(...atMaxT.map((x) => x.size));
    const winners = atMaxT.filter((x) => Math.abs(x.size - maxSize) < 1e-9).map((x) => x.f);

    return { tempC: maxT, size: maxSize, items: winners };
  }, [validFishes]);

  // ---------- 32) Kältester Fang (≤ 0°C)
  const frostCatch = useMemo(() => {
    const frost = validFishes
      .map((f) => ({ f, t: extractTempC(f), size: parseFloat(f.size) }))
      .filter((x) => x.t != null && x.t <= 0 && !Number.isNaN(x.size) && x.size > 0);

    if (frost.length === 0) return { max: 0, winners: [], ranking: [] };

    const byAngler = {};
    for (const x of frost) {
      const who = (x.f.angler || 'Unbekannt').trim();
      if (!byAngler[who]) byAngler[who] = { count: 0, bestSize: 0, sample: null };
      byAngler[who].count += 1;
      if (x.size > byAngler[who].bestSize) {
        byAngler[who].bestSize = x.size;
        byAngler[who].sample = x.f;
      }
    }

    const entries = Object.entries(byAngler).map(([angler, v]) => ({ angler, ...v }));
    entries.sort(
      (a, b) =>
        b.count - a.count ||
        b.bestSize - a.bestSize ||
        a.angler.localeCompare(b.angler),
    );
    const max = entries[0].count;
    const winners = entries.filter((e) => e.count === max);
    return { max, winners, ranking: entries };
  }, [validFishes]);

  // ---------- 32b) Extremste Wetterbedingungen
  const extremeWeatherCatch = useMemo(() => {
    if (validFishes.length === 0) return null;

    const entries = validFishes
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
      if (!Number.isNaN(timeA) && !Number.isNaN(timeB)) return timeB - timeA;
      return 0;
    });

    const bestScore = ranking[0].score;
    const winners = ranking.filter((entry) => Math.abs(entry.score - bestScore) < 1e-6);

    return {
      bestScore,
      ranking,
      winners,
    };
  }, [validFishes]);

  // ---------- 33) Ø Fische pro Angler-Tag (gesamt)
  const overallAvgPerAnglerDay = useMemo(() => {
    if (statsFishes.length === 0) {
      return { avg: 0, totalAnglerDays: 0, totalFishes: 0 };
    }
    const perAnglerDay = new Map();
    for (const f of statsFishes) {
      const dayKey = localDayKey(new Date(f.timestamp));
      const key = `${f.angler}|${dayKey}`;
      perAnglerDay.set(key, (perAnglerDay.get(key) || 0) + 1);
    }
    let totalFishes = 0;
    for (const cnt of perAnglerDay.values()) totalFishes += cnt;
    const totalAnglerDays = perAnglerDay.size;
    const avg = totalAnglerDays ? totalFishes / totalAnglerDays : 0;
    return { avg, totalAnglerDays, totalFishes };
  }, [statsFishes]);

  // ---------- 34) Angel-Queen – welche Frau fängt die meisten Fische?
const angelQueen = useMemo(() => {
  if (statsFishes.length === 0) return { winners: [], ranking: [] };

  // Vergleich robust nur über den Vornamen (Volllname → erster Token)
  const FEMALE_FIRSTNAMES = new Set(["laura", "marilou", "julia"]);
  const strip = (s) =>
    (s || "")
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .trim();

  const counts = {};          // key: Vorname (normalized) → { label, count }
  statsFishes.forEach((f) => {
    const who = (f.angler || "Unbekannt").trim();
    if (!who) return;
    const first = strip(who).split(/\s+/)[0];       // “Laura Rittlinger” → “Laura”
    const key = first.toLowerCase();
    if (!FEMALE_FIRSTNAMES.has(key)) return;        // nur Laura / Marilou / Julia

    if (!counts[key]) counts[key] = { label: first, count: 0 };
    counts[key].count += 1;
  });

  // Ranking bauen
  const ranking = Object.values(counts).sort(
    (a, b) => b.count - a.count || a.label.localeCompare(b.label, "de")
  );

  if (ranking.length === 0) return { winners: [], ranking: [] };

  const best = ranking[0].count;
  const winners = ranking.filter((e) => e.count === best);

  // Für Konsistenz der Rückgabe wie bei anderen Karten:
  // mapping auf { angler, total } (analog zu deinen Strukturen)
  return {
    winners: winners.map((e) => ({ angler: e.label, total: e.count })),
    ranking: ranking.map((e) => ({ angler: e.label, total: e.count })),
  };
}, [statsFishes]);

// ---------- 35) Foto-Künstler – wer hat die meisten Fangfotos?
const photoArtist = useMemo(() => {
  if (statsFishes.length === 0) return { winners: [], ranking: [] };

  const counts = {}; // angler -> { angler, total }
  statsFishes.forEach((f) => {
    const who = (f.angler || 'Unbekannt').trim();
    const hasPhoto = typeof f.photo_url === 'string' && f.photo_url.trim().length > 0;
    if (!who || !hasPhoto) return;
    if (!counts[who]) counts[who] = { angler: who, total: 0 };
    counts[who].total += 1;
  });

  const ranking = Object.values(counts).sort(
    (a, b) => b.total - a.total || a.angler.localeCompare(b.angler, 'de')
  );
  if (ranking.length === 0) return { winners: [], ranking: [] };

  const best = ranking[0].total;
  const winners = ranking.filter((e) => e.total === best);

  return { winners, ranking };
}, [statsFishes]);

// ---------- 36) Rekordjäger – wer hält die meisten Vereinsrekorde (größte Fische pro Art)?
const recordHunter = useMemo(() => {
  if (statsFishes.length === 0) return { winners: [], ranking: [] };

  // pro Art die Maximalgröße finden
  const bySpecies = {}; // species -> { max: number, holders: Set(angler) }
  statsFishes.forEach((f) => {
    const species = (f.fish || '').trim();
    const who = (f.angler || 'Unbekannt').trim();
    const size = typeof f.size === 'number' ? f.size : parseFloat(String(f.size || '').replace(',', '.'));
    if (!species || !who || !isFinite(size)) return;

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

  // Rekorde je Angler zählen + Liste der gehaltenen Arten mit Maxwert
  const counts = {}; // angler -> { angler, total, totalLength, species: Array<{name, max}> }
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
      a.angler.localeCompare(b.angler, 'de')
  );
  if (ranking.length === 0) return { winners: [], ranking: [] };

  const best = ranking[0].total;
  const winners = ranking.filter((e) => e.total === best);

  return { winners, ranking };
}, [statsFishes]);


  // ---------- Karten zusammenstellen (Seed wird IMMER verwendet) ----------
  const cards = useMemo(
    () =>
      shuffleStable(
        [
          // 1) Meiste Fische an einem Tag
          <Card key="day" title="Wer hat die meisten Fische an einem Tag gefangen?">
            <p className="mb-2">
              <strong>{mostInOneDay.count}</strong> Fänge – Rekordhalter:
            </p>
            <ul className="space-y-2">
              {mostInOneDay.items.map((it, idx) => (
                <li key={idx} className="flex items-start justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="font-medium text-green-700 dark:text-green-300">
                      {it.angler}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">
                      {formatDateDE(`${it.day}T00:00:00`)}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {it.examples.map((e) => (
                        <Pill key={e.id}>
                          {e.fish} • {parseFloat(e.size).toFixed(0)} cm • {formatTimeDE(e.timestamp)} Uhr
                        </Pill>
                      ))}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </Card>,

          // 2) Größter Fisch
          <Card key="biggest" title="Wer hat den größten Fisch gefangen?">
            {biggest ? (
              <>
                <p className="mb-2">
                  <strong>{biggest.size.toFixed(0)} cm</strong> – Rekordfang
                </p>
                <ul className="space-y-2">
                  {biggest.items.map((f) => (
                    <li key={f.id} className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-green-700 dark:text-green-300">{f.angler}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-300">
                          {f.fish} • {formatDateTimeDE(f.timestamp)}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p>Keine Daten</p>
            )}
          </Card>,

          // 3) Kleinster Fisch
          <Card key="smallest" title="Wer hat den kleinsten Fisch gefangen?">
            {smallest ? (
              <>
                <p className="mb-2">
                  <strong>{smallest.size.toFixed(0)} cm</strong> – kleinster gemeldeter Fang
                </p>
                <ul className="space-y-2">
                  {smallest.items.map((f) => (
                    <li key={f.id} className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-green-700 dark:text-green-300">{f.angler}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-300">
                          {f.fish} • {formatDateTimeDE(f.timestamp)}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p>Keine Daten</p>
            )}
          </Card>,

          // 4) Meiste Fische in einer Stunde
          <Card key="hour" title="Wer hat die meisten Fische in einer Stunde gefangen?">
            <p className="mb-2">
              <strong>{mostInOneHour.count}</strong> Fänge innerhalb einer Stunde – Rekordhalter:
            </p>
            <ul className="space-y-2">
              {mostInOneHour.items.map((it, idx) => (
                <li key={idx} className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-green-700 dark:text-green-300">{it.angler}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">{it.hourLabel} Uhr</div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {it.examples.map((e) => (
                        <Pill key={e.id}>
                          {e.fish} • {parseFloat(e.size).toFixed(0)} cm
                        </Pill>
                      ))}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </Card>,

          // 5) Meiste Fischarten an einem Tag
          <Card key="speciesDay" title="Wer hat die meisten Fischarten an einem Tag gefangen?">
            {mostSpeciesInOneDay.count > 0 ? (
              <>
                <p className="mb-2">
                  <strong>{mostSpeciesInOneDay.count}</strong> verschiedene Arten – Rekordhalter:
                </p>
                <ul className="space-y-2">
                  {mostSpeciesInOneDay.items.map((it, idx) => (
                    <li key={idx} className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-green-700 dark:text-green-300">{it.angler}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-300">
                          {formatDateDE(`${it.day}T00:00:00`)}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                          Insgesamt an diesem Tag: <b>{it.totalThatDay}</b> Fänge
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {it.species.map((s) => (
                            <Pill key={s}>{s}</Pill>
                          ))}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p>Keine Daten</p>
            )}
          </Card>,

          // 6) Meiste Monsterfische
          <Card key="monster" title="Wer hat die meisten Monsterfische (>80 cm) gefangen?">
            {mostMonsterFishes.count > 0 ? (
              <ul className="space-y-2">
                {mostMonsterFishes.items.map((it, idx) => (
                  <li key={idx} className="flex items-center justify-between">
                    <div className="font-medium text-green-700 dark:text-green-300">{it.angler}</div>
                    <div className="text-xl font-bold text-green-700 dark:text-green-300">
                      {it.count}x
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Keine Monsterfische gefangen.</p>
            )}
          </Card>,

          // 7) Tag mit den meisten Fischen
          <Card key="mostFishesDay" title="📅 An welchem Tag wurden die meisten Fische gefangen?">
            {mostFishesDay.count > 0 ? (
              <>
                <p className="mb-2">
                  Insgesamt <b className="text-green-700 dark:text-green-300">{mostFishesDay.count}</b> Fänge.
                </p>
                <ul className="space-y-2">
                  {mostFishesDay.days.map((d, i) => (
                    <li key={i} className="p-2 rounded bg-gray-50 dark:bg-gray-800 flex flex-col">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">{formatDayLabelDE(d.day)}</span>
                        <span className="font-bold text-green-700 dark:text-green-300">{d.count}x</span>
                      </div>
                      {d.anglers && d.anglers.length > 0 && (
                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          👤 {d.anglers.join(', ')}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p>Keine Daten</p>
            )}
          </Card>,

          // 8) Monat mit den meisten Fischen
          <Card key="monthMax" title="📅 In welchem Monat gab es die meisten Fische?">
            {mostFishesMonth.count > 0 ? (
              <>
                <p className="mb-2">
                  Insgesamt <b className="text-green-700 dark:text-green-300">{mostFishesMonth.count}</b> Fänge.
                </p>
                <ul className="space-y-1">
                  {mostFishesMonth.months.map((m, i) => (
                    <li key={i} className="flex justify-between">
                      <span className="font-medium">{monthLabel(m.month)}</span>
                      <span className="font-bold text-green-700 dark:text-green-300">{m.count}x</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p>Keine Daten</p>
            )}
          </Card>,

          // 8b) Monate mit den größten Durchschnitts-Fischen
          <Card key="monthAvgSize" title="📏 Welche Monate bringen die größten Ø-Fische?">
            {topMonthsByAvgSize.items.length > 0 ? (
              <ul className="space-y-2">
                {topMonthsByAvgSize.items.map((item, idx) => (
                  <li
                    key={item.month}
                    className="p-2 rounded bg-gray-50 dark:bg-gray-800"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-medium">
                        {idx + 1}. {monthLabel(item.month)}
                      </span>
                      <span className="font-bold text-green-700 dark:text-green-300">
                        Ø {item.avgSize.toFixed(1)} cm
                      </span>
                    </div>
                   
                    {item.species && item.species.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {item.species.map((speciesEntry) => (
                          <Pill key={`${item.month}-${speciesEntry.species}`}>
                            {speciesEntry.species} • Ø {speciesEntry.avgSize.toFixed(1)} cm
                            {speciesEntry.count > 0 ? ` (${speciesEntry.count}x)` : ''}
                          </Pill>
                        ))}
                      </div>
                    )}
                    
                  </li>
                ))}
              </ul>
            ) : (
              <p>Keine Größenangaben vorhanden.</p>
            )}
          </Card>,

          // 9) Wochentage
          <Card key="weekday" title="🗓️ Welcher Wochentag bringt die meisten Fänge?">
            {mostFishesWeekday.items.length > 0 ? (
              <ul className="space-y-1">
                {mostFishesWeekday.items.map((it, i) => (
                  <li key={i} className="flex justify-between">
                    <span
                      className={`font-medium ${
                        it.isBest ? 'text-green-700 dark:text-green-300' : ''
                      }`}
                    >
                      {it.label}
                    </span>
                    <span
                      className={`font-bold ${
                        it.isBest ? 'text-green-700 dark:text-green-300' : ''
                      }`}
                    >
                      {it.count}x
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Keine Daten</p>
            )}
          </Card>,

          // 10) Meiste Fischarten in 1 Stunde
          <Card key="speciesHour" title="Wer hat die meisten Fischarten in 1 Stunde gefangen?">
            {mostSpeciesInOneHour.count > 0 ? (
              <>
                <p className="mb-2">
                  <strong>{mostSpeciesInOneHour.count}</strong> verschiedene Arten – Rekordhalter:
                </p>
                <ul className="space-y-2">
                  {mostSpeciesInOneHour.items.map((it, idx) => (
                    <li key={idx} className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-green-700 dark:text-green-300">{it.angler}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-300">{formatDateTimeDE(it.hourLabel)} Uhr</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                          Insgesamt in dieser Stunde: <b>{it.totalThatHour}</b> Fänge
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {it.species.map((s) => (
                            <Pill key={s}>{s}</Pill>
                          ))}
                        </div>
                      </div>
                      <div className="text-xl font-bold text-green-700 dark:text-green-300">
                        {mostSpeciesInOneHour.count} Arten
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p>Keine Daten</p>
            )}
          </Card>,

          // 11) Orte
          <Card key="places" title="🧭 Wer hat an den meisten unterschiedlichen Orten geangelt?">
            {mostPlacesAngler.count > 0 ? (
              <>
                <p className="mb-2">
                  <strong className="text-green-700 dark:text-green-300">
                    {mostPlacesAngler.count}
                  </strong>{' '}
                  unterschiedliche Orte – Rekordhalter:
                </p>
                <ul className="space-y-2">
                  {mostPlacesAngler.winners.map((it, idx) => (
                    <li key={idx} className="flex items-start justify-between gap-3">
                      <div className="max-w-[70%]">
                        <div className="font-medium text-green-700 dark:text-green-300">{it.angler}</div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {it.places.map((p) => (
                            <Pill key={p}>{p}</Pill>
                          ))}
                        </div>
                      </div>
                      <div className="text-xl font-bold text-green-700 dark:text-green-300">
                        {it.count}
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p>Keine Daten</p>
            )}
          </Card>,

          // 12) Raubfisch-König
          <Card
            key="predator"
            title="👑 Wer ist der Raubfisch-König? (Gesamtlänge: Barsch, Aal, Hecht, Zander, Wels)"
          >
            {predatorKing.winners.length > 0 ? (
              <ul className="space-y-2">
                {predatorKing.winners.map((it, idx) => (
                  <li key={idx} className="flex items-start justify-between gap-3">
                    <div className="max-w-[70%]">
                      <div className="font-medium text-green-700 dark:text-green-300">{it.angler}</div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {Object.entries(it.perSpecies)
                          .sort((a, b) => b[1].sum - a[1].sum)
                          .map(([sp, data]) => {
                            const avg = data.count > 0 ? Math.round(data.sum / data.count) : 0;
                            const countLabel = data.count === 1 ? '1 Fang' : `${data.count} Fänge`;
                            return (
                              <Pill key={sp}>
                                {PREDATOR_LABELS[sp] ?? sp} · {countLabel} · Ø {avg} cm
                              </Pill>
                            );
                          })}
                      </div>
                    </div>
                    <div className="text-xl font-bold text-green-700 dark:text-green-300">
                      {Math.round(it.sum)} cm
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Keine Daten</p>
            )}
          </Card>,

          // 13) Dickstes Ding (Gewicht)
          <Card key="heavy" title="🏋️ Wer hat das dickste Ding gefangen? (max Gewicht)">
            {heaviestFish ? (
              <>
                <p className="mb-2">
                  Schwerster Fang:{' '}
                  <b className="text-green-700 dark:text-green-300">
                    {heaviestFish.weight.toFixed(1)} kg
                  </b>
                </p>
                <ul className="space-y-2">
                  {heaviestFish.items.map((f) => (
                    <li key={f.id} className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-green-700 dark:text-green-300">{f.angler}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-300">
                          {f.fish}
                          {parseFloat(f.size) > 0 ? ` • ${parseFloat(f.size).toFixed(0)} cm` : ''} •{' '}
                          {formatDateTimeDE(f.timestamp)}
                        </div>
                      </div>
                      <div className="text-xl font-bold text-green-700 dark:text-green-300">
                        {parseFloat(f.weight).toFixed(1)} kg
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p>Keine Gewichtsangaben vorhanden.</p>
            )}
          </Card>,

          // 14) Effizienz
  <Card key="efficiency" title="🏅 Wer angelt am effizientesten? (Fische pro Fangtag)">
    {mostEfficientAngler.winners.length > 0 ? (
      <ul className="space-y-2">
        {mostEfficientAngler.winners.map((it, idx) => (
          <li key={idx} className="flex items-start justify-between gap-3">
            <div>
              <div className="font-medium text-green-700 dark:text-green-300">{it.angler}</div>
              <div className="text-sm text-gray-600 dark:text-gray-300">
                {it.fish} Fische auf {it.days} Fangtage
              </div>
            </div>
            <div className="text-xl font-bold text-green-700 dark:text-green-300">
              {it.ratio.toLocaleString('de-DE', { maximumFractionDigits: 2 })} / Tag
            </div>
          </li>
        ))}
      </ul>
    ) : (
      <p>Keine Daten</p>
    )}
  </Card>,

          // 15) Rotaugen
          <Card key="rotauge" title="🐟 Wer fängt beim ASV Rotauge die meisten Rotaugen?">
            {mostRotaugen.winners.length > 0 ? (
              <ul className="space-y-2">
                {mostRotaugen.winners.map((it, idx) => (
                  <li key={idx} className="flex items-center justify-between">
                    <div className="font-medium text-green-700 dark:text-green-300">{it.angler}</div>
                    <div className="text-xl font-bold text-green-700 dark:text-green-300">
                      {it.count}x
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Keine Rotaugen gefangen.</p>
            )}
          </Card>,

          // 16) Vollmond
          <Card key="fullmoon" title="🌕 Wer fängt am meisten bei Vollmond?">
            {mostAtFullMoon.winners.length > 0 ? (
              <ul className="space-y-2">
                {mostAtFullMoon.winners.map((it, idx) => (
                  <li key={idx} className="flex items-center justify-between">
                    <div className="font-medium text-green-700 dark:text-green-300">{it.angler}</div>
                    <div className="text-xl font-bold text-green-700 dark:text-green-300">
                      {it.count}x
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Keine (auswertbaren) Vollmond-Fänge.</p>
            )}
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Hinweis: Es werden nur Fänge gezählt, bei denen in den Wetterdaten eine Mondphase gespeichert ist (Vollmond ≈ 0.5 ± 0.06).
            </p>
          </Card>,

          // 17) Nachteule – Meiste Nachtfänge
          <Card key="night-count" title="🦉 Wer ist unsere Nachteule?">
            {nightOwls.winners.length > 0 ? (
              <ul className="space-y-2">
                {nightOwls.winners.map((it, idx) => (
                  <li key={idx} className="flex items-start justify-between gap-3">
                    <div className="max-w-[70%]">
                      <div className="font-medium text-green-700 dark:text-green-300">{it.angler}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-300">
                        {it.count} Nachtfang{it.count === 1 ? '' : 'e'} (22–04 Uhr)
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="mt-1">
                        <Pill>🌙 Gesamt: {it.count}</Pill>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Keine Daten</p>
            )}

            {nightOwls.ranking.length > 0 && (
              <div className="mt-4">
                <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
                  Ranking (Top 5)
                </div>
                <ul className="divide-y divide-gray-200/60 dark:divide-white/10 rounded-lg border border-gray-200/60 dark:border-white/10 overflow-hidden">
                  {nightOwls.ranking.slice(0, 5).map((r, i) => (
                    <li key={r.angler} className="flex items-center justify-between px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 text-sm tabular-nums text-gray-500 dark:text-gray-400">
                          {i + 1}.
                        </span>
                        <span className="font-medium">{r.angler}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Pill>🌙 {r.count}</Pill>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>,

          // 18) Early Bird
          <Card key="early" title="🌅 Wer fängt den frühen Wurm? (4:00 - 9:00 Uhr)">
            {earlyBird.winners.length > 0 ? (
              <ul className="space-y-2">
                {earlyBird.winners.map((it, idx) => (
                  <li key={idx} className="flex items-start justify-between gap-3">
                    <div className="max-w-[70%]">
                      <div className="font-medium text-green-700 dark:text-green-300">{it.angler}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-300">
                        {/* timeLabel wird im Memo bereits erzeugt – dort auf formatTimeDE umgestellt */}
                        Frühester Fang um {it.timeLabel} Uhr
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold text-green-700 dark:text-green-300">{it.early} x</div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Keine Daten</p>
            )}
          </Card>,

          // 19) Regen
          <Card key="rain" title="🌧️ Wer fängt am meisten bei Regen?">
            {mostInRain.winners.length > 0 ? (
              <ul className="space-y-2">
                {mostInRain.winners.map((it, idx) => (
                  <li key={idx} className="flex items-start justify-between gap-3">
                    <div className="max-w-[70%]">
                      <div className="font-medium text-green-700 dark:text-green-300">{it.angler}</div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {it.examples.map((e) => (
                          <Pill key={e.id}>
                            {formatTimeDE(e.timestamp)} • {e.fish}
                          </Pill>
                        ))}
                      </div>
                    </div>
                    <div className="text-xl font-bold text-green-700 dark:text-green-300">
                      {it.count}x
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Keine auswertbaren Regen-Fänge.</p>
            )}
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Zählt nur Fänge mit erkennbarer Regen-Info in den Wetterdaten (Rain/Drizzle/Schauer oder gemeldete Niederschlagsmenge).
            </p>
          </Card>,

          // 20) Sonnenschein only
          <Card key="sunny" title="☀️ Wer angelt ausschließlich bei Sonnenschein?">
            {sunshineOnly.winners.length > 0 ? (
              <ul className="space-y-2">
                {sunshineOnly.winners.map((it, idx) => (
                  <li key={idx} className="flex items-center justify-between">
                    <div className="font-medium text-green-700 dark:text-green-300">{it.angler}</div>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Niemand hat ausschließlich bei Sonnenschein gefangen (oder es fehlen Wetterangaben).</p>
            )}
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Hinweis: Gewertet werden nur Fänge mit erkennbarer Wetterbeschreibung. „ein paar wolken/leicht bewölkt“ zählt <b>nicht</b> als Sonnenschein.
            </p>
          </Card>,

          // 21) Top 3 Arten
          <Card key="top3" title="🐟 Welche drei Fischarten werden am meisten gefangen?">
            {topThreeSpecies.items.length > 0 ? (
              <ol className="space-y-2">
                {topThreeSpecies.items.map((it, idx) => (
                  <li key={it.species} className="flex items-center gap-3">
                    <span className="w-6 text-right font-semibold">{idx + 1}.</span>
                    <div className="flex-1">
                      <div className="flex justify-between text-sm font-medium">
                        <span>{it.species}</span>
                        <span className="text-green-700 dark:text-green-300">{it.count}x</span>
                      </div>
                      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded">
                        <div
                          className="h-2 rounded bg-green-600 dark:bg-green-400"
                          style={{ width: `${(it.count / (topThreeSpecies.max || 1)) * 100}%` }}
                        />
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p>Keine Daten</p>
            )}
          </Card>,

          // 22) Längste Pause
          <Card key="pause" title="⏳ Wer muss sich am längsten zwischen den Fangtagen ausruhen?">
            {longestBreakBetweenCatchDays.winners.length > 0 ? (
              <ul className="space-y-2">
                {longestBreakBetweenCatchDays.winners.map((it, idx) => (
                  <li key={idx} className="flex items-start justify-between gap-3">
                    <div className="max-w-[70%]">
                      <div className="font-medium text-green-700 dark:text-green-300">{it.angler}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-300">
                        Pause von {formatDayShortDE(`${it.from}T00:00:00`)} bis {formatDayShortDE(`${it.to}T00:00:00`)}
                      </div>
                    </div>
                    <div className="text-xl font-bold text-green-700 dark:text-green-300">
                      {it.gap} Tage
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Keine auswertbaren Pausen (zu wenige Fangtage je Angler).</p>
            )}
          </Card>,

          // 23) Längste Serie
          <Card key="streak" title="🔥 Wer hat die längste Fangserie hingelegt? (aufeinanderfolgende Fangtage)">
            {longestCatchStreak.winners.length > 0 ? (
              <ul className="space-y-2">
                {longestCatchStreak.winners.map((it, idx) => (
                  <li key={idx} className="flex items-start justify-between gap-3">
                    <div className="max-w-[70%]">
                      <div className="font-medium text-green-700 dark:text-green-300">{it.angler}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-300">
                        Serie von {it.length} Tag{it.length === 1 ? '' : 'en'}: {formatDayShortDE(`${it.from}T00:00:00`)} – {formatDayShortDE(`${it.to}T00:00:00`)}
                      </div>
                    </div>
                    <div className="text-xl font-bold text-green-700 dark:text-green-300">
                      {it.length} Tage
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Keine auswertbaren Serien.</p>
            )}
          </Card>,

          // 24) Paare
          <Card key="buddies" title="👥 Wer fängt gern zusammen? (Top 3 Paare)">
            {fishPairs.lauraNicol ? (
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 italic">
                😉 Referenz: Laura & Nicol – {fishPairs.lauraNicol.count} Fische
              </p>
            ) : (
              <p className="text-xs text-gray-400 mb-3 italic">
                😉 Referenz: Laura & Nicol – noch keine gemeinsamen Fänge
              </p>
            )}

            {fishPairs.top3.length > 0 ? (
              <ul className="space-y-3">
                {fishPairs.top3.map((p, idx) => (
                  <li key={idx} className="flex items-start justify-between gap-3">
                    <div className="max-w-[70%]">
                      <div className="text-green-700 dark:text-green-300 font-medium">
                        {p.a} &amp; {p.b}
                      </div>
                    </div>
                    <div className="text-xl font-bold text-green-700 dark:text-green-300">
                      {p.count}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Keine gemeinsamen Fänge gefunden.</p>
            )}
          </Card>,

          // 25) Wer ist die Zander-Queen?
          <Card key="zander" title="🐊 Wer ist die Zander-Queen?">
            {zanderQueen.winners.length > 0 && zanderQueen.maxSize ? (
              <>
                <p className="mb-2 text-sm text-gray-600 dark:text-gray-300">
                  Größter Zander: <b className="text-green-700 dark:text-green-300">{zanderQueen.maxSize.toFixed(0)} cm</b>
                </p>
                <ul className="space-y-2">
                  {zanderQueen.winners.map((it, idx) => (
                    <li key={idx} className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-green-700 dark:text-green-300">{it.angler}</div>
                        <div className="text-xs text-gray-600 dark:text-gray-300">
                          {formatDateTimeDE(it.fish.timestamp)}
                        </div>
                      </div>
                      <div className="text-xl font-bold text-green-700 dark:text-green-300">
                        {it.size.toFixed(0)} cm
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-gray-600 dark:text-gray-300">Noch kein Zander in Sicht.</p>
            )}
          </Card>,

          // 26) Aal-Magier
          <Card key="eel" title="🧙‍♂️ Aal-Magier">
            {eelWizard ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-green-700 dark:text-green-300 font-medium">
                    {eelWizard.angler}
                  </span>
                  <span className="font-bold text-xl text-green-700 dark:text-green-300">
                    {eelWizard.count}{' '}
                    {eelWizard.count === 1 ? 'Aal' : 'Aale'}
                  </span>
                </div>
                <Pill>
                  Aal · {eelWizard.count === 1 ? '1 Fang' : `${eelWizard.count} Fänge`} · Ø{' '}
                  {eelWizard.averageSizeRounded !== null ? eelWizard.averageSizeRounded : '—'} cm
                </Pill>
              </div>
            ) : (
              <p className="text-gray-600 dark:text-gray-400">Noch kein Aal gefangen.</p>
            )}
          </Card>,

          // 27) Grundel-Champion
          <Card key="grundel" title="🏆 Grundel-Champion">
            {grundelChampion ? (
              <div className="flex items-center justify-between">
                <span className="text-green-700 dark:text-green-300 font-medium">
                  {grundelChampion.angler}
                </span>
                <span className="font-bold text-xl text-green-700 dark:text-green-300">
                  {grundelChampion.count}{' '}
                  {grundelChampion.count === 1 ? 'Grundel' : 'Grundeln'}
                </span>
              </div>
            ) : (
              <p className="text-gray-600 dark:text-gray-400">Noch keine Grundeln gefangen.</p>
            )}
          </Card>,

          // 28) Fremdangeln
          <Card key="foreign" title="🌍 Wer angelt gern woanders?">
            {foreignAnglers.top3.length > 0 ? (
              <ul className="space-y-4">
                {foreignAnglers.top3.map((p, idx) => (
                  <li key={idx} className="p-3 bg-white dark:bg-gray-800 rounded-lg shadow">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-blue-700 dark:text-blue-300">
                        #{idx + 1} {p.angler}
                      </span>
                      <span className="text-green-700 dark:text-green-300 font-bold">
                        {p.total} Fische
                      </span>
                    </div>
                    <div className="mb-2 text-xs text-gray-600 dark:text-gray-400">
                      📍{' '}
                      {Object.entries(p.byLocation)
                        .map(([loc, cnt]) => `${loc} (${cnt})`)
                        .join(', ')}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(p.byFish)
                        .sort((a, b) => b[1] - a[1])
                        .map(([fish, count]) => (
                          <span
                            key={fish}
                            className="px-2 py-1 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                          >
                            {fish} {count}×
                          </span>
                        ))}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Alle bleiben brav am Ferkensbruch 😉</p>
            )}
          </Card>,

          // 29) Schneiderkönig
          <Card key="schneiderKing" title="❌ Wer ist der Schneiderkönig?">
            {schneiderKoenig.winners.length > 0 ? (
              <ul className="space-y-2">
                {schneiderKoenig.winners.map((it, idx) => (
                  <li key={idx} className="flex items-center justify-between">
                    <span className="font-medium text-green-700 dark:text-green-300">
                      {it.angler}
                    </span>
                    <span className="font-bold text-xl text-green-700 dark:text-green-300">
                      {it.count}x
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Keine Schneidertage erfasst.</p>
            )}
          </Card>,

          // 30) 📉 Schlechtester Monat (meiste Schneidertage)
          <Card key="worstBlankMonth" title="📉 Schlechtester Monat (meiste Schneidertage)">
            {worstBlankMonth.max > 0 ? (
              <>
                <p className="mb-2">
                  Meiste Schneidertage:{' '}
                  <b className="text-green-700 dark:text-green-300">
                    {worstBlankMonth.max}
                  </b>
                </p>
                <ul className="space-y-1 mb-3">
                  {worstBlankMonth.winners.map((m, i) => (
                    <li key={i} className="flex justify-between">
                      <span className="font-medium">{monthLabel(m.month)}</span>
                      <span className="font-bold text-green-700 dark:text-green-300">
                        {m.count}x
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                  Rangliste (Top 5):
                </div>
                <ul className="space-y-1">
                  {worstBlankMonth.ranking.slice(0, 5).map((m, i) => (
                    <li key={i} className="flex justify-between text-sm">
                      <span>
                        {i + 1}. {monthLabel(m.month)}
                      </span>
                      <span className="font-semibold">{m.count}x</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p>Keine Schneidertage erfasst.</p>
            )}
          </Card>,

          // 31) 🔥 Heißester Fang (größter Fisch bei höchster Temperatur)
          <Card key="hottestCatch" title="🔥 Heißester Fang (größter Fisch bei höchster Temperatur)">
            {hottestCatch ? (
              <>
                <p className="mb-2">
                  Höchste Temperatur:{' '}
                  <b className="text-green-700 dark:text-green-300">
                    {hottestCatch.tempC.toFixed(1)}°C
                  </b>
                </p>
                <ul className="space-y-2">
                  {hottestCatch.items.map((f) => (
                    <li key={f.id} className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-green-700 dark:text-green-300">
                          {f.angler}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-300">
                          {f.fish} • {formatDateTimeDE(f.timestamp)}
                        </div>
                      </div>
                      <div className="text-xl font-bold text-green-700 dark:text-green-300">
                        {parseFloat(f.size).toFixed(0)} cm
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p>Keine Temperaturdaten vorhanden.</p>
            )}
          </Card>,

          // 32) ❄️ Kältester Fang (Frost)
          <Card key="frostCatch" title="❄️ Kältester Fang: Wer hat bei Frost gefangen? (≤ 0 °C)">
            {frostCatch.ranking.length > 0 ? (
              <>
                <ul className="space-y-2">
                  {frostCatch.winners.map((it, idx) => (
                    <li key={idx} className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-green-700 dark:text-green-300">
                          {it.angler}
                        </div>
                        {it.sample && (
                          <div className="text-xs text-gray-600 dark:text-gray-300">
                            Beispiel: {it.sample.fish} • {parseFloat(it.bestSize).toFixed(0)} cm • {formatDateTimeDE(it.sample.timestamp)}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-xl font-bold text-green-700 dark:text-green-300">
                          {it.count}x
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Frost-Fänge
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>

                <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                  Rangliste (Top 5):
                </div>
                <ul className="space-y-1">
                  {frostCatch.ranking.slice(0, 5).map((it, i) => (
                    <li key={i} className="flex justify-between text-sm">
                      <span>
                        {i + 1}. {it.angler}
                      </span>
                      <span className="font-semibold">{it.count}x</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p>Keine Frost-Fänge gefunden.</p>
            )}
          </Card>,

          // 32b) 🌩️ Extremster Wetterfang
          <Card key="extremeWeather" title="🌩️ Extremster Wetterfang">
            {extremeWeatherCatch ? (
              <>
                <p className="mb-2 text-sm text-gray-600 dark:text-gray-300">
                  Score basiert auf Temperatur, Wind, Niederschlag & Wetterbeschreibung – je höher, desto ungemütlicher.
                </p>
                <ul className="space-y-3">
                  {extremeWeatherCatch.ranking.slice(0, 3).map((item, idx) => {
                    const isWinner = Math.abs(item.score - extremeWeatherCatch.bestScore) < 1e-6;
                    return (
                      <li key={item.fish.id ?? idx} className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div
                            className={`font-medium ${
                              isWinner
                                ? 'text-pink-700 dark:text-pink-300'
                                : 'text-green-700 dark:text-green-300'
                            }`}
                          >
                            {item.fish.angler || 'Unbekannt'} {isWinner ? '👑' : ''}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-300">
                            {item.fish.fish} • {parseFloat(item.fish.size).toFixed(0)} cm • {formatDateTimeDE(item.fish.timestamp)}
                          </div>
                          {item.weatherDesc && (
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              Wetter: {item.weatherDesc}
                            </div>
                          )}
                          {item.highlights.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {item.highlights.map((text, i) => (
                                <Pill key={i}>{text}</Pill>
                              ))}
                            </div>
                          )}
                        </div>
                       
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : (
              <p className="text-gray-600 dark:text-gray-300">Noch keine Wetterdaten verfügbar.</p>
            )}
          </Card>,

          // 33) 📊 Ø Fische pro Angler-Tag (gesamt)
          <Card key="overallAvg" title="📊 Ø Fische pro Angler-Tag (gesamt)">
            {overallAvgPerAnglerDay.totalAnglerDays > 0 ? (
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="text-3xl font-bold text-green-700 dark:text-green-300">
                    {overallAvgPerAnglerDay.avg.toFixed(2)}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Ø Fische pro Angler-Tag
                  </div>
                </div>
                <div className="text-xs text-right text-gray-500 dark:text-gray-400">
                  Basis: {overallAvgPerAnglerDay.totalAnglerDays} Angler-Tage,
                  <br />
                  {overallAvgPerAnglerDay.totalFishes} Fänge
                </div>
              </div>
            ) : (
              <p>Keine Daten</p>
            )}
          </Card>,

          // ---------- Card: Angel-Queen
<Card key="queen" title="Wer ist unsere Angel-Queen?">
  {angelQueen.ranking.length === 0 ? (
    <p className="text-gray-600 dark:text-gray-300">
      Noch keine Fänge von Laura, Marilou oder Julia erfasst.
    </p>
  ) : (
    <>
      <p className="mb-2">
        <strong>{angelQueen.winners[0].total}</strong> Fänge – Queen
        {angelQueen.winners.length > 1 ? "s:" : ":"}{" "}
        {angelQueen.winners.map((w) => w.angler).join(" & ")} 👑
      </p>

      <ul className="space-y-2">
        {angelQueen.ranking.map((it, idx) => {
          const isWinner =
            angelQueen.winners.length > 0 &&
            it.total === angelQueen.winners[0].total;
          return (
            <li key={idx} className="flex items-start justify-between gap-3">
              <div className="space-y-0.5">
                <div
                  className={`font-medium ${
                    isWinner
                      ? "text-pink-700 dark:text-pink-300"
                      : "text-green-700 dark:text-green-300"
                  }`}
                >
                  {it.angler} {isWinner ? "👑" : ""}
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {/* optionaler Badge im gleichen Stil wie deine Pills */}
                  <Pill>{it.total} {it.total === 1 ? "Fang" : "Fänge"}</Pill>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  )}
</Card>,

//--------34--Card:Record-Hunter--
<Card key="record-hunter" title="Wer ist unser Rekordjäger?">
  {recordHunter.ranking.length === 0 ? (
    <p className="text-gray-600 dark:text-gray-300">
      Noch keine Rekorde ermittelt (größte Fische pro Art).
    </p>
  ) : (
    <>
      <p className="mb-2">
        <strong>{recordHunter.winners[0].total}</strong> Rekorde – Spitze:{' '}
        {recordHunter.winners.map((w) => w.angler).join(' & ')} 🏆
      </p>

      <ul className="space-y-2">
        {recordHunter.ranking.map((it, idx) => {
          const isWinner = it.total === recordHunter.winners[0].total;
          const shown = it.species.slice(0, 6);
          const more = Math.max(it.species.length - shown.length, 0);
          return (
            <li key={idx} className="flex items-start justify-between gap-3">
              <div className="space-y-0.5">
                <div
                  className={`font-medium ${
                    isWinner
                      ? 'text-pink-700 dark:text-pink-300'
                      : 'text-green-700 dark:text-green-300'
                  }`}
                >
                  {it.angler} {isWinner ? '👑' : ''}
                </div>

                <div className="flex flex-wrap gap-1 mt-1">
                  <Pill>{it.total} {it.total === 1 ? 'Rekord' : 'Rekorde'}</Pill>
                  {shown.map((s, i) => (
                    <Pill key={i}>
                      {s.name} • {Number.isFinite(s.max) ? `${Math.round(s.max)} cm` : '—'}
                    </Pill>
                  ))}
                  {more > 0 && <Pill>+{more} mehr</Pill>}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs opacity-70">
        Grundlage: größte gemessene Länge pro Fischart; Gleichstand → geteilte Rekorde.
      </p>
    </>
  )}
</Card>,

// ---------- Card: Foto-Künstler
<Card key="photo-artist" title="Wer ist unser Foto-Künstler?">
  {photoArtist.ranking.length === 0 ? (
    <p className="text-gray-600 dark:text-gray-300">Noch keine Fangfotos vorhanden.</p>
  ) : (
    <>
      <p className="mb-2">
        <strong>{photoArtist.winners[0].total}</strong> Fotos – Sieger
        {photoArtist.winners.length > 1 ? "innen" : ""}:{' '}
        {photoArtist.winners.map((w) => w.angler).join(' & ')} 📸
      </p>

      <ul className="space-y-2">
        {photoArtist.ranking.map((it, idx) => {
          const isWinner = it.total === photoArtist.winners[0].total;
          return (
            <li key={idx} className="flex items-start justify-between gap-3">
              <div className="space-y-0.5">
                <div
                  className={`font-medium ${
                    isWinner
                      ? 'text-pink-700 dark:text-pink-300'
                      : 'text-green-700 dark:text-green-300'
                  }`}
                >
                  {it.angler} {isWinner ? '👑' : ''}
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  <Pill>{it.total} {it.total === 1 ? 'Foto' : 'Fotos'}</Pill>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  )}
</Card>,



        ],
        seed
      ),
    [
      seed,
      mostInOneDay,
      biggest,
      smallest,
      mostInOneHour,
      mostSpeciesInOneDay,
      mostMonsterFishes,
      mostFishesDay,
      mostFishesMonth,
      topMonthsByAvgSize,
      mostFishesWeekday,
      mostSpeciesInOneHour,
      mostPlacesAngler,
      predatorKing,
      heaviestFish,
      mostEfficientAngler,
      mostRotaugen,
      mostAtFullMoon,
      nightOwls,
      earlyBird,
      mostInRain,
      sunshineOnly,
      topThreeSpecies,
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
      overallAvgPerAnglerDay,
      angelQueen,
      recordHunter,
      photoArtist
    ]
  );

  // ---------- EINZIGER Render-Return ----------
  return (
    <PageContainer>
      <h2 className="text-3xl font-bold mb-6 text-center text-green-700 dark:text-green-300">
        🎉 Fangfragen
      </h2>

      {loadError ? (
        <div className="p-6 text-center text-red-700 dark:text-red-300 space-y-3">
          <div className="font-semibold">Fehler beim Laden aus Supabase</div>
          <div className="text-sm opacity-80 break-words">{loadError}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Tipp: Prüfe Tabellenname (<code>fishes</code>), Spalten, RLS/Policies und die Supabase-Keys/URL.
          </div>
        </div>
      ) : loading ? (
        <div className="p-6 text-center text-gray-600 dark:text-gray-300">
          Lade Funfragen…
        </div>
      ) : validFishes.length === 0 ? (
        <div className="p-6 text-center text-gray-600 dark:text-gray-300">
          Keine Fänge in der aktuellen Sichtbarkeit.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {cards}
        </div>
      )}
    </PageContainer>
  );
}

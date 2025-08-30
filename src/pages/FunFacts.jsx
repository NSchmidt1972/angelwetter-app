// src/pages/FunFacts.jsx
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';

const PUBLIC_FROM = new Date('2025-06-01');
const vertraute = ['Nicol Schmidt', 'Laura Rittlinger'];

const PREDATOR_SET = new Set(['barsch', 'aal', 'hecht', 'zander', 'wels']);
const PREDATOR_LABELS = { barsch: 'Barsch', aal: 'Aal', hecht: 'Hecht', zander: 'Zander', wels: 'Wels' };

function formatDateTime(d) {
  return new Date(d).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
}
function groupBy(arr, keyFn) {
  return arr.reduce((map, item) => {
    const key = keyFn(item);
    if (!map[key]) map[key] = [];
    map[key].push(item);
    return map;
  }, {});
}
function dayKeyFromDate(dt) {
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}
function shuffleArray(array) {
  return array
    .map((item) => ({ item, rnd: Math.random() }))
    .sort((a, b) => a.rnd - b.rnd)
    .map(({ item }) => item);
}

export default function FunFacts() {
  const [fishes, setFishes] = useState([]);
  const [loading, setLoading] = useState(true);

  const anglerName = (localStorage.getItem('anglerName') || 'Unbekannt').trim();
  const istVertrauter = vertraute.includes(anglerName);
  const filterSetting = localStorage.getItem('dataFilter') ?? 'recent';

  function withTimeout(promise, ms = 8000) {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms))
    ]);
  }

  useEffect(() => {
    async function load() {
      try {
        const { data, error } = await withTimeout(
          supabase.from('fishes').select('*'),
          8000
        );
        if (error) throw error;

        const filtered = (data ?? []).filter((f) => {
          const fangDatum = new Date(f.timestamp);
          return vertraute.includes(anglerName)
            ? (filterSetting === 'all' || fangDatum >= PUBLIC_FROM)
            : fangDatum >= PUBLIC_FROM;
        });

        setFishes(filtered);
      } catch (e) {
        console.warn('Fänge konnten nicht geladen werden:', e.message);
        setFishes([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [istVertrauter, filterSetting]);

  // Nur verwertbare Fänge: kein blank, Fischname vorhanden, Größe > 0
  const validFishes = useMemo(() => {
    return fishes.filter((f) => {
      if (f.blank) return false;
      const nameOk =
        typeof f.fish === 'string' &&
        f.fish.trim() !== '' &&
        f.fish.toLowerCase() !== 'unbekannt';
      const size = parseFloat(f.size);
      return nameOk && !Number.isNaN(size) && size > 0;
    });
  }, [fishes]);

  // 1) Meiste Fische an einem Tag (pro Angler & Tag)
  const mostInOneDay = useMemo(() => {
    const byAnglerDay = groupBy(validFishes, (f) => {
      const dt = new Date(f.timestamp);
      return `${f.angler || 'Unbekannt'}__${dayKeyFromDate(dt)}`;
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
          examples: entries.slice().sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)),
        };
      }),
    };
  }, [validFishes]);

  // 2) Größter Fisch
  const biggest = useMemo(() => {
    if (validFishes.length === 0) return null;
    let max = -Infinity;
    validFishes.forEach((f) => {
      const s = parseFloat(f.size);
      if (!Number.isNaN(s) && s > max) max = s;
    });
    const top = validFishes.filter((f) => parseFloat(f.size) === max);
    return { size: max, items: top };
  }, [validFishes]);

  // 3) Kleinster Fisch (> 0)
  const smallest = useMemo(() => {
    if (validFishes.length === 0) return null;
    let min = Infinity;
    validFishes.forEach((f) => {
      const s = parseFloat(f.size);
      if (!Number.isNaN(s) && s > 0 && s < min) min = s;
    });
    const bottom = validFishes.filter((f) => parseFloat(f.size) === min);
    return { size: min, items: bottom };
  }, [validFishes]);

  // 4) Meiste Fische in einer Stunde (pro Angler innerhalb eines Stunden-Buckets)
  const mostInOneHour = useMemo(() => {
    const byAnglerHour = groupBy(validFishes, (f) => {
      const dt = new Date(f.timestamp);
      const hourLabel = `${dayKeyFromDate(dt)} ${String(dt.getHours()).padStart(2, '0')}:00`;
      return `${f.angler || 'Unbekannt'}__${hourLabel}`;
    });

    let best = 0;
    let winners = [];
    Object.entries(byAnglerHour).forEach(([key, entries]) => {
      const count = entries.length;
      if (count > best) {
        best = count;
        winners = [{ key, entries }];
      } else if (count === best) {
        winners.push({ key, entries });
      }
    });

    return {
      count: best,
      items: winners.map(({ key, entries }) => {
        const [angler, hourLabel] = key.split('__');
        return { angler, hourLabel, examples: entries.slice().sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)), };
      }),
    };
  }, [validFishes]);

  // Hilfs-Map: Gesamtanzahl Fänge pro (Angler, Tag) – nützlich für die Arten-Frage
  const totalPerAnglerDay = useMemo(() => {
    const map = {};
    validFishes.forEach((f) => {
      const dt = new Date(f.timestamp);
      const key = `${f.angler || 'Unbekannt'}__${dayKeyFromDate(dt)}`;
      map[key] = (map[key] || 0) + 1;
    });
    return map;
  }, [validFishes]);

  // 5) Meiste verschiedene Fischarten an einem Tag (pro Angler & Tag)
  const mostSpeciesInOneDay = useMemo(() => {
    const speciesMap = {}; // key -> Set(arten)
    validFishes.forEach((f) => {
      const dt = new Date(f.timestamp);
      const key = `${f.angler || 'Unbekannt'}__${dayKeyFromDate(dt)}`;
      const fishType = (f.fish || '').trim();
      if (!fishType) return;
      if (!speciesMap[key]) speciesMap[key] = new Set();
      speciesMap[key].add(fishType);
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
        return {
          angler,
          day,
          species: species.sort(),
          totalThatDay,
        };
      }),
    };
  }, [validFishes, totalPerAnglerDay]);

  // 6) Meiste Monsterfische (> 80 cm) pro Angler
  const mostMonsterFishes = useMemo(() => {
    const counts = {};
    validFishes.forEach((f) => {
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
  }, [validFishes]);

  // 7) Tag mit den meisten Fischen (gesamt, alle Angler)
  const mostFishesDay = useMemo(() => {
    if (validFishes.length === 0) return { count: 0, days: [] };

    const byDay = {};
    validFishes.forEach(f => {
      const d = new Date(f.timestamp);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      byDay[key] = (byDay[key] || 0) + 1;
    });

    let best = 0;
    let winners = [];
    Object.entries(byDay).forEach(([day, count]) => {
      if (count > best) { best = count; winners = [{ day, count }]; }
      else if (count === best) { winners.push({ day, count }); }
    });

    return { count: best, days: winners };
  }, [validFishes]);

  // 8) Monat mit den meisten Fischen (gesamt)
  const mostFishesMonth = useMemo(() => {
    if (validFishes.length === 0) return { count: 0, months: [] };

    const byMonth = {};
    validFishes.forEach(f => {
      const d = new Date(f.timestamp);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; // YYYY-MM
      byMonth[key] = (byMonth[key] || 0) + 1;
    });

    let best = 0;
    let winners = [];
    Object.entries(byMonth).forEach(([month, count]) => {
      if (count > best) { best = count; winners = [{ month, count }]; }
      else if (count === best) { winners.push({ month, count }); }
    });

    return { count: best, months: winners };
  }, [validFishes]);

  // 9) Bester Wochentag (gesamt)
  const mostFishesWeekday = useMemo(() => {
    if (validFishes.length === 0) return { max: 0, items: [] };

    const counts = new Array(7).fill(0); // 0=Mo … 6=So
    const toMon0 = (jsDay) => (jsDay + 6) % 7; // JS: 0=So → 0=Mo

    validFishes.forEach(f => {
      const d = new Date(f.timestamp);
      counts[toMon0(d.getDay())] += 1;
    });

    const labels = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
    const max = Math.max(...counts);

    const items = counts
      .map((count, i) => ({ label: labels[i], count }))
      .sort((a, b) => (b.count - a.count) || a.label.localeCompare(b.label))
      .map(it => ({ ...it, isBest: it.count === max && max > 0 }));

    return { max, items };
  }, [validFishes]);

  // 10) Meiste verschiedene Fischarten innerhalb einer Stunde (pro Angler & Stunden-Bucket)
  const mostSpeciesInOneHour = useMemo(() => {
    const speciesByKey = {}; // key -> Set(Arten)
    const listByKey = {};    // key -> alle Fänge in dieser Stunde (für "insgesamt ... Fänge")

    validFishes.forEach((f) => {
      const dt = new Date(f.timestamp);
      const hourLabel = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')} ${String(dt.getHours()).padStart(2,'0')}:00`;
      const who = f.angler || 'Unbekannt';
      const key = `${who}__${hourLabel}`;

      const fishType = (f.fish || '').trim();
      if (!fishType) return;

      if (!speciesByKey[key]) speciesByKey[key] = new Set();
      speciesByKey[key].add(fishType);

      if (!listByKey[key]) listByKey[key] = [];
      listByKey[key].push(f);
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
  }, [validFishes]);

  // 11. Nur location_name nutzen; NULL/leer/"null"/"...Lobberich..." => "Ferkensbruch"
  function normalizePlace(f) {
    const rawVal = f.location_name;
    const name = (rawVal == null ? '' : String(rawVal)).trim();
    const lower = name.toLowerCase();

    if (!name || lower === 'null') return 'Ferkensbruch';
    if (lower.includes('lobberich')) return 'Ferkensbruch';
    if (lower.includes('ferkensbruch')) return 'Ferkensbruch';

    return name.replace(/\s+/g, ' ');
  }

  // 12. Meiste unterschiedlichen Orte pro Angler (nur >1 Ort; "nur Ferkensbruch" wird ausgeblendet)
  const mostPlacesAngler = useMemo(() => {
    const placesByAngler = {}; // angler -> Set(places)

    validFishes.forEach((f) => {
      const who = (f.angler || 'Unbekannt').trim();
      if (!who) return;
      const place = normalizePlace(f);
      if (!place) return;
      if (!placesByAngler[who]) placesByAngler[who] = new Set();
      placesByAngler[who].add(place);
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

    const best = Math.max(...entries.map(e => e.count));
    const winners = entries
      .filter(e => e.count === best)
      .map(e => ({ angler: e.angler, count: e.count, places: e.places }));

    const ranking = [...entries].sort(
      (a, b) => (b.count - a.count) || a.angler.localeCompare(b.angler)
    );

    return { count: best, winners, ranking };
  }, [validFishes]);

  // 13. Raubfisch-König: Summe der Längen (Barsch, Aal, Hecht, Zander, Wels) pro Angler
  const predatorKing = useMemo(() => {
    const totals = {};        // angler -> sum(cm)
    const perSpecies = {};    // angler -> { species -> sum(cm) }

    validFishes.forEach((f) => {
      const type = (f.fish || '').toLowerCase().trim();
      if (!PREDATOR_SET.has(type)) return;

      const size = parseFloat(f.size);
      if (Number.isNaN(size) || size <= 0) return;

      const who = (f.angler || 'Unbekannt').trim();
      totals[who] = (totals[who] || 0) + size;
      if (!perSpecies[who]) perSpecies[who] = {};
      perSpecies[who][type] = (perSpecies[who][type] || 0) + size;
    });

    const entries = Object.entries(totals).map(([angler, sum]) => ({
      angler,
      sum,
      perSpecies: perSpecies[angler] || {}
    }));

    if (entries.length === 0) return { max: 0, winners: [], ranking: [] };

    entries.sort((a, b) => b.sum - a.sum || a.angler.localeCompare(b.angler));
    const max = entries[0].sum;
    const winners = entries.filter(e => Math.abs(e.sum - max) < 1e-9);

    return { max, winners, ranking: entries };
  }, [validFishes]);

  // 14. Dickstes Ding: schwerster Fisch (max Gewicht in kg)
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

  // 15. Effizienz: Fische pro Fangtag (Tage mit Eintrag; Schneidertage zählen mit, wenn erfasst)
  const mostEfficientAngler = useMemo(() => {
    if (fishes.length === 0) return { max: 0, winners: [], ranking: [] };

    const daysByAngler = {}; // angler -> Set(day)
    fishes.forEach((f) => {
      const who = (f.angler || 'Unbekannt').trim();
      if (!who) return;
      const day = dayKeyFromDate(new Date(f.timestamp));
      if (!daysByAngler[who]) daysByAngler[who] = new Set();
      daysByAngler[who].add(day);
    });

    const fishByAngler = {}; // angler -> count
    validFishes.forEach((f) => {
      const who = (f.angler || 'Unbekannt').trim();
      fishByAngler[who] = (fishByAngler[who] || 0) + 1;
    });

    const entries = Object.keys(daysByAngler).map((who) => {
      const days = daysByAngler[who].size;
      const fish = fishByAngler[who] || 0;
      const ratio = days > 0 ? fish / days : 0;
      return { angler: who, ratio, fish, days };
    }).filter(e => e.days > 0);

    if (entries.length === 0) return { max: 0, winners: [], ranking: [] };

    entries.sort((a, b) =>
      (b.ratio - a.ratio) || (b.fish - a.fish) || (a.days - b.days) || a.angler.localeCompare(b.angler)
    );

    const max = entries[0].ratio;
    const winners = entries.filter(e => Math.abs(e.ratio - max) < 1e-9);

    return { max, winners, ranking: entries };
  }, [fishes, validFishes]);

  // 16. 🐟 Meiste Rotaugen pro Angler
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
    validFishes.forEach((f) => {
      if (!isRotauge(f.fish)) return;
      const who = (f.angler || 'Unbekannt').trim();
      counts[who] = (counts[who] || 0) + 1;
    });

    const entries = Object.entries(counts).map(([angler, count]) => ({ angler, count }));
    if (entries.length === 0) return { max: 0, winners: [], ranking: [] };

    entries.sort((a, b) => (b.count - a.count) || a.angler.localeCompare(b.angler));
    const max = entries[0].count;
    const winners = entries.filter(e => e.count === max);

    return { max, winners, ranking: entries };
  }, [validFishes]);

  // 🌕 Vollmond-Helper
  function extractMoonPhase(f) {
    const w = f.weather;
    if (!w) return null;

    if (typeof w === 'object') {
      if (typeof w.moon_phase === 'number') return w.moon_phase;
      if (typeof w?.current?.moon_phase === 'number') return w.current.moon_phase;
      if (Array.isArray(w?.daily) && typeof w.daily[0]?.moon_phase === 'number') return w.daily[0].moon_phase;
      if (typeof w?.moon?.phase !== 'undefined') {
        const p = parseFloat(w.moon.phase);
        return Number.isNaN(p) ? null : p;
      }
      return null;
    }

    if (typeof w === 'string') {
      try {
        const obj = JSON.parse(w);
        return extractMoonPhase({ weather: obj });
      } catch {
        return null;
      }
    }
    return null;
  }
  const isFullMoon = (phase, eps = 0.06) =>
    phase != null && Math.abs(phase - 0.5) <= eps;

  // 17. 🌕 Wer fängt am meisten bei Vollmond?
  const mostAtFullMoon = useMemo(() => {
    const counts = {};

    validFishes.forEach((f) => {
      const phase = extractMoonPhase(f);
      if (!isFullMoon(phase)) return;
      const who = (f.angler || 'Unbekannt').trim();
      counts[who] = (counts[who] || 0) + 1;
    });

    const entries = Object.entries(counts).map(([angler, count]) => ({ angler, count }));
    if (entries.length === 0) return { max: 0, winners: [], ranking: [] };

    entries.sort((a, b) => (b.count - a.count) || a.angler.localeCompare(b.angler));
    const max = entries[0].count;
    const winners = entries.filter(e => e.count === max);

    return { max, winners, ranking: entries };
  }, [validFishes]);

  // 18.🦉 Nachteule
  const nightOwl = useMemo(() => {
    if (validFishes.length === 0) return { maxMin: null, winners: [], ranking: [] };

    const bestByAngler = {};
    const nightCounts = {};

    validFishes.forEach((f) => {
      const who = (f.angler || 'Unbekannt').trim();
      if (!who) return;

      const dt = new Date(f.timestamp);
      const minutes = dt.getHours() * 60 + dt.getMinutes();
      const isNight = dt.getHours() >= 22 || dt.getHours() < 5;

      if (!bestByAngler[who] || minutes > bestByAngler[who].minutes) {
        bestByAngler[who] = { minutes, entry: f };
      }
      if (isNight) nightCounts[who] = (nightCounts[who] || 0) + 1;
    });

    const toTimeLabel = (mins) =>
      new Date(1970, 0, 1, Math.floor(mins / 60), mins % 60)
        .toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

    const entries = Object.entries(bestByAngler).map(([angler, { minutes, entry }]) => ({
      angler,
      minutes,
      timeLabel: toTimeLabel(minutes),
      night: nightCounts[angler] || 0,
      sample: entry,
    }));

    if (entries.length === 0) return { maxMin: null, winners: [], ranking: [] };

    entries.sort((a, b) =>
      (b.minutes - a.minutes) || (b.night - a.night) || a.angler.localeCompare(b.angler)
    );

    const maxMin = entries[0].minutes;
    const winners = entries.filter(e => e.minutes === maxMin);

    return { maxMin, winners, ranking: entries };
  }, [validFishes]);

  // 19. 🌅 Früher Wurm: 04:30–09:00
  const earlyBird = useMemo(() => {
    if (validFishes.length === 0) return { minMin: null, winners: [], ranking: [], window: { start: '04:30', end: '09:00' } };

    const START_MIN = 4 * 60 + 30;
    const END_MIN   = 9 * 60;

    const bestByAngler = {};
    const earlyCounts = {};

    validFishes.forEach((f) => {
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
      new Date(1970, 0, 1, Math.floor(mins / 60), mins % 60)
        .toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

    const entries = Object.entries(bestByAngler).map(([angler, { minutes, entry }]) => ({
      angler,
      minutes,
      timeLabel: toTimeLabel(minutes),
      early: earlyCounts[angler] || 0,
      sample: entry,
    }));

    if (entries.length === 0) return { minMin: null, winners: [], ranking: [], window: { start: '04:30', end: '09:00' } };

    entries.sort((a, b) =>
      (a.minutes - b.minutes) || (b.early - a.early) || a.angler.localeCompare(b.angler)
    );

    const minMin = entries[0].minutes;
    const winners = entries.filter(e => e.minutes === minMin);

    return { minMin, winners, ranking: entries, window: { start: '04:30', end: '09:00' } };
  }, [validFishes]);

  // 20. Regen-Helper
  function extractWeatherTextLower(f) {
    const direct =
      f.weather_description ??
      f.weather_desc ??
      f.weatherText ??
      f.conditions ??
      null;
    if (typeof direct === 'string' && direct.trim()) return direct.toLowerCase();

    if (typeof f.weather === 'string') {
      try {
        const obj = JSON.parse(f.weather);
        return extractWeatherTextLower({ weather: obj }) || '';
      } catch {
        return f.weather.toLowerCase();
      }
    }

    const w = (typeof f.weather === 'object' && f.weather) ? f.weather : null;
    if (!w) return '';

    const parts = [];
    const take = (v) => { if (v != null && String(v).trim()) parts.push(String(v).toLowerCase()); };

    take(w?.weather?.[0]?.description || w?.weather?.[0]?.main);
    take(w?.current?.weather?.[0]?.description || w?.current?.weather?.[0]?.main);
    take(w.description);
    take(w.summary);
    take(w.text);

    return parts.join(' ');
  }
  function hasPrecipAmount(w) {
    const pickNums = (vals) => vals.map((v) => Number(v)).filter((n) => !Number.isNaN(n));
    const nums = w ? pickNums([
      w?.rain?.['1h'], w?.rain?.['3h'],
      w?.current?.rain?.['1h'], w?.current?.rain?.['3h'],
      w?.precipitation, w?.current?.precipitation,
      w?.snow?.['1h'], w?.snow?.['3h'],
    ]) : [];
    return nums.some((n) => n > 0);
  }
  const RAIN_REGEX = /(regen|regenschauer|niesel|sprühregen|schauer|rain|drizzle|shower)/i;
  function isRainyCatch(f) {
    const text = extractWeatherTextLower(f);
    if (text && RAIN_REGEX.test(text)) return true;

    let wObj = null;
    if (typeof f.weather === 'object' && f.weather) wObj = f.weather;
    else if (typeof f.weather === 'string') {
      try { wObj = JSON.parse(f.weather); } catch {}
    }
    return hasPrecipAmount(wObj);
  }

  // 21. 🌧️ Wer fängt am meisten bei Regen?
  const mostInRain = useMemo(() => {
    const counts = {};
    const examples = {};

    validFishes.forEach((f) => {
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

    entries.sort((a, b) => (b.count - a.count) || a.angler.localeCompare(b.angler));
    const max = entries[0].count;
    const winners = entries.filter(e => e.count === max);

    return { max, winners, ranking: entries };
  }, [validFishes]);

  // 22. ☀️ Sonnenschein-Helper
  function getWeatherTextLower(f) {
    const direct =
      f.weather_description ??
      f.weather_desc ??
      f.weatherText ??
      f.conditions ??
      null;
    if (typeof direct === 'string' && direct.trim()) return direct.toLowerCase();

    if (typeof f.weather === 'string') {
      try {
        const obj = JSON.parse(f.weather);
        return getWeatherTextLower({ weather: obj }) || '';
      } catch {
        return f.weather.toLowerCase();
      }
    }
    const w = (typeof f.weather === 'object' && f.weather) ? f.weather : null;
    if (!w) return '';

    const parts = [];
    const take = (v) => { if (v != null && String(v).trim()) parts.push(String(v).toLowerCase()); };

    take(w?.weather?.[0]?.description || w?.weather?.[0]?.main);
    take(w?.current?.weather?.[0]?.description || w?.current?.weather?.[0]?.main);
    take(w.description);
    take(w.summary);
    take(w.text);

    const icon = w?.weather?.[0]?.icon || w?.current?.weather?.[0]?.icon;
    if (icon === '01d') parts.push('clear sky');

    return parts.join(' ');
  }
  const SUNNY_REGEX = /(klarer himmel|wolkenlos|heiter|clear sky|sunny|sonnig)/i;
  function isSunnyCatch(f) {
    const text = getWeatherTextLower(f);
    return !!text && SUNNY_REGEX.test(text);
  }

  // 23. ☀️ Wer angelt ausschließlich bei Sonnenschein?
  const sunshineOnly = useMemo(() => {
    if (validFishes.length === 0) return { winners: [], ranking: [] };

    const totalBy = {};
    const sunnyBy = {};
    validFishes.forEach((f) => {
      const who = (f.angler || 'Unbekannt').trim();
      if (!who) return;

      const txt = getWeatherTextLower(f);
      if (!txt) return;

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

    entries.sort((a, b) => (b.total - a.total) || a.angler.localeCompare(b.angler));

    return { winners: entries, ranking: entries };
  }, [validFishes]);

  // 24. 🐟 Top 3 Fischarten
  const topThreeSpecies = useMemo(() => {
    const counts = {};
    validFishes.forEach((f) => {
      const s = (f.fish || '').trim();
      if (!s) return;
      counts[s] = (counts[s] || 0) + 1;
    });

    const list = Object.entries(counts)
      .map(([species, count]) => ({ species, count }))
      .sort((a, b) => (b.count - a.count) || a.species.localeCompare(b.species));

    const top3 = list.slice(0, 3);
    const max = top3[0]?.count || 0;

    return { max, items: top3 };
  }, [validFishes]);

  // 25. ⏳ Längste Pause zwischen Fangtagen
  const longestBreakBetweenCatchDays = useMemo(() => {
    if (validFishes.length === 0) return { gap: 0, winners: [], ranking: [] };

    const daysByAngler = {};
    validFishes.forEach((f) => {
      const who = (f.angler || 'Unbekannt').trim();
      if (!who) return;
      const day = dayKeyFromDate(new Date(f.timestamp));
      (daysByAngler[who] ||= new Set()).add(day);
    });

    const parseDayUTC = (k) => new Date(`${k}T00:00:00Z`);
    const diffDays = (a, b) => Math.round((parseDayUTC(b) - parseDayUTC(a)) / 86400000);

    const entries = [];
    Object.entries(daysByAngler).forEach(([angler, set]) => {
      const days = [...set].sort();
      if (days.length < 2) return;
      let maxGap = 0;
      let from = days[0], to = days[0];

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

    entries.sort((a, b) => (b.gap - a.gap) || a.angler.localeCompare(b.angler));
    const best = entries[0].gap;
    const winners = entries.filter(e => e.gap === best);

    return { gap: best, winners, ranking: entries };
  }, [validFishes]);

  const formatDay = (k) =>
    new Date(`${k}T00:00:00Z`).toLocaleDateString('de-DE', { year: '2-digit', month: '2-digit', day: '2-digit' });

  // 26. 🔥 Längste Fangserie
  const longestCatchStreak = useMemo(() => {
    if (validFishes.length === 0) return { len: 0, winners: [], ranking: [] };

    const daysByAngler = {};
    validFishes.forEach((f) => {
      const who = (f.angler || 'Unbekannt').trim();
      if (!who) return;
      const day = dayKeyFromDate(new Date(f.timestamp));
      (daysByAngler[who] ||= new Set()).add(day);
    });

    const parseDayUTC = (k) => new Date(`${k}T00:00:00Z`);
    const diffDays = (a, b) => Math.round((parseDayUTC(b) - parseDayUTC(a)) / 86400000);

    const entries = [];
    Object.entries(daysByAngler).forEach(([angler, set]) => {
      const days = [...set].sort();
      if (days.length === 0) return;

      let maxLen = 1, bestStart = days[0], bestEnd = days[0];
      let curLen = 1, curStart = days[0], curEnd = days[0];

      for (let i = 1; i < days.length; i++) {
        if (diffDays(days[i - 1], days[i]) === 1) {
          curLen += 1;
          curEnd = days[i];
        } else {
          if (curLen > maxLen) { maxLen = curLen; bestStart = curStart; bestEnd = curEnd; }
          curLen = 1; curStart = days[i]; curEnd = days[i];
        }
      }
      if (curLen > maxLen) { maxLen = curLen; bestStart = curStart; bestEnd = curEnd; }

      entries.push({ angler, length: maxLen, from: bestStart, to: bestEnd, totalCatchDays: days.length });
    });

    if (entries.length === 0) return { len: 0, winners: [], ranking: [] };

    entries.sort((a, b) => (b.length - a.length) || a.angler.localeCompare(b.angler));
    const best = entries[0].length;
    const winners = entries.filter(e => e.length === best);

    return { len: best, winners, ranking: entries };
  }, [validFishes]);

  // 27. 👥 Wer fängt gern zusammen? (Paare)
  const fishPairs = useMemo(() => {
    if (validFishes.length === 0) return { winners: [], top3: [], lauraNicol: null };

    const dayKey = (ts) => new Date(ts).toISOString().split("T")[0];
    const sessions = {};
    validFishes.forEach(f => {
      const key = `${dayKey(f.timestamp)}__${f.lat?.toFixed(3)}_${f.lon?.toFixed(3)}`;
      (sessions[key] ||= []).push(f);
    });

    const pairCounts = {};
    Object.values(sessions).forEach(fishesOfSession => {
      const anglers = [...new Set(fishesOfSession.map(f => f.angler).filter(Boolean))];
      if (anglers.length < 2) return;
      for (let i = 0; i < anglers.length; i++) {
        for (let j = i + 1; j < anglers.length; j++) {
          const a = anglers[i], b = anglers[j];
          const key = [a, b].sort().join(" & ");
          pairCounts[key] = (pairCounts[key] || 0) + fishesOfSession.length;
        }
      }
    });

    const sorted = Object.entries(pairCounts)
      .map(([pair, count]) => {
        const [a, b] = pair.split(" & ");
        return { a, b, count };
      })
      .sort((x, y) => y.count - x.count);

    let top3 = sorted.slice(0, 3);

    const lauraNicolKey = ["Laura Rittlinger", "Nicol Schmidt"].sort().join(" & ");
    const lauraNicol = sorted.find(p => [p.a, p.b].sort().join(" & ") === lauraNicolKey);

    if (lauraNicol && !top3.some(p => [p.a, p.b].sort().join(" & ") === lauraNicolKey)) {
      top3 = [...top3, lauraNicol];
    }

    return {
      winners: sorted.length > 0 ? [sorted[0]] : [],
      top3,
      lauraNicol
    };
  }, [validFishes]);

  // 28. 🧙‍♂️ Aal-Magier
  const eelWizard = useMemo(() => {
    const onlyEels = validFishes.filter(
      (f) => f.fish?.trim().toLowerCase() === "aal"
    );
    if (onlyEels.length === 0) return null;

    const byAngler = {};
    onlyEels.forEach((f) => {
      const who = (f.angler || "Unbekannt").trim();
      byAngler[who] = (byAngler[who] || 0) + 1;
    });

    const sorted = Object.entries(byAngler)
      .map(([angler, count]) => ({ angler, count }))
      .sort((a, b) => b.count - a.count);

    return sorted[0];
  },

    [validFishes]);

  // 29. 🏆 Grundel-Champion
  const grundelChampion = useMemo(() => {
    const onlyGrundeln = validFishes.filter(
      (f) => f.fish?.trim().toLowerCase() === "grundel"
    );
    if (onlyGrundeln.length === 0) return null;

    const byAngler = {};
    onlyGrundeln.forEach((f) => {
      const who = (f.angler || "Unbekannt").trim();
      byAngler[who] = (byAngler[who] || 0) + 1;
    });

    const sorted = Object.entries(byAngler)
      .map(([angler, count]) => ({ angler, count }))
      .sort((a, b) => b.count - a.count);

    return sorted[0];
  }, [validFishes]);

  // 30. 🌍 Wer angelt gern fremd? (per location_name)
  const foreignAnglers = useMemo(() => {
    if (validFishes.length === 0) return { top3: [] };

    const byAngler = {};

    for (const f of validFishes) {
      const loc = (f.location_name || "").trim();
      if (!loc || ["Ferkensbruch", "Lobberich"].includes(loc)) continue;

      const who = (f.angler || "Unbekannt").trim();
      if (!byAngler[who]) {
        byAngler[who] = { total: 0, byFish: {}, byLocation: {} };
      }

      byAngler[who].total += 1;

      const species = f.fish || "Unbekannt";
      byAngler[who].byFish[species] = (byAngler[who].byFish[species] || 0) + 1;

      byAngler[who].byLocation[loc] = (byAngler[who].byLocation[loc] || 0) + 1;
    }

    const ranking = Object.entries(byAngler)
      .map(([angler, stats]) => ({ angler, ...stats }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 3);

    return { top3: ranking };
  }, [validFishes]);

  function monthLabel(ym) {
    const [y, m] = ym.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
  }

  // ========= Render & Shuffle =========

 const Card = ({ title, children }) => (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
      <h3 className="text-lg font-semibold text-blue-700 dark:text-blue-300 mb-2">{title}</h3>
      {children}
    </div>
  );
  const Pill = ({ children }) => (
    <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
      {children}
    </span>
  );

  // ⬇️ WICHTIG: cards (useMemo) VOR allen returns definieren!
  const cards = useMemo(() => shuffleArray([
    /* 1) Meiste Fische an einem Tag */
    <Card key="day" title="Wer hat die meisten Fische an einem Tag gefangen?">
      <p className="mb-2">
        <strong>{mostInOneDay.count}</strong> Fänge – Rekordhalter:
      </p>
      <ul className="space-y-2">
        {mostInOneDay.items.map((it, idx) => (
          <li key={idx} className="flex items-start justify-between gap-3">
            <div className="space-y-0.5">
              <div className="font-medium text-green-700 dark:text-green-300">{it.angler}</div>
              <div className="text-sm text-gray-600 dark:text-gray-300">{it.day}</div>
              <div className="flex flex-wrap gap-1 mt-1">
                {it.examples.map((e) => (
                  <Pill key={e.id}>
                    {e.fish} • {parseFloat(e.size).toFixed(0)} cm •{' '}
                    {new Date(e.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
                  </Pill>
                ))}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </Card>,

    /* 2) Größter Fisch */
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
                    {f.fish} • {formatDateTime(f.timestamp)}
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

    /* 3) Kleinster Fisch */
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
                    {f.fish} • {formatDateTime(f.timestamp)}
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

    /* 4) Meiste Fische in einer Stunde */
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

    /* 5) Meiste Fischarten an einem Tag */
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
                  <div className="text-sm text-gray-600 dark:text-gray-300">{it.day}</div>
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

    /* 6) Meiste Monsterfische */
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

    /* 7) Tag mit den meisten Fischen */
    <Card key="dayMax" title="📅 An welchem Tag wurden die meisten Fische gefangen?">
      {mostFishesDay.count > 0 ? (
        <>
          <p className="mb-2">Insgesamt <b className="text-green-700 dark:text-green-300">{mostFishesDay.count}</b> Fänge.</p>
          <ul className="space-y-1">
            {mostFishesDay.days.map((d, i) => (
              <li key={i} className="flex justify-between">
                <span className="font-medium">{d.day}</span>
                <span className="font-bold text-green-700 dark:text-green-300">{d.count}x</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p>Keine Daten</p>
      )}
    </Card>,

    /* 8) Monat mit den meisten Fischen */
    <Card key="monthMax" title="📅 In welchem Monat gab es die meisten Fische?">
      {mostFishesMonth.count > 0 ? (
        <>
          <p className="mb-2">Insgesamt <b className="text-green-700 dark:text-green-300">{mostFishesMonth.count}</b> Fänge.</p>
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

    /* 9) Wochentag Ranking */
    <Card key="weekday" title="🗓️ Welcher Wochentag bringt die meisten Fänge?">
      {mostFishesWeekday.items.length > 0 ? (
        <ul className="space-y-1">
          {mostFishesWeekday.items.map((it, i) => (
            <li key={i} className="flex justify-between">
              <span className={`font-medium ${it.isBest ? 'text-green-700 dark:text-green-300' : ''}`}>
                {it.label}
              </span>
              <span className={`font-bold ${it.isBest ? 'text-green-700 dark:text-green-300' : ''}`}>
                {it.count}x
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p>Keine Daten</p>
      )}
    </Card>,

    /* 10) Meiste Fischarten in 1 Stunde */
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
                  <div className="text-sm text-gray-600 dark:text-gray-300">{it.hourLabel} Uhr</div>
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

    /* 11) Orte */
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
                  <div className="font-medium text-green-700 dark:text-green-300">
                    {it.angler}
                  </div>
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

    /* 12) Raubfisch-König */
    <Card key="predator" title="👑 Wer ist der Raubfisch-König? (Gesamtlänge: Barsch, Aal, Hecht, Zander, Wels)">
      {predatorKing.winners.length > 0 ? (
        <ul className="space-y-2">
          {predatorKing.winners.map((it, idx) => (
            <li key={idx} className="flex items-start justify-between gap-3">
              <div className="max-w-[70%]">
                <div className="font-medium text-green-700 dark:text-green-300">{it.angler}</div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {Object.entries(it.perSpecies)
                    .sort((a, b) => b[1] - a[1])
                    .map(([sp, cm]) => (
                      <Pill key={sp}>{PREDATOR_LABELS[sp] ?? sp} {Math.round(cm)} cm</Pill>
                    ))}
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

    /* 13) Dickstes Ding (Gewicht) */
    <Card key="heavy" title="🏋️ Wer hat das dickste Ding gefangen? (max Gewicht)">
      {heaviestFish ? (
        <>
          <p className="mb-2">
            Schwerster Fang: <b className="text-green-700 dark:text-green-300">{heaviestFish.weight.toFixed(1)} kg</b>
          </p>
          <ul className="space-y-2">
            {heaviestFish.items.map((f) => (
              <li key={f.id} className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium text-green-700 dark:text-green-300">{f.angler}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-300">
                    {f.fish}
                    {parseFloat(f.size) > 0 ? ` • ${parseFloat(f.size).toFixed(0)} cm` : ''} • {formatDateTime(f.timestamp)}
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

    /* 14) Effizienz */
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

    /* 15) Rotaugen */
    <Card key="rotauge" title="🐟 Wer fängt beim ASV Rotauge die meisten Rotaugen?">
      {mostRotaugen.winners.length > 0 ? (
        <ul className="space-y-2">
          {mostRotaugen.winners.map((it, idx) => (
            <li key={idx} className="flex items-center justify-between">
              <div className="font-medium text-green-700 dark:text-green-300">{it.angler}</div>
              <div className="text-xl font-bold text-green-700 dark:text-green-300">{it.count}x</div>
            </li>
          ))}
        </ul>
      ) : (
        <p>Keine Rotaugen gefangen.</p>
      )}
    </Card>,

    /* 16) Vollmond */
    <Card key="fullmoon" title="🌕 Wer fängt am meisten bei Vollmond?">
      {mostAtFullMoon.winners.length > 0 ? (
        <ul className="space-y-2">
          {mostAtFullMoon.winners.map((it, idx) => (
            <li key={idx} className="flex items-center justify-between">
              <div className="font-medium text-green-700 dark:text-green-300">{it.angler}</div>
              <div className="text-xl font-bold text-green-700 dark:text-green-300">{it.count}x</div>
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

    /* 17) Nachteule */
    <Card key="night" title="🦉 Wer ist unsere Nachteule am See? (späteste Fangzeit)">
      {nightOwl.winners.length > 0 ? (
        <ul className="space-y-2">
          {nightOwl.winners.map((it, idx) => (
            <li key={idx} className="flex items-start justify-between gap-3">
              <div className="max-w-[70%]">
                <div className="font-medium text-green-700 dark:text-green-300">{it.angler}</div>
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  Spätester Fang um {it.timeLabel} Uhr
                </div>
                {it.sample && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Beispiel: {it.sample.fish}
                    {parseFloat(it.sample.size) > 0 ? ` • ${parseFloat(it.sample.size).toFixed(0)} cm` : ''} • {formatDateTime(it.sample.timestamp)}
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="text-xl font-bold text-green-700 dark:text-green-300">{it.timeLabel}</div>
                <div className="mt-1">
                  <Pill>🌙 Nachtfänge: {it.night}</Pill>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p>Keine Daten</p>
      )}
    </Card>,

    /* 18) Early Bird */
    <Card key="early" title="🌅 Wer fängt den frühen Wurm? (früheste Fangzeit)">
      {earlyBird.winners.length > 0 ? (
        <ul className="space-y-2">
          {earlyBird.winners.map((it, idx) => (
            <li key={idx} className="flex items-start justify-between gap-3">
              <div className="max-w-[70%]">
                <div className="font-medium text-green-700 dark:text-green-300">{it.angler}</div>
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  Frühester Fang um {it.timeLabel} Uhr
                </div>
                {it.sample && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Beispiel: {it.sample.fish}
                    {parseFloat(it.sample.size) > 0 ? ` • ${parseFloat(it.sample.size).toFixed(0)} cm` : ''} • {formatDateTime(it.sample.timestamp)}
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="text-xl font-bold text-green-700 dark:text-green-300">{it.timeLabel}</div>
                <div className="mt-1">
                  <Pill>🌅 Frühfänge: {it.early} (04:30–09:00)</Pill>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p>Keine Daten</p>
      )}
    </Card>,

    /* 19) Regen */
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
                      {new Date(e.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} • {e.fish}
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

    /* 20) Sonnenschein only */
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

    /* 21) Top 3 Arten */
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

    /* 22) Längste Pause */
    <Card key="pause" title="⏳ Wer muss sich am längsten zwischen den Fangtagen ausruhen?">
      {longestBreakBetweenCatchDays.winners.length > 0 ? (
        <ul className="space-y-2">
          {longestBreakBetweenCatchDays.winners.map((it, idx) => (
            <li key={idx} className="flex items-start justify-between gap-3">
              <div className="max-w-[70%]">
                <div className="font-medium text-green-700 dark:text-green-300">{it.angler}</div>
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  Pause von {formatDay(it.from)} bis {formatDay(it.to)}
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

    /* 23) Längste Serie */
    <Card key="streak" title="🔥 Wer hat die längste Fangserie hingelegt? (aufeinanderfolgende Fangtage)">
      {longestCatchStreak.winners.length > 0 ? (
        <ul className="space-y-2">
          {longestCatchStreak.winners.map((it, idx) => (
            <li key={idx} className="flex items-start justify-between gap-3">
              <div className="max-w-[70%]">
                <div className="font-medium text-green-700 dark:text-green-300">{it.angler}</div>
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  Serie von {it.length} Tag{it.length === 1 ? '' : 'en'}: {formatDay(it.from)} – {formatDay(it.to)}
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

    /* 24) Paare */
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
          {fishPairs.top3
            .filter(
              (p) =>
                !["Laura Rittlinger", "Nicol Schmidt"]
                  .sort()
                  .join(" & ")
                  .includes([p.a, p.b].sort().join(" & "))
            )
            .map((p, idx) => (
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

    /* 25) Aal-Magier */
    <Card key="eel" title="🧙‍♂️ Aal-Magier">
      {eelWizard ? (
        <div className="flex items-center justify-between">
          <span className="text-green-700 dark:text-green-300 font-medium">
            {eelWizard.angler}
          </span>
          <span className="font-bold text-xl text-green-700 dark:text-green-300">
            {eelWizard.count} Aale
          </span>
        </div>
      ) : (
        <p className="text-gray-600 dark:text-gray-400">
          Noch kein Aal gefangen.
        </p>
      )}
    </Card>,

    /* 26) Grundel-Champion */
    <Card key="grundel" title="🏆 Grundel-Champion">
      {grundelChampion ? (
        <div className="flex items-center justify-between">
          <span className="text-green-700 dark:text-green-300 font-medium">
            {grundelChampion.angler}
          </span>
          <span className="font-bold text-xl text-green-700 dark:text-green-300">
            {grundelChampion.count} {grundelChampion.count === 1 ? 'Grundel' : 'Grundeln'}
          </span>
        </div>
      ) : (
        <p className="text-gray-600 dark:text-gray-400">
          Noch keine Grundeln gefangen.
        </p>
      )}
    </Card>,

    /* 27) Fremdangeln */
    <Card key="foreign" title="🌍 Wer angelt gern fremd?">
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
                📍 {Object.entries(p.byLocation)
                  .map(([loc, cnt]) => `${loc} (${cnt})`)
                  .join(", ")}
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

  ]), [
    mostInOneDay, biggest, smallest, mostInOneHour, mostSpeciesInOneDay,
    mostMonsterFishes, mostFishesDay, mostFishesMonth, mostFishesWeekday,
    mostSpeciesInOneHour, mostPlacesAngler, predatorKing, heaviestFish,
    mostEfficientAngler, mostRotaugen, mostAtFullMoon, nightOwl, earlyBird,
    mostInRain, sunshineOnly, topThreeSpecies, longestBreakBetweenCatchDays,
    longestCatchStreak, fishPairs, eelWizard, grundelChampion, foreignAnglers
  ]);

  // ⬇️ Early-Returns JETZT – nachdem ALLE Hooks aufgerufen wurden
  if (loading) {
    return <div className="p-6 text-center text-gray-600 dark:text-gray-300">Lade Funfragen…</div>;
  }

  if (validFishes.length === 0) {
    return <div className="p-6 text-center text-gray-600 dark:text-gray-300">Keine Fänge in der aktuellen Sichtbarkeit.</div>;
  }

  return (
    <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen text-gray-800 dark:text-gray-100">
      <h2 className="text-3xl font-bold mb-6 text-center text-green-700 dark:text-green-300">🎉 Fangfragen</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
        {cards}
      </div>
    </div>
  );
}

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

export default function FunFacts() {
  const [fishes, setFishes] = useState([]);
  const [loading, setLoading] = useState(true);

  const anglerName = (localStorage.getItem('anglerName') || 'Unbekannt').trim();
  const istVertrauter = vertraute.includes(anglerName);
  const filterSetting = localStorage.getItem('dataFilter') ?? 'recent';

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase.from('fishes').select('*');
      if (error) {
        console.error('Fehler beim Laden der Fänge:', error);
        setLoading(false);
        return;
      }
      // Sichtbarkeit wie auf deinen anderen Seiten
      const filtered = data.filter((f) => {
        const fangDatum = new Date(f.timestamp);
        if (istVertrauter) {
          if (filterSetting === 'all') return true;
          return fangDatum >= PUBLIC_FROM;
        }
        return fangDatum >= PUBLIC_FROM;
      });

      setFishes(filtered);
      setLoading(false);
    }
    load();
  }, [istVertrauter, filterSetting]);

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
      setFishes([]); // graceful fallback
    } finally {
      setLoading(false); // <- Tippfehler vermeiden: hier sollte false stehen!
      // KORREKT:
      // setLoading(false);
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

  // sortiert nach Count absteigend; bei Gleichstand alphabetisch nach Label
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

  // kleine Normalisierung (mehrfache Spaces entfernen)
  return name.replace(/\s+/g, ' ');
}

// ️⃣ Meiste unterschiedlichen Orte pro Angler
// ️⃣ Meiste unterschiedlichen Orte pro Angler (nur >1 Ort; "nur Ferkensbruch" wird ausgeblendet)
const mostPlacesAngler = useMemo(() => {
  const placesByAngler = {}; // angler -> Set(places)

  validFishes.forEach((f) => {
    const who = (f.angler || 'Unbekannt').trim();
    if (!who) return;
    const place = normalizePlace(f); // nutzt deine Funktion, die "Lobberich"/NULL => "Ferkensbruch" mappt
    if (!place) return;
    if (!placesByAngler[who]) placesByAngler[who] = new Set();
    placesByAngler[who].add(place);
  });

  // Nur Angler behalten, die nicht ausschließlich "Ferkensbruch" haben
  const entries = Object.entries(placesByAngler)
    .map(([angler, set]) => {
      const places = [...set].sort();
      const onlyFerkensbruch = places.length === 1 && places[0] === 'Ferkensbruch';
      if (onlyFerkensbruch) return null; // rausfiltern
      return { angler, places, count: places.length }; // Ferkensbruch wird mitgezählt, wenn andere Orte existieren
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

// 12. Raubfisch-König: Summe der Längen (Barsch, Aal, Hecht, Zander, Wels) pro Angler
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

// 13. Dickstes Ding: schwerster Fisch (max Gewicht in kg)
const heaviestFish = useMemo(() => {
  // nur Fänge mit gültigem Gewicht > 0
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

  // alle mit Maximalgewicht (Gleichstand)
  const items = withWeight.filter((f) => parseFloat(f.weight) === maxW);

  return { weight: maxW, items };
}, [validFishes]);


// 14. Effizienz: Fische pro Fangtag (Tage mit Eintrag; Schneidertage zählen mit, wenn erfasst)
const mostEfficientAngler = useMemo(() => {
  if (fishes.length === 0) return { max: 0, winners: [], ranking: [] };

  // Tage pro Angler (inkl. blank/Schneidertag)
  const daysByAngler = {}; // angler -> Set(day)
  fishes.forEach((f) => {
    const who = (f.angler || 'Unbekannt').trim();
    if (!who) return;
    const day = dayKeyFromDate(new Date(f.timestamp));
    if (!daysByAngler[who]) daysByAngler[who] = new Set();
    daysByAngler[who].add(day);
  });

  // Fische pro Angler (ohne blank)
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

  // Sortierung: beste Quote ↓, dann mehr Fische, dann weniger Tage, dann Name
  entries.sort((a, b) =>
    (b.ratio - a.ratio) || (b.fish - a.fish) || (a.days - b.days) || a.angler.localeCompare(b.angler)
  );

  const max = entries[0].ratio;
  const winners = entries.filter(e => Math.abs(e.ratio - max) < 1e-9);

  return { max, winners, ranking: entries };
}, [fishes, validFishes]);


function monthLabel(ym) {
  const [y,m] = ym.split('-').map(Number);
  return new Date(y, m-1, 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
}


  if (loading) {
    return <div className="p-6 text-center text-gray-600 dark:text-gray-300">Lade Funfragen…</div>;
  }

  if (validFishes.length === 0) {
    return <div className="p-6 text-center text-gray-600 dark:text-gray-300">Keine Fänge in der aktuellen Sichtbarkeit.</div>;
  }

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

  return (
    <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen text-gray-800 dark:text-gray-100">
      <h2 className="text-3xl font-bold mb-6 text-center text-green-700 dark:text-green-300">🎉 Fangfragen</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
        {/* 1) Meiste Fische an einem Tag */}
        <Card title="Wer hat die meisten Fische an einem Tag gefangen?">
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
        </Card>

        {/* 2) Größter Fisch */}
        <Card title="Wer hat den größten Fisch gefangen?">
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
        </Card>

        {/* 3) Kleinster Fisch */}
        <Card title="Wer hat den kleinsten Fisch gefangen?">
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
        </Card>

        {/* 4) Meiste Fische in einer Stunde */}
        <Card title="Wer hat die meisten Fische in einer Stunde gefangen?">
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
        </Card>

        {/* 5) Meiste Fischarten an einem Tag */}
        <Card title="Wer hat die meisten Fischarten an einem Tag gefangen?">
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
        </Card>
{/* 6) Meiste Monsterfische */}
<Card title="Wer hat die meisten Monsterfische (>80 cm) gefangen?">
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
</Card>
{/* 7) Tag mit den meisten Fischen */}
<Card title="📅 An welchem Tag wurden die meisten Fische gefangen?">
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
</Card>
{/* 8 Monat mit den meisten Fischen */}
<Card title="📅 In welchem Monat gab es die meisten Fische?">
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
</Card>

{/* 9) Wochentage in Reihenfolge (Mo–So) */}
<Card title="🗓️ Welcher Wochentag bringt die meisten Fänge?">
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
</Card>

{/* 9) Meiste Fischarten in 1 Stunde */}
<Card title="Wer hat die meisten Fischarten in 1 Stunde gefangen?">
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
</Card>

{/* 10. Wer hat an den meisten unterschiedlichen Orten geangelt? */}
<Card title="🧭 Wer hat an den meisten unterschiedlichen Orten geangelt?">
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
</Card>

{/* 👑 Raubfisch-König */}
<Card title="👑 Wer ist der Raubfisch-König? (Gesamtlänge: Barsch, Aal, Hecht, Zander, Wels)">
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
</Card>

{/* 🏋️ Wer hat das dickste Ding gefangen? (max Gewicht) */}
<Card title="🏋️ Wer hat das dickste Ding gefangen? (max Gewicht)">
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
</Card>

{/* 🏅 Wer angelt am effizientesten? (Fische pro Fangtag) */}
<Card title="🏅 Wer angelt am effizientesten? (Fische pro Fangtag)">
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
</Card>

      </div>
    </div>
  );
}

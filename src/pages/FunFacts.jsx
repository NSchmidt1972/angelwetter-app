// src/pages/FunFacts.jsx
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';

const PUBLIC_FROM = new Date('2025-06-01');
const vertraute = ['Nicol Schmidt', 'Laura Rittlinger'];

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



      </div>
    </div>
  );
}

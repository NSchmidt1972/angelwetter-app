import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import PageContainer from '../components/PageContainer';
import { isFerkensbruchLocation } from '@/utils/location';

export default function Leaderboard() {
  const [fishes, setFishes] = useState([]);
  const [formattedNamesMap, setFormattedNamesMap] = useState({});
  const [showIntern, setShowIntern] = useState(false);
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const rawName = (localStorage.getItem('anglerName') || 'Unbekannt').trim();
  const anglerNameLC = rawName.toLowerCase();

  const vertraute = ['nicol schmidt', 'laura rittlinger'];
  const PUBLIC_FROM = new Date('2025-05-29');

  // ✅ Marilou-Erkennung (mehrere Schreibweisen möglich)
  const MARILOU_ALIASES = ['marilou', 'marilou boes'];
  const isMarilouName = (name) =>
    MARILOU_ALIASES.includes((name || '').trim().toLowerCase());
  const isCurrentUserMarilou = isMarilouName(rawName);

  // ⬇️ Nur zählbare Fänge laden
  useEffect(() => {
    async function loadData() {
      // lade nur die Felder, die wir hier brauchen
      const { data, error } = await supabase
        .from('fishes')
        .select('fish,size,angler,timestamp,location_name,count_in_stats,under_min_size,out_of_season')
        .eq('count_in_stats', true); // <— Hauptfilter

      if (error) {
        console.error('Fehler beim Laden der Fänge:', error);
        setFishes([]);
        return;
      }

      setFishes(data || []);
    }
    loadData();
  }, []);

  useEffect(() => {
    async function prepareFormattedNames() {
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('name');

      if (error) {
        console.error('Fehler beim Laden der Profile:', error);
        return;
      }

      const mapping = {};
      (profileData || []).forEach((p) => {
        const full = (p.name || '').trim();
        if (full) mapping[full] = full; // immer vollständiger Name
      });
      setFormattedNamesMap(mapping);
    }
    prepareFormattedNames();
  }, []);

  // 🔒 Clientseitige Zusatzsicherheit (falls mal alte Zeilen ohne Flag dabei sind)
  const eligibleFishes = fishes.filter((f) => {
    // 0) Falls Flag vorhanden: harte Schranke
    if (typeof f.count_in_stats === 'boolean' && f.count_in_stats === false) return false;

    // 1) Standort prüfen (nur Ferkensbruch zählt in der Rangliste)
    if (!isFerkensbruchLocation(f.location_name)) return false;

    // 2) Basis-Sichtbarkeit (wie gehabt)
    const fangDatum = new Date(f.timestamp);
    const istAbNeu = fangDatum >= PUBLIC_FROM;

    const fangVonVertrautem = vertraute.includes(
      (f.angler || '').trim().toLowerCase()
    );
    const eingeloggtVertraut = vertraute.includes(anglerNameLC);

    const darfSehenBasis = showIntern
      ? (eingeloggtVertraut && fangVonVertrautem)
      : istAbNeu;

    // 3) verwertbar (Größe vorhanden > 0)
    const size = parseFloat(f.size);
    const istVerwertbar =
      f.fish && f.fish !== 'Unbekannt' && !isNaN(size) && size > 0;

    // 4) Marilou-Regel
    const istFangVonMarilou = isMarilouName(f.angler);
    if (istFangVonMarilou) {
      return isCurrentUserMarilou && istVerwertbar;
    }

    // 5) Optionaler Fallback auf Roh-Flags, falls count_in_stats fehlt
    if (typeof f.count_in_stats !== 'boolean') {
      if (f.under_min_size === true || f.out_of_season === true) return false;
    }

    return darfSehenBasis && istVerwertbar;
  });

  const availableYears = useMemo(() => {
    const years = new Set();
    years.add(currentYear);
    eligibleFishes.forEach((f) => {
      const ts = f.timestamp ? new Date(f.timestamp) : null;
      if (!ts || Number.isNaN(ts.getTime())) return;
      years.add(ts.getFullYear());
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [eligibleFishes, currentYear]);

  useEffect(() => {
    if (availableYears.length === 0) return;
    if (selectedYear == null) {
      setSelectedYear(currentYear);
      return;
    }
    if (selectedYear !== 'all' && !availableYears.includes(selectedYear)) {
      setSelectedYear(currentYear);
    }
  }, [availableYears, selectedYear, currentYear]);

  const filteredFishes = useMemo(() => {
    if (selectedYear === 'all' || !Number.isFinite(selectedYear)) return eligibleFishes;
    return eligibleFishes.filter((f) => {
      const ts = f.timestamp ? new Date(f.timestamp) : null;
      if (!ts || Number.isNaN(ts.getTime())) return false;
      return ts.getFullYear() === selectedYear;
    });
  }, [eligibleFishes, selectedYear]);

  // Punkte/Zusammenfassung
  const byAngler = {};
  filteredFishes.forEach((f) => {
    const name = f.angler || 'Unbekannt';
    if (!byAngler[name]) {
      byAngler[name] = { total: 0, sizeSum: 0, byFish: {}, sizesByFish: {} };
    }
    const size = parseFloat(f.size) || 0;
    byAngler[name].total += 1;
    byAngler[name].sizeSum += size;
    const fishType = f.fish || 'Unbekannt';
    byAngler[name].byFish[fishType] =
      (byAngler[name].byFish[fishType] || 0) + size;

    if (!byAngler[name].sizesByFish[fishType]) {
      byAngler[name].sizesByFish[fishType] = { sum: 0, count: 0 };
    }
    byAngler[name].sizesByFish[fishType].sum += size;
    byAngler[name].sizesByFish[fishType].count += 1;
  });

  const ranking = Object.entries(byAngler)
    .map(([name, stats]) => {
      const totalPoints = Object.values(stats.byFish).reduce((a, b) => a + b, 0);
      return { name, ...stats, totalPoints };
    })
    .sort((a, b) => b.totalPoints - a.totalPoints);

  const wertungsCount = filteredFishes.length;

  if (filteredFishes.length === 0) {
    return (
      <PageContainer>
        <p className="text-center text-gray-500 dark:text-gray-400 mt-6">
          Keine Fänge zum Anzeigen.
        </p>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <h2 className="text-3xl font-bold mb-6 text-center text-green-700 dark:text-green-300">
        🏆 Rangliste
      </h2>

      <p className="text-center text-xs text-gray-500 dark:text-gray-400 -mt-4 mb-6">
        Wertungsfische insgesamt:{' '}
        <span className="font-semibold text-gray-700 dark:text-gray-200">{wertungsCount}</span>
        {selectedYear === 'all' ? (
          <span className="ml-2 text-gray-600 dark:text-gray-300">• Alle Jahre</span>
        ) : (
          Number.isFinite(selectedYear) && (
            <span className="ml-2 text-gray-600 dark:text-gray-300">• Jahr: {selectedYear}</span>
          )
        )}
      </p>

      {vertraute.includes(anglerNameLC) && (
        <div className="flex justify-center items-center mb-6">
          <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600 dark:text-gray-300">
            <span>Laura vs. Nicol</span>
            <input
              type="checkbox"
              checked={showIntern}
              onChange={() => setShowIntern(!showIntern)}
              className="accent-green-600 w-5 h-5"
            />
          </label>
        </div>
      )}

      {availableYears.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2 mb-6">
          {['all', ...availableYears].map((year) => {
            const isAll = year === 'all';
            return (
              <button
                key={isAll ? 'all' : year}
                type="button"
                onClick={() => setSelectedYear(year)}
                className={`rounded-full border px-4 py-1 text-sm transition ${
                  selectedYear === year
                    ? 'border-green-600 bg-green-600 text-white font-semibold dark:border-green-400 dark:bg-green-500 dark:text-gray-900'
                    : 'border-green-400 bg-white text-green-700 hover:bg-green-50 dark:border-green-500 dark:bg-gray-800 dark:text-green-300 dark:hover:bg-gray-700'
                }`}
                aria-pressed={selectedYear === year}
              >
                {isAll ? 'Alle Jahre' : year}
              </button>
            );
          })}
        </div>
      )}

      <div className="space-y-6 max-w-3xl mx-auto">
        {ranking.map((a, i) => (
          <div
            key={i}
            className="p-5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 shadow-md"
          >
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">
              #{i + 1} {formattedNamesMap[a.name] || a.name}
            </h3>

            <p className="text-sm text-gray-600 dark:text-gray-300">
              🎣 {a.total} {a.total === 1 ? 'Fang' : 'Fänge'} • 📏 Durchschnitt:{' '}
              {(a.sizeSum / a.total).toFixed(1)} cm
            </p>

            <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
              🏆 Punkte:{' '}
              <span className="font-mono font-semibold text-green-700 dark:text-green-300">
                {a.totalPoints.toFixed(0)} Punkte
              </span>
            </p>

            <table className="w-full text-sm text-left font-mono text-gray-700 dark:text-gray-300">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-1 font-sans">Fischart</th>
                  <th className="text-right py-1">Ø Größe</th>
                  <th className="text-right pr-2 py-1">Punkte</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(a.byFish)
                  .sort(([, pA], [, pB]) => pB - pA)
                  .map(([f, p]) => {
                    const sizeData = a.sizesByFish?.[f];
                    const avg =
                      sizeData && sizeData.count > 0
                        ? (sizeData.sum / sizeData.count).toFixed(1)
                        : '-';
                    return (
                      <tr
                        key={f}
                        className="border-b border-gray-100 dark:border-gray-700"
                      >
                        <td className="font-sans py-1">{f}</td>
                        <td className="text-right py-1">{avg} cm</td>
                        <td className="text-right pr-2 py-1">{p.toFixed(0)} Pkt.</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </PageContainer>
  );
}

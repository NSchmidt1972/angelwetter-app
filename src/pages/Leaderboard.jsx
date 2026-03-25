import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import { getActiveClubId } from '@/utils/clubId';
import { useAppResumeTick } from '@/hooks/useAppResumeSync';
import { useFormattedNamesMap } from '@/hooks/useFormattedNamesMap';
import { useViewerContext } from '@/hooks/useViewerContext';
import { useClubCoordinates } from '@/hooks/useClubCoordinates';
import PageContainer from '../components/PageContainer';
import { isHomeWaterEntry } from '@/utils/location';
import { Card } from '@/components/ui';
import { isValuableFishEntry, parseFishSize } from '@/utils/fishValidation';
import { isMarilouAngler, isTrustedAngler, isVisibleByDate } from '@/utils/visibilityPolicy';

const PRESET_YEARS = [2025, 2026];

export default function Leaderboard() {
  const resumeTick = useAppResumeTick({ enabled: true });
  const [fishes, setFishes] = useState([]);
  const { clubCoords, reload: reloadClubCoords } = useClubCoordinates({
    timeoutLabel: 'Leaderboard Club-Koordinaten timeout',
    onError: (error) => {
      console.warn('Leaderboard: Club-Koordinaten konnten nicht geladen werden:', error?.message || error);
    },
  });
  const formattedNamesMap = useFormattedNamesMap();
  const [showIntern, setShowIntern] = useState(false);
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const { isMarilouViewer: isCurrentUserMarilou, isTrustedViewer } = useViewerContext();

  // ⬇️ Nur zählbare Fänge laden
  useEffect(() => {
    let active = true;
    async function loadData() {
      // lade nur die Felder, die wir hier brauchen
      const clubId = getActiveClubId();
      const { data, error } = await supabase
        .from('fishes')
        .select('fish,size,angler,timestamp,location_name,lat,lon,waterbody_id,count_in_stats,under_min_size,out_of_season')
        .eq('club_id', clubId)
        .eq('count_in_stats', true); // <— Hauptfilter

      if (error) {
        console.error('Fehler beim Laden der Fänge:', error);
        if (active) setFishes([]);
        return;
      }

      if (active) setFishes(data || []);
    }
    void reloadClubCoords();
    void loadData();
    return () => {
      active = false;
    };
  }, [reloadClubCoords, resumeTick]);

  // 🔒 Clientseitige Zusatzsicherheit (falls mal alte Zeilen ohne Flag dabei sind)
  const eligibleFishes = useMemo(
    () =>
      fishes.filter((f) => {
        // 0) Falls Flag vorhanden: harte Schranke
        if (typeof f.count_in_stats === 'boolean' && f.count_in_stats === false) return false;

        // 1) Standort prüfen (nur Heimgewässer des aktiven Clubs zählt in der Rangliste)
        if (!isHomeWaterEntry(f, { clubCoords })) return false;

        // 2) Basis-Sichtbarkeit (wie gehabt)
        const istAbNeu = isVisibleByDate(f?.timestamp, {
          isTrusted: false,
          filterSetting: 'recent',
        });

        const fangVonVertrautem = isTrustedAngler(f?.angler);
        const eingeloggtVertraut = isTrustedViewer;

        const darfSehenBasis = showIntern
          ? (eingeloggtVertraut && fangVonVertrautem)
          : istAbNeu;

        // 3) verwertbar (Größe vorhanden > 0)
        const istVerwertbar = isValuableFishEntry(f, { requireNotBlank: false });

        // 4) Marilou-Regel
        const istFangVonMarilou = isMarilouAngler(f?.angler);
        if (istFangVonMarilou) {
          return isCurrentUserMarilou && istVerwertbar;
        }

        // 5) Optionaler Fallback auf Roh-Flags, falls count_in_stats fehlt
        if (typeof f.count_in_stats !== 'boolean') {
          if (f.under_min_size === true || f.out_of_season === true) return false;
        }

        return darfSehenBasis && istVerwertbar;
      }),
    [fishes, showIntern, isTrustedViewer, isCurrentUserMarilou, clubCoords]
  );

  const availableYears = useMemo(() => {
    const years = new Set();
    PRESET_YEARS.forEach((y) => years.add(y));
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
    if (selectedYear !== 'all' && !availableYears.includes(selectedYear)) {
      setSelectedYear(currentYear);
    }
  }, [availableYears, currentYear, selectedYear]);

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
    const size = parseFishSize(f.size) || 0;
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

      {isTrustedViewer && (
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
                {isAll ? 'Alle' : year}
              </button>
            );
          })}
        </div>
      )}

      <div className="space-y-6 max-w-3xl mx-auto">
        {ranking.length === 0 ? (
          <p className="text-center text-gray-500 dark:text-gray-400 mt-6">
            Keine Fänge zum Anzeigen.
          </p>
        ) : (
          ranking.map((a, i) => (
            <Card
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
            </Card>
          ))
        )}
      </div>
    </PageContainer>
  );
}

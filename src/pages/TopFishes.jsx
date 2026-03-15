import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAppResumeTick } from '@/hooks/useAppResumeSync';
import { useFormattedNamesMap } from '@/hooks/useFormattedNamesMap';
import { useViewerContext } from '@/hooks/useViewerContext';
import { supabase } from '@/supabaseClient';
import { getActiveClubId } from '@/utils/clubId';
import { withTimeout } from '@/utils/async';
import PageContainer from '../components/PageContainer';
import { formatLocationLabel, isHomeWaterEntry } from '@/utils/location';
import { Card } from '@/components/ui';
import { hasKnownFishName, isValuableFishEntry, normalizeFishName, parseFishSize } from '@/utils/fishValidation';
import { isMarilouAngler, isVisibleByDate } from '@/utils/visibilityPolicy';
import { FISH_SELECT, fetchClubFishesQuery } from '@/services/fishes';

export default function TopFishes() {
  const resumeTick = useAppResumeTick({ enabled: true });
  const [searchParams, setSearchParams] = useSearchParams();
  const [fishes, setFishes] = useState([]);
  const [selectedFish, setSelectedFish] = useState(() => searchParams.get('fish') || '');
  const formattedNamesMap = useFormattedNamesMap();
  const [onlyMine, setOnlyMine] = useState(false);
  const [clubCoords, setClubCoords] = useState(null);
  const lastSelectedRef = useRef(null);

  const {
    anglerName,
    anglerNameNorm,
    filterSetting,
    isTrustedViewer,
    isMarilouViewer,
  } = useViewerContext();

  useEffect(() => {
    let active = true;
    async function loadClubCoords() {
      try {
        const clubId = getActiveClubId();
        if (!clubId) {
          if (active) setClubCoords(null);
          return;
        }
        const { data, error } = await withTimeout(
          supabase
            .from('clubs')
            .select('weather_lat, weather_lon')
            .eq('id', clubId)
            .maybeSingle(),
          10000,
          'TopFishes Club-Koordinaten timeout'
        );
        if (error) throw error;
        const lat = Number(data?.weather_lat);
        const lon = Number(data?.weather_lon);
        if (!active) return;
        setClubCoords(Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null);
      } catch (error) {
        if (!active) return;
        setClubCoords(null);
        console.warn('TopFishes: Club-Koordinaten konnten nicht geladen werden:', error?.message || error);
      }
    }
    void loadClubCoords();
    return () => {
      active = false;
    };
  }, [resumeTick]);

  useEffect(() => {
    let active = true;
    async function loadData() {
      const { data, error } = await fetchClubFishesQuery({ select: FISH_SELECT.TOP });
      if (error || !Array.isArray(data)) {
        console.error('Fehler beim Laden der Fische:', error);
        if (active) setFishes([]);
        return;
      }

      const filtered = data.filter((f) => {
        const istMarilou = isMarilouAngler(f?.angler) || f?.is_marilou === true;
        if (istMarilou && !isMarilouViewer) return false;

        if (onlyMine) {
          return (f.angler || '').trim() === anglerName;
        }

        if (!isHomeWaterEntry(f, { clubCoords })) return false;
        if (!isValuableFishEntry(f)) return false;

        return isVisibleByDate(f?.timestamp, {
          isTrusted: isTrustedViewer,
          filterSetting,
        });
      });

      if (active) setFishes(filtered);
    }

    void loadData();
    return () => {
      active = false;
    };
  }, [clubCoords, filterSetting, onlyMine, anglerName, isMarilouViewer, isTrustedViewer, resumeTick]);

  useEffect(() => {
    const param = searchParams.get('fish') || '';
    if (lastSelectedRef.current !== null && param === lastSelectedRef.current) {
      lastSelectedRef.current = null;
    }

    if (param !== selectedFish && lastSelectedRef.current === null) {
      setSelectedFish(param);
    }
  }, [searchParams, selectedFish]);

  const allTypes = [...new Set(
    fishes
      .map((f) => normalizeFishName(f.fish))
      .filter((fish) => hasKnownFishName(fish))
  )].sort();

  const handleFishChange = (value) => {
    lastSelectedRef.current = value;
    setSelectedFish(value);
    const next = new URLSearchParams(searchParams);
    if (value) next.set('fish', value);
    else next.delete('fish');
    setSearchParams(next, { replace: true });
  };

  const selectedFishEntries = fishes.filter((f) =>
    f.fish === selectedFish &&
    f.angler &&
    isValuableFishEntry(f) &&
    (onlyMine || isHomeWaterEntry(f, { clubCoords }))
  );

  const selectedFishCount = selectedFishEntries.length;

  const top10 = selectedFishEntries
    .sort((a, b) => {
      const sizeA = parseFloat(a.size);
      const sizeB = parseFloat(b.size);

      if (Number.isFinite(sizeA) && Number.isFinite(sizeB) && sizeA !== sizeB) {
        return sizeB - sizeA;
      }

      if (Number.isFinite(sizeA) && !Number.isFinite(sizeB)) return -1;
      if (!Number.isFinite(sizeA) && Number.isFinite(sizeB)) return 1;

      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();

      if (Number.isFinite(timeA) && Number.isFinite(timeB) && timeA !== timeB) {
        return timeA - timeB;
      }

      if (Number.isFinite(timeA) && !Number.isFinite(timeB)) return -1;
      if (!Number.isFinite(timeA) && Number.isFinite(timeB)) return 1;

      return 0;
    })
    .slice(0, 10);

  return (
    <PageContainer>
      <h2 className="text-3xl font-bold mb-6 text-center text-blue-700 dark:text-blue-300">🏅 Top 10</h2>

      <div className="max-w-md mx-auto mb-4 flex justify-between items-center text-sm text-gray-600 dark:text-gray-300">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={onlyMine}
            onChange={(e) => setOnlyMine(e.target.checked)}
            className="accent-blue-600"
          />
          Nur meine
        </label>
      </div>

      <div className="max-w-md mx-auto mb-8">
        <select
          value={selectedFish}
          onChange={(e) => handleFishChange(e.target.value)}
          className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="">Fischart auswählen</option>
          {allTypes.map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
      </div>

      {selectedFish && (
        <div className="max-w-3xl mx-auto">
          <h3 className="text-xl font-semibold text-green-700 dark:text-green-300 mb-4 text-center">
            {selectedFish}
          </h3>

          <p className="text-center text-xs text-gray-500 dark:text-gray-400 mb-2">
            Insgesamt {selectedFishCount} wertungsfähige Fische
          </p>

          <div className="overflow-x-auto">
            <Card as="table" className="min-w-full text-sm text-left font-mono bg-white dark:bg-gray-800 shadow-md rounded-xl overflow-hidden">
              <thead className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-200">
                <tr>
                  <th className="px-4 py-2">#</th>
                  {!onlyMine && <th className="px-4 py-2">Angler</th>}
                  <th className="px-4 py-2 text-right">Größe</th>
                  <th className="px-4 py-2 text-right">Datum</th>
                  {onlyMine && <th className="px-4 py-2">Ort</th>}
                </tr>
              </thead>
              <tbody>
                {top10.map((f, i) => {
                  const dateStr = new Date(f.timestamp).toLocaleDateString('de-DE');
                  const nameKey = (f.angler || '').trim();
                  const displayName = formattedNamesMap[nameKey] || f.angler || 'Unbekannt';
                  const isCurrentAngler = nameKey && nameKey.toLowerCase() === anglerNameNorm;

                  const ort = formatLocationLabel(f.location_name);

                  const sizeNum = parseFishSize(f.size);
                  const sizeFormatted = Number.isFinite(sizeNum) ? `${sizeNum.toFixed(1)} cm` : '–';

                  return (
                    <tr
                      key={f.id || `${f.angler}-${f.timestamp}-${i}`}
                      className={`border-t border-gray-200 dark:border-gray-700 transition ${
                        isCurrentAngler
                          ? 'bg-blue-50/60 dark:bg-blue-900/20 font-semibold'
                          : 'hover:bg-blue-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      <td className="px-4 py-2">{i + 1}</td>
                      {!onlyMine && (
                        <td className={`px-4 py-2 font-sans ${isCurrentAngler ? 'text-blue-700 dark:text-blue-300' : ''}`}>
                          {displayName}
                        </td>
                      )}
                      <td className="px-4 py-2 text-right">{sizeFormatted}</td>
                      <td className="px-4 py-2 text-right">{dateStr}</td>
                      {onlyMine && <td className="px-4 py-2 font-sans">{ort}</td>}
                    </tr>
                  );
                })}
                {top10.length === 0 && (
                  <tr>
                    <td colSpan={onlyMine ? 4 : 4} className="px-4 py-6 text-center text-gray-500">
                      Keine wertungsfähigen Fänge
                    </td>
                  </tr>
                )}
              </tbody>
            </Card>
          </div>
        </div>
      )}
    </PageContainer>
  );
}

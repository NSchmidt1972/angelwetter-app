// src/components/catchlist/CatchList.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useCatches } from '../../hooks/useCatches';
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll';

import SkeletonCard from './SkeletonCard';
import EditCatchModal from './EditCatchModal';
import PhotoLightbox from './PhotoLightbox';

import { shareEntry } from '../../utils/share';
import { windDirection, getMoonDescription } from '../../utils/weather';
import { supabase } from '@/supabaseClient';
import { getActiveClubId } from '@/utils/clubId';
import { REACTION_OPTIONS } from '@/constants/reactions';
import { isVisibleToUser } from '@/utils/filters';
import { useReactions } from '@/hooks/useReactions';
import { useAppResumeTick } from '@/hooks/useAppResumeSync';
import { useLocalStorageValue } from '@/hooks/useLocalStorageValue';
import { useClubCoordinates } from '@/hooks/useClubCoordinates';
import { formatLocationLabel, isHomeWaterEntry } from '@/utils/location';
import { withTimeout } from '@/utils/async';
import { isValuableFishEntry, parseFishSize } from '@/utils/fishValidation';
import { isTrustedAngler } from '@/utils/visibilityPolicy';
import { usePermissions } from '@/permissions/usePermissions';
import { FEATURES } from '@/permissions/features';
import { listWaterbodiesByClub } from '@/services/waterbodiesService';

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

export default function CatchList({ anglerName }) {
  const { hasFeatureForRole } = usePermissions();
  const canSeeWaterTemperature = hasFeatureForRole(FEATURES.WATER_TEMPERATURE);
  const resumeTick = useAppResumeTick({ enabled: true });
  const [onlyMine, setOnlyMine] = useState(false);
  const [topBadges, setTopBadges] = useState({});
  const { clubCoords, reload: reloadClubCoords } = useClubCoordinates({
    timeoutLabel: 'Club-Koordinaten timeout',
    onError: (error) => {
      console.warn('Club-Koordinaten konnten nicht geladen werden:', error?.message || error);
    },
  });
  const [searchParams, setSearchParams] = useSearchParams();

  const {
    catches,
    loading,
    hasMore,
    totalCount,
    loadNext,
    sentinelRef,
    updateEntry,
    deleteEntry,
    setExternalVisibility,
    isVisibilityPending,
  } = useCatches(anglerName, onlyMine, { clubCoords });
  const [filterSetting] = useLocalStorageValue('dataFilter', 'recent');

  const [openMenuId, setOpenMenuId] = useState(null);
  const [modalPhoto, setModalPhoto] = useState(null);
  const [editingEntry, setEditingEntry] = useState(null);
  const [waterbodyNameById, setWaterbodyNameById] = useState({});
  const [activeReactionFish, setActiveReactionFish] = useState(null);
  const longPressTimer = useRef(null);
  const reactionMenuRef = useRef(null);

  const navigate = useNavigate();
  const { clubSlug } = useParams();
  const clubBasePath = clubSlug ? `/${clubSlug}` : '';
  const viewMode = searchParams.get('view') === 'gallery' ? 'gallery' : 'list';

  useInfiniteScroll({ ref: sentinelRef, hasMore, loading, onHit: loadNext });

  const normalizedName = useMemo(() => (anglerName || '').trim(), [anglerName]);
  const isTrusted = useMemo(() => isTrustedAngler(normalizedName), [normalizedName]);
  const {
    loadReactionsFor,
    reactToFish,
    getReactionsFor,
    getUserReactionFor,
    isPending: isReactionPending,
  } = useReactions(normalizedName);

  useEffect(() => {
    void reloadClubCoords();
  }, [clubSlug, reloadClubCoords, resumeTick]);

  const entryKey = useCallback(
    (entry) => entry.id ?? `${entry.angler || 'anon'}-${entry.timestamp}-${entry.fish}-${entry.size}`,
    []
  );

  const catchesWithPhotos = useMemo(
    () => catches.filter((entry) => typeof entry.photo_url === 'string' && entry.photo_url.trim() !== ''),
    [catches]
  );

  const featuredPhotoCatch = useMemo(() => {
    if (!catchesWithPhotos.length) return null;
    return catchesWithPhotos.reduce((best, current) => {
      if (!best) return current;
      const bestSize = Number.parseFloat(best.size) || 0;
      const currentSize = Number.parseFloat(current.size) || 0;
      if (currentSize === bestSize) {
        return new Date(current.timestamp).getTime() > new Date(best.timestamp).getTime() ? current : best;
      }
      return currentSize > bestSize ? current : best;
    }, null);
  }, [catchesWithPhotos]);

  const galleryEntries = useMemo(() => {
    const sortedByTime = catchesWithPhotos
      .slice()
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    if (!featuredPhotoCatch) return sortedByTime;
    const featuredKey = entryKey(featuredPhotoCatch);
    return sortedByTime.filter((entry) => entryKey(entry) !== featuredKey);
  }, [catchesWithPhotos, featuredPhotoCatch, entryKey]);

  useEffect(() => {
    let cancelled = false;

    async function loadTopTen() {
      try {
        const clubId = getActiveClubId();
        const { data, error } = await withTimeout(
          supabase
            .from('fishes')
            .select('id, fish, size, angler, timestamp, location_name, lat, lon, waterbody_id, blank, share_public_non_home')
            .eq('club_id', clubId),
          16000,
          'Top10 timeout'
        );
        if (error) {
          console.error('Top 10 laden:', error);
          return;
        }

        const valid = (data || [])
          .filter((entry) => {
            if (!isValuableFishEntry(entry)) return false;
            if (!isHomeWaterEntry(entry, { clubCoords })) return false;
            return isVisibleToUser(entry, {
              isTrusted,
              onlyMine: false,
              anglerName: normalizedName,
              filterSetting,
              clubCoords,
            });
          })
          .map((entry) => ({ ...entry, sizeNum: parseFishSize(entry.size) || 0, key: entryKey(entry) }));

        const byFish = new Map();
        for (const entry of valid) {
          const fishName = entry.fish?.trim();
          if (!fishName) continue;
          if (!byFish.has(fishName)) byFish.set(fishName, []);
          byFish.get(fishName).push(entry);
        }

        const nextBadges = {};
        for (const [fishName, list] of byFish.entries()) {
          list.sort(
            (a, b) =>
              b.sizeNum - a.sizeNum ||
              new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          );
          list.slice(0, 10).forEach((entry, index) => {
            nextBadges[entry.key] = { fish: fishName, rank: index + 1 };
          });
        }

        if (!cancelled) setTopBadges(nextBadges);
      } catch (err) {
        console.error('Top 10 laden (allgemeiner Fehler):', err);
      }
    }

    loadTopTen();

    return () => {
      cancelled = true;
    };
  }, [clubCoords, filterSetting, isTrusted, normalizedName, entryKey, resumeTick]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const clubId = getActiveClubId();
        if (!clubId) {
          if (active) setWaterbodyNameById({});
          return;
        }
        const rows = await listWaterbodiesByClub(clubId, { activeOnly: false });
        if (!active) return;
        const nextMap = Object.fromEntries(
          (Array.isArray(rows) ? rows : [])
            .filter((row) => row?.id && row?.name)
            .map((row) => [row.id, row.name]),
        );
        setWaterbodyNameById(nextMap);
      } catch {
        if (active) setWaterbodyNameById({});
      }
    })();
    return () => {
      active = false;
    };
  }, [clubSlug, resumeTick]);

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const startLongPress = useCallback(
    (fishId) => {
      if (!fishId || !normalizedName) return;
      cancelLongPress();
      longPressTimer.current = setTimeout(() => {
        setActiveReactionFish(fishId);
      }, 550);
    },
    [cancelLongPress, normalizedName]
  );

  const closeReactionMenu = useCallback(() => {
    setActiveReactionFish(null);
    cancelLongPress();
  }, [cancelLongPress]);

  const handleReactionSelect = useCallback(
    (fishId, reaction) => {
      closeReactionMenu();
      reactToFish(fishId, reaction);
    },
    [closeReactionMenu, reactToFish]
  );

  useEffect(() => {
    return () => cancelLongPress();
  }, [cancelLongPress]);

  useEffect(() => {
    if (!catches.length) return;
    loadReactionsFor(catches.map((entry) => entry.id).filter(Boolean));
  }, [catches, loadReactionsFor, onlyMine, normalizedName, resumeTick]);

  useEffect(() => {
    if (!activeReactionFish) return;
    const handlePointerDown = (event) => {
      if (reactionMenuRef.current?.contains(event.target)) return;
      closeReactionMenu();
    };
    const handleScroll = (event) => {
      if (reactionMenuRef.current?.contains(event.target)) return;
      closeReactionMenu();
    };
    const handleResize = () => closeReactionMenu();

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
    };
  }, [activeReactionFish, closeReactionMenu]);

  const handleExternalVisibilityChange = useCallback(
    async (entry, enabled) => {
      try {
        await setExternalVisibility(entry.id, enabled);
      } catch (error) {
        console.error('Sichtbarkeit konnte nicht gespeichert werden:', error);
        alert('Die Freigabe konnte nicht gespeichert werden.');
      }
    },
    [setExternalVisibility]
  );

  const setView = useCallback(
    (nextMode) => {
      const nextParams = new URLSearchParams(searchParams);
      if (nextMode === 'gallery') nextParams.set('view', 'gallery');
      else nextParams.delete('view');
      setSearchParams(nextParams, { replace: true });
      setOpenMenuId(null);
      closeReactionMenu();
    },
    [closeReactionMenu, searchParams, setSearchParams]
  );

  const galleryTileClassName = useCallback((index) => {
    if (index === 0) return 'col-span-2 row-span-2 sm:col-span-2';
    const mod = index % 7;
    if (mod === 2) return 'row-span-2 sm:col-span-2';
    if (mod === 4 || mod === 6) return 'row-span-2';
    return 'row-span-1';
  }, []);

  return (
    <div className="p-6 bg-white dark:bg-gray-900 min-h-screen text-gray-900 dark:text-gray-100">
      <div className={`space-y-6 mx-auto ${viewMode === 'gallery' ? 'max-w-6xl' : 'max-w-3xl'}`}>
        <h2 className="text-3xl font-bold mb-6 text-center text-blue-700 dark:text-blue-400">
          🎣 Fangliste
        </h2>

        <div className="mb-4 flex flex-col gap-3 text-sm text-gray-600 dark:text-gray-400 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div
            className="inline-flex w-fit self-center items-center rounded-full border border-blue-200 bg-blue-50 p-1 dark:border-blue-700 dark:bg-blue-900/30 sm:self-auto"
            role="tablist"
            aria-label="Ansicht wählen"
          >
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'list'}
              onClick={() => setView('list')}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                viewMode === 'list'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-blue-700 hover:bg-blue-100 dark:text-blue-200 dark:hover:bg-blue-800/50'
              }`}
            >
              Liste
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'gallery'}
              onClick={() => setView('gallery')}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                viewMode === 'gallery'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-blue-700 hover:bg-blue-100 dark:text-blue-200 dark:hover:bg-blue-800/50'
              }`}
            >
              Galerie
            </button>
          </div>

          <div className="flex items-center justify-between gap-4 sm:ml-auto sm:justify-end">
            <div>
              🎯 {onlyMine ? 'Meine' : 'Gesamt'}: {totalCount ?? '…'}{' '}
              {totalCount === 1 ? 'Fang' : 'Fänge'}
            </div>
            <label className="flex items-center gap-2 whitespace-nowrap">
              <input
                type="checkbox"
                checked={onlyMine}
                onChange={(e) => setOnlyMine(e.target.checked)}
                className="accent-blue-600"
              />
              Nur meine
            </label>
          </div>
        </div>

        {loading && !catches.length && viewMode === 'list' && (
          <ul className="space-y-6">
            {[...Array(4)].map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </ul>
        )}

        {loading && !catches.length && viewMode === 'gallery' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 auto-rows-[130px]">
            {[...Array(9)].map((_, index) => (
              <div
                key={index}
                className={`${galleryTileClassName(index)} animate-pulse rounded-2xl bg-gray-200/80 dark:bg-gray-800`}
              />
            ))}
          </div>
        )}

        {!loading && !catches.length && (
          <p className="text-center text-gray-500 dark:text-gray-400 mt-6">
            Keine Fänge gespeichert.
          </p>
        )}

        {viewMode === 'list' && (
          <ul className="space-y-6">
            {catches.map((entry) => {
            const d = new Date(entry.timestamp);
            const dateStr = d.toLocaleDateString('de-DE');
            const timeStr = d.toLocaleTimeString('de-DE', {
              hour: '2-digit',
              minute: '2-digit',
            });
            const key = entryKey(entry);
            const topInfo = topBadges[key];
            const mobileFishName =
              entry.fish?.split(' (')[0]?.trim() || entry.fish || '';
            const reactionCounts = getReactionsFor(entry.id);
            const userReaction = getUserReactionFor(entry.id);
            const pendingReaction = isReactionPending(entry.id);
            const hasReactions = Object.keys(reactionCounts || {}).length > 0;
            const isOwnEntry = entry.angler === anglerName;
            const isHomeWater = isHomeWaterEntry(entry, { clubCoords });
            const isExternalCatch = !isHomeWater;
            const isSharedExternal = entry.share_public_non_home === true;
            const visibilityPending = isVisibilityPending(entry.id);
            const locationLabel = formatLocationLabel(entry.location_name);
            const waterbodyLabel = entry.waterbody_id
              ? (waterbodyNameById[entry.waterbody_id] || null)
              : null;
            const headerLocationLabel = waterbodyLabel || (isExternalCatch ? locationLabel : '');
            const waterTemp = canSeeWaterTemperature ? readWaterTemp(entry) : null;

            return (
              <li
                key={key}
                className="relative p-5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 shadow-md"
                onPointerDown={(e) => {
                  if (e.pointerType === 'mouse' && e.button !== 0) return;
                  const targetElement = e.target;
                  if (
                    targetElement instanceof HTMLElement &&
                    targetElement.closest('button, a, input, textarea, select')
                  ) {
                    return;
                  }
                  startLongPress(entry.id);
                }}
                onPointerUp={cancelLongPress}
                onPointerLeave={cancelLongPress}
                onPointerCancel={cancelLongPress}
                onContextMenu={(e) => {
                  e.preventDefault();
                  if (!normalizedName) return;
                  setActiveReactionFish(entry.id);
                }}
              >
                {activeReactionFish === entry.id && (
                  <div
                    ref={reactionMenuRef}
                    className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-full -mt-2 z-30 max-w-[90vw] rounded-3xl bg-gray-900/95 px-3 py-3 shadow-xl"
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-2 overflow-x-auto overscroll-contain">
                      {REACTION_OPTIONS.map((option) => {
                        const selected = userReaction === option.id;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            disabled={pendingReaction}
                            onClick={() => handleReactionSelect(entry.id, option.id)}
                            className={`h-10 w-10 shrink-0 rounded-full text-lg transition ${
                              selected
                                ? 'bg-blue-500 text-white'
                                : 'bg-gray-800 text-white hover:bg-gray-700'
                            } ${pendingReaction ? 'opacity-60 cursor-not-allowed' : ''}`}
                            aria-label={option.label}
                            title={option.label}
                          >
                            {option.emoji}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {dateStr} – {timeStr}{' '}
                    {headerLocationLabel ? `📍 ${headerLocationLabel}` : ''}
                  </p>

                  <div className="flex items-center gap-2 ml-auto">
                    {topInfo && isHomeWater && (
                      <button
                        type="button"
                        onClick={() => navigate(`${clubBasePath}/top-fishes?fish=${encodeURIComponent(entry.fish || '')}`)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold dark:bg-amber-900/60 dark:text-amber-200 whitespace-nowrap transition hover:bg-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-400"
                        title={`Top 10 für ${entry.fish}`}
                      >
                        🏅 Top 10 #{topInfo.rank}
                      </button>
                    )}
                  </div>

                  {isOwnEntry && (
                    <div className="relative">
                      <button
                        onClick={() =>
                          setOpenMenuId(
                            openMenuId === entry.id ? null : entry.id
                          )
                        }
                        className="text-xl hover:text-blue-600"
                      >
                        ⋮
                      </button>
                      {openMenuId === entry.id && (
                        <div className="absolute right-0 mt-2 w-36 bg-white dark:bg-gray-700 border dark:border-gray-600 rounded shadow z-10">
                          <button
                            onClick={() => {
                              setEditingEntry(entry);
                              setOpenMenuId(null);
                            }}
                            className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-600"
                          >
                            Bearbeiten
                          </button>
                          <button
                            onClick={async () => {
                              if (
                                confirm(
                                  'Bist du sicher, dass du diesen Fang löschen möchtest?'
                                )
                              ) {
                                await deleteEntry(entry.id);
                              }
                              setOpenMenuId(null);
                            }}
                            className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 dark:hover:bg-gray-600"
                          >
                            Löschen
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold">{entry.angler}</span>
                </div>

                {isOwnEntry && isExternalCatch && (
                  <label className="mb-2 inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-100">
                    <input
                      type="checkbox"
                      checked={isSharedExternal}
                      disabled={visibilityPending}
                      onChange={(event) =>
                        handleExternalVisibilityChange(entry, event.target.checked)
                      }
                      className="accent-amber-600"
                    />
                    In der Catchlist für alle anzeigen
                  </label>
                )}

                <div className="flex items-center gap-2 mb-2">
                  <span className="text-blue-600 font-medium">
                    <span className="sm:hidden">{mobileFishName}</span>
                    <span className="hidden sm:inline">{entry.fish}</span>
                  </span>
                  <span>{`${entry.size} cm`}</span>
                  {entry.fish?.toLowerCase() === 'karpfen' &&
                    entry.weight != null && (
                      <span className="text-sm italic">({entry.weight} kg)</span>
                    )}
                  {entry.photo_url && (
                    <button
                      onClick={() => setModalPhoto(entry.photo_url)}
                      className="ml-auto"
                    >
                      <img
                        src={entry.photo_url}
                        alt="Fangfoto"
                        loading="lazy"
                        decoding="async"
                        className="w-16 h-16 rounded-full object-cover shadow"
                      />
                    </button>
                  )}
                </div>

                {entry.note && (
                  <p className="italic text-sm text-gray-600 dark:text-gray-300 mb-2">
                    {entry.note}
                  </p>
                )}

                {hasReactions && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                    {REACTION_OPTIONS.map((option) => {
                      const count = reactionCounts?.[option.id];
                      if (!count) return null;
                      const mine = userReaction === option.id;
                      return (
                        <span
                          key={`${entry.id}-${option.id}`}
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-1 ${
                            mine
                              ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-200'
                              : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-200'
                          }`}
                        >
                          <span>{option.emoji}</span>
                          <span className="text-xs font-medium">{count}</span>
                        </span>
                      );
                    })}
                  </div>
                )}

                {entry.weather && (
                  <div className="text-sm text-gray-700 dark:text-gray-300 mt-2">
                    <div className="flex items-center gap-2">
                      {entry.weather.icon && (
                        <img
                          src={`https://openweathermap.org/img/wn/${entry.weather.icon}@2x.png`}
                          alt={entry.weather.description}
                          loading="lazy"
                          decoding="async"
                          className="w-12 h-12"
                        />
                      )}
                      <div>
                        <p>{`${entry.weather.temp} °C, ${entry.weather.description}`}</p>
                        {waterTemp != null && (
                          <div className="mt-1 inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-cyan-200 bg-cyan-50 px-2 py-1 text-cyan-900 dark:border-cyan-800/70 dark:bg-cyan-950/40 dark:text-cyan-100">
                            <span className="font-semibold">🌊 Wassertemperatur</span>
                            <span className="text-base font-semibold">{waterTemp.toFixed(1)} °C</span>
                          </div>
                        )}
                        <p>
                          💨 {`${entry.weather.wind} m/s`} aus{' '}
                          {windDirection(entry.weather.wind_deg)} (
                          {entry.weather.wind_deg}°)
                        </p>
                        <p>
                          💦 {entry.weather.humidity}% • 🧪 {entry.weather.pressure}{' '}
                          hPa
                        </p>
                        <p>{getMoonDescription(entry.weather.moon_phase)}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 mt-2 justify-end">
                  {isOwnEntry && (
                    <button
                      onClick={() => shareEntry(entry)}
                      className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition"
                    >
                      📤 Teilen
                    </button>
                  )}
                </div>
              </li>
            );
            })}
          </ul>
        )}

        {viewMode === 'gallery' && !loading && catches.length > 0 && catchesWithPhotos.length === 0 && (
          <p className="text-center text-gray-500 dark:text-gray-400 mt-6">
            Für die aktuellen Filter sind noch keine Fangfotos vorhanden.
          </p>
        )}

        {viewMode === 'gallery' && catchesWithPhotos.length > 0 && (
          <>
            {featuredPhotoCatch && (
              <button
                type="button"
                onClick={() => setModalPhoto(featuredPhotoCatch.photo_url)}
                className="group relative w-full overflow-hidden rounded-2xl border border-blue-200 bg-blue-950 shadow-lg dark:border-blue-800"
              >
                <img
                  src={featuredPhotoCatch.photo_url}
                  alt={`Highlight: ${featuredPhotoCatch.fish}`}
                  loading="lazy"
                  decoding="async"
                  className="h-64 w-full object-cover opacity-90 transition duration-300 group-hover:scale-[1.02]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                <span className="absolute left-4 top-4 rounded-full bg-amber-300 px-3 py-1 text-xs font-semibold text-amber-950">
                  Galerie-Highlight
                </span>
                <div className="absolute bottom-0 left-0 right-0 p-4 text-left text-white">
                  <p className="text-lg font-semibold">
                    {featuredPhotoCatch.fish} · {featuredPhotoCatch.size} cm
                  </p>
                  <p className="text-sm text-white/90">
                    {featuredPhotoCatch.angler} ·{' '}
                    {new Date(featuredPhotoCatch.timestamp).toLocaleDateString('de-DE')}
                  </p>
                </div>
              </button>
            )}

            <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3 auto-rows-[130px] sm:auto-rows-[150px]">
              {galleryEntries.map((entry, index) => {
                const key = entryKey(entry);
                const topInfo = topBadges[key];
                const dateStr = new Date(entry.timestamp).toLocaleDateString('de-DE');
                const isHomeWater = isHomeWaterEntry(entry, { clubCoords });

                return (
                  <li key={`${key}-gallery`} className={galleryTileClassName(index)}>
                    <button
                      type="button"
                      onClick={() => setModalPhoto(entry.photo_url)}
                      className="group relative h-full w-full overflow-hidden rounded-2xl border border-gray-200 bg-gray-900 shadow-md transition hover:shadow-xl dark:border-gray-700"
                    >
                      <img
                        src={entry.photo_url}
                        alt={`Fangfoto: ${entry.fish}`}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-3 text-left text-white">
                        <p className="truncate text-sm font-semibold">
                          {entry.fish} · {entry.size} cm
                        </p>
                        <p className="truncate text-xs text-white/90">
                          {entry.angler} · {dateStr}
                        </p>
                      </div>
                      {topInfo && isHomeWater && (
                        <span className="absolute right-2 top-2 rounded-full bg-amber-300/90 px-2 py-1 text-[10px] font-semibold text-amber-950">
                          Top 10 #{topInfo.rank}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {hasMore && (
          <div
            ref={sentinelRef}
            className="py-6 text-center text-sm text-gray-400"
          >
            Mehr laden…
          </div>
        )}

        {editingEntry && (
          <EditCatchModal
            entry={editingEntry}
            onCancel={() => setEditingEntry(null)}
            onSave={async ({ fish, size, note, file, lat, lon, locationName }) => {
              try {
                await updateEntry({
                  entry: editingEntry,
                  fish,
                  size,
                  note,
                  photoFile: file,
                  lat,
                  lon,
                  locationName,
                });
              } finally {
                setEditingEntry(null);
              }
            }}
          />
        )}

        <PhotoLightbox src={modalPhoto} onClose={() => setModalPhoto(null)} />
      </div>
    </div>
  );
}

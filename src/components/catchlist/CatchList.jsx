// src/components/catchlist/CatchList.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCatches } from '../../hooks/useCatches';
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll';

import SkeletonCard from './SkeletonCard';
import EditCatchModal from './EditCatchModal';
import PhotoLightbox from './PhotoLightbox';

import { shareEntry } from '../../utils/share';
import { windDirection, getMoonDescription } from '../../utils/weather';
import { supabase } from '@/supabaseClient';
import { VERTRAUTE } from '@/constants';
import { REACTION_OPTIONS } from '@/constants/reactions';
import { isVisibleToUser } from '@/utils/filters';
import { useReactions } from '@/hooks/useReactions';

export default function CatchList({ anglerName }) {
  const [onlyMine, setOnlyMine] = useState(false);
  const [topBadges, setTopBadges] = useState({});

  const {
    catches,
    loading,
    hasMore,
    totalCount,
    loadNext,
    sentinelRef,
    updateEntry,
    deleteEntry,
  } = useCatches(anglerName, onlyMine);

  const [openMenuId, setOpenMenuId] = useState(null);
  const [modalPhoto, setModalPhoto] = useState(null);
  const [editingEntry, setEditingEntry] = useState(null);
  const [activeReactionFish, setActiveReactionFish] = useState(null);
  const longPressTimer = useRef(null);
  const reactionMenuRef = useRef(null);

  const navigate = useNavigate();

  useInfiniteScroll({ ref: sentinelRef, hasMore, loading, onHit: loadNext });

  const normalizedName = useMemo(() => (anglerName || '').trim(), [anglerName]);
  const isTrusted = useMemo(() => VERTRAUTE.includes(normalizedName), [normalizedName]);
  const {
    loadReactionsFor,
    reactToFish,
    getReactionsFor,
    getUserReactionFor,
    isPending: isReactionPending,
  } = useReactions(normalizedName);

  useEffect(() => {
    let cancelled = false;

    const entryKey = (entry) =>
      entry.id ?? `${entry.angler || 'anon'}-${entry.timestamp}-${entry.fish}-${entry.size}`;

    async function loadTopTen() {
      try {
        const { data, error } = await supabase
          .from('fishes')
          .select('id, fish, size, angler, timestamp, location_name, blank');
        if (error) {
          console.error('Top 10 laden:', error);
          return;
        }

        const filterSetting = localStorage.getItem('dataFilter') ?? 'recent';
        const valid = (data || [])
          .filter((entry) => {
            const sizeNum = parseFloat(entry?.size);
            if (!entry?.fish || Number.isNaN(sizeNum) || sizeNum <= 0) return false;
            if (entry.blank) return false;
            return isVisibleToUser(entry, {
              isTrusted,
              onlyMine: false,
              anglerName: normalizedName,
              filterSetting,
            });
          })
          .map((entry) => ({ ...entry, sizeNum: parseFloat(entry.size), key: entryKey(entry) }));

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
  }, [isTrusted, normalizedName]);

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
  }, [catches, loadReactionsFor, onlyMine, normalizedName]);

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

  return (
    <div className="p-6 bg-white dark:bg-gray-900 min-h-screen text-gray-900 dark:text-gray-100">
      <div className="space-y-6 max-w-3xl mx-auto">
        <h2 className="text-3xl font-bold mb-6 text-center text-blue-700 dark:text-blue-400">
          🎣 Fangliste
        </h2>

        <div className="flex justify-between items-center mb-4 text-sm text-gray-600 dark:text-gray-400">
          <div>
            🎯 {onlyMine ? 'Meine' : 'Gesamt'}: {totalCount ?? '…'}{' '}
            {totalCount === 1 ? 'Fang' : 'Fänge'}
          </div>
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

        {loading && !catches.length && (
          <ul className="space-y-6">
            {[...Array(4)].map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </ul>
        )}

        {!loading && !catches.length && (
          <p className="text-center text-gray-500 dark:text-gray-400 mt-6">
            Keine Fänge gespeichert.
          </p>
        )}

        <ul className="space-y-6">
          {catches.map((entry) => {
            const d = new Date(entry.timestamp);
            const dateStr = d.toLocaleDateString('de-DE');
            const timeStr = d.toLocaleTimeString('de-DE', {
              hour: '2-digit',
              minute: '2-digit',
            });
            const key = entry.id ?? `${entry.angler || 'anon'}-${entry.timestamp}-${entry.fish}-${entry.size}`;
            const topInfo = topBadges[key];
            const mobileFishName =
              entry.fish?.split(' (')[0]?.trim() || entry.fish || '';
            const reactionCounts = getReactionsFor(entry.id);
            const userReaction = getUserReactionFor(entry.id);
            const pendingReaction = isReactionPending(entry.id);
            const hasReactions = Object.keys(reactionCounts || {}).length > 0;

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
                    {!entry.location_name ||
                    entry.location_name.toLowerCase().includes('lobberich')
                      ? ''
                      : `📍 ${entry.location_name}`}
                  </p>

                  <div className="flex items-center gap-2 ml-auto">
                    {topInfo && (
                      <button
                        type="button"
                        onClick={() => navigate(`/top-fishes?fish=${encodeURIComponent(entry.fish || '')}`)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold dark:bg-amber-900/60 dark:text-amber-200 whitespace-nowrap transition hover:bg-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-400"
                        title={`Top 10 für ${entry.fish}`}
                      >
                        🏅 Top 10 #{topInfo.rank}
                      </button>
                    )}
                  </div>

                  {entry.angler === anglerName && (
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
                  {entry.angler === anglerName && (
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
            onSave={async ({ fish, size, note, file }) => {
              try {
                await updateEntry({
                  entry: editingEntry,
                  fish,
                  size,
                  note,
                  photoFile: file,
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

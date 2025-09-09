// src/components/catchlist/CatchList.jsx
import { useState } from 'react';
import { useCatches } from '../../hooks/useCatches';
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll';

import SkeletonCard from './SkeletonCard';
import EditCatchModal from './EditCatchModal';
import PhotoLightbox from './PhotoLightbox';

import { shareEntry } from '../../utils/share';
import { windDirection, getMoonDescription } from '../../utils/weather';

export default function CatchList({ anglerName }) {
  const [onlyMine, setOnlyMine] = useState(false);

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

  useInfiniteScroll({ ref: sentinelRef, hasMore, loading, onHit: loadNext });

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

            return (
              <li
                key={entry.id}
                className="p-5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 shadow-md"
              >
                <div className="flex justify-between items-center mb-1">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {dateStr} – {timeStr}{' '}
                    {!entry.location_name ||
                    entry.location_name.toLowerCase().includes('lobberich')
                      ? ''
                      : `📍 ${entry.location_name}`}
                  </p>

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
                  <span className="text-blue-600 font-medium">{entry.fish}</span>
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

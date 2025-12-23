import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageContainer from '@/components/PageContainer';
import { CRAYFISH_SPECIES, saveCrayfishCatch } from '@/services/crayfishService';

const CRAYFISH_IMAGES = {
  'Roter amerikanischer Flusskrebs': '/crayfish/roter-amerikanischer-flusskrebs.jpg',
  Signalkrebs: '/crayfish/signalkrebs.jpg',
  Kamberkrebs: '/crayfish/kamberkrebs.jpg',
  Kalikokrebs: '/crayfish/kalikokrebs.jpg',
};

export default function CrayfishForm({ anglerName }) {
  const navigate = useNavigate();
  const [species, setSpecies] = useState('');
  const [count, setCount] = useState(1);
  const [note, setNote] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [previewSpecies, setPreviewSpecies] = useState('');
  const [failedSpecies, setFailedSpecies] = useState('');

  const speciesVisual = {
    'Roter amerikanischer Flusskrebs': {
      emoji: '🦞',
      gradient: 'from-red-500/80 to-orange-400/80',
    },
    Signalkrebs: {
      emoji: '🦐',
      gradient: 'from-blue-500/70 to-cyan-400/80',
    },
    Kamberkrebs: {
      emoji: '🦀',
      gradient: 'from-amber-500/80 to-emerald-400/80',
    },
    Kalikokrebs: {
      emoji: '🦐',
      gradient: 'from-purple-500/80 to-pink-400/80',
    },
  };

  const handleSelect = (item) => {
    setSpecies(item);
  };

  const openPreview = (item) => {
    setFailedSpecies('');
    setPreviewSpecies(item);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving) return;

    setError('');
    setSaving(true);

    try {
      await saveCrayfishCatch({
        angler: anglerName || localStorage.getItem('anglerName') || 'Unbekannt',
        species,
        count,
        timestamp: new Date(),
        note,
      });
      alert(`Krebsfang gespeichert: ${species || 'Unbekannte Art'} (${count}x)`);
      navigate('/');
      setSpecies('');
      setCount(1);
      setNote('');
    } catch (err) {
      setError(err?.message || 'Konnte nicht speichern.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageContainer>
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50 to-emerald-50 p-5 shadow-sm dark:border-blue-900/40 dark:from-blue-950/60 dark:to-emerald-950/40">
          <h2 className="text-2xl font-bold text-blue-800 dark:text-blue-100 flex items-center gap-2">
            <span role="img" aria-hidden>🦞</span>
            Krebsfang erfassen
          </h2>
          <p className="mt-1 text-sm text-gray-700 dark:text-gray-200">
            Wähle die Krebsart. Mit einem Klick auf das Symbol kannst du dir ein Bild der Art anzeigen lassen.
          </p>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {CRAYFISH_SPECIES.map((item) => {
              const isActive = species === item;
              const visual = speciesVisual[item] || {};
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => handleSelect(item)}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left transition ${
                    isActive
                      ? 'border-blue-500 bg-white shadow-sm dark:border-blue-400 dark:bg-blue-900/40'
                      : 'border-blue-200 bg-white/70 hover:border-blue-400 dark:border-blue-700/60 dark:bg-blue-900/20 dark:hover:border-blue-400'
                  }`}
                >
                  <span className="text-sm font-semibold text-blue-900 dark:text-blue-100">{item}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openPreview(item);
                    }}
                    className="ml-3 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br text-xl shadow transition hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    style={{ backgroundImage: undefined }}
                    aria-label={`${item} anzeigen`}
                  >
                    <span
                      className={`${visual.gradient || 'from-blue-400 to-emerald-400'} inline-flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br`}
                    >
                      {visual.emoji || '🦞'}
                    </span>
                  </button>
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <div className="rounded border px-3 py-2 text-sm border-red-200 bg-red-50 text-red-700 dark:border-red-800/50 dark:bg-red-900/30 dark:text-red-100">
            {error}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-md dark:border-gray-700 dark:bg-gray-800"
        >
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">
              Art wählen
            </label>
            {species && (
              <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900 dark:border-blue-700 dark:bg-blue-900/40 dark:text-blue-50">
                <span className="text-lg">{(speciesVisual[species] || {}).emoji || '🦞'}</span>
                {species}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">
              Anzahl
            </label>
            <input
              type="number"
              min={1}
              inputMode="numeric"
              value={count}
              onChange={(e) => setCount(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">
              Notiz (optional)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              placeholder="z.B. Gewässerabschnitt, besondere Beobachtungen"
            />
          </div>

          <div className="flex items-center justify-end">
            <button
              type="submit"
              disabled={saving}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              {saving ? 'Speichern...' : 'Speichern'}
            </button>
          </div>
        </form>
      </div>

      {previewSpecies && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4"
          role="presentation"
          onClick={() => setPreviewSpecies('')}
        >
          <div
            className="relative w-full max-w-lg rounded-xl bg-white shadow-xl dark:bg-gray-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between rounded-t-xl bg-blue-600 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-white">
              <span className="pr-3">{previewSpecies}</span>
              <button
                type="button"
                onClick={() => setPreviewSpecies('')}
                className="ml-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-lg font-bold text-white transition hover:bg-white/30 focus:outline-none focus:ring-2 focus:ring-white/60"
                aria-label="Schließen"
              >
                ✕
              </button>
            </div>
            <div className="p-4 flex justify-center">
              {CRAYFISH_IMAGES[previewSpecies] && failedSpecies !== previewSpecies ? (
                <img
                  src={CRAYFISH_IMAGES[previewSpecies]}
                  alt={previewSpecies}
                  className="w-full max-h-[70vh] rounded-lg object-contain bg-black/5 dark:bg-white/5 sm:max-h-[80vh]"
                  onError={() => setFailedSpecies(previewSpecies)}
                />
              ) : (
                <div className="flex h-72 w-full items-center justify-center rounded-lg bg-gradient-to-br from-blue-200 to-emerald-200 text-center text-sm font-semibold text-blue-900 dark:from-gray-700 dark:to-gray-800 dark:text-gray-100">
                  Kein Bild hinterlegt. Bitte Foto unter {CRAYFISH_IMAGES[previewSpecies] || '...'} ablegen.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}

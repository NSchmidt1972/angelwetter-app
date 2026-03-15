import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui';
import { supabase } from '@/supabaseClient';
import { FEATURES, FEATURE_KEYS } from '@/permissions/features';

const CLUB_DEFAULT_FEATURES = Object.freeze({
  [FEATURES.WEATHER]: true,
  [FEATURES.CATCH_LOGGING]: true,
  [FEATURES.FORECAST]: true,
  [FEATURES.MAP]: true,
  [FEATURES.LEADERBOARD]: true,
  [FEATURES.ANALYSIS]: true,
  [FEATURES.PUSH]: false,
  [FEATURES.ADMIN_TOOLS]: true,
});

function sanitizeSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
}

function isMissingClubWeatherCoordsError(error) {
  const code = String(error?.code || '');
  const message = String(error?.message || '').toLowerCase();
  return code === '42703' && (message.includes('clubs.weather_lat') || message.includes('clubs.weather_lon'));
}

function parseOptionalCoordinate(rawValue, { min, max, label }) {
  const raw = String(rawValue || '').trim().replace(',', '.');
  if (!raw) return { ok: true, value: null };
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min || value > max) {
    return { ok: false, error: `${label} muss zwischen ${min} und ${max} liegen.` };
  }
  return { ok: true, value };
}

function parseWeatherCoords({ latRaw, lonRaw }) {
  const latResult = parseOptionalCoordinate(latRaw, { min: -90, max: 90, label: 'Wetter-Breitengrad' });
  if (!latResult.ok) return latResult;
  const lonResult = parseOptionalCoordinate(lonRaw, { min: -180, max: 180, label: 'Wetter-Längengrad' });
  if (!lonResult.ok) return lonResult;

  const hasLat = latResult.value != null;
  const hasLon = lonResult.value != null;
  if (hasLat !== hasLon) {
    return { ok: false, error: 'Wetter-Breitengrad und Wetter-Längengrad bitte immer gemeinsam setzen.' };
  }
  return { ok: true, lat: latResult.value, lon: lonResult.value };
}

async function fallbackCreateClub({ slug, name, host, isActive }) {
  let clubInsert = null;
  const withIsActive = await supabase
    .from('clubs')
    .insert({
      slug,
      name,
      host: host || null,
      is_active: isActive,
    })
    .select('id')
    .single();

  if (!withIsActive.error) {
    clubInsert = withIsActive.data;
  } else if (isMissingClubIsActiveError(withIsActive.error)) {
    const withoutIsActive = await supabase
      .from('clubs')
      .insert({
        slug,
        name,
        host: host || null,
      })
      .select('id')
      .single();
    if (withoutIsActive.error) throw withoutIsActive.error;
    clubInsert = withoutIsActive.data;
  } else {
    throw withIsActive.error;
  }

  const rows = FEATURE_KEYS.map((featureKey) => ({
    club_id: clubInsert.id,
    feature_key: featureKey,
    enabled: Boolean(CLUB_DEFAULT_FEATURES[featureKey]),
  }));

  const { error: featureError } = await supabase.from('club_features').upsert(rows, {
    onConflict: 'club_id,feature_key',
  });
  if (featureError) throw featureError;

  return clubInsert.id;
}

function isMissingFunctionError(error) {
  const code = String(error?.code || '');
  const message = String(error?.message || '').toLowerCase();
  return code === '42883' || message.includes('could not find the function');
}

function isMissingClubIsActiveError(error) {
  const code = String(error?.code || '');
  const message = String(error?.message || '').toLowerCase();
  return code === '42703' && message.includes('clubs.is_active');
}

export default function SuperAdminClubsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [clubs, setClubs] = useState([]);
  const [supportsClubIsActive, setSupportsClubIsActive] = useState(true);
  const [supportsClubWeatherCoords, setSupportsClubWeatherCoords] = useState(true);
  const [form, setForm] = useState({
    slug: '',
    name: '',
    host: '',
    is_active: true,
    weather_lat: '',
    weather_lon: '',
  });

  const sortedClubs = useMemo(
    () => [...clubs].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))),
    [clubs],
  );

  const loadClubs = async () => {
    setLoading(true);
    setError('');
    try {
      const selectVariants = [
        { select: 'id, slug, name, host, is_active, weather_lat, weather_lon, created_at', hasIsActive: true, hasWeatherCoords: true },
        { select: 'id, slug, name, host, is_active, created_at', hasIsActive: true, hasWeatherCoords: false },
        { select: 'id, slug, name, host, weather_lat, weather_lon, created_at', hasIsActive: false, hasWeatherCoords: true },
        { select: 'id, slug, name, host, created_at', hasIsActive: false, hasWeatherCoords: false },
      ];

      let loaded = null;
      let lastError = null;
      for (const variant of selectVariants) {
        const result = await supabase.from('clubs').select(variant.select).order('name', { ascending: true });
        if (!result.error) {
          loaded = {
            ...variant,
            data: Array.isArray(result.data) ? result.data : [],
          };
          break;
        }
        const tolerable =
          isMissingClubIsActiveError(result.error) ||
          isMissingClubWeatherCoordsError(result.error);
        if (!tolerable) throw result.error;
        lastError = result.error;
      }

      if (!loaded) throw lastError || new Error('Clubs konnten nicht geladen werden.');

      setSupportsClubIsActive(loaded.hasIsActive);
      setSupportsClubWeatherCoords(loaded.hasWeatherCoords);
      setClubs(
        loaded.data.map((row) => ({
          ...row,
          is_active: loaded.hasIsActive ? row.is_active : true,
          weather_lat: loaded.hasWeatherCoords ? row.weather_lat : null,
          weather_lon: loaded.hasWeatherCoords ? row.weather_lon : null,
        })),
      );
    } catch (err) {
      setError(err?.message || 'Clubs konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadClubs();
  }, []);

  const handleCreateClub = async (event) => {
    event.preventDefault();
    if (saving) return;

    setSaving(true);
    setError('');
    setMessage('');

    const slug = sanitizeSlug(form.slug);
    const name = String(form.name || '').trim();
    const host = String(form.host || '').trim();
    const weatherCoords = parseWeatherCoords({
      latRaw: form.weather_lat,
      lonRaw: form.weather_lon,
    });

    if (!slug || !name || !weatherCoords.ok) {
      setSaving(false);
      setError(weatherCoords.ok ? 'Slug und Name sind Pflichtfelder.' : weatherCoords.error);
      return;
    }

    try {
      let clubId = null;
      const rpcResult = await supabase.rpc('create_club_with_defaults', {
        p_slug: slug,
        p_name: name,
        p_host: host || null,
        p_is_active: Boolean(form.is_active),
      });

      if (rpcResult.error) {
        if (!isMissingFunctionError(rpcResult.error) && !isMissingClubIsActiveError(rpcResult.error)) {
          throw rpcResult.error;
        }
        clubId = await fallbackCreateClub({
          slug,
          name,
          host,
          isActive: supportsClubIsActive ? Boolean(form.is_active) : true,
        });
        if (isMissingClubIsActiveError(rpcResult.error)) setSupportsClubIsActive(false);
      } else {
        clubId = rpcResult.data;
      }

      let weatherCoordsSaved = false;
      if (clubId && supportsClubWeatherCoords) {
        const weatherUpdate = await supabase
          .from('clubs')
          .update({
            weather_lat: weatherCoords.lat,
            weather_lon: weatherCoords.lon,
          })
          .eq('id', clubId);

        if (weatherUpdate.error) {
          if (isMissingClubWeatherCoordsError(weatherUpdate.error)) {
            setSupportsClubWeatherCoords(false);
          } else {
            throw weatherUpdate.error;
          }
        } else {
          weatherCoordsSaved = true;
        }
      }

      setMessage('Club wurde angelegt.');
      if ((weatherCoords.lat != null || weatherCoords.lon != null) && !weatherCoordsSaved) {
        setMessage('Club wurde angelegt. Wetterkoordinaten konnten auf diesem Schema nicht gespeichert werden.');
      }
      setForm({ slug: '', name: '', host: '', is_active: true, weather_lat: '', weather_lon: '' });
      await loadClubs();
      if (clubId) navigate(`/superadmin/clubs/${clubId}`);
    } catch (err) {
      setError(err?.message || 'Club konnte nicht angelegt werden.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Card className="p-6">Clubs werden geladen...</Card>;

  return (
    <Card className="space-y-8 p-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-blue-700 dark:text-blue-300">Superadmin: Clubs</h1>
        <p className="text-sm text-gray-600 dark:text-gray-300">Mandanten anlegen und verwalten.</p>
      </header>

      {error ? (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800/40 dark:bg-red-900/30 dark:text-red-200">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700 dark:border-green-800/40 dark:bg-green-900/30 dark:text-green-200">
          {message}
        </div>
      ) : null}

      <section className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
        <h2 className="mb-3 text-lg font-semibold">Neuen Club anlegen</h2>
        <form className="grid gap-3 md:grid-cols-2" onSubmit={handleCreateClub}>
          <label className="text-sm">
            Slug
            <input
              type="text"
              value={form.slug}
              onChange={(event) => setForm((prev) => ({ ...prev, slug: event.target.value }))}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              placeholder="asv-neuer-club"
            />
          </label>
          <label className="text-sm">
            Name
            <input
              type="text"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              placeholder="ASV Neuer Club"
            />
          </label>
          <label className="text-sm">
            Host (optional)
            <input
              type="text"
              value={form.host}
              onChange={(event) => setForm((prev) => ({ ...prev, host: event.target.value }))}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              placeholder="app.neuer-club.de"
            />
          </label>
          <label className="text-sm">
            Wetter-Breitengrad (optional)
            <input
              type="text"
              inputMode="decimal"
              value={form.weather_lat}
              onChange={(event) => setForm((prev) => ({ ...prev, weather_lat: event.target.value }))}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              placeholder="z. B. 51.3135"
              disabled={!supportsClubWeatherCoords}
            />
          </label>
          <label className="text-sm">
            Wetter-Längengrad (optional)
            <input
              type="text"
              inputMode="decimal"
              value={form.weather_lon}
              onChange={(event) => setForm((prev) => ({ ...prev, weather_lon: event.target.value }))}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              placeholder="z. B. 6.2560"
              disabled={!supportsClubWeatherCoords}
            />
          </label>
          <label className="flex items-center gap-2 text-sm md:self-end">
            <input
              type="checkbox"
              checked={Boolean(form.is_active)}
              disabled={!supportsClubIsActive}
              onChange={(event) => setForm((prev) => ({ ...prev, is_active: event.target.checked }))}
            />
            Club aktiv
          </label>
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? 'Wird angelegt...' : 'Club anlegen'}
            </button>
          </div>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Bestehende Clubs</h2>
        <div className="space-y-2">
          {sortedClubs.map((club) => (
            <Link
              key={club.id}
              to={`/superadmin/clubs/${club.id}`}
              className="block rounded border border-gray-200 bg-white px-4 py-3 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-semibold text-gray-900 dark:text-gray-100">{club.name}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    slug: {club.slug} | host: {club.host || '—'} | see:{' '}
                    {club.weather_lat != null && club.weather_lon != null
                      ? `${club.weather_lat}, ${club.weather_lon}`
                      : '—'}
                  </div>
                </div>
                <span
                  className={`rounded px-2 py-1 text-xs font-semibold ${
                    club.is_active
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-200'
                      : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
                  }`}
                >
                  {club.is_active ? 'aktiv' : 'inaktiv'}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </Card>
  );
}

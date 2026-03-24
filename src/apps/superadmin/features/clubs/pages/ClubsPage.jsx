import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui';
import { supabase } from '@/supabaseClient';
import { FEATURES, FEATURE_KEYS } from '@/permissions/features';
import { useSuperAdminHeaderTitle } from '@/apps/superadmin/context/headerTitleContext';
import {
  CLUB_SELECT_VARIANTS,
  isMissingClubIsActiveError,
  isMissingClubLogoUrlError,
  isMissingClubWeatherCoordsError,
  isMissingFunctionError,
  parseWeatherCoords,
  sanitizeSlug,
} from '@/apps/superadmin/features/clubs/utils/clubSchemaCompat';
import { uploadClubLogoFile } from '@/apps/superadmin/features/clubs/utils/logoUpload';

const PAGE_TITLE = 'Club anlegen';

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

export default function ClubsPage() {
  const setSuperAdminHeaderTitle = useSuperAdminHeaderTitle();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [supportsClubIsActive, setSupportsClubIsActive] = useState(true);
  const [supportsClubWeatherCoords, setSupportsClubWeatherCoords] = useState(true);
  const [supportsClubLogoUrl, setSupportsClubLogoUrl] = useState(true);
  const [logoFile, setLogoFile] = useState(null);
  const [form, setForm] = useState({
    slug: '',
    name: '',
    host: '',
    is_active: true,
    weather_lat: '',
    weather_lon: '',
  });

  useEffect(() => {
    setSuperAdminHeaderTitle(PAGE_TITLE);
  }, [setSuperAdminHeaderTitle]);

  const loadSchemaSupport = async () => {
    setLoading(true);
    setError('');
    try {
      let loadedVariant = null;
      let lastError = null;
      for (const variant of CLUB_SELECT_VARIANTS) {
        const result = await supabase.from('clubs').select(variant.select).limit(1);
        if (!result.error) {
          loadedVariant = variant;
          break;
        }
        const tolerable =
          isMissingClubIsActiveError(result.error) ||
          isMissingClubWeatherCoordsError(result.error) ||
          isMissingClubLogoUrlError(result.error);
        if (!tolerable) throw result.error;
        lastError = result.error;
      }

      if (!loadedVariant) throw lastError || new Error('Schema-Informationen konnten nicht geladen werden.');

      setSupportsClubIsActive(loadedVariant.hasIsActive);
      setSupportsClubWeatherCoords(loadedVariant.hasWeatherCoords);
      setSupportsClubLogoUrl(loadedVariant.hasLogoUrl);
    } catch (err) {
      setError(err?.message || 'Schema-Informationen konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSchemaSupport();
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

      let logoSaved = false;
      let logoErrorMessage = '';
      if (clubId && logoFile) {
        if (!supportsClubLogoUrl) {
          logoSaved = false;
        } else {
          try {
            const uploadedLogoUrl = await uploadClubLogoFile({ clubId, file: logoFile });
            const logoUpdate = await supabase
              .from('clubs')
              .update({ logo_url: uploadedLogoUrl })
              .eq('id', clubId);
            if (logoUpdate.error) {
              if (isMissingClubLogoUrlError(logoUpdate.error)) {
                setSupportsClubLogoUrl(false);
              } else {
                throw logoUpdate.error;
              }
            } else {
              logoSaved = true;
            }
          } catch (logoError) {
            logoErrorMessage = logoError?.message || 'Logo konnte nicht gespeichert werden.';
          }
        }
      }

      const notices = ['Club wurde angelegt.'];
      if ((weatherCoords.lat != null || weatherCoords.lon != null) && !weatherCoordsSaved) {
        notices.push('Wetterkoordinaten konnten auf diesem Schema nicht gespeichert werden.');
      }
      if (logoFile && !logoSaved) {
        notices.push(logoErrorMessage || 'Logo konnte nicht gespeichert werden.');
      }
      setMessage(notices.join(' '));

      setForm({ slug: '', name: '', host: '', is_active: true, weather_lat: '', weather_lon: '' });
      setLogoFile(null);
      await loadSchemaSupport();
      if (clubId) navigate(`/superadmin/clubs/${clubId}`);
    } catch (err) {
      setError(err?.message || 'Club konnte nicht angelegt werden.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Card className="p-4 sm:p-6">Clubs werden geladen...</Card>;

  return (
    <Card className="space-y-8 p-4 sm:p-6">
      <p className="text-sm text-gray-600 dark:text-gray-300">Neuen Verein anlegen.</p>

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

      <section className="rounded-lg border border-gray-200 p-3 sm:p-4 dark:border-gray-700">
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
          <label className="text-sm md:col-span-2">
            Logo-Datei (optional)
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={(event) => setLogoFile(event.target.files?.[0] || null)}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-blue-50 file:px-2.5 file:py-1.5 file:text-xs file:font-semibold file:text-blue-700 hover:file:bg-blue-100 dark:border-gray-700 dark:bg-gray-900 dark:file:bg-gray-700 dark:file:text-gray-100"
            />
            <span className="mt-1 block break-all text-xs text-gray-500 dark:text-gray-400">
              {logoFile ? `Ausgewählt: ${logoFile.name}` : 'Wird beim Anlegen direkt hochgeladen.'}
            </span>
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
    </Card>
  );
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Card } from '@/components/ui';
import { supabase } from '@/supabaseClient';
import { FEATURES, FEATURE_KEYS, createInitialFeatureMap } from '@/permissions/features';
import { ROLES } from '@/permissions/roles';
import AdminOverview from '@/pages/AdminOverview';

const ROLE_COLUMNS = [ROLES.GUEST, ROLES.MEMBER, ROLES.TESTER, ROLES.BOARD, ROLES.ADMIN];
const ROLE_OPTIONS = [ROLES.MEMBER, ROLES.TESTER, ROLES.BOARD, ROLES.ADMIN, ROLES.GUEST];

const FEATURE_LABELS = Object.freeze({
  [FEATURES.WEATHER]: 'Wetter',
  [FEATURES.CATCH_LOGGING]: 'Fang-Logging',
  [FEATURES.FORECAST]: 'Forecast',
  [FEATURES.MAP]: 'Karte',
  [FEATURES.LEADERBOARD]: 'Leaderboard',
  [FEATURES.ANALYSIS]: 'Analyse',
  [FEATURES.PUSH]: 'Push',
  [FEATURES.ADMIN_TOOLS]: 'Admin-Tools',
});

function buildFeatureState(rows) {
  const base = createInitialFeatureMap();
  (rows || []).forEach((row) => {
    const key = String(row?.feature_key || '').trim().toLowerCase();
    if (!FEATURE_KEYS.includes(key)) return;
    base[key] = Boolean(row?.enabled);
  });
  return base;
}

function buildRoleFeatureState(rows) {
  return (rows || []).reduce((acc, row) => {
    const role = String(row?.role || '').trim().toLowerCase();
    const featureKey = String(row?.feature_key || '').trim().toLowerCase();
    if (!ROLE_COLUMNS.includes(role) || !FEATURE_KEYS.includes(featureKey)) return acc;
    if (!acc[role]) acc[role] = {};
    acc[role][featureKey] = Boolean(row?.enabled);
    return acc;
  }, {});
}

function isMissingClubIsActiveError(error) {
  const code = String(error?.code || '');
  const message = String(error?.message || '').toLowerCase();
  return code === '42703' && message.includes('clubs.is_active');
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

export default function SuperAdminClubDetailPage() {
  const { clubId } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [club, setClub] = useState(null);
  const [supportsClubIsActive, setSupportsClubIsActive] = useState(true);
  const [supportsClubWeatherCoords, setSupportsClubWeatherCoords] = useState(true);
  const [clubFeatures, setClubFeatures] = useState(createInitialFeatureMap());
  const [roleFeatures, setRoleFeatures] = useState({});
  const [membershipForm, setMembershipForm] = useState({ userId: '', role: ROLES.BOARD });
  const [showClubAnalysis, setShowClubAnalysis] = useState(false);

  const rows = useMemo(
    () => FEATURE_KEYS.map((featureKey) => ({
      featureKey,
      label: FEATURE_LABELS[featureKey] || featureKey,
      enabled: Boolean(clubFeatures[featureKey]),
    })),
    [clubFeatures],
  );

  const loadClub = useCallback(async () => {
    if (!clubId) return;
    setLoading(true);
    setError('');
    try {
      const selectVariants = [
        { select: 'id, slug, name, host, is_active, weather_lat, weather_lon, created_at', hasIsActive: true, hasWeatherCoords: true },
        { select: 'id, slug, name, host, is_active, created_at', hasIsActive: true, hasWeatherCoords: false },
        { select: 'id, slug, name, host, weather_lat, weather_lon, created_at', hasIsActive: false, hasWeatherCoords: true },
        { select: 'id, slug, name, host, created_at', hasIsActive: false, hasWeatherCoords: false },
      ];

      let clubResult = null;
      let selectMeta = null;
      let lastError = null;
      for (const variant of selectVariants) {
        const result = await supabase
          .from('clubs')
          .select(variant.select)
          .eq('id', clubId)
          .maybeSingle();
        if (!result.error) {
          clubResult = result;
          selectMeta = variant;
          break;
        }
        const tolerable =
          isMissingClubIsActiveError(result.error) ||
          isMissingClubWeatherCoordsError(result.error);
        if (!tolerable) throw result.error;
        lastError = result.error;
      }

      if (!clubResult || !selectMeta) throw lastError || new Error('Club-Details konnten nicht geladen werden.');

      const [featureResult, roleFeatureResult] = await Promise.all([
        supabase
          .from('club_features')
          .select('feature_key, enabled')
          .eq('club_id', clubId),
        supabase
          .from('club_role_features')
          .select('role, feature_key, enabled')
          .eq('club_id', clubId),
      ]);

      if (clubResult.error) throw clubResult.error;
      if (featureResult.error) throw featureResult.error;
      if (roleFeatureResult.error) throw roleFeatureResult.error;

      setSupportsClubIsActive(selectMeta.hasIsActive);
      setSupportsClubWeatherCoords(selectMeta.hasWeatherCoords);
      setClub(
        clubResult.data
          ? {
              ...clubResult.data,
              is_active: selectMeta.hasIsActive ? clubResult.data.is_active : true,
              weather_lat: selectMeta.hasWeatherCoords ? clubResult.data.weather_lat : null,
              weather_lon: selectMeta.hasWeatherCoords ? clubResult.data.weather_lon : null,
            }
          : null,
      );
      setClubFeatures(buildFeatureState(featureResult.data || []));
      setRoleFeatures(buildRoleFeatureState(roleFeatureResult.data || []));
    } catch (err) {
      setError(err?.message || 'Club-Details konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  useEffect(() => {
    void loadClub();
  }, [loadClub]);

  const updateClubField = (key, value) => {
    setClub((prev) => ({ ...(prev || {}), [key]: value }));
  };

  const saveClub = async () => {
    if (!club?.id || saving) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const weatherCoords = parseWeatherCoords({
        latRaw: club.weather_lat,
        lonRaw: club.weather_lon,
      });
      if (!weatherCoords.ok) {
        setError(weatherCoords.error);
        return;
      }

      const payload = {
        slug: String(club.slug || '').trim().toLowerCase(),
        name: String(club.name || '').trim(),
        host: String(club.host || '').trim() || null,
      };
      if (supportsClubIsActive) payload.is_active = Boolean(club.is_active);
      if (supportsClubWeatherCoords) {
        payload.weather_lat = weatherCoords.lat;
        payload.weather_lon = weatherCoords.lon;
      }
      const updateWithPayload = await supabase.from('clubs').update(payload).eq('id', club.id);
      if (updateWithPayload.error) {
        const missingIsActive = isMissingClubIsActiveError(updateWithPayload.error);
        const missingCoords = isMissingClubWeatherCoordsError(updateWithPayload.error);
        if ((!supportsClubIsActive || !missingIsActive) && (!supportsClubWeatherCoords || !missingCoords)) {
          throw updateWithPayload.error;
        }

        const payloadWithoutUnsupported = { ...payload };
        if (missingIsActive) {
          delete payloadWithoutUnsupported.is_active;
          setSupportsClubIsActive(false);
        }
        if (missingCoords) {
          delete payloadWithoutUnsupported.weather_lat;
          delete payloadWithoutUnsupported.weather_lon;
          setSupportsClubWeatherCoords(false);
        }

        const updateFallback = await supabase.from('clubs').update(payloadWithoutUnsupported).eq('id', club.id);
        if (updateFallback.error) throw updateFallback.error;
      }
      setMessage('Club gespeichert.');
      await loadClub();
    } catch (err) {
      setError(err?.message || 'Club konnte nicht gespeichert werden.');
    } finally {
      setSaving(false);
    }
  };

  const toggleClubFeature = async (featureKey, enabled) => {
    if (!club?.id) return;
    const previous = clubFeatures;
    setClubFeatures((prev) => ({ ...prev, [featureKey]: enabled }));
    setError('');
    setMessage('');
    try {
      const { error: upsertError } = await supabase.from('club_features').upsert(
        {
          club_id: club.id,
          feature_key: featureKey,
          enabled,
        },
        { onConflict: 'club_id,feature_key' },
      );
      if (upsertError) throw upsertError;
      setMessage('Feature gespeichert.');
    } catch (err) {
      setClubFeatures(previous);
      setError(err?.message || 'Feature konnte nicht gespeichert werden.');
    }
  };

  const toggleRoleFeature = async (role, featureKey, enabled) => {
    if (!club?.id) return;
    const previous = roleFeatures;
    const nextState = {
      ...roleFeatures,
      [role]: {
        ...(roleFeatures[role] || {}),
        [featureKey]: enabled,
      },
    };
    setRoleFeatures(nextState);
    setError('');
    setMessage('');

    try {
      const { error: upsertError } = await supabase.from('club_role_features').upsert(
        {
          club_id: club.id,
          role,
          feature_key: featureKey,
          enabled,
        },
        { onConflict: 'club_id,role,feature_key' },
      );
      if (upsertError) throw upsertError;
      setMessage('Rollenfreigabe gespeichert.');
    } catch (err) {
      setRoleFeatures(previous);
      setError(err?.message || 'Rollenfreigabe konnte nicht gespeichert werden.');
    }
  };

  const assignMembership = async (event) => {
    event.preventDefault();
    if (!club?.id) return;
    const userId = String(membershipForm.userId || '').trim();
    if (!userId) return;

    setError('');
    setMessage('');
    try {
      const { error: upsertError } = await supabase.from('memberships').upsert(
        {
          user_id: userId,
          club_id: club.id,
          role: membershipForm.role,
          is_active: true,
        },
        { onConflict: 'user_id,club_id' },
      );
      if (upsertError) throw upsertError;
      setMessage('Membership gesetzt.');
      setMembershipForm((prev) => ({ ...prev, userId: '' }));
    } catch (err) {
      setError(err?.message || 'Membership konnte nicht gesetzt werden.');
    }
  };

  if (loading) return <Card className="p-6">Club-Details werden geladen...</Card>;
  if (!club) return <Card className="p-6 text-red-600">Club nicht gefunden.</Card>;

  return (
    <Card className="space-y-8 p-6">
      <header className="space-y-2">
        <Link to="/superadmin/clubs" className="text-sm text-blue-600 hover:underline">
          ← Zurück zu Clubs
        </Link>
        <h1 className="text-2xl font-bold text-blue-700 dark:text-blue-300">{club.name}</h1>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          ID: {club.id} | Tenant-Link:{' '}
          <Link to={`/${club.slug}/vorstand`} className="text-blue-600 hover:underline">
            /{club.slug}/vorstand
          </Link>
        </p>
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

      <section className="grid gap-3 md:grid-cols-2">
        <label className="text-sm">
          Name
          <input
            type="text"
            value={club.name || ''}
            onChange={(event) => updateClubField('name', event.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
        </label>
        <label className="text-sm">
          Slug
          <input
            type="text"
            value={club.slug || ''}
            onChange={(event) => updateClubField('slug', event.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
        </label>
        <label className="text-sm">
          Host
          <input
            type="text"
            value={club.host || ''}
            onChange={(event) => updateClubField('host', event.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
        </label>
        <label className="text-sm">
          Wetter-Breitengrad
          <input
            type="text"
            inputMode="decimal"
            value={club.weather_lat ?? ''}
            onChange={(event) => updateClubField('weather_lat', event.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            disabled={!supportsClubWeatherCoords}
            placeholder="z. B. 51.3135"
          />
        </label>
        <label className="text-sm">
          Wetter-Längengrad
          <input
            type="text"
            inputMode="decimal"
            value={club.weather_lon ?? ''}
            onChange={(event) => updateClubField('weather_lon', event.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            disabled={!supportsClubWeatherCoords}
            placeholder="z. B. 6.2560"
          />
        </label>
        <label className="flex items-center gap-2 text-sm md:self-end">
          <input
            type="checkbox"
            checked={Boolean(club.is_active)}
            disabled={!supportsClubIsActive}
            onChange={(event) => updateClubField('is_active', event.target.checked)}
          />
          Club aktiv {!supportsClubIsActive ? '(nicht im Schema verfügbar)' : ''}
        </label>
        <div className="md:col-span-2">
          <button
            type="button"
            disabled={saving}
            onClick={saveClub}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? 'Speichert...' : 'Club speichern'}
          </button>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Club-Features</h2>
        <div className="grid gap-2 md:grid-cols-2">
          {rows.map((row) => (
            <label
              key={row.featureKey}
              className="flex items-center justify-between rounded border border-gray-200 px-3 py-2 dark:border-gray-700"
            >
              <span>{row.label}</span>
              <input
                type="checkbox"
                checked={row.enabled}
                onChange={(event) => toggleClubFeature(row.featureKey, event.target.checked)}
                className="h-4 w-4"
              />
            </label>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Rollenmatrix</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100 dark:bg-gray-800">
              <tr>
                <th className="px-3 py-2 text-left">Feature</th>
                {ROLE_COLUMNS.map((role) => (
                  <th key={role} className="px-3 py-2 text-center uppercase">{role}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`matrix:${row.featureKey}`} className="border-t border-gray-200 dark:border-gray-700">
                  <td className="px-3 py-2">{row.label}</td>
                  {ROLE_COLUMNS.map((role) => {
                    const overrideValue = roleFeatures?.[role]?.[row.featureKey];
                    const enabled = typeof overrideValue === 'boolean' ? overrideValue : true;
                    return (
                      <td key={`${role}:${row.featureKey}`} className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={enabled}
                          disabled={!row.enabled}
                          onChange={(event) => toggleRoleFeature(role, row.featureKey, event.target.checked)}
                          className="h-4 w-4"
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Initiales Vorstand/Admin-Mapping</h2>
        <form onSubmit={assignMembership} className="grid gap-3 md:grid-cols-3">
          <label className="text-sm md:col-span-2">
            User-ID (UUID)
            <input
              type="text"
              value={membershipForm.userId}
              onChange={(event) => setMembershipForm((prev) => ({ ...prev, userId: event.target.value }))}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              placeholder="auth.users.id"
            />
          </label>
          <label className="text-sm">
            Rolle
            <select
              value={membershipForm.role}
              onChange={(event) => setMembershipForm((prev) => ({ ...prev, role: event.target.value }))}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            >
              {ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </label>
          <div className="md:col-span-3">
            <button
              type="submit"
              className="rounded bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
            >
              Membership setzen
            </button>
          </div>
        </form>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Clubspezifische Analyse</h2>
          <button
            type="button"
            onClick={() => setShowClubAnalysis((prev) => !prev)}
            className="rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
          >
            {showClubAnalysis ? 'Analyse ausblenden' : 'Analyse einblenden'}
          </button>
        </div>
        {showClubAnalysis ? (
          <AdminOverview
            key={club.id}
            clubIdOverride={club.id}
            title={`📊 Club-Analyse: ${club.name}`}
            showTelemetry={false}
          />
        ) : (
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Zeigt die bisherige Admin2-Auswertung für diesen Club (Fänge, Page-Views, aktive Nutzer, Push, etc.).
          </p>
        )}
      </section>
    </Card>
  );
}

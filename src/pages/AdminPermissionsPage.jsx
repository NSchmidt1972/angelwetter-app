import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui';
import { supabase } from '@/supabaseClient';
import { usePermissions } from '@/permissions/usePermissions';
import { FEATURES, FEATURE_KEYS, createInitialFeatureMap } from '@/permissions/features';
import { ROLES } from '@/permissions/roles';

const ROLE_COLUMNS = [ROLES.GUEST, ROLES.MEMBER, ROLES.TESTER, ROLES.BOARD, ROLES.ADMIN];

const FEATURE_LABELS = Object.freeze({
  [FEATURES.WEATHER]: 'Wetter',
  [FEATURES.CATCH_LOGGING]: 'Fang-Logging',
  [FEATURES.FORECAST]: 'Forecast',
  [FEATURES.MAP]: 'Karte',
  [FEATURES.LEADERBOARD]: 'Leaderboard',
  [FEATURES.ANALYSIS]: 'Analyse',
  [FEATURES.PUSH]: 'Push',
  [FEATURES.ADMIN_TOOLS]: 'Admin-Tools',
  [FEATURES.WATER_TEMPERATURE]: 'Wassertemperatur',
});

function isMissingTableError(error) {
  const code = String(error?.code || '');
  const message = String(error?.message || '').toLowerCase();
  return code === '42P01' || message.includes('does not exist');
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

function buildFeatureState(rows) {
  const base = createInitialFeatureMap();
  (rows || []).forEach((row) => {
    const key = String(row?.feature_key || '').trim().toLowerCase();
    if (!FEATURE_KEYS.includes(key)) return;
    base[key] = Boolean(row?.enabled);
  });
  return base;
}

export default function AdminPermissionsPage() {
  const {
    currentClub,
    isSuperAdmin,
    hasAtLeastRole,
    loading: permissionsLoading,
    features: contextFeatures,
    roleFeatures: contextRoleFeatures,
    refreshPermissions,
  } = usePermissions();

  const canManage = isSuperAdmin || hasAtLeastRole(ROLES.ADMIN);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [savingKey, setSavingKey] = useState('');
  const [clubFeatures, setClubFeatures] = useState(createInitialFeatureMap());
  const [roleFeatures, setRoleFeatures] = useState({});

  const loadPermissionRows = useCallback(async () => {
    if (!currentClub?.id) {
      setLoading(false);
      setError('Kein aktiver Club vorhanden.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const [clubFeatureResult, roleFeatureResult] = await Promise.all([
        supabase
          .from('club_features')
          .select('feature_key, enabled')
          .eq('club_id', currentClub.id),
        supabase
          .from('club_role_features')
          .select('role, feature_key, enabled')
          .eq('club_id', currentClub.id),
      ]);

      if (clubFeatureResult.error && !isMissingTableError(clubFeatureResult.error)) {
        throw clubFeatureResult.error;
      }
      if (roleFeatureResult.error && !isMissingTableError(roleFeatureResult.error)) {
        throw roleFeatureResult.error;
      }

      setClubFeatures(buildFeatureState(clubFeatureResult.data || []));
      setRoleFeatures(buildRoleFeatureState(roleFeatureResult.data || []));
    } catch (err) {
      setError(err?.message || 'Freigaben konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, [currentClub?.id]);

  useEffect(() => {
    if (permissionsLoading) return;
    if (!canManage) {
      setLoading(false);
      setError('Kein Zugriff. Benötigte Rolle: admin.');
      return;
    }
    setClubFeatures({ ...createInitialFeatureMap(), ...(contextFeatures || {}) });
    setRoleFeatures(contextRoleFeatures || {});
    void loadPermissionRows();
  }, [
    permissionsLoading,
    canManage,
    contextFeatures,
    contextRoleFeatures,
    loadPermissionRows,
  ]);

  const rows = useMemo(
    () => FEATURE_KEYS.map((featureKey) => ({
      featureKey,
      label: FEATURE_LABELS[featureKey] || featureKey,
      enabled: Boolean(clubFeatures[featureKey]),
    })),
    [clubFeatures],
  );

  const toggleClubFeature = async (featureKey, enabled) => {
    if (!currentClub?.id) return;
    setMessage('');
    setSavingKey(`club:${featureKey}`);
    const previous = clubFeatures;
    const nextState = { ...clubFeatures, [featureKey]: enabled };
    setClubFeatures(nextState);

    try {
      const { error: upsertError } = await supabase.from('club_features').upsert(
        {
          club_id: currentClub.id,
          feature_key: featureKey,
          enabled,
        },
        { onConflict: 'club_id,feature_key' },
      );
      if (upsertError) throw upsertError;
      setMessage('Club-Feature gespeichert.');
      refreshPermissions();
    } catch (err) {
      setClubFeatures(previous);
      setError(err?.message || 'Club-Feature konnte nicht gespeichert werden.');
    } finally {
      setSavingKey('');
    }
  };

  const toggleRoleFeature = async (role, featureKey, enabled) => {
    if (!currentClub?.id) return;
    setMessage('');
    setSavingKey(`role:${role}:${featureKey}`);
    const previous = roleFeatures;
    const nextState = {
      ...roleFeatures,
      [role]: {
        ...(roleFeatures[role] || {}),
        [featureKey]: enabled,
      },
    };
    setRoleFeatures(nextState);

    try {
      const { error: upsertError } = await supabase.from('club_role_features').upsert(
        {
          club_id: currentClub.id,
          role,
          feature_key: featureKey,
          enabled,
        },
        { onConflict: 'club_id,role,feature_key' },
      );
      if (upsertError) throw upsertError;
      setMessage('Rollenfreigabe gespeichert.');
      refreshPermissions();
    } catch (err) {
      setRoleFeatures(previous);
      setError(err?.message || 'Rollenfreigabe konnte nicht gespeichert werden.');
    } finally {
      setSavingKey('');
    }
  };

  if (loading) {
    return <Card className="p-6">Freigaben werden geladen...</Card>;
  }

  if (!canManage) {
    return <Card className="p-6 text-red-600">Kein Zugriff. Benötigte Rolle: admin.</Card>;
  }

  return (
    <Card className="space-y-6 p-6">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Admin</p>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Berechtigungen & Features</h1>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Clubweite Module und Rollenfreigaben für <strong>{currentClub?.name || currentClub?.slug || currentClub?.id}</strong>.
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

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Club-Module</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((row) => {
            const key = `club:${row.featureKey}`;
            const isSaving = savingKey === key;
            return (
              <label
                key={row.featureKey}
                className="flex items-center justify-between rounded border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-900"
              >
                <div>
                  <div className="font-medium text-gray-900 dark:text-gray-100">{row.label}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{row.featureKey}</div>
                </div>
                <input
                  type="checkbox"
                  checked={row.enabled}
                  disabled={isSaving}
                  onChange={(event) => toggleClubFeature(row.featureKey, event.target.checked)}
                  className="h-4 w-4"
                />
              </label>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Rollenmatrix</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100 dark:bg-gray-800">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Feature</th>
                {ROLE_COLUMNS.map((role) => (
                  <th key={role} className="px-3 py-2 text-center font-semibold uppercase">{role}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`matrix:${row.featureKey}`} className="border-t border-gray-200 dark:border-gray-700">
                  <td className="px-3 py-2">
                    <div className="font-medium">{row.label}</div>
                    <div className="text-xs text-gray-500">{row.featureKey}</div>
                  </td>
                  {ROLE_COLUMNS.map((role) => {
                    const key = `role:${role}:${row.featureKey}`;
                    const overrideValue = roleFeatures?.[role]?.[row.featureKey];
                    const enabled = typeof overrideValue === 'boolean' ? overrideValue : true;
                    return (
                      <td key={key} className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={enabled}
                          disabled={!row.enabled || savingKey === key}
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
    </Card>
  );
}

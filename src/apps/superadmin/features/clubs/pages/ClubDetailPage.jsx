import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Card } from '@/components/ui';
import { supabase } from '@/supabaseClient';
import {
  FEATURE_KEYS,
  createInitialFeatureMap,
  getRoleFeatureDefaultEnabled,
} from '@/permissions/features';
import { ROLES } from '@/permissions/roles';
import { useSuperAdminHeaderTitle } from '@/apps/superadmin/context/headerTitleContext';
import AdminOverview from '@/pages/AdminOverview';
import PageViewsSection from '@/features/adminOverview/components/PageViewsSection';
import { useAdminPageViews } from '@/features/adminOverview/hooks/useAdminPageViews';
import {
  CLUB_SELECT_VARIANTS,
  isMissingClubIsActiveError,
  isMissingClubLogoUrlError,
  isMissingClubWeatherCoordsError,
  normalizeClubWithSchemaSupport,
  parseWeatherCoords,
} from '@/apps/superadmin/features/clubs/utils/clubSchemaCompat';
import {
  ROLE_COLUMNS,
  ROLE_OPTIONS,
  FEATURE_LABELS,
  buildFeatureState,
  buildRoleFeatureState,
} from '@/apps/superadmin/features/permissions/utils/featureMatrix';
import { formatDateTime } from '@/utils/dateUtils';
import { uploadClubLogoFile, validateClubLogoFile } from '@/apps/superadmin/features/clubs/utils/logoUpload';
import ClubHomeWaterSpeciesSection from '@/apps/superadmin/features/clubs/components/ClubHomeWaterSpeciesSection';

function isMissingWeatherProxyMetricsTableError(error) {
  const code = String(error?.code || '');
  const message = String(error?.message || '').toLowerCase();
  return code === '42P01' || message.includes('weather_proxy_metrics_daily');
}

function toNonNegativeNumber(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, parsed);
}

export default function ClubDetailPage() {
  const setSuperAdminHeaderTitle = useSuperAdminHeaderTitle();
  const { clubId } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [club, setClub] = useState(null);
  const [supportsClubIsActive, setSupportsClubIsActive] = useState(true);
  const [supportsClubWeatherCoords, setSupportsClubWeatherCoords] = useState(true);
  const [supportsClubLogoUrl, setSupportsClubLogoUrl] = useState(true);
  const [logoFile, setLogoFile] = useState(null);
  const [logoFilePreviewUrl, setLogoFilePreviewUrl] = useState('');
  const logoFileInputRef = useRef(null);
  const [clubFeatures, setClubFeatures] = useState(createInitialFeatureMap());
  const [roleFeatures, setRoleFeatures] = useState({});
  const [whitelist, setWhitelist] = useState([]);
  const [whitelistBusy, setWhitelistBusy] = useState(false);
  const [whitelistForm, setWhitelistForm] = useState({
    email: '',
    role: ROLES.BOARD,
    assignRoleIfUserExists: true,
  });
  const [workspaceMode, setWorkspaceMode] = useState('edit');
  const [featureSearch, setFeatureSearch] = useState('');
  const [showEnabledFeaturesOnly, setShowEnabledFeaturesOnly] = useState(false);
  const [supportsWeatherProxyMetrics, setSupportsWeatherProxyMetrics] = useState(true);
  const [weatherMetricRows, setWeatherMetricRows] = useState([]);
  const pageTitle = club?.name ? String(club.name) : 'Club-Details';
  const currentYear = new Date().getFullYear();

  const rows = useMemo(
    () => FEATURE_KEYS.map((featureKey) => ({
      featureKey,
      label: FEATURE_LABELS[featureKey] || featureKey,
      enabled: Boolean(clubFeatures[featureKey]),
    })),
    [clubFeatures],
  );
  const normalizedFeatureSearch = String(featureSearch || '').trim().toLowerCase();
  const visibleRows = useMemo(
    () =>
      rows.filter((row) => {
        if (showEnabledFeaturesOnly && !row.enabled) return false;
        if (!normalizedFeatureSearch) return true;
        const label = String(row.label || '').toLowerCase();
        const key = String(row.featureKey || '').toLowerCase();
        return label.includes(normalizedFeatureSearch) || key.includes(normalizedFeatureSearch);
      }),
    [rows, showEnabledFeaturesOnly, normalizedFeatureSearch],
  );
  const enabledFeatureCount = useMemo(
    () => rows.filter((row) => row.enabled).length,
    [rows],
  );
  const roleOverrideCount = useMemo(
    () =>
      Object.values(roleFeatures || {}).reduce((acc, featureMap) => {
        if (!featureMap || typeof featureMap !== 'object') return acc;
        return acc + Object.values(featureMap).filter((value) => typeof value === 'boolean').length;
      }, 0),
    [roleFeatures],
  );
  const {
    pageViewTotal,
    pageViewRangeLabel,
    pageViewYearFilter,
    pageViewYearOptions,
    setPageViewYearFilter,
    pageViewAggregates,
    pageViewAverage,
    pageViewSectionLoading,
    pageViewSectionError,
    pageViewMonthlyStatsVisible,
    pageViewTopAnglers,
    pageViewUniqueOpenPath,
    uniqueAnglersForPath,
    setPageViewUniqueOpenPath,
  } = useAdminPageViews({
    effectiveClubId: club?.id || null,
    currentYear,
    enabled: workspaceMode === 'analysis',
  });

  const loadClub = useCallback(async () => {
    if (!clubId) return;
    setLoading(true);
    setError('');
    try {
      let clubResult = null;
      let selectMeta = null;
      let lastError = null;
      for (const variant of CLUB_SELECT_VARIANTS) {
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
          isMissingClubWeatherCoordsError(result.error) ||
          isMissingClubLogoUrlError(result.error);
        if (!tolerable) throw result.error;
        lastError = result.error;
      }

      if (!clubResult || !selectMeta) throw lastError || new Error('Club-Details konnten nicht geladen werden.');

      const [featureResult, roleFeatureResult, whitelistResult, metricsResult] = await Promise.all([
        supabase
          .from('club_features')
          .select('feature_key, enabled')
          .eq('club_id', clubId),
        supabase
          .from('club_role_features')
          .select('role, feature_key, enabled')
          .eq('club_id', clubId),
        supabase
          .from('whitelist_emails')
          .select('id, email, role, created_at')
          .eq('club_id', clubId)
          .order('email', { ascending: true }),
        supportsWeatherProxyMetrics
          ? supabase
            .from('weather_proxy_metrics_daily')
            .select('metric_date, openweather_call_count, secondary_key_count, updated_at')
            .eq('club_id', clubId)
            .order('metric_date', { ascending: false })
            .limit(30)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (clubResult.error) throw clubResult.error;
      if (featureResult.error) throw featureResult.error;
      if (roleFeatureResult.error) throw roleFeatureResult.error;
      if (whitelistResult.error) throw whitelistResult.error;

      setSupportsClubIsActive(selectMeta.hasIsActive);
      setSupportsClubWeatherCoords(selectMeta.hasWeatherCoords);
      setSupportsClubLogoUrl(selectMeta.hasLogoUrl);
      setClub(
        clubResult.data ? normalizeClubWithSchemaSupport(clubResult.data, selectMeta) : null,
      );
      setClubFeatures(buildFeatureState(featureResult.data || []));
      setRoleFeatures(buildRoleFeatureState(roleFeatureResult.data || []));
      setWhitelist(whitelistResult.data || []);

      if (metricsResult.error) {
        if (isMissingWeatherProxyMetricsTableError(metricsResult.error)) {
          setSupportsWeatherProxyMetrics(false);
          setWeatherMetricRows([]);
        } else {
          throw metricsResult.error;
        }
      } else {
        const normalizedRows = Array.isArray(metricsResult.data)
          ? metricsResult.data.map((row) => ({
            metric_date: String(row.metric_date || ''),
            openweather_call_count: toNonNegativeNumber(row.openweather_call_count),
            secondary_key_count: toNonNegativeNumber(row.secondary_key_count),
            updated_at: row.updated_at || null,
          }))
          : [];
        setWeatherMetricRows(normalizedRows);
      }
    } catch (err) {
      setError(err?.message || 'Club-Details konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, [clubId, supportsWeatherProxyMetrics]);

  useEffect(() => {
    void loadClub();
  }, [loadClub]);

  useEffect(() => {
    setSuperAdminHeaderTitle(pageTitle);
  }, [pageTitle, setSuperAdminHeaderTitle]);

  const updateClubField = (key, value) => {
    setClub((prev) => ({ ...(prev || {}), [key]: value }));
  };

  const clearSelectedLogoFile = useCallback(() => {
    setLogoFile(null);
    if (logoFileInputRef.current) logoFileInputRef.current.value = '';
    setLogoFilePreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return '';
    });
  }, []);

  useEffect(
    () => () => {
      if (logoFilePreviewUrl) URL.revokeObjectURL(logoFilePreviewUrl);
    },
    [logoFilePreviewUrl],
  );

  const weatherMetricsSummary = useMemo(() => {
    const totals = weatherMetricRows.reduce(
      (acc, row) => ({
        openweather_call_count: acc.openweather_call_count + toNonNegativeNumber(row.openweather_call_count),
        secondary_key_count: acc.secondary_key_count + toNonNegativeNumber(row.secondary_key_count),
      }),
      {
        openweather_call_count: 0,
        secondary_key_count: 0,
      },
    );
    const latestUpdatedAt = weatherMetricRows[0]?.updated_at || null;

    return {
      ...totals,
      latestUpdatedAt,
    };
  }, [weatherMetricRows]);

  const handleLogoFileChange = (event) => {
    const file = event.target.files?.[0] || null;
    if (!file) {
      clearSelectedLogoFile();
      return;
    }

    const validation = validateClubLogoFile(file);
    if (!validation.ok) {
      setError(validation.error);
      if (logoFileInputRef.current) logoFileInputRef.current.value = '';
      return;
    }

    setError('');
    setLogoFile(file);
    setLogoFilePreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
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

      let uploadedLogoUrl = null;
      if (supportsClubLogoUrl && logoFile) {
        uploadedLogoUrl = await uploadClubLogoFile({
          clubId: club.id,
          file: logoFile,
        });
      }
      if (supportsClubLogoUrl) {
        payload.logo_url = uploadedLogoUrl || String(club.logo_url || '').trim() || null;
      }
      const updateWithPayload = await supabase.from('clubs').update(payload).eq('id', club.id);
      if (updateWithPayload.error) {
        const missingIsActive = isMissingClubIsActiveError(updateWithPayload.error);
        const missingCoords = isMissingClubWeatherCoordsError(updateWithPayload.error);
        const missingLogoUrl = isMissingClubLogoUrlError(updateWithPayload.error);
        if (
          (!supportsClubIsActive || !missingIsActive) &&
          (!supportsClubWeatherCoords || !missingCoords) &&
          (!supportsClubLogoUrl || !missingLogoUrl)
        ) {
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
        if (missingLogoUrl) {
          delete payloadWithoutUnsupported.logo_url;
          setSupportsClubLogoUrl(false);
        }

        const updateFallback = await supabase.from('clubs').update(payloadWithoutUnsupported).eq('id', club.id);
        if (updateFallback.error) throw updateFallback.error;
      }
      clearSelectedLogoFile();
      const notices = ['Club gespeichert.'];
      if (logoFile && uploadedLogoUrl) notices.push('Logo hochgeladen.');
      if (logoFile && !supportsClubLogoUrl) notices.push('Logo-Spalte im Schema nicht verfügbar.');
      setMessage(notices.join(' '));
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

  const addWhitelistEntry = async (event) => {
    event.preventDefault();
    if (!club?.id) return;
    const cleanEmail = String(whitelistForm.email || '').trim().toLowerCase();
    const selectedRole = whitelistForm.role;
    const assignRoleIfUserExists = Boolean(whitelistForm.assignRoleIfUserExists);
    if (!cleanEmail) {
      setError('E-Mail-Adresse fehlt.');
      return;
    }

    setError('');
    setMessage('');
    setWhitelistBusy(true);
    try {
      const { error: whitelistInsertError } = await supabase
        .from('whitelist_emails')
        .upsert({
          club_id: club.id,
          email: cleanEmail,
          role: selectedRole,
        }, { onConflict: 'email,club_id' });
      if (whitelistInsertError) throw whitelistInsertError;

      let userFound = false;
      let roleAssigned = false;

      if (assignRoleIfUserExists) {
        const { data: resolvedUserId, error: resolveError } = await supabase.rpc(
          'superadmin_resolve_user_id_by_email',
          { p_email: cleanEmail },
        );
        if (resolveError) throw resolveError;

        if (resolvedUserId) {
          userFound = true;
          const { error: upsertError } = await supabase.from('memberships').upsert(
            {
              user_id: resolvedUserId,
              club_id: club.id,
              role: selectedRole,
              is_active: true,
            },
            { onConflict: 'user_id,club_id' },
          );
          if (upsertError) throw upsertError;
          roleAssigned = true;
        }
      }

      await loadClub();
      setWhitelistForm((prev) => ({ ...prev, email: '' }));

      if (roleAssigned) {
        setMessage('Whitelist gespeichert und Rolle gesetzt.');
        return;
      }
      if (assignRoleIfUserExists && !userFound) {
        setMessage('Whitelist gespeichert. Noch kein Account gefunden; Rolle wird beim ersten Login übernommen.');
        return;
      }
      setMessage('Whitelist gespeichert.');
    } catch (err) {
      setError(err?.message || 'Whitelist konnte nicht gespeichert werden.');
    } finally {
      setWhitelistBusy(false);
    }
  };

  const removeWhitelistEntry = async (entryId) => {
    if (!club?.id || !entryId || whitelistBusy) return;
    setError('');
    setMessage('');
    setWhitelistBusy(true);
    try {
      const { error: deleteError } = await supabase
        .from('whitelist_emails')
        .delete()
        .eq('id', entryId)
        .eq('club_id', club.id);
      if (deleteError) throw deleteError;
      await loadClub();
      setMessage('Whitelist-Eintrag entfernt.');
    } catch (err) {
      setError(err?.message || 'Whitelist-Eintrag konnte nicht entfernt werden.');
    } finally {
      setWhitelistBusy(false);
    }
  };

  if (loading) return <Card className="p-4 sm:p-6">Club-Details werden geladen...</Card>;
  if (!club) return <Card className="p-4 text-red-600 sm:p-6">Club nicht gefunden.</Card>;
  const logoPreviewUrl = String(club.logo_url || '').trim();
  const effectiveLogoPreviewUrl = logoFilePreviewUrl || logoPreviewUrl;
  const hasEffectiveLogoPreview = Boolean(effectiveLogoPreviewUrl);
  const tenantLinkPath = `/${club.slug}/vorstand`;
  const clubIsActive = club.is_active !== false;
  const isEditView = workspaceMode === 'edit';
  const isAnalysisView = workspaceMode === 'analysis';
  const fallbackTextClass = 'text-sm text-gray-700 dark:text-gray-300';
  const formatDateTimeLabel = (value) => {
    if (!value) return 'unbekannt';
    return formatDateTime(value);
  };
  const openWeatherSummaryLabel = !supportsWeatherProxyMetrics
    ? 'Nicht verfügbar'
    : `${weatherMetricsSummary.openweather_call_count} OWM · ${weatherMetricsSummary.secondary_key_count} Secondary`;

  return (
    <Card className="space-y-6 p-4 sm:p-6">
      <section className="rounded-xl border border-gray-200 bg-gradient-to-br from-white to-gray-50 p-4 shadow-sm dark:border-gray-700 dark:from-gray-900 dark:to-gray-950">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <Link to="/superadmin/clubs" className="text-xs font-semibold text-blue-600 hover:underline">
              Zurück zur Club-Liste
            </Link>
            <h1 className="break-words text-2xl font-bold text-gray-900 dark:text-gray-100">{club.name}</h1>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Slug: <span className="font-mono">{club.slug}</span>
            </p>
            <p className="break-all text-sm text-gray-600 dark:text-gray-300">
              Tenant-Link:{' '}
              <Link to={tenantLinkPath} className="break-all text-blue-600 hover:underline">
                {tenantLinkPath}
              </Link>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                clubIsActive
                  ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border border-rose-200 bg-rose-50 text-rose-700'
              }`}
            >
              {clubIsActive ? 'Aktiv' : 'Inaktiv'}
            </span>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900/70">
            <p className="text-xs text-gray-500 dark:text-gray-400">Club-ID</p>
            <p className="break-all font-mono text-xs text-gray-700 dark:text-gray-200">{club.id}</p>
          </div>
          <div className="rounded border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900/70">
            <p className="text-xs text-gray-500 dark:text-gray-400">Aktivierte Features</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {enabledFeatureCount}/{rows.length}
            </p>
          </div>
          <div className="rounded border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900/70">
            <p className="text-xs text-gray-500 dark:text-gray-400">Whitelist</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{whitelist.length} Einträge</p>
          </div>
          <div className="rounded border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900/70">
            <p className="text-xs text-gray-500 dark:text-gray-400">OWM Requests (30 Tage)</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {supportsWeatherProxyMetrics ? weatherMetricsSummary.openweather_call_count : '—'}
            </p>
          </div>
        </div>
      </section>

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

      <section className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Arbeitsbereich</h2>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Bearbeitung und Analyse sind getrennt, damit die Seite fokussiert bleibt.
          </p>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <button
            type="button"
            onClick={() => setWorkspaceMode('edit')}
            aria-pressed={isEditView}
            className={`rounded-lg border p-3 text-left transition ${
              isEditView
                ? 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800/70'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Verein bearbeiten</p>
              <span className="rounded-full border border-gray-300 px-2 py-0.5 text-[11px] text-gray-600 dark:border-gray-600 dark:text-gray-300">
                5 Bereiche
              </span>
            </div>
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
              Stammdaten, Features, Rollenmatrix, Whitelist und Vereinsgewässer-Fischarten.
            </p>
            <p className="mt-2 text-xs font-medium text-gray-700 dark:text-gray-200">
              {enabledFeatureCount} aktive Features, {whitelist.length} Whitelist-Einträge
            </p>
          </button>

          <button
            type="button"
            onClick={() => setWorkspaceMode('analysis')}
            aria-pressed={isAnalysisView}
            className={`rounded-lg border p-3 text-left transition ${
              isAnalysisView
                ? 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800/70'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Verein analysieren</p>
              <span className="rounded-full border border-gray-300 px-2 py-0.5 text-[11px] text-gray-600 dark:border-gray-600 dark:text-gray-300">
                Insights
              </span>
            </div>
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
              Seitenaufrufe als eigene Sektion plus clubspezifische Analyse-Kennzahlen.
            </p>
            <p className="mt-2 text-xs font-medium text-gray-700 dark:text-gray-200">
              {isAnalysisView ? `${pageViewTotal} Seitenaufrufe (${pageViewRangeLabel})` : 'Analyse lädt nur in diesem Modus'}
            </p>
          </button>
        </div>
      </section>

      {isEditView ? (
        <>
      <details id="club-basics" className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
        <summary className="cursor-pointer list-none text-lg font-semibold">
          1. Stammdaten & Branding ({clubIsActive ? 'Aktiv' : 'Inaktiv'})
        </summary>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
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
          <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800/50">
            <div className="text-xs text-gray-500 dark:text-gray-400">Schema-Status</div>
            <div className="mt-1 text-xs text-gray-700 dark:text-gray-200">
              is_active: {supportsClubIsActive ? 'verfügbar' : 'nicht verfügbar'} | Koordinaten: {supportsClubWeatherCoords ? 'verfügbar' : 'nicht verfügbar'} | Logo-URL: {supportsClubLogoUrl ? 'verfügbar' : 'nicht verfügbar'}
            </div>
          </div>
          <label className="text-sm md:col-span-2">
            Logo-URL (optional)
            <input
              type="url"
              value={club.logo_url || ''}
              onChange={(event) => updateClubField('logo_url', event.target.value)}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              disabled={!supportsClubLogoUrl}
              placeholder="https://... oder /logos/asv-blauauge.png"
            />
          </label>
          <div className="text-sm md:col-span-2">
            <input
              ref={logoFileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={handleLogoFileChange}
              className="hidden"
              disabled={!supportsClubLogoUrl || saving}
            />
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => logoFileInputRef.current?.click()}
                disabled={!supportsClubLogoUrl || saving}
                className="rounded border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-blue-700 dark:bg-blue-900/20 dark:text-blue-200 dark:hover:bg-blue-900/30"
              >
                Logo auswählen
              </button>
              {logoFile ? (
                <button
                  type="button"
                  onClick={clearSelectedLogoFile}
                  disabled={saving}
                  className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  Auswahl entfernen
                </button>
              ) : null}
              <span className="break-all text-xs text-gray-500 dark:text-gray-400">
                {supportsClubLogoUrl
                  ? (logoFile
                    ? `${logoFile.name} ausgewählt. Upload beim Speichern.`
                    : 'PNG, JPG, WEBP oder SVG (max. 5 MB).')
                  : 'Logo-Datei-Upload ist mit dem aktuellen DB-Schema nicht verfügbar.'}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-3 rounded border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-800/60">
              <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full border border-gray-200 bg-white dark:border-gray-600 dark:bg-gray-900">
                {hasEffectiveLogoPreview ? (
                  <img
                    src={effectiveLogoPreviewUrl}
                    alt="Logo-Vorschau"
                    className="h-full w-full object-cover"
                    loading="lazy"
                    onError={(event) => {
                      event.currentTarget.style.display = 'none';
                    }}
                  />
                ) : null}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-700 dark:text-gray-200">Logo-Vorschau</p>
                <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                  {logoFile ? 'Lokale Vorschau (noch nicht gespeichert)' : (logoPreviewUrl || 'Kein Logo hinterlegt')}
                </p>
              </div>
            </div>
          </div>
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
        </div>
      </details>

      <details id="club-features" className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
        <summary className="cursor-pointer list-none text-lg font-semibold">
          2. Club-Features ({enabledFeatureCount}/{rows.length} aktiv)
        </summary>
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="search"
              value={featureSearch}
              onChange={(event) => setFeatureSearch(event.target.value)}
              placeholder="Feature suchen"
              className="w-full max-w-sm rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showEnabledFeaturesOnly}
                onChange={(event) => setShowEnabledFeaturesOnly(event.target.checked)}
              />
              Nur aktivierte Features
            </label>
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            {visibleRows.length === 0 ? (
              <div className="rounded border border-dashed border-gray-300 px-3 py-4 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                Keine Features für den aktuellen Filter.
              </div>
            ) : (
              visibleRows.map((row) => (
                <label
                  key={row.featureKey}
                  className="flex items-center justify-between rounded border border-gray-200 px-3 py-2 dark:border-gray-700"
                >
                  <span className="min-w-0">
                    <span className="block truncate">{row.label}</span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400">{row.featureKey}</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={row.enabled}
                    onChange={(event) => toggleClubFeature(row.featureKey, event.target.checked)}
                    className="h-4 w-4"
                  />
                </label>
              ))
            )}
          </div>
        </div>
      </details>

      <details id="club-roles" className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
        <summary className="cursor-pointer list-none text-lg font-semibold">
          3. Rollenmatrix ({roleOverrideCount} gespeicherte Overrides)
        </summary>
        <div className="-mx-4 mt-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          {visibleRows.length === 0 ? (
            <p className="text-sm text-gray-600 dark:text-gray-300">Keine Features für den aktuellen Filter.</p>
          ) : (
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
                {visibleRows.map((row) => (
                  <tr key={`matrix:${row.featureKey}`} className="border-t border-gray-200 dark:border-gray-700">
                    <td className="px-3 py-2">{row.label}</td>
                    {ROLE_COLUMNS.map((role) => {
                      const overrideValue = roleFeatures?.[role]?.[row.featureKey];
                      const enabled =
                        typeof overrideValue === 'boolean'
                          ? overrideValue
                          : getRoleFeatureDefaultEnabled(row.featureKey);
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
          )}
        </div>
      </details>

      <details id="club-whitelist" className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
        <summary className="cursor-pointer list-none text-lg font-semibold">
          4. Initiale Freischaltung (Whitelist + Rolle) ({whitelist.length})
        </summary>
        <div className="mt-4 space-y-3">
          <form onSubmit={addWhitelistEntry} className="grid gap-3 md:grid-cols-3">
            <label className="text-sm md:col-span-2">
              E-Mail
              <input
                type="email"
                value={whitelistForm.email}
                onChange={(event) => setWhitelistForm((prev) => ({ ...prev, email: event.target.value }))}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
                placeholder="vorstand@verein.de"
                required
              />
              <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
                Diese E-Mail darf sich für den Verein anmelden.
              </span>
            </label>
            <label className="text-sm">
              Rolle (optional direkt setzen)
              <select
                value={whitelistForm.role}
                onChange={(event) => setWhitelistForm((prev) => ({ ...prev, role: event.target.value }))}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              >
                {ROLE_OPTIONS.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm md:col-span-2">
              <input
                type="checkbox"
                checked={Boolean(whitelistForm.assignRoleIfUserExists)}
                onChange={(event) =>
                  setWhitelistForm((prev) => ({ ...prev, assignRoleIfUserExists: event.target.checked }))
                }
              />
              Wenn Account schon existiert, Rolle sofort setzen
            </label>
            <div className="md:col-span-3">
              <button
                type="submit"
                disabled={whitelistBusy}
                className="rounded bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
              >
                {whitelistBusy ? 'Speichert...' : 'Whitelist speichern'}
              </button>
            </div>
          </form>

          <div className="-mx-4 overflow-x-auto rounded border border-gray-200 px-4 sm:mx-0 sm:px-0 dark:border-gray-700">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100 dark:bg-gray-800">
                <tr>
                  <th className="px-3 py-2 text-left">E-Mail</th>
                  <th className="px-3 py-2 text-left">Rolle</th>
                  <th className="px-3 py-2 text-left">Freigeschaltet am</th>
                  <th className="px-3 py-2 text-right">Aktion</th>
                </tr>
              </thead>
              <tbody>
                {whitelist.length === 0 ? (
                  <tr className="border-t border-gray-200 dark:border-gray-700">
                    <td colSpan={4} className="px-3 py-3 text-gray-500 dark:text-gray-400">
                      Keine Whitelist-Einträge vorhanden.
                    </td>
                  </tr>
                ) : (
                  whitelist.map((entry) => (
                    <tr key={entry.id} className="border-t border-gray-200 dark:border-gray-700">
                      <td className="break-all px-3 py-2 font-mono">{entry.email}</td>
                      <td className="px-3 py-2">{entry.role || ROLES.MEMBER}</td>
                      <td className="px-3 py-2">{entry.created_at ? formatDateTime(entry.created_at) : '—'}</td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          disabled={whitelistBusy}
                          onClick={() => removeWhitelistEntry(entry.id)}
                          className="rounded border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-800/50 dark:text-red-300 dark:hover:bg-red-900/20"
                        >
                          Entfernen
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </details>

      <ClubHomeWaterSpeciesSection
        clubId={club.id}
        onMessage={(nextMessage) => {
          setError('');
          setMessage(nextMessage);
        }}
        onError={(nextError) => {
          setMessage('');
          setError(nextError);
        }}
      />
        </>
      ) : null}

      {isAnalysisView ? (
        <section
          id="club-analysis"
          className="space-y-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
        >
          <h2 className="text-lg font-semibold">Clubspezifische Analyse</h2>

          <div className="mb-4 rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                <h3 className="text-base font-semibold text-blue-700 dark:text-blue-400">OpenWeather Monitoring (30 Tage)</h3>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                    {openWeatherSummaryLabel}
                  </span>
                  <span className="text-xs text-gray-500 transition-transform group-open:rotate-90 dark:text-gray-400">
                    ▶
                  </span>
                </div>
              </summary>
              <div className="space-y-3 border-t border-gray-100 px-4 pb-4 pt-3 dark:border-gray-700">
                {!supportsWeatherProxyMetrics ? (
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Monitoring-Tabelle ist im aktuellen Schema noch nicht verfügbar.
                  </p>
                ) : weatherMetricRows.length === 0 ? (
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Noch keine Metriken für diesen Verein vorhanden.
                  </p>
                ) : (
                  <div className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <div className="rounded border border-gray-200 px-3 py-2 dark:border-gray-700">
                        <p className="text-xs text-gray-500 dark:text-gray-400">OpenWeather-Requests</p>
                        <p className="text-lg font-semibold">{weatherMetricsSummary.openweather_call_count}</p>
                      </div>
                      <div className="rounded border border-gray-200 px-3 py-2 dark:border-gray-700">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Secondary-Key-Nutzung</p>
                        <p className="text-lg font-semibold">{weatherMetricsSummary.secondary_key_count}</p>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Letztes Update:{' '}
                      {weatherMetricsSummary.latestUpdatedAt
                        ? formatDateTime(weatherMetricsSummary.latestUpdatedAt)
                        : '—'}
                    </p>
                    <div className="-mx-3 overflow-x-auto rounded border border-gray-200 px-3 sm:mx-0 sm:px-0 dark:border-gray-700">
                      <table className="min-w-full text-sm">
                        <thead className="bg-gray-100 dark:bg-gray-800">
                          <tr>
                            <th className="px-3 py-2 text-left">Datum</th>
                            <th className="px-3 py-2 text-right">OpenWeather</th>
                            <th className="px-3 py-2 text-right">Secondary</th>
                          </tr>
                        </thead>
                        <tbody>
                          {weatherMetricRows.map((row) => {
                            const dateValue = row.metric_date
                              ? new Date(`${row.metric_date}T00:00:00Z`).toLocaleDateString('de-DE')
                              : '—';
                            return (
                              <tr key={row.metric_date} className="border-t border-gray-200 dark:border-gray-700">
                                <td className="px-3 py-2">{dateValue}</td>
                                <td className="px-3 py-2 text-right">{row.openweather_call_count}</td>
                                <td className="px-3 py-2 text-right">{row.secondary_key_count}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </details>
          </div>

          <PageViewsSection
            pageViewLoading={pageViewSectionLoading}
            pageViewTotal={pageViewTotal}
            pageViewRangeLabel={pageViewRangeLabel}
            pageViewYearFilter={pageViewYearFilter}
            pageViewYearOptions={pageViewYearOptions}
            setPageViewYearFilter={setPageViewYearFilter}
            pageViewAggregates={pageViewAggregates}
            pageViewAverage={pageViewAverage}
            pageViewError={pageViewSectionError}
            pageViewMonthlyStats={pageViewMonthlyStatsVisible}
            pageViewTopAnglers={pageViewTopAnglers}
            fallbackTextClass={fallbackTextClass}
            formatDateTimeLabel={formatDateTimeLabel}
            pageViewUniqueOpenPath={pageViewUniqueOpenPath}
            uniqueAnglersForPath={uniqueAnglersForPath}
            setPageViewUniqueOpenPath={setPageViewUniqueOpenPath}
            collapsible
            defaultOpen={false}
          />

          <AdminOverview
            key={club.id}
            clubIdOverride={club.id}
            title={`Club-Analyse: ${club.name}`}
            showTitle={false}
            embedded
            collapseSections
            sectionsDefaultOpen={false}
            showTelemetry={false}
            showPageViews={false}
            showOneSignalDebug={false}
          />
        </section>
      ) : null}
    </Card>
  );
}

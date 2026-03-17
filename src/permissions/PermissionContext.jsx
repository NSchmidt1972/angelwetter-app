import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/AuthContext';
import { supabase } from '@/supabaseClient';
import { getActiveClubId, getClubIdForSlug, rememberClubSlugId, setActiveClubId } from '@/utils/clubId';
import { useAppResumeTick } from '@/hooks/useAppResumeTick';
import {
  createInitialFeatureMap,
  createLegacyFeatureMap,
  FEATURE_KEYS,
  FEATURE_MIN_ROLE,
  isFeatureKey,
} from '@/permissions/features';
import { ROLES, getRoleLevel, isRoleAtLeast, normalizeRole } from '@/permissions/roles';

const PermissionContext = createContext(null);

const STATIC_NON_CLUB_SEGMENTS = new Set([
  'auth',
  'update-password',
  'reset-done',
  'auth-verified',
  'forgot-password',
  'superadmin',
  '__ux',
]);

const MEMBERSHIP_SELECT_VARIANTS = Object.freeze([
  {
    select: 'user_id, club_id, role, is_active, clubs:club_id(id, slug, name, logo_url)',
    hasLogoUrl: true,
  },
  {
    select: 'user_id, club_id, role, is_active, clubs:club_id(id, slug, name)',
    hasLogoUrl: false,
  },
]);

function getClubSlugFromPath(pathname) {
  if (typeof pathname !== 'string') return null;
  const first = pathname.split('/').filter(Boolean)[0] || null;
  if (!first) return null;
  const normalized = first.trim().toLowerCase();
  if (!normalized || STATIC_NON_CLUB_SEGMENTS.has(normalized)) return null;
  return normalized;
}

function isMissingTableError(error) {
  const code = String(error?.code || '');
  const message = String(error?.message || '').toLowerCase();
  return code === '42P01' || message.includes('does not exist');
}

function isMissingClubLogoUrlError(error) {
  const code = String(error?.code || '');
  const message = String(error?.message || '').toLowerCase();
  return code === '42703' && message.includes('clubs.logo_url');
}

function buildRoleFeatureMap(rows) {
  return (rows || []).reduce((acc, row) => {
    const role = normalizeRole(row?.role, ROLES.GUEST);
    const featureKey = String(row?.feature_key || '').trim().toLowerCase();
    if (!FEATURE_KEYS.includes(featureKey)) return acc;
    if (!acc[role]) acc[role] = {};
    acc[role][featureKey] = Boolean(row?.enabled);
    return acc;
  }, {});
}

function buildFeatureMap(rows) {
  const base = createInitialFeatureMap();
  (rows || []).forEach((row) => {
    const featureKey = String(row?.feature_key || '').trim().toLowerCase();
    if (!FEATURE_KEYS.includes(featureKey)) return;
    base[featureKey] = Boolean(row?.enabled);
  });
  return base;
}

function normalizeMembershipRows(rows) {
  return (rows || []).map((row) => ({
    ...row,
    role: normalizeRole(row?.role, ROLES.GUEST),
  }));
}

function isDuplicateKeyError(error) {
  return String(error?.code || '') === '23505';
}

async function resolveClubIdBySlug(slug) {
  if (!slug) return null;
  const { data, error } = await supabase
    .from('clubs')
    .select('id, slug')
    .eq('slug', slug)
    .maybeSingle();
  if (error || !data?.id) return null;
  return data.id;
}

async function fetchMembershipRowsForUser(userId) {
  let lastError = null;

  for (const variant of MEMBERSHIP_SELECT_VARIANTS) {
    const result = await supabase
      .from('memberships')
      .select(variant.select)
      .eq('user_id', userId);

    if (!result.error) {
      return {
        rows: result.data || [],
        hasLogoUrl: variant.hasLogoUrl,
      };
    }

    if (!isMissingClubLogoUrlError(result.error)) {
      throw result.error;
    }
    lastError = result.error;
  }

  if (lastError) throw lastError;
  return { rows: [], hasLogoUrl: false };
}

async function tryProvisionMembershipForUser({
  userId,
  userEmail,
  fallbackName,
  clubId,
  allowSelfProvision = false,
}) {
  const email = String(userEmail || '').trim().toLowerCase();
  if (!allowSelfProvision) return false;
  if (!userId || !clubId || !email) return false;

  const { data: whitelisted, error: whitelistError } = await supabase.rpc('is_email_whitelisted', {
    p_email: email,
    p_club_id: clubId,
  });
  if (whitelistError || !whitelisted) return false;

  const { data: profileRow, error: profileSelectError } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .eq('club_id', clubId)
    .maybeSingle();
  if (profileSelectError) return false;

  if (!profileRow) {
    const safeFallbackName = String(fallbackName || email).trim() || email;
    const { error: profileInsertError } = await supabase.from('profiles').insert({
      id: userId,
      name: safeFallbackName,
      club_id: clubId,
    });
    if (profileInsertError && !isDuplicateKeyError(profileInsertError)) {
      return false;
    }
  }

  let roleForClub = ROLES.MEMBER;
  try {
    const { data: whitelistedRole, error: roleError } = await supabase.rpc('whitelist_role_for_email', {
      p_email: email,
      p_club_id: clubId,
    });
    if (!roleError) {
      roleForClub = normalizeRole(whitelistedRole || ROLES.MEMBER, ROLES.MEMBER);
    }
  } catch {
    roleForClub = ROLES.MEMBER;
  }

  const { error: membershipInsertError } = await supabase.from('memberships').insert({
    user_id: userId,
    club_id: clubId,
    role: roleForClub,
    is_active: true,
  });
  if (membershipInsertError && !isDuplicateKeyError(membershipInsertError)) {
    return false;
  }

  return true;
}

export function PermissionProvider({ children }) {
  const { user, profile } = useAuth();
  const location = useLocation();
  const clubSlugFromPath = useMemo(
    () => getClubSlugFromPath(location.pathname),
    [location.pathname]
  );
  const resumeTick = useAppResumeTick({ enabled: true });
  const [reloadToken, setReloadToken] = useState(0);
  const [clubContextTick, setClubContextTick] = useState(0);
  const hasResolvedPermissionsRef = useRef(false);
  const lastLoadTriggerRef = useRef({
    userId: null,
    userEmail: null,
    userName: null,
    profileName: null,
    profileRole: null,
    clubSlugFromPath: null,
    reloadToken: 0,
    clubContextTick: 0,
    resumeTick: 0,
  });
  const [state, setState] = useState(() => ({
    loading: true,
    error: null,
    isSuperAdmin: false,
    memberships: [],
    membership: null,
    currentClub: null,
    role: ROLES.GUEST,
    roleLevel: getRoleLevel(ROLES.GUEST),
    features: createInitialFeatureMap(),
    roleFeatures: {},
    featureRows: [],
    roleFeatureRows: [],
  }));

  const refreshPermissions = useCallback(() => {
    setReloadToken((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handler = () => setClubContextTick((prev) => prev + 1);
    window.addEventListener('angelwetter:club-context-changed', handler);
    return () => window.removeEventListener('angelwetter:club-context-changed', handler);
  }, []);

  useEffect(() => {
    let active = true;
    const currentTrigger = {
      userId: user?.id ?? null,
      userEmail: user?.email ?? null,
      userName: user?.user_metadata?.name ?? null,
      profileName: profile?.name ?? null,
      profileRole: profile?.role ?? null,
      clubSlugFromPath: clubSlugFromPath ?? null,
      reloadToken,
      clubContextTick,
      resumeTick,
    };
    const previousTrigger = lastLoadTriggerRef.current;
    const nonResumeTriggerChanged =
      previousTrigger.userId !== currentTrigger.userId
      || previousTrigger.userEmail !== currentTrigger.userEmail
      || previousTrigger.userName !== currentTrigger.userName
      || previousTrigger.profileName !== currentTrigger.profileName
      || previousTrigger.profileRole !== currentTrigger.profileRole
      || previousTrigger.clubSlugFromPath !== currentTrigger.clubSlugFromPath
      || previousTrigger.reloadToken !== currentTrigger.reloadToken
      || previousTrigger.clubContextTick !== currentTrigger.clubContextTick;
    const isResumeOnlyRefresh =
      previousTrigger.resumeTick !== currentTrigger.resumeTick && !nonResumeTriggerChanged;
    lastLoadTriggerRef.current = currentTrigger;

    const load = async () => {
      if (!user?.id) {
        if (!active) return;
        setState({
          loading: false,
          error: null,
          isSuperAdmin: false,
          memberships: [],
          membership: null,
          currentClub: null,
          role: ROLES.GUEST,
          roleLevel: getRoleLevel(ROLES.GUEST),
          features: createInitialFeatureMap(),
          roleFeatures: {},
          featureRows: [],
          roleFeatureRows: [],
        });
        hasResolvedPermissionsRef.current = true;
        return;
      }

      const shouldShowBlockingLoading = !isResumeOnlyRefresh || !hasResolvedPermissionsRef.current;
      setState((prev) => (
        shouldShowBlockingLoading
          ? { ...prev, loading: true, error: null }
          : { ...prev, error: null }
      ));

      try {
        const [membershipsResult, superadminResult] = await Promise.all([
          fetchMembershipRowsForUser(user.id),
          supabase.rpc('is_superadmin'),
        ]);

        if (!active) return;
        if (superadminResult.error) throw superadminResult.error;

        let memberships = normalizeMembershipRows(membershipsResult.rows || []);
        const clubSlug = clubSlugFromPath;
        const cachedClubIdFromSlug = clubSlug ? getClubIdForSlug(clubSlug) : null;
        let clubIdFromPath = cachedClubIdFromSlug;
        if (clubSlug) {
          const resolvedByQuery = await resolveClubIdBySlug(clubSlug);
          if (resolvedByQuery) {
            clubIdFromPath = resolvedByQuery;
            if (cachedClubIdFromSlug !== resolvedByQuery) {
              rememberClubSlugId(clubSlug, resolvedByQuery);
            }
          }
        }

        const isSuperAdmin = Boolean(superadminResult.data);
        if (clubIdFromPath && !isSuperAdmin) {
          const pathClubMembership = memberships.find(
            (row) => row.club_id === clubIdFromPath
          );
          const hasActivePathClubMembership = Boolean(pathClubMembership && pathClubMembership?.is_active !== false);
          if (!pathClubMembership && !hasActivePathClubMembership) {
            const fallbackName = profile?.name || user?.user_metadata?.name || user?.email || '';
            const provisioned = await tryProvisionMembershipForUser({
              userId: user.id,
              userEmail: user.email,
              fallbackName,
              clubId: clubIdFromPath,
              allowSelfProvision: memberships.length === 0,
            });
            if (provisioned) {
              const refreshedMembershipsResult = await fetchMembershipRowsForUser(user.id);
              memberships = normalizeMembershipRows(refreshedMembershipsResult.rows || []);
            }
          }
        }

        const activeMemberships = memberships.filter((row) => row?.is_active !== false);
        const activeClubId = getActiveClubId();

        let resolvedClubId = clubIdFromPath || activeClubId || activeMemberships[0]?.club_id || null;
        if (
          resolvedClubId &&
          activeMemberships.length > 0 &&
          !activeMemberships.some((row) => row.club_id === resolvedClubId)
        ) {
          resolvedClubId = activeMemberships[0]?.club_id || null;
        }

        if (resolvedClubId) {
          setActiveClubId(resolvedClubId);
          if (clubSlug && clubIdFromPath && resolvedClubId === clubIdFromPath) {
            rememberClubSlugId(clubSlug, resolvedClubId);
          }
        }

        const membership =
          activeMemberships.find((row) => row.club_id === resolvedClubId) ||
          activeMemberships[0] ||
          null;

        const currentClub = resolvedClubId
          ? {
              id: resolvedClubId,
              slug: clubSlug || membership?.clubs?.slug || null,
              name: membership?.clubs?.name || null,
              logoUrl: membership?.clubs?.logo_url || null,
              isActive: membership?.clubs?.is_active ?? true,
            }
          : null;

        let featureRows = [];
        let roleFeatureRows = [];
        let featureMap = createInitialFeatureMap();
        let roleFeatureMap = {};

        if (resolvedClubId) {
          const [featureResult, roleFeatureResult] = await Promise.all([
            supabase
              .from('club_features')
              .select('club_id, feature_key, enabled')
              .eq('club_id', resolvedClubId),
            supabase
              .from('club_role_features')
              .select('club_id, role, feature_key, enabled')
              .eq('club_id', resolvedClubId),
          ]);

          if (featureResult.error && !isMissingTableError(featureResult.error)) throw featureResult.error;
          if (roleFeatureResult.error && !isMissingTableError(roleFeatureResult.error)) throw roleFeatureResult.error;

          const featureTableMissing = isMissingTableError(featureResult.error);
          const roleFeatureTableMissing = isMissingTableError(roleFeatureResult.error);

          featureRows = Array.isArray(featureResult.data) ? featureResult.data : [];
          roleFeatureRows = Array.isArray(roleFeatureResult.data) ? roleFeatureResult.data : [];
          featureMap =
            featureTableMissing || roleFeatureTableMissing
              ? createLegacyFeatureMap()
              : buildFeatureMap(featureRows);
          roleFeatureMap = buildRoleFeatureMap(roleFeatureRows);
        }

        const role = normalizeRole(membership?.role ?? ROLES.GUEST, ROLES.GUEST);

        setState({
          loading: false,
          error: null,
          isSuperAdmin,
          memberships,
          membership,
          currentClub,
          role,
          roleLevel: getRoleLevel(role),
          features: featureMap,
          roleFeatures: roleFeatureMap,
          featureRows,
          roleFeatureRows,
        });
        hasResolvedPermissionsRef.current = true;
      } catch (error) {
        if (!active) return;
        const fallbackRole = normalizeRole(ROLES.GUEST, ROLES.GUEST);
        setState({
          loading: false,
          error: error?.message || String(error),
          isSuperAdmin: false,
          memberships: [],
          membership: null,
          currentClub: null,
          role: fallbackRole,
          roleLevel: getRoleLevel(fallbackRole),
          features: createInitialFeatureMap(),
          roleFeatures: {},
          featureRows: [],
          roleFeatureRows: [],
        });
        hasResolvedPermissionsRef.current = true;
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [
    user?.id,
    user?.email,
    user?.user_metadata?.name,
    profile?.name,
    profile?.role,
    clubSlugFromPath,
    resumeTick,
    reloadToken,
    clubContextTick,
  ]);

  const value = useMemo(() => {
    const hasRole = (roleName) => normalizeRole(state.role, ROLES.GUEST) === normalizeRole(roleName, ROLES.GUEST);
    const hasAtLeastRole = (roleName) =>
      state.isSuperAdmin || isRoleAtLeast(state.role, normalizeRole(roleName, ROLES.GUEST));

    const hasFeature = (featureKey) => {
      if (!isFeatureKey(featureKey)) return false;
      return Boolean(state.features?.[featureKey]);
    };

    const hasFeatureForRole = (featureKey, roleName = state.role) => {
      if (!isFeatureKey(featureKey)) return false;
      if (state.isSuperAdmin) return true;
      if (!hasFeature(featureKey)) return false;

      const normalizedRole = normalizeRole(roleName, ROLES.GUEST);
      if (normalizedRole === ROLES.INACTIVE) return false;

      const overrideValue = state.roleFeatures?.[normalizedRole]?.[featureKey];
      const enabledByRoleOverride = typeof overrideValue === 'boolean' ? overrideValue : true;
      if (!enabledByRoleOverride) return false;

      const requiredMinRole = FEATURE_MIN_ROLE[featureKey];
      if (requiredMinRole && !isRoleAtLeast(normalizedRole, requiredMinRole)) return false;

      return true;
    };

    const canAccess = (key) => {
      if (!key) return false;
      if (isFeatureKey(key)) return hasFeatureForRole(key);
      return false;
    };

    return {
      ...state,
      hasRole,
      hasAtLeastRole,
      hasFeature,
      hasFeatureForRole,
      canAccess,
      refreshPermissions,
    };
  }, [state, refreshPermissions]);

  return <PermissionContext.Provider value={value}>{children}</PermissionContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePermissionContext() {
  const context = useContext(PermissionContext);
  if (!context) {
    throw new Error('usePermissionContext muss innerhalb des PermissionProvider verwendet werden.');
  }
  return context;
}

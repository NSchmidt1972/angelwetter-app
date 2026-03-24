import { FEATURES, FEATURE_KEYS, createInitialFeatureMap } from '@/permissions/features';
import { ROLES } from '@/permissions/roles';

export const ROLE_COLUMNS = Object.freeze([
  ROLES.GUEST,
  ROLES.MEMBER,
  ROLES.TESTER,
  ROLES.BOARD,
  ROLES.ADMIN,
]);

export const ROLE_OPTIONS = Object.freeze([
  ROLES.MEMBER,
  ROLES.TESTER,
  ROLES.BOARD,
  ROLES.ADMIN,
  ROLES.GUEST,
]);

export const FEATURE_LABELS = Object.freeze({
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

export function buildFeatureState(rows) {
  const base = createInitialFeatureMap();
  (rows || []).forEach((row) => {
    const key = String(row?.feature_key || '').trim().toLowerCase();
    if (!FEATURE_KEYS.includes(key)) return;
    base[key] = Boolean(row?.enabled);
  });
  return base;
}

export function buildRoleFeatureState(rows, roleColumns = ROLE_COLUMNS) {
  return (rows || []).reduce((acc, row) => {
    const role = String(row?.role || '').trim().toLowerCase();
    const featureKey = String(row?.feature_key || '').trim().toLowerCase();
    if (!roleColumns.includes(role) || !FEATURE_KEYS.includes(featureKey)) return acc;
    if (!acc[role]) acc[role] = {};
    acc[role][featureKey] = Boolean(row?.enabled);
    return acc;
  }, {});
}

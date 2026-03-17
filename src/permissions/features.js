import { ROLES } from './roles';

export const FEATURES = Object.freeze({
  FORECAST: 'forecast',
  MAP: 'map',
  PUSH: 'push',
  LEADERBOARD: 'leaderboard',
  ANALYSIS: 'analysis',
  ADMIN_TOOLS: 'admin_tools',
  CATCH_LOGGING: 'catch_logging',
  WEATHER: 'weather',
});

export const FEATURE_KEYS = Object.freeze(Object.values(FEATURES));

export const FEATURE_DEFAULTS = Object.freeze({
  [FEATURES.FORECAST]: false,
  [FEATURES.MAP]: false,
  [FEATURES.PUSH]: false,
  [FEATURES.LEADERBOARD]: false,
  [FEATURES.ANALYSIS]: false,
  [FEATURES.ADMIN_TOOLS]: false,
  [FEATURES.CATCH_LOGGING]: false,
  [FEATURES.WEATHER]: false,
});

export const FEATURE_MIN_ROLE = Object.freeze({
  [FEATURES.ADMIN_TOOLS]: ROLES.BOARD,
});

export function isFeatureKey(value) {
  return FEATURE_KEYS.includes(value);
}

export function createInitialFeatureMap() {
  return { ...FEATURE_DEFAULTS };
}

export function createLegacyFeatureMap() {
  return FEATURE_KEYS.reduce((acc, key) => {
    acc[key] = true;
    return acc;
  }, {});
}

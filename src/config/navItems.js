import { FEATURES } from '../permissions/features';
import { ROLES } from '../permissions/roles';

export const baseNav = [
  { label: 'Wetter', path: '/dashboard', featureKey: FEATURES.WEATHER },
  { label: '+   🐠', path: '/new-catch', featureKey: FEATURES.CATCH_LOGGING },
  { label: 'Fangliste', path: '/catches', featureKey: FEATURES.CATCH_LOGGING },
  { label: 'Rangliste', path: '/leaderboard', featureKey: FEATURES.LEADERBOARD },
  { label: 'Regeln', path: '/regeln' },
  {
    label: 'Statistik',
    children: [
      { label: 'Analyse', path: '/analysis', featureKey: FEATURES.ANALYSIS },
      { label: 'Top 10', path: '/top-fishes', featureKey: FEATURES.ANALYSIS },
      { label: 'Fun-Facts', path: '/fun', featureKey: FEATURES.ANALYSIS },
      { label: 'Prognose', path: '/forecast', featureKey: FEATURES.FORECAST },
      { label: 'Kalender', path: '/calendar', featureKey: FEATURES.CATCH_LOGGING },
      { label: 'Karte', path: '/map', featureKey: FEATURES.MAP },
    ],
  },
];

function isItemVisible(item, hasFeatureForRole) {
  if (!item?.featureKey) return true;
  if (typeof hasFeatureForRole !== 'function') return true;
  return hasFeatureForRole(item.featureKey);
}

export function navItemsFor({ hasFeatureForRole, hasAtLeastRole } = {}) {
  const visibleBase = baseNav
    .map((item) => {
      if (Array.isArray(item.children)) {
        const children = item.children.filter((child) => isItemVisible(child, hasFeatureForRole));
        if (children.length === 0) return null;
        return { ...item, children };
      }
      return isItemVisible(item, hasFeatureForRole) ? item : null;
    })
    .filter(Boolean);

  const items = [...visibleBase];
  const canManageClub =
    (typeof hasFeatureForRole !== 'function' || hasFeatureForRole(FEATURES.ADMIN_TOOLS)) &&
    (typeof hasAtLeastRole !== 'function' || hasAtLeastRole(ROLES.BOARD));

  if (canManageClub) {
    items.splice(2, 0, { label: '+   🦞', path: '/crayfish', featureKey: FEATURES.CATCH_LOGGING });
  }

  items.push({ label: 'Downloads', path: '/downloads' });

  if (canManageClub) {
    items.push({ label: '👥 Vorstand', path: '/vorstand', featureKey: FEATURES.ADMIN_TOOLS });
  }

  return items;
}

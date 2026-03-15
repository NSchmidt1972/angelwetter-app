export const ROLES = Object.freeze({
  GUEST: 'gast',
  MEMBER: 'mitglied',
  TESTER: 'tester',
  BOARD: 'vorstand',
  ADMIN: 'admin',
  INACTIVE: 'inactive',
});

export const ROLE_HIERARCHY = Object.freeze([
  ROLES.GUEST,
  ROLES.MEMBER,
  ROLES.TESTER,
  ROLES.BOARD,
  ROLES.ADMIN,
]);

const ROLE_LEVEL_MAP = Object.freeze({
  [ROLES.GUEST]: 10,
  [ROLES.MEMBER]: 20,
  [ROLES.TESTER]: 30,
  [ROLES.BOARD]: 40,
  [ROLES.ADMIN]: 50,
  [ROLES.INACTIVE]: 0,
});

export function normalizeRole(value, fallback = ROLES.GUEST) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return fallback;
  if (normalized === 'inaktiv') return ROLES.INACTIVE;
  if (Object.prototype.hasOwnProperty.call(ROLE_LEVEL_MAP, normalized)) {
    return normalized;
  }
  return fallback;
}

export function getRoleLevel(value) {
  const normalized = normalizeRole(value, ROLES.INACTIVE);
  return ROLE_LEVEL_MAP[normalized] ?? 0;
}

export function isRoleAtLeast(currentRole, requiredRole) {
  return getRoleLevel(currentRole) >= getRoleLevel(requiredRole);
}


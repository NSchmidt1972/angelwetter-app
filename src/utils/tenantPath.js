const CLUB_SLUG_RE = /^[a-z0-9-]+$/i;

export const STATIC_NON_TENANT_SEGMENTS = new Set([
  'auth',
  'update-password',
  'reset-done',
  'auth-verified',
  'forgot-password',
  'push',
  'superadmin',
  '__ux',
]);

export function normalizeTenantSlug(value) {
  if (!value || typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (!CLUB_SLUG_RE.test(normalized)) return null;
  if (STATIC_NON_TENANT_SEGMENTS.has(normalized)) return null;
  return normalized;
}

export function getTenantFromPathname(pathname) {
  if (typeof pathname !== 'string') return null;
  const firstSegment = pathname.split('/').filter(Boolean)[0] || null;
  return normalizeTenantSlug(firstSegment);
}

export function toTenantBasePath(slug, { trailingSlash = true } = {}) {
  const normalized = normalizeTenantSlug(slug);
  if (!normalized) return '/';
  return trailingSlash ? `/${normalized}/` : `/${normalized}`;
}

export function getTenantBasePath(pathname, { trailingSlash = true, fallbackSlug = null } = {}) {
  const fromPath = getTenantFromPathname(pathname);
  if (fromPath) return toTenantBasePath(fromPath, { trailingSlash });

  const fallback = normalizeTenantSlug(fallbackSlug);
  if (!fallback) return '/';
  return toTenantBasePath(fallback, { trailingSlash });
}

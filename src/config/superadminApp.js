const DEFAULT_SUPERADMIN_APP_URL = '/superadmin.html';

function normalizePath(path) {
  const value = String(path || '').trim();
  if (!value) return '/superadmin';
  return value.startsWith('/') ? value : `/${value}`;
}

export function getSuperadminAppBaseUrl() {
  const configured = String(import.meta.env.VITE_SUPERADMIN_URL || '').trim();
  return configured || DEFAULT_SUPERADMIN_APP_URL;
}

export function getSuperadminAppUrl(path = '/superadmin') {
  const base = getSuperadminAppBaseUrl().replace(/#.*$/, '');
  const targetPath = normalizePath(path);
  return `${base}#${targetPath}`;
}

export default getSuperadminAppUrl;

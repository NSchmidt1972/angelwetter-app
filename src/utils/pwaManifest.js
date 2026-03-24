import { getPreferredClubSlug } from '@/utils/clubId';
import {
  getTenantBasePath,
  getTenantFromPathname,
  normalizeTenantSlug,
} from '@/utils/tenantPath';

const MANIFEST_BOOTSTRAP_KEY = '__AW_MANIFEST_URL__';
let currentManifestObjectUrl =
  typeof window !== 'undefined' && window?.[MANIFEST_BOOTSTRAP_KEY]
    ? String(window[MANIFEST_BOOTSTRAP_KEY])
    : null;
let currentManifestStartPath = null;

function slugToDisplayName(slug) {
  if (!slug) return 'Angelwetter';
  const cleaned = String(slug)
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
  if (!cleaned) return 'Angelwetter';
  return cleaned;
}

function resolveTenantSlug(pathname) {
  const fromPath = getTenantFromPathname(pathname);
  if (fromPath) return fromPath;
  return normalizeTenantSlug(getPreferredClubSlug());
}

function resolveManifestStartPath(pathname) {
  return getTenantBasePath(pathname, {
    trailingSlash: true,
    fallbackSlug: resolveTenantSlug(pathname),
  });
}

function buildManifest(startPath) {
  const tenantSlug = getTenantFromPathname(startPath);
  const tenantLabel = slugToDisplayName(tenantSlug);
  const manifestName = tenantSlug ? `Angelwetter ${tenantLabel}` : 'Angelwetter';
  const shortName = tenantSlug ? tenantLabel : 'Angelwetter';
  const origin = window.location.origin;
  const absoluteStartUrl = new URL(startPath, origin).href;

  return {
    id: startPath,
    name: manifestName,
    short_name: shortName,
    start_url: absoluteStartUrl,
    scope: absoluteStartUrl,
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#007BFF',
    icons: [
      { src: `${origin}/icon-192.png`, sizes: '192x192', type: 'image/png' },
      { src: `${origin}/icon-512.png`, sizes: '512x512', type: 'image/png' },
    ],
  };
}

export function applyDynamicManifestForPath(pathname) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const resolvedPathname = pathname ?? window.location.pathname;
  const startPath = resolveManifestStartPath(resolvedPathname);
  if (currentManifestStartPath === startPath) return;

  const manifest = buildManifest(startPath);
  const manifestBlob = new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' });
  const manifestObjectUrl = URL.createObjectURL(manifestBlob);

  const manifestLinks = Array.from(document.querySelectorAll('link[rel="manifest"]'));
  let manifestLink = manifestLinks[0] || null;
  if (!manifestLink) {
    manifestLink = document.createElement('link');
    manifestLink.setAttribute('rel', 'manifest');
    document.head.appendChild(manifestLink);
  }
  manifestLink.setAttribute('href', manifestObjectUrl);
  for (let i = 1; i < manifestLinks.length; i += 1) {
    manifestLinks[i].remove();
  }

  const tenantSlug = resolveTenantSlug(resolvedPathname);
  const tenantLabel = slugToDisplayName(tenantSlug);
  const appTitle = tenantSlug ? `Angelwetter ${tenantLabel}` : 'Angelwetter';
  const shortTitle = tenantSlug ? tenantLabel : 'Angelwetter';
  const applicationNameMeta = document.querySelector('meta[name="application-name"]');
  if (applicationNameMeta) {
    applicationNameMeta.setAttribute('content', appTitle);
  }
  const appleTitleMeta = document.querySelector('meta[name="apple-mobile-web-app-title"]');
  if (appleTitleMeta) {
    appleTitleMeta.setAttribute('content', shortTitle);
  }

  if (currentManifestObjectUrl) {
    URL.revokeObjectURL(currentManifestObjectUrl);
  }
  currentManifestObjectUrl = manifestObjectUrl;
  if (typeof window !== 'undefined') {
    window[MANIFEST_BOOTSTRAP_KEY] = manifestObjectUrl;
  }
  currentManifestStartPath = startPath;
}

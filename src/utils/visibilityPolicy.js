import { parseTimestamp } from '@/utils/dateUtils';
import { MARILOU_ALIASES, PUBLIC_FROM, TRUSTED_ANGLERS } from '@/constants/visibility';

function normalizeAnglerName(value) {
  if (typeof value === 'string') return value.trim().toLowerCase();
  if (value == null) return '';
  return String(value).trim().toLowerCase();
}

const TRUSTED_ANGLERS_SET = new Set(TRUSTED_ANGLERS.map(normalizeAnglerName));
const MARILOU_ALIASES_SET = new Set(MARILOU_ALIASES.map(normalizeAnglerName));

export function isTrustedAngler(name) {
  return TRUSTED_ANGLERS_SET.has(normalizeAnglerName(name));
}

export function isMarilouAngler(name) {
  return MARILOU_ALIASES_SET.has(normalizeAnglerName(name));
}

export function isVisibleByDate(timestamp, { isTrusted = false, filterSetting = 'recent', publicFrom = PUBLIC_FROM } = {}) {
  const caughtAt = parseTimestamp(timestamp);
  if (!caughtAt) return false;

  const cutoff = publicFrom instanceof Date ? publicFrom : parseTimestamp(publicFrom);
  if (!cutoff) return true;

  if (isTrusted && filterSetting === 'all') return true;
  return caughtAt >= cutoff;
}

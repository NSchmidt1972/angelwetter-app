export function parseFishSize(value) {
  const size = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(size) ? size : null;
}

export function normalizeFishName(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

export function hasKnownFishName(value) {
  const fishName = normalizeFishName(value);
  return fishName !== '' && fishName.toLowerCase() !== 'unbekannt';
}

export function isValuableFishEntry(entry, { requireNotBlank = true } = {}) {
  if (!hasKnownFishName(entry?.fish)) return false;
  const size = parseFishSize(entry?.size);
  if (size == null || size <= 0) return false;
  if (requireNotBlank && entry?.blank === true) return false;
  return true;
}

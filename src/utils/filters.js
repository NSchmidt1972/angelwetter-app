// src/utils/filters.js
import { isVisibleByDate } from '@/utils/visibilityPolicy';
import { isHomeWaterEntry } from '@/utils/location';

export function isVisibleToUser(entry, { isTrusted, onlyMine, anglerName, filterSetting, clubCoords = null }) {
  const istEigenerFang = entry.angler === anglerName;
  if (!isVisibleByDate(entry?.timestamp, { isTrusted, filterSetting })) return false;

  const istHeimgewaesser = isHomeWaterEntry(entry, { clubCoords });
  const externFreigegeben = !istHeimgewaesser && entry.share_public_non_home === true;

  return onlyMine ? istEigenerFang : istHeimgewaesser || externFreigegeben;
}

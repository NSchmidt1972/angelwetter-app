// src/utils/filters.js
import { isVisibleByDate } from '@/utils/visibilityPolicy';
import { isFerkensbruchLocation } from '@/utils/location';

export function isVisibleToUser(entry, { isTrusted, onlyMine, anglerName, filterSetting }) {
  const istEigenerFang = entry.angler === anglerName;
  if (!isVisibleByDate(entry?.timestamp, { isTrusted, filterSetting })) return false;

  const ortIstLobberich = isFerkensbruchLocation(entry.location_name);
  const externFreigegeben = !ortIstLobberich && entry.share_public_non_home === true;

  return onlyMine ? istEigenerFang : ortIstLobberich || externFreigegeben;
}

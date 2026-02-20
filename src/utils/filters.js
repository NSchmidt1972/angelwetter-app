// src/utils/filters.js
import { PUBLIC_FROM } from '../constants';
import { isFerkensbruchLocation } from '@/utils/location';

export function isVisibleToUser(entry, { isTrusted, onlyMine, anglerName, filterSetting }) {
  const fangDatum = new Date(entry.timestamp);
  const istEigenerFang = entry.angler === anglerName;

  if (!isTrusted) {
    if (fangDatum < PUBLIC_FROM) return false;
  } else {
    if (filterSetting !== 'all' && fangDatum < PUBLIC_FROM) return false;
  }

  const ortIstLobberich = isFerkensbruchLocation(entry.location_name);
  const externFreigegeben = !ortIstLobberich && entry.share_public_non_home === true;

  return onlyMine ? istEigenerFang : ortIstLobberich || externFreigegeben;
}

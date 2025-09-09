// src/utils/filters.js
import { PUBLIC_FROM } from '../constants';

export function isVisibleToUser(entry, { isTrusted, onlyMine, anglerName, filterSetting }) {
  const fangDatum = new Date(entry.timestamp);
  const istEigenerFang = entry.angler === anglerName;

  if (!isTrusted) {
    if (fangDatum < PUBLIC_FROM) return false;
  } else {
    if (filterSetting !== 'all' && fangDatum < PUBLIC_FROM) return false;
  }

  const ort = entry.location_name?.toLowerCase().trim() ?? '';
  const ortIstLobberich = entry.location_name == null || ort.includes('lobberich');

  return onlyMine ? istEigenerFang : ortIstLobberich;
}

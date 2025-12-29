// src/services/catchService.js
import { supabase } from '../supabaseClient';
import { getDistanceKm } from '../utils/geo';
import { getActiveClubId } from '@/utils/clubId';

const FERKENSBRUCH_LAT = 51.3135;
const FERKENSBRUCH_LON = 6.256;
const LOBBERICH_RADIUS_KM = 3.5;

function normalizeLobberichLocation(rawLocation, lat, lon, { forceLobberich = false } = {}) {
  const trimmed = typeof rawLocation === 'string' ? rawLocation.trim() : '';
  const nearFerkensbruch =
    lat != null &&
    lon != null &&
    getDistanceKm(lat, lon, FERKENSBRUCH_LAT, FERKENSBRUCH_LON) <= LOBBERICH_RADIUS_KM;

  if (!trimmed) {
    if (forceLobberich) return 'Lobberich';
    return nearFerkensbruch ? 'Lobberich' : null;
  }

  const lower = trimmed.toLowerCase();
  if (lower.includes('lobberich') || lower.includes('ferkensbruch')) {
    return 'Lobberich';
  }

  if (nearFerkensbruch && (lower.startsWith('kreis ') || lower.startsWith('landkreis ') || lower.includes('kreis viersen'))) {
    return 'Lobberich';
  }

  if (forceLobberich && nearFerkensbruch) {
    return 'Lobberich';
  }

  return trimmed;
}

const IS_DEV_BUILD = (() => {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      if (import.meta.env.DEV) return true;
      if (import.meta.env.MODE && import.meta.env.MODE !== 'production') return true;
    }
  } catch (error) {
    console.warn('[catchService] env check failed:', error);
  }
  return false;
})();

/**
 * Speichert den Fang und triggert (optional) einen OneSignal-Push via Edge-Function 'sendCatchPush'.
 * - Geofence kann via localStorage.pushGeofence = 'on'|'off' gesteuert werden (default: 'off').
 */
export async function saveCatchEntry(entry, taken, position, anglerName, options = {}) {
  // 1) Insert
  const payload = { ...entry, taken: !!taken };
  payload.club_id = getActiveClubId();
  const locationLat = payload.lat ?? position?.lat ?? null;
  const locationLon = payload.lon ?? position?.lon ?? null;
  const isFerkensbruchRegion = typeof options.region === 'string'
    ? options.region.toLowerCase() === 'ferkensbruch'
    : false;
  const normalizedLocation = normalizeLobberichLocation(
    payload.location_name,
    locationLat,
    locationLon,
    { forceLobberich: isFerkensbruchRegion },
  );
  payload.location_name = normalizedLocation;
  const { data, error: insertErr } = await supabase
    .from('fishes')
    .insert([payload])
    .select()
    .single();
  if (insertErr) throw new Error('Fehler beim Speichern des Fangs.');

  const shouldSkipPush = (() => {
    if (IS_DEV_BUILD) return true;

    if (typeof window !== 'undefined') {
      const host = window.location?.hostname || '';
      if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0') return true;
      if (host.endsWith('.local')) return true;
      try {
        if (window.localStorage.getItem('pushDisableDev') === 'on') return true;
      } catch (error) {
        console.warn('[catchService] Zugriff auf localStorage fehlgeschlagen:', error);
      }
    }

    return false;
  })();

  if (shouldSkipPush) {
    return data;
  }

  // 2) Push (best effort)
  try {
    /*const { data: { session } } = await supabase.auth.getSession();
    const sender_user_id = session?.user?.id;
    if (!sender_user_id) {
      console.info('Push übersprungen: keine sender_user_id (nicht eingeloggt?).');
      return true;
    }*/

    // Optionaler Geofence
   /* const geofenceEnabled = (localStorage.getItem('pushGeofence') || 'off');
    if (geofenceEnabled) {
      const hasPos = position?.lat != null && position?.lon != null;
      const distKm = hasPos
        ? getDistanceKm(position.lat, position.lon, FERKENSBRUCH_LAT, FERKENSBRUCH_LON)
        : Infinity;
      if (!hasPos || distKm > 1.0) {
        console.info('Push durch Geofence unterdrückt (Distanz > 1 km).');
        return true;
      }
    }*/

    // Minimaldaten prüfen
    if (!payload?.fish || !payload?.size) {
      console.info('Push übersprungen: unvollständige Daten (fish/size).');
      return true;
    }

    // Edge-Function modern aufrufen (keine feste URL nötig)
    const { error: fnErr } = await supabase.functions.invoke('sendCatchPush', {
      body: {
        angler: anglerName,
        fish: payload.fish,
        size: payload.size,
        club_id: payload.club_id,
       // sender_user_id,
      },
    });

    if (fnErr) console.warn('Push fehlgeschlagen (ignoriert):', fnErr.message || fnErr);
  } catch (error) {
    console.warn('Push-Aufruf übersprungen (Invoke-Fehler):', error?.message || error);
  }

  return data;
}

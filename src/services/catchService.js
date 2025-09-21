// src/services/catchService.js
import { supabase } from '../supabaseClient';
//import { getDistanceKm } from '../utils/geo';

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
export async function saveCatchEntry(entry, taken, position, anglerName, /*FERKENSBRUCH_LAT, FERKENSBRUCH_LON*/) {
  // 1) Insert
  const payload = { ...entry, taken: !!taken };
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
       // sender_user_id,
      },
    });

    if (fnErr) console.warn('Push fehlgeschlagen (ignoriert):', fnErr.message || fnErr);
  } catch (error) {
    console.warn('Push-Aufruf übersprungen (Invoke-Fehler):', error?.message || error);
  }

  return data;
}

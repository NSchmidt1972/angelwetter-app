// src/services/catchService.js
import { supabase } from '../supabaseClient';
//import { getDistanceKm } from '../utils/geo';

/**
 * Speichert den Fang und triggert (optional) einen OneSignal-Push via Edge-Function 'sendCatchPush'.
 * - Geofence kann via localStorage.pushGeofence = 'on'|'off' gesteuert werden (default: 'off').
 */
export async function saveCatchEntry(entry, taken, position, anglerName, /*FERKENSBRUCH_LAT, FERKENSBRUCH_LON*/) {
  // 1) Insert
  const payload = { ...entry, taken: !!taken };
  const { error: insertErr } = await supabase.from('fishes').insert([payload]);
  if (insertErr) throw new Error('Fehler beim Speichern des Fangs.');

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
  } catch (e) {
    console.warn('Push-Aufruf übersprungen (Invoke-Fehler):', e?.message || e);
  }

  return true;
}

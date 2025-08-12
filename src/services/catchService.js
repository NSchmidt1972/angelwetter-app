// services/catchService.js
import { supabase } from '../supabaseClient';
import { getDistanceKm } from '../utils/geo';

export async function saveCatchEntry(entry, taken, position, anglerName, FERKENSBRUCH_LAT, FERKENSBRUCH_LON) {
  const entryToSave = { ...entry, taken };

  const { error } = await supabase.from('fishes').insert([entryToSave]);

  if (error) {
    throw new Error('Fehler beim Speichern des Fangs.');
  }

  const isAtFerkensbruch =
    position?.lat != null &&
    position?.lon != null &&
    getDistanceKm(position.lat, position.lon, FERKENSBRUCH_LAT, FERKENSBRUCH_LON) < 1.0;

  if (isAtFerkensbruch) {
    try {
      await fetch(
        'https://kirevrwmmthqgceprbhl.supabase.co/functions/v1/send-push-notification',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            angler: anglerName,
            fish: entry.fish,
            size: entry.size
          })
        }
      );
    } catch (pushError) {
      console.error('Fehler bei der Push-Benachrichtigung:', pushError);
    }
  }

  return true;
}

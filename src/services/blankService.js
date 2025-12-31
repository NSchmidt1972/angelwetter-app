import { SUPABASE_URL, supabase } from '../supabaseClient';
import { getActiveClubId } from '@/utils/clubId';

const FUNCTIONS_BASE = `${SUPABASE_URL}/functions/v1`;

/**
 * Fügt eine Schneidersession hinzu.
 */
async function insertBlankSession(anglerName, hours, fishingType, position) {
  const clubId = getActiveClubId();
  const insertObj = {
    angler: anglerName ?? null,
    note: 'Schneidersession',
    blank: true,
    hours: hours ?? null,
    fishing_type: fishingType ?? null,
    timestamp: new Date().toISOString(),
    lat: position?.lat ?? null,
    lon: position?.lon ?? null,
    club_id: clubId,
  };

  console.log("📤 Insert in fishes:", insertObj);

  const { error } = await supabase.from('fishes').insert([insertObj]);

  if (error) {
    console.error("❌ Supabase Insert Error:", error);
    throw new Error('Fehler beim Speichern in fishes');
  }
}

/**
 * Ruft die Wetter-Summary-Funktion auf (für Schneidersessions).
 */
async function sendBlankWeatherSummary(anglerName, hours, accessToken) {
  const response = await fetch(
    `${FUNCTIONS_BASE}/blank_weather_summary`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({ angler: anglerName, hours })
    }
  );

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || 'Unbekannter Fehler');
  }
}

/**
 * Hauptfunktion zum Speichern einer Schneidersession.
 * Mehrere Sessions pro Tag sind erlaubt.
 */
export async function saveBlankDay(anglerName, hours, fishingType, position) {
  // Session prüfen
  const sessionResult = await supabase.auth.getSession();
  const accessToken = sessionResult.data?.session?.access_token;
  if (!accessToken) throw new Error("Nicht eingeloggt – bitte zuerst anmelden.");

  // Wetter speichern
  await sendBlankWeatherSummary(anglerName, hours, accessToken);

  // Eintrag in fishes speichern
  await insertBlankSession(anglerName, hours, fishingType, position);

  // Optional: Push-Benachrichtigung (nur falls OneSignal im Browser verfügbar)
  if (window.OneSignal) {
    window.OneSignal.push(() => {
      window.OneSignal.sendSelfNotification(
        "❌ Schneidersession eingetragen",
        `${anglerName} hat in dieser Session leider nichts gefangen.`,
        null,
        { data: { blank: true } }
      );
    });
  }

  return true;
}

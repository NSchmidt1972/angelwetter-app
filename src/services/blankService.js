import { supabase } from '../supabaseClient';

/**
 * Prüft, ob heute bereits ein Schneidertag für den Angler existiert.
 */
async function checkExistingBlankDay(anglerName, isoStart, isoEnd) {
  const { data: existing, error } = await supabase
    .from('fishes')
    .select('id')
    .eq('angler', anglerName)
    .eq('blank', true)
    .gte('timestamp', isoStart)
    .lt('timestamp', isoEnd);

  if (error) throw new Error("Fehler bei der Tagesprüfung");
  return existing.length > 0;
}

/**
 * Fügt einen Schneidertag-Eintrag hinzu.
 */
async function insertBlankDay(anglerName, hours, fishingType, position) {
  const insertObj = {
    angler: anglerName ?? null,
    note: 'Schneidertag',
    blank: true,
    hours: hours ?? null,
    fishing_type: fishingType ?? null,
    timestamp: new Date().toISOString(),
    lat: position?.lat ?? null,
    lon: position?.lon ?? null
  };

  console.log("📤 Insert in fishes:", insertObj);

  const { error } = await supabase.from('fishes').insert([insertObj]);

  if (error) {
    console.error("❌ Supabase Insert Error:", error);
    throw new Error('Fehler beim Speichern in fishes');
  }
}

/**
 * Ruft die Wetter-Summary-Funktion auf (für Schneidertage).
 */
async function sendBlankWeatherSummary(anglerName, hours, accessToken) {
  const response = await fetch(
    'https://kirevrwmmthqgceprbhl.supabase.co/functions/v1/blank_weather_summary',
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
 * Hauptfunktion zum Speichern eines Schneidertags.
 */
export async function saveBlankDay(anglerName, hours, fishingType, position) {
  // Session prüfen
  const sessionResult = await supabase.auth.getSession();
  const accessToken = sessionResult.data?.session?.access_token;
  if (!accessToken) throw new Error("Nicht eingeloggt – bitte zuerst anmelden.");

  // Heute 0 Uhr & morgen 0 Uhr bestimmen
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isoStart = today.toISOString();
  const isoEnd = new Date(today.getTime() + 86400000).toISOString();

  // Prüfen, ob schon ein Schneidertag eingetragen wurde
  const exists = await checkExistingBlankDay(anglerName, isoStart, isoEnd);
  if (exists) throw new Error("Du hast heute bereits einen Schneidertag eingetragen.");

  // Wetter speichern
  await sendBlankWeatherSummary(anglerName, hours, accessToken);

  // Eintrag in fishes speichern
  await insertBlankDay(anglerName, hours, fishingType, position);

  // Optional: Push-Benachrichtigung (nur falls OneSignal im Browser verfügbar)
  if (window.OneSignal) {
    window.OneSignal.push(() => {
      window.OneSignal.sendSelfNotification(
        "❌ Schneidertag eingetragen",
        `${anglerName} hat heute leider nichts gefangen.`,
        null,
        { data: { blank: true } }
      );
    });
  }

  return true;
}

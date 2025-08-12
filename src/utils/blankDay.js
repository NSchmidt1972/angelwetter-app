import { supabase } from '../supabaseClient';

/**
 * Prüft, ob der Angler heute bereits einen Schneidertag eingetragen hat.
 */
async function checkExistingBlankDay(anglerName, isoStart, isoEnd) {
  const { data: existing, error } = await supabase
    .from('fishes')
    .select('id')
    .eq('angler', anglerName)
    .eq('blank', true)
    .gte('timestamp', isoStart)
    .lt('timestamp', isoEnd);

  if (error) throw new Error("Fehler bei der Tagesprüfung.");
  return existing.length > 0;
}

/**
 * Ruft die Wetterzusammenfassung-Funktion auf.
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
  if (!response.ok) throw new Error(result.error || 'Unbekannter Fehler');
}

/**
 * Speichert den Schneidertag in der DB.
 */
async function insertBlankDay(anglerName, position) {
  const { error } = await supabase.from('fishes').insert([{
    angler: anglerName,
    note: 'Schneidertag',
    blank: true,
    timestamp: new Date().toISOString(),
    lat: position?.lat ?? null,
    lon: position?.lon ?? null
  }]);
  if (error) throw new Error('Fehler beim Speichern in fishes.');
}

/**
 * Führt den gesamten Ablauf für das Speichern eines Schneidertags aus.
 */
export async function handleBlankDay(anglerName, hours, position, navigate) {
  const sessionResult = await supabase.auth.getSession();
  const accessToken = sessionResult.data?.session?.access_token;
  if (!accessToken) throw new Error("Nicht eingeloggt – bitte zuerst anmelden.");

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isoStart = today.toISOString();
  const isoEnd = new Date(today.getTime() + 86400000).toISOString();

  const exists = await checkExistingBlankDay(anglerName, isoStart, isoEnd);
  if (exists) throw new Error("Du hast heute bereits einen Schneidertag eingetragen.");

  await sendBlankWeatherSummary(anglerName, hours, accessToken);
  await insertBlankDay(anglerName, position);

  if (window.location.hostname === 'app.asv-rotauge.de' && window.OneSignal) {
    window.OneSignal.push(() => {
      window.OneSignal.sendSelfNotification(
        "❌ Schneidertag eingetragen",
        `${anglerName} hat heute leider nichts gefangen.`,
        null,
        { data: { blank: true } }
      );
    });
  }

  navigate('/');
}

import { SUPABASE_URL, supabase } from '../supabaseClient';
import { getActiveClubId } from '@/utils/clubId';

const FUNCTIONS_BASE = `${SUPABASE_URL}/functions/v1`;

/**
 * Ruft die Wetterzusammenfassung-Funktion auf.
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
  if (!response.ok) throw new Error(result.error || 'Unbekannter Fehler');
}

/**
 * Speichert die Schneidersession in der DB.
 */
async function insertBlankSession(anglerName, position) {
  const clubId = getActiveClubId();
  const { error } = await supabase.from('fishes').insert([{
    angler: anglerName,
    note: 'Schneidersession',
    blank: true,
    timestamp: new Date().toISOString(),
    lat: position?.lat ?? null,
    lon: position?.lon ?? null,
    club_id: clubId,
  }]);
  if (error) throw new Error('Fehler beim Speichern in fishes.');
}

/**
 * Führt den gesamten Ablauf für das Speichern einer Schneidersession aus.
 */
export async function handleBlankDay(anglerName, hours, position, navigate) {
  const sessionResult = await supabase.auth.getSession();
  const accessToken = sessionResult.data?.session?.access_token;
  if (!accessToken) throw new Error("Nicht eingeloggt – bitte zuerst anmelden.");

  await sendBlankWeatherSummary(anglerName, hours, accessToken);
  await insertBlankSession(anglerName, position);

  if (window.location.hostname === 'app.asv-rotauge.de' && window.OneSignal) {
    window.OneSignal.push(() => {
      window.OneSignal.sendSelfNotification(
        "❌ Schneidersession eingetragen",
        `${anglerName} hat in dieser Session leider nichts gefangen.`,
        null,
        { data: { blank: true } }
      );
    });
  }

  navigate('/');
}

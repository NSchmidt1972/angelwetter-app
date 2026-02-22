import { SUPABASE_URL, supabase } from '../supabaseClient';
import { getActiveClubId } from '@/utils/clubId';

const FUNCTIONS_BASE = `${SUPABASE_URL}/functions/v1`;

/**
 * Fügt eine Schneidersession hinzu.
 */
async function insertBlankSession(anglerName, hours, fishingType, position) {
  const clubId = getActiveClubId();
  const isPlaceholderClubId = clubId === '00000000-0000-0000-0000-000000000000';

  if (!clubId || isPlaceholderClubId) {
    throw new Error(
      'Kein aktiver Verein gesetzt. Bitte Verein auswählen/anmelden oder VITE_DEFAULT_CLUB_ID korrekt setzen.'
    );
  }

  const insertObj = {
    angler: anglerName ?? null,
    // Remote DB-Trigger berechnet Regel-Flags auf `fishes` und kann bei `fish = null`
    // `out_of_season`/`under_min_size` auf NULL setzen. Für Schneidertage daher:
    // leerer Fischname (zählt nicht als Fang) + Größe 0.
    fish: '',
    size: 0,
    note: 'Schneidersession',
    blank: true,
    taken: false,
    count_in_stats: false,
    under_min_size: false,
    out_of_season: false,
    weather: {},
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
    const extra = [error.code, error.message, error.details, error.hint]
      .filter(Boolean)
      .join(' | ');
    throw new Error(extra ? `Fehler beim Speichern in fishes: ${extra}` : 'Fehler beim Speichern in fishes');
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

  const raw = await response.text();
  let result = null;
  if (raw) {
    try {
      result = JSON.parse(raw);
    } catch {
      result = { error: raw };
    }
  }

  if (!response.ok) {
    throw new Error(result?.error || `Wetter-Summary fehlgeschlagen (${response.status})`);
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

  // Eintrag in fishes speichern
  await insertBlankSession(anglerName, hours, fishingType, position);

  // Wetter-Summary ist best-effort und darf das Speichern nicht blockieren
  try {
    await sendBlankWeatherSummary(anglerName, hours, accessToken);
  } catch (error) {
    console.warn('⚠️ blank_weather_summary fehlgeschlagen (Eintrag wurde trotzdem gespeichert):', error);
  }

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

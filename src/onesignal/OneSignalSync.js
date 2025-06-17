import { supabase } from '../supabaseClient';

export async function runOneSignalHealthCheck() {
  const anglerName = localStorage.getItem('anglerName') || 'Unbekannt';

  try {
    const isEnabled = await window.OneSignal.isPushNotificationsEnabled();
    const userId = await window.OneSignal.getUserId();

    if (!isEnabled || !userId) {
      console.warn("Push nicht aktiviert oder keine UserID vorhanden.");
      return;
    }

    await supabase.rpc('sync_player', {
      p_angler_name: anglerName,
      p_player_id: userId
    });

    console.log("✅ PlayerID erfolgreich in Supabase synchronisiert:", userId);
  } catch (err) {
    console.error("❌ Fehler beim HealthCheck:", err);
  }
}

// src/services/boardService.js
import { supabase } from '@/supabaseClient';

export async function fetchWhitelist() {
  const { data, error } = await supabase
    .from('whitelist_emails')
    .select('email, created_at')
    .order('email', { ascending: true });

  if (error) throw new Error(error.message || 'Whitelist konnte nicht geladen werden.');
  return data || [];
}

export async function addWhitelistEmail(email) {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) throw new Error('E-Mail-Adresse darf nicht leer sein.');

  const { error } = await supabase
    .from('whitelist_emails')
    .insert({ email: cleanEmail });

  if (error) throw new Error(error.message || 'E-Mail konnte nicht hinzugefügt werden.');
  return true;
}

export async function removeWhitelistEmail(email) {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) throw new Error('Ungültige E-Mail.');

  const { error } = await supabase
    .from('whitelist_emails')
    .delete()
    .eq('email', cleanEmail);

  if (error) throw new Error(error.message || 'E-Mail konnte nicht entfernt werden.');
  return true;
}

export async function fetchProfiles() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, role, created_at')
    .order('name', { ascending: true });

  if (error) throw new Error(error.message || 'Profile konnten nicht geladen werden.');
  return data || [];
}

export async function fetchFishAggregates() {
  const { data, error } = await supabase
    .from('fishes')
    .select(
      'fish, taken, location_name, timestamp, size, angler, blank, weight, is_marilou, count_in_stats, under_min_size, out_of_season'
    )
    .order('timestamp', { ascending: false });

  if (error) throw new Error(error.message || 'Fischübersicht konnte nicht geladen werden.');
  return data || [];
}

export async function updateProfileRole(profileId, role) {
  const normalizedRole = role ? role.trim() : null;
  const { error } = await supabase
    .from('profiles')
    .update({ role: normalizedRole || null })
    .eq('id', profileId);

  if (error) throw new Error(error.message || 'Rolle konnte nicht aktualisiert werden.');
  return true;
}

export async function deleteProfile(profileId) {
  if (!profileId) throw new Error('Ungültige Profil-ID.');

  const { error } = await supabase
    .from('profiles')
    .delete()
    .eq('id', profileId);

  if (error) throw new Error(error.message || 'Mitglied konnte nicht gelöscht werden.');
  return true;
}

export async function fetchCrayfishCatches() {
  const { data, error } = await supabase
    .from('crayfish_catches')
    .select('species, count, catch_timestamp, angler')
    .order('catch_timestamp', { ascending: false });

  if (error) throw new Error(error.message || 'Krebsdaten konnten nicht geladen werden.');
  return data || [];
}

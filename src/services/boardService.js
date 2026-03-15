// src/services/boardService.js
import { supabase } from '@/supabaseClient';
import { getActiveClubId } from '@/utils/clubId';
import { ROLES, normalizeRole } from '@/permissions/roles';

export async function fetchWhitelist() {
  const clubId = getActiveClubId();
  const { data, error } = await supabase
    .from('whitelist_emails')
    .select('email, created_at, club_id')
    .eq('club_id', clubId)
    .order('email', { ascending: true });

  if (error) throw new Error(error.message || 'Whitelist konnte nicht geladen werden.');
  return data || [];
}

export async function addWhitelistEmail(email) {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) throw new Error('E-Mail-Adresse darf nicht leer sein.');
  const clubId = getActiveClubId();

  const { error } = await supabase
    .from('whitelist_emails')
    .insert({ email: cleanEmail, club_id: clubId });

  if (error) throw new Error(error.message || 'E-Mail konnte nicht hinzugefügt werden.');
  return true;
}

export async function removeWhitelistEmail(email) {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) throw new Error('Ungültige E-Mail.');
  const clubId = getActiveClubId();

  const { error } = await supabase
    .from('whitelist_emails')
    .delete()
    .eq('email', cleanEmail)
    .eq('club_id', clubId);

  if (error) throw new Error(error.message || 'E-Mail konnte nicht entfernt werden.');
  return true;
}

export async function fetchProfiles() {
  const clubId = getActiveClubId();
  const [{ data: profiles, error: profilesError }, { data: memberships, error: membershipsError }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, name, role, created_at, club_id')
      .eq('club_id', clubId)
      .order('name', { ascending: true }),
    supabase
      .from('memberships')
      .select('user_id, role, is_active')
      .eq('club_id', clubId),
  ]);

  if (profilesError) throw new Error(profilesError.message || 'Profile konnten nicht geladen werden.');
  if (membershipsError) throw new Error(membershipsError.message || 'Memberships konnten nicht geladen werden.');

  const membershipByUserId = new Map((memberships || []).map((row) => [row.user_id, row]));
  return (profiles || []).map((profile) => {
    const membership = membershipByUserId.get(profile.id) || null;
    const effectiveRole = normalizeRole(
      membership?.role ?? profile?.role ?? ROLES.MEMBER,
      ROLES.MEMBER,
    );
    return {
      ...profile,
      membership_role: membership?.role ?? null,
      membership_active: membership?.is_active ?? null,
      profile_role: profile?.role ?? null,
      role: effectiveRole,
    };
  });
}

export async function fetchFishAggregates() {
  const clubId = getActiveClubId();
  const { data, error } = await supabase
    .from('fishes')
    .select(
      'fish, taken, location_name, lat, lon, timestamp, size, angler, blank, weight, is_marilou, count_in_stats, under_min_size, out_of_season, club_id'
    )
    .eq('club_id', clubId)
    .order('timestamp', { ascending: false });

  if (error) throw new Error(error.message || 'Fischübersicht konnte nicht geladen werden.');
  return data || [];
}

export async function updateProfileRole(profileId, role) {
  if (!profileId) throw new Error('Ungültige Profil-ID.');
  const clubId = getActiveClubId();
  const normalizedRole = normalizeRole(role || ROLES.MEMBER, ROLES.MEMBER);
  const membershipIsActive = normalizedRole !== ROLES.INACTIVE;

  const { data: membershipData, error: membershipUpdateError } = await supabase
    .from('memberships')
    .update({
      role: normalizedRole,
      is_active: membershipIsActive,
    })
    .eq('user_id', profileId)
    .eq('club_id', clubId)
    .select('user_id');

  if (membershipUpdateError) {
    throw new Error(membershipUpdateError.message || 'Membership-Rolle konnte nicht aktualisiert werden.');
  }

  if (!Array.isArray(membershipData) || membershipData.length === 0) {
    const { error: membershipInsertError } = await supabase
      .from('memberships')
      .insert({
        user_id: profileId,
        club_id: clubId,
        role: normalizedRole,
        is_active: membershipIsActive,
      });
    if (membershipInsertError) {
      throw new Error(membershipInsertError.message || 'Membership konnte nicht angelegt werden.');
    }
  }

  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .update({ role: normalizedRole })
    .eq('id', profileId)
    .eq('club_id', clubId)
    .select('id');

  if (profileError) throw new Error(profileError.message || 'Profil-Rolle konnte nicht aktualisiert werden.');
  if (!Array.isArray(profileData) || profileData.length === 0) {
    throw new Error('Rolle konnte nicht gespeichert werden (keine Berechtigung oder Datensatz nicht gefunden).');
  }
  return true;
}

export async function deleteProfile(profileId) {
  if (!profileId) throw new Error('Ungültige Profil-ID.');
  const clubId = getActiveClubId();

  const { error: membershipDeleteError } = await supabase
    .from('memberships')
    .delete()
    .eq('user_id', profileId)
    .eq('club_id', clubId);

  if (membershipDeleteError) {
    throw new Error(membershipDeleteError.message || 'Membership konnte nicht gelöscht werden.');
  }

  const { data, error } = await supabase
    .from('profiles')
    .delete()
    .eq('id', profileId)
    .eq('club_id', clubId)
    .select('id');

  if (error) throw new Error(error.message || 'Mitglied konnte nicht gelöscht werden.');
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('Mitglied konnte nicht gelöscht werden (keine Berechtigung oder Datensatz nicht gefunden).');
  }
  return true;
}

export async function fetchCrayfishCatches() {
  const clubId = getActiveClubId();
  const { data, error } = await supabase
    .from('crayfish_catches')
    .select('species, count, catch_timestamp, angler, note, club_id')
    .eq('club_id', clubId)
    .order('catch_timestamp', { ascending: false });

  if (error) throw new Error(error.message || 'Krebsdaten konnten nicht geladen werden.');
  return data || [];
}

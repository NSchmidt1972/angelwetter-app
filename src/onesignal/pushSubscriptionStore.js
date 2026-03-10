import { supabase } from '@/supabaseClient';
import { getActiveClubId } from '@/utils/clubId';

const NULL_CLUB_ID = '00000000-0000-0000-0000-000000000000';

function normalizeClubId(value) {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === NULL_CLUB_ID) return null;
  return trimmed;
}

async function canUseClubId(userId, clubId) {
  if (!userId || !clubId) return false;

  const { data: membershipRows, error: membershipError } = await supabase
    .from('memberships')
    .select('club_id')
    .eq('user_id', userId)
    .eq('club_id', clubId)
    .eq('is_active', true)
    .limit(1);

  if (!membershipError && Array.isArray(membershipRows) && membershipRows.length > 0) {
    return true;
  }

  const { data: profileRows, error: profileError } = await supabase
    .from('profiles')
    .select('club_id')
    .eq('id', userId)
    .eq('club_id', clubId)
    .limit(1);

  return !profileError && Array.isArray(profileRows) && profileRows.length > 0;
}

async function resolveClubIdForUser(userId, preferredClubId = getActiveClubId()) {
  const preferred = normalizeClubId(preferredClubId);
  if (preferred && (await canUseClubId(userId, preferred))) {
    return preferred;
  }

  const { data: membershipRows, error: membershipError } = await supabase
    .from('memberships')
    .select('club_id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
    .limit(1);

  if (!membershipError && Array.isArray(membershipRows) && membershipRows.length > 0) {
    const membershipClubId = normalizeClubId(membershipRows[0]?.club_id);
    if (membershipClubId) {
      return membershipClubId;
    }
  }

  const { data: profileRows, error: profileError } = await supabase
    .from('profiles')
    .select('club_id')
    .eq('id', userId)
    .order('updated_at', { ascending: false })
    .limit(1);

  if (!profileError && Array.isArray(profileRows) && profileRows.length > 0) {
    const profileClubId = normalizeClubId(profileRows[0]?.club_id);
    if (profileClubId) {
      return profileClubId;
    }
  }

  return preferred || null;
}

export async function upsertPushSubscriptionRecord({
  subscriptionId,
  userId,
  clubId,
  scope = null,
  deviceLabel = null,
  userAgent = null,
  optedIn = true,
  revokedAt = null,
  anglerName = null,
}) {
  if (!subscriptionId) {
    throw new Error('Keine Subscription-ID vorhanden.');
  }
  if (!userId) {
    throw new Error('Kein eingeloggter Nutzer für Push vorhanden.');
  }

  const resolvedClubId = await resolveClubIdForUser(userId, clubId);
  if (!resolvedClubId) {
    throw new Error('Keine gültige Club-ID für Push-Subscription gefunden.');
  }

  const payload = {
    subscription_id: subscriptionId,
    user_id: userId,
    club_id: resolvedClubId,
    scope,
    device_label: deviceLabel,
    user_agent: userAgent,
    opted_in: optedIn,
    revoked_at: revokedAt,
    last_seen_at: new Date().toISOString(),
  };

  if (anglerName) {
    payload.angler_name = anglerName;
  }

  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(payload, { onConflict: 'subscription_id' });

  if (error) {
    throw error;
  }

  return { clubId: resolvedClubId };
}

export async function revokePushSubscriptionRecord({
  subscriptionId,
  userId,
  clubId,
}) {
  if (!subscriptionId || !userId) return;

  const resolvedClubId = await resolveClubIdForUser(userId, clubId);
  if (!resolvedClubId) return;

  const { error } = await supabase
    .from('push_subscriptions')
    .update({
      opted_in: false,
      revoked_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
    })
    .eq('subscription_id', subscriptionId)
    .eq('user_id', userId)
    .eq('club_id', resolvedClubId);

  if (error) {
    throw error;
  }
}

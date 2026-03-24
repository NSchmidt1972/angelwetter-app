import crypto from 'node:crypto';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';

const RUN_LIVE = process.env.SECURITY_TEST_RUN_LIVE === '1';
const SUPABASE_URL = String(
  process.env.SECURITY_TEST_SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
).trim();
const SUPABASE_ANON_KEY = String(
  process.env.SECURITY_TEST_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
).trim();
const SUPABASE_SERVICE_ROLE_KEY = String(
  process.env.SECURITY_TEST_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
).trim();
const EDGE_SECRET = String(process.env.SECURITY_TEST_EDGE_SECRET || '').trim();

const runId = crypto.randomUUID().slice(0, 8);

function createSupabaseClient(apiKey) {
  return createClient(SUPABASE_URL, apiKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

function nowIso() {
  return new Date().toISOString();
}

function buildUserSeed(name, role, clubKey) {
  const localPart = `security-${runId}-${name.toLowerCase()}`;
  return {
    key: name,
    email: `${localPart}@example.test`,
    password: `Secure-${runId}-${name}-A1!`,
    displayName: `Security ${name}`,
    role,
    clubKey,
  };
}

function isMissingEnvFunctionResponse(response) {
  return response.status === 500 && String(response.body?.error || '').toLowerCase().includes('missing env');
}

function buildFunctionUrl(functionName) {
  const base = SUPABASE_URL.replace(/\/+$/, '');
  return `${base}/functions/v1/${functionName}`;
}

async function invokeEdgeFunction(functionName, { token = null, body = {}, headers = {} } = {}) {
  const response = await fetch(buildFunctionUrl(functionName), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: JSON.stringify(body),
  });

  let parsedBody = null;
  try {
    parsedBody = await response.json();
  } catch {
    parsedBody = null;
  }

  return {
    status: response.status,
    body: parsedBody,
  };
}

test.describe.serial('roles + RLS + edge security integration', () => {
  test.skip(!RUN_LIVE, 'Set SECURITY_TEST_RUN_LIVE=1 to run live integration/security tests.');

  const missingEnv = [
    ['SECURITY_TEST_SUPABASE_URL or VITE_SUPABASE_URL', SUPABASE_URL],
    ['SECURITY_TEST_SUPABASE_ANON_KEY or VITE_SUPABASE_ANON_KEY', SUPABASE_ANON_KEY],
    ['SECURITY_TEST_SERVICE_ROLE_KEY or SUPABASE_SERVICE_ROLE_KEY', SUPABASE_SERVICE_ROLE_KEY],
  ].filter(([, value]) => !value);

  const state = {
    serviceClient: null,
    clubs: {
      alpha: null,
      beta: null,
    },
    users: {},
    authedClients: {},
    tokens: {},
    insertedFishId: null,
  };

  test.beforeAll(async () => {
    if (missingEnv.length > 0) {
      throw new Error(
        `Missing env for security tests: ${missingEnv.map(([key]) => key).join(', ')}`
      );
    }

    state.serviceClient = createSupabaseClient(SUPABASE_SERVICE_ROLE_KEY);

    const alphaSlug = `it-${runId}-alpha`;
    const betaSlug = `it-${runId}-beta`;
    const { data: clubRows, error: clubInsertError } = await state.serviceClient
      .from('clubs')
      .insert([
        { slug: alphaSlug, name: `Integration Alpha ${runId}`, is_active: true },
        { slug: betaSlug, name: `Integration Beta ${runId}`, is_active: true },
      ])
      .select('id, slug')
      .order('slug', { ascending: true });

    if (clubInsertError) throw clubInsertError;
    if (!Array.isArray(clubRows) || clubRows.length !== 2) {
      throw new Error('Could not create integration clubs.');
    }

    const alpha = clubRows.find((item) => item.slug === alphaSlug) || null;
    const beta = clubRows.find((item) => item.slug === betaSlug) || null;
    if (!alpha?.id || !beta?.id) throw new Error('Missing integration club IDs.');

    state.clubs.alpha = alpha;
    state.clubs.beta = beta;

    const userSeeds = [
      buildUserSeed('Admin', 'admin', 'alpha'),
      buildUserSeed('Member', 'mitglied', 'alpha'),
      buildUserSeed('Guest', 'gast', 'alpha'),
      buildUserSeed('Outsider', 'mitglied', 'beta'),
    ];

    for (const seed of userSeeds) {
      const { data, error } = await state.serviceClient.auth.admin.createUser({
        email: seed.email,
        password: seed.password,
        email_confirm: true,
      });
      if (error) throw error;
      if (!data?.user?.id) throw new Error(`Failed to create auth user for ${seed.key}`);

      const user = {
        ...seed,
        id: data.user.id,
      };
      state.users[seed.key] = user;

      const clubId = state.clubs[seed.clubKey]?.id || null;
      if (!clubId) throw new Error(`Missing club for user ${seed.key}`);

      const { error: profileError } = await state.serviceClient
        .from('profiles')
        .upsert(
          {
            id: user.id,
            club_id: clubId,
            name: user.displayName,
            role: user.role,
            updated_at: nowIso(),
          },
          { onConflict: 'id,club_id' }
        );
      if (profileError) throw profileError;

      const { error: membershipError } = await state.serviceClient
        .from('memberships')
        .upsert(
          {
            user_id: user.id,
            club_id: clubId,
            role: user.role,
            is_active: true,
            updated_at: nowIso(),
          },
          { onConflict: 'user_id,club_id' }
        );
      if (membershipError) throw membershipError;

      const client = createSupabaseClient(SUPABASE_ANON_KEY);
      const { data: signInData, error: signInError } = await client.auth.signInWithPassword({
        email: user.email,
        password: user.password,
      });
      if (signInError) throw signInError;
      if (!signInData?.session?.access_token) {
        throw new Error(`Missing auth token for ${seed.key}`);
      }

      state.authedClients[seed.key] = client;
      state.tokens[seed.key] = signInData.session.access_token;
    }

    const alphaClubId = state.clubs.alpha.id;
    const { error: clubFeatureError } = await state.serviceClient
      .from('club_features')
      .upsert(
        {
          club_id: alphaClubId,
          feature_key: 'push',
          enabled: true,
          updated_at: nowIso(),
        },
        { onConflict: 'club_id,feature_key' }
      );
    if (clubFeatureError) throw clubFeatureError;

    const roleFeatureRows = [
      { role: 'admin', feature_key: 'push', enabled: true },
      { role: 'mitglied', feature_key: 'push', enabled: false },
      { role: 'gast', feature_key: 'push', enabled: false },
    ].map((row) => ({
      club_id: alphaClubId,
      ...row,
      updated_at: nowIso(),
    }));
    const { error: roleFeatureError } = await state.serviceClient
      .from('club_role_features')
      .upsert(roleFeatureRows, { onConflict: 'club_id,role,feature_key' });
    if (roleFeatureError) throw roleFeatureError;

    await state.serviceClient
      .from('club_role_features')
      .delete()
      .eq('club_id', alphaClubId)
      .eq('role', 'tester')
      .eq('feature_key', 'push');
  });

  test.afterAll(async () => {
    if (!state.serviceClient) return;

    const clubIds = [state.clubs.alpha?.id, state.clubs.beta?.id].filter(Boolean);
    if (clubIds.length > 0) {
      await state.serviceClient
        .from('clubs')
        .delete()
        .in('id', clubIds);
    }

    const users = Object.values(state.users);
    for (const user of users) {
      if (!user?.id) continue;
      await state.serviceClient.auth.admin.deleteUser(user.id);
    }
  });

  test('roles: current_member_role + role feature enforcement', async () => {
    const alphaClubId = state.clubs.alpha.id;
    const member = state.authedClients.Member;
    const admin = state.authedClients.Admin;

    const memberRole = await member.rpc('current_member_role', { p_club_id: alphaClubId });
    expect(memberRole.error).toBeNull();
    expect(memberRole.data).toBe('mitglied');

    const adminRole = await admin.rpc('current_member_role', { p_club_id: alphaClubId });
    expect(adminRole.error).toBeNull();
    expect(adminRole.data).toBe('admin');

    const roleFeatureMember = await member.rpc('is_role_feature_enabled', {
      p_club_id: alphaClubId,
      p_role: 'mitglied',
      p_feature_key: 'push',
    });
    expect(roleFeatureMember.error).toBeNull();
    expect(roleFeatureMember.data).toBe(false);

    const memberInsertRoleFeature = await member.from('club_role_features').insert({
      club_id: alphaClubId,
      role: 'tester',
      feature_key: 'push',
      enabled: true,
    });
    expect(memberInsertRoleFeature.error).toBeTruthy();

    const adminInsertRoleFeature = await admin
      .from('club_role_features')
      .insert({
        club_id: alphaClubId,
        role: 'tester',
        feature_key: 'push',
        enabled: true,
      })
      .select('id')
      .maybeSingle();
    expect(adminInsertRoleFeature.error).toBeNull();
    expect(adminInsertRoleFeature.data?.id).toBeTruthy();
  });

  test('RLS: guest write denied, outsider cross-club read denied', async () => {
    const alphaClubId = state.clubs.alpha.id;
    const member = state.authedClients.Member;
    const guest = state.authedClients.Guest;
    const outsider = state.authedClients.Outsider;

    const memberInsert = await member
      .from('fishes')
      .insert({
        club_id: alphaClubId,
        user_id: state.users.Member.id,
        angler: state.users.Member.displayName,
        fish: 'Hecht',
        size: 61,
        location_name: 'Vereinsgewässer',
        lat: 51.3135,
        lon: 6.256,
        timestamp: nowIso(),
      })
      .select('id, club_id')
      .maybeSingle();

    expect(memberInsert.error).toBeNull();
    expect(memberInsert.data?.club_id).toBe(alphaClubId);
    state.insertedFishId = memberInsert.data?.id || null;

    const guestInsert = await guest
      .from('fishes')
      .insert({
        club_id: alphaClubId,
        user_id: state.users.Guest.id,
        angler: state.users.Guest.displayName,
        fish: 'Barsch',
        size: 28,
        timestamp: nowIso(),
      })
      .select('id')
      .maybeSingle();

    expect(guestInsert.error).toBeTruthy();

    const outsiderRead = await outsider
      .from('fishes')
      .select('id')
      .eq('club_id', alphaClubId);
    expect(outsiderRead.error).toBeNull();
    expect(Array.isArray(outsiderRead.data)).toBe(true);
    expect(outsiderRead.data).toEqual([]);

    const outsiderUpdate = await outsider
      .from('fishes')
      .update({ note: 'forbidden-update' })
      .eq('id', state.insertedFishId)
      .select('id, note');
    expect(outsiderUpdate.error).toBeNull();
    expect(Array.isArray(outsiderUpdate.data)).toBe(true);
    expect(outsiderUpdate.data).toEqual([]);
  });

  test('edge security: opsAlert rejects unauthorized requests', async () => {
    const unauthorized = await invokeEdgeFunction('opsAlert', {
      body: {
        source: 'integration-test',
        service: 'security-suite',
        severity: 'warning',
        message: 'unauthorized probe',
      },
    });
    expect(unauthorized.status).toBe(401);
    expect(unauthorized.body?.error).toBe('Unauthorized');
  });

  test('edge security: weatherProxy validates payload before provider usage', async () => {
    const memberToken = state.tokens.Member;

    const invalidCoords = await invokeEdgeFunction('weatherProxy', {
      token: memberToken,
      body: { lat: 'NaN', lon: 6.256, clubId: state.clubs.alpha.id },
    });
    if (isMissingEnvFunctionResponse(invalidCoords)) {
      test.skip(true, 'weatherProxy secrets not configured in target environment.');
    }

    expect(invalidCoords.status).toBe(400);
    expect(invalidCoords.body?.error).toBe('Invalid coordinates');

    const invalidClubId = await invokeEdgeFunction('weatherProxy', {
      token: memberToken,
      body: { lat: 51.3135, lon: 6.256, clubId: 'not-a-uuid' },
    });
    expect(invalidClubId.status).toBe(400);
    expect(invalidClubId.body?.error).toBe('Invalid clubId');
  });

  test('edge security: sendCatchPush denies guest role', async () => {
    const alphaClubId = state.clubs.alpha.id;
    const headers = EDGE_SECRET ? { 'x-edge-secret': EDGE_SECRET } : {};
    const payload = {
      club_id: alphaClubId,
      club_slug: state.clubs.alpha.slug,
      angler: state.users.Member.displayName,
      fish: 'Hecht',
      size: 60,
    };

    const adminProbe = await invokeEdgeFunction('sendCatchPush', {
      token: state.tokens.Admin,
      headers,
      body: payload,
    });
    if (isMissingEnvFunctionResponse(adminProbe)) {
      test.skip(true, 'sendCatchPush secrets are not configured in target environment.');
    }
    if (adminProbe.status === 401 && adminProbe.body?.error === 'Unauthorized' && !EDGE_SECRET) {
      test.skip(true, 'sendCatchPush requires x-edge-secret in target environment.');
    }

    const guestProbe = await invokeEdgeFunction('sendCatchPush', {
      token: state.tokens.Guest,
      headers,
      body: payload,
    });
    if (guestProbe.status === 401 && guestProbe.body?.error === 'Unauthorized' && !EDGE_SECRET) {
      test.skip(true, 'sendCatchPush requires x-edge-secret in target environment.');
    }

    expect(guestProbe.status).toBe(403);
    expect(String(guestProbe.body?.error || '').toLowerCase()).toContain('role');
  });
});

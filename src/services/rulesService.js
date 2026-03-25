// src/services/rulesService.js
import { supabase } from '@/supabaseClient';
import { getActiveClubId } from '@/utils/clubId';
import { MIN_SIZES, CLOSED_SEASONS, isCatchAllowed } from '../rules/clubRules';

const RULES_SELECT = [
  'id',
  'club_id',
  'waterbody_id',
  'species',
  'min_size_cm',
  'season_start_md',
  'season_end_md',
  'is_protected',
  'daily_limit',
  'notes',
  'is_active',
  'updated_at',
].join(', ');

const WATER_BODY_LABEL = 'Vereinsgewässer';
const SEASON_NOTE = 'Während der Schonzeit sind toter Köderfisch und alle Kunstköder verboten.';
const MONTH_DAY_REGEX = /^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;

function asNullableString(value) {
  const str = typeof value === 'string' ? value.trim() : String(value ?? '').trim();
  return str || null;
}

function normalizeWaterbodyId(value) {
  return asNullableString(value);
}

function normalizeMonthDay(value) {
  const candidate = asNullableString(value);
  if (!candidate) return null;
  if (!MONTH_DAY_REGEX.test(candidate)) {
    throw new Error('Schonzeit muss im Format MM-DD angegeben werden (z. B. 02-15).');
  }
  return candidate;
}

function normalizeDecimal(value) {
  if (value == null || value === '') return null;
  const num = Number(String(value).replace(',', '.'));
  if (!Number.isFinite(num) || num < 0) {
    throw new Error('Mindestmaß muss eine Zahl >= 0 sein.');
  }
  return num;
}

function normalizeInteger(value) {
  if (value == null || value === '') return null;
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) {
    throw new Error('Tageslimit muss eine ganze Zahl > 0 sein.');
  }
  return num;
}

function mapRuleRow(row) {
  return {
    id: row?.id ?? null,
    species: String(row?.species || '').trim(),
    min_size_cm: row?.min_size_cm != null ? Number(row.min_size_cm) : null,
    season_start: row?.season_start_md ?? null,
    season_end: row?.season_end_md ?? null,
    protected: Boolean(row?.is_protected),
    daily_limit: row?.daily_limit != null ? Number(row.daily_limit) : null,
    notes: row?.notes ? String(row.notes) : '',
    is_active: row?.is_active !== false,
    waterbody_id: row?.waterbody_id ?? null,
    water_body: WATER_BODY_LABEL,
    updated_at: row?.updated_at ?? null,
  };
}

function fallbackRulesFromStatic() {
  const speciesSet = new Set([
    ...Object.keys(MIN_SIZES || {}),
    ...Object.keys(CLOSED_SEASONS || {}),
  ]);

  return Array.from(speciesSet)
    .map((species) => {
      const season = CLOSED_SEASONS[species] || null;
      return {
        id: null,
        species,
        min_size_cm: MIN_SIZES[species] ?? null,
        season_start: season?.start ?? null,
        season_end: season?.end ?? null,
        protected: false,
        daily_limit: null,
        notes: season ? SEASON_NOTE : '',
        is_active: true,
        waterbody_id: null,
        water_body: WATER_BODY_LABEL,
        updated_at: null,
      };
    })
    .sort((a, b) => a.species.localeCompare(b.species, 'de'));
}

function isMissingRulesTableError(error) {
  const code = String(error?.code || '');
  const message = String(error?.message || '').toLowerCase();
  return code === '42P01' || message.includes('club_fish_rules');
}

function buildRulePayload(input) {
  const species = asNullableString(input?.species);
  if (!species) {
    throw new Error('Bitte eine Fischart angeben.');
  }

  const seasonStart = normalizeMonthDay(input?.season_start);
  const seasonEnd = normalizeMonthDay(input?.season_end);
  if ((seasonStart && !seasonEnd) || (!seasonStart && seasonEnd)) {
    throw new Error('Schonzeit braucht immer Start und Ende.');
  }

  return {
    species,
    min_size_cm: normalizeDecimal(input?.min_size_cm),
    season_start_md: seasonStart,
    season_end_md: seasonEnd,
    is_protected: Boolean(input?.protected),
    daily_limit: normalizeInteger(input?.daily_limit),
    notes: asNullableString(input?.notes),
    is_active: input?.is_active !== false,
  };
}

function mapMutationError(error) {
  if (!error) return null;
  const code = String(error.code || '');
  if (code === '23505') {
    return new Error('Für diese Fischart gibt es in diesem Regel-Kontext bereits einen Eintrag.');
  }
  if (code === '42501') {
    return new Error('Keine Berechtigung zum Bearbeiten der Regeln.');
  }
  return new Error(error.message || 'Regel konnte nicht gespeichert werden.');
}

async function queryRulesByScope({ clubId, waterbodyId = null, includeInactive = false }) {
  let query = supabase
    .from('club_fish_rules')
    .select(RULES_SELECT)
    .eq('club_id', clubId);

  if (waterbodyId) query = query.eq('waterbody_id', waterbodyId);
  else query = query.is('waterbody_id', null);

  if (!includeInactive) query = query.eq('is_active', true);

  const { data, error } = await query
    .order('is_active', { ascending: false })
    .order('species', { ascending: true });

  if (error) throw error;
  return Array.isArray(data) ? data.map(mapRuleRow) : [];
}

async function loadRulesWithFallback({
  clubId,
  waterbodyId = null,
  includeInactive = false,
  fallbackToClubDefault = false,
}) {
  const normalizedWaterbodyId = normalizeWaterbodyId(waterbodyId);

  let rules = await queryRulesByScope({
    clubId,
    waterbodyId: normalizedWaterbodyId,
    includeInactive,
  });

  if (normalizedWaterbodyId && fallbackToClubDefault && rules.length === 0) {
    rules = await queryRulesByScope({
      clubId,
      waterbodyId: null,
      includeInactive,
    });
  }

  return rules;
}

/**
 * Öffentliche Regelansicht für Mitglieder.
 * Optional mit Gewässerkontext + Fallback auf Club-Standard.
 */
export async function fetchRules(options = {}) {
  const clubId = getActiveClubId();
  const useStaticFallback = options?.useStaticFallback !== false;
  if (!clubId) return useStaticFallback ? fallbackRulesFromStatic() : [];

  try {
    const rules = await loadRulesWithFallback({
      clubId,
      waterbodyId: options?.waterbody_id ?? options?.waterbodyId ?? null,
      includeInactive: false,
      fallbackToClubDefault: options?.fallbackToClubDefault !== false,
    });
    if (rules.length === 0) return useStaticFallback ? fallbackRulesFromStatic() : [];
    return rules;
  } catch (error) {
    if (isMissingRulesTableError(error)) return useStaticFallback ? fallbackRulesFromStatic() : [];
    throw new Error(error.message || 'Regeln konnten nicht geladen werden.');
  }
}

/**
 * Vollansicht für Vorstand/Admin (inkl. inaktiver Regeln), optional je Gewässer.
 */
export async function fetchBoardRules(options = {}) {
  const clubId = getActiveClubId();
  if (!clubId) return fallbackRulesFromStatic();

  try {
    return await loadRulesWithFallback({
      clubId,
      waterbodyId: options?.waterbody_id ?? options?.waterbodyId ?? null,
      includeInactive: true,
      fallbackToClubDefault: options?.fallbackToClubDefault === true,
    });
  } catch (error) {
    if (isMissingRulesTableError(error)) return fallbackRulesFromStatic();
    throw new Error(error.message || 'Regeln konnten nicht geladen werden.');
  }
}

export async function fetchRuleSpeciesForContext(options = {}) {
  const rules = await fetchRules(options);
  return Array.from(
    new Set(
      rules
        .map((rule) => String(rule?.species || '').trim())
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b, 'de', { sensitivity: 'base' }));
}

export async function createBoardRule(input, options = {}) {
  const clubId = getActiveClubId();
  if (!clubId) throw new Error('Kein aktiver Verein gefunden.');

  const payload = buildRulePayload(input);
  const waterbodyId = normalizeWaterbodyId(
    input?.waterbody_id ?? input?.waterbodyId ?? options?.waterbody_id ?? options?.waterbodyId,
  );
  const { data, error } = await supabase
    .from('club_fish_rules')
    .insert({
      club_id: clubId,
      waterbody_id: waterbodyId,
      ...payload,
    })
    .select(RULES_SELECT)
    .single();

  if (error) throw mapMutationError(error);
  return mapRuleRow(data);
}

export async function updateBoardRule(ruleId, input, options = {}) {
  const clubId = getActiveClubId();
  if (!clubId) throw new Error('Kein aktiver Verein gefunden.');
  if (!ruleId) throw new Error('Regel-ID fehlt.');

  const payload = buildRulePayload(input);
  const nextWaterbodyId = normalizeWaterbodyId(
    input?.waterbody_id ?? input?.waterbodyId ?? options?.waterbody_id ?? options?.waterbodyId,
  );
  if (Object.prototype.hasOwnProperty.call(input || {}, 'waterbody_id')
    || Object.prototype.hasOwnProperty.call(input || {}, 'waterbodyId')
    || Object.prototype.hasOwnProperty.call(options || {}, 'waterbody_id')
    || Object.prototype.hasOwnProperty.call(options || {}, 'waterbodyId')
  ) {
    payload.waterbody_id = nextWaterbodyId;
  }

  const { data, error } = await supabase
    .from('club_fish_rules')
    .update(payload)
    .eq('id', ruleId)
    .eq('club_id', clubId)
    .select(RULES_SELECT)
    .single();

  if (error) throw mapMutationError(error);
  return mapRuleRow(data);
}

export async function deleteBoardRule(ruleId) {
  const clubId = getActiveClubId();
  if (!clubId) throw new Error('Kein aktiver Verein gefunden.');
  if (!ruleId) throw new Error('Regel-ID fehlt.');

  const { error } = await supabase
    .from('club_fish_rules')
    .delete()
    .eq('id', ruleId)
    .eq('club_id', clubId);

  if (error) throw mapMutationError(error);
}

/**
 * Prüft Fang gegen statische Fallback-Regeln.
 * Der produktive Regelkatalog kommt aus der Datenbank (fetchRules/fetchBoardRules).
 */
export function evaluateCatchAgainstRules({ species, sizeCm, dateISO }) {
  const date = dateISO ? new Date(dateISO) : new Date();
  const result = isCatchAllowed(species, Number(sizeCm), date);
  const messages = [];
  if (!result.allowed && result.reason) messages.push(result.reason);

  const rule = {
    species,
    min_size_cm: MIN_SIZES[species] ?? null,
    season_start: CLOSED_SEASONS[species]?.start ?? null,
    season_end: CLOSED_SEASONS[species]?.end ?? null,
    protected: false,
    notes: CLOSED_SEASONS[species] ? SEASON_NOTE : '',
    water_body: WATER_BODY_LABEL,
  };

  return {
    allowed: !!result.allowed,
    messages,
    rule,
  };
}

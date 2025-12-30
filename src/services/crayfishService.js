// src/services/crayfishService.js
import { supabase } from '@/supabaseClient';
import { getActiveClubId } from '@/utils/clubId';

export const CRAYFISH_SPECIES = [
  'Roter amerikanischer Flusskrebs',
  'Signalkrebs',
  'Kamberkrebs',
  'Kalikokrebs',
];

export async function saveCrayfishCatch({ angler, species, count, timestamp, note = '' }) {
  if (!species) throw new Error('Bitte eine Art auswählen.');
  const countNum = Number(count);
  if (!Number.isFinite(countNum) || countNum <= 0) {
    throw new Error('Anzahl muss größer als 0 sein.');
  }

  const ts = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (!(ts instanceof Date) || Number.isNaN(ts.getTime())) {
    throw new Error('Ungültiges Datum oder Uhrzeit.');
  }

  const payload = {
    angler: angler || null,
    species,
    count: countNum,
    catch_timestamp: ts.toISOString(),
    note: note || null,
    club_id: getActiveClubId(),
  };

  const { data, error } = await supabase.from('crayfish_catches').insert(payload).select().single();
  if (error) throw new Error(error.message || 'Krebsfang konnte nicht gespeichert werden.');
  return data;
}

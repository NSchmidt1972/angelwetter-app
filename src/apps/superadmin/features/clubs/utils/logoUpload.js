import { supabase } from '@/supabaseClient';

const CLUB_LOGO_BUCKET = 'club-logos';
const MAX_LOGO_BYTES = 5 * 1024 * 1024;
const DEFAULT_EXTENSION = 'png';
const MIME_TO_EXTENSION = Object.freeze({
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
});

function inferExtension(file) {
  if (file?.type && MIME_TO_EXTENSION[file.type]) return MIME_TO_EXTENSION[file.type];
  const fromName = String(file?.name || '')
    .split('.')
    .pop()
    ?.trim()
    .toLowerCase();
  return fromName || DEFAULT_EXTENSION;
}

export function validateClubLogoFile(file) {
  if (!file) return { ok: false, error: 'Bitte eine Datei auswählen.' };

  const supportedByMime = !file.type || Boolean(MIME_TO_EXTENSION[file.type]);
  const ext = inferExtension(file);
  const supportedByExt = ['png', 'jpg', 'jpeg', 'webp', 'svg'].includes(ext);

  if (!supportedByMime && !supportedByExt) {
    return { ok: false, error: 'Nur PNG, JPG, WEBP oder SVG sind erlaubt.' };
  }

  if (file.size > MAX_LOGO_BYTES) {
    return { ok: false, error: 'Datei ist zu groß. Maximum: 5 MB.' };
  }

  return { ok: true };
}

export async function uploadClubLogoFile({ clubId, file }) {
  const validation = validateClubLogoFile(file);
  if (!validation.ok) {
    throw new Error(validation.error);
  }
  if (!clubId) {
    throw new Error('Club-ID fehlt für den Logo-Upload.');
  }

  const ext = inferExtension(file);
  const path = `${clubId}/logo-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(CLUB_LOGO_BUCKET)
    .upload(path, file, {
      upsert: true,
      cacheControl: '3600',
      contentType: file.type || undefined,
    });
  if (uploadError) {
    throw new Error(uploadError.message || 'Logo konnte nicht hochgeladen werden.');
  }

  const { data } = supabase.storage.from(CLUB_LOGO_BUCKET).getPublicUrl(path);
  if (!data?.publicUrl) {
    throw new Error('Öffentliche Logo-URL konnte nicht erzeugt werden.');
  }
  return data.publicUrl;
}

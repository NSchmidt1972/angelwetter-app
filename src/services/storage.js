// src/services/storage.js
import { supabase } from '../supabaseClient';

export async function uploadPhotoAndGetUrl({ file, id }) {
  const ext = file.name.split('.').pop();
  const path = `${id}.${ext}`;
  const { error: uploadError } = await supabase.storage.from('fischfotos').upload(path, file, { upsert: true });
  if (uploadError) throw uploadError;
  const { data: publicUrlData } = supabase.storage.from('fischfotos').getPublicUrl(path);
  return publicUrlData.publicUrl;
}

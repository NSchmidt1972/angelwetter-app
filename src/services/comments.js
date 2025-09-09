// src/services/comments.js
import { supabase } from '../supabaseClient';

export async function listComments(fishId) {
  return supabase.from('comments').select('*').eq('fish_id', fishId).order('created_at', { ascending: true });
}
export async function addComment({ fish_id, user_name, text }) {
  return supabase.from('comments').insert([{ fish_id, user_name, text }]);
}
export async function deleteComment(id) {
  return supabase.from('comments').delete().eq('id', id);
}

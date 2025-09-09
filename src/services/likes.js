// src/services/likes.js
import { supabase } from '../supabaseClient';

export async function fetchLikesFor(ids) {
  if (!ids.length) return { data: [] };
  return supabase.from('likes').select('fish_id, user_name').in('fish_id', ids);
}

export async function likeFish(fishId, user) {
  return supabase.from('likes').insert([{ fish_id: fishId, user_name: user }]);
}
export async function unlikeFish(fishId, user) {
  return supabase.from('likes').delete().eq('fish_id', fishId).eq('user_name', user);
}

export function subscribeLikes(anglerName, { onInsert, onDelete }) {
  const channel = supabase
    .channel('likes-changes')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'likes' }, (payload) => onInsert?.(payload.new, anglerName))
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'likes' }, (payload) => onDelete?.(payload.old, anglerName))
    .subscribe();
  return () => supabase.removeChannel(channel);
}

// src/services/reactions.js
import { supabase } from '../supabaseClient';

const TABLE = 'fish_reactions';

export function fetchReactionsFor(fishIds = []) {
  if (!fishIds.length) {
    return { data: [], error: null };
  }
  return supabase
    .from(TABLE)
    .select('id, fish_id, user_name, reaction')
    .in('fish_id', fishIds);
}

export function setReactionForFish(fishId, userName, reaction) {
  return supabase
    .from(TABLE)
    .upsert({ fish_id: fishId, user_name: userName, reaction }, { onConflict: 'fish_id,user_name' })
    .select();
}

export function removeReactionForFish(fishId, userName) {
  return supabase
    .from(TABLE)
    .delete()
    .eq('fish_id', fishId)
    .eq('user_name', userName);
}

export function subscribeReactions({ onInsert, onUpdate, onDelete } = {}) {
  const channel = supabase
    .channel('public:fish_reactions')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: TABLE },
      (payload) => {
        onInsert?.(payload.new);
      }
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: TABLE },
      (payload) => {
        onUpdate?.(payload.new, payload.old);
      }
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: TABLE },
      (payload) => {
        onDelete?.(payload.old);
      }
    )
    .subscribe();

  return () => {
    if (channel) supabase.removeChannel(channel);
  };
}

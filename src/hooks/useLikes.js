// src/hooks/useLikes.js
import { useCallback, useEffect, useState } from 'react';
import { fetchLikesFor, likeFish, unlikeFish, subscribeLikes } from '../services/likes';

export function useLikes(anglerName) {
  const [likesData, setLikesData] = useState({});
  const [userLikes, setUserLikes] = useState(new Set());
  const [pending, setPending] = useState(new Set());

  const loadFor = useCallback(async (ids) => {
    const { data, error } = await fetchLikesFor(Array.from(new Set(ids)));
    if (error) return console.error('Likes laden:', error);
    const map = {};
    const mine = new Set();
    data.forEach(l => {
      map[l.fish_id] = (map[l.fish_id] || 0) + 1;
      if (l.user_name === anglerName) mine.add(l.fish_id);
    });
    setLikesData(p => ({ ...p, ...map }));
    setUserLikes(p => new Set([...p, ...mine]));
  }, [anglerName]);

  const toggle = useCallback(async (fishId) => {
    if (pending.has(fishId)) return;
    setPending(p => new Set(p).add(fishId));
    const liked = userLikes.has(fishId);
    try {
      if (liked) {
        setLikesData(p => ({ ...p, [fishId]: Math.max((p[fishId] || 1) - 1, 0) }));
        setUserLikes(p => { const s = new Set(p); s.delete(fishId); return s; });
        const { error } = await unlikeFish(fishId, anglerName);
        if (error) throw error;
      } else {
        setLikesData(p => ({ ...p, [fishId]: (p[fishId] || 0) + 1 }));
        setUserLikes(p => new Set(p).add(fishId));
        const { error } = await likeFish(fishId, anglerName);
        if (error) throw error;
      }
    } catch {
      // rollback
      if (liked) {
        setLikesData(p => ({ ...p, [fishId]: (p[fishId] || 0) + 1 }));
        setUserLikes(p => new Set(p).add(fishId));
      } else {
        setLikesData(p => ({ ...p, [fishId]: Math.max((p[fishId] || 1) - 1, 0) }));
        setUserLikes(p => { const s = new Set(p); s.delete(fishId); return s; });
      }
    } finally {
      setPending(p => { const s = new Set(p); s.delete(fishId); return s; });
    }
  }, [pending, userLikes, anglerName]);

  useEffect(() => {
    const unsub = subscribeLikes(anglerName, {
      onInsert: (like, me) => {
        setLikesData(p => ({ ...p, [like.fish_id]: (p[like.fish_id] || 0) + 1 }));
        if (like.user_name === me) setUserLikes(p => new Set(p).add(like.fish_id));
      },
      onDelete: (like, me) => {
        setLikesData(p => ({ ...p, [like.fish_id]: Math.max((p[like.fish_id] || 1) - 1, 0) }));
        if (like.user_name === me) setUserLikes(p => { const s = new Set(p); s.delete(like.fish_id); return s; });
      }
    });
    return unsub;
  }, [anglerName]);

  return { likesData, userLikes, pendingLikes: pending, loadLikesFor: loadFor, toggleLike: toggle };
}

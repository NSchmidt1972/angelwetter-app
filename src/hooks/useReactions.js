// src/hooks/useReactions.js
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchReactionsFor,
  removeReactionForFish,
  setReactionForFish,
  subscribeReactions,
} from '../services/reactions';

function cloneCounts(counts) {
  const clone = {};
  Object.entries(counts || {}).forEach(([reaction, value]) => {
    clone[reaction] = value;
  });
  return clone;
}

export function useReactions(userName) {
  const [reactionCounts, setReactionCounts] = useState({});
  const [userReactions, setUserReactions] = useState({});
  const [pending, setPending] = useState(new Set());

  const loadReactionsFor = useCallback(
    async (fishIds = []) => {
      const ids = Array.from(new Set(fishIds.filter(Boolean)));
      if (!ids.length) return;

      const { data, error } = await fetchReactionsFor(ids);
      if (error) {
        console.error('Reaktionen laden:', error);
        return;
      }

      const counts = {};
      const mine = {};
      data.forEach((row) => {
        const fid = row.fish_id;
        if (!counts[fid]) counts[fid] = {};
        counts[fid][row.reaction] = (counts[fid][row.reaction] || 0) + 1;
        if (row.user_name === userName) mine[fid] = row.reaction;
      });
      setReactionCounts((prev) => {
        const next = { ...prev };
        ids.forEach((id) => {
          next[id] = { ...(counts[id] || {}) };
        });
        return next;
      });
      setUserReactions((prev) => {
        const next = { ...prev };
        ids.forEach((id) => {
          if (mine[id]) next[id] = mine[id];
          else delete next[id];
        });
        return next;
      });
    },
    [userName]
  );

  const applyDelta = useCallback((fishId, reaction, delta) => {
    setReactionCounts((prev) => {
      const next = { ...prev };
      const forFish = { ...(next[fishId] || {}) };
      const nextValue = Math.max((forFish[reaction] || 0) + delta, 0);
      if (nextValue === 0) {
        delete forFish[reaction];
      } else {
        forFish[reaction] = nextValue;
      }
      next[fishId] = forFish;
      return next;
    });
  }, []);

  const reactToFish = useCallback(
    async (fishId, reaction) => {
      if (!fishId || !userName) return;
      if (pending.has(fishId)) return;
      setPending((p) => new Set(p).add(fishId));

      const previousReaction = userReactions[fishId] || null;
      const previousCounts = cloneCounts(reactionCounts[fishId]);
      const removing = previousReaction === reaction;

      if (previousReaction) applyDelta(fishId, previousReaction, -1);
      if (!removing) applyDelta(fishId, reaction, 1);
      setUserReactions((prev) => {
        const next = { ...prev };
        if (removing) delete next[fishId];
        else next[fishId] = reaction;
        return next;
      });

      try {
        if (removing) {
          const { error } = await removeReactionForFish(fishId, userName);
          if (error) throw error;
        } else {
          const { error } = await setReactionForFish(fishId, userName, reaction);
          if (error) throw error;
        }
      } catch (err) {
        console.error('Reaktion speichern:', err);
        setReactionCounts((prev) => ({ ...prev, [fishId]: cloneCounts(previousCounts) }));
        setUserReactions((prev) => {
          const next = { ...prev };
          if (previousReaction) next[fishId] = previousReaction;
          else delete next[fishId];
          return next;
        });
      } finally {
        setPending((p) => {
          const next = new Set(p);
          next.delete(fishId);
          return next;
        });
      }
    },
    [applyDelta, pending, reactionCounts, userName, userReactions]
  );

  useEffect(() => {
    const unsubscribe = subscribeReactions({
      onInsert: (row) => {
        if (!row?.fish_id || !row.reaction) return;
        applyDelta(row.fish_id, row.reaction, 1);
        if (row.user_name === userName) {
          setUserReactions((prev) => ({ ...prev, [row.fish_id]: row.reaction }));
        }
      },
      onUpdate: (row, oldRow) => {
        if (!row?.fish_id || !row.reaction) return;
        if (oldRow?.reaction) applyDelta(row.fish_id, oldRow.reaction, -1);
        applyDelta(row.fish_id, row.reaction, 1);
        if (row.user_name === userName) {
          setUserReactions((prev) => ({ ...prev, [row.fish_id]: row.reaction }));
        }
      },
      onDelete: (row) => {
        if (!row?.fish_id || !row?.reaction) return;
        applyDelta(row.fish_id, row.reaction, -1);
        if (row.user_name === userName) {
          setUserReactions((prev) => {
            const next = { ...prev };
            delete next[row.fish_id];
            return next;
          });
        }
      },
    });

    return () => {
      unsubscribe?.();
    };
  }, [applyDelta, userName]);

  const getReactionsFor = useCallback(
    (fishId) => reactionCounts[fishId] || {},
    [reactionCounts]
  );

  const getUserReactionFor = useCallback(
    (fishId) => userReactions[fishId] || null,
    [userReactions]
  );

  const isPending = useCallback(
    (fishId) => pending.has(fishId),
    [pending]
  );

  return useMemo(
    () => ({
      loadReactionsFor,
      reactToFish,
      getReactionsFor,
      getUserReactionFor,
      isPending,
    }),
    [getReactionsFor, getUserReactionFor, isPending, loadReactionsFor, reactToFish]
  );
}

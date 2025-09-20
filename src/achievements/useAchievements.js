// src/achievements/useAchievements.js
import { useCallback, useRef } from "react";
import { achievements, getCount } from "./achievementsConfig";

export function useAchievements({ supabase, showEffect, remember }) {
  // remember: Funktion, die ausgelöste IDs speichert (lokal/DB),
  // damit man nicht mehrfach direkt hintereinander triggert.
  const triggering = useRef(false);

  const checkOnNewCatch = useCallback(async ({ userId, lastCatch }) => {
    if (triggering.current) return;
    triggering.current = true;

    try {
      for (const a of achievements) {
        // Doppelt vermeiden?
        if (await remember.has(a.id, lastCatch?.id)) continue;

        let hit = false;
        let ctx = { fish: lastCatch?.fish, size: lastCatch?.size };

        if (a.needsCount && !userId) {
          continue;
        }

        if (a.needsCount) {
          const { table, filter, threshold } = a.needsCount;
          const filters = [];
          if (filter?.key && filter?.op && userId) {
            filters.push([filter.key, filter.op, userId]);
          }
          const { count } = await getCount(supabase, table, filters);
          hit = count === threshold;
        } else if (a.check) {
          hit = await a.check({ supabase, userId, lastCatch });
        }

        if (hit) {
          const message = typeof a.message === "function" ? a.message(ctx) : a.message;
          if (typeof showEffect === "function") {
            showEffect({ id: a.id, title: a.title, message, icon: a.icon });
          }
          await remember.add(a.id, lastCatch?.id);
        }
      }
    } finally {
      triggering.current = false;
    }
  }, [supabase, showEffect, remember]);

  return { checkOnNewCatch };
}

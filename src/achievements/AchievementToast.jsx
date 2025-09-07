// src/achievements/AchievementToast.jsx
import * as FramerMotion from "framer-motion"; // ✅ Namespace-Import großgeschrieben
import { useEffect, useState } from "react";

export default function AchievementToast({ queue }) {
  const [current, setCurrent] = useState(null);

  useEffect(() => {
    if (!current && queue.length > 0) {
      setCurrent(queue[0]);
    }
  }, [queue, current]);

  useEffect(() => {
    if (!current) return;
    const t = setTimeout(() => setCurrent(null), 3500);
    return () => clearTimeout(t);
  }, [current]);

  return (
    <div className="pointer-events-none fixed inset-0 z-[9999] flex items-start justify-center p-4 sm:p-6">
      <FramerMotion.AnimatePresence>
        {current && (
          <FramerMotion.motion.div
            key={current.id + Math.random()}
            initial={{ y: -40, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -40, opacity: 0, scale: 0.98 }}
            className="pointer-events-auto mt-4 w-full max-w-md rounded-2xl bg-white/90 dark:bg-zinc-800/90 shadow-xl ring-1 ring-black/10 backdrop-blur-md"
          >
            <div className="flex items-center gap-3 p-4">
              <div className="text-3xl">{current.icon ?? "✨"}</div>
              <div className="flex-1">
                <div className="text-sm font-semibold tracking-wide uppercase text-zinc-700 dark:text-zinc-200">
                  {current.title}
                </div>
                <div className="text-zinc-800 dark:text-zinc-100">
                  {current.message}
                </div>
              </div>
            </div>
            <div className="h-1 w-full bg-gradient-to-r from-indigo-500 via-emerald-400 to-amber-400 rounded-b-2xl" />
          </FramerMotion.motion.div>
        )}
      </FramerMotion.AnimatePresence>
    </div>
  );
}

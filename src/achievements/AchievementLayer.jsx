// src/achievements/AchievementLayer.jsx
import { Suspense, lazy, useCallback, useState } from "react";

const AchievementToast = lazy(() => import("./AchievementToast"));

export default function AchievementLayer({ children }) {
  const [queue, setQueue] = useState([]);

  const showEffect = useCallback(({ id, title, message, icon }) => {
    const entry = {
      id,
      title,
      message,
      icon,
      queueId: `${id ?? "achievement"}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    };
    setQueue((q) => [...q, entry]);
    import("./confetti")
      .then(({ burst }) => burst())
      .catch((err) => console.warn("Konfetti konnte nicht geladen werden:", err));
    // autom. Dequeue in Toast-Komponente
  }, []);

  const handleConsume = useCallback(() => {
    setQueue((q) => (q.length > 0 ? q.slice(1) : q));
  }, []);

  return (
    <div className="relative">
      {children(showEffect)}
      {queue.length > 0 ? (
        <Suspense fallback={null}>
          <AchievementToast queue={queue} onConsume={handleConsume} />
        </Suspense>
      ) : null}
    </div>
  );
}

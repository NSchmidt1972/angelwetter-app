// src/achievements/AchievementLayer.jsx
import { useCallback, useState } from "react";
import AchievementToast from "./AchievementToast";
import { burst } from "./confetti";

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
    burst();
    // autom. Dequeue in Toast-Komponente
  }, []);

  const handleConsume = useCallback(() => {
    setQueue((q) => (q.length > 0 ? q.slice(1) : q));
  }, []);

  return (
    <div className="relative">
      {children(showEffect)}
      <AchievementToast queue={queue} onConsume={handleConsume} />
    </div>
  );
}

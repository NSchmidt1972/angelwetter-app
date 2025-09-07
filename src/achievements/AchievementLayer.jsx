// src/achievements/AchievementLayer.jsx
import { useCallback, useState } from "react";
import AchievementToast from "./AchievementToast";
import { burst } from "./confetti";

export default function AchievementLayer({ children }) {
  const [queue, setQueue] = useState([]);

  const showEffect = useCallback(({ id, title, message, icon }) => {
    setQueue((q) => [...q, { id, title, message, icon }]);
    burst();
    // autom. Dequeue in Toast-Komponente
  }, []);

  return (
    <div className="relative">
      {children(showEffect)}
      <AchievementToast queue={queue} />
    </div>
  );
}

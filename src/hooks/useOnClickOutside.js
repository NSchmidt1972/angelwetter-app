import { useEffect } from "react";

export function useOnClickOutside(refs, onOutside) {
  useEffect(() => {
    function handler(e) {
      const target = e.target;
      const clickedInside = refs.some(r => r.current && r.current.contains(target));
      if (!clickedInside) onOutside();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [refs, onOutside]);
}

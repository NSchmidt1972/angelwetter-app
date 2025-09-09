// src/hooks/useInfiniteScroll.js
import { useEffect } from 'react';

export function useInfiniteScroll({ ref, hasMore, loading, onHit, rootMargin = '400px' }) {
  useEffect(() => {
    if (!hasMore || !ref.current) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting && !loading) onHit(); }, { rootMargin });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [ref, hasMore, loading, onHit, rootMargin]);
}

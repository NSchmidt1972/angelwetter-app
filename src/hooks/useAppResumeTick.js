import { useEffect, useState } from 'react';
import { RESUME_SYNC_EVENT, readResumeSyncSequence } from '@/hooks/resumeSyncEvent';

export function useAppResumeTick({ enabled = true } = {}) {
  const [tick, setTick] = useState(() => readResumeSyncSequence());

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return undefined;

    const onResumeSync = (event) => {
      const nextSequence = Number(event?.detail?.sequence);
      if (Number.isFinite(nextSequence) && nextSequence > 0) {
        setTick((value) => (nextSequence > value ? nextSequence : value));
        return;
      }
      setTick((value) => value + 1);
    };

    window.addEventListener(RESUME_SYNC_EVENT, onResumeSync);
    return () => {
      window.removeEventListener(RESUME_SYNC_EVENT, onResumeSync);
    };
  }, [enabled]);

  return tick;
}

export default useAppResumeTick;

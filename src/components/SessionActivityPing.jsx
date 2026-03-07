import { useEffect } from 'react';
import { supabase } from '@/supabaseClient';
import { getActiveClubId } from '@/utils/clubId';

const NULL_CLUB_ID = '00000000-0000-0000-0000-000000000000';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTIVITY_REFRESH_INTERVAL_MS = 3 * 60 * 1000;
const INITIAL_DELAY_MS = 500;

function scheduleLater(callback, delay = INITIAL_DELAY_MS) {
  if (typeof window === 'undefined') {
    callback();
    return () => {};
  }
  const id = window.setTimeout(callback, delay);
  return () => window.clearTimeout(id);
}

function isValidClubId(clubId) {
  return (
    typeof clubId === 'string' &&
    UUID_RE.test(clubId) &&
    clubId !== NULL_CLUB_ID
  );
}

function isDocumentVisible() {
  return typeof document === 'undefined' || document.visibilityState === 'visible';
}

export default function SessionActivityPing({
  userId,
  profileClubId = null,
  anglerName = null,
}) {
  useEffect(() => {
    if (!userId) return;

    let disposed = false;
    let intervalId = null;

    const syncActivity = async () => {
      if (disposed || !isDocumentVisible()) return;

      const activeClubId = getActiveClubId();
      const clubId = profileClubId || activeClubId;
      if (!isValidClubId(clubId)) {
        console.warn('⚠️ user_activity übersprungen: ungültige club_id', {
          profileClubId,
          activeClubId,
        });
        return;
      }

      const payload = {
        user_id: userId,
        angler_name: anglerName || null,
        last_active: new Date().toISOString(),
        club_id: clubId,
      };

      try {
        const { data: updatedRows, error: updateError } = await supabase
          .from('user_activity')
          .update({
            angler_name: payload.angler_name,
            last_active: payload.last_active,
          })
          .eq('user_id', userId)
          .eq('club_id', clubId)
          .select('user_id')
          .limit(1);

        if (updateError) throw updateError;
        if (!Array.isArray(updatedRows) || updatedRows.length === 0) {
          const { error: insertError } = await supabase.from('user_activity').insert(payload);
          if (insertError) throw insertError;
        }
      } catch (err) {
        console.warn('⚠️ user_activity konnte nicht aktualisiert werden:', err?.message || err);
      }
    };

    const startInterval = () => {
      if (typeof window === 'undefined') return;
      if (intervalId != null) {
        window.clearInterval(intervalId);
      }
      intervalId = window.setInterval(() => {
        void syncActivity();
      }, ACTIVITY_REFRESH_INTERVAL_MS);
    };

    const cancelInitial = scheduleLater(() => {
      void syncActivity();
    });
    startInterval();

    const onVisibilityChange = () => {
      if (!isDocumentVisible()) return;
      void syncActivity();
      startInterval();
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityChange);
    }

    return () => {
      disposed = true;
      cancelInitial?.();
      if (intervalId != null && typeof window !== 'undefined') {
        window.clearInterval(intervalId);
      }
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibilityChange);
      }
    };
  }, [anglerName, profileClubId, userId]);

  return null;
}

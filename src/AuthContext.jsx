import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from './supabaseClient';
import { getActiveClubId } from './utils/clubId';
import { useAppResumeTick } from '@/hooks/useAppResumeTick';
import { withTimeout } from '@/utils/async';
import { debugLog } from '@/utils/runtimeDebug';

const AuthContext = createContext();
const AUTH_RESUME_TIMEOUT_MS = 2500;
const PROFILE_TIMEOUT_MS = 10000;

function isDocumentVisible() {
  return typeof document === 'undefined' || document.visibilityState === 'visible';
}

export const AuthProvider = ({ children }) => {
  const resumeTick = useAppResumeTick({ enabled: true });
  const [user, setUser] = useState(undefined); // undefined = Auth wird geladen
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const userId = user?.id ?? null;
  const authStillLoading = user === undefined;

  useEffect(() => {
    let mounted = true;

    const loadSession = async () => {
      try {
        const {
          data: { session },
        } = await withTimeout(supabase.auth.getSession(), 10000, 'Auth-Session timeout');
        if (mounted) {
          setUser((prev) => {
            const nextUser = session?.user ?? null;
            const prevId = prev?.id ?? null;
            const nextId = nextUser?.id ?? null;
            return prevId === nextId ? prev : nextUser;
          });
        }
      } catch (error) {
        if (mounted) {
          console.warn('⚠️ Session konnte nicht geladen werden:', error?.message || error);
          setUser(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadSession();

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      debugLog('auth:on-state-change', {
        event: _event,
        hasSession: Boolean(session),
        userId: session?.user?.id || null,
      });
      setUser((prev) => {
        const nextUser = session?.user ?? null;
        const prevId = prev?.id ?? null;
        const nextId = nextUser?.id ?? null;
        return prevId === nextId ? prev : nextUser;
      });
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (resumeTick === 0) return;
    let active = true;

    const syncSessionOnResume = async () => {
      if (!isDocumentVisible()) {
        debugLog('auth:resume-sync-skip-hidden', { resumeTick });
        return;
      }
      if (userId) {
        debugLog('auth:resume-sync-skip-user-present', { resumeTick, userId });
        return;
      }
      debugLog('auth:resume-sync-start', { resumeTick });
      try {
        const { data, error } = await withTimeout(
          supabase.auth.getSession(),
          AUTH_RESUME_TIMEOUT_MS,
          'Auth-Session-Resume timeout'
        );
        if (error) throw error;
        if (!active || !isDocumentVisible()) return;
        const existingUser = data?.session?.user ?? null;
        debugLog('auth:resume-session-ok', { userId: existingUser?.id || null });
        if (existingUser) {
          setUser((prev) => (prev?.id === existingUser.id ? prev : existingUser));
        }
      } catch (error) {
        if (!active) return;
        if (!isDocumentVisible()) {
          debugLog('auth:resume-session-failed-hidden', {
            message: error?.message || String(error || ''),
          });
          return;
        }
        console.warn('⚠️ Session-Resume fehlgeschlagen:', error?.message || error);
        debugLog('auth:resume-session-failed', {
          message: error?.message || String(error || ''),
        });
      }
    };

    void syncSessionOnResume();
    return () => {
      active = false;
    };
  }, [resumeTick, userId]);

  useEffect(() => {
    let active = true;

    const loadProfile = async () => {
      if (authStillLoading) {
        setProfile(null);
        setProfileLoading(true);
        return;
      }
      if (!userId) {
        setProfile(null);
        setProfileLoading(false);
        return;
      }

      if (!isDocumentVisible()) {
        debugLog('auth:profile-load-skip-hidden', { userId, resumeTick });
        return;
      }

      setProfileLoading(true);
      try {
        const clubId = getActiveClubId();
        debugLog('auth:profile-load-start', {
          userId,
          clubId,
          resumeTick,
        });
        const { data, error } = await withTimeout(
          supabase
            .from('profiles')
            .select('id, name, role, club_id')
            .eq('id', userId)
            .eq('club_id', clubId)
            .maybeSingle(),
          PROFILE_TIMEOUT_MS,
          'Profile-Request timeout'
        );

        if (!active || !isDocumentVisible()) return;
        if (error) {
          console.warn('⚠️ Profil konnte nicht geladen werden:', error.message || error);
          debugLog('auth:profile-load-error', {
            userId,
            clubId,
            message: error?.message || String(error || ''),
          });
          // Bei transienten Fehlern bestehendes Profil behalten.
          setProfile((prev) => prev);
        } else {
          debugLog('auth:profile-load-ok', {
            userId,
            clubId,
            profileClubId: data?.club_id || null,
          });
          setProfile((prev) => data || prev || null);
        }
      } catch (err) {
        if (!active) return;
        if (!isDocumentVisible()) {
          debugLog('auth:profile-load-exception-hidden', {
            userId,
            message: err?.message || String(err || ''),
          });
          return;
        }
        console.warn('⚠️ Profil-Ladevorgang abgebrochen:', err?.message || err);
        debugLog('auth:profile-load-exception', {
          userId,
          message: err?.message || String(err || ''),
        });
        // Bei Resume-Fehlern altes Profil nicht löschen.
        setProfile((prev) => prev);
      } finally {
        if (active) setProfileLoading(false);
      }
    };

    loadProfile();
    return () => { active = false; };
  }, [authStillLoading, userId, resumeTick]);

  const value = useMemo(
    () => ({ user, setUser, loading, profile, profileLoading }),
    [user, loading, profile, profileLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
// eslint-disable-next-line react-refresh/only-export-components
export const useUserProfile = () => {
  const ctx = useContext(AuthContext);
  return { profile: ctx.profile, profileLoading: ctx.profileLoading };
};

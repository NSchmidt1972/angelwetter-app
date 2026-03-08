import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from './supabaseClient';
import { getActiveClubId } from './utils/clubId';
import { useAppResumeTick } from '@/hooks/useAppResumeSync';
import { withTimeout } from '@/utils/async';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const resumeTick = useAppResumeTick({ enabled: true });
  const [user, setUser] = useState(undefined); // undefined = Auth wird geladen
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadSession = async () => {
      try {
        const {
          data: { session },
        } = await withTimeout(supabase.auth.getSession(), 10000, 'Auth-Session timeout');
        if (mounted) {
          setUser(session?.user ?? null);
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
      setUser(session?.user ?? null);
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
      try {
        const {
          data: { session },
        } = await withTimeout(
          supabase.auth.getSession(),
          8000,
          'Auth-Session-Resume timeout'
        );
        if (!active) return;
        setUser(session?.user ?? null);
      } catch (error) {
        if (!active) return;
        console.warn('⚠️ Session-Resume fehlgeschlagen:', error?.message || error);
      }
    };

    void syncSessionOnResume();
    return () => {
      active = false;
    };
  }, [resumeTick]);

  useEffect(() => {
    let active = true;

    const loadProfile = async () => {
      if (user === undefined) {
        setProfile(null);
        setProfileLoading(true);
        return;
      }
      if (!user) {
        setProfile(null);
        setProfileLoading(false);
        return;
      }

      setProfileLoading(true);
      try {
        const clubId = getActiveClubId();
        const { data, error } = await withTimeout(
          supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .eq('club_id', clubId)
            .maybeSingle(),
          10000,
          'Profile-Request timeout'
        );

        if (!active) return;
        if (error) {
          console.warn('⚠️ Profil konnte nicht geladen werden:', error.message || error);
          setProfile(null);
        } else {
          setProfile(data || null);
        }
      } catch (err) {
        if (!active) return;
        console.warn('⚠️ Profil-Ladevorgang abgebrochen:', err?.message || err);
        setProfile(null);
      } finally {
        if (active) setProfileLoading(false);
      }
    };

    loadProfile();
    return () => { active = false; };
  }, [user, resumeTick]);

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

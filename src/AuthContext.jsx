import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from './supabaseClient';
import { getActiveClubId } from './utils/clubId';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(undefined); // undefined = Auth wird geladen
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (mounted) {
        setUser(session?.user ?? null);
        setLoading(false);
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
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .eq('club_id', clubId)
          .maybeSingle();

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
  }, [user]);

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

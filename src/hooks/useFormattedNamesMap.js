import { useEffect, useState } from 'react';
import { supabase } from '@/supabaseClient';
import { getActiveClubId } from '@/utils/clubId';
import { useAppResumeTick } from '@/hooks/useAppResumeSync';

export function useFormattedNamesMap() {
  const resumeTick = useAppResumeTick({ enabled: true });
  const [formattedNamesMap, setFormattedNamesMap] = useState({});

  useEffect(() => {
    let active = true;

    async function loadFormattedNames() {
      const clubId = getActiveClubId();
      const { data, error } = await supabase
        .from('profiles')
        .select('name')
        .eq('club_id', clubId);

      if (!active) return;

      if (error) {
        console.error('Fehler beim Laden der Profile:', error);
        return;
      }

      const mapping = {};
      (data || []).forEach((profile) => {
        const fullName = (profile?.name || '').trim();
        if (fullName) mapping[fullName] = fullName;
      });
      setFormattedNamesMap(mapping);
    }

    void loadFormattedNames();
    return () => {
      active = false;
    };
  }, [resumeTick]);

  return formattedNamesMap;
}

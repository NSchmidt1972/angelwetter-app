import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/supabaseClient';

export default function SuperAdmin() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [clubs, setClubs] = useState([]);
  const [memberships, setMemberships] = useState([]);
  const [fishes, setFishes] = useState([]);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const [{ data: clubData, error: clubErr }, { data: msData, error: msErr }, { data: fishData, error: fishErr }] =
          await Promise.all([
            supabase.from('clubs').select('id, name, slug, host').order('name', { ascending: true }),
            supabase.from('memberships').select('user_id, club_id, role, is_active'),
            supabase.from('fishes').select('id, club_id'),
          ]);

        if (clubErr) throw clubErr;
        if (msErr) throw msErr;
        if (fishErr) throw fishErr;

        if (!active) return;
        setClubs(clubData || []);
        setMemberships(msData || []);
        setFishes(fishData || []);
      } catch (e) {
        console.error('[SuperAdmin] load error:', e);
        if (!active) return;
        setError(e?.message || String(e));
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  const stats = useMemo(() => {
    const memberCount = memberships.reduce((acc, m) => {
      const cid = m.club_id;
      acc[cid] = (acc[cid] || 0) + 1;
      return acc;
    }, {});
    const activeMemberCount = memberships.reduce((acc, m) => {
      if (!m.is_active) return acc;
      const cid = m.club_id;
      acc[cid] = (acc[cid] || 0) + 1;
      return acc;
    }, {});
    const fishCount = fishes.reduce((acc, f) => {
      const cid = f.club_id;
      acc[cid] = (acc[cid] || 0) + 1;
      return acc;
    }, {});
    return { memberCount, activeMemberCount, fishCount };
  }, [memberships, fishes]);

  if (loading) {
    return <div className="p-6">Lade Superadmin-Daten…</div>;
  }
  if (error) {
    return <div className="p-6 text-red-600">Fehler: {error}</div>;
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold text-blue-700">Superadmin Übersicht</h1>
      <p className="text-gray-600">Clubs, Mitgliederzahlen, Fänge (club_id-basiert).</p>
      <div className="grid md:grid-cols-2 gap-4">
        {clubs.map((club) => {
          const cid = club.id;
          const totalMembers = stats.memberCount[cid] || 0;
          const activeMembers = stats.activeMemberCount[cid] || 0;
          const fishTotal = stats.fishCount[cid] || 0;
          return (
            <div key={cid} className="border rounded-lg p-4 shadow-sm bg-white">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">{club.name}</h2>
                  <div className="text-sm text-gray-500">Slug: {club.slug} | Host: {club.host || '—'}</div>
                </div>
                <div className="text-xs text-gray-500">{cid}</div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="bg-blue-50 border border-blue-100 rounded p-2 text-center">
                  <div className="text-xs text-gray-500">Mitglieder</div>
                  <div className="text-lg font-semibold text-blue-700">{totalMembers}</div>
                </div>
                <div className="bg-green-50 border border-green-100 rounded p-2 text-center">
                  <div className="text-xs text-gray-500">Aktiv</div>
                  <div className="text-lg font-semibold text-green-700">{activeMembers}</div>
                </div>
                <div className="bg-indigo-50 border border-indigo-100 rounded p-2 text-center">
                  <div className="text-xs text-gray-500">Fänge</div>
                  <div className="text-lg font-semibold text-indigo-700">{fishTotal}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

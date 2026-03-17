import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/supabaseClient';
import { Card } from '@/components/ui';
import BuildUpdatePanel from '@/apps/superadmin/components/BuildUpdatePanel';
import { isMissingClubLogoUrlError } from '@/apps/superadmin/features/clubs/utils/clubSchemaCompat';

export default function OverviewPage() {
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
        const clubsPromise = (async () => {
          const withLogo = await supabase
            .from('clubs')
            .select('id, name, slug, host, logo_url')
            .order('name', { ascending: true });
          if (!withLogo.error) {
            return withLogo.data || [];
          }

          if (!isMissingClubLogoUrlError(withLogo.error)) {
            throw withLogo.error;
          }

          const fallback = await supabase
            .from('clubs')
            .select('id, name, slug, host')
            .order('name', { ascending: true });
          if (fallback.error) throw fallback.error;
          return (fallback.data || []).map((club) => ({ ...club, logo_url: null }));
        })();

        const [clubData, { data: msData, error: msErr }, { data: fishData, error: fishErr }] =
          await Promise.all([
            clubsPromise,
            supabase.from('memberships').select('user_id, club_id, role, is_active'),
            supabase.from('fishes').select('id, club_id'),
          ]);

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
    return <Card className="p-4 sm:p-6">Lade Superadmin-Daten…</Card>;
  }
  if (error) {
    return <Card className="p-4 text-red-600 sm:p-6">Fehler: {error}</Card>;
  }

  return (
    <Card className="space-y-4 p-4 sm:p-6">
      <h1 className="text-2xl font-bold text-blue-700">Superadmin Übersicht</h1>
      <BuildUpdatePanel />
      <p className="text-gray-600">Clubs, Mitgliederzahlen, Fänge (club_id-basiert).</p>
      <div>
        <Link
          to="/superadmin/clubs"
          className="inline-flex rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Clubs verwalten
        </Link>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {clubs.map((club) => {
          const cid = club.id;
          const logoUrl = String(club.logo_url || '').trim();
          const totalMembers = stats.memberCount[cid] || 0;
          const activeMembers = stats.activeMemberCount[cid] || 0;
          const fishTotal = stats.fishCount[cid] || 0;
          return (
            <Link
              key={cid}
              to={`/superadmin/clubs/${cid}`}
              className="block min-w-0 rounded-lg border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="mb-2 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-gray-200 bg-white">
                    {logoUrl ? (
                      <img
                        src={logoUrl}
                        alt={`${club.name || 'Club'} Logo`}
                        className="h-full w-full object-cover"
                        loading="lazy"
                        onError={(event) => {
                          event.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0">
                    <h2 className="break-words text-lg font-semibold text-gray-800">{club.name}</h2>
                    <div className="break-all text-sm text-gray-500 sm:truncate">Slug: {club.slug} | Host: {club.host || '—'}</div>
                  </div>
                </div>
                <div className="break-all text-[11px] leading-tight text-gray-500 sm:text-right sm:text-xs">{cid}</div>
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
            </Link>
          );
        })}
      </div>
    </Card>
  );
}

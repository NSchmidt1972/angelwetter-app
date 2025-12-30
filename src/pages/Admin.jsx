import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchProfiles, fetchWhitelist, fetchFishAggregates } from '@/services/boardService';

export default function Admin() {
  const navigate = useNavigate();

  const [whitelistCount, setWhitelistCount] = useState(null);
  const [whitelistLoading, setWhitelistLoading] = useState(false);
  const [profilesCount, setProfilesCount] = useState(null);
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [fishCount, setFishCount] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const profiles = await fetchProfiles();
        setProfilesCount(Array.isArray(profiles) ? profiles.length : 0);
      } catch (error) {
        console.warn('Profile konnten nicht geladen werden.', error);
        setProfilesCount(0);
      }

      try {
        const whitelist = await fetchWhitelist();
        setWhitelistCount(Array.isArray(whitelist) ? whitelist.length : 0);
      } catch (error) {
        console.warn('Whitelist konnte nicht geladen werden.', error);
        setWhitelistCount(0);
      }

      try {
        const fishes = await fetchFishAggregates();
        setFishCount(Array.isArray(fishes) ? fishes.length : 0);
      } catch (error) {
        console.warn('Fischdaten konnten nicht geladen werden.', error);
        setFishCount(0);
      }
    };
    load();
  }, []);

  return (
    <div className="space-y-8">
      <section className="grid gap-6 md:grid-cols-2">
        <button
          type="button"
          onClick={() => navigate('/admin/members')}
          className="rounded-xl bg-white p-6 text-left shadow-sm shadow-gray-200 transition hover:-translate-y-0.5 hover:shadow-md dark:bg-gray-900 dark:shadow-black/20"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-gray-500">MITGLIEDERVERWALTUNG</p>
          <h1 className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">Zugänge & Rollen</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            Rollen bearbeiten, Accounts aktivieren/deaktivieren, neue Mitglieder anlegen.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-sm text-gray-700 dark:text-gray-200">
            <span className="rounded-full bg-gray-100 px-3 py-1 dark:bg-gray-800">
              Mitglieder: {profilesLoading ? '…' : profilesCount}
            </span>
            <span className="rounded-full bg-gray-100 px-3 py-1 dark:bg-gray-800">
              Whitelist: {whitelistLoading ? '…' : whitelistCount}
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => navigate('/admin/verein')}
          className="rounded-xl bg-white p-6 text-left shadow-sm shadow-gray-200 transition hover:-translate-y-0.5 hover:shadow-md dark:bg-gray-900 dark:shadow-black/20"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-gray-500">VEREINSADMINISTRATION</p>
          <h2 className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">Verein & App</h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            Name, Logo, Theme und Module der App verwalten.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-sm text-gray-700 dark:text-gray-200">
            <span className="rounded-full bg-gray-100 px-3 py-1 dark:bg-gray-800">
              Fänge: {fishCount == null ? '…' : fishCount}
            </span>
            <span className="rounded-full bg-gray-100 px-3 py-1 dark:bg-gray-800">Einstellungen</span>
          </div>
        </button>
      </section>
    </div>
  );
}

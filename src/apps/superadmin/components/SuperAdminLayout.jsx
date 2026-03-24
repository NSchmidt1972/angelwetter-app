import { useCallback, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { SuperAdminHeaderTitleContext } from '@/apps/superadmin/context/headerTitleContext';

const navLinkBaseClass =
  'rounded-full px-3 py-2 text-sm font-semibold transition';

function navLinkClassName({ isActive }) {
  if (isActive) {
    return `${navLinkBaseClass} bg-blue-600 text-white shadow-sm shadow-blue-900/20`;
  }
  return `${navLinkBaseClass} text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800`;
}

export default function SuperAdminLayout() {
  const [headerTitle, setHeaderTitle] = useState('Superadmin');
  const setHeaderTitleSafe = useCallback((nextTitle) => {
    const normalizedTitle = String(nextTitle || '').trim();
    setHeaderTitle(normalizedTitle || 'Superadmin');
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-50">
      <header className="border-b border-gray-200/80 bg-white/90 shadow-sm backdrop-blur dark:border-gray-800 dark:bg-gray-900/90">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-3 py-4 sm:px-4">
          <div className="text-2xl font-bold leading-none text-blue-700 dark:text-blue-300">{headerTitle}</div>
          <nav className="flex flex-wrap items-center gap-2">
            <NavLink to="/superadmin" end className={navLinkClassName}>
              Übersicht
            </NavLink>
            <NavLink
              to="/superadmin/clubs"
              className={navLinkClassName}
            >
              + Club
            </NavLink>
            <NavLink to="/superadmin/regions" className={navLinkClassName}>
              Regionen
            </NavLink>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-4 sm:py-6">
        <SuperAdminHeaderTitleContext.Provider value={setHeaderTitleSafe}>
          <Outlet />
        </SuperAdminHeaderTitleContext.Provider>
      </main>
    </div>
  );
}

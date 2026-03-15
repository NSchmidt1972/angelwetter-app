import { lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { usePermissions } from '@/permissions/usePermissions';
import { supabase } from '@/supabaseClient';

const OverviewPage = lazy(() => import('@/apps/superadmin/pages/OverviewPage'));
const ClubsPage = lazy(() => import('@/apps/superadmin/features/clubs/pages/ClubsPage'));
const ClubDetailPage = lazy(() => import('@/apps/superadmin/features/clubs/pages/ClubDetailPage'));

function RequireSuperAdmin({ children }) {
  const { loading, error, isSuperAdmin } = usePermissions();

  if (loading) return <div className="p-6 text-center">Berechtigungen werden geladen...</div>;
  if (error) return <div className="p-6 text-center text-red-600">Berechtigungsfehler: {error}</div>;
  if (!isSuperAdmin) {
    return (
      <div className="mx-auto mt-16 max-w-xl rounded border border-red-200 bg-white p-6 text-center text-red-700 shadow-sm dark:border-red-900/60 dark:bg-gray-900 dark:text-red-300">
        <p className="font-semibold">Kein Zugriff. Nur für Superadmins.</p>
        <button
          type="button"
          onClick={() => supabase.auth.signOut()}
          className="mt-4 rounded bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
        >
          Abmelden
        </button>
      </div>
    );
  }

  return children;
}

export default function ControlPlaneRoutes() {
  return (
    <RequireSuperAdmin>
      <Routes>
        <Route index element={<OverviewPage />} />
        <Route path="clubs" element={<ClubsPage />} />
        <Route path="clubs/:clubId" element={<ClubDetailPage />} />
        <Route path="*" element={<Navigate to="/superadmin" replace />} />
      </Routes>
    </RequireSuperAdmin>
  );
}

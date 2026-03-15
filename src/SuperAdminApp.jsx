import { Suspense } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '@/AuthContext';
import { PermissionProvider } from '@/permissions/PermissionContext';
import ControlPlaneRoutes from '@/routes/ControlPlaneRoutes';

function LoginHint() {
  return (
    <div className="mx-auto mt-16 max-w-xl rounded border border-gray-200 bg-white p-6 text-gray-900 shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100">
      <h1 className="text-xl font-semibold">Superadmin Zugriff</h1>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
        Bitte zuerst mit einem Superadmin-Account anmelden. Danach diese Seite neu laden.
      </p>
    </div>
  );
}

function SuperAdminShell() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="p-6 text-center">Authentifizierung wird geladen...</div>;
  }

  if (!user) {
    return <LoginHint />;
  }

  return (
    <PermissionProvider>
      <Suspense fallback={<div className="p-6 text-center">Lädt...</div>}>
        <Routes>
          <Route path="/" element={<Navigate to="/superadmin" replace />} />
          <Route path="/superadmin/*" element={<ControlPlaneRoutes />} />
          <Route path="*" element={<Navigate to="/superadmin" replace />} />
        </Routes>
      </Suspense>
    </PermissionProvider>
  );
}

export default function SuperAdminApp() {
  return (
    <HashRouter>
      <SuperAdminShell />
    </HashRouter>
  );
}

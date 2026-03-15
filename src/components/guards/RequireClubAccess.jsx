import { Outlet } from 'react-router-dom';
import { usePermissions } from '@/permissions/usePermissions';

function DefaultLoading() {
  return <div className="p-6 text-center">Berechtigungen werden geladen...</div>;
}

function DefaultDenied() {
  return <div className="p-6 text-center text-red-600">Kein Zugriff auf diesen Verein.</div>;
}

function DefaultError({ message }) {
  return <div className="p-6 text-center text-red-600">Berechtigungsfehler: {message}</div>;
}

export default function RequireClubAccess({
  children,
  loadingFallback = <DefaultLoading />,
  deniedFallback = <DefaultDenied />,
  errorFallback,
}) {
  const { loading, error, isSuperAdmin, currentClub, membership } = usePermissions();

  if (loading) return loadingFallback;
  if (error) return errorFallback || <DefaultError message={error} />;

  const hasAccess = Boolean(currentClub?.id) && (Boolean(membership) || isSuperAdmin);
  if (!hasAccess) return deniedFallback;

  return children || <Outlet />;
}


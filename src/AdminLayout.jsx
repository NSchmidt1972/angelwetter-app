import { Outlet, useLocation, useNavigate } from 'react-router-dom';

const navLinks = [
  { path: '/admin', label: 'Administration' },
  { path: '/admin/members', label: 'Mitgliederverwaltung' },
  { path: '/admin/verein', label: 'Verein & App' },
];

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-50">
      <header className="bg-white/90 dark:bg-gray-900/90 backdrop-blur shadow-sm border-b border-gray-200/80 dark:border-gray-800">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-700 transition hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            ← Zur App
          </button>
          <nav className="flex items-center gap-2 text-sm">
            {navLinks.map((link) => {
              const active = location.pathname === link.path;
              return (
                <button
                  key={link.path}
                  type="button"
                  onClick={() => navigate(link.path)}
                  className={`rounded-full px-3 py-2 font-semibold transition ${
                    active
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/20'
                      : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800'
                  }`}
                >
                  {link.label}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}

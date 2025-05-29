import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/AuthContext';
import { supabase } from '@/supabaseClient';

export default function Navbar({ name, isAdmin }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const stored = localStorage.getItem('darkMode') === 'true';
    setDarkMode(stored);
    document.documentElement.classList.toggle('dark', stored);
  }, []);

  const toggleDark = () => {
    const newValue = !darkMode;
    setDarkMode(newValue);
    localStorage.setItem('darkMode', newValue);
    document.documentElement.classList.toggle('dark', newValue);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/', { replace: true });
  };

  const navItems = [
    { label: 'Start', path: '/' },
    { label: 'Neuer Fang', path: '/new-catch' },
    { label: 'Fangliste', path: '/catches' },
    {
      label: 'Statistik',
      children: [
        { label: 'Analyse', path: '/analysis' },
        { label: 'Rangliste', path: '/leaderboard' },
        { label: 'Top 10', path: '/top-fishes' }
      ]
    },
    { label: 'Prognose', path: '/forecast' },
    ...(isAdmin ? [{ label: '🔧 Admin', path: '/admin' }] : [])
  ];

  if (!user) return null;

  const displayName = (() => {
    const [first] = name.split(' ');
    const shortName = localStorage.getItem('shortAnglerName');
    return shortName || first;
  })();

  return (
    <header className="bg-white dark:bg-gray-900 shadow-md sticky top-0 z-50 text-black dark:text-white">
      <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
        {/* Navigation */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setOpen(!open)}
            className="md:hidden text-3xl p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
            aria-label="Menü öffnen"
          >
            ☰
          </button>

          <nav className={`flex-col md:flex md:flex-row md:gap-6 ${open ? 'flex' : 'hidden'} md:items-center`}>
            {navItems.map((item) =>
              item.children ? (
                <div key={item.label} className="relative">
                  <button
                    onClick={() => setOpenDropdown(prev => !prev)}
                    className="block px-2 py-1 rounded hover:bg-blue-100 dark:hover:bg-gray-700 font-medium"
                  >
                    {item.label} ▾
                  </button>

                  {openDropdown && (
                    <div className="absolute left-0 mt-2 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded shadow-lg z-50">
                      {item.children.map((child) => (
                        <Link
                          key={child.path}
                          to={child.path}
                          className={`block px-4 py-2 text-sm hover:bg-blue-50 dark:hover:bg-gray-700 ${location.pathname === child.path
                              ? 'font-bold text-blue-700 dark:text-blue-300'
                              : 'text-gray-800 dark:text-gray-100'
                            }`}
                          onClick={() => {
                            setOpen(false);
                            setOpenDropdown(false);
                          }}
                        >
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`block px-2 py-1 rounded hover:bg-blue-100 dark:hover:bg-gray-700 ${location.pathname === item.path
                      ? 'font-bold text-blue-700 dark:text-blue-300'
                      : ''
                    }`}
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </Link>
              )
            )}
          </nav>
        </div>

        {/* Benutzer + Darkmode + Logout */}
        <div className="flex items-center gap-3 text-sm">
          <button
            onClick={toggleDark}
            className="text-sm hover:text-blue-600 dark:hover:text-blue-300"
          >
            {darkMode ? '☀️ Hell' : '🌙 Nachtangeln'}
          </button>
          <span>👤 {displayName}</span>
          <button
            onClick={handleLogout}
            className="text-red-600 hover:underline"
          >
            Abmelden
          </button>
        </div>

      </div>
    </header>
  );
}

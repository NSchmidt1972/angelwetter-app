import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/AuthContext';
import { supabase } from '@/supabaseClient';

export default function Navbar({ name, isAdmin }) {
  const { user, setUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const dropdownRef = useRef();

  useEffect(() => {
    const stored = localStorage.getItem('darkMode') === 'true';
    setDarkMode(stored);
    document.documentElement.classList.toggle('dark', stored);
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleDark = () => {
    const newValue = !darkMode;
    setDarkMode(newValue);
    localStorage.setItem('darkMode', newValue);
    document.documentElement.classList.toggle('dark', newValue);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('anglerName');
    localStorage.removeItem('shortAnglerName');
    setUser(null);
    navigate('/');
  };

  const navItems = [
    { label: 'Wetter', path: '/' },
    { label: '➕ 🎣', path: '/new-catch' },
    { label: 'Fangliste', path: '/catches' },
    { label: 'Rangliste', path: '/leaderboard' },
    {
      label: 'Statistik',
      children: [
        { label: 'Analyse', path: '/analysis' },
        { label: 'Top 10', path: '/top-fishes' },
        { label: 'Prognose', path: '/forecast' },
        { label: 'Kalender', path: '/calendar' },
        { label: 'Karte', path: '/map' }
      ]
    },
    ...(isAdmin ? [
      { label: '🔧 Admin', path: '/admin' },
    ] : [])
  ];

  if (!user) return null;

  const displayName = (() => {
    const [first] = name.split(' ');
    const shortName = localStorage.getItem('shortAnglerName');
    return shortName || first;
  })();

  return (
    <header className="bg-white dark:bg-gray-900 shadow-md sticky top-0 z-50 text-black dark:text-white">
      <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setOpen(!open)}
            className="md:hidden text-3xl p-3 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
            aria-label="Menü öffnen"
          >
            ☰
          </button>

          <nav className={`md:flex md:flex-row md:gap-6 ${open ? 'absolute top-full left-0 w-full bg-white dark:bg-gray-900 shadow-lg flex flex-col p-4 gap-4 z-40' : 'hidden'} md:items-center`}>
            {navItems.map((item) =>
              item.children ? (
                <div key={item.label} className="relative">
                  <button
                    onClick={() => setOpenDropdown(prev => !prev)}
                    className="block px-4 py-3 rounded text-lg font-medium hover:bg-blue-100 dark:hover:bg-gray-700"
                  >
                    {item.label} ▾
                  </button>
                  {openDropdown && (
                    <div className="absolute left-0 mt-2 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded shadow-lg z-50 text-base">
                      {item.children.map((child) => (
                        <Link
                          key={child.path}
                          to={child.path}
                          className={`block px-5 py-3 hover:bg-blue-50 dark:hover:bg-gray-700 rounded ${location.pathname === child.path
                            ? 'font-bold text-blue-700 dark:text-blue-300'
                            : 'text-gray-800 dark:text-gray-100'}`}
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
                  className={`block px-4 py-3 rounded text-lg hover:bg-blue-100 dark:hover:bg-gray-700 ${location.pathname === item.path
                    ? 'font-bold text-blue-700 dark:text-blue-300'
                    : ''}`}
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </Link>
              )
            )}
          </nav>
        </div>

        <div className="flex items-center gap-4 text-base relative" ref={dropdownRef}>
          <button
            onClick={toggleDark}
            className="px-3 py-2 rounded hover:text-blue-600 dark:hover:text-blue-300"
          >
            {darkMode ? '☀️ Tageslicht' : '🌙 Nachtangeln'}
          </button>

          <button
            onClick={() => setShowMenu(prev => !prev)}
            className="px-3 py-2 rounded hover:underline"
          >
            👤 {displayName}
          </button>

          {showMenu && (
  <div className="absolute right-0 top-12 w-44 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded shadow-lg z-50 text-base">
    <Link
      to="/settings"
      className="block w-full text-left px-4 py-3 text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-gray-700"
      onClick={() => setShowMenu(false)}
    >
      ⚙️ Einstellungen
    </Link>
   
    <button
      onClick={handleLogout}
      className="block w-full text-left px-4 py-3 text-red-600 hover:bg-red-50 dark:hover:bg-gray-700"
    >
      Abmelden
    </button>
  </div>
)}

        </div>
      </div>
    </header>
  );
}

import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/AuthContext';
import { supabase } from '@/supabaseClient';

export default function Navbar({ name }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false); // gesamtes Menü (mobil)
  const [openDropdown, setOpenDropdown] = useState(false); // Dropdown unter Statistik
  const location = useLocation();
  const navigate = useNavigate();

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
    { label: 'Prognose', path: '/forecast' }
  ];

  if (!user) return null;

  return (
    <header className="bg-white shadow-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
        {/* Navigation */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setOpen(!open)}
            className="md:hidden text-gray-700 text-3xl p-2 rounded hover:bg-gray-200"
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
                    className="block px-2 py-1 rounded hover:bg-blue-100 font-medium text-gray-700"
                  >
                    {item.label} ▾
                  </button>

                  {openDropdown && (
                    <div className="absolute left-0 mt-2 w-48 bg-white border border-gray-200 rounded shadow-lg z-50">
                      {item.children.map((child) => (
                        <Link
                          key={child.path}
                          to={child.path}
                          className={`block px-4 py-2 text-sm hover:bg-blue-50 ${
                            location.pathname === child.path ? 'font-bold text-blue-700' : 'text-gray-800'
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
                  className={`block px-2 py-1 rounded hover:bg-blue-100 ${
                    location.pathname === item.path ? 'font-bold text-blue-700' : ''
                  }`}
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </Link>
              )
            )}
          </nav>
        </div>

        {/* Benutzer + Logout */}
        <div className="flex items-center gap-3 text-sm">
          <span className="text-gray-600">👤 {name}</span>
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

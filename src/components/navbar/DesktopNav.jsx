// src/components/navbar/DesktopNav.jsx
import { Link } from 'react-router-dom';
import NavLink from '@/components/NavLink';

export default function DesktopNav({
  navItems,
  currentPath,
  openDropdown,
  onToggleDropdown,
  statsBtnRef,
  statsMenuRef,
  menuPos,
}) {
  return (
    <nav className="flex flex-row gap-2 items-center" role="navigation">
      {navItems.map((item) =>
        item.children ? (
          <div key={item.label} className="relative inline-block">
            <button
              type="button"
              ref={statsBtnRef}
              onClick={() => onToggleDropdown()}
              className="block px-4 py-3 rounded text-lg font-medium hover:bg-blue-100 dark:hover:bg-gray-700"
            >
              {item.label} <span className="pointer-events-none select-none">▾</span>
            </button>

            {openDropdown && (
              <div
                ref={statsMenuRef}
                className="stats-dropdown fixed w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded shadow-lg z-[4000] text-base max-h-[60vh] overflow-y-auto overscroll-contain"
                style={{ left: menuPos.left, top: menuPos.top }}
              >
                {item.children.map((child) => (
                  <Link
                    key={child.path}
                    to={child.path}
                    className={`block px-5 py-3 hover:bg-blue-100 dark:hover:bg-gray-700 rounded ${
                      currentPath === child.path
                        ? "font-bold text-blue-700 dark:text-blue-300"
                        : "text-gray-800 dark:text-gray-100"
                    }`}
                    onClick={() => onToggleDropdown(false)}
                  >
                    {child.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        ) : (
          <NavLink key={item.path} item={item} />
        )
      )}
    </nav>
  );
}

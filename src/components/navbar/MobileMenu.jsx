// src/components/navbar/MobileMenu.jsx
import { Link } from 'react-router-dom';

export default function MobileMenu({
  navItems,
  currentPath,
  open,
  menuId,
  onClose,
  openDropdown,
  onToggleDropdown,
  statsMenuRef,
}) {
  if (!open) return null;

  return (
    <div
      id={menuId}
      className="fixed inset-0 z-[1300] bg-white/95 dark:bg-gray-900/95 pt-20 overflow-hidden"
      style={{ WebkitOverflowScrolling: "touch" }}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 text-3xl p-3 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
        aria-label="Menü schließen"
      >
        ✖️
      </button>

      <nav
        className="h-full overflow-y-auto overscroll-contain flex flex-col items-center justify-center text-center gap-4 px-2 pb-6 pb-[env(safe-area-inset-bottom)]"
        role="navigation"
      >
        {navItems.map((item) =>
          item.children ? (
            <div key={item.label} className="w-full max-w-sm relative">
              <button
                type="button"
                onClick={() => onToggleDropdown()}
                className="w-full px-4 py-3 rounded text-lg font-medium hover:bg-blue-100 dark:hover:bg-gray-700"
                aria-expanded={openDropdown}
                aria-haspopup="menu"
              >
                {item.label} <span className="pointer-events-none select-none">▾</span>
              </button>

              {openDropdown && (
                <div
                  ref={statsMenuRef}
                  className="mt-2 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded shadow-lg z-50 text-base max-h-[60vh] overflow-y-auto overscroll-contain"
                  role="menu"
                >
                  {item.children.map((child) => (
                    <Link
                      key={child.path}
                      to={child.path}
                      role="menuitem"
                      className={`block px-5 py-3 text-center hover:bg-blue-100 dark:hover:bg-gray-900 rounded ${
                        currentPath === child.path
                          ? "font-bold text-blue-700 dark:text-blue-300"
                          : "text-gray-800 dark:text-gray-100"
                      }`}
                      onClick={() => {
                        onClose();
                        onToggleDropdown(false);
                      }}
                    >
                      {child.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div key={item.path} className="w-full max-w-sm">
              <Link
                to={item.path}
                className="block px-4 py-3 rounded text-lg hover:bg-blue-100 dark:hover:bg-gray-700"
                onClick={onClose}
              >
                {item.label}
              </Link>
            </div>
          )
        )}
      </nav>
    </div>
  );
}

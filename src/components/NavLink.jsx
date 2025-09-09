import { Link, useLocation } from "react-router-dom";

export default function NavLink({ item, onClick }) {
  const location = useLocation();
  const isActive = location.pathname === item.path;
  return (
    <Link
      to={item.path}
      onClick={onClick}
      className={`block px-4 py-3 rounded text-lg hover:bg-blue-100 dark:hover:bg-gray-700 ${
        isActive ? "font-bold text-blue-700 dark:text-blue-300" : ""
      }`}
    >
      {item.label}
    </Link>
  );
}

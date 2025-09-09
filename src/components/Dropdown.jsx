export default function Dropdown({ style, className = "", children }) {
  return (
    <div
      className={`fixed w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded shadow-lg z-[4000] text-base max-h-[60vh] overflow-y-auto overscroll-contain ${className}`}
      style={style}
      role="menu"
    >
      {children}
    </div>
  );
}

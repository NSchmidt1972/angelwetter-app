// src/components/PageContainer.jsx
const BASE_CLASS = 'p-6 bg-gray-50 dark:bg-gray-900 min-h-screen text-gray-800 dark:text-gray-100';

export default function PageContainer({ className = '', children }) {
  const merged = className ? `${BASE_CLASS} ${className}` : BASE_CLASS;
  return <div className={merged}>{children}</div>;
}

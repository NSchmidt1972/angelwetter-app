export default function SkeletonCard() {
  return (
    <li className="p-5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 shadow-md animate-pulse">
      <div className="h-4 w-40 bg-gray-200 dark:bg-gray-700 rounded mb-3" />
      <div className="h-5 w-24 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
      <div className="h-6 w-full bg-gray-200 dark:bg-gray-700 rounded" />
    </li>
  );
}

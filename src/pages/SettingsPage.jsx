export default function SettingsPage() {
  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-gray-900 shadow-md rounded-xl text-gray-800 dark:text-gray-100 mt-10">
      <h2 className="text-2xl font-bold mb-6 text-blue-700 dark:text-blue-300 text-center">
        ⚙️ Einstellungen
      </h2>

      <div className="space-y-4">
        <p className="text-sm text-gray-700 dark:text-gray-300">
          Aktuell gibt es keine zusätzlichen Einstellungen. Downloads findest du im neuen Menüpunkt „Downloads“. Der Datenfilter liegt jetzt direkt im Profil-Menü (unter deinem Namen).
        </p>
      </div>
    </div>
  );
}

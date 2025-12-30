import { useState } from 'react';

const themes = [
  { key: 'light', label: 'Hell', desc: 'Helle Oberfläche mit Akzentfarbe' },
  { key: 'dark', label: 'Dunkel', desc: 'Dunkle Oberfläche, blendfrei' },
  { key: 'lake', label: 'Seegrün', desc: 'Wasserfarben, ruhige Akzente' },
  { key: 'forest', label: 'Wald', desc: 'Grün/Grau mit natürlichem Kontrast' },
];

const modules = [
  { key: 'forecast', label: 'Wetter/Forecast' },
  { key: 'map', label: 'Karte' },
  { key: 'leaderboard', label: 'Rangliste' },
  { key: 'fun', label: 'Fun-Facts' },
  { key: 'downloads', label: 'Downloads' },
  { key: 'notifications', label: 'Push-Benachrichtigungen' },
  { key: 'regulations', label: 'Regelwerk' },
];

export default function AdminVereinManage() {
  const [activeTheme, setActiveTheme] = useState('lake');
  const [activeModules, setActiveModules] = useState(new Set(['forecast', 'map', 'leaderboard', 'downloads', 'regulations']));

  const toggleModule = (key) => {
    setActiveModules((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="space-y-8">
      <header className="rounded-xl bg-white p-6 shadow-sm shadow-gray-200 dark:bg-gray-900 dark:shadow-black/20">
        <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Vereinsadministration</p>
        <h1 className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">Verein & App gestalten</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          Vereinstitel, Logo und Theme festlegen. Module und Funktionen aktivieren/deaktivieren. (Platzhalter – ohne Speicherung)
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <div className="rounded-xl bg-white p-6 shadow-sm shadow-gray-200 dark:bg-gray-900 dark:shadow-black/20 space-y-6">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Vereinsdaten</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">Name, Kurzbeschreibung, Logo.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-300">Vereinsname</label>
              <input
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-blue-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                placeholder="ASV Rotauge e.V."
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-300">Kurzbeschreibung</label>
              <textarea
                rows={3}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-blue-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                placeholder="Kurztext für Apps und Einladungen"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-300">Logo</label>
              <div className="flex items-center gap-3 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-3 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-white text-xs text-gray-400 dark:bg-gray-900">
                  1:1
                </div>
                <div>
                  <p className="font-medium text-gray-800 dark:text-white">Logo hochladen</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">PNG/SVG, quadratisch</p>
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-300">Akzentfarbe</label>
              <input
                type="color"
                defaultValue="#2a7f8f"
                className="h-10 w-full rounded-lg border border-gray-200 bg-white px-2 py-1 dark:border-gray-700 dark:bg-gray-800"
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-white p-6 shadow-sm shadow-gray-200 dark:bg-gray-900 dark:shadow-black/20 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Theme</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300">Wähle einen Look für die App.</p>
          <div className="space-y-3">
            {themes.map((theme) => (
              <label
                key={theme.key}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 text-sm transition ${
                  activeTheme === theme.key
                    ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/20'
                    : 'border-gray-200 bg-white hover:border-blue-200 dark:border-gray-700 dark:bg-gray-800'
                }`}
              >
                <input
                  type="radio"
                  name="theme"
                  value={theme.key}
                  checked={activeTheme === theme.key}
                  onChange={() => setActiveTheme(theme.key)}
                  className="mt-1 h-4 w-4"
                />
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">{theme.label}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-300">{theme.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-xl bg-white p-6 shadow-sm shadow-gray-200 dark:bg-gray-900 dark:shadow-black/20">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Module & Funktionen</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300">Welche Bereiche in der App sichtbar sind.</p>
          </div>
          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-200">
            {activeModules.size} aktiv
          </span>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {modules.map((mod) => {
            const enabled = activeModules.has(mod.key);
            return (
              <button
                key={mod.key}
                type="button"
                onClick={() => toggleModule(mod.key)}
                className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition ${
                  enabled
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:border-emerald-400 dark:bg-emerald-900/20 dark:text-emerald-100'
                    : 'border-gray-200 bg-white text-gray-800 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200'
                }`}
              >
                <span className="font-medium">{mod.label}</span>
                <span className={`text-xs font-semibold ${enabled ? 'text-emerald-700 dark:text-emerald-200' : 'text-gray-500 dark:text-gray-400'}`}>
                  {enabled ? 'AN' : 'AUS'}
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

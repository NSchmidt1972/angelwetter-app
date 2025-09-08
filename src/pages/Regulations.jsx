// src/pages/Regulations.jsx
import { useEffect, useMemo, useState } from "react";
import { fetchRules } from "../services/rulesService";

function formatGermanDate(input) {
  if (!input) return "—";
  const md = /^(\d{2})-(\d{2})$/.exec(input);
  if (md) {
    const [, mm, dd] = md;
    const date = new Date(2000, Number(mm) - 1, Number(dd));
    return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "long" }).format(date);
  }
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(input) ? new Date(input) : null;
  if (iso && !isNaN(iso)) {
    return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "long" }).format(iso);
  }
  return input;
}

function formatSeason(r) {
  if (r.protected) return "Ganzjährig geschützt";
  if (r.season_start && r.season_end) {
    return `${formatGermanDate(r.season_start)} – ${formatGermanDate(r.season_end)}`;
  }
  return "—";
}

export default function Regulations() {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = await fetchRules();
        setRules(Array.isArray(data) ? data : []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const sorted = useMemo(
    () => [...rules].sort((a, b) => a.species.localeCompare(b.species, "de")),
    [rules]
  );

  return (
    <div className="mx-auto max-w-5xl p-4 text-gray-800 dark:text-gray-100">
      <h1 className="text-2xl font-bold mb-2">📜 Regeln – Ferkensbruch</h1>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Diese Übersicht basiert auf den Vereinsregeln für den Ferkensbruch (über die
        Landesfischereiordnung hinausgehende Mindestmaße und Schonzeiten).
      </p>

      {/* Zusatz-Hinweise */}
      <div className="rounded-2xl border border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200 p-4 mb-6">
        <div className="font-semibold mb-1">Hinweise während der Schonzeiten:</div>
        <ul className="list-disc pl-5 text-sm space-y-1">
          <li>Angeln mit <b>totem Köderfisch</b> ist während der Hecht-/Zander-Schonzeit untersagt.</li>
          <li>Angeln mit <b>jeglichen Kunstködern</b> ist in dieser Zeit ebenfalls untersagt.</li>
        </ul>
      </div>

      {/* Haftungshinweis */}
      <div className="rounded-2xl border border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50 p-4 mb-6">
        <div className="font-semibold mb-1">Haftungshinweis des Vereins:</div>
        <p className="text-sm">
          Für strafrechtliche Folgen z.&nbsp;B. bei lebenden Köderfischen, falschem Setzkescher-Einsatz,
          Einsatz von Futterbooten/Drohnen oder falschem Lagern/Zelten/Baden haftet der Verein nicht.
        </p>
      </div>

      {/* Tabelle ohne „Hinweise“-Spalte */}
      <div className="overflow-x-auto rounded-2xl shadow">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100 dark:bg-gray-800">
            <tr>
              <th className="text-left p-3">Fisch</th>
              <th className="text-left p-3">Mindestmaß</th>
              <th className="text-left p-3">Schonzeit</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={3} className="p-4 text-center text-gray-500">Lade Regeln…</td>
              </tr>
            ) : sorted.length === 0 ? (
              <tr>
                <td colSpan={3} className="p-4 text-center text-gray-500">Keine Regeln gefunden.</td>
              </tr>
            ) : (
              sorted.map((r) => (
                <tr key={r.species} className="border-t dark:border-gray-700">
                  <td className="p-3 font-medium">{r.species}</td>
                  <td className="p-3">{r.min_size_cm != null ? `${r.min_size_cm} cm` : "—"}</td>
                  <td className="p-3">{formatSeason(r)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-500 mt-3">
        Quelle: Vereinsvorgaben Ferkensbruch (ergänzend zur Landesfischereiordnung).
      </p>
    </div>
  );
}

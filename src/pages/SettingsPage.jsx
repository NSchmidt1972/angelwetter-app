import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/supabaseClient';
import { createCatchPDF } from '@/utils/pdfExporter';

export default function SettingsPage() {
  const [dataFilter, setDataFilter] = useState('recent');
  const [anglerName, setAnglerName] = useState('');

  useEffect(() => {
    setAnglerName(localStorage.getItem('anglerName') || 'Unbekannt');
    const storedFilter = localStorage.getItem('dataFilter') || 'recent';
    setDataFilter(storedFilter);
  }, []);

  const toggleDataFilter = () => {
    const newValue = dataFilter === 'recent' ? 'all' : 'recent';
    setDataFilter(newValue);
    localStorage.setItem('dataFilter', newValue);
    alert(newValue === 'recent'
      ? 'Nur Daten ab 01.06.2025 werden verwendet.'
      : 'Alle Daten werden verwendet.');
    window.location.reload();
  };

  const isSpecialUser = anglerName === 'Nicol Schmidt';

  const exportCatches = async () => {
    const { data, error } = await supabase
      .from('fishes')
      .select('*')
      .eq('angler', anglerName);

    if (error) {
      alert('Fehler beim Laden der Fänge');
      console.error(error);
      return;
    }

    if (!data || data.length === 0) {
      alert('Keine Fänge zum Exportieren gefunden.');
      return;
    }

    const header = Object.keys(data[0]).join(',');
    const rows = data.map(row =>
      Object.values(row).map(val =>
        typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val
      ).join(',')
    );
    const csvStr = [header, ...rows].join('\n');
    downloadFile(csvStr, 'fänge.csv', 'text/csv');
  };

  const exportCatchesAsPDF = async () => {
    const { data, error } = await supabase
      .from('fishes')
      .select('fish, size, weight, timestamp')
      .eq('angler', anglerName)
      .eq('taken', true);

    if (error) {
      alert('Fehler beim Laden der Fänge');
      console.error(error);
      return;
    }

    try {
      const pdfBytes = await createCatchPDF(anglerName, data);
      downloadFile(pdfBytes, `entnahmeliste_${new Date().getFullYear()}.pdf`, 'application/pdf');
    } catch (err) {
      alert(err.message);
    }
  };

  const downloadFile = (content, fileName, mimeType) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-gray-900 shadow-md rounded-xl text-gray-800 dark:text-gray-100 mt-10">
      <h2 className="text-2xl font-bold mb-6 text-blue-700 dark:text-blue-300 text-center">
        ⚙️ Einstellungen
      </h2>

      <div className="space-y-4">
        {isSpecialUser && (
          <>
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-2">📅 Datenfilter</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={dataFilter === 'all'}
                  onChange={toggleDataFilter}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer dark:bg-gray-700 peer-checked:bg-blue-600"></div>
                <span className="ml-2 text-sm text-gray-600 dark:text-gray-300">
                  {dataFilter === 'all' ? 'Alle Daten' : 'Nur ab 01.06.25'}
                </span>
              </label>
            </div>

            <div className="flex justify-between items-center">
              <span className="flex items-center gap-2">🛠 Angelplätze</span>
              <Link
                to="/spots"
                className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 text-sm"
              >
                Öffnen
              </Link>
            </div>
          </>
        )}

        <div className="flex justify-between items-center">
          <span className="flex items-center gap-2">📄 Fangliste exportieren</span>
          <button
            onClick={exportCatches}
            className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 text-sm"
          >
            CSV
          </button>
        </div>

        <div className="flex justify-between items-center">
          <span className="flex items-center gap-2">📄 Entnahmeliste (PDF)</span>
          <button
            onClick={exportCatchesAsPDF}
            className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 text-sm"
          >
            PDF
          </button>
        </div>
      </div>
    </div>
  );
}

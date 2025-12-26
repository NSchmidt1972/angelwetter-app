import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/supabaseClient';
import { createCatchPDF } from '@/utils/pdfExporter';
import { isFerkensbruchLocation } from '@/utils/location';

export default function DownloadsPage() {
  const [anglerName, setAnglerName] = useState('');
  const [pdfYear, setPdfYear] = useState(new Date().getFullYear());

  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const startYear = 2024;
    const years = [];
    for (let year = currentYear; year >= startYear; year -= 1) {
      years.push(year);
    }
    return years;
  }, []);

  useEffect(() => {
    setAnglerName(localStorage.getItem('anglerName') || 'Unbekannt');
  }, []);

  const downloadFile = (content, fileName, mimeType) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

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
    const rows = data.map((row) =>
      Object.values(row)
        .map((val) => (typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val))
        .join(',')
    );
    const csvStr = [header, ...rows].join('\n');
    downloadFile(csvStr, 'fänge.csv', 'text/csv');
  };

  const exportCatchesAsPDF = async () => {
    const { data, error } = await supabase
      .from('fishes')
      .select('fish, size, weight, timestamp, location_name')
      .eq('angler', anglerName)
      .eq('taken', true)
      .gte('timestamp', `${pdfYear}-01-01`)
      .lte('timestamp', `${pdfYear}-12-31T23:59:59`);

    if (error) {
      alert('Fehler beim Laden der Fänge');
      console.error(error);
      return;
    }

    const ferkensbruchOnly = (data || []).filter((entry) => isFerkensbruchLocation(entry?.location_name));
    if (ferkensbruchOnly.length === 0) {
      alert('Keine Entnahmen am Ferkensbruch gefunden.');
      return;
    }

    try {
      const pdfBytes = await createCatchPDF(anglerName, ferkensbruchOnly, pdfYear);
      downloadFile(pdfBytes, `entnahmeliste_${pdfYear}.pdf`, 'application/pdf');
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="p-6 max-w-xl mx-auto bg-white dark:bg-gray-900 shadow-md rounded-xl text-gray-800 dark:text-gray-100 mt-10">
      <h2 className="text-2xl font-bold mb-6 text-blue-700 dark:text-blue-300 text-center">
        📂 Downloads
      </h2>

      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <span className="flex items-center gap-2">📄 Fangliste exportieren</span>
          <button
            onClick={exportCatches}
            className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 text-sm"
          >
            CSV
          </button>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col">
            <span className="flex items-center gap-2">📄 Entnahmeliste (PDF)</span>
            <label className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Jahr
              <select
                value={pdfYear}
                onChange={(event) => setPdfYear(Number(event.target.value))}
                className="ml-2 rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
              >
                {availableYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>
          </div>
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

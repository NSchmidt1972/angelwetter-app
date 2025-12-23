import { useCallback, useEffect, useState } from 'react';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export default function useCrayfishPdf({ entries, stats, dateRange }) {
  const [pdfUrl, setPdfUrl] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [error, setError] = useState('');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [pdfUrl]);

  const download = useCallback(() => {
    if (!pdfUrl) return;
    const link = document.createElement('a');
    const today = new Date().toISOString().slice(0, 10);
    link.href = pdfUrl;
    link.download = `krebsbericht-${today}.pdf`;
    link.click();
  }, [pdfUrl]);

  const close = useCallback(() => {
    setShowPreview(false);
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
      setPdfUrl('');
    }
  }, [pdfUrl]);

  const preview = useCallback(async () => {
    if (typeof window === 'undefined') {
      setError('PDF-Export steht nur im Browser zur Verfügung.');
      return;
    }

    if (!entries?.length) {
      setError('Keine Krebsdaten vorhanden.');
      return;
    }

    setError('');
    setGenerating(true);

    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
      setPdfUrl('');
    }

    try {
      const fetchLogoBytes = async () => {
        if (typeof fetch === 'undefined') return null;
        try {
          const res = await fetch('/logo.png');
          if (!res.ok) return null;
          return await res.arrayBuffer();
        } catch (fetchError) {
          console.warn('Logo konnte nicht geladen werden', fetchError);
          return null;
        }
      };

      const doc = await PDFDocument.create();
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
      const pageSize = [595.28, 841.89]; // A4
      let page = doc.addPage(pageSize);
      const margin = 50;
      let y = page.getHeight() - margin;

      const ensureSpace = (lines = 1, lineHeight = 18) => {
        if (y - lines * lineHeight < margin) {
          page = doc.addPage(pageSize);
          y = page.getHeight() - margin;
        }
      };

      const drawLine = (text, options = {}) => {
        const lineHeight = options.lineHeight || 18;
        ensureSpace(1, lineHeight);
        page.drawText(text, {
          x: options.x ?? margin,
          y,
          size: options.size || 12,
          font: options.font || font,
          color: options.color,
        });
        y -= lineHeight;
      };

      const drawRow = (left, right, options = {}) => {
        const lineHeight = options.lineHeight || 18;
        ensureSpace(1, lineHeight);
        const rowFont = options.font || font;
        const size = options.size || 12;
        page.drawText(left, { x: margin, y, size, font: rowFont, color: options.color });
        page.drawText(right, { x: margin + 360, y, size, font: rowFont, color: options.color });
        y -= lineHeight;
      };

      const drawSectionTitle = (text) => {
        ensureSpace(1, 22);
        page.drawText(text, {
          x: margin,
          y,
          size: 14,
          font: boldFont,
          color: rgb(0.1, 0.2, 0.5),
        });
        y -= 24;
      };

      const drawStaticText = (text, options = {}) => {
        page.drawText(text, {
          x: options.x ?? margin,
          y: options.y ?? y,
          size: options.size || 12,
          font: options.font || font,
          color: options.color,
        });
      };

      const formatDateValue = (value) => {
        if (!value) return '–';
        try {
          return new Date(value).toLocaleDateString('de-DE');
        } catch (formatError) {
          console.warn('formatDateValue failed', formatError);
          return '–';
        }
      };

      const rangeLabel = dateRange
        ? `${formatDateValue(dateRange.from)} – ${formatDateValue(dateRange.to)}`
        : 'keine Datumsangaben';

      const monthlyBuckets = (() => {
        const map = new Map();
        (entries || []).forEach((entry) => {
          const ts = entry?.catch_timestamp ? new Date(entry.catch_timestamp) : null;
          const count = Number(entry?.count) || 0;
          if (!ts || Number.isNaN(ts.getTime())) return;
          const key = `${ts.getFullYear()}-${String(ts.getMonth() + 1).padStart(2, '0')}`;
          if (!map.has(key)) {
            map.set(key, {
              key,
              label: ts.toLocaleString('de-DE', { month: 'short', year: 'numeric' }),
              total: 0,
              species: new Map(),
            });
          }
          const bucket = map.get(key);
          bucket.total += count;
          const species = entry?.species || 'Unbekannt';
          bucket.species.set(species, (bucket.species.get(species) || 0) + count);
        });
        return Array.from(map.values()).sort((a, b) => (a.key < b.key ? 1 : -1));
      })();

      const logoBytes = await fetchLogoBytes();
      if (logoBytes) {
        try {
          const logoImage = await doc.embedPng(logoBytes);
          const logoDims = logoImage.scale(0.35);
          const logoHeight = Math.min(80, logoDims.height);
          const logoWidth = (logoDims.width * logoHeight) / logoDims.height;
          ensureSpace(1, logoHeight + 10);
          page.drawImage(logoImage, {
            x: page.getWidth() - margin - logoWidth,
            y: y - logoHeight,
            width: logoWidth,
            height: logoHeight,
          });
          y -= logoHeight + 6;
        } catch (logoError) {
          console.warn('Logo konnte nicht eingebettet werden', logoError);
        }
      }

      drawLine('Bericht invasive Flusskrebse', {
        size: 18,
        font: boldFont,
        color: rgb(0.08, 0.2, 0.55),
        lineHeight: 24,
      });
      drawLine('Für Naturschutzverband / behördliche Meldung', {
        size: 12,
        font,
        color: rgb(0.25, 0.25, 0.25),
      });
      drawLine(`Stand: ${new Date().toLocaleDateString('de-DE')}`, {
        size: 11,
        color: rgb(0.3, 0.3, 0.3),
      });
      drawLine(`Zeitraum der Meldungen: ${rangeLabel}`, {
        size: 11,
        color: rgb(0.3, 0.3, 0.3),
      });
      y -= 6;

      drawSectionTitle('Kernzahlen');
      drawLine(`Gesamt entnommen: ${stats?.totalCount ? stats.totalCount.toLocaleString('de-DE') : '0'} Tiere`);
      drawLine(`Meldungen: ${stats?.entriesCount ? stats.entriesCount.toLocaleString('de-DE') : '0'}`);
      drawLine(`Letzte 30 Tage: ${stats?.last30d ? stats.last30d.toLocaleString('de-DE') : '0'} Tiere gemeldet`);
      drawLine(`Aktive Melder: ${stats?.uniqueAnglers ? stats.uniqueAnglers.toLocaleString('de-DE') : '0'}`);
      y -= 6;

      drawSectionTitle('Artenübersicht (summiert)');
      drawRow('Art', 'Anzahl', { font: boldFont });
      if (!stats?.bySpecies?.length) {
        drawLine('Keine Einträge vorhanden.', { size: 12 });
      } else {
        stats.bySpecies.forEach((item) => {
          drawRow(item.name, (item.total ?? 0).toLocaleString('de-DE'));
        });
      }
      y -= 6;

      drawSectionTitle('Monatliche Übersicht (summiert)');
      if (monthlyBuckets.length === 0) {
        drawLine('Keine Monatsdaten vorhanden.', { size: 12 });
      } else {
        monthlyBuckets.forEach((bucket) => {
          drawLine(`${bucket.label}: ${(bucket.total ?? 0).toLocaleString('de-DE')} Ex.`, { font: boldFont });
          Array.from(bucket.species.entries())
            .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'de'))
            .forEach(([name, total]) => {
              drawLine(`• ${name}: ${(total ?? 0).toLocaleString('de-DE')}`, { size: 11, lineHeight: 16, x: margin + 12 });
            });
          y -= 4;
        });
      }
      y -= 6;

      drawSectionTitle('Empfohlene Zusatzangaben für Verbände/Behörden');
      const hints = [
        'Gewässerabschnitt / Koordinaten und Datum der Entnahme',
        'Fangmethode und eingesetzte Reusen- oder Netzgröße',
        'Anzahl je Art und dokumentierter Entsorgungsweg (z.B. Verbrennung, Abgabe)',
        'Hinweise zu Beifängen, Verletzungen oder Sichtungen weiterer Arten',
        'Kontakt zur meldenden Person für Rückfragen',
      ];
      hints.forEach((hint) => drawLine(`• ${hint}`, { size: 11 }));
      y -= 6;

      drawSectionTitle('Freigabe Vorstand');
      ensureSpace(1, 60);
      const lineY = y - 24;
      page.drawLine({
        start: { x: margin, y: lineY },
        end: { x: page.getWidth() - margin - 200, y: lineY },
        thickness: 1,
        color: rgb(0.2, 0.2, 0.2),
      });
      page.drawLine({
        start: { x: margin + 240, y: lineY },
        end: { x: page.getWidth() - margin, y: lineY },
        thickness: 1,
        color: rgb(0.2, 0.2, 0.2),
      });
      drawStaticText('Unterschrift (Vorstand)', { size: 11, y: lineY - 14 });
      drawStaticText('Datum', { size: 11, x: margin + 240, y: lineY - 14 });
      y = lineY - 32;

      const pdfBytes = await doc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
      setShowPreview(true);
    } catch (err) {
      console.error('Failed to generate crayfish PDF', err);
      setError(err?.message || 'PDF konnte nicht erstellt werden.');
    } finally {
      setGenerating(false);
    }
  }, [entries, stats, dateRange, pdfUrl]);

  return {
    pdfUrl,
    showPreview,
    error,
    generating,
    previewReport: preview,
    downloadReport: download,
    closePreview: close,
  };
}

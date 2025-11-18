import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

const COMMON_CHAR_REPLACEMENTS = {
  '’': '\'',
  '‘': '\'',
  '‚': ',',
  '“': '"',
  '”': '"',
  '„': '"',
  '–': '-',
  '—': '-',
  '…': '...',
  '•': '•',
};

const GREEK_CHAR_MAP = {
  Α: 'A', α: 'a',
  Β: 'B', β: 'b',
  Γ: 'G', γ: 'g',
  Δ: 'D', δ: 'd',
  Ε: 'E', ε: 'e',
  Ζ: 'Z', ζ: 'z',
  Η: 'E', η: 'e',
  Θ: 'Th', θ: 'th',
  Ι: 'I', ι: 'i',
  Κ: 'K', κ: 'k',
  Λ: 'L', λ: 'l',
  Μ: 'M', μ: 'm',
  Ν: 'N', ν: 'n',
  Ξ: 'X', ξ: 'x',
  Ο: 'O', ο: 'o',
  Π: 'P', π: 'p',
  Ρ: 'R', ρ: 'r',
  Σ: 'S', σ: 's', ς: 's',
  Τ: 'T', τ: 't',
  Υ: 'Y', υ: 'y',
  Φ: 'Ph', φ: 'ph',
  Χ: 'Ch', χ: 'ch',
  Ψ: 'Ps', ψ: 'ps',
  Ω: 'O', ω: 'o',
};

function sanitizePdfText(value) {
  if (value === null || value === undefined) return '';
  const asString = String(value);

  const sanitizeChar = (char) => {
    const replacement = COMMON_CHAR_REPLACEMENTS[char] || GREEK_CHAR_MAP[char];
    if (replacement) return replacement;
    const code = char.charCodeAt(0);
    if (code <= 0xff) return char;
    if (char.normalize) {
      const normalized = char.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
      if (normalized && normalized !== char) {
        return Array.from(normalized).map((part) => sanitizeChar(part)).join('');
      }
    }
    return '?';
  };

  return Array.from(asString).map((char) => sanitizeChar(char)).join('');
}

export async function createCatchPDF(anglerName, data, reportYear = new Date().getFullYear()) {

  if (!data || data.length === 0) {
    throw new Error('Keine entnommenen Fische gefunden.');
  }

  const dateFormatter = new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  function parseDateSafe(timestamp) {
    if (!timestamp) return '-';
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) {
      console.warn('Ungültiges Datum:', timestamp);
      return '-';
    }
    return dateFormatter.format(d);
  }

  const entries = data.map((row) => {
    const timestampValue = row?.timestamp ? new Date(row.timestamp).getTime() : 0;
    return {
      fish: row?.fish || 'Unbekannt',
      dateLabel: parseDateSafe(row?.timestamp),
      timestampValue: Number.isNaN(timestampValue) ? 0 : timestampValue,
      sizeLabel: (row?.size != null && row.size !== '') ? `${row.size} cm` : '—',
      weightLabel: (row?.weight != null && row.weight !== '') ? `${row.weight} kg` : '—',
    };
  }).sort((a, b) => b.timestampValue - a.timestampValue);
  const fishCountSummary = entries.reduce((acc, entry) => {
    acc[entry.fish] = (acc[entry.fish] || 0) + 1;
    return acc;
  }, {});

  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([595, 842]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const margin = 50;
  let y = 842 - margin;

  // Vereinslogo laden und einfügen
  const logoPath = '/logo.png';
  const logoBytes = await fetch(logoPath).then(res => res.arrayBuffer());
  const logoImage = await pdfDoc.embedPng(logoBytes);
  const logoDims = logoImage.scale(0.10);
  page.drawImage(logoImage, {
    x: 595 - logoDims.width - margin / 2,
    y: 842 - logoDims.height - margin / 2,
    width: logoDims.width,
    height: logoDims.height
  });

  // Titel und Meta-Infos
  const drawText = (targetPage, text, options) => {
    targetPage.drawText(sanitizePdfText(text), options);
  };

  drawText(page, 'Entnahmeliste', { x: margin, y, size: 20, font, color: rgb(0, 0.2, 0.6) });
  y -= 30;
  drawText(page, `Angler: ${anglerName}`, { x: margin, y, size: 14, font });
  y -= 20;
  drawText(page, `Jahr: ${reportYear}`, { x: margin, y, size: 14, font });

  y -= 40;
  drawText(page, `Summe entnommener Fische: ${entries.length}`, { x: margin, y, size: 12, font });
  y -= 24;

  const tableColumns = [
    { key: 'dateLabel', label: 'Datum', width: 100 },
    { key: 'fish', label: 'Fisch', width: 170 },
    { key: 'sizeLabel', label: 'Länge', width: 100 },
    { key: 'weightLabel', label: 'Gewicht', width: 100 },
  ];
  const tableX = margin;
  const tableWidth = tableColumns.reduce((sum, col) => sum + col.width, 0);
  const headerHeight = 22;
  const rowHeight = 18;

  const drawTableHeader = () => {
    const headerTop = y;
    const headerBottom = headerTop - headerHeight;
    page.drawRectangle({
      x: tableX - 4,
      y: headerBottom,
      width: tableWidth + 8,
      height: headerHeight,
      color: rgb(0.92, 0.95, 0.99),
    });
    let colX = tableX;
    tableColumns.forEach((col) => {
      drawText(page, col.label, { x: colX, y: headerTop - 16, size: 11, font });
      colX += col.width;
    });
    y = headerBottom - 10;
  };

  drawTableHeader();

  entries.forEach((entry, idx) => {
    if (y < margin + 70) {
      page = pdfDoc.addPage([595, 842]);
      y = 842 - margin;
      drawTableHeader();
    }
    let colX = tableX;
    tableColumns.forEach((col) => {
      const value = entry[col.key] || '—';
      drawText(page, value, { x: colX, y, size: 10, font });
      colX += col.width;
    });
    y -= rowHeight;
    if ((idx + 1) % 2 === 0) {
      page.drawLine({
        start: { x: tableX - 2, y: y + rowHeight - 4 },
        end: { x: tableX + tableWidth + 2, y: y + rowHeight - 4 },
        thickness: 0.3,
        color: rgb(0.85, 0.87, 0.9),
      });
    }
  });

  y -= 20;
  const summaryEntries = Object.entries(fishCountSummary).sort((a, b) => b[1] - a[1]);
  if (summaryEntries.length > 0) {
    drawText(page, 'Aufschlüsselung nach Arten:', { x: margin, y, size: 12, font });
    y -= 16;
    summaryEntries.forEach(([fish, count]) => {
      drawText(page, `• ${count}x ${fish}`, { x: margin + 10, y, size: 10, font });
      y -= 14;
      if (y < margin + 40) {
        page = pdfDoc.addPage([595, 842]);
        y = 842 - margin;
      }
    });
  }

  const signatureBaseline = margin + 80;
  if (y <= signatureBaseline + 40) {
    page = pdfDoc.addPage([595, 842]);
    y = 842 - margin;
  }
  const signedDateLabel = dateFormatter.format(new Date());
  const dateLineX = margin;
  const signatureLineX = 595 - margin - 220;
  const lineLabelY = signatureBaseline;
  drawText(page, `Datum: ${signedDateLabel}`, { x: dateLineX, y: lineLabelY, size: 12, font });
  drawText(page, 'Unterschrift: _____________________', { x: signatureLineX, y: lineLabelY, size: 12, font });

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}

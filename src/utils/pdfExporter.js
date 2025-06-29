import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export async function createCatchPDF(anglerName, data) {
  const year = new Date().getFullYear();

  if (!data || data.length === 0) {
    throw new Error('Keine entnommenen Fische gefunden.');
  }

  function parseDateSafe(timestamp) {
    if (!timestamp) return '-';
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) {
      console.warn('Ungültiges Datum:', timestamp);
      return '-';
    }
    return d.toLocaleDateString('de-DE');
  }

  const fishMap = {};
  data.forEach(row => {
    const fish = row.fish || 'Unbekannt';
    if (!fishMap[fish]) {
      fishMap[fish] = [];
    }

    const date = parseDateSafe(row.timestamp);
    const size = (row.size != null && row.size !== '') ? `${row.size} cm` : '';
    const weight = (row.weight != null && row.weight !== '') ? `${row.weight} kg` : '';

    fishMap[fish].push({ date, size, weight });
  });

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
  page.drawText(`Entnahmeliste`, { x: margin, y, size: 20, font, color: rgb(0, 0.2, 0.6) });
  y -= 30;
  page.drawText(`Angler: ${anglerName}`, { x: margin, y, size: 14, font });
  y -= 20;
  page.drawText(`Jahr: ${year}`, { x: margin, y, size: 14, font });

  y -= 40;
  page.drawText(`Entnommene Fische:`, { x: margin, y, size: 16, font });
  y -= 20;

  Object.entries(fishMap).forEach(([fish, entries]) => {
    page.drawText(`• ${entries.length} x ${fish}`, { x: margin + 10, y, size: 12, font });
    y -= 16;

    entries.forEach(entry => {
      const xDate = margin + 40;
      const xDot1 = margin + 110;
      const xSize = margin + 120;
      const xDot2 = margin + 170;
      const xWeight = margin + 180;

      // Datum
      page.drawText(entry.date, { x: xDate, y, size: 10, font });

      // Trennpunkt + Größe
      if (entry.size) {
        page.drawText('•', { x: xDot1, y, size: 10, font });
        page.drawText(entry.size, { x: xSize, y, size: 10, font });
      }

      // Trennpunkt + Gewicht
      if (entry.weight) {
        page.drawText('•', { x: xDot2, y, size: 10, font });
        page.drawText(entry.weight, { x: xWeight, y, size: 10, font });
      }

      y -= 14;

      if (y < margin + 50) {
        page = pdfDoc.addPage([595, 842]);
        y = 842 - margin;
      }
    });
  });

  y -= 40;
  page.drawText(`Datum: __________________________`, { x: margin, y, size: 12, font });
  y -= 20;
  page.drawText(`Unterschrift: _____________________`, { x: margin, y, size: 12, font });

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}

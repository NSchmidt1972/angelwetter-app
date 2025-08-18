export function validateCatchForm({ fish, size, weight, position }) {
  if (!fish || !size) {
    return "Bitte Fischart und Größe angeben!";
  }

  const sizeNumber = parseFloat(size.replace(',', '.'));
  if (isNaN(sizeNumber) || sizeNumber <= 0) {
    return "Bitte eine gültige Zahl größer als 0 für die Größe eingeben.";
  }

  // Gewicht nur prüfen, wenn es überhaupt ausgefüllt wurde
  if (fish === 'Karpfen' && weight) {
    const weightNumber = parseFloat(weight.replace(',', '.'));
    if (isNaN(weightNumber) || weightNumber <= 0) {
      return "Bitte ein gültiges Gewicht eingeben oder Feld leer lassen.";
    }
  }

  if (!position) {
    return "Standortdaten fehlen. Bitte Standortfreigabe aktivieren.";
  }

  return null; // keine Fehler
}

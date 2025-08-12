// utils/validation.js

export function validateCatchForm({ fish, size, weight, position }) {
  if (!fish || !size) {
    return "Bitte alles ausfüllen!";
  }

  const sizeNumber = parseFloat(size.replace(',', '.'));
  if (isNaN(sizeNumber) || sizeNumber <= 0) {
    return "Bitte eine gültige Zahl größer als 0 für die Größe eingeben.";
  }

  if (fish === 'Karpfen') {
    if (!weight) {
      return "Bitte das Gewicht des Karpfens angeben.";
    }
    const weightNumber = parseFloat(weight.replace(',', '.'));
    if (isNaN(weightNumber) || weightNumber <= 0) {
      return "Bitte eine gültige Zahl größer als 0 für das Gewicht eingeben.";
    }
  }

  if (!position) {
    return "Standortdaten fehlen. Bitte Standortfreigabe aktivieren.";
  }

  return null; // keine Fehler
}

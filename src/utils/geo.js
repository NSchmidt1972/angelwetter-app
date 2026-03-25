// src/utils/geo.js

/**
 * Berechnet die Entfernung zwischen zwei Koordinaten in Kilometern (Haversine-Formel).
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @returns {number} Entfernung in km
 */
export function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Erdradius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Berechnet die Entfernung zwischen zwei Koordinaten in Metern.
 * @returns {number}
 */
export function getDistanceMeters(lat1, lon1, lat2, lon2) {
  return getDistanceKm(lat1, lon1, lat2, lon2) * 1000;
}

/**
 * Holt den Ortsnamen (Reverse Geocoding) zu gegebenen Koordinaten
 * @param {number} lat
 * @param {number} lon
 * @returns {Promise<string|null>}
 */
export async function reverseGeocode(lat, lon) {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`
    );

    if (!response.ok) throw new Error('Fehler beim Reverse Geocoding');

    const data = await response.json();

    // Prüfe, ob ein address-Objekt existiert
    if (data.address) {
      return (
        data.address.city_district ||
        data.address.city ||
        data.address.town ||
        data.address.village ||
        data.address.suburb ||
        data.display_name ||
        null
      );
    }

    // Falls kein address-Objekt vorhanden, auf display_name zurückfallen
    return data.display_name || null;
    
  } catch (err) {
    console.error('Reverse Geocoding Fehler:', err);
    return null;
  }
}

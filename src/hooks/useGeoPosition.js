// src/hooks/useGeoPosition.js
// One-shot geolocation (best-effort). Returns { position, error }.
import { useEffect, useState } from "react";

export function useGeoPosition() {
  const [position, setPosition] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setError("Geolocation unsupported");
      return;
    }

    const geoOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 15000,
    };

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      },
      (err) => {
        setError(err?.message || "Failed to get position");
      },
      geoOptions,
    );
  }, []);

  return { position, error };
}

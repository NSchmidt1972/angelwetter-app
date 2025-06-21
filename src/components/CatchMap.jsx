// Kartenkomponente mit MarkerCluster und stilistisch einheitlicher Darstellung
// Darkmode ready (nur für Container, Karte selbst bleibt hell)

import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-markercluster';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import L from 'leaflet';
import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

const blueIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const FERKENSBRUCH_CENTER = [51.3105, 6.2565];
const FERKENSBRUCH_ZOOM = 16.3;

function FitBounds({ bounds }) {
  const map = useMap();
  useEffect(() => {
    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [bounds, map]);
  return null;
}

export default function CatchMap() {
  const [entries, setEntries] = useState([]);

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('fishes')
        .select('*')
        .not('lat', 'is', null)
        .not('lon', 'is', null);

      if (!error) setEntries(data);
      else console.error("Fehler beim Laden der Koordinaten:", error);
    }
    load();
  }, []);

  const bounds = entries.map((e) => [e.lat, e.lon]);

  return (
    <div className="h-[80vh] w-full relative z-0 rounded-xl overflow-hidden shadow-md">
      <MapContainer
        center={FERKENSBRUCH_CENTER}
        zoom={FERKENSBRUCH_ZOOM}
        scrollWheelZoom={true}
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {entries.length > 0 && <FitBounds bounds={bounds} />}

        <MarkerClusterGroup>
          {entries.map((e) => (
            <Marker
              key={e.id}
              position={[e.lat, e.lon]}
              icon={e.blank ? redIcon : blueIcon}
            >
              <Popup>
                <div className="text-sm">
                  <strong>{e.angler}</strong><br />
                  {e.blank ? '❌ Schneidertag' : `🐟 ${e.fish} (${e.size} cm)`}<br />
                  {new Date(e.timestamp).toLocaleString('de-DE')}
                </div>
              </Popup>
            </Marker>
          ))}
        </MarkerClusterGroup>
      </MapContainer>
    </div>
  );
}

import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-markercluster';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import L from 'leaflet';
import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

// Standard-Marker fixen (Leaflet-Problem in Vite/React)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).href,
  iconUrl: new URL('leaflet/dist/images/marker-icon.png', import.meta.url).href,
  shadowUrl: new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).href,
});

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
    <div className="h-[80vh] w-full">
      <MapContainer
        center={[52.4, 9.7]} // Fallback-Start
        zoom={12}
        scrollWheelZoom={true}
        className="h-full w-full rounded-xl shadow"
      >
        <TileLayer
          attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds bounds={bounds} />

        <MarkerClusterGroup>
          {entries.map((e) => (
            <Marker key={e.id} position={[e.lat, e.lon]}>
              <Popup>
                <strong>{e.angler}</strong><br />
                {e.blank ? '❌ Schneidertag' : `🐟 ${e.fish} (${e.size} cm)`}<br />
                {new Date(e.timestamp).toLocaleString('de-DE')}
              </Popup>
            </Marker>
          ))}
        </MarkerClusterGroup>
      </MapContainer>
    </div>
  );
}

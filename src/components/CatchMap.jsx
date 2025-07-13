import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap
} from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-markercluster';
import L from 'leaflet';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

const blueIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const pinkIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-pink.png',
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
  const [spots, setSpots] = useState([]);
  const [onlyMine, setOnlyMine] = useState(false);
  const mapRef = useRef();

  const anglerName = (localStorage.getItem('anglerName') || '').trim().toLowerCase();
  const isAdmin = anglerName === 'nicol schmidt';

  useEffect(() => {
    async function loadData() {
      const { data: fishes, error: fishError } = await supabase
        .from('fishes')
        .select('*')
        .not('lat', 'is', null)
        .not('lon', 'is', null);

      const { data: spotsData, error: spotError } = await supabase
        .from('spots')
        .select('*');

      if (!fishError) setEntries(fishes);
      else console.error("❌ Fehler bei fishes:", fishError);

      if (!spotError) setSpots(spotsData);
      else console.error("❌ Fehler bei spots:", spotError);
    }

    loadData();
  }, []);

  const bounds = [
    ...entries.filter(e => !e.blank).map((e) => [e.lat, e.lon]),
    ...spots.map((s) => [s.lat, s.lon])
  ];

  const handleDragEnd = async (e, spot) => {
    const newPos = e.target.getLatLng();
    const { error } = await supabase
      .from('spots')
      .update({ lat: newPos.lat, lon: newPos.lng })
      .eq('id', spot.id);

    if (error) {
      console.error("❌ Fehler beim Speichern:", error.message);
      alert("Fehler beim Speichern.");
    } else {
      setSpots((prev) =>
        prev.map((s) =>
          s.id === spot.id ? { ...s, lat: newPos.lat, lon: newPos.lng } : s
        )
      );
      console.log(`✅ ${spot.name} verschoben zu ${newPos.lat.toFixed(5)}, ${newPos.lng.toFixed(5)}`);
    }
  };

  const handleFishMove = async (e, catchEntry) => {
    const newPos = e.target.getLatLng();
    const { error } = await supabase
      .from('fishes')
      .update({ lat: newPos.lat, lon: newPos.lng })
      .eq('id', catchEntry.id);

    if (error) {
      console.error("❌ Fehler beim Speichern des Fangs:", error.message);
      alert("Fehler beim Speichern des Fangs.");
    } else {
      setEntries((prev) =>
        prev.map((f) =>
          f.id === catchEntry.id ? { ...f, lat: newPos.lat, lon: newPos.lng } : f
        )
      );
      console.log(`✅ Fang verschoben zu ${newPos.lat.toFixed(5)}, ${newPos.lng.toFixed(5)}`);
    }
  };

  const filteredEntries = entries.filter((e) => {
    if (e.blank || (e.is_marilou && anglerName !== 'marilou')) return false;

    const istEigenerFang = e.angler?.trim().toLowerCase() === anglerName;
    const ortIstFerkensbruch = !e.location_name || e.location_name.toLowerCase().includes('ferkensbruch');

    return onlyMine ? istEigenerFang : (istEigenerFang || ortIstFerkensbruch);
  });

  return (
    <div className="h-[80vh] w-full relative z-0 rounded-xl overflow-hidden shadow-md">
      <div className="flex justify-between items-center px-4 pt-4">
       
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            checked={onlyMine}
            onChange={(e) => setOnlyMine(e.target.checked)}
            className="accent-blue-600"
          />
          Nur meine
        </label>
      </div>

      <MapContainer
        center={FERKENSBRUCH_CENTER}
        zoom={FERKENSBRUCH_ZOOM}
        scrollWheelZoom={true}
        className="h-full w-full"
        whenCreated={(mapInstance) => (mapRef.current = mapInstance)}
      >
        <TileLayer
          attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {bounds.length > 0 && <FitBounds bounds={bounds} />}

        {spots.map((spot) => (
          <Marker
            key={`spot-${spot.id}`}
            position={[spot.lat, spot.lon]}
            icon={L.divIcon({
              html: '',
              className: 'rounded-full bg-gray-400 w-3 h-3',
              iconSize: [12, 12]
            })}
            draggable={isAdmin}
            zIndexOffset={-1000}
            eventHandlers={
              isAdmin ? {
                dragend: (e) => handleDragEnd(e, spot)
              } : {}
            }
          >
            <Popup>🎣 {spot.name}</Popup>
          </Marker>
        ))}

        <MarkerClusterGroup>
          {filteredEntries.map((e) => {
            const isOwnCatch = isAdmin || e.angler?.trim().toLowerCase() === anglerName;

            return (
              <Marker
                key={e.id}
                position={[e.lat, e.lon]}
                icon={e.is_marilou ? pinkIcon : blueIcon}
                draggable={isOwnCatch}
                eventHandlers={
                  isOwnCatch ? { dragend: (evt) => handleFishMove(evt, e) } : {}
                }
              >
                <Popup>
                  <div className="text-sm">
                    <strong>{e.angler}</strong><br />
                    🐟 {e.fish} ({e.size} cm)<br />
                    {new Date(e.timestamp).toLocaleString('de-DE')}
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MarkerClusterGroup>
      </MapContainer>
    </div>
  );
}
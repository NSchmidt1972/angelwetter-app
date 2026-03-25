import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap
} from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-markercluster';
import L from 'leaflet';
import { useEffect, useState, useMemo } from 'react';
import { useAppResumeTick } from '@/hooks/useAppResumeSync';
import { useLocalStorageValue } from '@/hooks/useLocalStorageValue';
import { useClubCoordinates } from '@/hooks/useClubCoordinates';
import { FISH_SELECT, fetchClubFishesQuery } from '@/services/fishes';
import { listWaterbodiesByClub } from '@/services/waterbodiesService';
import { HOME_WATER_RADIUS_KM } from '@/utils/location';
import { getDistanceKm } from '@/utils/geo';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

const DEFAULT_HOME_CENTER = [51.31075, 6.25585];
const HOME_ZOOM = 16.3;

function isHomeWaterPoint(lat, lon, center) {
  const parsedLat = Number(lat);
  const parsedLon = Number(lon);
  const centerLat = Number(center?.[0]);
  const centerLon = Number(center?.[1]);
  if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLon)) return false;
  if (!Number.isFinite(centerLat) || !Number.isFinite(centerLon)) return false;
  return getDistanceKm(parsedLat, parsedLon, centerLat, centerLon) <= HOME_WATER_RADIUS_KM;
}

function FitBounds({ bounds }) {
  const map = useMap();
  useEffect(() => {
    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [bounds, map]);
  return null;
}

function FlyToHome({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, zoom, { animate: true });
  }, [map, center, zoom]);
  return null;
}

// 🎨 Farbpalette als Hex-Codes
const fishColorMap = {
  hecht: '#009688',      // Teal
  karpfen: '#1976D2',    // Blau
  barsch: '#FFD600',     // Gelb
  zander: '#7B1FA2',     // Violett
  rotauge: '#E53935',    // Rot
  rotfeder: '#FB8C00',   // Orange
  aal: '#3E2723',        // Dunkelbraun
  wels: '#757575',       // Grau
  karausche: '#8D6E63',  // Braun
  hornhecht: '#546E7A',  // Blau-Grau
  lachs: '#FF7043',      // Lachsfarben
  schleie: '#388E3C'     // Grün
};

// 🆕 SVG-Marker verkleinert auf ca. 60% der Originalgröße
const createSvgIcon = (color) =>
  L.divIcon({
    html: `
      <svg width="15" height="25" viewBox="0 0 25 41" xmlns="http://www.w3.org/2000/svg">
        <path fill="${color}" stroke="black" stroke-width="1"
          d="M12.5,0 C5.6,0,0,5.6,0,12.5 C0,21.9,12.5,41,12.5,41 S25,21.9,25,12.5 C25,5.6,19.4,0,12.5,0z"/>
      </svg>
    `,
    className: "",
    iconSize: [15, 25],  // kleiner als Original
    iconAnchor: [7.5, 25], // Ankerpunkt angepasst (Mitte unten)
    popupAnchor: [1, -20]  // Popup etwas näher
  });


const iconMap = {};
function getIconForFish(fish) {
  if (!fish) return createSvgIcon('#757575'); // Grau als Fallback
  const key = fish.trim().toLowerCase();
  if (!iconMap[key]) {
    const color = fishColorMap[key] || '#757575';
    iconMap[key] = createSvgIcon(color);
  }
  return iconMap[key];
}

const MONTHS_DE = [
  'Januar','Februar','März','April','Mai','Juni',
  'Juli','August','September','Oktober','November','Dezember'
];

export default function CatchMap() {
  const resumeTick = useAppResumeTick({ enabled: true });
  const [entries, setEntries] = useState([]);
  const [waterbodies, setWaterbodies] = useState([]);
  const [waterbodyFilter, setWaterbodyFilter] = useState('all');
  const [onlyMine, setOnlyMine] = useState(false);
  const { clubCoords, reload: reloadClubCoords } = useClubCoordinates({
    timeoutLabel: 'CatchMap Club-Koordinaten timeout',
    onError: (error) => {
      console.warn('CatchMap: Club-Koordinaten konnten nicht geladen werden:', error?.message || error);
    },
  });

  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const [storedAnglerName] = useLocalStorageValue('anglerName', '');
  const anglerName = (storedAnglerName || '').trim().toLowerCase();
  const homeCenter = useMemo(
    () => (clubCoords ? [clubCoords.lat, clubCoords.lon] : DEFAULT_HOME_CENTER),
    [clubCoords]
  );

  useEffect(() => {
    void reloadClubCoords();
  }, [reloadClubCoords, resumeTick]);

  useEffect(() => {
    let active = true;
    async function loadData() {
      const { data: fishes, error } = await fetchClubFishesQuery({ select: FISH_SELECT.MAP })
        .not('lat', 'is', null)
        .not('lon', 'is', null);
      if (!error && active) setEntries(fishes || []);
      else console.error("❌ Fehler bei fishes:", error);
    }
    void loadData();
    return () => {
      active = false;
    };
  }, [resumeTick]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await listWaterbodiesByClub(null, { activeOnly: false });
        if (!active) return;
        setWaterbodies(Array.isArray(data) ? data : []);
      } catch (error) {
        if (!active) return;
        console.warn('CatchMap: Gewässer konnten nicht geladen werden:', error?.message || error);
        setWaterbodies([]);
      }
    })();
    return () => {
      active = false;
    };
  }, [resumeTick]);

  useEffect(() => {
    if (waterbodyFilter === 'all') return;
    const exists = waterbodies.some((entry) => entry.id === waterbodyFilter);
    if (!exists) setWaterbodyFilter('all');
  }, [waterbodies, waterbodyFilter]);

  // Aktuelles Jahr immer in der Liste führen
  const availableYears = useMemo(() => {
    const ys = new Set(
      entries
        .map(e => new Date(e.timestamp).getFullYear())
        .filter(y => !isNaN(y))
    );
    ys.add(now.getFullYear());
    return Array.from(ys).sort((a, b) => b - a);
  }, [entries, now]);

  // Aktuellen Monat immer in der Liste
  const availableMonths = useMemo(() => {
    const ms = new Set(
      entries
        .filter(e => year === 'all' || new Date(e.timestamp).getFullYear() === year)
        .map(e => new Date(e.timestamp).getMonth())
        .filter(m => !isNaN(m))
    );

    if (year === 'all' || year === now.getFullYear()) {
      ms.add(now.getMonth());
    }

    return Array.from(ms).sort((a, b) => a - b);
  }, [entries, year, now]);

  const timeFiltered = useMemo(() => {
    return entries.filter((e) => {
      const d = new Date(e.timestamp);
      if (isNaN(d)) return false;
      const yearOk = (year === 'all') || (d.getFullYear() === year);
      const monthOk = (month === 'all') || (d.getMonth() === month);
      return yearOk && monthOk;
    });
  }, [entries, year, month]);

  // Schneidersessions (blank) rausfiltern = nur Einträge mit Fischname
  const filteredEntries = useMemo(() => {
    const valid = timeFiltered.filter((entry) => {
      if (!entry.fish?.trim()) return false;
      if (waterbodyFilter === 'all') return true;
      return (entry.waterbody_id || '') === waterbodyFilter;
    });
    if (!onlyMine) return valid;
    return valid.filter(e => e.angler?.trim().toLowerCase() === anglerName);
  }, [timeFiltered, waterbodyFilter, onlyMine, anglerName]);

  const waterbodyById = useMemo(
    () =>
      (waterbodies || []).reduce((acc, entry) => {
        if (!entry?.id) return acc;
        acc[entry.id] = entry;
        return acc;
      }, {}),
    [waterbodies],
  );

  const bounds = useMemo(() => {
    if (filteredEntries.length === 0) return [];
    return filteredEntries.map(e => [e.lat, e.lon]);
  }, [filteredEntries]);

  const legendFishList = useMemo(() => {
    const relevantEntries = onlyMine
      ? filteredEntries
      : filteredEntries.filter((entry) => isHomeWaterPoint(entry.lat, entry.lon, homeCenter));

    const map = new Map();
    relevantEntries.forEach((entry) => {
      const original = entry.fish?.trim();
      if (!original) return;
      const normalized = original.toLowerCase();
      if (!map.has(normalized)) {
        map.set(normalized, { label: original, count: 0 });
      }
      map.get(normalized).count += 1;
    });
    return Array.from(map.entries()).sort((a, b) => b[1].count - a[1].count);
  }, [filteredEntries, homeCenter, onlyMine]);

  // 🔧 NEU: Bei "Nur meine" nur zoomen, wenn es mind. einen externen Punkt gibt
  const hasExternalPoint = useMemo(() =>
    bounds.some(([lat, lon]) => !isHomeWaterPoint(lat, lon, homeCenter))
  , [bounds, homeCenter]);

  return (
    <div className="w-full relative z-0 rounded-xl overflow-hidden shadow-md">
      <div className="flex flex-col gap-3 px-4 pt-4 mb-2 z-10 relative bg-white dark:bg-gray-900">
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            checked={onlyMine}
            onChange={(e) => setOnlyMine(e.target.checked)}
            className="accent-blue-600"
          />
          Nur meine
        </label>

        <div className="flex flex-wrap items-center gap-3 text-sm">
          <div className="flex items-center gap-2">
            <select
              value={waterbodyFilter}
              onChange={(e) => setWaterbodyFilter(e.target.value)}
              className="border rounded-md px-2 py-1 bg-white dark:bg-gray-800 dark:border-gray-700"
            >
              <option value="all">Alle Gewässer</option>
              {waterbodies.map((waterbody) => (
                <option key={waterbody.id} value={waterbody.id}>
                  {waterbody.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
           
            <select
              value={year}
              onChange={(e) => setYear(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="border rounded-md px-2 py-1 bg-white dark:bg-gray-800 dark:border-gray-700"
            >
              <option value="all">Alle Jahre</option>
              {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-2">
           
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="border rounded-md px-2 py-1 bg-white dark:bg-gray-800 dark:border-gray-700"
            >
              <option value="all">Alle Monate</option>
              {availableMonths.map(m => <option key={m} value={m}>{MONTHS_DE[m]}</option>)}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-300 items-center">
          {legendFishList.length === 0 && (
            <span className="text-xs text-gray-500">Keine Fische in der aktuellen Ansicht</span>
          )}
          {legendFishList.map(([fishKey, info]) => (
            <div key={fishKey} className="flex items-center gap-1">
              <div
                dangerouslySetInnerHTML={{
                  __html: createSvgIcon(fishColorMap[fishKey] || '#757575').options.html
                }}
                style={{ width: '16px', height: '26px' }}
              />
              <span className="capitalize">
                {info.label}
                <span className="ml-1 text-[10px] text-gray-500">({info.count})</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="h-[70vh] mt-2">
        <MapContainer
          key={`${onlyMine ? 'onlyMine' : 'all'}-${year}-${month}`}
          center={homeCenter}
          zoom={HOME_ZOOM}
          scrollWheelZoom={true}
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://openstreetmap.org">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {onlyMine
            ? (
                bounds.length > 0 && hasExternalPoint && (
                  <FitBounds bounds={bounds} />
                )
              )
            : <FlyToHome center={homeCenter} zoom={HOME_ZOOM} />
          }

          <MarkerClusterGroup>
            {filteredEntries
              .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
              .map(e => (
                <Marker
                  key={e.id}
                  position={isHomeWaterPoint(e.lat, e.lon, homeCenter) ? homeCenter : [e.lat, e.lon]}
                  icon={getIconForFish(e.fish)}
                >
                  <Popup>
                    <div className="text-sm">
                      <strong>{e.angler}</strong><br />
                      🐟 {e.fish} ({e.size} cm)<br />
                      {e.waterbody_id && waterbodyById[e.waterbody_id]?.name ? (
                        <>
                          🌊 {waterbodyById[e.waterbody_id].name}<br />
                        </>
                      ) : null}
                      {new Date(e.timestamp).toLocaleString('de-DE')}
                      {isHomeWaterPoint(e.lat, e.lon, homeCenter) && (
                        <p className="text-xs text-gray-500 mt-1">📍 Position zentriert auf Vereinsgewässer</p>
                      )}
                    </div>
                  </Popup>
                </Marker>
              ))}
          </MarkerClusterGroup>
        </MapContainer>
      </div>
    </div>
  );
}

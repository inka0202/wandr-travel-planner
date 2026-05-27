import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { useEffect } from 'react';
import { orangeMarker } from './orangeMarkerIcon';

/**
 * Helper component: when center prop changes, fly the map there.
 * (MapContainer ignores `center` prop changes after first mount.)
 */
function CenterUpdater({ center, zoom }) {
  const map = useMap();
  const [lat, lng] = center;
  useEffect(() => {
    map.setView([lat, lng], zoom, { animate: true, duration: 0.7 });
  }, [map, lat, lng, zoom]);
  return null;
}

export default function TripMap({
  center, // [lat, lng]
  attractions,
  favoritedIds = new Set(),
  onMarkerClick,
  zoom = 13,
}) {
  return (
    <MapContainer
      center={center}
      zoom={zoom}
      scrollWheelZoom
      className="h-full w-full rounded-2xl"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <CenterUpdater center={center} zoom={zoom} />

      {attractions?.map((a) => (
        <Marker
          key={a.xid}
          position={[a.latitude, a.longitude]}
          icon={orangeMarker(favoritedIds.has(a.xid))}
          eventHandlers={{
            click: () => onMarkerClick?.(a),
          }}
        >
          <Popup>
            <div className="font-sans">
              <p className="font-semibold text-navy-900">{a.name}</p>
              <p className="text-xs text-navy-500 capitalize mt-0.5">{a.kind}</p>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}

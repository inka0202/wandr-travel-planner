import L from 'leaflet';

/**
 * Brand-orange CSS-based marker. No image asset; uses divIcon + inline styles
 * to keep the design consistent without sourcing/coloring SVG marker images.
 */
export const orangeMarker = (isFavorited = false) =>
  L.divIcon({
    className: 'wandr-marker',
    html: `<div style="
      width: 18px; height: 18px; border-radius: 9999px;
      background: ${isFavorited ? '#C2671C' : '#E67E22'};
      border: 3px solid white;
      box-shadow: 0 2px 6px rgba(44,62,80,0.3);
      ${isFavorited ? 'transform: scale(1.2);' : ''}
    "></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9], // center the marker on the coord
    popupAnchor: [0, -10], // popup appears above the marker
  });

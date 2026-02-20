/**
 * Project Dark Earth — Obsidian / Linear map styling.
 * Strictly monochrome: Vantablack (#050505), Zinc-950 (#09090b), no POI clutter.
 * Use with Google Maps MapOptions.styles (raster) or Cloud Map ID (vector).
 */
export type MapTypeStyle = google.maps.MapTypeStyle;

export const OBSIDIAN_MAP_STYLES: MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#09090b" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#71717a" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#050505" }] },
  { featureType: "administrative.land_parcel", stylers: [{ visibility: "off" }] },
  { featureType: "administrative.neighborhood", stylers: [{ visibility: "off" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  {
    featureType: "road",
    elementType: "geometry.fill",
    stylers: [{ color: "#27272a" }],
  },
  {
    featureType: "road",
    elementType: "labels",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "road.arterial",
    elementType: "geometry",
    stylers: [{ color: "#3f3f46" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#52525b" }],
  },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#050505" }],
  },
];

/** Default center (Brisbane) when no markers. */
export const DEFAULT_MAP_CENTER = { lat: -27.4698, lng: 153.0251 };

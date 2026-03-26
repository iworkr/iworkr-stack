/**
 * Project Dark Earth — Obsidian / Linear map styling for Mapbox GL.
 * Ultra-dark monochrome: Vantablack (#050505), Zinc-950 (#09090b), no POI clutter.
 *
 * Uses Mapbox's dark-v11 base style with extensive layer overrides for the
 * iWorkr "Stealth Mode" aesthetic.
 */

/** Mapbox style URL — dark-v11 is the base, we override layers at runtime */
export const OBSIDIAN_MAP_STYLE = "mapbox://styles/mapbox/dark-v11";

/** Default center (Brisbane) when no markers. */
export const DEFAULT_MAP_CENTER: [number, number] = [153.0251, -27.4698]; // [lng, lat] for Mapbox

/** Default center as {lat, lng} for compatibility */
export const DEFAULT_MAP_CENTER_LATLNG = { lat: -27.4698, lng: 153.0251 };

/**
 * Runtime style overrides applied after map loads.
 * These transform the standard dark-v11 into our ultra-dark Obsidian theme.
 * Handles the race condition where style.load may have already fired.
 */
export function applyObsidianStyle(map: mapboxgl.Map) {
  const has = (id: string) => {
    try { return !!map.getLayer(id); } catch { return false; }
  };

  const paint = (id: string, prop: string, value: string | number) => {
    if (has(id)) map.setPaintProperty(id, prop, value);
  };

  const layout = (id: string, prop: string, value: string) => {
    if (has(id)) map.setLayoutProperty(id, prop, value);
  };

  const apply = () => {
    paint("background", "background-color", "#050505");
    paint("land", "background-color", "#09090b");

    for (const id of ["water", "water-shadow"]) {
      paint(id, "fill-color", "#050505");
    }

    const roadOverrides: Record<string, string> = {
      "road-minor": "#1a1a1e",
      "road-minor-case": "#111114",
      "road-street": "#27272a",
      "road-street-case": "#1a1a1e",
      "road-secondary-tertiary": "#27272a",
      "road-secondary-tertiary-case": "#1a1a1e",
      "road-primary": "#3f3f46",
      "road-primary-case": "#27272a",
      "road-motorway-trunk": "#52525b",
      "road-motorway-trunk-case": "#3f3f46",
    };
    for (const [layer, color] of Object.entries(roadOverrides)) {
      paint(layer, "line-color", color);
    }

    paint("building", "fill-color", "#0e0e11");
    paint("building", "fill-opacity", 0.4);

    const labelLayers = [
      "road-label", "road-number-shield", "road-exit-shield",
      "settlement-major-label", "settlement-minor-label", "settlement-subdivision-label",
      "airport-label", "poi-label", "water-point-label", "water-line-label",
      "natural-point-label", "natural-line-label",
      "state-label", "country-label", "continent-label",
    ];
    for (const id of labelLayers) {
      paint(id, "text-color", "#52525b");
      paint(id, "text-halo-color", "#050505");
      paint(id, "text-halo-width", 1.5);
    }

    for (const id of ["poi-label", "transit-label", "airport-label", "natural-point-label"]) {
      layout(id, "visibility", "none");
    }

    paint("landuse", "fill-color", "#09090b");
    paint("landuse", "fill-opacity", 0);

    paint("admin-0-boundary", "line-color", "#27272a");
    paint("admin-0-boundary", "line-opacity", 0.3);
    paint("admin-1-boundary", "line-color", "#1a1a1e");
    paint("admin-1-boundary", "line-opacity", 0.2);
  };

  if (map.isStyleLoaded()) {
    apply();
  } else {
    map.once("style.load", apply);
  }
}

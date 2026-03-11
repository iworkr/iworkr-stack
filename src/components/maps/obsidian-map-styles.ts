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
  const apply = () => {
    // Background — vantablack
    try { map.setPaintProperty("background", "background-color", "#050505"); } catch {}

    // Land — near-black
    try { map.setPaintProperty("land", "background-color", "#09090b"); } catch {}

    // Water — true black
    const waterLayers = ["water", "water-shadow"];
    for (const id of waterLayers) {
      try { map.setPaintProperty(id, "fill-color", "#050505"); } catch {}
    }

    // Roads — zinc monochrome hierarchy
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
      try { map.setPaintProperty(layer, "line-color", color); } catch {}
    }

    // Buildings — barely visible
    try { map.setPaintProperty("building", "fill-color", "#0e0e11"); } catch {}
    try { map.setPaintProperty("building", "fill-opacity", 0.4); } catch {}

    // Labels — muted zinc
    const labelLayers = [
      "road-label", "road-number-shield", "road-exit-shield",
      "settlement-major-label", "settlement-minor-label", "settlement-subdivision-label",
      "airport-label", "poi-label", "water-point-label", "water-line-label",
      "natural-point-label", "natural-line-label",
      "state-label", "country-label", "continent-label",
    ];
    for (const id of labelLayers) {
      try { map.setPaintProperty(id, "text-color", "#52525b"); } catch {}
      try { map.setPaintProperty(id, "text-halo-color", "#050505"); } catch {}
      try { map.setPaintProperty(id, "text-halo-width", 1.5); } catch {}
    }

    // Hide POI icons entirely
    const hideLayers = [
      "poi-label", "transit-label", "airport-label",
      "natural-point-label",
    ];
    for (const id of hideLayers) {
      try { map.setLayoutProperty(id, "visibility", "none"); } catch {}
    }

    // Land use — invisible
    try { map.setPaintProperty("landuse", "fill-color", "#09090b"); } catch {}
    try { map.setPaintProperty("landuse", "fill-opacity", 0); } catch {}

    // Boundaries — very subtle
    try { map.setPaintProperty("admin-0-boundary", "line-color", "#27272a"); } catch {}
    try { map.setPaintProperty("admin-0-boundary", "line-opacity", 0.3); } catch {}
    try { map.setPaintProperty("admin-1-boundary", "line-color", "#1a1a1e"); } catch {}
    try { map.setPaintProperty("admin-1-boundary", "line-opacity", 0.2); } catch {}
  };

  // If style is already loaded, apply immediately; otherwise wait for the event
  if (map.isStyleLoaded()) {
    apply();
  } else {
    map.once("style.load", apply);
  }
}

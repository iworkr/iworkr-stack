import { MAPBOX_ACCESS_TOKEN } from "./mapbox-provider";

/**
 * Generates a Mapbox Static Images API URL for a given coordinate.
 * Uses the dark-v11 base style with an emerald pin marker.
 *
 * @param lng Longitude
 * @param lat Latitude
 * @param width Image width in pixels
 * @param height Image height in pixels
 * @param zoom Zoom level (default 15)
 */
export function getStaticMapUrl(
  lng: number,
  lat: number,
  width = 640,
  height = 320,
  zoom = 15,
): string {
  // Clamp dimensions to Mapbox limits (1280x1280 for @2x)
  const w = Math.min(width, 1280);
  const h = Math.min(height, 1280);

  // Emerald pin marker
  const marker = `pin-s+10B981(${lng},${lat})`;

  return `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/${marker}/${lng},${lat},${zoom},0/${w}x${h}@2x?access_token=${MAPBOX_ACCESS_TOKEN}`;
}

/**
 * Generates a static map URL for an address string (uses Mapbox Geocoding first).
 * Falls back to a center-of-world image if geocoding fails.
 * This is async because it needs to geocode the address.
 */
export async function getStaticMapUrlForAddress(
  address: string,
  width = 640,
  height = 320,
  zoom = 15,
): Promise<string | null> {
  try {
    const geoUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${MAPBOX_ACCESS_TOKEN}&limit=1`;
    const res = await fetch(geoUrl);
    const data = await res.json();
    const [lng, lat] = data?.features?.[0]?.center ?? [];
    if (lng == null || lat == null) return null;
    return getStaticMapUrl(lng, lat, width, height, zoom);
  } catch {
    return null;
  }
}

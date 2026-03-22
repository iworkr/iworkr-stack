/**
 * @component StaticMap
 * @status COMPLETE
 * @description Renders a static Mapbox map image with geocoded address pin
 * @lastAudit 2026-03-22
 */
"use client";

import { useEffect, useState } from "react";
import { MAPBOX_ACCESS_TOKEN } from "./mapbox-provider";

interface StaticMapProps {
  /** Address string to geocode and display. */
  address: string;
  /** Image width (px). Max 1280. */
  width?: number;
  /** Image height (px). Max 1280. */
  height?: number;
  /** Zoom level. Default 15. */
  zoom?: number;
  /** Alt text. */
  alt?: string;
  /** Additional className for the img. */
  className?: string;
}

/**
 * Displays a Mapbox Static Map image for an address.
 * Geocodes the address client-side, then renders the static image.
 * Uses the dark-v11 style to match the Obsidian theme.
 */
export function StaticMap({
  address,
  width = 640,
  height = 320,
  zoom = 15,
  alt,
  className = "h-full w-full object-cover",
}: StaticMapProps) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;

    async function geocodeAndBuild() {
      try {
        const geoUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${MAPBOX_ACCESS_TOKEN}&limit=1`;
        const res = await fetch(geoUrl);
        const data = await res.json();
        const [lng, lat] = data?.features?.[0]?.center ?? [];
        if (cancelled || lng == null || lat == null) return;

        const w = Math.min(width, 1280);
        const h = Math.min(height, 1280);
        const marker = `pin-s+10B981(${lng},${lat})`;
        const staticUrl = `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/${marker}/${lng},${lat},${zoom},0/${w}x${h}@2x?access_token=${MAPBOX_ACCESS_TOKEN}`;
        setUrl(staticUrl);
      } catch {
        // Fail silently — no map shown
      }
    }

    geocodeAndBuild();
    return () => { cancelled = true; };
  }, [address, width, height, zoom]);

  if (!url) {
    return <div className={`${className} bg-[#0a0a0a]`} />;
  }

  return (
    <img
      src={url}
      alt={alt ?? address}
      className={className}
      loading="lazy"
    />
  );
}

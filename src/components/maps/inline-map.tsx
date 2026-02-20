"use client";

import { Map, Marker } from "@vis.gl/react-google-maps";
import { useGoogleMaps } from "./google-maps-provider";
import { OBSIDIAN_MAP_STYLES } from "./obsidian-map-styles";
import { MapOfflineFallback } from "./map-offline-fallback";

const INLINE_MARKER_ICON: google.maps.Symbol = {
  path: google.maps.SymbolPath.CIRCLE,
  scale: 7,
  fillColor: "#10B981",
  fillOpacity: 1,
  strokeColor: "#27272a",
  strokeWeight: 1,
};

interface InlineMapProps {
  lat: number;
  lng: number;
  zoom?: number;
  className?: string;
  interactive?: boolean;
}

/** PRD: single-location map with emerald dot; Obsidian dark style. */
export function InlineMap({
  lat,
  lng,
  zoom = 15,
  className = "h-full w-full",
  interactive = false,
}: InlineMapProps) {
  const { isLoaded, loadError } = useGoogleMaps();
  const center = { lat, lng };

  if (loadError) {
    return (
      <div
        className={`${className} flex items-center justify-center rounded-xl border border-white/5 bg-zinc-950`}
      >
        <MapOfflineFallback message="Map Offline" />
      </div>
    );
  }

  if (!isLoaded) {
    return <div className={`${className} skeleton-shimmer rounded-xl bg-[#0a0a0a]`} />;
  }

  return (
    <Map
      className={className}
      defaultCenter={center}
      defaultZoom={zoom}
      center={center}
      zoom={zoom}
      style={{ width: "100%", height: "100%" }}
      styles={OBSIDIAN_MAP_STYLES}
      disableDefaultUI
      zoomControl={false}
      mapTypeControl={false}
      streetViewControl={false}
      fullscreenControl={false}
      clickableIcons={false}
      gestureHandling={interactive ? "greedy" : "none"}
      backgroundColor="#050505"
    >
      <Marker position={center} icon={INLINE_MARKER_ICON} />
    </Map>
  );
}

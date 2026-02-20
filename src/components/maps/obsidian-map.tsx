"use client";

import { Map, Marker, useMap } from "@vis.gl/react-google-maps";
import { useGoogleMaps } from "./google-maps-provider";
import { useCallback, useEffect, type ReactNode } from "react";
import { OBSIDIAN_MAP_STYLES } from "./obsidian-map-styles";
import { MapOfflineFallback } from "./map-offline-fallback";

interface ObsidianMapProps {
  center: { lat: number; lng: number };
  zoom?: number;
  className?: string;
  children?: ReactNode;
  options?: Partial<google.maps.MapOptions>;
  onLoad?: (map: google.maps.Map) => void;
  interactive?: boolean;
}

function MapOnLoad({ onLoad }: { onLoad?: (map: google.maps.Map) => void }) {
  const map = useMap();
  useEffect(() => {
    if (map) onLoad?.(map);
  }, [map, onLoad]);
  return null;
}

export function ObsidianMap({
  center,
  zoom = 13,
  className = "h-full w-full",
  children,
  options = {},
  onLoad,
  interactive = true,
}: ObsidianMapProps) {
  const { isLoaded, loadError } = useGoogleMaps();

  if (loadError) {
    return (
      <div className={`${className} flex items-center justify-center rounded-xl border border-white/5 bg-zinc-950`}>
        <MapOfflineFallback message="Map Offline" />
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className={`${className} skeleton-shimmer rounded-xl bg-[#0a0a0a]`} />
    );
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
      <MapOnLoad onLoad={onLoad} />
      {children}
    </Map>
  );
}

interface MapPinProps {
  position: { lat: number; lng: number };
  color?: string;
  label?: string;
  pulsing?: boolean;
  onClick?: () => void;
}

const EMERALD_PIN_ICON: google.maps.Symbol = {
  path: google.maps.SymbolPath.CIRCLE,
  scale: 7,
  fillColor: "#10B981",
  fillOpacity: 1,
  strokeColor: "#050505",
  strokeWeight: 1,
};

/** PRD: custom marker (emerald dot). Use inside ObsidianMap. */
export function MapPin({
  position,
  label,
  onClick,
}: MapPinProps) {
  return (
    <Marker
      position={position}
      icon={EMERALD_PIN_ICON}
      title={label ?? undefined}
      onClick={onClick}
    />
  );
}

export { OBSIDIAN_MAP_STYLES };
export const DARK_MAP_STYLES = OBSIDIAN_MAP_STYLES;
export const DEFAULT_MAP_OPTIONS = {
  styles: OBSIDIAN_MAP_STYLES,
  disableDefaultUI: true,
  zoomControl: false,
  mapTypeControl: false,
  streetViewControl: false,
  fullscreenControl: false,
  clickableIcons: false,
  gestureHandling: "greedy" as const,
  backgroundColor: "#050505",
};

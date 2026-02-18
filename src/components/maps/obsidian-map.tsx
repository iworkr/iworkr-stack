"use client";

import { GoogleMap, Marker, OverlayView } from "@react-google-maps/api";
import { useGoogleMaps } from "./google-maps-provider";
import { useCallback, useState, type ReactNode } from "react";

const DARK_MAP_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#0a0a0a" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#52525b" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0a0a0a" }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#27272a" }] },
  { featureType: "administrative.land_parcel", stylers: [{ visibility: "off" }] },
  { featureType: "administrative.neighborhood", stylers: [{ visibility: "off" }] },
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#0a0a0a" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#18181b" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#27272a" }] },
  { featureType: "road", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#1c1c1e" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#27272a" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#050505" }] },
  { featureType: "water", elementType: "labels", stylers: [{ visibility: "off" }] },
];

const DEFAULT_MAP_OPTIONS: google.maps.MapOptions = {
  styles: DARK_MAP_STYLES,
  disableDefaultUI: true,
  zoomControl: false,
  mapTypeControl: false,
  streetViewControl: false,
  fullscreenControl: false,
  clickableIcons: false,
  gestureHandling: "greedy",
  backgroundColor: "#050505",
};

interface ObsidianMapProps {
  center: { lat: number; lng: number };
  zoom?: number;
  className?: string;
  children?: ReactNode;
  options?: Partial<google.maps.MapOptions>;
  onLoad?: (map: google.maps.Map) => void;
  interactive?: boolean;
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
  const { isLoaded } = useGoogleMaps();
  const [, setMap] = useState<google.maps.Map | null>(null);

  const handleLoad = useCallback(
    (map: google.maps.Map) => {
      setMap(map);
      onLoad?.(map);
    },
    [onLoad]
  );

  if (!isLoaded) {
    return (
      <div className={`${className} skeleton-shimmer rounded-xl bg-[#0a0a0a]`} />
    );
  }

  return (
    <GoogleMap
      mapContainerClassName={className}
      center={center}
      zoom={zoom}
      onLoad={handleLoad}
      options={{
        ...DEFAULT_MAP_OPTIONS,
        ...options,
        gestureHandling: interactive ? "greedy" : "none",
      }}
    >
      {children}
    </GoogleMap>
  );
}

interface MapPinProps {
  position: { lat: number; lng: number };
  color?: string;
  label?: string;
  pulsing?: boolean;
  onClick?: () => void;
}

export function MapPin({ position, color = "bg-emerald-500", label, pulsing = false, onClick }: MapPinProps) {
  return (
    <OverlayView position={position} mapPaneName={OverlayView.FLOAT_PANE}>
      <div className="relative cursor-pointer" onClick={onClick}>
        {pulsing && (
          <div className={`absolute -inset-1 animate-ping rounded-full ${color} opacity-30`} />
        )}
        <div className={`relative h-3 w-3 rounded-full ${color} ring-2 ring-black shadow-lg`} />
        {label && (
          <div className="absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-zinc-900/95 px-1.5 py-0.5 text-[8px] font-medium text-zinc-300 shadow-lg backdrop-blur-sm">
            {label}
          </div>
        )}
      </div>
    </OverlayView>
  );
}

export { DARK_MAP_STYLES, DEFAULT_MAP_OPTIONS };

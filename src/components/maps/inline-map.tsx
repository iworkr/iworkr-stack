"use client";

import { GoogleMap, Marker } from "@react-google-maps/api";
import { useGoogleMaps } from "./google-maps-provider";
import { useCallback, useState } from "react";

const DARK_STYLES: google.maps.MapTypeStyle[] = [
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

const MAP_OPTIONS: google.maps.MapOptions = {
  styles: DARK_STYLES,
  disableDefaultUI: true,
  zoomControl: false,
  mapTypeControl: false,
  streetViewControl: false,
  fullscreenControl: false,
  clickableIcons: false,
  gestureHandling: "none",
  backgroundColor: "#050505",
  keyboardShortcuts: false,
};

interface InlineMapProps {
  lat: number;
  lng: number;
  zoom?: number;
  className?: string;
  interactive?: boolean;
}

export function InlineMap({ lat, lng, zoom = 15, className = "h-full w-full", interactive = false }: InlineMapProps) {
  const { isLoaded } = useGoogleMaps();
  const [map, setMap] = useState<google.maps.Map | null>(null);

  const onLoad = useCallback((m: google.maps.Map) => setMap(m), []);

  if (!isLoaded) {
    return <div className={`${className} skeleton-shimmer bg-[#0a0a0a]`} />;
  }

  const center = { lat, lng };

  return (
    <GoogleMap
      mapContainerClassName={className}
      center={center}
      zoom={zoom}
      onLoad={onLoad}
      options={{ ...MAP_OPTIONS, gestureHandling: interactive ? "greedy" : "none" }}
    >
      <Marker
        position={center}
        icon={{
          path: google.maps.SymbolPath.CIRCLE,
          scale: 7,
          fillColor: "#10B981",
          fillOpacity: 1,
          strokeColor: "#000000",
          strokeWeight: 2,
        }}
      />
    </GoogleMap>
  );
}

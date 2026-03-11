"use client";

import { useEffect, useRef } from "react";
import { useMapbox, MAPBOX_ACCESS_TOKEN } from "./mapbox-provider";
import { OBSIDIAN_MAP_STYLE, applyObsidianStyle } from "./obsidian-map-styles";
import { MapOfflineFallback } from "./map-offline-fallback";

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
  const { isLoaded, loadError } = useMapbox();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (!isLoaded || !containerRef.current || mapRef.current) return;

    let cancelled = false;

    import("mapbox-gl").then((mod) => {
      if (cancelled || !containerRef.current) return;
      const mapboxgl = mod.default;
      mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;

      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: OBSIDIAN_MAP_STYLE,
        center: [lng, lat],
        zoom,
        interactive,
        attributionControl: false,
        logoPosition: "bottom-left",
        fadeDuration: 0,
      });

      applyObsidianStyle(map);

      // Add emerald dot marker
      const el = document.createElement("div");
      el.className = "mapbox-inline-marker";
      el.style.cssText = `
        width: 12px; height: 12px; border-radius: 50%;
        background: #10B981;
        border: 2px solid #09090b;
        box-shadow: 0 0 0 2px rgba(16,185,129,0.2);
      `;

      new mapboxgl.Marker({ element: el })
        .setLngLat([lng, lat])
        .addTo(map);

      // Hide Mapbox logo for cleaner look
      map.on("load", () => {
        const logo = containerRef.current?.querySelector(".mapboxgl-ctrl-logo");
        if (logo) (logo as HTMLElement).style.display = "none";
      });

      mapRef.current = map;
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [isLoaded, lat, lng, zoom, interactive]);

  if (loadError) {
    return (
      <div className={`${className} flex items-center justify-center rounded-xl border border-white/5 bg-zinc-950`}>
        <MapOfflineFallback message="Map Offline" />
      </div>
    );
  }

  if (!isLoaded) {
    return <div className={`${className} skeleton-shimmer rounded-xl bg-[#0a0a0a]`} />;
  }

  return (
    <div
      ref={containerRef}
      className={`${className} rounded-xl overflow-hidden [&_.mapboxgl-ctrl-bottom-left]:hidden [&_.mapboxgl-ctrl-bottom-right]:hidden`}
      style={{ background: "#050505" }}
    />
  );
}

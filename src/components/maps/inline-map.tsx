/**
 * @component InlineMap
 * @status COMPLETE
 * @description Renders an interactive Mapbox GL map with Obsidian-styled markers.
 *   Supports flyTo animation on coordinate changes, draggable markers with
 *   onMarkerDragEnd callback, and optional marker hiding.
 * @lastAudit 2026-03-26
 */
"use client";

import { useEffect, useRef, useCallback } from "react";
import { useMapbox, MAPBOX_ACCESS_TOKEN } from "./mapbox-provider";
import { OBSIDIAN_MAP_STYLE, applyObsidianStyle } from "./obsidian-map-styles";
import { MapOfflineFallback } from "./map-offline-fallback";

interface InlineMapProps {
  lat: number;
  lng: number;
  zoom?: number;
  className?: string;
  interactive?: boolean;
  /** If true, the marker can be dragged to micro-adjust position */
  draggable?: boolean;
  /** Fires when the user finishes dragging the marker */
  onMarkerDragEnd?: (coords: { lat: number; lng: number }) => void;
  /** If true, no marker is rendered (useful for empty/default state) */
  hideMarker?: boolean;
  /** Called once the map instance is ready */
  onMapReady?: (map: mapboxgl.Map) => void;
}

/** PRD: single-location map with emerald dot; Obsidian dark style. FlyTo on coord change. */
export function InlineMap({
  lat,
  lng,
  zoom = 15,
  className = "h-full w-full",
  interactive = false,
  draggable = false,
  onMarkerDragEnd,
  hideMarker = false,
  onMapReady,
}: InlineMapProps) {
  const { isLoaded, loadError } = useMapbox();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const markerElRef = useRef<HTMLDivElement | null>(null);
  const initializedRef = useRef(false);

  // Stable callback refs to avoid effect churn
  const onMarkerDragEndRef = useRef(onMarkerDragEnd);
  onMarkerDragEndRef.current = onMarkerDragEnd;
  const onMapReadyRef = useRef(onMapReady);
  onMapReadyRef.current = onMapReady;

  /* ── Create marker element ─────────────────────────────── */
  const createMarkerElement = useCallback(() => {
    const el = document.createElement("div");
    el.className = "mapbox-inline-marker";
    el.style.cssText = `
      width: 14px; height: 14px; border-radius: 50%;
      background: #10B981;
      border: 2px solid #09090b;
      box-shadow: 0 0 0 3px rgba(16,185,129,0.25);
      transition: box-shadow 0.3s ease;
      cursor: ${draggable ? "grab" : "default"};
    `;
    return el;
  }, [draggable]);

  /* ── Pulse animation on the marker ─────────────────────── */
  const pulseMarker = useCallback(() => {
    if (!markerElRef.current) return;
    const el = markerElRef.current;
    el.style.boxShadow = "0 0 0 8px rgba(16,185,129,0.4)";
    setTimeout(() => {
      el.style.boxShadow = "0 0 0 3px rgba(16,185,129,0.25)";
    }, 600);
  }, []);

  /* ── Initialize map (once) ─────────────────────────────── */
  useEffect(() => {
    if (!isLoaded || !containerRef.current || initializedRef.current) return;

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

      // Create marker (unless hidden)
      if (!hideMarker) {
        const el = createMarkerElement();
        markerElRef.current = el;

        const marker = new mapboxgl.Marker({ element: el, draggable })
          .setLngLat([lng, lat])
          .addTo(map);

        if (draggable) {
          marker.on("dragend", () => {
            const lngLat = marker.getLngLat();
            onMarkerDragEndRef.current?.({ lat: lngLat.lat, lng: lngLat.lng });
            pulseMarker();
          });
        }

        markerRef.current = marker;
      }

      // Hide Mapbox logo for cleaner look
      map.on("load", () => {
        const logo = containerRef.current?.querySelector(".mapboxgl-ctrl-logo");
        if (logo) (logo as HTMLElement).style.display = "none";
        onMapReadyRef.current?.(map);
      });

      mapRef.current = map;
      initializedRef.current = true;
    });

    return () => {
      cancelled = true;
    };
    // Only run on mount — coordinate updates handled by the next effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded]);

  /* ── FlyTo on coordinate change ────────────────────────── */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !initializedRef.current) return;

    // FlyTo the new position
    map.flyTo({
      center: [lng, lat],
      zoom,
      essential: true,
      duration: 1200,
      curve: 1.2,
    });

    // Update or create marker
    if (!hideMarker) {
      if (markerRef.current) {
        markerRef.current.setLngLat([lng, lat]);
      } else {
        // Marker was hidden, now needs to appear
        import("mapbox-gl").then((mod) => {
          const mapboxgl = mod.default;
          const el = createMarkerElement();
          markerElRef.current = el;

          const marker = new mapboxgl.Marker({ element: el, draggable })
            .setLngLat([lng, lat])
            .addTo(map);

          if (draggable) {
            marker.on("dragend", () => {
              const lngLat = marker.getLngLat();
              onMarkerDragEndRef.current?.({ lat: lngLat.lat, lng: lngLat.lng });
              pulseMarker();
            });
          }

          markerRef.current = marker;
        });
      }

      // Pulse after flyTo completes
      setTimeout(pulseMarker, 1200);
    } else {
      // Hide marker if it exists
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
        markerElRef.current = null;
      }
    }
  }, [lat, lng, zoom, hideMarker, draggable, createMarkerElement, pulseMarker]);

  /* ── Update draggable state ────────────────────────────── */
  useEffect(() => {
    if (markerRef.current) {
      markerRef.current.setDraggable(draggable);
      if (markerElRef.current) {
        markerElRef.current.style.cursor = draggable ? "grab" : "default";
      }
    }
  }, [draggable]);

  /* ── Cleanup on unmount ────────────────────────────────── */
  useEffect(() => {
    return () => {
      markerRef.current?.remove();
      markerRef.current = null;
      markerElRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      initializedRef.current = false;
    };
  }, []);

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

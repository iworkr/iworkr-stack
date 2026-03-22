/**
 * @component MapboxProvider
 * @status COMPLETE
 * @description Context provider that lazy-loads the Mapbox GL JS SDK and exposes readiness state
 * @lastAudit 2026-03-22
 */
"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

interface MapboxContextValue {
  isLoaded: boolean;
  loadError: Error | undefined;
  accessToken: string;
}

const MapboxContext = createContext<MapboxContextValue>({
  isLoaded: false,
  loadError: undefined,
  accessToken: "",
});

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ?? "";

/**
 * Ensures the Mapbox GL CSS is loaded before resolving.
 * Without this CSS, the map canvas has zero dimensions → black screen.
 */
function ensureMapboxCSS(): Promise<void> {
  return new Promise((resolve) => {
    const existing = document.getElementById("mapbox-gl-css") as HTMLLinkElement | null;
    if (existing) {
      // Already loaded or loading — check if complete
      if (existing.sheet) {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      // Fallback: if it never fires (already loaded), resolve after a tick
      setTimeout(resolve, 100);
      return;
    }

    const link = document.createElement("link");
    link.id = "mapbox-gl-css";
    link.rel = "stylesheet";
    link.href = "https://api.mapbox.com/mapbox-gl-js/v3.9.4/mapbox-gl.css";
    link.addEventListener("load", () => resolve(), { once: true });
    link.addEventListener("error", () => resolve(), { once: true }); // Don't block on CSS error
    document.head.appendChild(link);
  });
}

export function MapboxProvider({ children }: { children: ReactNode }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<Error | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    // Wait for BOTH the CSS and the JS module to load before setting isLoaded
    Promise.all([
      ensureMapboxCSS(),
      import("mapbox-gl"),
    ])
      .then(([, mod]) => {
        if (cancelled) return;
        const mapboxgl = mod.default;
        mapboxgl.accessToken = MAPBOX_TOKEN;
        setIsLoaded(true);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err : new Error(String(err)));
      });

    return () => { cancelled = true; };
  }, []);

  return (
    <MapboxContext.Provider value={{ isLoaded, loadError, accessToken: MAPBOX_TOKEN }}>
      {children}
    </MapboxContext.Provider>
  );
}

export function useMapbox() {
  return useContext(MapboxContext);
}

/** Mapbox access token — use in components that create maps directly */
export const MAPBOX_ACCESS_TOKEN = MAPBOX_TOKEN;

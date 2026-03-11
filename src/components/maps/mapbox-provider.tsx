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

export function MapboxProvider({ children }: { children: ReactNode }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<Error | undefined>(undefined);

  useEffect(() => {
    // Inject Mapbox GL CSS via link element (no TS type declarations needed)
    if (!document.getElementById("mapbox-gl-css")) {
      const link = document.createElement("link");
      link.id = "mapbox-gl-css";
      link.rel = "stylesheet";
      link.href = "https://api.mapbox.com/mapbox-gl-js/v3.9.4/mapbox-gl.css";
      document.head.appendChild(link);
    }

    // Verify mapbox-gl loads
    import("mapbox-gl")
      .then((mod) => {
        const mapboxgl = mod.default;
        mapboxgl.accessToken = MAPBOX_TOKEN;
        setIsLoaded(true);
      })
      .catch((err) => {
        setLoadError(err instanceof Error ? err : new Error(String(err)));
      });
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

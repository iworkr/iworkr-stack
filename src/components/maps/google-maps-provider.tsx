"use client";

import {
  APIProvider,
  useApiIsLoaded,
} from "@vis.gl/react-google-maps";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

interface GoogleMapsContextValue {
  isLoaded: boolean;
  loadError: Error | undefined;
}

const GoogleMapsContext = createContext<GoogleMapsContextValue>({
  isLoaded: false,
  loadError: undefined,
});

/** Bridges @vis.gl API state into our legacy context (isLoaded / loadError). */
function GoogleMapsContextBridge({
  loadError,
  children,
}: {
  loadError: Error | undefined;
  children: ReactNode;
}) {
  const apiIsLoaded = useApiIsLoaded();
  const value: GoogleMapsContextValue = {
    isLoaded: apiIsLoaded,
    loadError: loadError ?? undefined,
  };
  return (
    <GoogleMapsContext.Provider value={value}>
      {children}
    </GoogleMapsContext.Provider>
  );
}

const NO_API_KEY_MSG =
  "Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY. Set it in .env.local and restrict it in Google Cloud Console.";

export function GoogleMapsProvider({ children }: { children: ReactNode }) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? "";
  const [loadError, setLoadError] = useState<Error | undefined>(undefined);

  const onError = useCallback((error: unknown) => {
    setLoadError(
      error instanceof Error ? error : new Error(String(error))
    );
  }, []);

  // No key: do NOT render APIProvider or any Google iframe; provide error so consumers show Map Offline.
  if (!apiKey) {
    return (
      <GoogleMapsContext.Provider
        value={{
          isLoaded: false,
          loadError: new Error(NO_API_KEY_MSG),
        }}
      >
        {children}
      </GoogleMapsContext.Provider>
    );
  }

  return (
    <APIProvider apiKey={apiKey} onError={onError}>
      <GoogleMapsContextBridge loadError={loadError}>
        {children}
      </GoogleMapsContextBridge>
    </APIProvider>
  );
}

export function useGoogleMaps() {
  return useContext(GoogleMapsContext);
}

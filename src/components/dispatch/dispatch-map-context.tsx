"use client";

import { createContext, useContext } from "react";
import type mapboxgl from "mapbox-gl";

/**
 * Shared Mapbox map instance for the Dispatch page.
 * Unlike Google Maps where child components live inside <Map>,
 * Mapbox components use this context to access the map instance.
 */
const DispatchMapContext = createContext<mapboxgl.Map | null>(null);

export const DispatchMapProvider = DispatchMapContext.Provider;

export function useDispatchMap(): mapboxgl.Map | null {
  return useContext(DispatchMapContext);
}

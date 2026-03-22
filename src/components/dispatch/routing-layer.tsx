/**
 * @component RoutingLayer
 * @status COMPLETE
 * @description Mapbox routing layer that renders driving-direction polylines between technicians and jobs
 * @lastAudit 2026-03-22
 */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDispatchMap } from "./dispatch-map-context";
import { MAPBOX_ACCESS_TOKEN } from "@/components/maps/mapbox-provider";
import type { DispatchPin } from "@/app/actions/dashboard";

const DEVIATION_METERS = 500;

interface JobWithCoords {
  id: string;
  location_lat: number | null;
  location_lng: number | null;
}

interface RoutingLayerProps {
  dispatchPins: DispatchPin[];
  jobs: JobWithCoords[];
  visible: boolean;
}

interface CachedRoute {
  path: [number, number][]; // [lng, lat][]
  originLat: number;
  originLng: number;
}

function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function RoutingLayer({ dispatchPins, jobs, visible }: RoutingLayerProps) {
  const map = useDispatchMap();
  const [routes, setRoutes] = useState<Map<string, CachedRoute>>(new Map());
  const cacheRef = useRef<Map<string, CachedRoute>>(new Map());
  const sourceIdsRef = useRef<Set<string>>(new Set());

  const jobMap = useMemo(() => new Map(jobs.map((j) => [j.id, j])), [jobs]);

  const enRoutePins = useMemo(
    () => dispatchPins.filter((p) => p.dispatch_status === "en_route" && p.location_lat != null && p.location_lng != null),
    [dispatchPins]
  );

  const fetchRoute = useCallback(
    async (origin: { lat: number; lng: number }, destination: { lat: number; lng: number }, key: string) => {
      try {
        const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?geometries=geojson&overview=full&access_token=${MAPBOX_ACCESS_TOKEN}`;
        const res = await fetch(url);
        const data = await res.json();
        const coords = data?.routes?.[0]?.geometry?.coordinates;
        if (!coords || coords.length < 2) return;
        const cached: CachedRoute = {
          path: coords as [number, number][],
          originLat: origin.lat,
          originLng: origin.lng,
        };
        cacheRef.current.set(key, cached);
        setRoutes(new Map(cacheRef.current));
      } catch {
        // Silently fail — route won't render
      }
    },
    []
  );

  // Fetch routes for en-route techs
  useEffect(() => {
    if (!visible || !map) return;
    enRoutePins.forEach((pin) => {
      const job = jobMap.get(pin.id);
      if (!job?.location_lat || !job?.location_lng) return;
      const origin = { lat: pin.location_lat!, lng: pin.location_lng! };
      const dest = { lat: job.location_lat, lng: job.location_lng };
      if (haversineMeters(origin, dest) < 20) return;
      const key = `${pin.technician_id ?? pin.id}-${pin.id}`;
      const cached = cacheRef.current.get(key);
      if (cached && haversineMeters(origin, { lat: cached.originLat, lng: cached.originLng }) <= DEVIATION_METERS) return;
      fetchRoute(origin, dest, key);
    });
  }, [map, visible, enRoutePins, jobMap, fetchRoute]);

  // Render routes as Mapbox sources+layers
  useEffect(() => {
    if (!map) return;

    // Remove old route layers/sources
    sourceIdsRef.current.forEach((id) => {
      try { map.removeLayer(`${id}-line`); } catch {}
      try { map.removeSource(id); } catch {}
    });
    sourceIdsRef.current.clear();

    if (!visible) return;

    enRoutePins.forEach((pin) => {
      const key = `${pin.technician_id ?? pin.id}-${pin.id}`;
      const cached = routes.get(key);
      if (!cached || cached.path.length < 2) return;

      const sourceId = `route-${key}`;
      sourceIdsRef.current.add(sourceId);

      try {
        map.addSource(sourceId, {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: { type: "LineString", coordinates: cached.path },
          },
        });

        map.addLayer({
          id: `${sourceId}-line`,
          type: "line",
          source: sourceId,
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": "#10B981",
            "line-width": 3,
            "line-opacity": 0.8,
          },
        });
      } catch {
        // Layer might already exist during hot updates
      }
    });
  }, [map, visible, routes, enRoutePins]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (!map) return;
      sourceIdsRef.current.forEach((id) => {
        try { map.removeLayer(`${id}-line`); } catch {}
        try { map.removeSource(id); } catch {}
      });
    };
  }, [map]);

  return null;
}

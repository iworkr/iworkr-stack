"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMap } from "@vis.gl/react-google-maps";
import { MapPolyline } from "./map-polyline";
import type { DispatchPin } from "@/app/actions/dashboard";

const DEVIATION_METERS = 500;
/* PRD §4.1: z-10 for geographic overlays (routes, footprints) */
const ROUTE_Z_INDEX = 10;

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
  path: google.maps.LatLngLiteral[];
  originLat: number;
  originLng: number;
}

function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R * c;
}

function getRouteArrowIcons(): google.maps.IconSequence[] | null {
  if (typeof globalThis === "undefined") return null;
  const g = (globalThis as { google?: { maps?: { SymbolPath?: typeof google.maps.SymbolPath } } }).google;
  if (!g?.maps?.SymbolPath) return null;
  return [
    {
      icon: {
        path: g.maps.SymbolPath.FORWARD_CLOSED_ARROW,
        scale: 2.5,
        fillColor: "#10B981",
        fillOpacity: 0.9,
        strokeColor: "#052e16",
        strokeWeight: 1,
      },
      repeat: "100px",
    },
  ];
}

export function RoutingLayer({ dispatchPins, jobs, visible }: RoutingLayerProps) {
  const map = useMap();
  const routeArrowIcons = useMemo(() => getRouteArrowIcons(), []);
  const [routes, setRoutes] = useState<Map<string, CachedRoute>>(new Map());
  const cacheRef = useRef<Map<string, CachedRoute>>(new Map());
  const directionsRef = useRef<google.maps.DirectionsService | null>(null);

  const jobMap = useMemo(() => new Map(jobs.map((j) => [j.id, j])), [jobs]);

  const enRoutePins = useMemo(
    () =>
      dispatchPins.filter(
        (p) =>
          p.dispatch_status === "en_route" &&
          p.location_lat != null &&
          p.location_lng != null
      ),
    [dispatchPins]
  );

  const fetchRoute = useCallback(
    (
      origin: { lat: number; lng: number },
      destination: { lat: number; lng: number },
      key: string
    ) => {
      if (!map) return;
      const g = (globalThis as { google?: typeof google }).google;
      if (!directionsRef.current && g?.maps?.DirectionsService) {
        directionsRef.current = new g.maps.DirectionsService();
      }
      const svc = directionsRef.current;
      if (!svc || !g) return;
      svc.route(
        {
          origin,
          destination,
          travelMode: g.maps.TravelMode.DRIVING,
        },
        (result, status) => {
          const gm = (globalThis as { google?: typeof google }).google;
          if (!gm?.maps?.DirectionsStatus || status !== gm.maps.DirectionsStatus.OK || !result?.routes?.[0]) return;
          const route = result.routes[0];
          const path = route.overview_path ?? [];
          if (path.length < 2) return;
          const flatPath: google.maps.LatLngLiteral[] = (path as google.maps.LatLng[]).map((ll) => ({
            lat: ll.lat(),
            lng: ll.lng(),
          }));
          const cached: CachedRoute = {
            path: flatPath,
            originLat: origin.lat,
            originLng: origin.lng,
          };
          cacheRef.current.set(key, cached);
          setRoutes(new Map(cacheRef.current));
        }
      );
    },
    [map]
  );

  useEffect(() => {
    if (!visible || !map) return;
    enRoutePins.forEach((pin) => {
      const job = jobMap.get(pin.id);
      if (!job?.location_lat || !job?.location_lng) return;
      const origin = { lat: pin.location_lat!, lng: pin.location_lng! };
      const dest = { lat: job.location_lat, lng: job.location_lng };
      const dist = haversineMeters(origin, dest);
      if (dist < 20) return; // same point, skip
      const key = `${pin.technician_id ?? pin.id}-${pin.id}`;
      const cached = cacheRef.current.get(key);
      if (cached) {
        const deviation = haversineMeters(origin, { lat: cached.originLat, lng: cached.originLng });
        if (deviation <= DEVIATION_METERS) return; // use cache
      }
      fetchRoute(origin, dest, key);
    });
  }, [map, visible, enRoutePins, jobMap, fetchRoute]);

  if (!visible) return null;

  return (
    <>
      {enRoutePins.map((pin) => {
        const key = `${pin.technician_id ?? pin.id}-${pin.id}`;
        const cached = routes.get(key);
        if (!cached || cached.path.length < 2) return null;
        return (
          <MapPolyline
            key={`route-${key}`}
            path={cached.path}
            strokeColor="#10B981"
            strokeOpacity={0.8}
            strokeWeight={3}
            geodesic={false}
            icons={routeArrowIcons ?? undefined}
            zIndex={ROUTE_Z_INDEX}
          />
        );
      })}
    </>
  );
}

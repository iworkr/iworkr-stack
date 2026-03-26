/**
 * @module RoutingService
 * @description Project Outrider-Apex routing utilities for Mapbox Optimization/Matrix APIs
 */

export interface RoutingStop {
  id: string;
  title: string;
  lat: number;
  lng: number;
  durationSeconds: number;
  isTimePinned: boolean;
  isSupplierWaypoint: boolean;
  startTime?: string;
  endTime?: string;
}

export interface RoutingLeg {
  duration: number;
  distance: number;
}

export interface OptimizedRouteResult {
  orderedStops: RoutingStop[];
  tripGeometryPolyline: string | null;
  tripGeometryGeoJson: GeoJSON.Feature<GeoJSON.LineString> | null;
  totalDurationSeconds: number;
  totalDistanceMeters: number;
  legs: RoutingLeg[];
}

interface OptimizationOptions {
  token: string;
  startCoord?: [number, number] | null;
  endCoord?: [number, number] | null;
  respectPinned?: boolean;
}

function decodePolyline6(encoded: string): [number, number][] {
  const coords: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b: number;
    let shift = 0;
    let result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += (result & 1) !== 0 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += (result & 1) !== 0 ? ~(result >> 1) : result >> 1;

    coords.push([lng / 1e6, lat / 1e6]);
  }

  return coords;
}

async function callOptimizationApi(
  stops: RoutingStop[],
  token: string,
  sourceFirst: boolean,
  destinationLast: boolean
): Promise<{ orderedStops: RoutingStop[]; geometry: string | null }> {
  const coordString = stops.map((s) => `${s.lng},${s.lat}`).join(";");
  let url = `https://api.mapbox.com/optimized-trips/v1/mapbox/driving/${coordString}`;
  url += `?access_token=${token}&geometries=polyline6&overview=full&roundtrip=false`;
  if (sourceFirst) url += "&source=first";
  if (destinationLast) url += "&destination=last";

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Optimization failed (${response.status})`);
  const payload = await response.json();
  if (payload?.code !== "Ok") throw new Error(payload?.message || "Optimization rejected");

  const waypoints: Array<{ waypoint_index: number }> = payload.waypoints || [];
  if (!Array.isArray(waypoints) || waypoints.length !== stops.length) {
    return { orderedStops: stops, geometry: payload?.trips?.[0]?.geometry || null };
  }

  const reordered = waypoints
    .map((wp, originalIndex) => ({ wpIndex: wp.waypoint_index, stop: stops[originalIndex] }))
    .sort((a, b) => a.wpIndex - b.wpIndex)
    .map((entry) => entry.stop);

  return {
    orderedStops: reordered,
    geometry: payload?.trips?.[0]?.geometry || null,
  };
}

async function callMatrixApi(
  stops: RoutingStop[],
  token: string
): Promise<{ legs: RoutingLeg[]; totalDurationSeconds: number; totalDistanceMeters: number }> {
  if (stops.length < 2) return { legs: [], totalDurationSeconds: 0, totalDistanceMeters: 0 };

  const coordString = stops.map((s) => `${s.lng},${s.lat}`).join(";");
  const url =
    `https://api.mapbox.com/directions-matrix/v1/mapbox/driving/${coordString}` +
    `?annotations=duration,distance&access_token=${token}`;

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Matrix failed (${response.status})`);
  const payload = await response.json();

  const durations: number[][] = payload?.durations || [];
  const distances: number[][] = payload?.distances || [];
  const legs: RoutingLeg[] = [];
  let totalDuration = 0;
  let totalDistance = 0;

  for (let i = 0; i < stops.length - 1; i++) {
    const duration = durations?.[i]?.[i + 1] ?? 0;
    const distance = distances?.[i]?.[i + 1] ?? 0;
    legs.push({ duration: Math.max(0, Math.round(duration)), distance: Math.max(0, Math.round(distance)) });
    totalDuration += Math.max(0, duration);
    totalDistance += Math.max(0, distance);
  }

  return {
    legs,
    totalDurationSeconds: Math.round(totalDuration),
    totalDistanceMeters: Math.round(totalDistance),
  };
}

async function callDirectionsForOrderedPath(stops: RoutingStop[], token: string): Promise<string | null> {
  if (stops.length < 2) return null;
  const coordString = stops.map((s) => `${s.lng},${s.lat}`).join(";");
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/driving/${coordString}` +
    `?geometries=polyline6&overview=full&access_token=${token}`;
  const response = await fetch(url);
  if (!response.ok) return null;
  const payload = await response.json();
  return payload?.routes?.[0]?.geometry || null;
}

function splitAroundPinned(stops: RoutingStop[]): RoutingStop[][] {
  const sorted = [...stops].sort((a, b) => {
    const aTime = a.startTime ? new Date(a.startTime).getTime() : 0;
    const bTime = b.startTime ? new Date(b.startTime).getTime() : 0;
    return aTime - bTime;
  });

  const segments: RoutingStop[][] = [];
  let current: RoutingStop[] = [];
  for (const stop of sorted) {
    if (stop.isTimePinned) {
      if (current.length > 0) segments.push(current);
      segments.push([stop]);
      current = [];
    } else {
      current.push(stop);
    }
  }
  if (current.length > 0) segments.push(current);
  return segments;
}

export async function calculateOptimalRoute(
  stops: RoutingStop[],
  options: OptimizationOptions
): Promise<OptimizedRouteResult> {
  const token = options.token;
  const respectPinned = options.respectPinned ?? true;

  const valid = stops.filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng));
  if (valid.length < 2) {
    return {
      orderedStops: valid,
      tripGeometryPolyline: null,
      tripGeometryGeoJson: null,
      totalDurationSeconds: 0,
      totalDistanceMeters: 0,
      legs: [],
    };
  }

  let orderedStops: RoutingStop[] = [];
  let polyline: string | null = null;

  if (!respectPinned || valid.every((s) => !s.isTimePinned)) {
    const optimized = await callOptimizationApi(
      valid,
      token,
      Boolean(options.startCoord),
      Boolean(options.endCoord),
    );
    orderedStops = optimized.orderedStops;
    polyline = optimized.geometry;
  } else {
    const segments = splitAroundPinned(valid);
    for (const segment of segments) {
      if (segment.length === 1 && segment[0].isTimePinned) {
        orderedStops.push(segment[0]);
        continue;
      }
      if (segment.length < 2) {
        orderedStops.push(...segment);
        continue;
      }
      const optimized = await callOptimizationApi(segment, token, false, false);
      orderedStops.push(...optimized.orderedStops);
    }
    polyline = await callDirectionsForOrderedPath(orderedStops, token);
  }

  const matrix = await callMatrixApi(orderedStops, token);
  const coordinates = polyline ? decodePolyline6(polyline) : orderedStops.map((s) => [s.lng, s.lat] as [number, number]);

  return {
    orderedStops,
    tripGeometryPolyline: polyline,
    tripGeometryGeoJson:
      coordinates.length > 1
        ? {
            type: "Feature",
            properties: {},
            geometry: {
              type: "LineString",
              coordinates,
            },
          }
        : null,
    totalDurationSeconds: matrix.totalDurationSeconds,
    totalDistanceMeters: matrix.totalDistanceMeters,
    legs: matrix.legs,
  };
}

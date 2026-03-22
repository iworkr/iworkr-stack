/**
 * @component FootprintsLayer
 * @status COMPLETE
 * @description Mapbox layer rendering technician trail breadcrumbs with time-based opacity gradients
 * @lastAudit 2026-03-22
 */
"use client";

import { useEffect, useRef } from "react";
import { useDispatchMap } from "./dispatch-map-context";

/** Single trail: ordered breadcrumb points. Optional per-point timestamp for opacity. */
export interface FootprintTrail {
  techId: string;
  path: { lat: number; lng: number }[];
  timestamps?: number[];
}

interface FootprintsLayerProps {
  trails: FootprintTrail[];
  visible: boolean;
}

/** PRD: Ghost trail — Zinc-500, opacity 0.3, weight 2; snap to roads via parent. */
const FOOTPRINT_COLOR = "#71717a";
const FOOTPRINT_OPACITY = 0.3;

export function FootprintsLayer({ trails, visible }: FootprintsLayerProps) {
  const map = useDispatchMap();
  const sourceIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!map) return;

    // Clean up old layers/sources
    sourceIdsRef.current.forEach((id) => {
      try { map.removeLayer(`${id}-line`); } catch {}
      try { map.removeSource(id); } catch {}
    });
    sourceIdsRef.current.clear();

    if (!visible || trails.length === 0) return;

    trails
      .filter((t) => t.path.length >= 2)
      .forEach((trail) => {
        const sourceId = `footprint-${trail.techId}`;
        sourceIdsRef.current.add(sourceId);

        try {
          map.addSource(sourceId, {
            type: "geojson",
            data: {
              type: "Feature",
              properties: {},
              geometry: {
                type: "LineString",
                coordinates: trail.path.map((p) => [p.lng, p.lat]),
              },
            },
          });

          map.addLayer({
            id: `${sourceId}-line`,
            type: "line",
            source: sourceId,
            layout: { "line-join": "round", "line-cap": "round" },
            paint: {
              "line-color": FOOTPRINT_COLOR,
              "line-width": 2,
              "line-opacity": FOOTPRINT_OPACITY,
              "line-dasharray": [2, 3],
            },
          });
        } catch {
          // Silently skip — layer might already exist
        }
      });
  }, [map, trails, visible]);

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

"use client";

import { MapPolyline } from "./map-polyline";

/** Single trail: ordered breadcrumb points. Optional per-point timestamp for opacity. */
export interface FootprintTrail {
  techId: string;
  path: google.maps.LatLngLiteral[];
  /** If provided, used for gradient opacity (older = more transparent). */
  timestamps?: number[];
}

interface FootprintsLayerProps {
  trails: FootprintTrail[];
  visible: boolean;
}

/** PRD: Ghost trail — Zinc-500, strokeOpacity 0.3, strokeWeight 2; snap to roads via parent. */
/* PRD §4.1: z-10 for geographic overlays (routes, footprints) */
const FOOTPRINT_Z_INDEX = 10;

export function FootprintsLayer({ trails, visible }: FootprintsLayerProps) {
  if (!visible || trails.length === 0) return null;

  return (
    <>
      {trails
        .filter((t) => t.path.length >= 2)
        .map((trail) => (
          <MapPolyline
            key={`foot-${trail.techId}`}
            path={trail.path}
            strokeColor="#71717a"
            strokeOpacity={0.3}
            strokeWeight={2}
            geodesic={false}
            zIndex={FOOTPRINT_Z_INDEX}
          />
        ))}
    </>
  );
}

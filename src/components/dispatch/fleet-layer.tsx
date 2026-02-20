"use client";

import { useMemo } from "react";
import { Marker } from "@vis.gl/react-google-maps";
import type { DispatchPin } from "@/app/actions/dashboard";

/** Heading in degrees (0 = N). Not provided by API; stub 0 or pass from future location stream. */
export interface FleetTech extends DispatchPin {
  heading?: number;
  speedKmh?: number;
}

function getFleetIcons(): { normal: google.maps.Symbol; hover: google.maps.Symbol } | null {
  if (typeof globalThis === "undefined") return null;
  const g = (globalThis as { google?: { maps?: { SymbolPath?: typeof google.maps.SymbolPath } } }).google;
  if (!g?.maps?.SymbolPath) return null;
  return {
    normal: {
      path: g.maps.SymbolPath.CIRCLE,
      scale: 8,
      fillColor: "#10B981",
      fillOpacity: 1,
      strokeColor: "#050505",
      strokeWeight: 1,
    },
    hover: {
      path: g.maps.SymbolPath.CIRCLE,
      scale: 10,
      fillColor: "#10B981",
      fillOpacity: 1,
      strokeColor: "#ffffff",
      strokeWeight: 2,
    },
  };
}

interface FleetLayerProps {
  techs: FleetTech[];
  visible: boolean;
  hoveredId: string | null;
  onHover: (id: string | null) => void;
  /** When set, show hover dialog and anchor for this tech. */
  onHoverTechDetail?: (tech: FleetTech | null, anchor: { lat: number; lng: number } | null) => void;
  /** Tech ID to show brief ripple (e.g. after roster "Locate" click). */
  rippleTechId?: string | null;
}

export function FleetLayer({
  techs,
  visible,
  hoveredId,
  onHover,
  onHoverTechDetail,
  rippleTechId,
}: FleetLayerProps) {
  const icons = useMemo(() => getFleetIcons(), []);
  if (!visible || techs.length === 0 || !icons) return null;

  return (
    <>
      {techs
        .filter((t) => t.location_lat != null && t.location_lng != null)
        .map((tech) => {
          const tid = tech.technician_id ?? tech.id;
          const isHovered = hoveredId === tid;
          const isRipple = rippleTechId === tid;
          return (
            <Marker
              key={tech.id}
              position={{ lat: tech.location_lat!, lng: tech.location_lng! }}
              icon={isHovered ? icons.hover : icons.normal}
              title={
                [tech.name || "Technician", tech.speedKmh != null ? `${tech.speedKmh} km/h` : null, tech.dispatch_status === "on_job" ? "On Job" : "En Route"]
                  .filter(Boolean)
                  .join(" · ")
              }
              onMouseOver={() => {
                onHover(tid);
                onHoverTechDetail?.(tech, { lat: tech.location_lat!, lng: tech.location_lng! });
              }}
              onMouseOut={() => {
                onHover(null);
                onHoverTechDetail?.(null, null);
              }}
              zIndex={isRipple ? 501 : 500}
            />
          );
        })}
    </>
  );
}

"use client";

import { AdvancedMarker } from "@vis.gl/react-google-maps";
import type { DispatchPin } from "@/app/actions/dashboard";

/** Heading in degrees (0 = N). Not provided by API; stub 0 or pass from future location stream. */
export interface FleetTech extends DispatchPin {
  heading?: number;
  speedKmh?: number;
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

/* ── PRD §5.2: Technician Marker — "The Pulse" ──────────
   Emerald-500 dot (w-3 h-3 = 12px), border-2 border-zinc-900,
   with animate-ping sonar aura for live assets.
   ─────────────────────────────────────────────────────── */

export function FleetLayer({
  techs,
  visible,
  hoveredId,
  onHover,
  onHoverTechDetail,
  rippleTechId,
}: FleetLayerProps) {
  if (!visible || techs.length === 0) return null;

  return (
    <>
      {techs
        .filter((t) => t.location_lat != null && t.location_lng != null)
        .map((tech) => {
          const tid = tech.technician_id ?? tech.id;
          const isHovered = hoveredId === tid;
          const isRipple = rippleTechId === tid;
          return (
            <AdvancedMarker
              key={tech.id}
              position={{ lat: tech.location_lat!, lng: tech.location_lng! }}
              title={
                [tech.name || "Technician", tech.speedKmh != null ? `${tech.speedKmh} km/h` : null, tech.dispatch_status === "on_job" ? "On Job" : "En Route"]
                  .filter(Boolean)
                  .join(" · ")
              }
              zIndex={isRipple ? 21 : 20}
              onClick={() => {
                onHover(tid);
                onHoverTechDetail?.(tech, { lat: tech.location_lat!, lng: tech.location_lng! });
              }}
            >
              <div
                className="relative flex items-center justify-center"
                onMouseEnter={() => {
                  onHover(tid);
                  onHoverTechDetail?.(tech, { lat: tech.location_lat!, lng: tech.location_lng! });
                }}
                onMouseLeave={() => {
                  onHover(null);
                  onHoverTechDetail?.(null, null);
                }}
              >
                {/* Sonar ping aura */}
                <div
                  className={`absolute h-6 w-6 rounded-full bg-emerald-500/30 ${
                    isRipple || isHovered ? "animate-ping" : "animate-pulse"
                  }`}
                />
                {/* Core dot */}
                <div
                  className={`relative rounded-full border-2 shadow-lg transition-transform duration-150 ${
                    isHovered
                      ? "h-4 w-4 border-white bg-emerald-500"
                      : "h-3 w-3 border-zinc-900 bg-emerald-500"
                  }`}
                />
              </div>
            </AdvancedMarker>
          );
        })}
    </>
  );
}

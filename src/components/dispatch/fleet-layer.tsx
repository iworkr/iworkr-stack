"use client";

import { useEffect, useRef } from "react";
import { useDispatchMap } from "./dispatch-map-context";
import type { DispatchPin } from "@/app/actions/dashboard";

export interface FleetTech extends DispatchPin {
  heading?: number;
  speedKmh?: number;
}

interface FleetLayerProps {
  techs: FleetTech[];
  visible: boolean;
  hoveredId: string | null;
  onHover: (id: string | null) => void;
  onHoverTechDetail?: (tech: FleetTech | null, anchor: { lat: number; lng: number } | null) => void;
  rippleTechId?: string | null;
}

/* ── PRD §5.2: Technician Marker — "The Pulse" ──────────
   Emerald-500 dot (12px), border-2 border-zinc-900,
   with subtle sonar aura for live assets.
   ─────────────────────────────────────────────────────── */

export function FleetLayer({
  techs,
  visible,
  hoveredId,
  onHover,
  onHoverTechDetail,
  rippleTechId,
}: FleetLayerProps) {
  const map = useDispatchMap();
  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const elementsRef = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    if (!map) return;

    import("mapbox-gl").then((mod) => {
      const mapboxgl = mod.default;

      // Remove markers for techs no longer present
      const currentIds = new Set(techs.filter(t => t.location_lat != null && t.location_lng != null).map(t => t.id));
      markersRef.current.forEach((marker, id) => {
        if (!currentIds.has(id) || !visible) {
          marker.remove();
          markersRef.current.delete(id);
          elementsRef.current.delete(id);
        }
      });

      if (!visible) return;

      techs
        .filter((t) => t.location_lat != null && t.location_lng != null)
        .forEach((tech) => {
          const tid = tech.technician_id ?? tech.id;
          const isHovered = hoveredId === tid;
          const isRipple = rippleTechId === tid;

          let el = elementsRef.current.get(tech.id);
          let marker = markersRef.current.get(tech.id);

          if (!el) {
            el = document.createElement("div");
            el.style.cssText = "position: relative; display: flex; align-items: center; justify-content: center; cursor: pointer;";

            // Sonar aura
            const aura = document.createElement("div");
            aura.className = "fleet-aura";
            aura.style.cssText = `
              position: absolute; width: 24px; height: 24px; border-radius: 50%;
              background: rgba(16,185,129,0.2);
              animation: pulse 2s ease-in-out infinite;
            `;
            el.appendChild(aura);

            // Core dot
            const dot = document.createElement("div");
            dot.className = "fleet-dot";
            dot.style.cssText = `
              position: relative; width: 12px; height: 12px; border-radius: 50%;
              background: #10B981; border: 2px solid #09090b;
              transition: transform 0.15s ease, width 0.15s ease, height 0.15s ease;
            `;
            el.appendChild(dot);

            el.addEventListener("mouseenter", () => {
              onHover(tid);
              onHoverTechDetail?.(tech, { lat: tech.location_lat!, lng: tech.location_lng! });
            });
            el.addEventListener("mouseleave", () => {
              onHover(null);
              onHoverTechDetail?.(null, null);
            });
            el.addEventListener("click", () => {
              onHover(tid);
              onHoverTechDetail?.(tech, { lat: tech.location_lat!, lng: tech.location_lng! });
            });

            elementsRef.current.set(tech.id, el);
          }

          // Update hover/ripple state
          const dot = el.querySelector(".fleet-dot") as HTMLDivElement | null;
          const aura = el.querySelector(".fleet-aura") as HTMLDivElement | null;
          if (dot) {
            if (isHovered) {
              dot.style.width = "16px";
              dot.style.height = "16px";
              dot.style.borderColor = "#fff";
            } else {
              dot.style.width = "12px";
              dot.style.height = "12px";
              dot.style.borderColor = "#09090b";
            }
          }
          if (aura) {
            aura.style.animation = isRipple ? "ping 0.75s cubic-bezier(0,0,0.2,1) infinite" : "pulse 2s ease-in-out infinite";
          }

          if (!marker) {
            marker = new mapboxgl.Marker({ element: el, anchor: "center" })
              .setLngLat([tech.location_lng!, tech.location_lat!])
              .addTo(map);
            markersRef.current.set(tech.id, marker);
          } else {
            marker.setLngLat([tech.location_lng!, tech.location_lat!]);
          }
        });
    });
  }, [map, techs, visible, hoveredId, rippleTechId, onHover, onHoverTechDetail]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current.clear();
      elementsRef.current.clear();
    };
  }, []);

  return null;
}

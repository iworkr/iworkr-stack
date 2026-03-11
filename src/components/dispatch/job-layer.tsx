"use client";

import { useEffect, useRef } from "react";
import { useDispatchMap } from "./dispatch-map-context";

export interface JobMarkerData {
  id: string;
  title: string;
  lat: number;
  lng: number;
  variant: "unassigned" | "scheduled" | "in_progress" | "urgent";
}

interface JobLayerProps {
  jobs: JobMarkerData[];
  visible: boolean;
  onJobClick: (jobId: string, title: string) => void;
}

/* ── PRD §5.2: Job Site Marker — "The Target" ───────────
   White dot (10px), border-2 border-zinc-900.
   Urgent/overdue → rose-500. In-progress → violet-500.
   Unassigned → dark fill + white border (inverted).
   ─────────────────────────────────────────────────────── */

const variantColors: Record<JobMarkerData["variant"], { bg: string; border: string; size: number }> = {
  unassigned: { bg: "#09090b", border: "#ffffff", size: 12 },
  scheduled: { bg: "#ffffff", border: "#09090b", size: 10 },
  in_progress: { bg: "#8b5cf6", border: "#09090b", size: 10 },
  urgent: { bg: "#f43f5e", border: "#09090b", size: 10 },
};

export function JobLayer({ jobs, visible, onJobClick }: JobLayerProps) {
  const map = useDispatchMap();
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  useEffect(() => {
    if (!map) return;

    // Clear old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    if (!visible || jobs.length === 0) return;

    import("mapbox-gl").then((mod) => {
      const mapboxgl = mod.default;

      jobs.forEach((job) => {
        const v = variantColors[job.variant];
        const el = document.createElement("div");
        el.style.cssText = `
          width: ${v.size}px; height: ${v.size}px; border-radius: 50%;
          background: ${v.bg}; border: 2px solid ${v.border};
          cursor: pointer; transition: transform 0.1s ease;
          box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        `;
        el.title = job.title;
        el.addEventListener("mouseenter", () => { el.style.transform = "scale(1.25)"; });
        el.addEventListener("mouseleave", () => { el.style.transform = "scale(1)"; });
        el.addEventListener("click", () => onJobClick(job.id, job.title));

        const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
          .setLngLat([job.lng, job.lat])
          .addTo(map);
        markersRef.current.push(marker);
      });
    });

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
    };
  }, [map, jobs, visible, onJobClick]);

  return null;
}

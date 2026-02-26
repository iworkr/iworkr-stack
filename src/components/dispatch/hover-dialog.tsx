"use client";

import { useEffect, useState } from "react";
import { useMap } from "@vis.gl/react-google-maps";

export interface HoverDialogTech {
  id: string;
  technician_id: string | null;
  name: string | null;
  task: string | null;
  dispatch_status: "on_job" | "en_route" | "idle" | "offline";
  location_lat: number | null;
  location_lng: number | null;
  speedKmh?: number;
  speed?: number | null;
  battery?: number | null;
  position_updated_at?: string | null;
  lastPingAgo?: string;
}

interface HoverDialogProps {
  tech: HoverDialogTech | null;
  anchor: { lat: number; lng: number } | null;
}

/** Glassmorphic tooltip above a technician marker. Positioned via map projection. */
export function HoverDialog({ tech, anchor }: HoverDialogProps) {
  const map = useMap();
  const [pixel, setPixel] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!map || !anchor) {
      setPixel(null);
      return;
    }
    const update = () => {
      const bounds = map.getBounds();
      const mapDiv = map.getDiv();
      if (!bounds || !mapDiv) return;
      const ne = bounds.getNorthEast();
      const sw = bounds.getSouthWest();
      const lngSpan = ne.lng() - sw.lng();
      const latSpan = ne.lat() - sw.lat();
      if (lngSpan === 0 || latSpan === 0) return;
      const fracX = (anchor.lng - sw.lng()) / lngSpan;
      const fracY = (ne.lat() - anchor.lat) / latSpan; // north = top
      const w = mapDiv.offsetWidth;
      const h = mapDiv.offsetHeight;
      setPixel({ x: fracX * w, y: fracY * h });
    };
    update();
    const idle = map.addListener("idle", update);
    const zoom = map.addListener("zoom_changed", update);
    const center = map.addListener("center_changed", update);
    return () => {
      if (typeof globalThis !== "undefined" && (globalThis as { google?: { maps?: { event?: { removeListener: (h: unknown) => void } } } }).google?.maps?.event) {
        const ev = (globalThis as { google: { maps: { event: { removeListener: (h: unknown) => void } } } }).google.maps.event;
        ev.removeListener(idle);
        ev.removeListener(zoom);
        ev.removeListener(center);
      }
      setPixel(null);
    };
  }, [map, anchor?.lat, anchor?.lng]);

  if (!tech || !anchor || !pixel) return null;

  const statusText =
    tech.dispatch_status === "on_job"
      ? "Working on Site"
      : tech.dispatch_status === "en_route"
        ? `En Route to ${tech.task ?? "Job"}`
        : tech.dispatch_status === "idle"
          ? "Idle"
          : "Offline";
  const statusClass =
    tech.dispatch_status === "on_job"
      ? "text-violet-400"
      : tech.dispatch_status === "en_route"
        ? "text-emerald-400"
        : "text-zinc-500";
  const displaySpeed = tech.speedKmh ?? tech.speed;

  return (
    <div
      className="pointer-events-none absolute z-30 w-56 rounded-lg border border-white/10 bg-zinc-950/90 p-3 shadow-2xl backdrop-blur-md"
      style={{
        left: pixel.x,
        top: pixel.y - 10,
        transform: "translate(-50%, -100%)",
      }}
    >
      <div className="flex items-center gap-2">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-600 text-[10px] font-medium text-zinc-300">
          {(tech.name ?? "?").slice(0, 2).toUpperCase()}
        </div>
        <span className="truncate text-[13px] font-medium text-white">{tech.name ?? "Technician"}</span>
      </div>
      <div className="mt-2 space-y-1 border-t border-white/10 pt-2">
        <p className={`text-[12px] ${statusClass}`}>{statusText}</p>
        <p className="font-mono text-[11px] text-zinc-400">
          {displaySpeed != null ? `${displaySpeed} km/h` : "— km/h"}
          {tech.battery != null && ` · ${tech.battery}%`}
        </p>
        <p className="font-mono text-[11px] text-zinc-500">
          {tech.lastPingAgo ?? (tech.position_updated_at ? "Active" : "Active now")}
        </p>
      </div>
    </div>
  );
}

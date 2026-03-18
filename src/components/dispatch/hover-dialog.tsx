"use client";

import { useEffect, useState } from "react";
import { useDispatchMap } from "./dispatch-map-context";
import { LetterAvatar } from "@/components/ui/letter-avatar";

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

/** Glassmorphic tooltip above a technician marker. Positioned via Mapbox projection. */
export function HoverDialog({ tech, anchor }: HoverDialogProps) {
  const map = useDispatchMap();
  const [pixel, setPixel] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!map || !anchor) {
      setPixel(null);
      return;
    }

    const update = () => {
      const point = map.project([anchor.lng, anchor.lat]);
      setPixel({ x: point.x, y: point.y });
    };

    update();
    map.on("move", update);
    map.on("zoom", update);

    return () => {
      map.off("move", update);
      map.off("zoom", update);
      setPixel(null);
    };
  }, [map, anchor?.lat, anchor?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

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
        <LetterAvatar name={tech.name ?? "?"} size={24} />
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

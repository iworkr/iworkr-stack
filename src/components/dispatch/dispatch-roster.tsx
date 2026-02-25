"use client";

import { useMap } from "@vis.gl/react-google-maps";
import { useCallback, useMemo, useState } from "react";
import type { DispatchPin } from "@/app/actions/dashboard";

interface DispatchRosterProps {
  /** Pins from get_live_dispatch (one per job with assignee); dedupe by technician for list. */
  pins: DispatchPin[];
  hoveredTechId: string | null;
  onHoverTech: (id: string | null) => void;
  onLocateTech: (techId: string, lat: number, lng: number) => void;
  onOpenJobDossier?: (jobId: string, title: string) => void;
  /** Trigger ripple on marker (e.g. set a "pulse" tech id for 1s). */
  onRippleTech?: (techId: string | null) => void;
  visible: boolean;
}

/** Unique techs from pins (one row per technician, latest job as context). */
function useUniqueTechs(pins: DispatchPin[]) {
  return useMemo(() => {
    const byTech = new Map<string, DispatchPin>();
    for (const p of pins) {
      const tid = p.technician_id ?? p.id;
      if (!tid) continue;
      if (!byTech.has(tid)) byTech.set(tid, p);
      else {
        const existing = byTech.get(tid)!;
        if (p.dispatch_status === "on_job" && existing.dispatch_status !== "on_job")
          byTech.set(tid, p);
        else if (p.status === "in_progress") byTech.set(tid, p);
      }
    }
    return Array.from(byTech.values());
  }, [pins]);
}

function StatusPill({ status }: { status: string }) {
  const config =
    status === "on_job"
      ? { label: "Working", className: "bg-violet-500/20 text-violet-400 border-violet-500/30" }
      : status === "en_route"
        ? { label: "En Route", className: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" }
        : status === "idle"
          ? { label: "Idle", className: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30" }
          : { label: "Offline", className: "bg-zinc-800/20 text-zinc-600 border-zinc-800/30" };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${config.className}`}
    >
      {config.label}
    </span>
  );
}

function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function DispatchRoster({
  pins,
  hoveredTechId,
  onHoverTech,
  onLocateTech,
  onOpenJobDossier,
  onRippleTech,
  visible,
}: DispatchRosterProps) {
  const map = useMap();
  const [search, setSearch] = useState("");
  const techs = useUniqueTechs(pins);

  const filtered = useMemo(() => {
    if (!search.trim()) return techs;
    const q = search.toLowerCase();
    return techs.filter((t) => (t.name ?? "").toLowerCase().includes(q));
  }, [techs, search]);

  const handleLocate = useCallback(
    (pin: DispatchPin) => {
      const tid = pin.technician_id ?? pin.id;
      const lat = pin.location_lat;
      const lng = pin.location_lng;
      if (tid && lat != null && lng != null && map) {
        map.panTo({ lat, lng });
        onLocateTech(tid, lat, lng);
        onRippleTech?.(tid);
      }
    },
    [map, onLocateTech, onRippleTech]
  );

  if (!visible) return null;

  return (
    <div
      className="absolute left-4 top-20 z-[500] w-80 rounded-xl border border-white/5 bg-zinc-950/80 shadow-2xl backdrop-blur-xl"
      style={{ height: "calc(100vh - 6rem)", maxHeight: "calc(100vh - 6rem)" }}
    >
      <div className="flex h-full flex-col border-b border-white/10 p-3">
        <h2 className="font-display text-sm font-semibold text-white">Active Fleet</h2>
        <input
          type="search"
          placeholder="Filter by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={
            "mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 outline-none transition focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20"
          }
        />
      </div>
      <ul className="flex-1 overflow-y-auto p-2">
        {filtered.map((pin) => {
          const tid = pin.technician_id ?? pin.id;
          const isHovered = hoveredTechId === tid;
          const hasCoords = pin.location_lat != null && pin.location_lng != null;
          return (
            <li
              key={tid}
              onMouseEnter={() => onHoverTech(tid)}
              onMouseLeave={() => onHoverTech(null)}
              onClick={() => hasCoords && handleLocate(pin)}
              className={`flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 transition-colors ${
                isHovered ? "bg-white/[0.06]" : "hover:bg-white/[0.02]"
              }`}
            >
              <div className="h-8 w-8 shrink-0 rounded-full bg-zinc-700 flex items-center justify-center text-[11px] font-medium text-zinc-300">
                {(pin.name ?? "?").slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[13px] font-medium text-white">{pin.name ?? "Technician"}</span>
                  <StatusPill status={pin.dispatch_status} />
                </div>
                {pin.task && (
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenJobDossier?.(pin.current_job_id ?? pin.id, pin.task ?? "");
                      }}
                      className="font-mono text-[11px] text-zinc-400 hover:text-emerald-400 hover:underline"
                    >
                      Job • {pin.task}
                    </button>
                  </div>
                )}
                <div className="mt-0.5 flex items-center gap-2 text-[10px] text-zinc-600">
                  {pin.speed != null && pin.speed > 0 && (
                    <span>{pin.speed} km/h</span>
                  )}
                  {pin.battery != null && (
                    <span>{pin.battery}%</span>
                  )}
                  {pin.position_updated_at && (
                    <span>{timeAgo(pin.position_updated_at)}</span>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

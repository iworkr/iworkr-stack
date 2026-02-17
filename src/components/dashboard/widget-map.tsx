"use client";

import { motion } from "framer-motion";
import { ArrowRight, MapPin, Radio } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useOrg } from "@/lib/hooks/use-org";
import { getLiveDispatch, type DispatchPin } from "@/app/actions/dashboard";
import { createClient } from "@/lib/supabase/client";
import { WidgetShell } from "./widget-shell";

const statusConfig = {
  on_job: { color: "bg-emerald-500", ring: "ring-emerald-500/30", label: "On Job" },
  en_route: { color: "bg-blue-500", ring: "ring-blue-500/30", label: "En Route" },
  idle: { color: "bg-zinc-500", ring: "ring-zinc-500/30", label: "Idle" },
};

// Map lat/lng into percentage-based position within the widget
function coordsToPosition(lat: number | null, lng: number | null, allPins: DispatchPin[]) {
  if (!lat || !lng) return { x: "50%", y: "50%" };

  const lats = allPins.filter(p => p.location_lat).map(p => p.location_lat!);
  const lngs = allPins.filter(p => p.location_lng).map(p => p.location_lng!);

  if (lats.length < 2) return { x: "50%", y: "50%" };

  const minLat = Math.min(...lats) - 0.01;
  const maxLat = Math.max(...lats) + 0.01;
  const minLng = Math.min(...lngs) - 0.01;
  const maxLng = Math.max(...lngs) + 0.01;

  const x = ((lng - minLng) / (maxLng - minLng)) * 70 + 15;
  const y = (1 - (lat - minLat) / (maxLat - minLat)) * 60 + 20;

  return { x: `${Math.max(10, Math.min(90, x))}%`, y: `${Math.max(10, Math.min(90, y))}%` };
}

interface Pin {
  id: string;
  name: string;
  task: string;
  status: "on_job" | "en_route" | "idle";
  x: string;
  y: string;
}

// No fallback pins — show clean empty state when no data

export function WidgetMap() {
  const router = useRouter();
  const { orgId } = useOrg();
  const [hovered, setHovered] = useState<string | null>(null);
  const [dispatchData, setDispatchData] = useState<DispatchPin[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Fetch live dispatch data
  useEffect(() => {
    if (!orgId) return;
    getLiveDispatch(orgId).then(({ data }) => {
      if (data && data.length > 0) setDispatchData(data);
      setLoaded(true);
    });
  }, [orgId]);

  // Subscribe to realtime job changes
  useEffect(() => {
    if (!orgId) return;

    const supabase = createClient();
    const channel = supabase
      .channel("live-dispatch")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "jobs",
        filter: `organization_id=eq.${orgId}`,
      }, () => {
        // Refetch dispatch data on any job change
        getLiveDispatch(orgId).then(({ data }) => {
          if (data) setDispatchData(data);
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId]);

  // Map dispatch data to pins — no fallback, show empty state if no data
  const pins: Pin[] = useMemo(() => {
    if (dispatchData.length === 0) return [];

    return dispatchData.map(d => {
      const pos = coordsToPosition(d.location_lat, d.location_lng, dispatchData);
      return {
        id: d.id,
        name: d.name ? d.name.split(" ").map(n => n[0]).join("") + "." : "Unassigned",
        task: d.task,
        status: d.dispatch_status === "on_job" ? "on_job" as const : "en_route" as const,
        x: pos.x,
        y: pos.y,
      };
    });
  }, [dispatchData]);

  const activeCount = pins.filter((p) => p.status !== "idle").length;

  // Shimmer loading state
  if (!loaded) {
    return (
      <WidgetShell delay={0.05}>
        <div className="relative h-[260px] overflow-hidden p-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-3 w-3 rounded bg-zinc-800/80 animate-pulse" />
            <div className="h-3 w-24 rounded bg-zinc-800/80 relative overflow-hidden">
              <span className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-zinc-700/30 to-transparent" />
            </div>
          </div>
          <div className="absolute inset-0 mt-10 opacity-[0.04]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
          <div className="flex flex-wrap justify-center gap-4 pt-16">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-6 w-6 rounded-full bg-zinc-800/60 animate-pulse" style={{ animationDelay: `${i * 200}ms` }} />
            ))}
          </div>
        </div>
      </WidgetShell>
    );
  }

  return (
    <WidgetShell
      delay={0.05}
      header={
        <div className="flex items-center gap-2">
          <div className="relative flex items-center gap-1.5">
            <Radio size={14} className="text-zinc-400" />
            <span className="text-[13px] font-medium text-zinc-300">Live Dispatch</span>
          </div>
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-50" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            {activeCount} Active
          </span>
        </div>
      }
      action={
        <button
          onClick={() => router.push("/dashboard/schedule")}
          className="flex items-center gap-1 text-[11px] text-zinc-500 transition-colors hover:text-zinc-300"
        >
          Open Dispatch
          <ArrowRight size={12} />
        </button>
      }
    >
      <div className="relative h-[260px] overflow-hidden">
        {/* Dark map grid */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        {/* Road-like lines — using viewBox-relative coords to avoid invalid SVG % in paths */}
        <svg className="absolute inset-0 h-full w-full opacity-[0.06]" viewBox="0 0 100 100" preserveAspectRatio="none">
          <line x1="20" y1="0" x2="20" y2="100" stroke="white" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
          <line x1="60" y1="0" x2="60" y2="100" stroke="white" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
          <line x1="0" y1="40" x2="100" y2="40" stroke="white" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
          <line x1="0" y1="75" x2="100" y2="75" stroke="white" strokeWidth="0.3" vectorEffect="non-scaling-stroke" />
          <path d="M 10 20 Q 35 50, 70 30" fill="none" stroke="white" strokeWidth="0.8" vectorEffect="non-scaling-stroke" />
          <path d="M 5 60 Q 45 40, 85 65" fill="none" stroke="white" strokeWidth="0.4" vectorEffect="non-scaling-stroke" />
        </svg>

        {/* Radar sweep from HQ */}
        <div className="absolute" style={{ left: "48%", top: "48%", transform: "translate(-50%, -50%)" }}>
          <div className="relative z-10 flex h-4 w-4 items-center justify-center rounded-sm border border-zinc-600 bg-zinc-800">
            <div className="h-1.5 w-1.5 rounded-full bg-white" />
          </div>
          {[80, 140, 200].map((r) => (
            <div
              key={r}
              className="absolute rounded-full border border-zinc-800/60"
              style={{
                width: r * 2,
                height: r * 2,
                left: `calc(50% - ${r}px)`,
                top: `calc(50% - ${r}px)`,
              }}
            />
          ))}
          <motion.div
            className="absolute left-1/2 top-1/2"
            style={{ width: 0, height: 0 }}
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          >
            <div
              className="absolute top-0 left-0 origin-left"
              style={{
                width: 200,
                height: 2,
                marginTop: -1,
                background: "linear-gradient(90deg, rgba(99,102,241,0.6) 0%, rgba(99,102,241,0.1) 70%, transparent 100%)",
                borderRadius: 1,
              }}
            />
            <div
              className="absolute top-0 left-0 origin-top-left"
              style={{
                width: 200,
                height: 200,
                background: "conic-gradient(from 0deg at 0% 0%, rgba(99,102,241,0.08) 0deg, rgba(99,102,241,0.04) 20deg, transparent 50deg)",
              }}
            />
          </motion.div>
        </div>

        {/* Empty state when no techs active */}
        {loaded && pins.length === 0 && (
          <div className="absolute inset-0 z-20 flex items-center justify-center">
            <div className="text-center">
              <MapPin size={20} strokeWidth={1} className="mx-auto mb-1.5 text-zinc-700" />
              <p className="text-[11px] text-zinc-600">No active dispatches</p>
              <p className="mt-0.5 text-[9px] text-zinc-700">Technicians will appear here when jobs are in progress.</p>
            </div>
          </div>
        )}

        {/* Technician pins */}
        {pins.map((pin) => {
          const cfg = statusConfig[pin.status];
          return (
            <div
              key={pin.id}
              className="absolute z-20"
              style={{ left: pin.x, top: pin.y }}
              onMouseEnter={() => setHovered(pin.id)}
              onMouseLeave={() => setHovered(null)}
            >
              {pin.status !== "idle" && (
                <motion.div
                  animate={{ scale: [1, 2.5], opacity: [0.4, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className={`absolute inset-0 rounded-full ${cfg.color}`}
                  style={{ width: 12, height: 12, margin: "-2px" }}
                />
              )}
              <div
                className={`relative h-3 w-3 cursor-pointer rounded-full ${cfg.color} ring-2 ring-black transition-transform hover:scale-150`}
              />
              {hovered === pin.id && (
                <motion.div
                  initial={{ opacity: 0, y: 5, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className="absolute bottom-full left-1/2 z-30 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-zinc-700 bg-zinc-900/95 px-3 py-2 shadow-xl backdrop-blur-sm"
                >
                  <div className="flex items-center gap-1.5">
                    <div className={`h-1.5 w-1.5 rounded-full ${cfg.color}`} />
                    <span className="text-[11px] font-medium text-zinc-200">{pin.name}</span>
                  </div>
                  <div className="mt-0.5 text-[10px] text-zinc-500">
                    {pin.task} · {cfg.label}
                  </div>
                  <div className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-b border-r border-zinc-700 bg-zinc-900" />
                </motion.div>
              )}
            </div>
          );
        })}

        {/* Bottom gradient */}
        <div className="absolute inset-x-0 bottom-0 z-20 h-16 bg-gradient-to-t from-[#0C0C0C] to-transparent" />

        {/* Legend — above gradient */}
        <div className="absolute bottom-3 left-3 z-30 flex items-center gap-3">
          <span className="flex items-center gap-1 text-[9px] text-zinc-600">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> On Job
          </span>
          <span className="flex items-center gap-1 text-[9px] text-zinc-600">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" /> En Route
          </span>
          <span className="flex items-center gap-1 text-[9px] text-zinc-600">
            <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" /> Idle
          </span>
        </div>
      </div>
    </WidgetShell>
  );
}

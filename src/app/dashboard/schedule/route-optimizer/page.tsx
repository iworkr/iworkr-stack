/**
 * @page /dashboard/schedule/route-optimizer
 * @status COMPLETE
 * @description Project Outrider-Route — AI Route Optimization dispatcher. Split-pane layout
 *   with Mapbox GL JS map (right) and interactive timeline (left). Supports pinned constraints,
 *   supplier waypoints, before/after diff, and one-click commit.
 * @dataSource server-action + edge-function
 * @lastAudit 2026-03-24
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useOrg } from "@/lib/hooks/use-org";
import { useIndustryLexicon } from "@/lib/industry-lexicon";
import { useMapbox, MAPBOX_ACCESS_TOKEN } from "@/components/maps/mapbox-provider";
import { OBSIDIAN_MAP_STYLE, applyObsidianStyle, DEFAULT_MAP_CENTER } from "@/components/maps/obsidian-map-styles";
import { MapOfflineFallback } from "@/components/maps/map-offline-fallback";
import {
  getWorkersWithBlocks,
  getOptimizableBlocks,
  optimizeWorkerRoute,
  commitOptimizedRoute,
  togglePinBlock,
  type OptimizableStop,
  type ProposedBlock,
  type OptimizationResult,
} from "@/app/actions/route-optimization";
import {
  Route, Lock, Unlock, Play, Check, ChevronLeft, ChevronRight,
  MapPin, Clock, Navigation, TrendingDown, Zap, Loader2,
  Package, User, ArrowRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function RouteOptimizerPage() {
  const { orgId } = useOrg();
  const { t } = useIndustryLexicon();
  const { isLoaded } = useMapbox();

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split("T")[0];
  });

  const [workers, setWorkers] = useState<Array<{
    id: string; full_name: string; avatar_url: string | null;
    block_count: number; has_coordinates: boolean;
  }>>([]);
  const [selectedWorker, setSelectedWorker] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<OptimizableStop[]>([]);
  const [proposedResult, setProposedResult] = useState<OptimizationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [committed, setCommitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load workers for date
  const loadWorkers = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    const { workers: w } = await getWorkersWithBlocks(orgId, selectedDate);
    setWorkers(w);
    setLoading(false);
    if (w.length > 0 && !selectedWorker) {
      setSelectedWorker(w[0].id);
    }
  }, [orgId, selectedDate, selectedWorker]);

  useEffect(() => { loadWorkers(); }, [loadWorkers]);

  // Load blocks when worker changes
  const loadBlocks = useCallback(async () => {
    if (!orgId || !selectedWorker) return;
    const { blocks: b } = await getOptimizableBlocks(selectedWorker, selectedDate, orgId);
    setBlocks(b);
    setProposedResult(null);
    setCommitted(false);
    setError(null);
  }, [orgId, selectedWorker, selectedDate]);

  useEffect(() => { loadBlocks(); }, [loadBlocks]);

  // Initialize map
  useEffect(() => {
    if (!isLoaded || !mapContainerRef.current || mapRef.current) return;
    let cancelled = false;

    import("mapbox-gl").then((mod) => {
      if (cancelled || !mapContainerRef.current) return;
      const mapboxgl = mod.default;
      mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;

      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: OBSIDIAN_MAP_STYLE,
        center: DEFAULT_MAP_CENTER,
        zoom: 11,
        attributionControl: false,
        pitchWithRotate: false,
        dragRotate: false,
      });

      map.on("style.load", () => applyObsidianStyle(map));
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-right");
      mapRef.current = map;
    });

    return () => { cancelled = true; };
  }, [isLoaded]);

  // Plot stops on map
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear existing markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // Remove old route layer
    try {
      if (map.getSource("route-line")) {
        map.removeLayer("route-line-layer");
        map.removeSource("route-line");
      }
    } catch { /* noop */ }

    const displayBlocks = proposedResult?.proposed_blocks || blocks;
    if (displayBlocks.length === 0) return;

    import("mapbox-gl").then((mod) => {
      const mapboxgl = mod.default;
      const bounds = new mapboxgl.LngLatBounds();
      let hasValidBounds = false;

      displayBlocks.forEach((block, i) => {
        const lat = block.lat;
        const lng = block.lng;
        if (!lat || !lng) return;

        const isPinned = block.is_time_pinned;
        const isSupplier = block.is_supplier_waypoint;

        const el = document.createElement("div");
        el.className = "flex items-center justify-center rounded-full text-[11px] font-bold shadow-lg";
        el.style.width = "28px";
        el.style.height = "28px";
        el.style.backgroundColor = isPinned ? "#f59e0b" : isSupplier ? "#8b5cf6" : "#10B981";
        el.style.color = "#000";
        el.style.border = "2px solid rgba(255,255,255,0.2)";
        el.textContent = String(i + 1);

        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([lng, lat])
          .addTo(map);

        markersRef.current.push(marker);
        bounds.extend([lng, lat]);
        hasValidBounds = true;
      });

      if (hasValidBounds) {
        map.fitBounds(bounds, { padding: 60, maxZoom: 14, duration: 800 });
      }

      // Draw route polyline if available
      if (proposedResult?.trip_geometry) {
        try {
          const decoded = decodePolyline6(proposedResult.trip_geometry);
          if (decoded.length > 1) {
            map.addSource("route-line", {
              type: "geojson",
              data: {
                type: "Feature",
                properties: {},
                geometry: {
                  type: "LineString",
                  coordinates: decoded,
                },
              },
            });

            map.addLayer({
              id: "route-line-layer",
              type: "line",
              source: "route-line",
              layout: { "line-join": "round", "line-cap": "round" },
              paint: {
                "line-color": "#10B981",
                "line-width": 3,
                "line-opacity": 0.8,
              },
            });
          }
        } catch { /* polyline decode failed */ }
      }
    });
  }, [blocks, proposedResult]);

  // Optimize handler
  const handleOptimize = async () => {
    if (!orgId || !selectedWorker) return;
    setOptimizing(true);
    setError(null);
    setCommitted(false);

    const result = await optimizeWorkerRoute(selectedWorker, selectedDate, orgId);

    if (!result.ok) {
      setError(result.error || "Optimization failed");
    } else {
      setProposedResult(result);
    }
    setOptimizing(false);
  };

  // Commit handler
  const handleCommit = async () => {
    if (!proposedResult?.run_id || !proposedResult?.proposed_blocks) return;
    setCommitting(true);

    const { ok, error: err } = await commitOptimizedRoute(
      proposedResult.run_id,
      proposedResult.proposed_blocks
    );

    if (!ok) {
      setError(err || "Failed to commit");
    } else {
      setCommitted(true);
      loadBlocks();
    }
    setCommitting(false);
  };

  // Pin toggle
  const handleTogglePin = async (blockId: string, currentlyPinned: boolean) => {
    await togglePinBlock(blockId, !currentlyPinned);
    loadBlocks();
  };

  // Date navigation
  const shiftDate = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split("T")[0]);
    setSelectedWorker(null);
    setProposedResult(null);
  };

  const displayBlocks = proposedResult?.proposed_blocks || [];
  const activeBlocks = displayBlocks.length > 0 ? displayBlocks : blocks;
  const metrics = proposedResult?.metrics;

  const fmtTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: true });
  };

  const fmtDuration = (secs: number) => {
    if (secs < 60) return `${secs}s`;
    const m = Math.round(secs / 60);
    if (m < 60) return `${m} min`;
    return `${Math.floor(m / 60)}h ${m % 60}m`;
  };

  return (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden bg-[#050505]">
      {/* Left Panel — Timeline */}
      <div className="flex w-[420px] flex-col border-r border-white/[0.06]">
        {/* Header */}
        <div className="border-b border-white/[0.06] p-4">
          <div className="flex items-center gap-2 text-[14px] font-semibold text-zinc-100">
            <Route size={16} className="text-emerald-400" />
            Route Optimizer
          </div>
          <p className="mt-1 text-[11px] text-zinc-600">
            AI-powered route optimization using Mapbox TSP engine
          </p>

          {/* Date Picker */}
          <div className="mt-3 flex items-center gap-2">
            <button onClick={() => shiftDate(-1)} className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300">
              <ChevronLeft size={14} />
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => { setSelectedDate(e.target.value); setSelectedWorker(null); setProposedResult(null); }}
              className="flex-1 rounded-lg border border-white/[0.06] bg-zinc-900/50 px-3 py-1.5 text-[12px] text-zinc-200 outline-none focus:border-emerald-500/40"
            />
            <button onClick={() => shiftDate(1)} className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300">
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Worker Selector */}
          <div className="mt-2">
            <select
              value={selectedWorker || ""}
              onChange={(e) => { setSelectedWorker(e.target.value || null); setProposedResult(null); }}
              className="w-full rounded-lg border border-white/[0.06] bg-zinc-900/50 px-3 py-2 text-[12px] text-zinc-200 outline-none focus:border-emerald-500/40"
            >
              <option value="">Select {t("technician")}...</option>
              {workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.full_name} — {w.block_count} {t("jobs")} {w.has_coordinates ? "📍" : "⚠️"}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Optimize Button */}
        {selectedWorker && blocks.length >= 2 && (
          <div className="border-b border-white/[0.06] p-3">
            <button
              onClick={handleOptimize}
              disabled={optimizing}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-2.5 text-[13px] font-medium text-emerald-400 transition hover:bg-emerald-500/20 disabled:opacity-50"
            >
              {optimizing ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Calculating optimal route...
                </>
              ) : (
                <>
                  <Zap size={14} />
                  Optimize Route
                </>
              )}
            </button>
          </div>
        )}

        {/* Metrics Banner */}
        <AnimatePresence>
          {metrics && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-b border-white/[0.06]"
            >
              <div className="grid grid-cols-2 gap-2 p-3">
                <div className="rounded-lg bg-emerald-500/5 p-2.5 text-center">
                  <p className="text-[18px] font-bold tabular-nums text-emerald-400">
                    {metrics.total_travel_minutes}<span className="text-[11px] font-normal"> min</span>
                  </p>
                  <p className="text-[10px] text-zinc-500">Total Travel</p>
                </div>
                <div className="rounded-lg bg-emerald-500/5 p-2.5 text-center">
                  <p className="text-[18px] font-bold tabular-nums text-emerald-400">
                    {metrics.total_distance_km}<span className="text-[11px] font-normal"> km</span>
                  </p>
                  <p className="text-[10px] text-zinc-500">Total Distance</p>
                </div>
                {metrics.estimated_savings_minutes > 0 && (
                  <div className="col-span-2 flex items-center justify-center gap-1.5 rounded-lg bg-green-500/10 p-2">
                    <TrendingDown size={13} className="text-green-400" />
                    <p className="text-[12px] font-medium text-green-400">
                      ~{metrics.estimated_savings_minutes} min saved
                    </p>
                  </div>
                )}
              </div>

              {/* Commit / Committed */}
              <div className="px-3 pb-3">
                {committed ? (
                  <div className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-2.5 text-[13px] font-medium text-emerald-400">
                    <Check size={14} />
                    Route Committed to Roster
                  </div>
                ) : (
                  <button
                    onClick={handleCommit}
                    disabled={committing}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-[13px] font-semibold text-black transition hover:bg-emerald-400 disabled:opacity-50"
                  >
                    {committing ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Check size={14} />
                    )}
                    Commit to Roster
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error */}
        {error && (
          <div className="border-b border-red-500/20 bg-red-500/5 px-4 py-2 text-[12px] text-red-400">
            {error}
          </div>
        )}

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 size={20} className="animate-spin text-zinc-600" />
            </div>
          ) : activeBlocks.length === 0 ? (
            <div className="py-16 text-center">
              <Route size={32} className="mx-auto mb-3 text-zinc-700" />
              <p className="text-[13px] text-zinc-500">
                {selectedWorker ? "No blocks scheduled for this day" : `Select a ${t("technician")} to view their route`}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {activeBlocks.map((block, i) => {
                const isPinned = block.is_time_pinned;
                const isSupplier = block.is_supplier_waypoint;
                const travelSecs = ("travel_duration_seconds" in block)
                  ? (block as ProposedBlock).travel_duration_seconds
                  : 0;
                const travelMeters = ("travel_distance_meters" in block)
                  ? (block as ProposedBlock).travel_distance_meters
                  : 0;

                return (
                  <div key={block.id}>
                    {/* Travel leg indicator */}
                    {i > 0 && travelSecs > 0 && (
                      <div className="flex items-center gap-2 py-1.5 pl-4">
                        <div className="h-4 w-px bg-zinc-800" />
                        <Navigation size={10} className="text-zinc-600" />
                        <span className="text-[10px] tabular-nums text-zinc-600">
                          {fmtDuration(travelSecs)} · {(travelMeters / 1000).toFixed(1)} km
                        </span>
                      </div>
                    )}

                    {/* Block Card */}
                    <div
                      className={`group relative rounded-xl border p-3 transition ${
                        isPinned
                          ? "border-amber-500/20 bg-amber-500/[0.03]"
                          : isSupplier
                          ? "border-violet-500/20 bg-violet-500/[0.03]"
                          : "border-white/[0.06] bg-zinc-900/30 hover:bg-zinc-900/60"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Sequence number */}
                        <div
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                            isPinned
                              ? "bg-amber-500/20 text-amber-400"
                              : isSupplier
                              ? "bg-violet-500/20 text-violet-400"
                              : "bg-emerald-500/15 text-emerald-400"
                          }`}
                        >
                          {block.route_sequence || i + 1}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            {isSupplier && <Package size={11} className="text-violet-400" />}
                            <p className="truncate text-[13px] font-medium text-zinc-200">
                              {block.title}
                            </p>
                          </div>
                          {block.client_name && (
                            <p className="mt-0.5 truncate text-[11px] text-zinc-500">
                              <User size={9} className="mr-1 inline" />
                              {block.client_name}
                            </p>
                          )}
                          <div className="mt-1 flex items-center gap-2 text-[11px] tabular-nums text-zinc-500">
                            <Clock size={10} />
                            {fmtTime(block.start_time)}
                            <ArrowRight size={9} />
                            {fmtTime(block.end_time)}
                          </div>
                          {!block.lat && (
                            <p className="mt-1 text-[10px] text-amber-500/70">⚠ No coordinates</p>
                          )}
                        </div>

                        {/* Pin toggle */}
                        {!isSupplier && !proposedResult && (
                          <button
                            onClick={() => handleTogglePin(block.id, isPinned)}
                            className={`rounded-lg p-1.5 transition ${
                              isPinned
                                ? "text-amber-400 hover:bg-amber-500/10"
                                : "text-zinc-700 opacity-0 group-hover:opacity-100 hover:bg-zinc-800 hover:text-zinc-400"
                            }`}
                            title={isPinned ? "Unpin time" : "Pin time (lock this slot)"}
                          >
                            {isPinned ? <Lock size={13} /> : <Unlock size={13} />}
                          </button>
                        )}

                        {isPinned && proposedResult && (
                          <div className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[9px] font-medium text-amber-400">
                            <Lock size={8} />
                            PINNED
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel — Map */}
      <div className="relative flex-1">
        {isLoaded ? (
          <div ref={mapContainerRef} className="h-full w-full" />
        ) : (
          <MapOfflineFallback />
        )}

        {/* Map legend */}
        <div className="absolute bottom-4 left-4 rounded-xl border border-white/[0.06] bg-[#0A0A0A]/90 p-3 backdrop-blur-sm">
          <div className="space-y-1.5 text-[10px]">
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <span className="text-zinc-400">Regular stop</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-amber-500" />
              <span className="text-zinc-400">Pinned (time-locked)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-violet-500" />
              <span className="text-zinc-400">Supplier waypoint</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-4 rounded bg-emerald-500/80" />
              <span className="text-zinc-400">Optimized route</span>
            </div>
          </div>
        </div>

        {/* Quick stats overlay */}
        {selectedWorker && activeBlocks.length > 0 && (
          <div className="absolute right-4 top-4 rounded-xl border border-white/[0.06] bg-[#0A0A0A]/90 px-3 py-2 backdrop-blur-sm">
            <div className="flex items-center gap-3 text-[11px] text-zinc-400">
              <div className="flex items-center gap-1">
                <MapPin size={11} className="text-emerald-400" />
                <span className="font-medium text-zinc-200">{activeBlocks.length}</span> stops
              </div>
              <div className="flex items-center gap-1">
                <Lock size={11} className="text-amber-400" />
                <span className="font-medium text-zinc-200">
                  {activeBlocks.filter(b => b.is_time_pinned).length}
                </span> pinned
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Decode Mapbox polyline6 (precision 6) to coordinate pairs [lng, lat]
 */
function decodePolyline6(encoded: string): [number, number][] {
  const coords: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b: number;
    let shift = 0;
    let result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    lat += (result & 1) !== 0 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    lng += (result & 1) !== 0 ? ~(result >> 1) : result >> 1;

    coords.push([lng / 1e6, lat / 1e6]);
  }

  return coords;
}

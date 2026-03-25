"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useParams } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPinOff,
  Clock,
  Phone,
  Navigation,
  Truck,
  CheckCircle2,
  AlertTriangle,
  Radio,
  MapPin,
  Gauge,
  Route,
  Shield,
} from "lucide-react";

import {
  getTrackingByToken,
  type TrackingPublicData,
} from "@/app/actions/glasshouse-arrival";

type TrackingResult = { data: TrackingPublicData | null; error: string | null };

type PageState = "loading" | "error" | "active" | "arrived" | "approaching";

// ── Helpers ──────────────────────────────────────────────────

function formatEta(mins: number | undefined | null): string {
  if (mins == null || mins <= 0) return "< 1 min";
  if (mins === 1) return "1 min";
  return `${Math.round(mins)} mins`;
}

function formatSpeed(speed: number | undefined | null): string {
  if (speed == null || speed <= 0) return "—";
  const kmh = speed * 3.6;
  return `${Math.round(kmh)} km/h`;
}

function formatTime(iso: string | undefined | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function getInitials(name: string | undefined | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatRoleBadge(role: string | undefined | null): string {
  if (!role) return "Technician";
  return role
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// ── Supabase Realtime Hook ───────────────────────────────────

function useTrackingRealtime(
  sessionId: string | undefined,
  onUpdate: (payload: any) => void,
) {
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (!sessionId) return;

    let mounted = true;

    async function subscribe() {
      try {
        const { createBrowserClient } = await import("@supabase/ssr");
        const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
        const key = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
        if (!url || !key) return;

        const supabase = createBrowserClient(url, key);

        const channel = supabase
          .channel(`tracking_live_${sessionId}`)
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "tracking_sessions",
              filter: `id=eq.${sessionId}`,
            },
            (payload: any) => {
              if (mounted) onUpdate(payload.new);
            },
          )
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "telemetry_pings",
              filter: `session_id=eq.${sessionId}`,
            },
            (payload: any) => {
              if (mounted && !payload.new.is_suppressed) {
                onUpdate({
                  _ping: true,
                  lat: payload.new.lat,
                  lng: payload.new.lng,
                  heading: payload.new.heading,
                  speed: payload.new.speed,
                });
              }
            },
          )
          .subscribe();

        channelRef.current = channel;
      } catch (err) {
        console.error("Realtime subscription error:", err);
      }
    }

    subscribe();

    return () => {
      mounted = false;
      if (channelRef.current) {
        channelRef.current.unsubscribe?.();
        channelRef.current = null;
      }
    };
  }, [sessionId, onUpdate]);
}

// ── Main Page Component ─────────────────────────────────────

export default function TrackingPage() {
  const params = useParams();
  const token = params.token as string;

  const [pageState, setPageState] = useState<PageState>("loading");
  const [data, setData] = useState<TrackingPublicData | null>(null);
  const [errorType, setErrorType] = useState<string>("not_found");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchData = useCallback(async () => {
    if (!token) return;

    try {
      const result: TrackingResult = await getTrackingByToken(token);

      if (result.error || !result.data) {
        setErrorType("not_found");
        setErrorMessage(result.error ?? "Something went wrong");
        setPageState("error");
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        return;
      }

      const tracking = result.data;

      if (tracking.error) {
        setErrorType(tracking.error);
        setErrorMessage(tracking.message ?? "Something went wrong");
        setPageState("error");
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        return;
      }

      setData(tracking);
      setLastFetched(new Date());

      if (tracking.status === "arrived") {
        setPageState("arrived");
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      } else if (
        tracking.status === "geofence_approach" ||
        (tracking as any).geofence_approach
      ) {
        setPageState("approaching");
      } else {
        setPageState("active");
      }
    } catch {
      setErrorType("not_found");
      setErrorMessage("Unable to connect. Please try again.");
      setPageState("error");
    }
  }, [token]);

  // Realtime handler
  const handleRealtimeUpdate = useCallback(
    (payload: any) => {
      if (!payload) return;

      if (payload._ping) {
        setData((prev) =>
          prev
            ? {
                ...prev,
                current_lat: payload.lat,
                current_lng: payload.lng,
                current_heading: payload.heading ?? prev.current_heading,
                current_speed: payload.speed ?? prev.current_speed,
                last_position_update: new Date().toISOString(),
              }
            : prev,
        );
        return;
      }

      if (payload.status === "arrived") {
        setPageState("arrived");
        setData((prev) =>
          prev ? { ...prev, ...payload, status: "arrived" } : prev,
        );
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      } else if (payload.status === "geofence_approach") {
        setPageState("approaching");
        setData((prev) => (prev ? { ...prev, ...payload } : prev));
      } else if (
        payload.status === "expired" ||
        payload.status === "cancelled"
      ) {
        setErrorType(payload.status);
        setErrorMessage(
          payload.status === "expired"
            ? "This tracking link has expired"
            : "This session was cancelled",
        );
        setPageState("error");
      } else {
        setData((prev) => (prev ? { ...prev, ...payload } : prev));
      }
    },
    [],
  );

  useTrackingRealtime(data?.session_id, handleRealtimeUpdate);

  useEffect(() => {
    fetchData();
    intervalRef.current = setInterval(fetchData, 10000);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [fetchData]);

  return (
    <div className="min-h-dvh bg-[#0A0A0A] text-white flex flex-col overflow-hidden">
      <AnimatePresence mode="wait">
        {pageState === "loading" && <LoadingState key="loading" />}
        {pageState === "error" && (
          <ErrorState
            key="error"
            type={errorType}
            message={errorMessage}
          />
        )}
        {(pageState === "active" || pageState === "approaching") && data && (
          <ActiveState
            key="active"
            data={data}
            lastFetched={lastFetched}
            isApproaching={pageState === "approaching"}
          />
        )}
        {pageState === "arrived" && data && (
          <ArrivedState key="arrived" data={data} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// 1. LOADING STATE
// ═══════════════════════════════════════════════════════════════

function LoadingState() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex-1 flex flex-col items-center justify-center gap-6 px-6"
    >
      <div className="relative w-24 h-24">
        <div className="absolute inset-0 rounded-full border-2 border-emerald-500/30 animate-ping" />
        <div
          className="absolute inset-2 rounded-full border-2 border-emerald-500/50 animate-ping"
          style={{ animationDelay: "0.3s" }}
        />
        <div className="absolute inset-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
          <Navigation className="w-8 h-8 text-emerald-500 animate-pulse" />
        </div>
      </div>

      <div className="space-y-2 text-center">
        <div className="h-4 w-48 bg-zinc-800 rounded-full animate-pulse" />
        <div className="h-3 w-32 bg-zinc-800/60 rounded-full animate-pulse mx-auto" />
      </div>

      <p className="text-zinc-500 text-sm">Connecting to live tracking...</p>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════
// 2. ERROR STATE
// ═══════════════════════════════════════════════════════════════

function ErrorState({ type, message }: { type: string; message: string }) {
  const isExpired = type === "expired";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex-1 flex flex-col items-center justify-center gap-6 px-6"
    >
      <div className="w-20 h-20 rounded-full bg-zinc-900 border border-white/5 flex items-center justify-center">
        {isExpired ? (
          <Clock className="w-10 h-10 text-zinc-500" />
        ) : (
          <MapPinOff className="w-10 h-10 text-zinc-500" />
        )}
      </div>

      <div className="text-center space-y-2">
        <h1 className="text-xl font-semibold text-white">
          {isExpired
            ? "This tracking link has expired"
            : type === "cancelled"
              ? "This session was cancelled"
              : "Session not found"}
        </h1>
        <p className="text-zinc-400 text-sm max-w-xs mx-auto">{message}</p>
      </div>

      <div className="mt-4 px-4 py-2 rounded-lg bg-zinc-900 border border-white/5">
        <p className="text-zinc-500 text-xs">
          If you believe this is an error, please contact your service provider.
        </p>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════
// 3. ACTIVE STATE — Main tracking UI with Mapbox
// ═══════════════════════════════════════════════════════════════

function ActiveState({
  data,
  lastFetched,
  isApproaching,
}: {
  data: TrackingPublicData;
  lastFetched: Date | null;
  isApproaching: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex-1 flex flex-col"
    >
      <TopBar data={data} isApproaching={isApproaching} />

      <div className="flex-[6] relative overflow-hidden">
        <MapboxTrackingView data={data} />
      </div>

      <div className="flex-[4] bg-zinc-950 border-t border-white/5 overflow-y-auto">
        <BottomDrawer
          data={data}
          lastFetched={lastFetched}
          isApproaching={isApproaching}
        />
      </div>
    </motion.div>
  );
}

// ── Top Bar ──────────────────────────────────────────────────

function TopBar({
  data,
  isApproaching,
}: {
  data: TrackingPublicData;
  isApproaching: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-zinc-950 border-b border-white/5">
      <div className="flex items-center gap-2.5">
        <span className="relative flex h-2.5 w-2.5">
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
              isApproaching ? "bg-amber-400" : "bg-emerald-400"
            }`}
          />
          <span
            className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
              isApproaching ? "bg-amber-500" : "bg-emerald-500"
            }`}
          />
        </span>
        <span className="text-sm font-medium text-white">
          {isApproaching ? "Arriving Momentarily" : "Live Tracking"}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Clock
          className={`w-3.5 h-3.5 ${isApproaching ? "text-amber-500" : "text-emerald-500"}`}
        />
        <span
          className={`text-sm font-mono font-medium ${
            isApproaching ? "text-amber-500" : "text-emerald-500"
          }`}
        >
          {isApproaching
            ? "Almost there!"
            : data.eta_minutes != null
              ? `Arriving in ${formatEta(data.eta_minutes)}`
              : "Calculating ETA..."}
        </span>
      </div>
    </div>
  );
}

// ── Mapbox Tracking View ─────────────────────────────────────

function MapboxTrackingView({ data }: { data: TrackingPublicData }) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const workerMarkerRef = useRef<any>(null);
  const destMarkerRef = useRef<any>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  const workerLat = data.current_lat;
  const workerLng = data.current_lng;
  const destLat = data.destination_lat;
  const destLng = data.destination_lng;

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    if (!token) {
      setMapLoaded(false);
      return;
    }

    let map: any;
    let cancelled = false;

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://api.mapbox.com/mapbox-gl-js/v3.9.4/mapbox-gl.css";
    if (!document.getElementById("mapbox-gl-css-tracking")) {
      link.id = "mapbox-gl-css-tracking";
      document.head.appendChild(link);
    }

    import("mapbox-gl").then((mod) => {
      if (cancelled) return;
      const mapboxgl = mod.default;
      mapboxgl.accessToken = token;

      const centerLat = workerLat || destLat || -27.4698;
      const centerLng = workerLng || destLng || 153.0251;

      map = new mapboxgl.Map({
        container: mapContainerRef.current!,
        style: "mapbox://styles/mapbox/dark-v11",
        center: [centerLng, centerLat],
        zoom: 13,
        attributionControl: false,
        logoPosition: "bottom-right",
      });

      map.addControl(
        new mapboxgl.AttributionControl({ compact: true }),
        "bottom-right",
      );

      map.on("load", () => {
        if (cancelled) return;
        mapRef.current = map;
        setMapLoaded(true);

        // Worker marker (custom car SVG)
        if (workerLat && workerLng) {
          const workerEl = document.createElement("div");
          workerEl.innerHTML = `
            <div style="position:relative;width:44px;height:44px;">
              <div style="position:absolute;inset:-8px;border-radius:50%;background:rgba(16,185,129,0.15);animation:pulse 2s ease-in-out infinite;"></div>
              <div style="width:44px;height:44px;border-radius:50%;background:#10B981;display:flex;align-items:center;justify-content:center;box-shadow:0 0 20px rgba(16,185,129,0.5);transform:rotate(${data.current_heading ?? 0}deg);">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>
                </svg>
              </div>
            </div>
          `;
          workerEl.style.cursor = "pointer";

          workerMarkerRef.current = new mapboxgl.Marker({
            element: workerEl,
            anchor: "center",
          })
            .setLngLat([workerLng, workerLat])
            .addTo(map);
        }

        // Destination marker
        if (destLat && destLng) {
          const destEl = document.createElement("div");
          destEl.innerHTML = `
            <div style="width:36px;height:36px;border-radius:50%;background:#F43F5E;display:flex;align-items:center;justify-content:center;box-shadow:0 0 12px rgba(244,63,94,0.4);">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
            </div>
          `;

          destMarkerRef.current = new mapboxgl.Marker({
            element: destEl,
            anchor: "center",
          })
            .setLngLat([destLng, destLat])
            .addTo(map);
        }

        // Fit bounds to show both markers
        if (workerLat && workerLng && destLat && destLng) {
          const bounds = new mapboxgl.LngLatBounds();
          bounds.extend([workerLng, workerLat]);
          bounds.extend([destLng, destLat]);
          map.fitBounds(bounds, { padding: 80, maxZoom: 15 });
        }
      });
    });

    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
    };
    // Only init once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Animate worker marker on position updates
  useEffect(() => {
    if (!mapLoaded || !workerMarkerRef.current || !workerLat || !workerLng)
      return;

    workerMarkerRef.current.setLngLat([workerLng, workerLat]);

    // Rotate marker to heading
    const el = workerMarkerRef.current.getElement();
    const innerDiv = el?.querySelector("div > div:nth-child(2)");
    if (innerDiv && data.current_heading != null) {
      (innerDiv as HTMLElement).style.transform = `rotate(${data.current_heading}deg)`;
    }

    // Pan map to follow worker
    if (mapRef.current) {
      mapRef.current.panTo([workerLng, workerLat], { duration: 1000 });
    }
  }, [workerLat, workerLng, data.current_heading, mapLoaded]);

  return (
    <div className="absolute inset-0 bg-[#0A0A0A]">
      <div ref={mapContainerRef} className="w-full h-full" />

      {!mapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <CssMapFallback data={data} />
        </div>
      )}

      {/* Off-route banner */}
      <AnimatePresence>
        {data.is_off_route && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-3 left-3 right-3 z-10"
          >
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 backdrop-blur-sm">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
              <p className="text-xs text-amber-400">
                {data.off_route_message ??
                  "Technician has made a brief operational stop."}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── CSS Map Fallback (when Mapbox token unavailable) ─────────

function CssMapFallback({ data }: { data: TrackingPublicData }) {
  return (
    <div className="absolute inset-0 bg-[#0A0A0A]">
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
        }}
      />

      <div
        className="absolute inset-0 opacity-30"
        style={{
          background:
            "radial-gradient(ellipse at 50% 50%, rgba(16,185,129,0.06) 0%, transparent 70%)",
        }}
      />

      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="routeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#10B981" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#F43F5E" stopOpacity="0.6" />
          </linearGradient>
        </defs>
        <line
          x1="30"
          y1="55"
          x2="70"
          y2="40"
          stroke="url(#routeGrad)"
          strokeWidth="0.3"
          strokeDasharray="2 2"
          className="animate-dash"
        />
      </svg>

      <div className="absolute left-[28%] top-[50%] -translate-x-1/2 -translate-y-1/2">
        <div
          className="absolute -inset-6 rounded-full border border-emerald-500/20 animate-ping"
          style={{ animationDuration: "2s" }}
        />
        <div className="absolute -inset-3 rounded-full bg-emerald-500/10 blur-md" />
        <motion.div
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="relative w-5 h-5 rounded-full bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.5)] flex items-center justify-center"
        >
          <Navigation
            className="w-3 h-3 text-white"
            style={{ transform: `rotate(${data.current_heading ?? 45}deg)` }}
          />
        </motion.div>
        <div className="absolute top-8 left-1/2 -translate-x-1/2 whitespace-nowrap">
          <span className="text-[10px] font-mono text-emerald-500/70 bg-zinc-950/80 px-2 py-0.5 rounded-full border border-emerald-500/20">
            {data.worker_name ?? "Worker"}
          </span>
        </div>
      </div>

      <div className="absolute left-[68%] top-[36%] -translate-x-1/2 -translate-y-1/2">
        <div className="absolute -inset-2 rounded-full bg-rose-500/10 blur-sm" />
        <div className="relative w-4 h-4 rounded-full bg-rose-500/90 shadow-[0_0_12px_rgba(244,63,94,0.4)] flex items-center justify-center">
          <MapPin className="w-2.5 h-2.5 text-white" />
        </div>
        <div className="absolute top-7 left-1/2 -translate-x-1/2 whitespace-nowrap">
          <span className="text-[10px] font-mono text-rose-400/70 bg-zinc-950/80 px-2 py-0.5 rounded-full border border-rose-500/20">
            Destination
          </span>
        </div>
      </div>

      <style jsx>{`
        @keyframes dashScroll {
          to {
            stroke-dashoffset: -20;
          }
        }
        .animate-dash {
          animation: dashScroll 1.5s linear infinite;
        }
      `}</style>
    </div>
  );
}

// ── Bottom Drawer ────────────────────────────────────────────

function BottomDrawer({
  data,
  lastFetched,
  isApproaching,
}: {
  data: TrackingPublicData;
  lastFetched: Date | null;
  isApproaching: boolean;
}) {
  const progressPct = (() => {
    const dist = data.distance_remaining_km;
    if (dist == null) return 0;
    const maxDist = 30;
    const pct = Math.max(0, Math.min(100, ((maxDist - dist) / maxDist) * 100));
    return pct;
  })();

  return (
    <div className="px-4 py-4 space-y-4">
      {/* Approaching banner */}
      <AnimatePresence>
        {isApproaching && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                <Navigation className="w-5 h-5 text-amber-500 animate-pulse" />
              </div>
              <div>
                <p className="text-sm font-semibold text-amber-400">
                  Arriving momentarily
                </p>
                <p className="text-xs text-amber-400/60">
                  {data.worker_name} is very close to your location
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Worker Identity Card */}
      <div className="flex items-start gap-4">
        <div className="shrink-0">
          {data.worker_avatar_url ? (
            <img
              src={data.worker_avatar_url}
              alt={data.worker_name ?? "Worker"}
              className="w-[72px] h-[72px] rounded-full object-cover border-2 border-emerald-500/30"
            />
          ) : (
            <div className="w-[72px] h-[72px] rounded-full bg-zinc-800 border-2 border-emerald-500/30 flex items-center justify-center">
              <span className="text-xl font-semibold text-emerald-500">
                {getInitials(data.worker_name)}
              </span>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 space-y-1.5">
          <h2 className="text-lg font-semibold text-white truncate">
            {data.worker_name ?? "Your Technician"}
          </h2>

          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400">
            <Radio className="w-3 h-3" />
            {formatRoleBadge(data.worker_role)}
          </span>

          {(data.vehicle_description || data.vehicle_registration) && (
            <div className="flex items-center gap-1.5 text-zinc-400 text-xs">
              <Truck className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">
                {[data.vehicle_description, data.vehicle_registration]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </div>
          )}
        </div>

        {data.worker_phone_masked && (
          <button className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-colors text-xs">
            <Phone className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              Call {data.worker_phone_masked}
            </span>
          </button>
        )}
      </div>

      {/* Destination */}
      {data.destination_address && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-zinc-900 border border-white/5">
          <MapPin className="w-4 h-4 text-zinc-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-0.5">
              Heading to
            </p>
            <p className="text-sm text-zinc-300">{data.destination_address}</p>
          </div>
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-zinc-900 rounded-xl border border-white/5 px-3 py-3 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Clock className="w-3 h-3 text-emerald-500" />
            <span className="text-[10px] uppercase tracking-wider text-zinc-500">
              ETA
            </span>
          </div>
          <p className="text-2xl font-mono font-bold text-emerald-500">
            {data.eta_minutes != null ? data.eta_minutes : "—"}
          </p>
          <p className="text-[10px] text-zinc-500">
            {data.eta_minutes != null ? "min" : ""}
          </p>
        </div>

        <div className="bg-zinc-900 rounded-xl border border-white/5 px-3 py-3 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Route className="w-3 h-3 text-zinc-400" />
            <span className="text-[10px] uppercase tracking-wider text-zinc-500">
              Distance
            </span>
          </div>
          <p className="text-2xl font-mono font-bold text-white">
            {data.distance_remaining_km != null
              ? data.distance_remaining_km
              : "—"}
          </p>
          <p className="text-[10px] text-zinc-500">
            {data.distance_remaining_km != null ? "km" : ""}
          </p>
        </div>

        <div className="bg-zinc-900 rounded-xl border border-white/5 px-3 py-3 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Gauge className="w-3 h-3 text-zinc-400" />
            <span className="text-[10px] uppercase tracking-wider text-zinc-500">
              Speed
            </span>
          </div>
          <p className="text-2xl font-mono font-bold text-white">
            {formatSpeed(data.current_speed).replace(" km/h", "")}
          </p>
          <p className="text-[10px] text-zinc-500">km/h</p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-[10px] text-zinc-500">
          <span>En Route</span>
          <span>{isApproaching ? "Almost There!" : "Arriving"}</span>
        </div>
        <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${
              isApproaching
                ? "bg-gradient-to-r from-amber-600 to-amber-400"
                : "bg-gradient-to-r from-emerald-600 to-emerald-400"
            }`}
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* Privacy notice + last updated */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-1 text-[10px] text-zinc-600">
          <Shield className="w-3 h-3" />
          <span>End-to-end encrypted</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/50 animate-pulse" />
          <p className="text-[10px] text-zinc-600">
            Updated{" "}
            <span className="font-mono text-zinc-500">
              {lastFetched ? formatTime(lastFetched.toISOString()) : "—"}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// 4. ARRIVED STATE — Success celebration
// ═══════════════════════════════════════════════════════════════

function ArrivedState({ data }: { data: TrackingPublicData }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex-1 flex flex-col items-center justify-center gap-6 px-6 relative overflow-hidden"
    >
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-emerald-500"
            style={{
              width: `${2 + Math.random() * 4}px`,
              height: `${2 + Math.random() * 4}px`,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              opacity: 0,
              animation: `emeraldFloat ${3 + Math.random() * 4}s ease-in-out ${Math.random() * 2}s infinite`,
            }}
          />
        ))}
      </div>

      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 50% 45%, rgba(16,185,129,0.08) 0%, transparent 60%)",
        }}
      />

      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{
          type: "spring",
          stiffness: 200,
          damping: 20,
          delay: 0.2,
        }}
        className="relative"
      >
        <div className="w-28 h-28 rounded-full border-2 border-emerald-500/30 flex items-center justify-center">
          <div className="w-24 h-24 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <CheckCircle2 className="w-14 h-14 text-emerald-500" />
          </div>
        </div>
        <div
          className="absolute inset-0 rounded-full border-2 border-emerald-500/20 animate-ping"
          style={{ animationDuration: "2s" }}
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="text-center space-y-2 relative z-10"
      >
        <h1 className="text-2xl font-semibold text-white">
          {data.worker_name ?? "Your technician"} has arrived
        </h1>
        {data.destination_address && (
          <p className="text-zinc-400 text-sm max-w-xs mx-auto">
            at {data.destination_address}
          </p>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-900 border border-white/5"
      >
        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
        <p className="text-sm text-zinc-400">
          Arrived at{" "}
          <span className="font-mono text-emerald-500">
            {formatTime(data.arrived_at)}
          </span>
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1 }}
        className="flex items-center gap-3 px-4 py-3 rounded-xl bg-zinc-900/60 border border-white/5 backdrop-blur-sm"
      >
        {data.worker_avatar_url ? (
          <img
            src={data.worker_avatar_url}
            alt={data.worker_name ?? "Worker"}
            className="w-10 h-10 rounded-full object-cover border border-emerald-500/30"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-zinc-800 border border-emerald-500/30 flex items-center justify-center">
            <span className="text-sm font-semibold text-emerald-500">
              {getInitials(data.worker_name)}
            </span>
          </div>
        )}
        <div>
          <p className="text-sm font-medium text-white">{data.worker_name}</p>
          <p className="text-xs text-zinc-500">Is at your location</p>
        </div>
      </motion.div>

      <style jsx>{`
        @keyframes emeraldFloat {
          0% {
            opacity: 0;
            transform: translateY(0) scale(0);
          }
          20% {
            opacity: 0.6;
            transform: translateY(-20px) scale(1);
          }
          80% {
            opacity: 0.3;
            transform: translateY(-80px) scale(0.8);
          }
          100% {
            opacity: 0;
            transform: translateY(-120px) scale(0);
          }
        }
      `}</style>
    </motion.div>
  );
}

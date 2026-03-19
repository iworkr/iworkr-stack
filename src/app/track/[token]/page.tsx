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
} from "lucide-react";

import {
  getTrackingByToken,
  type TrackingPublicData,
} from "@/app/actions/glasshouse-arrival";

// Re-export type for convenience — the server action returns { data, error }
type TrackingResult = { data: TrackingPublicData | null; error: string | null };

// ═══════════════════════════════════════════════════════════════
// /track/[token] — Public Uber-style arrival tracking page
// No authentication required. Anonymous access via secure token.
// ═══════════════════════════════════════════════════════════════

type PageState = "loading" | "error" | "active" | "arrived";

// ── Helpers ──────────────────────────────────────────────────

function formatEta(mins: number | undefined | null): string {
  if (mins == null || mins <= 0) return "< 1 min";
  if (mins === 1) return "1 min";
  return `${Math.round(mins)} mins`;
}

function formatDistance(km: number | undefined | null): string {
  if (km == null) return "—";
  if (km < 0.1) return "< 100m";
  if (km < 1) return `${Math.round(km * 1000)}m`;
  return `${km.toFixed(1)} km`;
}

function formatSpeed(speed: number | undefined | null): string {
  if (speed == null || speed <= 0) return "—";
  // speed from DB is m/s, convert to km/h
  const kmh = speed * 3.6;
  return `${Math.round(kmh)} km/h`;
}

function formatCoord(val: number | undefined | null): string {
  if (val == null) return "—";
  return val.toFixed(4) + "°";
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

  // ── Fetch logic ────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    if (!token) return;

    try {
      const result: TrackingResult = await getTrackingByToken(token);

      // Server action wrapper returned an error
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

      // The RPC returns an error field inside the data for not_found/expired/cancelled
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
      } else {
        setPageState("active");
      }
    } catch {
      setErrorType("not_found");
      setErrorMessage("Unable to connect. Please try again.");
      setPageState("error");
    }
  }, [token]);

  // ── Lifecycle ──────────────────────────────────────────────

  useEffect(() => {
    fetchData();

    // Poll every 5 seconds
    intervalRef.current = setInterval(fetchData, 5000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [fetchData]);

  // ── Render ─────────────────────────────────────────────────

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
        {pageState === "active" && data && (
          <ActiveState
            key="active"
            data={data}
            lastFetched={lastFetched}
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
      {/* Pulsing rings */}
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

      <p className="text-zinc-500 text-sm">Loading tracking data...</p>
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
// 3. ACTIVE STATE — Main tracking UI
// ═══════════════════════════════════════════════════════════════

function ActiveState({
  data,
  lastFetched,
}: {
  data: TrackingPublicData;
  lastFetched: Date | null;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex-1 flex flex-col"
    >
      {/* ── Top Bar ──────────────────────────────────────────── */}
      <TopBar data={data} />

      {/* ── Map Visualization (60%) ──────────────────────────── */}
      <div className="flex-[6] relative overflow-hidden">
        <MapVisualization data={data} />
      </div>

      {/* ── Bottom Drawer (40%) ──────────────────────────────── */}
      <div className="flex-[4] bg-zinc-950 border-t border-white/5 overflow-y-auto">
        <BottomDrawer data={data} lastFetched={lastFetched} />
      </div>
    </motion.div>
  );
}

// ── Top Bar ──────────────────────────────────────────────────

function TopBar({ data }: { data: TrackingPublicData }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-zinc-950 border-b border-white/5">
      <div className="flex items-center gap-2.5">
        {/* Pulsing green dot */}
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
        </span>
        <span className="text-sm font-medium text-white">Live Tracking</span>
      </div>

      <div className="flex items-center gap-2">
        <Clock className="w-3.5 h-3.5 text-emerald-500" />
        <span className="text-sm font-mono text-emerald-500 font-medium">
          {data.eta_minutes != null
            ? `Arriving in ${formatEta(data.eta_minutes)}`
            : "Calculating ETA..."}
        </span>
      </div>
    </div>
  );
}

// ── Map Visualization ────────────────────────────────────────
// Pure CSS — no mapping library.

function MapVisualization({ data }: { data: TrackingPublicData }) {
  const workerLat = data.current_lat;
  const workerLng = data.current_lng;
  const destLat = data.destination_lat;
  const destLng = data.destination_lng;

  return (
    <div className="absolute inset-0 bg-[#0A0A0A]">
      {/* Grid background */}
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

      {/* Subtle radial gradient backdrop */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          background:
            "radial-gradient(ellipse at 50% 50%, rgba(16,185,129,0.06) 0%, transparent 70%)",
        }}
      />

      {/* Animated dashed route line */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
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

      {/* Worker position — pulsing emerald */}
      <div className="absolute left-[28%] top-[50%] -translate-x-1/2 -translate-y-1/2">
        {/* Outer pulse rings */}
        <div className="absolute -inset-6 rounded-full border border-emerald-500/20 animate-ping" style={{ animationDuration: "2s" }} />
        <div className="absolute -inset-4 rounded-full border border-emerald-500/30 animate-ping" style={{ animationDuration: "2.5s", animationDelay: "0.5s" }} />

        {/* Glow */}
        <div className="absolute -inset-3 rounded-full bg-emerald-500/10 blur-md" />

        {/* Dot */}
        <motion.div
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="relative w-5 h-5 rounded-full bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.5)] flex items-center justify-center"
        >
          <Navigation className="w-3 h-3 text-white" style={{ transform: `rotate(${data.current_heading ?? 45}deg)` }} />
        </motion.div>

        {/* Label */}
        <div className="absolute top-8 left-1/2 -translate-x-1/2 whitespace-nowrap">
          <span className="text-[10px] font-mono text-emerald-500/70 bg-zinc-950/80 px-2 py-0.5 rounded-full border border-emerald-500/20">
            {data.worker_name ?? "Worker"}
          </span>
        </div>
      </div>

      {/* Destination — static rose dot */}
      <div className="absolute left-[68%] top-[36%] -translate-x-1/2 -translate-y-1/2">
        {/* Glow */}
        <div className="absolute -inset-2 rounded-full bg-rose-500/10 blur-sm" />

        {/* Pin */}
        <div className="relative w-4 h-4 rounded-full bg-rose-500/90 shadow-[0_0_12px_rgba(244,63,94,0.4)] flex items-center justify-center">
          <MapPin className="w-2.5 h-2.5 text-white" />
        </div>

        {/* Label */}
        <div className="absolute top-7 left-1/2 -translate-x-1/2 whitespace-nowrap">
          <span className="text-[10px] font-mono text-rose-400/70 bg-zinc-950/80 px-2 py-0.5 rounded-full border border-rose-500/20">
            Destination
          </span>
        </div>
      </div>

      {/* Coordinate readout */}
      <div className="absolute bottom-3 left-3 right-3 flex justify-between items-end">
        <div className="bg-zinc-950/80 backdrop-blur-sm rounded-lg border border-white/5 px-3 py-2 space-y-0.5">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Worker Position</p>
          <p className="text-xs font-mono text-zinc-300">
            {formatCoord(workerLat)}, {formatCoord(workerLng)}
          </p>
        </div>
        <div className="bg-zinc-950/80 backdrop-blur-sm rounded-lg border border-white/5 px-3 py-2 space-y-0.5 text-right">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Destination</p>
          <p className="text-xs font-mono text-zinc-300">
            {formatCoord(destLat)}, {formatCoord(destLng)}
          </p>
        </div>
      </div>

      {/* Off-route banner */}
      <AnimatePresence>
        {data.is_off_route && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-3 left-3 right-3"
          >
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 backdrop-blur-sm">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
              <p className="text-xs text-amber-400">
                {data.off_route_message ?? "Technician has made a brief operational stop."}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CSS animation for dashed line */}
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
}: {
  data: TrackingPublicData;
  lastFetched: Date | null;
}) {
  // Calculate progress percentage
  const progressPct = (() => {
    const dist = data.distance_remaining_km;
    if (dist == null) return 0;
    // Assume max distance ~30km for visual progress
    const maxDist = 30;
    const pct = Math.max(0, Math.min(100, ((maxDist - dist) / maxDist) * 100));
    return pct;
  })();

  return (
    <div className="px-4 py-4 space-y-4">
      {/* ── Worker Identity Card ─────────────────────────────── */}
      <div className="flex items-start gap-4">
        {/* Avatar */}
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

        {/* Name + role + vehicle */}
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
                  .join(" • ")}
              </span>
            </div>
          )}
        </div>

        {/* Phone button */}
        {data.worker_phone_masked && (
          <button
            className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-colors text-xs"
            onClick={() => {
              // In production this would initiate a masked call
            }}
          >
            <Phone className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Call {data.worker_phone_masked}</span>
          </button>
        )}
      </div>

      {/* ── Destination ──────────────────────────────────────── */}
      {data.destination_address && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-zinc-900 border border-white/5">
          <MapPin className="w-4 h-4 text-zinc-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-0.5">Heading to</p>
            <p className="text-sm text-zinc-300">{data.destination_address}</p>
          </div>
        </div>
      )}

      {/* ── Stats Row ────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2">
        {/* ETA */}
        <div className="bg-zinc-900 rounded-xl border border-white/5 px-3 py-3 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Clock className="w-3 h-3 text-emerald-500" />
            <span className="text-[10px] uppercase tracking-wider text-zinc-500">ETA</span>
          </div>
          <p className="text-2xl font-mono font-bold text-emerald-500">
            {data.eta_minutes != null ? data.eta_minutes : "—"}
          </p>
          <p className="text-[10px] text-zinc-500">
            {data.eta_minutes != null ? "min" : ""}
          </p>
        </div>

        {/* Distance */}
        <div className="bg-zinc-900 rounded-xl border border-white/5 px-3 py-3 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Route className="w-3 h-3 text-zinc-400" />
            <span className="text-[10px] uppercase tracking-wider text-zinc-500">Distance</span>
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

        {/* Speed */}
        <div className="bg-zinc-900 rounded-xl border border-white/5 px-3 py-3 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Gauge className="w-3 h-3 text-zinc-400" />
            <span className="text-[10px] uppercase tracking-wider text-zinc-500">Speed</span>
          </div>
          <p className="text-2xl font-mono font-bold text-white">
            {formatSpeed(data.current_speed).replace(" km/h", "")}
          </p>
          <p className="text-[10px] text-zinc-500">km/h</p>
        </div>
      </div>

      {/* ── Progress Bar ─────────────────────────────────────── */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-[10px] text-zinc-500">
          <span>En Route</span>
          <span>Arriving</span>
        </div>
        <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400"
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* ── Last Updated ─────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-1.5 pt-1">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/50 animate-pulse" />
        <p className="text-[10px] text-zinc-600">
          Data current as of{" "}
          <span className="font-mono text-zinc-500">
            {lastFetched ? formatTime(lastFetched.toISOString()) : "—"}
          </span>
          {data.last_position_update && (
            <>
              {" · "}
              Position updated{" "}
              <span className="font-mono text-zinc-500">
                {formatTime(data.last_position_update)}
              </span>
            </>
          )}
        </p>
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
      {/* ── Particle Background ──────────────────────────────── */}
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

      {/* ── Radial glow ──────────────────────────────────────── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 50% 45%, rgba(16,185,129,0.08) 0%, transparent 60%)",
        }}
      />

      {/* ── Success Icon ─────────────────────────────────────── */}
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.2 }}
        className="relative"
      >
        {/* Outer ring */}
        <div className="w-28 h-28 rounded-full border-2 border-emerald-500/30 flex items-center justify-center">
          <div className="w-24 h-24 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <CheckCircle2 className="w-14 h-14 text-emerald-500" />
          </div>
        </div>

        {/* Pulse ring */}
        <div className="absolute inset-0 rounded-full border-2 border-emerald-500/20 animate-ping" style={{ animationDuration: "2s" }} />
      </motion.div>

      {/* ── Text ─────────────────────────────────────────────── */}
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

      {/* ── Arrived time ─────────────────────────────────────── */}
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

      {/* ── Worker card (compact) ────────────────────────────── */}
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

      {/* ── Particle animation keyframes ─────────────────────── */}
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

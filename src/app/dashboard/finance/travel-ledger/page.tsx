/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

/**
 * Project Astrolabe — Geospatial Travel Ledger
 * Finance manager view for reviewing and approving GPS-verified NDIS transit claims.
 *
 * Layout: 40/60 split — Mapbox dark canvas (left) | Financial data grid (right)
 */

import { useState, useEffect, useCallback, useRef, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin, Navigation, Clock, DollarSign, CheckCircle2, AlertTriangle,
  Flag, Loader2, RefreshCw, ChevronRight, X, Route, Zap,
  Car, TrendingUp,
} from "lucide-react";
import { useOrg } from "@/lib/hooks/use-org";
import { useToastStore } from "@/components/app/action-toast";
import {
  getTravelClaims,
  approveTravelClaim,
  bulkApproveCleanTravelClaims,
  rejectTravelClaim,
  pushTravelClaimsToLedgerPrime,
  type TravelClaim,
  type TravelClaimStatus,
  type TravelLedgerSummary,
} from "@/app/actions/astrolabe-travel";

// ─── Types ────────────────────────────────────────────────────────────────────

type TabFilter = "PENDING_REVIEW" | "FLAGGED_VARIANCE" | "APPROVED" | "BILLED";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatAUD(val: number | null | undefined): string {
  if (val == null) return "—";
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(val);
}

function formatMins(secs: number | null | undefined): string {
  if (secs == null) return "—";
  const m = Math.round(secs / 60);
  return `${m}m`;
}

function formatKm(val: number | null | undefined): string {
  if (val == null) return "—";
  return `${Number(val).toFixed(1)} km`;
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-AU", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

function statusConfig(status: TravelClaimStatus): {
  label: string; bg: string; text: string; icon: React.ReactNode;
} {
  switch (status) {
    case "PENDING_API":
      return { label: "Processing", bg: "bg-zinc-800", text: "text-zinc-400", icon: <Loader2 className="w-2.5 h-2.5 animate-spin" /> };
    case "VERIFIED_CLEAN":
      return { label: "Verified", bg: "bg-emerald-500/10", text: "text-emerald-400", icon: <CheckCircle2 className="w-2.5 h-2.5" /> };
    case "FLAGGED_VARIANCE":
      return { label: "Flagged", bg: "bg-rose-500/10", text: "text-rose-400", icon: <AlertTriangle className="w-2.5 h-2.5" /> };
    case "APPROVED":
      return { label: "Approved", bg: "bg-sky-500/10", text: "text-sky-400", icon: <CheckCircle2 className="w-2.5 h-2.5" /> };
    case "OVERRIDDEN":
      return { label: "Overridden", bg: "bg-amber-500/10", text: "text-amber-400", icon: <Flag className="w-2.5 h-2.5" /> };
    case "BILLED":
      return { label: "Billed", bg: "bg-violet-500/10", text: "text-violet-400", icon: <DollarSign className="w-2.5 h-2.5" /> };
    case "REJECTED":
      return { label: "Rejected", bg: "bg-zinc-800", text: "text-zinc-600", icon: <X className="w-2.5 h-2.5" /> };
    default:
      return { label: status, bg: "bg-zinc-800", text: "text-zinc-400", icon: null };
  }
}

// ─── MapboxCanvas ─────────────────────────────────────────────────────────────

function MapboxCanvas({ claim }: { claim: TravelClaim | null }) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const lineLayerRef = useRef(false);

  // Initialize Mapbox
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!mapContainerRef.current) return;

    import("mapbox-gl").then(({ default: mapboxgl }) => {
      const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
      if (!token) return;

      mapboxgl.accessToken = token;

      const map = new mapboxgl.Map({
        container: mapContainerRef.current!,
        style: "mapbox://styles/mapbox/dark-v11",
        center: [133.7751, -25.2744], // Australia centre
        zoom: 4,
        attributionControl: false,
      });

      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
      mapRef.current = map;
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Fly to claim & render markers
  useEffect(() => {
    if (!mapRef.current || !claim) return;

    const map = mapRef.current;

    // Clear existing markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    // Remove existing route layer
    if (lineLayerRef.current) {
      try {
        map.removeLayer("route-line");
        map.removeSource("route-source");
      } catch {}
      lineLayerRef.current = false;
    }

    import("mapbox-gl").then(({ default: mapboxgl }) => {
      // Start marker (green)
      const startEl = document.createElement("div");
      startEl.className = "w-4 h-4 rounded-full bg-emerald-500 border-2 border-white shadow-lg";
      const startMarker = new mapboxgl.Marker({ element: startEl })
        .setLngLat([claim.start_lng, claim.start_lat])
        .setPopup(new mapboxgl.Popup({ offset: 12 }).setHTML(
          `<div style="background:#0A0A0A;color:#fff;padding:8px 10px;border-radius:8px;font-size:11px;font-family:monospace;">`
          + `<strong>ORIGIN</strong><br/>${claim.origin_label ?? "Start"}`
          + `</div>`
        ))
        .addTo(map);
      markersRef.current.push(startMarker);

      // End marker (rose)
      if (claim.end_lat != null && claim.end_lng != null) {
        const endEl = document.createElement("div");
        endEl.className = "w-4 h-4 rounded-full bg-rose-500 border-2 border-white shadow-lg";
        const endMarker = new mapboxgl.Marker({ element: endEl })
          .setLngLat([claim.end_lng!, claim.end_lat!])
          .setPopup(new mapboxgl.Popup({ offset: 12 }).setHTML(
            `<div style="background:#0A0A0A;color:#fff;padding:8px 10px;border-radius:8px;font-size:11px;font-family:monospace;">`
            + `<strong>DESTINATION</strong><br/>${claim.destination_label ?? "End"}`
            + `</div>`
          ))
          .addTo(map);
        markersRef.current.push(endMarker);

        // Draw straight line (ideally would decode route_polyline if available)
        const coordinates: [number, number][] = [
          [claim.start_lng, claim.start_lat],
          [claim.end_lng!, claim.end_lat!],
        ];

        // Decode polyline if available
        if (claim.route_polyline) {
          // Use simplified straight line for now — decoded polyline would go here
        }

        const geojson = {
          type: "Feature" as const,
          geometry: { type: "LineString" as const, coordinates },
          properties: {},
        };

        if (map.loaded()) {
          map.addSource("route-source", { type: "geojson", data: geojson });
          map.addLayer({
            id: "route-line",
            type: "line",
            source: "route-source",
            layout: { "line-join": "round", "line-cap": "round" },
            paint: {
              "line-color": "#10B981",
              "line-width": 3,
              "line-dasharray": [2, 2],
              "line-opacity": 0.8,
            },
          });
          lineLayerRef.current = true;
        } else {
          map.once("load", () => {
            map.addSource("route-source", { type: "geojson", data: geojson });
            map.addLayer({
              id: "route-line",
              type: "line",
              source: "route-source",
              layout: { "line-join": "round", "line-cap": "round" },
              paint: {
                "line-color": "#10B981",
                "line-width": 3,
                "line-dasharray": [2, 2],
                "line-opacity": 0.8,
              },
            });
            lineLayerRef.current = true;
          });
        }

        // Fly to bounds
        const bounds: [[number, number], [number, number]] = [
          [Math.min(claim.start_lng, claim.end_lng!) - 0.01, Math.min(claim.start_lat, claim.end_lat!) - 0.01],
          [Math.max(claim.start_lng, claim.end_lng!) + 0.01, Math.max(claim.start_lat, claim.end_lat!) + 0.01],
        ];

        map.fitBounds(bounds, { padding: 60, maxZoom: 14, duration: 800 });
      } else {
        // Only start point
        map.flyTo({ center: [claim.start_lng, claim.start_lat], zoom: 13, duration: 800 });
      }
    });
  }, [claim?.claim_id]);

  return (
    <div className="relative w-full h-full">
      {/* Map container */}
      <div ref={mapContainerRef} className="absolute inset-0 rounded-none" />

      {/* Legend */}
      {claim && (
        <div className="absolute bottom-4 left-4 bg-black/80 backdrop-blur-sm border border-white/10 rounded-lg px-3 py-2 space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            <span className="text-[10px] text-zinc-400" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              {claim.origin_label ?? "Origin"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-rose-500" />
            <span className="text-[10px] text-zinc-400" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              {claim.destination_label ?? "Destination"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-1 bg-emerald-500/60 rounded" style={{ border: "1px dashed #10B981" }} />
            <span className="text-[10px] text-zinc-400" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              {claim.api_verified_distance_meters != null
                ? formatKm(claim.api_verified_distance_meters / 1000)
                : "Route"}
            </span>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!claim && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/60">
          <Route className="w-10 h-10 text-zinc-800 mb-3" />
          <p className="text-xs text-zinc-600">Hover a row to plot the route</p>
        </div>
      )}
    </div>
  );
}

// ─── Override Modal ───────────────────────────────────────────────────────────

function OverrideModal({
  claim,
  onClose,
  onConfirm,
}: {
  claim: TravelClaim;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="bg-zinc-900 border border-white/10 rounded-xl p-6 w-[440px] shadow-2xl"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-[13px] font-semibold text-zinc-100">Override Cap & Approve</h3>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              Claim was capped. Provide justification to override.
            </p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded text-zinc-500 hover:text-zinc-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Flag details */}
        <div className="bg-rose-500/5 border border-rose-500/15 rounded-lg p-3 mb-4">
          <p className="text-[11px] text-rose-400 leading-relaxed">{claim.flagged_reason}</p>
        </div>

        <div className="mb-4">
          <label className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-1">
            Override Justification *
          </label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="e.g. Severe accident on M1 motorway, Traffic NSW incident report attached."
            rows={3}
            className="w-full px-2.5 py-2 bg-zinc-950 border border-white/5 rounded text-[12px] text-zinc-200 placeholder:text-zinc-700 focus:outline-none focus:border-white/20 resize-none"
          />
        </div>

        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 h-8 text-[11px] text-zinc-500 border border-white/5 rounded hover:text-zinc-300 transition-colors">
            Cancel
          </button>
          <button
            onClick={() => reason.trim() && onConfirm(reason.trim())}
            disabled={!reason.trim()}
            className="flex-1 h-8 text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded hover:bg-amber-500/20 transition-colors disabled:opacity-50"
          >
            Approve with Override
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Claim Row ────────────────────────────────────────────────────────────────

function ClaimRow({
  claim,
  selected,
  onHover,
  onApprove,
  onOverride,
  onReject,
}: {
  claim: TravelClaim;
  selected: boolean;
  onHover: () => void;
  onApprove: () => void;
  onOverride: () => void;
  onReject: () => void;
}) {
  const cfg = statusConfig(claim.status);
  const actualMins = claim.actual_duration_seconds != null
    ? Math.round(claim.actual_duration_seconds / 60) : null;
  const apiMins = claim.api_verified_duration_seconds != null
    ? Math.round(claim.api_verified_duration_seconds / 60) : null;
  const isFlagged = claim.status === "FLAGGED_VARIANCE";
  const isActionable = claim.status === "VERIFIED_CLEAN" || claim.status === "FLAGGED_VARIANCE";

  return (
    <motion.div
      layout
      onMouseEnter={onHover}
      className={`flex items-start gap-0 border-b border-white/[0.04] hover:bg-white/[0.015] transition-colors cursor-pointer ${selected ? "bg-white/[0.025]" : ""}`}
    >
      {/* Route & Worker (col 1) */}
      <div className="flex-1 min-w-0 px-4 py-3">
        <div className="flex items-center gap-1.5 mb-0.5">
          <Car className="w-2.5 h-2.5 text-zinc-700 shrink-0" />
          <span className="text-[11px] text-zinc-300 truncate">{claim.worker_name || "Worker"}</span>
          <span className="text-[9px] text-zinc-700 px-1.5 py-0.5 bg-zinc-900 rounded">
            {claim.transit_type === "PROVIDER_TRAVEL" ? "Provider Travel" : "Participant Transport"}
          </span>
        </div>
        <div className="flex items-center gap-1 mt-1">
          <span className="text-[10px] truncate" style={{ fontFamily: "'JetBrains Mono', monospace", color: "#71717A" }}>
            {claim.origin_label ?? "?"}
          </span>
          <ChevronRight className="w-2.5 h-2.5 text-zinc-700 shrink-0" />
          <span className="text-[10px] truncate" style={{ fontFamily: "'JetBrains Mono', monospace", color: "#71717A" }}>
            {claim.destination_label ?? "?"}
          </span>
        </div>
        <p className="text-[9px] text-zinc-700 mt-1">{formatDateTime(claim.device_start_time)}</p>
      </div>

      {/* Distance (col 2) */}
      <div className="w-20 px-3 py-3">
        <p className="text-[11px]" style={{ fontFamily: "'JetBrains Mono', monospace", color: "#D4D4D8" }}>
          {claim.api_verified_distance_meters != null
            ? formatKm(claim.api_verified_distance_meters / 1000)
            : "—"}
        </p>
        <p className="text-[9px] text-zinc-600 mt-0.5">{claim.mmm_zone ?? "—"}</p>
      </div>

      {/* Duration (col 3 — the audit column) */}
      <div className="w-28 px-3 py-3">
        <p className="text-[11px]"
          style={{ fontFamily: "'JetBrains Mono', monospace", color: isFlagged ? "#F43F5E" : "#D4D4D8" }}>
          {actualMins != null ? `${actualMins}m Actual` : "—"}
        </p>
        <p className="text-[10px]"
          style={{ fontFamily: "'JetBrains Mono', monospace", color: "#10B981" }}>
          {apiMins != null ? `${apiMins}m API` : "—"}
        </p>
        {claim.billable_labor_minutes != null && (
          <p className="text-[9px] text-sky-400 mt-0.5"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            → {claim.billable_labor_minutes}m billable
          </p>
        )}
      </div>

      {/* Claim Value (col 4) */}
      <div className="w-32 px-3 py-3">
        <p className="text-[11px]" style={{ fontFamily: "'JetBrains Mono', monospace", color: "#fff" }}>
          {formatAUD(claim.calculated_labor_cost)} Labor
        </p>
        <p className="text-[10px]" style={{ fontFamily: "'JetBrains Mono', monospace", color: "#71717A" }}>
          {formatAUD(claim.calculated_non_labor_cost)} KM
        </p>
      </div>

      {/* Status (col 5) */}
      <div className="w-24 px-3 py-3 flex items-start">
        <div className={`h-5 px-2 rounded-full flex items-center gap-1 text-[9px] font-medium ${cfg.bg} ${cfg.text}`}>
          {cfg.icon}
          {cfg.label}
        </div>
      </div>

      {/* Actions (col 6) */}
      <div className="w-28 px-3 py-3 flex flex-col gap-1">
        {isActionable && (
          <>
            <button
              onClick={e => { e.stopPropagation(); isFlagged ? onOverride() : onApprove(); }}
              className={`h-6 w-full rounded text-[9px] font-medium transition-colors ${
                isFlagged
                  ? "bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20"
                  : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20"
              }`}>
              {isFlagged ? "Review" : "Approve"}
            </button>
            <button
              onClick={e => { e.stopPropagation(); onReject(); }}
              className="h-6 w-full rounded text-[9px] text-zinc-600 border border-white/5 hover:text-rose-400 hover:border-rose-500/20 transition-colors">
              Reject
            </button>
          </>
        )}
        {claim.status === "APPROVED" || claim.status === "OVERRIDDEN" ? (
          <span className="text-[9px] text-emerald-500 flex items-center gap-1">
            <CheckCircle2 className="w-2.5 h-2.5" /> Ready to bill
          </span>
        ) : null}
      </div>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TravelLedgerPage() {
  const { orgId } = useOrg();
  const { addToast } = useToastStore();
  const [claims, setClaims] = useState<TravelClaim[]>([]);
  const [summary, setSummary] = useState<TravelLedgerSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabFilter>("PENDING_REVIEW");
  const [hoveredClaim, setHoveredClaim] = useState<TravelClaim | null>(null);
  const [overrideClaim, setOverrideClaim] = useState<TravelClaim | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const { claims: data, summary: sum } = await getTravelClaims(orgId, "all", 30);
      setClaims(data);
      setSummary(sum);
    } catch (err) {
      addToast("Failed to load travel claims", undefined, "error");
    } finally {
      setLoading(false);
    }
  }, [orgId, addToast]);

  useEffect(() => { load(); }, [load]);

  const filteredClaims = claims.filter(c => {
    if (activeTab === "PENDING_REVIEW") return c.status === "VERIFIED_CLEAN" || c.status === "PENDING_API";
    if (activeTab === "FLAGGED_VARIANCE") return c.status === "FLAGGED_VARIANCE";
    if (activeTab === "APPROVED") return c.status === "APPROVED" || c.status === "OVERRIDDEN";
    if (activeTab === "BILLED") return c.status === "BILLED";
    return false;
  });

  const handleApprove = async (claimId: string) => {
    if (!orgId) return;
    const result = await approveTravelClaim(orgId, claimId);
    if (result.ok) {
      addToast("Travel claim approved");
      await load();
    } else {
      addToast(result.error ?? "Approval failed", undefined, "error");
    }
  };

  const handleOverride = async (claimId: string, reason: string) => {
    if (!orgId) return;
    const result = await approveTravelClaim(orgId, claimId, reason);
    if (result.ok) {
      addToast("Override approved and recorded");
      setOverrideClaim(null);
      await load();
    } else {
      addToast(result.error ?? "Override failed", undefined, "error");
    }
  };

  const handleReject = async (claimId: string) => {
    if (!orgId) return;
    const result = await rejectTravelClaim(orgId, claimId, "Rejected by finance manager");
    if (result.ok) {
      addToast("Claim rejected");
      await load();
    } else {
      addToast(result.error ?? "Rejection failed", undefined, "error");
    }
  };

  const handleBulkApprove = async () => {
    if (!orgId) return;
    startTransition(async () => {
      const result = await bulkApproveCleanTravelClaims(orgId);
      if (result.ok) {
        addToast(`${result.approved_count ?? 0} clean transits approved`);
        await load();
      } else {
        addToast(result.error ?? "Bulk approval failed", undefined, "error");
      }
    });
  };

  const handlePushToLedger = async () => {
    if (!orgId) return;
    const approvedIds = claims
      .filter(c => c.status === "APPROVED" || c.status === "OVERRIDDEN")
      .map(c => c.claim_id);
    if (approvedIds.length === 0) {
      addToast("No approved claims to push", undefined, "error");
      return;
    }
    startTransition(async () => {
      const result = await pushTravelClaimsToLedgerPrime(orgId, approvedIds);
      if (result.ok) {
        addToast(`${result.billed_count} claims pushed to Ledger-Prime`);
        await load();
      } else {
        addToast(result.error ?? "Push failed", undefined, "error");
      }
    });
  };

  const TABS: { id: TabFilter; label: string; count: number }[] = [
    { id: "PENDING_REVIEW", label: "Pending Review", count: summary?.pending_count ?? 0 },
    { id: "FLAGGED_VARIANCE", label: "Flagged Variances", count: summary?.flagged_count ?? 0 },
    { id: "APPROVED", label: "Approved to Bill", count: summary?.approved_count ?? 0 },
    { id: "BILLED", label: "Billed", count: summary?.billed_count ?? 0 },
  ];

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      {/* Command header */}
      <div className="h-14 border-b border-white/5 flex items-center justify-between px-6 bg-[#050505] z-30 shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-zinc-600 uppercase tracking-widest">Finance</span>
            <ChevronRight className="w-3 h-3 text-zinc-700" />
            <span className="text-[11px] text-zinc-300">Travel Ledger</span>
          </div>
          {/* Pill Tabs */}
          <div className="flex items-center gap-1">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`h-6 px-3 rounded-full text-[10px] font-medium flex items-center gap-1.5 transition-colors ${
                  activeTab === tab.id
                    ? "bg-white text-black"
                    : "text-zinc-500 hover:text-zinc-300 border border-white/5"
                }`}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className={`text-[9px] rounded-full w-4 h-4 flex items-center justify-center font-bold ${
                    activeTab === tab.id ? "bg-black/20 text-black" : "bg-zinc-800 text-zinc-400"
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => startTransition(() => load())}
            disabled={loading || isPending}
            className="h-7 px-3 flex items-center gap-1.5 text-[11px] text-zinc-400 border border-white/5 rounded hover:border-white/10 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            Refresh
          </button>
          <button
            onClick={handleBulkApprove}
            disabled={isPending || (summary?.pending_count ?? 0) === 0}
            className="h-7 px-3 flex items-center gap-1.5 text-[11px] font-medium text-emerald-400 border border-emerald-500/20 rounded hover:bg-emerald-500/10 transition-colors disabled:opacity-40"
          >
            <Zap className="w-3 h-3" />
            Bulk Approve Clean
          </button>
          <button
            onClick={handlePushToLedger}
            disabled={isPending || (summary?.approved_count ?? 0) === 0}
            className="h-7 px-3 flex items-center gap-1.5 text-[11px] font-semibold bg-white text-black rounded hover:bg-zinc-100 transition-colors disabled:opacity-40"
          >
            <CheckCircle2 className="w-3 h-3" />
            Approve & Push to Ledger-Prime
          </button>
        </div>
      </div>

      {/* Telemetry Ribbon */}
      {summary && (
        <div className="border-b border-white/5 bg-zinc-950/30 shrink-0">
          <div className="flex items-center px-6 h-16 gap-8">
            {[
              { label: "Total Claims", value: String(summary.total_claims), icon: Route },
              { label: "Total Value", value: formatAUD(summary.total_value), icon: DollarSign, mono: true },
              { label: "Pending Review", value: String(summary.pending_count), icon: Clock },
              { label: "Flagged", value: String(summary.flagged_count), icon: AlertTriangle, alert: summary.flagged_count > 0 },
              { label: "Approved", value: String(summary.approved_count), icon: CheckCircle2 },
            ].map(({ label, value, icon: Icon, mono, alert }) => (
              <div key={label} className="flex items-center gap-3">
                <Icon className={`w-3.5 h-3.5 ${alert ? "text-rose-500" : "text-zinc-700"}`} />
                <div>
                  <span className="text-[10px] text-zinc-600 uppercase tracking-widest block">{label}</span>
                  <span
                    className={`text-[14px] font-medium ${alert ? "text-rose-400 font-bold animate-pulse" : "text-white"}`}
                    style={mono ? { fontFamily: "'JetBrains Mono', monospace" } : {}}
                  >
                    {value}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Split pane body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Mapbox Canvas (40%) */}
        <div className="w-[40%] relative border-r border-white/5 bg-zinc-950">
          <MapboxCanvas claim={hoveredClaim} />
        </div>

        {/* Right: Financial Grid (60%) */}
        <div className="w-[60%] flex flex-col overflow-hidden">
          {/* Grid header */}
          <div className="flex items-center border-b border-white/5 px-4 h-9 shrink-0">
            {["WORKER / ROUTE", "DIST", "DURATION", "CLAIM VALUE", "STATUS", "ACTION"].map(h => (
              <div key={h} className={`text-[9px] uppercase tracking-widest text-zinc-600 font-semibold ${
                h === "WORKER / ROUTE" ? "flex-1 min-w-0" :
                h === "DIST" ? "w-20" :
                h === "DURATION" ? "w-28" :
                h === "CLAIM VALUE" ? "w-32" :
                h === "STATUS" ? "w-24" : "w-28"
              }`}>
                {h}
              </div>
            ))}
          </div>

          {/* Grid rows */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-16 gap-2">
                <Loader2 className="w-4 h-4 text-zinc-600 animate-spin" />
                <span className="text-xs text-zinc-600">Loading travel claims…</span>
              </div>
            ) : filteredClaims.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Navigation className="w-8 h-8 text-zinc-800 mb-3" />
                <p className="text-sm text-zinc-500">No claims in this category.</p>
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {filteredClaims.map(claim => (
                  <ClaimRow
                    key={claim.claim_id}
                    claim={claim}
                    selected={hoveredClaim?.claim_id === claim.claim_id}
                    onHover={() => setHoveredClaim(claim)}
                    onApprove={() => handleApprove(claim.claim_id)}
                    onOverride={() => setOverrideClaim(claim)}
                    onReject={() => handleReject(claim.claim_id)}
                  />
                ))}
              </AnimatePresence>
            )}
          </div>
        </div>
      </div>

      {/* Override Modal */}
      <AnimatePresence>
        {overrideClaim && (
          <OverrideModal
            claim={overrideClaim}
            onClose={() => setOverrideClaim(null)}
            onConfirm={reason => handleOverride(overrideClaim.claim_id, reason)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

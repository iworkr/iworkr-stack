/**
 * @page /dashboard/finance/travel-ledger
 * @status COMPLETE
 * @description Geospatial travel ledger with Mapbox map and GPS-verified NDIS transit claims
 * @dataSource server-action
 * @lastAudit 2026-03-22
 */
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
  Navigation, Clock, DollarSign, CheckCircle2, AlertTriangle,
  Flag, Loader2, ChevronRight, X, Route, Car,
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
import { TravelActionBar } from "@/components/finance/TravelActionBar";

// ─── Types ────────────────────────────────────────────────────────────────────

type TabFilter = "PENDING_REVIEW" | "FLAGGED_VARIANCE" | "APPROVED" | "BILLED";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatAUD(val: number | null | undefined): string {
  if (val == null) return "—";
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(val);
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
  const expectedRouteLayerRef = useRef(false);
  const actualRouteLayerRef = useRef(false);

  const decodePolyline = useCallback((encoded: string): [number, number][] => {
    const points: [number, number][] = [];
    let index = 0;
    let lat = 0;
    let lng = 0;
    while (index < encoded.length) {
      let result = 0;
      let shift = 0;
      let b = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dLat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
      lat += dLat;
      result = 0;
      shift = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dLng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
      lng += dLng;
      points.push([lng / 1e5, lat / 1e5]);
    }
    return points;
  }, []);

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
        center: [133.7751, -25.2744],
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

  // Fly to claim & render markers/routes
  useEffect(() => {
    if (!mapRef.current || !claim) return;
    const map = mapRef.current;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    if (expectedRouteLayerRef.current) {
      try {
        map.removeLayer("expected-route-line");
        map.removeSource("expected-route-source");
      } catch {}
      expectedRouteLayerRef.current = false;
    }
    if (actualRouteLayerRef.current) {
      try {
        map.removeLayer("actual-route-line");
        map.removeSource("actual-route-source");
      } catch {}
      actualRouteLayerRef.current = false;
    }

    import("mapbox-gl").then(async ({ default: mapboxgl }) => {
      const startMarker = new mapboxgl.Marker({
        element: Object.assign(document.createElement("div"), {
          className: "w-4 h-4 rounded-full bg-emerald-500 border-2 border-white shadow-lg",
        }),
      })
        .setLngLat([claim.start_lng, claim.start_lat])
        .setPopup(new mapboxgl.Popup({ offset: 12 }).setHTML(`<div style="background:#0A0A0A;color:#fff;padding:8px 10px;border-radius:8px;font-size:11px;font-family:monospace;"><strong>ORIGIN</strong><br/>${claim.origin_label ?? "Start"}</div>`))
        .addTo(map);
      markersRef.current.push(startMarker);

      if (claim.end_lat == null || claim.end_lng == null) {
        map.flyTo({ center: [claim.start_lng, claim.start_lat], zoom: 13, duration: 800 });
        return;
      }

      const endMarker = new mapboxgl.Marker({
        element: Object.assign(document.createElement("div"), {
          className: "w-4 h-4 rounded-full bg-rose-500 border-2 border-white shadow-lg",
        }),
      })
        .setLngLat([claim.end_lng, claim.end_lat])
        .setPopup(new mapboxgl.Popup({ offset: 12 }).setHTML(`<div style="background:#0A0A0A;color:#fff;padding:8px 10px;border-radius:8px;font-size:11px;font-family:monospace;"><strong>DESTINATION</strong><br/>${claim.destination_label ?? "End"}</div>`))
        .addTo(map);
      markersRef.current.push(endMarker);

      const expectedCoordinates: [number, number][] = [
        [claim.start_lng, claim.start_lat],
        [claim.end_lng, claim.end_lat],
      ];
      try {
        const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
        if (token) {
          const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${claim.start_lng},${claim.start_lat};${claim.end_lng},${claim.end_lat}?geometries=polyline&overview=full&access_token=${token}`;
          const response = await fetch(url);
          const payload = await response.json();
          const geometry = payload?.routes?.[0]?.geometry as string | undefined;
          if (geometry) {
            const decoded = decodePolyline(geometry);
            if (decoded.length > 1) expectedCoordinates.splice(0, expectedCoordinates.length, ...decoded);
          }
        }
      } catch {}

      const actualCoordinates =
        claim.route_polyline && claim.route_polyline.length > 0
          ? decodePolyline(claim.route_polyline)
          : [];

      const addLayers = () => {
        map.addSource("expected-route-source", {
          type: "geojson",
          data: { type: "Feature", geometry: { type: "LineString", coordinates: expectedCoordinates }, properties: {} },
        });
        map.addLayer({
          id: "expected-route-line",
          type: "line",
          source: "expected-route-source",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": "#10B981", "line-width": 3, "line-opacity": 0.9 },
        });
        expectedRouteLayerRef.current = true;
        if (actualCoordinates.length > 1) {
          map.addSource("actual-route-source", {
            type: "geojson",
            data: { type: "Feature", geometry: { type: "LineString", coordinates: actualCoordinates }, properties: {} },
          });
          map.addLayer({
            id: "actual-route-line",
            type: "line",
            source: "actual-route-source",
            layout: { "line-join": "round", "line-cap": "round" },
            paint: { "line-color": "#F43F5E", "line-width": 2.5, "line-dasharray": [1.5, 1.5], "line-opacity": 0.95 },
          });
          actualRouteLayerRef.current = true;
        }
      };

      if (map.loaded()) addLayers();
      else map.once("load", addLayers);

      map.fitBounds(
        [
          [Math.min(claim.start_lng, claim.end_lng) - 0.01, Math.min(claim.start_lat, claim.end_lat) - 0.01],
          [Math.max(claim.start_lng, claim.end_lng) + 0.01, Math.max(claim.start_lat, claim.end_lat) + 0.01],
        ],
        { padding: 60, maxZoom: 14, duration: 800 },
      );
    });
  }, [claim?.claim_id, decodePolyline, claim]);

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
              Expected Route {claim.api_verified_distance_meters != null ? `(${formatKm(claim.api_verified_distance_meters / 1000)})` : ""}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-1 bg-rose-500/70 rounded" style={{ border: "1px dashed #F43F5E" }} />
            <span className="text-[10px] text-zinc-400" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              Actual GPS Trail
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
              onClick={(e) => {
                e.stopPropagation();
                if (isFlagged) onOverride();
                else onApprove();
              }}
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
  const [isPending, startTransition] = useTransition();

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const { claims: data, summary: sum } = await getTravelClaims(orgId, "all", 30);
      setClaims(data);
      setSummary(sum);
    } catch {
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
      {/* Breadcrumb rail */}
      <div className="flex h-9 items-center gap-2 border-b border-white/[0.04] px-6">
        <span className="text-[11px] uppercase tracking-widest text-zinc-600">Finance</span>
        <ChevronRight className="h-3 w-3 text-zinc-700" />
        <span className="text-[11px] text-zinc-300">Travel Ledger</span>
      </div>

      <TravelActionBar
        view={activeTab}
        tabs={TABS}
        isBusy={loading || isPending}
        onViewChange={setActiveTab}
        onRefresh={() => startTransition(() => load())}
        onBulkApproveClean={handleBulkApprove}
        onPushToLedger={handlePushToLedger}
        canBulkApprove={(summary?.pending_count ?? 0) > 0}
        canPushToLedger={(summary?.approved_count ?? 0) > 0}
      />

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

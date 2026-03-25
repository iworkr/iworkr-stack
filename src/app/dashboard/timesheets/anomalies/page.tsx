/**
 * @page Anomaly Review Dashboard
 * @status COMPLETE
 * @description Project Chronos-Lock: Dispatcher verification center for geofence
 *   anomalies. Split-screen with anomaly queue + forensic Mapbox map.
 * @lastAudit 2026-03-24
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuthStore } from "@/lib/auth-store";
import {
  fetchAnomaliesAction,
  fetchAnomalyStatsAction,
  resolveAnomalyAction,
  type TimesheetAnomaly,
  type AnomalyStats,
} from "@/app/actions/chronos-lock";
import { MapboxProvider, useMapbox, MAPBOX_ACCESS_TOKEN } from "@/components/maps/mapbox-provider";
import { OBSIDIAN_MAP_STYLE, applyObsidianStyle } from "@/components/maps/obsidian-map-styles";
import { createClient } from "@/lib/supabase/client";

type StatusFilter = "PENDING" | "APPROVED" | "REJECTED" | "ALL";

function AnomalyDashboardInner() {
  const orgId = useAuthStore((s) => s.currentOrg?.id);
  const [anomalies, setAnomalies] = useState<TimesheetAnomaly[]>([]);
  const [stats, setStats] = useState<AnomalyStats | null>(null);
  const [filter, setFilter] = useState<StatusFilter>("PENDING");
  const [selected, setSelected] = useState<TimesheetAnomaly | null>(null);
  const [resolving, setResolving] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [updateJobLocation, setUpdateJobLocation] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    const [anomalyData, statsData] = await Promise.all([
      fetchAnomaliesAction(orgId, filter),
      fetchAnomalyStatsAction(orgId),
    ]);
    setAnomalies(anomalyData);
    setStats(statsData);
    setLoading(false);
  }, [orgId, filter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Realtime subscription for new anomalies
  useEffect(() => {
    if (!orgId) return;
    const supabase = createClient();
    const channel = supabase
      .channel("anomalies-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "timesheet_anomalies",
          filter: `organization_id=eq.${orgId}`,
        },
        () => {
          loadData();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId, loadData]);

  const handleResolve = async (action: "APPROVED" | "REJECTED") => {
    if (!selected) return;
    setResolving(true);
    const result = await resolveAnomalyAction(
      selected.id,
      action,
      resolutionNotes || undefined,
      action === "APPROVED" ? updateJobLocation : false,
    );
    setResolving(false);
    if (!("error" in result)) {
      setSelected(null);
      setResolutionNotes("");
      setUpdateJobLocation(false);
      loadData();
    }
  };

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-800 px-6 py-4">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-white">
            Anomaly Review Center
          </h1>
          <p className="text-xs text-neutral-500">
            Project Chronos-Lock — Geofence breach verification
          </p>
        </div>
        <div className="flex items-center gap-3">
          {stats && (
            <div className="flex gap-4 text-xs">
              <StatPill label="Pending" value={stats.pending} color="amber" />
              <StatPill label="Approved" value={stats.approved} color="emerald" />
              <StatPill label="Rejected" value={stats.rejected} color="red" />
              <StatPill
                label="7d breaches"
                value={stats.total_breaches_7d}
                color="neutral"
              />
            </div>
          )}
          <button
            onClick={loadData}
            className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-neutral-400 transition hover:bg-neutral-800"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-neutral-800 px-6 py-2">
        {(["PENDING", "APPROVED", "REJECTED", "ALL"] as StatusFilter[]).map(
          (s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                filter === s
                  ? "bg-neutral-800 text-white"
                  : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ),
        )}
      </div>

      {/* Split view */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Anomaly queue */}
        <div className="w-[400px] shrink-0 overflow-y-auto border-r border-neutral-800">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
            </div>
          ) : anomalies.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-8">
              <div className="text-3xl">✅</div>
              <p className="text-sm text-neutral-500">No anomalies to review</p>
            </div>
          ) : (
            anomalies.map((a) => (
              <AnomalyCard
                key={a.id}
                anomaly={a}
                isSelected={selected?.id === a.id}
                onClick={() => setSelected(a)}
              />
            ))
          )}
        </div>

        {/* Right: Forensic map + details */}
        <div className="flex flex-1 flex-col">
          {selected ? (
            <>
              {/* Map */}
              <div className="relative h-[55%] min-h-[300px]">
                <ForensicMap anomaly={selected} />
              </div>

              {/* Evidence panel */}
              <div className="flex-1 overflow-y-auto border-t border-neutral-800 p-6">
                <div className="grid gap-4 md:grid-cols-2">
                  {/* Worker info */}
                  <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                      Worker
                    </h3>
                    <p className="text-sm font-medium text-white">
                      {selected.worker_name}
                    </p>
                    <p className="text-xs text-neutral-500">{selected.worker_email}</p>
                    <div className="mt-3 flex gap-3">
                      <InfoChip label="Type" value={formatAnomalyType(selected.anomaly_type)} />
                      <InfoChip
                        label="Distance"
                        value={
                          selected.recorded_distance_meters
                            ? formatDistance(selected.recorded_distance_meters)
                            : "N/A"
                        }
                      />
                      <InfoChip
                        label="Accuracy"
                        value={
                          selected.device_accuracy_meters
                            ? `${Math.round(selected.device_accuracy_meters)}m`
                            : "N/A"
                        }
                      />
                    </div>
                  </div>

                  {/* Justification */}
                  <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                      Worker Justification
                    </h3>
                    {selected.worker_justification ? (
                      <p className="text-sm leading-relaxed text-neutral-300">
                        &ldquo;{selected.worker_justification}&rdquo;
                      </p>
                    ) : (
                      <p className="text-sm italic text-neutral-600">
                        No justification provided
                      </p>
                    )}
                    <p className="mt-2 text-xs text-neutral-600">
                      {new Date(selected.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Adjudication */}
                {selected.status === "PENDING" && (
                  <div className="mt-4 rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
                    <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                      Adjudication
                    </h3>
                    <textarea
                      value={resolutionNotes}
                      onChange={(e) => setResolutionNotes(e.target.value)}
                      placeholder="Optional notes for the worker..."
                      rows={2}
                      className="w-full resize-none rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white placeholder-neutral-600 focus:border-emerald-500 focus:outline-none"
                    />
                    <div className="mt-3 flex items-center gap-3">
                      <label className="flex items-center gap-2 text-xs text-neutral-400">
                        <input
                          type="checkbox"
                          checked={updateJobLocation}
                          onChange={(e) => setUpdateJobLocation(e.target.checked)}
                          className="rounded border-neutral-600 bg-neutral-800 text-emerald-500 focus:ring-emerald-500"
                        />
                        Update job location to worker&apos;s pin
                      </label>
                    </div>
                    <div className="mt-4 flex gap-3">
                      <button
                        onClick={() => handleResolve("APPROVED")}
                        disabled={resolving}
                        className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:opacity-50"
                      >
                        {resolving ? "Processing..." : "Approve"}
                      </button>
                      <button
                        onClick={() => handleResolve("REJECTED")}
                        disabled={resolving}
                        className="flex-1 rounded-lg bg-red-600/80 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-600 disabled:opacity-50"
                      >
                        {resolving ? "Processing..." : "Reject"}
                      </button>
                    </div>
                  </div>
                )}

                {selected.status !== "PENDING" && (
                  <div className="mt-4 rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
                    <StatusBadgeLarge status={selected.status} />
                    {selected.resolution_notes && (
                      <p className="mt-2 text-sm text-neutral-400">
                        {selected.resolution_notes}
                      </p>
                    )}
                    {selected.resolved_at && (
                      <p className="mt-1 text-xs text-neutral-600">
                        Resolved {new Date(selected.resolved_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <div className="mb-2 text-4xl opacity-20">🗺️</div>
                <p className="text-sm text-neutral-600">
                  Select an anomaly to view the forensic map
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Forensic Map ─────────────────────────────────────────────────────────────

function ForensicMap({ anomaly }: { anomaly: TimesheetAnomaly }) {
  const { isLoaded } = useMapbox();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  const jobLat = anomaly.job_location_lat;
  const jobLng = anomaly.job_location_lng;

  const workerLoc = anomaly.clock_in_location;
  const workerLat = workerLoc?.lat;
  const workerLng = workerLoc?.lng;

  useEffect(() => {
    if (!isLoaded || !containerRef.current) return;
    if (!jobLat || !jobLng) return;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    let cancelled = false;

    import("mapbox-gl").then((mod) => {
      if (cancelled || !containerRef.current) return;
      const mapboxgl = mod.default;
      mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;

      const centerLat = workerLat ? (jobLat + workerLat) / 2 : jobLat;
      const centerLng = workerLng ? (jobLng + workerLng) / 2 : jobLng;

      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: OBSIDIAN_MAP_STYLE,
        center: [centerLng, centerLat],
        zoom: workerLat ? 13 : 15,
        attributionControl: false,
      });

      applyObsidianStyle(map);
      mapRef.current = map;

      map.on("load", () => {
        // Job pin (blue)
        const jobMarker = document.createElement("div");
        jobMarker.style.cssText = `
          width: 20px; height: 20px; border-radius: 50%;
          background: #3B82F6; border: 3px solid #1E3A5F;
          box-shadow: 0 0 12px rgba(59,130,246,0.5);
        `;
        new mapboxgl.Marker({ element: jobMarker })
          .setLngLat([jobLng, jobLat])
          .setPopup(new mapboxgl.Popup({ offset: 15 }).setHTML(
            `<div style="color:#fff;font-size:12px;padding:4px"><strong>Job Site</strong><br/>${anomaly.job_location_name || ""}</div>`,
          ))
          .addTo(map);

        // 150m geofence circle
        map.addSource("geofence", {
          type: "geojson",
          data: createCircleGeoJSON(jobLng, jobLat, 150),
        });
        map.addLayer({
          id: "geofence-fill",
          type: "fill",
          source: "geofence",
          paint: {
            "fill-color": "#3B82F6",
            "fill-opacity": 0.08,
          },
        });
        map.addLayer({
          id: "geofence-border",
          type: "line",
          source: "geofence",
          paint: {
            "line-color": "#3B82F6",
            "line-width": 2,
            "line-opacity": 0.4,
            "line-dasharray": [3, 2],
          },
        });

        // Worker pin (red)
        if (workerLat && workerLng) {
          const workerMarker = document.createElement("div");
          workerMarker.style.cssText = `
            width: 20px; height: 20px; border-radius: 50%;
            background: #EF4444; border: 3px solid #5F1E1E;
            box-shadow: 0 0 12px rgba(239,68,68,0.5);
          `;
          new mapboxgl.Marker({ element: workerMarker })
            .setLngLat([workerLng, workerLat])
            .setPopup(new mapboxgl.Popup({ offset: 15 }).setHTML(
              `<div style="color:#fff;font-size:12px;padding:4px"><strong>${anomaly.worker_name}</strong><br/>Clock-in location</div>`,
            ))
            .addTo(map);

          // Line between job and worker
          map.addSource("connection-line", {
            type: "geojson",
            data: {
              type: "Feature",
              properties: {},
              geometry: {
                type: "LineString",
                coordinates: [
                  [jobLng, jobLat],
                  [workerLng, workerLat],
                ],
              },
            },
          });
          map.addLayer({
            id: "connection-line",
            type: "line",
            source: "connection-line",
            paint: {
              "line-color": "#EF4444",
              "line-width": 2,
              "line-opacity": 0.6,
              "line-dasharray": [4, 4],
            },
          });

          // Fit bounds to show both markers
          const bounds = new mapboxgl.LngLatBounds()
            .extend([jobLng, jobLat])
            .extend([workerLng, workerLat]);
          map.fitBounds(bounds, { padding: 80, maxZoom: 16 });
        }
      });
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [isLoaded, anomaly.id, jobLat, jobLng, workerLat, workerLng, anomaly.job_location_name, anomaly.worker_name]);

  if (!jobLat || !jobLng) {
    return (
      <div className="flex h-full items-center justify-center bg-neutral-900">
        <p className="text-sm text-neutral-600">No job coordinates available</p>
      </div>
    );
  }

  return (
    <>
      <div ref={containerRef} className="h-full w-full" />
      {/* Distance overlay */}
      {anomaly.recorded_distance_meters && (
        <div className="absolute left-4 top-4 rounded-lg border border-neutral-700 bg-neutral-900/90 px-3 py-2 backdrop-blur">
          <span className="text-xs text-neutral-500">Distance: </span>
          <span className="text-sm font-bold text-red-400">
            {formatDistance(anomaly.recorded_distance_meters)}
          </span>
        </div>
      )}
      {/* Legend */}
      <div className="absolute bottom-4 right-4 flex gap-3 rounded-lg border border-neutral-700 bg-neutral-900/90 px-3 py-2 backdrop-blur">
        <span className="flex items-center gap-1.5 text-xs text-neutral-400">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-500" />
          Job Site
        </span>
        <span className="flex items-center gap-1.5 text-xs text-neutral-400">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" />
          Worker
        </span>
        <span className="flex items-center gap-1.5 text-xs text-neutral-400">
          <span className="inline-block h-2.5 w-2.5 rounded-full border border-dashed border-blue-400 bg-blue-500/20" />
          150m Radius
        </span>
      </div>
    </>
  );
}

// ── Subcomponents ────────────────────────────────────────────────────────────

function AnomalyCard({
  anomaly,
  isSelected,
  onClick,
}: {
  anomaly: TimesheetAnomaly;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full border-b border-neutral-800 p-4 text-left transition ${
        isSelected
          ? "bg-neutral-800/80"
          : "hover:bg-neutral-900/50"
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">
              {anomaly.worker_name}
            </span>
            <AnomalyTypeBadge type={anomaly.anomaly_type} />
          </div>
          <p className="mt-0.5 text-xs text-neutral-500">
            {anomaly.job_title}
          </p>
        </div>
        <StatusBadge status={anomaly.status} />
      </div>
      <div className="mt-2 flex items-center gap-3 text-xs text-neutral-600">
        {anomaly.recorded_distance_meters && (
          <span className="font-mono text-red-400/80">
            {formatDistance(anomaly.recorded_distance_meters)}
          </span>
        )}
        <span>{timeAgo(anomaly.created_at)}</span>
      </div>
      {anomaly.worker_justification && (
        <p className="mt-1.5 line-clamp-2 text-xs italic text-neutral-500">
          &ldquo;{anomaly.worker_justification}&rdquo;
        </p>
      )}
    </button>
  );
}

function StatPill({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "amber" | "emerald" | "red" | "neutral";
}) {
  const colors = {
    amber: "border-amber-800/50 text-amber-400",
    emerald: "border-emerald-800/50 text-emerald-400",
    red: "border-red-800/50 text-red-400",
    neutral: "border-neutral-700 text-neutral-400",
  };
  return (
    <span className={`rounded-full border px-2.5 py-0.5 font-mono ${colors[color]}`}>
      {value}{" "}
      <span className="text-neutral-600">{label}</span>
    </span>
  );
}

function AnomalyTypeBadge({ type }: { type: string }) {
  const config: Record<string, { label: string; class: string }> = {
    GEOFENCE_BREACH: { label: "Geofence", class: "bg-red-900/50 text-red-400" },
    GPS_UNAVAILABLE: { label: "No GPS", class: "bg-amber-900/50 text-amber-400" },
    TEMPORAL_SPOOFING: { label: "Spoofing", class: "bg-purple-900/50 text-purple-400" },
    MOCK_LOCATION: { label: "Mock GPS", class: "bg-orange-900/50 text-orange-400" },
  };
  const c = config[type] || { label: type, class: "bg-neutral-800 text-neutral-400" };
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${c.class}`}>
      {c.label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, string> = {
    PENDING: "text-amber-400",
    APPROVED: "text-emerald-400",
    REJECTED: "text-red-400",
  };
  return (
    <span className={`text-[10px] font-medium uppercase tracking-wider ${config[status] || "text-neutral-500"}`}>
      {status}
    </span>
  );
}

function StatusBadgeLarge({ status }: { status: string }) {
  const config: Record<string, { label: string; class: string }> = {
    APPROVED: { label: "Approved — Released to payroll", class: "text-emerald-400 bg-emerald-900/30" },
    REJECTED: { label: "Rejected — Hours nullified", class: "text-red-400 bg-red-900/30" },
  };
  const c = config[status] || { label: status, class: "text-neutral-400 bg-neutral-800" };
  return (
    <div className={`rounded-lg px-3 py-2 text-sm font-medium ${c.class}`}>
      {c.label}
    </div>
  );
}

function InfoChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-neutral-800 px-2.5 py-1">
      <div className="text-[10px] text-neutral-500">{label}</div>
      <div className="text-xs font-medium text-neutral-300">{value}</div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${meters}m`;
}

function formatAnomalyType(type: string): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function createCircleGeoJSON(lng: number, lat: number, radiusMeters: number) {
  const points = 64;
  const coords: [number, number][] = [];
  const distanceX = radiusMeters / (111320 * Math.cos((lat * Math.PI) / 180));
  const distanceY = radiusMeters / 110540;

  for (let i = 0; i < points; i++) {
    const theta = (i / points) * (2 * Math.PI);
    const x = lng + distanceX * Math.cos(theta);
    const y = lat + distanceY * Math.sin(theta);
    coords.push([x, y]);
  }
  coords.push(coords[0]);

  return {
    type: "Feature" as const,
    properties: {},
    geometry: {
      type: "Polygon" as const,
      coordinates: [coords],
    },
  };
}

// ── Page Export ───────────────────────────────────────────────────────────────

export default function AnomalyReviewPage() {
  return (
    <MapboxProvider>
      <AnomalyDashboardInner />
    </MapboxProvider>
  );
}

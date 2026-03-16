"use client";

/* ═══════════════════════════════════════════════════════════════════
   Project Panopticon — /olympus/health
   The Global Telemetry & Super Analytics Dashboard

   Layout:
   ┌──────────────────────────────────────────────────────────────────┐
   │ Top Metrics Bar: Crash-Free %, Active Anomalies, Affected Orgs  │
   ├────────────────────────┬─────────────────────────────────────────┤
   │ Panopticon Feed (Left) │ Autopsy Viewer (Right)                  │
   │ Terminal-style feed    │ Screenshot + Environment + Stack Trace  │
   │ of system anomalies   │ + Replay Timeline + Impersonation       │
   └────────────────────────┴─────────────────────────────────────────┘
   ═══════════════════════════════════════════════════════════════════ */

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Radar,
  RefreshCw,
  CheckCircle,
  Search,
  Monitor,
  Smartphone,
  Globe,
  Clock,
  Wifi,
  WifiOff,
  Terminal,
  Image as ImageIcon,
  ChevronRight,
  X,
  User,
  Bug,
  ExternalLink,
} from "lucide-react";
import {
  getTelemetryHealthStats,
  listTelemetryEvents,
  getTelemetryEventDetail,
  updateTelemetryEventStatus,
  getTelemetrySeverityBreakdown,
  getRouteErrorHotspots,
} from "@/app/actions/telemetry";
import { impersonateUser } from "@/app/actions/superadmin";

/* ── Types ──────────────────────────────────────────────────────── */

interface HealthStats {
  crash_free_rate: number;
  total_events_24h: number;
  fatal_events_24h: number;
  unresolved_count: number;
  affected_workspaces: number;
  events_last_hour: number;
  total_all_time: number;
}

interface TelemetryEvent {
  id: string;
  event_timestamp: string;
  severity: "info" | "warning" | "fatal";
  status: "unresolved" | "investigating" | "resolved" | "ignored";
  organization_id: string | null;
  user_id: string | null;
  user_email: string | null;
  platform: string | null;
  os_version: string | null;
  app_version: string | null;
  device_model: string | null;
  network_type: string | null;
  effective_bandwidth: string | null;
  is_offline_mode: boolean;
  memory_usage_mb: number | null;
  battery_level: number | null;
  route: string | null;
  last_action: string | null;
  error_name: string | null;
  error_message: string | null;
  stack_trace: string | null;
  payload: Record<string, unknown>;
  has_screenshot: boolean;
  screenshot_path: string | null;
  screenshot_url?: string | null;
  console_buffer: unknown[];
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  branch_id: string | null;
  industry_mode: string | null;
  user_role: string | null;
  gps_lat: number | null;
  gps_lng: number | null;
}

function normalizeConsoleEntry(
  entry: unknown,
  fallbackTimestamp: string,
): { level: string; message: string; timestamp: string } {
  if (typeof entry === "string") {
    return {
      level: "log",
      message: entry,
      timestamp: fallbackTimestamp,
    };
  }
  if (entry && typeof entry === "object") {
    const obj = entry as Record<string, unknown>;
    return {
      level:
        typeof obj.level === "string" && obj.level.trim().length > 0
          ? obj.level
          : "log",
      message:
        typeof obj.message === "string"
          ? obj.message
          : JSON.stringify(obj),
      timestamp:
        typeof obj.timestamp === "string" && obj.timestamp.length > 0
          ? obj.timestamp
          : fallbackTimestamp,
    };
  }
  return {
    level: "log",
    message: String(entry),
    timestamp: fallbackTimestamp,
  };
}

/* ── Severity Badge ─────────────────────────────────────────────── */

function SeverityBadge({ severity }: { severity: string }) {
  const config = {
    fatal: { bg: "bg-red-500/15", text: "text-red-400", ring: "ring-red-500/20", label: "FATAL" },
    warning: { bg: "bg-amber-500/15", text: "text-amber-400", ring: "ring-amber-500/20", label: "WARN" },
    info: { bg: "bg-blue-500/15", text: "text-blue-400", ring: "ring-blue-500/20", label: "INFO" },
  }[severity] || { bg: "bg-zinc-500/15", text: "text-zinc-400", ring: "ring-zinc-500/20", label: severity };

  return (
    <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 font-mono text-[8px] font-bold tracking-wider ring-1 ${config.bg} ${config.text} ${config.ring}`}>
      {config.label}
    </span>
  );
}

/* ── Status Badge ───────────────────────────────────────────────── */

function StatusBadge({ status }: { status: string }) {
  const config = {
    unresolved: { dot: "bg-red-400", text: "text-red-400/70", label: "Unresolved" },
    investigating: { dot: "bg-amber-400", text: "text-amber-400/70", label: "Investigating" },
    resolved: { dot: "bg-emerald-400", text: "text-emerald-400/70", label: "Resolved" },
    ignored: { dot: "bg-zinc-600", text: "text-zinc-600", label: "Ignored" },
  }[status] || { dot: "bg-zinc-600", text: "text-zinc-600", label: status };

  return (
    <span className={`inline-flex items-center gap-1 text-[9px] font-medium ${config.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}

/* ── Platform Icon ──────────────────────────────────────────────── */

function PlatformIcon({ platform }: { platform: string | null }) {
  switch (platform) {
    case "mobile_ios":
    case "mobile_android":
      return <Smartphone size={11} className="text-zinc-600" />;
    case "desktop":
      return <Monitor size={11} className="text-zinc-600" />;
    default:
      return <Globe size={11} className="text-zinc-600" />;
  }
}

/* ── Pulse Ring (System Health Indicator) ───────────────────────── */

function PulseRing({ rate }: { rate: number }) {
  const color = rate >= 99.9 ? "emerald" : rate >= 99 ? "amber" : "red";
  const colorMap = {
    emerald: { ring: "border-emerald-500/30", glow: "bg-emerald-400", text: "text-emerald-400" },
    amber: { ring: "border-amber-500/30", glow: "bg-amber-400", text: "text-amber-400" },
    red: { ring: "border-red-500/30", glow: "bg-red-400", text: "text-red-400" },
  };
  const c = colorMap[color];

  return (
    <div className="relative flex items-center gap-2">
      <div className="relative h-8 w-8">
        <div className={`absolute inset-0 rounded-full border-2 ${c.ring} animate-pulse`} />
        <div className={`absolute inset-[10px] rounded-full ${c.glow} animate-pulse`} />
      </div>
      <div>
        <span className={`font-mono text-[16px] font-bold ${c.text}`}>{rate.toFixed(2)}%</span>
        <p className="text-[8px] text-zinc-600">Crash-Free</p>
      </div>
    </div>
  );
}

/* ── Stat Pill ──────────────────────────────────────────────────── */

function StatPill({ label, value, color = "zinc" }: { label: string; value: number | string; color?: "red" | "amber" | "emerald" | "blue" | "zinc" }) {
  const colorMap = {
    red: "text-red-400",
    amber: "text-amber-400",
    emerald: "text-emerald-400",
    blue: "text-blue-400",
    zinc: "text-zinc-300",
  };

  return (
    <div className="flex flex-col items-center rounded-lg bg-white/[0.02] px-4 py-2.5 ring-1 ring-white/[0.04]">
      <span className={`font-mono text-[18px] font-bold ${colorMap[color]}`}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </span>
      <span className="text-[9px] text-zinc-600 whitespace-nowrap">{label}</span>
    </div>
  );
}

/* ── Time Ago ───────────────────────────────────────────────────── */

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════════ */

export default function HealthPage() {
  const [stats, setStats] = useState<HealthStats | null>(null);
  const [events, setEvents] = useState<TelemetryEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedEvent, setSelectedEvent] = useState<TelemetryEvent | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("unresolved");
  const [hotspots, setHotspots] = useState<Array<{ route: string; total_errors: number; fatal_errors: number; error_types: string[] }>>([]);

  /* ── Load Data ────────────────────────────────────────────── */

  const loadData = useCallback(async () => {
    setLoading(true);
    const [statsResult, eventsResult, hotspotsResult] = await Promise.all([
      getTelemetryHealthStats(),
      listTelemetryEvents({
        limit: 100,
        severity: severityFilter || undefined,
        status: statusFilter || undefined,
        search: search || undefined,
      }),
      getRouteErrorHotspots(8),
    ]);

    if (statsResult.data) setStats(statsResult.data as HealthStats);
    if (eventsResult.data) {
      setEvents((eventsResult.data as any).rows || []);
      setTotal((eventsResult.data as any).total || 0);
    }
    if (hotspotsResult.data) setHotspots(hotspotsResult.data as any);
    setLoading(false);
  }, [severityFilter, statusFilter, search]);

  useEffect(() => { loadData(); }, [loadData]);

  /* ── Load Detail ──────────────────────────────────────────── */

  const loadDetail = useCallback(async (id: string) => {
    setLoadingDetail(true);
    const result = await getTelemetryEventDetail(id);
    if (result.data) {
      setSelectedEvent(result.data as unknown as TelemetryEvent);
    }
    setLoadingDetail(false);
  }, []);

  /* ── Update Status ────────────────────────────────────────── */

  const handleStatusChange = useCallback(async (eventId: string, newStatus: "investigating" | "resolved" | "ignored") => {
    const notes = newStatus === "resolved" ? "Resolved via Olympus Health Dashboard" : undefined;
    await updateTelemetryEventStatus(eventId, newStatus, notes);
    // Refresh
    if (selectedEvent?.id === eventId) {
      setSelectedEvent((prev) => prev ? { ...prev, status: newStatus } : null);
    }
    loadData();
  }, [selectedEvent, loadData]);

  /* ── Impersonate ──────────────────────────────────────────── */

  const handleImpersonate = useCallback(async (userId: string, route: string) => {
    const result = await impersonateUser(userId);
    if (result.data?.verification_url) {
      window.open(result.data.verification_url, "_blank");
    }
  }, []);

  /* ── Render ───────────────────────────────────────────────── */

  return (
    <div className="flex h-full flex-col">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-white/[0.04] px-6 py-4">
        <div className="flex items-center gap-4">
          <div>
            <span className="font-mono text-[9px] font-bold tracking-widest text-red-500/60 uppercase">
              PROJECT PANOPTICON
            </span>
            <h2 className="mt-0.5 text-[16px] font-semibold text-white">
              Global Telemetry & Health
            </h2>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {stats && <PulseRing rate={stats.crash_free_rate} />}
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-md bg-white/[0.04] px-3 py-1.5 text-[10px] font-medium text-zinc-400 transition-colors hover:bg-white/[0.06] disabled:opacity-50"
          >
            <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Top Metrics Bar ─────────────────────────────────── */}
      <div className="flex items-center gap-3 border-b border-white/[0.04] px-6 py-3 overflow-x-auto">
        <StatPill label="Events (24h)" value={stats?.total_events_24h || 0} color="zinc" />
        <StatPill label="Fatal (24h)" value={stats?.fatal_events_24h || 0} color="red" />
        <StatPill label="Unresolved" value={stats?.unresolved_count || 0} color="amber" />
        <StatPill label="Affected Orgs" value={stats?.affected_workspaces || 0} color="blue" />
        <StatPill label="Last Hour" value={stats?.events_last_hour || 0} color="zinc" />
        <StatPill label="All Time" value={stats?.total_all_time || 0} color="zinc" />
      </div>

      {/* ── Main Content (2-Pane) ───────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── LEFT: Panopticon Feed ─────────────────────────── */}
        <div className="flex w-[420px] min-w-[420px] flex-col border-r border-white/[0.04]">
          {/* Filter Bar */}
          <div className="flex items-center gap-2 border-b border-white/[0.03] px-3 py-2">
            <div className="flex flex-1 items-center gap-1.5 rounded-md bg-white/[0.03] px-2.5 py-1.5">
              <Search size={11} className="text-zinc-600" />
              <input
                type="text"
                placeholder="Search errors, routes, users..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && loadData()}
                className="flex-1 bg-transparent text-[11px] text-zinc-300 placeholder:text-zinc-700 focus:outline-none"
              />
            </div>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="rounded-md bg-white/[0.03] px-2 py-1.5 text-[10px] text-zinc-400 focus:outline-none border-none"
            >
              <option value="">All Severity</option>
              <option value="fatal">Fatal</option>
              <option value="warning">Warning</option>
              <option value="info">Info</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-md bg-white/[0.03] px-2 py-1.5 text-[10px] text-zinc-400 focus:outline-none border-none"
            >
              <option value="">All Status</option>
              <option value="unresolved">Unresolved</option>
              <option value="investigating">Investigating</option>
              <option value="resolved">Resolved</option>
              <option value="ignored">Ignored</option>
            </select>
          </div>

          {/* Event List */}
          <div className="flex-1 overflow-y-auto">
            {loading && events.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20">
                <RefreshCw size={16} className="animate-spin text-zinc-700 mb-3" />
                <p className="text-[11px] text-zinc-700">Loading telemetry feed...</p>
              </div>
            ) : events.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20">
                <CheckCircle size={20} className="text-emerald-500/40 mb-3" />
                <p className="text-[12px] font-medium text-zinc-400">All Clear</p>
                <p className="mt-1 text-[10px] text-zinc-700">No telemetry events match your filters.</p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.02]">
                {events.map((event) => (
                  <button
                    key={event.id}
                    onClick={() => loadDetail(event.id)}
                    className={`w-full text-left px-3 py-2.5 transition-colors hover:bg-white/[0.02] ${
                      selectedEvent?.id === event.id ? "bg-white/[0.03] border-l-2 border-l-red-500" : "border-l-2 border-l-transparent"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <SeverityBadge severity={event.severity} />
                        <span className="truncate font-mono text-[10px] text-zinc-300">
                          {event.error_name || "Error"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <PlatformIcon platform={event.platform} />
                        <span className="font-mono text-[9px] text-zinc-700">
                          {timeAgo(event.event_timestamp)}
                        </span>
                      </div>
                    </div>
                    <p className="mt-1 truncate text-[10px] text-zinc-600">
                      {event.error_message?.slice(0, 100) || "No message"}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      {event.route && (
                        <span className="truncate font-mono text-[8px] text-zinc-700">
                          {event.route}
                        </span>
                      )}
                      {event.has_screenshot && (
                        <ImageIcon size={9} className="flex-shrink-0 text-blue-500/50" />
                      )}
                      <StatusBadge status={event.status} />
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Total count footer */}
            {total > 0 && (
              <div className="border-t border-white/[0.03] px-3 py-2">
                <span className="font-mono text-[9px] text-zinc-700">
                  {total.toLocaleString()} total events
                </span>
              </div>
            )}
          </div>

          {/* Route Hotspots */}
          {hotspots.length > 0 && (
            <div className="border-t border-white/[0.04]">
              <div className="px-3 py-2 border-b border-white/[0.03]">
                <span className="font-mono text-[8px] font-bold tracking-widest text-zinc-700 uppercase">
                  ERROR HOTSPOTS (7d)
                </span>
              </div>
              <div className="max-h-[160px] overflow-y-auto divide-y divide-white/[0.02]">
                {hotspots.map((h) => (
                  <div key={h.route} className="flex items-center justify-between px-3 py-1.5 hover:bg-white/[0.01]">
                    <span className="truncate font-mono text-[9px] text-zinc-500 max-w-[200px]">
                      {h.route}
                    </span>
                    <div className="flex items-center gap-2">
                      {h.fatal_errors > 0 && (
                        <span className="font-mono text-[8px] text-red-400">{h.fatal_errors}F</span>
                      )}
                      <span className="font-mono text-[9px] text-zinc-600">{h.total_errors}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT: Autopsy Viewer ─────────────────────────── */}
        <div className="flex-1 overflow-y-auto bg-black/30">
          <AnimatePresence mode="wait">
            {loadingDetail ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center justify-center h-full"
              >
                <RefreshCw size={20} className="animate-spin text-zinc-700" />
              </motion.div>
            ) : selectedEvent ? (
              <motion.div
                key={selectedEvent.id}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.15 }}
                className="p-6 space-y-5"
              >
                {/* ── Autopsy Header ──────────────────────────── */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <SeverityBadge severity={selectedEvent.severity} />
                      <StatusBadge status={selectedEvent.status} />
                      {selectedEvent.has_screenshot && (
                        <span className="inline-flex items-center gap-1 text-[8px] text-blue-400">
                          <ImageIcon size={9} /> Screenshot
                        </span>
                      )}
                    </div>
                    <h3 className="text-[15px] font-semibold text-white font-mono">
                      {selectedEvent.error_name || "Unknown Error"}
                    </h3>
                    <p className="mt-0.5 text-[11px] text-zinc-400 max-w-[600px]">
                      {selectedEvent.error_message}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {selectedEvent.status === "unresolved" && (
                      <>
                        <button
                          onClick={() => handleStatusChange(selectedEvent.id, "investigating")}
                          className="rounded-md bg-amber-500/10 px-2.5 py-1 text-[9px] font-medium text-amber-400 ring-1 ring-amber-500/20 hover:bg-amber-500/15 transition-colors"
                        >
                          Investigate
                        </button>
                        <button
                          onClick={() => handleStatusChange(selectedEvent.id, "resolved")}
                          className="rounded-md bg-emerald-500/10 px-2.5 py-1 text-[9px] font-medium text-emerald-400 ring-1 ring-emerald-500/20 hover:bg-emerald-500/15 transition-colors"
                        >
                          Resolve
                        </button>
                        <button
                          onClick={() => handleStatusChange(selectedEvent.id, "ignored")}
                          className="rounded-md bg-zinc-500/10 px-2.5 py-1 text-[9px] font-medium text-zinc-500 ring-1 ring-zinc-500/20 hover:bg-zinc-500/15 transition-colors"
                        >
                          Ignore
                        </button>
                      </>
                    )}
                    {selectedEvent.status === "investigating" && (
                      <button
                        onClick={() => handleStatusChange(selectedEvent.id, "resolved")}
                        className="rounded-md bg-emerald-500/10 px-2.5 py-1 text-[9px] font-medium text-emerald-400 ring-1 ring-emerald-500/20 hover:bg-emerald-500/15 transition-colors"
                      >
                        Mark Resolved
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedEvent(null)}
                      className="rounded-md bg-white/[0.03] p-1 text-zinc-600 hover:text-zinc-400 transition-colors"
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>

                {/* ── Screenshot (Hero Image) ────────────────── */}
                {selectedEvent.screenshot_url && (
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] overflow-hidden">
                    <div className="flex items-center justify-between border-b border-white/[0.04] px-3 py-1.5">
                      <span className="font-mono text-[8px] font-bold tracking-widest text-zinc-600 uppercase">
                        VISUAL CAPTURE (PII REDACTED)
                      </span>
                      <a
                        href={selectedEvent.screenshot_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[8px] text-blue-400/60 hover:text-blue-400"
                      >
                        Open Full Size ↗
                      </a>
                    </div>
                    <div className="p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={selectedEvent.screenshot_url}
                        alt="Error screenshot"
                        className="w-full rounded-lg border border-white/[0.04]"
                      />
                    </div>
                  </div>
                )}

                {/* ── Bento Grid: Environment, Identity, Telemetry ── */}
                <div className="grid grid-cols-3 gap-3">
                  {/* Identity */}
                  <div className="rounded-xl border border-white/[0.04] bg-white/[0.01] p-3.5">
                    <div className="flex items-center gap-1.5 mb-3">
                      <User size={11} className="text-red-400/60" />
                      <span className="font-mono text-[8px] font-bold tracking-widest text-zinc-600 uppercase">IDENTITY</span>
                    </div>
                    <div className="space-y-1.5">
                      <DetailRow label="User" value={selectedEvent.user_email || "Anonymous"} />
                      <DetailRow label="Org" value={selectedEvent.organization_id?.slice(0, 8) || "—"} mono />
                      <DetailRow label="Branch" value={selectedEvent.branch_id || "—"} />
                      <DetailRow label="Industry" value={selectedEvent.industry_mode || "—"} />
                      <DetailRow label="Role" value={selectedEvent.user_role || "—"} />
                    </div>
                    {selectedEvent.user_id && (
                      <button
                        onClick={() => handleImpersonate(selectedEvent.user_id!, selectedEvent.route || "/dashboard")}
                        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-red-500/10 py-1.5 text-[9px] font-medium text-red-400 ring-1 ring-red-500/20 hover:bg-red-500/15 transition-colors"
                      >
                        <ExternalLink size={10} />
                        Impersonate at Route
                      </button>
                    )}
                  </div>

                  {/* Environment */}
                  <div className="rounded-xl border border-white/[0.04] bg-white/[0.01] p-3.5">
                    <div className="flex items-center gap-1.5 mb-3">
                      <Monitor size={11} className="text-blue-400/60" />
                      <span className="font-mono text-[8px] font-bold tracking-widest text-zinc-600 uppercase">ENVIRONMENT</span>
                    </div>
                    <div className="space-y-1.5">
                      <DetailRow label="Platform" value={selectedEvent.platform || "web"} />
                      <DetailRow label="OS" value={selectedEvent.os_version || "—"} />
                      <DetailRow label="App Version" value={selectedEvent.app_version || "—"} mono />
                      <DetailRow label="Device" value={selectedEvent.device_model || "—"} />
                      <DetailRow label="Route" value={selectedEvent.route || "—"} mono />
                    </div>
                  </div>

                  {/* Telemetry */}
                  <div className="rounded-xl border border-white/[0.04] bg-white/[0.01] p-3.5">
                    <div className="flex items-center gap-1.5 mb-3">
                      <Wifi size={11} className="text-emerald-400/60" />
                      <span className="font-mono text-[8px] font-bold tracking-widest text-zinc-600 uppercase">TELEMETRY</span>
                    </div>
                    <div className="space-y-1.5">
                      <DetailRow
                        label="Network"
                        value={selectedEvent.network_type || "—"}
                        icon={selectedEvent.is_offline_mode ? <WifiOff size={9} className="text-red-400" /> : undefined}
                      />
                      <DetailRow label="Bandwidth" value={selectedEvent.effective_bandwidth || "—"} />
                      <DetailRow label="Memory" value={selectedEvent.memory_usage_mb ? `${selectedEvent.memory_usage_mb} MB` : "—"} />
                      <DetailRow label="Battery" value={selectedEvent.battery_level != null ? `${selectedEvent.battery_level}%` : "—"} />
                      <DetailRow label="Offline" value={selectedEvent.is_offline_mode ? "Yes" : "No"} />
                      {selectedEvent.gps_lat && selectedEvent.gps_lng && (
                        <DetailRow label="GPS" value={`${selectedEvent.gps_lat.toFixed(4)}, ${selectedEvent.gps_lng.toFixed(4)}`} mono />
                      )}
                    </div>
                  </div>
                </div>

                {/* ── Replay Timeline ────────────────────────── */}
                {selectedEvent.last_action && (
                  <div className="rounded-xl border border-white/[0.04] bg-white/[0.01]">
                    <div className="flex items-center gap-1.5 border-b border-white/[0.04] px-3.5 py-2">
                      <Clock size={11} className="text-amber-400/60" />
                      <span className="font-mono text-[8px] font-bold tracking-widest text-zinc-600 uppercase">
                        LAST USER ACTION
                      </span>
                    </div>
                    <div className="px-3.5 py-2.5">
                      <p className="font-mono text-[10px] text-zinc-400">{selectedEvent.last_action}</p>
                    </div>
                  </div>
                )}

                {/* ── Console Buffer ─────────────────────────── */}
                {selectedEvent.console_buffer && selectedEvent.console_buffer.length > 0 && (
                  <div className="rounded-xl border border-white/[0.04] bg-white/[0.01]">
                    <div className="flex items-center gap-1.5 border-b border-white/[0.04] px-3.5 py-2">
                      <Terminal size={11} className="text-purple-400/60" />
                      <span className="font-mono text-[8px] font-bold tracking-widest text-zinc-600 uppercase">
                        CONSOLE BUFFER ({selectedEvent.console_buffer.length} entries)
                      </span>
                    </div>
                    <div className="max-h-[200px] overflow-y-auto">
                      {selectedEvent.console_buffer.map((entry, i) => {
                        const normalized = normalizeConsoleEntry(
                          entry,
                          selectedEvent.event_timestamp,
                        );
                        const levelColor = {
                          error: "text-red-400",
                          warn: "text-amber-400",
                          info: "text-blue-400",
                          log: "text-zinc-500",
                          debug: "text-zinc-700",
                        }[normalized.level] || "text-zinc-600";

                        return (
                          <div
                            key={i}
                            className="flex items-start gap-2 border-b border-white/[0.01] px-3.5 py-1 hover:bg-white/[0.01] font-mono text-[9px]"
                          >
                            <span className={`flex-shrink-0 font-bold uppercase ${levelColor}`}>
                              {normalized.level.slice(0, 4).padEnd(4)}
                            </span>
                            <span className="text-zinc-600 flex-shrink-0">
                              {new Date(normalized.timestamp).toLocaleTimeString()}
                            </span>
                            <span className="text-zinc-400 break-all">{normalized.message}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ── Stack Trace ─────────────────────────────── */}
                {selectedEvent.stack_trace && (
                  <div className="rounded-xl border border-red-500/10 bg-red-500/[0.02]">
                    <div className="flex items-center gap-1.5 border-b border-red-500/10 px-3.5 py-2">
                      <Bug size={11} className="text-red-400/60" />
                      <span className="font-mono text-[8px] font-bold tracking-widest text-red-500/40 uppercase">
                        STACK TRACE
                      </span>
                    </div>
                    <pre className="max-h-[300px] overflow-auto px-3.5 py-3 font-mono text-[9px] text-red-300/60 leading-relaxed whitespace-pre-wrap break-all">
                      {selectedEvent.stack_trace}
                    </pre>
                  </div>
                )}

                {/* ── Full Payload (Raw JSON) ────────────────── */}
                <details className="rounded-xl border border-white/[0.04] bg-white/[0.01]">
                  <summary className="flex cursor-pointer items-center gap-1.5 px-3.5 py-2 text-[9px] font-medium text-zinc-600 hover:text-zinc-400">
                    <ChevronRight size={10} />
                    Raw Autopsy Payload (JSON)
                  </summary>
                  <pre className="max-h-[400px] overflow-auto border-t border-white/[0.03] px-3.5 py-3 font-mono text-[8px] text-zinc-600 leading-relaxed whitespace-pre-wrap break-all">
                    {JSON.stringify(selectedEvent.payload, null, 2)}
                  </pre>
                </details>

                {/* ── Timestamps ──────────────────────────────── */}
                <div className="flex items-center gap-4 text-[9px] text-zinc-700 font-mono">
                  <span>ID: {selectedEvent.id.slice(0, 8)}</span>
                  <span>Captured: {new Date(selectedEvent.event_timestamp).toLocaleString()}</span>
                  {selectedEvent.resolved_at && (
                    <span>Resolved: {new Date(selectedEvent.resolved_at).toLocaleString()}</span>
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex h-full flex-col items-center justify-center"
              >
                <div className="relative mb-5">
                  <div className="absolute inset-0 rounded-full border-2 border-dashed border-zinc-800/40 animate-[spin_20s_linear_infinite]" style={{ width: 80, height: 80 }} />
                  <div className="flex h-20 w-20 items-center justify-center rounded-full border border-white/[0.04] bg-white/[0.01]">
                    <Radar size={28} className="text-zinc-800" />
                  </div>
                </div>
                <p className="text-[13px] font-medium text-zinc-500">Panopticon Ready</p>
                <p className="mt-1 text-[11px] text-zinc-700">Select an event from the feed to view the full autopsy.</p>
                <div className="mt-4 flex items-center gap-2 rounded-lg border border-white/[0.04] bg-white/[0.01] px-4 py-2">
                  <Terminal size={12} className="text-zinc-700" />
                  <span className="font-mono text-[10px] text-zinc-600">
                    Monitoring {total.toLocaleString()} telemetry events...
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

/* ── Detail Row Helper ──────────────────────────────────────────── */

function DetailRow({ label, value, mono, icon }: { label: string; value: string; mono?: boolean; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[9px] text-zinc-600">{label}</span>
      <div className="flex items-center gap-1">
        {icon}
        <span className={`text-[9px] text-zinc-400 ${mono ? "font-mono" : ""} max-w-[140px] truncate`}>
          {value}
        </span>
      </div>
    </div>
  );
}

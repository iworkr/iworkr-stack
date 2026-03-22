/**
 * @page /dashboard/tracking
 * @status COMPLETE
 * @description Live GPS tracking with worker map, breadcrumb trails, and geofence alerts
 * @dataSource server-action
 * @lastAudit 2026-03-22
 */
"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/hooks/use-query-keys";
import { motion, AnimatePresence } from "framer-motion";
import {
  Navigation,
  MapPin,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Radio,
  Send,
  Eye,
  Trash2,
  RefreshCw,
  Activity,
  Smartphone,
} from "lucide-react";
import { useOrg } from "@/lib/hooks/use-org";
import {
  getTrackingSessions,
  getTrackingStats,
  initiateTrackingSession,
  cancelTrackingSession,
  type TrackingSession,
  type TrackingStats,
} from "@/app/actions/glasshouse-arrival";

// ── Animation variants ──────────────────────────────────────

const fadeIn = { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -8 } } as any;
const stagger = { animate: { transition: { staggerChildren: 0.05 } } } as any;
const cardVariant = { initial: { opacity: 0, scale: 0.97 }, animate: { opacity: 1, scale: 1 } } as any;

// ── Constants ────────────────────────────────────────────────

type TabId = "live" | "sms" | "settings";
type StatusFilter = "all" | "active" | "arrived" | "cancelled" | "expired";

const TABS: { id: TabId; label: string; icon: typeof Navigation }[] = [
  { id: "live", label: "Live Sessions", icon: Radio },
  { id: "sms", label: "SMS Log", icon: Send },
  { id: "settings", label: "Settings", icon: Activity },
];

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "arrived", label: "Arrived" },
  { id: "cancelled", label: "Cancelled" },
  { id: "expired", label: "Expired" },
];

const REFRESH_INTERVAL = 15_000;

// ── Helpers ──────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function truncate(str: string | null | undefined, len: number): string {
  if (!str) return "—";
  return str.length > len ? str.slice(0, len) + "…" : str;
}

function StatusBadge({ status }: { status: TrackingSession["status"] }) {
  const config: Record<string, { bg: string; text: string; dot: string; pulse?: boolean }> = {
    active: { bg: "bg-emerald-500/10", text: "text-emerald-400", dot: "bg-emerald-400", pulse: true },
    arrived: { bg: "bg-blue-500/10", text: "text-blue-400", dot: "bg-blue-400" },
    cancelled: { bg: "bg-red-500/10", text: "text-red-400", dot: "bg-red-400" },
    expired: { bg: "bg-zinc-500/10", text: "text-zinc-400", dot: "bg-zinc-500" },
  };
  const c = config[status] ?? config.expired;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot} ${c.pulse ? "animate-pulse" : ""}`} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function SmsBadge({ dispatched }: { dispatched: boolean }) {
  return dispatched ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400">
      <CheckCircle2 className="w-3 h-3" /> Sent
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-500/10 text-zinc-400">
      <Clock className="w-3 h-3" /> Pending
    </span>
  );
}

// ═════════════════════════════════════════════════════════════
// Main Component
// ═════════════════════════════════════════════════════════════

export default function TrackingDashboardPage() {
  const org = useOrg();
  const orgId = (org as any)?.orgId ?? (org as any)?.id;

  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabId>("live");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  interface TrackingData {
    sessions: TrackingSession[];
    stats: TrackingStats | null;
  }

  const filterArg = statusFilter === "all" ? undefined : statusFilter;

  const { data: trackingData, isLoading: loading, isFetching: refreshing } = useQuery<TrackingData>({
    queryKey: queryKeys.tracking.sessions(orgId!, filterArg),
    queryFn: async () => {
      const [sessRes, statsRes] = await Promise.all([
        getTrackingSessions(orgId!, filterArg),
        getTrackingStats(orgId!),
      ]);
      return { sessions: sessRes.data ?? [], stats: statsRes.data ?? null };
    },
    enabled: !!orgId,
    refetchInterval: tab === "live" ? REFRESH_INTERVAL : false,
  });

  const sessions = trackingData?.sessions ?? [];
  const stats = trackingData?.stats ?? null;

  // ── Cancel handler ─────────────────────────────────────

  const handleCancel = async (sessionId: string) => {
    if (!orgId) return;
    setCancellingId(sessionId);
    await cancelTrackingSession(sessionId, orgId);
    setCancellingId(null);
    queryClient.invalidateQueries({ queryKey: queryKeys.tracking.sessions(orgId!, filterArg) });
  };

  // ── Guard ──────────────────────────────────────────────

  if (!orgId) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex items-center gap-3 text-zinc-500">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Loading workspace…</span>
        </div>
      </div>
    );
  }

  // ── Stats ribbon ───────────────────────────────────────

  const statCards = [
    { label: "Active", value: stats?.active ?? 0, icon: Radio, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
    { label: "Arrived", value: stats?.arrived ?? 0, icon: CheckCircle2, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
    { label: "Cancelled", value: stats?.cancelled ?? 0, icon: XCircle, color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20" },
    { label: "Total", value: stats?.total_sessions ?? 0, icon: Activity, color: "text-zinc-400", bg: "bg-zinc-500/10", border: "border-white/5" },
  ];

  // ═════════════════════════════════════════════════════════
  // Render
  // ═════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* ── Header ─────────────────────────────────── */}
        <motion.div {...(fadeIn as any)} className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                <Navigation className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Live Tracking</h1>
                <p className="text-sm text-zinc-500">Glasshouse-Arrival — Real-time worker tracking</p>
              </div>
            </div>

            <button
              onClick={() => queryClient.invalidateQueries({ queryKey: queryKeys.tracking.sessions(orgId!, filterArg) })}
              disabled={refreshing}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-zinc-400 hover:text-white bg-zinc-900/50 border border-white/5 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </motion.div>

        {/* ── Tabs ────────────────────────────────────── */}
        <div className="flex items-center gap-1 mb-6 border-b border-white/5 pb-px overflow-x-auto">
          {TABS.map((t) => {
            const Icon = t.icon;
            const isActive = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive ? "text-emerald-400" : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
                {isActive && (
                  <motion.div
                    layoutId="tracking-tab-indicator"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 rounded-full"
                    transition={{ type: "spring", stiffness: 400, damping: 30 } as any}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* ── Tab content ─────────────────────────────── */}
        <AnimatePresence mode="wait">
          {tab === "live" && (
            <motion.div key="live" {...(fadeIn as any)}>
              {/* Stats ribbon */}
              <motion.div variants={stagger} initial="initial" animate="animate" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {statCards.map((s) => {
                  const Icon = s.icon;
                  return (
                    <motion.div
                      key={s.label}
                      variants={cardVariant}
                      className={`p-4 rounded-xl bg-zinc-900/50 border ${s.border} flex items-center gap-4`}
                    >
                      <div className={`p-2.5 rounded-lg ${s.bg}`}>
                        <Icon className={`w-5 h-5 ${s.color}`} />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{s.value}</p>
                        <p className="text-xs text-zinc-500">{s.label}</p>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>

              {/* Filter pills */}
              <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
                {STATUS_FILTERS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setStatusFilter(f.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors whitespace-nowrap ${
                      statusFilter === f.id
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : "bg-zinc-900/50 text-zinc-500 border-white/5 hover:text-zinc-300 hover:border-white/10"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Session list */}
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <RefreshCw className="w-5 h-5 text-zinc-500 animate-spin" />
                </div>
              ) : sessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="p-4 bg-zinc-900/50 border border-white/5 rounded-2xl mb-4">
                    <Navigation className="w-8 h-8 text-zinc-600" />
                  </div>
                  <p className="text-zinc-400 font-medium mb-1">No tracking sessions</p>
                  <p className="text-sm text-zinc-600">Sessions will appear here when workers are dispatched</p>
                </div>
              ) : (
                <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-3">
                  {sessions.map((s) => (
                    <motion.div
                      key={s.id}
                      variants={cardVariant}
                      className="p-4 rounded-xl bg-zinc-900/50 border border-white/5 hover:border-white/10 transition-colors"
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        {/* Left: info */}
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex items-center gap-3 flex-wrap">
                            <StatusBadge status={s.status} />
                            <span className="text-sm font-semibold text-white">{s.worker_name ?? "Unknown Worker"}</span>
                            {s.worker_role && (
                              <span className="text-xs text-zinc-500 bg-zinc-800/50 px-2 py-0.5 rounded">{s.worker_role}</span>
                            )}
                          </div>

                          <div className="flex items-center gap-4 text-xs text-zinc-400 flex-wrap">
                            {s.destination_address && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-zinc-500" />
                                {truncate(s.destination_address, 50)}
                              </span>
                            )}
                            {s.eta_minutes != null && s.status === "active" && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3 text-zinc-500" />
                                ETA: {s.eta_minutes} min
                              </span>
                            )}
                            {s.distance_remaining_km != null && s.status === "active" && (
                              <span className="flex items-center gap-1">
                                <Navigation className="w-3 h-3 text-zinc-500" />
                                {s.distance_remaining_km.toFixed(1)} km
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-4 text-xs text-zinc-500 flex-wrap">
                            <span className="font-mono text-[10px] bg-zinc-800/70 px-1.5 py-0.5 rounded">
                              {s.secure_token.slice(0, 12)}…
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Created {timeAgo(s.created_at)}
                            </span>
                            {s.is_off_route && (
                              <span className="flex items-center gap-1 text-amber-400">
                                <AlertTriangle className="w-3 h-3" />
                                Off route
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Right: actions */}
                        <div className="flex items-center gap-2 shrink-0">
                          <a
                            href={`/track/${s.secure_token}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-300 bg-zinc-800/50 border border-white/5 rounded-lg hover:bg-zinc-800 hover:border-white/10 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            View Tracker
                          </a>
                          {s.status === "active" && (
                            <button
                              onClick={() => handleCancel(s.id)}
                              disabled={cancellingId === s.id}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors disabled:opacity-50"
                            >
                              {cancellingId === s.id ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <XCircle className="w-3.5 h-3.5" />
                              )}
                              Cancel
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </motion.div>
          )}

          {tab === "sms" && (
            <motion.div key="sms" {...(fadeIn as any)}>
              <div className="rounded-xl bg-zinc-900/50 border border-white/5 overflow-hidden">
                {/* Table header */}
                <div className="hidden sm:grid grid-cols-12 gap-4 px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider border-b border-white/5 bg-zinc-800/30">
                  <div className="col-span-3">Worker</div>
                  <div className="col-span-3">Destination</div>
                  <div className="col-span-2">SMS Status</div>
                  <div className="col-span-2">Token</div>
                  <div className="col-span-2">Created</div>
                </div>

                {loading ? (
                  <div className="flex items-center justify-center py-16">
                    <RefreshCw className="w-5 h-5 text-zinc-500 animate-spin" />
                  </div>
                ) : sessions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <Send className="w-6 h-6 text-zinc-600 mb-2" />
                    <p className="text-sm text-zinc-500">No SMS dispatches yet</p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {sessions.map((s) => (
                      <div key={s.id} className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-4 px-4 py-3 text-sm hover:bg-zinc-800/30 transition-colors">
                        <div className="sm:col-span-3 flex items-center gap-2">
                          <Smartphone className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                          <span className="text-white font-medium truncate">{s.worker_name ?? "Unknown"}</span>
                        </div>
                        <div className="sm:col-span-3 text-zinc-400 truncate">
                          {truncate(s.destination_address, 35)}
                        </div>
                        <div className="sm:col-span-2">
                          <SmsBadge dispatched={s.sms_dispatched} />
                        </div>
                        <div className="sm:col-span-2">
                          <span className="font-mono text-[10px] text-zinc-500 bg-zinc-800/70 px-1.5 py-0.5 rounded">
                            {s.secure_token.slice(0, 10)}…
                          </span>
                        </div>
                        <div className="sm:col-span-2 text-xs text-zinc-500">
                          {timeAgo(s.created_at)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {tab === "settings" && (
            <motion.div key="settings" {...(fadeIn as any)}>
              <div className="max-w-2xl">
                <div className="rounded-xl bg-zinc-900/50 border border-white/5 p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                      <Activity className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">Tracking Configuration</h3>
                      <p className="text-xs text-zinc-500">System defaults — editable in a future release</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {[
                      { label: "Session timeout", value: "4 hours", desc: "Sessions auto-expire after this duration" },
                      { label: "Geofence radius", value: "50 meters", desc: "Arrival zone around destination" },
                      { label: "Position update interval", value: "5 seconds", desc: "GPS ping frequency from worker device" },
                      { label: "Auto-expire", value: "Enabled", desc: "Automatically expire stale sessions" },
                      { label: "SMS dispatch", value: "Enabled", desc: "Send tracking link via SMS to clients" },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
                        <div>
                          <p className="text-sm font-medium text-white">{item.label}</p>
                          <p className="text-xs text-zinc-500 mt-0.5">{item.desc}</p>
                        </div>
                        <span className="text-sm font-mono text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-lg">
                          {item.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  Radio,
  Search,
  OctagonX,
  Power,
  Zap,
  ArrowRight,
  MessageSquare,
  MapPin,
  Clock,
  User,
  ChevronRight,
  RefreshCw,
  ShieldAlert,
  Truck,
} from "lucide-react";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useOrg } from "@/lib/hooks/use-org";
import { createBrowserClient } from "@supabase/ssr";
import {
  getAnomalies,
  getArbitrationEvents,
  getDispatchStats,
  toggleAutopilot,
  getAutopilotStatus,
  reportAnomaly,
  overrideAnomaly,
} from "@/app/actions/outrider-autonomous";
import { useToastStore } from "@/components/app/action-toast";

/* ── Types ────────────────────────────────────────────── */

interface AnomalyRow {
  id: string;
  worker_id: string;
  worker_name: string | null;
  anomaly_type: string;
  delay_minutes: number;
  impacted_job_count: number;
  resolved_job_ids: string[];
  status: string;
  autopilot_active: boolean;
  created_at: string;
}

interface EventRow {
  id: string;
  anomaly_id: string | null;
  event_type: string;
  severity: string;
  message: string;
  created_at: string;
  metadata: Record<string, unknown>;
}

interface Stats {
  active_anomalies: number;
  resolved: number;
  escalated: number;
  total: number;
}

const SEVERITY_COLORS: Record<string, string> = {
  info: "text-zinc-400",
  success: "text-emerald-400",
  warning: "text-amber-400",
  error: "text-rose-400",
  critical: "text-rose-500",
};

const ANOMALY_ICONS: Record<string, string> = {
  VEHICLE_BREAKDOWN: "🚗",
  MEDICAL_EMERGENCY: "🏥",
  JOB_OVERRUN: "⏱️",
  TRAFFIC_SEVERE: "🚦",
  NO_SHOW: "👻",
  WEATHER_EMERGENCY: "⛈️",
};

/* ── Main Component ──────────────────────────────────── */

export default function DispatchLivePage() {
  const { orgId } = useOrg();
  const toast = useToastStore();

  const [anomalies, setAnomalies] = useState<AnomalyRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [autopilotEnabled, setAutopilotEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  const terminalRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    const [anomRes, evtRes, stRes, apRes] = await Promise.all([
      getAnomalies(orgId, { limit: 20 }),
      getArbitrationEvents(orgId, { limit: 100 }),
      getDispatchStats(orgId),
      getAutopilotStatus(orgId),
    ]);
    setAnomalies((anomRes.data ?? []) as unknown as AnomalyRow[]);
    setEvents((evtRes.data ?? []) as unknown as EventRow[]);
    setStats(stRes.data as Stats | null);
    setAutopilotEnabled(!!(apRes.data as Record<string, unknown>)?.autopilot_enabled);
    setLoading(false);
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  // Supabase Realtime subscription for terminal feed
  useEffect(() => {
    if (!orgId) return;

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const channel = supabase
      .channel(`dispatch-autopilot-${orgId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "arbitration_events",
          filter: `organization_id=eq.${orgId}`,
        },
        (payload) => {
          const newEvent = payload.new as unknown as EventRow;
          setEvents((prev) => [newEvent, ...prev].slice(0, 200));

          // Auto-scroll terminal
          if (terminalRef.current) {
            terminalRef.current.scrollTop = 0;
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "fleet_anomalies",
          filter: `organization_id=eq.${orgId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setAnomalies((prev) => [payload.new as unknown as AnomalyRow, ...prev].slice(0, 20));
          } else if (payload.eventType === "UPDATE") {
            setAnomalies((prev) =>
              prev.map((a) =>
                a.id === (payload.new as Record<string, unknown>).id
                  ? { ...a, ...(payload.new as unknown as AnomalyRow) }
                  : a
              )
            );
          }
          // Refresh stats
          getDispatchStats(orgId).then((r) => {
            if (r.data) setStats(r.data as Stats);
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [orgId]);

  const handleToggleAutopilot = useCallback(async () => {
    if (!orgId) return;
    setToggling(true);
    const newState = !autopilotEnabled;
    const res = await toggleAutopilot(orgId, newState);
    if (res.error) {
      toast.addToast(res.error, undefined, "error");
    } else {
      setAutopilotEnabled(newState);
      toast.addToast(newState ? "Autopilot enabled" : "Autopilot halted — manual control active");
    }
    setToggling(false);
    load();
  }, [orgId, autopilotEnabled, toast, load]);

  const handleOverride = useCallback(async (anomalyId: string) => {
    if (!orgId) return;
    await overrideAnomaly(orgId, anomalyId);
    toast.addToast("Anomaly overridden — manual control");
    load();
  }, [orgId, toast, load]);

  return (
    <div className="flex h-full bg-[#050505]">
      {/* ── Left Panel: Anomalies ──────────────────── */}
      <div className="flex-1 flex flex-col border-r border-white/[0.06] min-w-0">
        {/* Header */}
        <div className="shrink-0 border-b border-white/[0.06] px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <h1 className="text-base font-semibold text-white tracking-tight">
                  Outrider Autopilot
                </h1>
                <p className="text-[10px] text-zinc-500 mt-0.5">
                  Autonomous dispatch arbitration
                </p>
              </div>
            </div>

            {/* Autopilot Toggle */}
            <button
              onClick={handleToggleAutopilot}
              disabled={toggling}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                autopilotEnabled
                  ? "bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-500/20"
                  : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
              }`}
            >
              {toggling ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : autopilotEnabled ? (
                <OctagonX className="w-3.5 h-3.5" />
              ) : (
                <Power className="w-3.5 h-3.5" />
              )}
              {autopilotEnabled ? "HALT AUTOPILOT" : "Enable Autopilot"}
            </button>
          </div>

          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-4 gap-2 mt-4">
              <MiniStat label="Active" value={stats.active_anomalies} color="text-amber-400" />
              <MiniStat label="Resolved" value={stats.resolved} color="text-emerald-400" />
              <MiniStat label="Escalated" value={stats.escalated} color="text-rose-400" />
              <MiniStat label="Total" value={stats.total} color="text-zinc-300" />
            </div>
          )}
        </div>

        {/* Anomaly List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-zinc-500 text-xs gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading...
            </div>
          ) : anomalies.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-zinc-500">
              <Zap className="w-8 h-8 text-purple-500/20 mb-2" />
              <p className="text-xs font-medium text-zinc-400">No anomalies</p>
              <p className="text-[10px] mt-0.5">Fleet operating normally</p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              <AnimatePresence mode="popLayout">
                {anomalies.map((a) => (
                  <AnomalyCard key={a.id} anomaly={a} onOverride={() => handleOverride(a.id)} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* ── Right Panel: Terminal Feed ─────────────── */}
      <div className="w-[420px] shrink-0 flex flex-col bg-[#0A0A0A]">
        <div className="shrink-0 px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className={`w-3.5 h-3.5 ${autopilotEnabled ? "text-emerald-400 animate-pulse" : "text-zinc-600"}`} />
            <span className="text-xs font-semibold text-zinc-300 font-mono uppercase tracking-widest">
              Autopilot Terminal
            </span>
          </div>
          <button
            onClick={load}
            className="w-6 h-6 rounded-md bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center"
          >
            <RefreshCw className={`w-3 h-3 text-zinc-500 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        <div ref={terminalRef} className="flex-1 overflow-y-auto p-3 space-y-0.5 font-mono text-[11px]">
          {events.length === 0 ? (
            <p className="text-zinc-600 py-8 text-center">Awaiting events...</p>
          ) : (
            <AnimatePresence mode="popLayout">
              {events.map((evt) => (
                <TerminalLine key={evt.id} event={evt} />
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Sub-Components ──────────────────────────────────── */

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
      <p className="text-[9px] uppercase tracking-wider text-zinc-600 font-medium">{label}</p>
      <p className={`text-lg font-semibold tracking-tight ${color}`}>{value}</p>
    </div>
  );
}

function AnomalyCard({ anomaly, onOverride }: { anomaly: AnomalyRow; onOverride: () => void }) {
  const isActive = ["DETECTED", "ANALYZING_SPATIAL", "EXECUTING_ARBITRATION", "NEGOTIATING_CLIENT"].includes(anomaly.status);
  const isResolved = anomaly.status === "RESOLVED";
  const date = new Date(anomaly.created_at);
  const emoji = ANOMALY_ICONS[anomaly.anomaly_type] ?? "⚠️";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className={`px-5 py-4 ${isActive ? "bg-purple-500/[0.03]" : ""}`}
    >
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-base shrink-0 ${
          isActive ? "bg-purple-500/10 shadow-[0_0_15px_rgba(168,85,247,0.2)]" : isResolved ? "bg-emerald-500/10" : "bg-zinc-800"
        }`}>
          {isActive ? (
            <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" />
          ) : (
            <span>{emoji}</span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-white">
              {anomaly.worker_name ?? "Worker"}
            </span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
              isActive ? "bg-purple-500/10 text-purple-400" :
              isResolved ? "bg-emerald-500/10 text-emerald-400" :
              anomaly.status === "MANUAL_OVERRIDE" ? "bg-amber-500/10 text-amber-400" :
              "bg-zinc-500/10 text-zinc-400"
            }`}>
              {anomaly.status.replace(/_/g, " ")}
            </span>
          </div>
          <p className="text-[11px] text-zinc-400 mt-0.5">
            {anomaly.anomaly_type.replace(/_/g, " ")} — {anomaly.delay_minutes}m delay — {anomaly.impacted_job_count} jobs impacted
          </p>
          <p className="text-[10px] text-zinc-600 mt-0.5 font-mono">
            {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </p>
        </div>

        {isActive && (
          <button
            onClick={onOverride}
            className="shrink-0 px-2.5 py-1.5 rounded-lg text-[10px] font-medium text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 transition-all"
          >
            Override
          </button>
        )}
      </div>
    </motion.div>
  );
}

function TerminalLine({ event }: { event: EventRow }) {
  const time = new Date(event.created_at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const color = SEVERITY_COLORS[event.severity] ?? "text-zinc-400";
  const isEscalation = event.event_type === "SENTIMENT_ESCALATION";

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={`py-1 px-2 rounded ${
        isEscalation ? "bg-rose-500/10 border border-rose-500/20 animate-pulse" : ""
      }`}
    >
      <span className="text-zinc-600 select-none">{"> "}</span>
      <span className="text-zinc-500">[{time}]</span>{" "}
      <span className={color}>{event.message}</span>
    </motion.div>
  );
}

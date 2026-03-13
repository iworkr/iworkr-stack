"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldAlert,
  AlertTriangle,
  Info,
  Activity,
  ArrowUpRight,
  X,
  Check,
  Shield,
} from "lucide-react";
import { useState, useMemo, useCallback, useEffect } from "react";
import { useOrg } from "@/lib/hooks/use-org";
import {
  fetchSentinelAlertsAction,
  acknowledgeSentinelAlertAction,
} from "@/app/actions/care";

/* ── Types ──────────────────────────────────────────────────────────────────── */

type SentinelSeverity = "critical" | "warning" | "info";
type SentinelStatus = "active" | "acknowledged" | "escalated" | "dismissed" | "resolved";
type AlertType =
  | "progress_note_keywords"
  | "health_baseline_deviation"
  | "medication_non_compliance"
  | "credential_expiry_escalation"
  | "budget_overrun"
  | "care_plan_review_due"
  | "restrictive_practice_debrief_overdue";

interface SentinelAlert {
  id: string;
  organization_id: string;
  alert_type: AlertType;
  severity: SentinelSeverity;
  status: SentinelStatus;
  title: string;
  description: string;
  participant_id: string | null;
  worker_id: string | null;
  shift_id: string | null;
  source_table: string | null;
  source_id: string | null;
  triggered_keywords: string[];
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  resolution_action: string | null;
  resolution_notes: string | null;
  resolved_at: string | null;
  created_at: string;
}

/* ── Config ─────────────────────────────────────────────────────────────────── */

const SEVERITY_CONFIG: Record<
  SentinelSeverity,
  { label: string; color: string; bg: string; border: string; dot: string; glow: string }
> = {
  critical: {
    label: "Critical",
    color: "text-rose-400",
    bg: "bg-rose-500/10",
    border: "border-rose-500/20",
    dot: "bg-rose-500",
    glow: "shadow-[0_0_12px_-2px_rgba(244,63,94,0.3)]",
  },
  warning: {
    label: "Warning",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    dot: "bg-amber-500",
    glow: "",
  },
  info: {
    label: "Info",
    color: "text-sky-400",
    bg: "bg-sky-500/10",
    border: "border-sky-500/20",
    dot: "bg-sky-500",
    glow: "",
  },
};

const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  progress_note_keywords: "Keyword Detection",
  health_baseline_deviation: "Health Deviation",
  medication_non_compliance: "Medication Non-Compliance",
  credential_expiry_escalation: "Credential Expiry",
  budget_overrun: "Budget Overrun",
  care_plan_review_due: "Care Plan Review Due",
  restrictive_practice_debrief_overdue: "Restrictive Practice Debrief",
};

type FilterTab = "active" | "acknowledged" | "escalated" | "all";

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: "active", label: "Active" },
  { key: "acknowledged", label: "Acknowledged" },
  { key: "escalated", label: "Escalated" },
  { key: "all", label: "All" },
];

/* ── Skeleton ───────────────────────────────────────────────────────────────── */

function AlertSkeleton() {
  return (
    <div className="r-card border border-white/[0.05] bg-white/[0.02] p-5 space-y-3">
      <div className="flex items-start gap-3">
        <div className="h-2.5 w-2.5 rounded-full skeleton-shimmer mt-1.5" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-2/3 rounded skeleton-shimmer" />
          <div className="h-3 w-full rounded skeleton-shimmer" />
        </div>
        <div className="h-5 w-20 rounded-full skeleton-shimmer" />
      </div>
      <div className="flex items-center gap-2 pl-5">
        <div className="h-4 w-16 rounded skeleton-shimmer" />
        <div className="h-4 w-24 rounded skeleton-shimmer" />
      </div>
    </div>
  );
}

/* ── Summary Card ───────────────────────────────────────────────────────────── */

function SummaryCard({
  label,
  count,
  color,
  border,
  glow,
  delay,
}: {
  label: string;
  count: number;
  color: string;
  border: string;
  glow?: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={`r-card border ${border} bg-white/[0.02] p-4 ${glow ?? ""}`}
      style={{ boxShadow: glow ? undefined : "var(--shadow-inset-bevel)" }}
    >
      <p className="font-mono text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-1">
        {label}
      </p>
      <p className={`font-mono text-2xl font-semibold tabular-nums ${color}`}>
        {count}
      </p>
    </motion.div>
  );
}

/* ── Alert Card ─────────────────────────────────────────────────────────────── */

function AlertCard({
  alert,
  index,
  onDismiss,
  onEscalate,
  onCreateIncident,
}: {
  alert: SentinelAlert;
  index: number;
  onDismiss: (id: string, reason: string) => void;
  onEscalate: (id: string) => void;
  onCreateIncident: (id: string) => void;
}) {
  const config = SEVERITY_CONFIG[alert.severity];
  const [dismissing, setDismissing] = useState(false);
  const [dismissReason, setDismissReason] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const isCritical = alert.severity === "critical";
  const isActive = alert.status === "active";

  const handleDismiss = async () => {
    if (!dismissReason.trim()) return;
    setActionLoading("dismiss");
    await onDismiss(alert.id, dismissReason);
    setDismissing(false);
    setDismissReason("");
    setActionLoading(null);
  };

  const handleEscalate = async () => {
    setActionLoading("escalate");
    await onEscalate(alert.id);
    setActionLoading(null);
  };

  const handleCreateIncident = async () => {
    setActionLoading("incident");
    await onCreateIncident(alert.id);
    setActionLoading(null);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ delay: index * 0.03, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={`r-card border bg-white/[0.02] p-5 transition-colors hover:border-white/[0.1] ${
        isCritical && isActive
          ? "border-rose-500/25 animate-[sentinel-breathe_3s_ease-in-out_infinite]"
          : "border-white/[0.06]"
      }`}
      style={
        isCritical && isActive
          ? {}
          : { boxShadow: "var(--shadow-inset-bevel)" }
      }
    >
      <div className="flex items-start gap-3">
        {/* Severity dot */}
        <div className="pt-1.5 flex-shrink-0">
          <div className={`h-2.5 w-2.5 rounded-full ${config.dot}`} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="text-[14px] font-medium text-zinc-100 tracking-tight">
              {alert.title}
            </h3>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide ${config.bg} ${config.color} border ${config.border}`}
            >
              {config.label}
            </span>
          </div>

          <p className="text-[13px] text-zinc-400 leading-relaxed mb-3">
            {alert.description}
          </p>

          {/* Metadata row */}
          <div className="flex items-center gap-3 flex-wrap text-[12px] text-zinc-500">
            {/* Alert type badge */}
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] text-[11px] text-zinc-400">
              {ALERT_TYPE_LABELS[alert.alert_type]}
            </span>

            {/* Participant */}
            {alert.participant_id && (
              <span className="text-zinc-500">
                Participant: <span className="text-zinc-400 font-mono text-[11px]">{alert.participant_id.slice(0, 8)}…</span>
              </span>
            )}

            {/* Timestamp */}
            <span className="font-mono text-[11px] text-zinc-600">
              {new Date(alert.created_at).toLocaleString("en-AU", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>

          {/* Triggered keywords (for NLP alerts) */}
          {alert.alert_type === "progress_note_keywords" &&
            alert.triggered_keywords?.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap mt-3">
                <span className="text-[11px] text-zinc-600 font-medium">Keywords:</span>
                {alert.triggered_keywords.map((kw) => (
                  <span
                    key={kw}
                    className="inline-flex items-center px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-[10px] font-medium text-rose-400"
                  >
                    {kw}
                  </span>
                ))}
              </div>
            )}

          {/* Actions */}
          {isActive && (
            <div className="flex items-center gap-2 mt-4">
              <button
                onClick={handleCreateIncident}
                disabled={actionLoading !== null}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 r-button bg-[var(--brand)] text-white text-[12px] font-medium hover:brightness-110 transition-colors disabled:opacity-40"
              >
                <ShieldAlert className="w-3 h-3" />
                {actionLoading === "incident" ? "Creating…" : "Create Incident"}
              </button>

              {!dismissing ? (
                <button
                  onClick={() => setDismissing(true)}
                  disabled={actionLoading !== null}
                  className="inline-flex items-center gap-1 px-3 py-1.5 r-button text-[12px] font-medium text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] transition-colors disabled:opacity-40"
                >
                  <X className="w-3 h-3" />
                  Dismiss
                </button>
              ) : (
                <motion.div
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  className="flex items-center gap-1.5 overflow-hidden"
                >
                  <input
                    autoFocus
                    value={dismissReason}
                    onChange={(e) => setDismissReason(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleDismiss();
                      if (e.key === "Escape") {
                        setDismissing(false);
                        setDismissReason("");
                      }
                    }}
                    placeholder="Reason for dismissal…"
                    className="w-48 px-2.5 py-1.5 r-input bg-white/[0.04] border border-white/[0.08] text-[12px] text-zinc-300 placeholder:text-zinc-600 outline-none focus:border-white/[0.15] transition-colors"
                  />
                  <button
                    onClick={handleDismiss}
                    disabled={!dismissReason.trim() || actionLoading !== null}
                    className="p-1.5 r-button bg-white/[0.06] text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-40"
                  >
                    <Check className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => {
                      setDismissing(false);
                      setDismissReason("");
                    }}
                    className="p-1.5 text-zinc-600 hover:text-zinc-400 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </motion.div>
              )}

              <button
                onClick={handleEscalate}
                disabled={actionLoading !== null}
                className="inline-flex items-center gap-1 px-3 py-1.5 r-button border border-white/[0.08] text-[12px] font-medium text-zinc-400 hover:text-zinc-200 hover:border-white/[0.15] hover:bg-white/[0.04] transition-colors disabled:opacity-40"
              >
                <ArrowUpRight className="w-3 h-3" />
                {actionLoading === "escalate" ? "Escalating…" : "Escalate"}
              </button>
            </div>
          )}

          {/* Resolution info for non-active */}
          {!isActive && alert.resolution_notes && (
            <div className="mt-3 text-[12px] text-zinc-600 italic">
              Resolution: {alert.resolution_notes}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ── Empty State ────────────────────────────────────────────────────────────── */

function EmptyState() {
  return (
    <div className="stealth-empty-state">
      <div className="relative mb-6">
        <div className="animate-zen-ring absolute inset-0 rounded-full border border-zinc-800" />
        <div className="stealth-empty-state-icon animate-zen-breathe">
          <Shield className="w-5 h-5 text-zinc-600" />
        </div>
      </div>
      <h3 className="stealth-empty-state-title">All clear</h3>
      <p className="stealth-empty-state-desc">
        No active alerts. Sentinel is monitoring your organization.
      </p>
    </div>
  );
}

/* ── Main Page ──────────────────────────────────────────────────────────────── */

export default function SentinelAlertsPage() {
  const { orgId } = useOrg();
  const [alerts, setAlerts] = useState<SentinelAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>("active");

  /* ── Load alerts ───── */
  const loadAlerts = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const status = activeTab === "all" ? undefined : activeTab;
      const data = await fetchSentinelAlertsAction(orgId, status);
      setAlerts((data as SentinelAlert[]) ?? []);
    } catch (err) {
      console.error("Failed to load sentinel alerts:", err);
    } finally {
      setLoading(false);
    }
  }, [orgId, activeTab]);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  /* ── Actions ───── */
  const handleDismiss = useCallback(
    async (id: string, reason: string) => {
      try {
        await acknowledgeSentinelAlertAction(id, "dismissed_false_positive", reason);
        await loadAlerts();
      } catch (err) {
        console.error("Failed to dismiss alert:", err);
      }
    },
    [loadAlerts],
  );

  const handleEscalate = useCallback(
    async (id: string) => {
      try {
        await acknowledgeSentinelAlertAction(id, "escalated_to_clinical");
        await loadAlerts();
      } catch (err) {
        console.error("Failed to escalate alert:", err);
      }
    },
    [loadAlerts],
  );

  const handleCreateIncident = useCallback(
    async (id: string) => {
      try {
        await acknowledgeSentinelAlertAction(id, "incident_created", "Incident created from Sentinel alert");
        await loadAlerts();
      } catch (err) {
        console.error("Failed to create incident from alert:", err);
      }
    },
    [loadAlerts],
  );

  /* ── Stats ───── */
  const stats = useMemo(() => {
    const active = alerts.filter((a) => a.status === "active");
    return {
      critical: active.filter((a) => a.severity === "critical").length,
      warnings: active.filter((a) => a.severity === "warning").length,
      info: active.filter((a) => a.severity === "info").length,
      totalActive: active.length,
    };
  }, [alerts]);

  /* ── Filtered list ───── */
  const filtered = useMemo(() => {
    if (activeTab === "all") return alerts;
    return alerts.filter((a) => a.status === activeTab);
  }, [alerts, activeTab]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="relative min-h-screen bg-[var(--background)]"
    >
      {/* Noise overlay */}
      <div className="stealth-noise" />

      {/* Atmospheric glow — rose tint for sentinel */}
      <div
        className="pointer-events-none absolute top-0 left-0 right-0 h-72 z-0"
        style={{
          background:
            "radial-gradient(ellipse at center top, rgba(244,63,94,0.025) 0%, transparent 60%)",
        }}
      />

      <div className="relative z-10 max-w-[1400px] mx-auto px-6 py-8 space-y-6">
        {/* ── Header ────── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="font-mono text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-1">
            SENTINEL ALERTS
          </p>
          <h1 className="text-xl font-semibold text-zinc-100 tracking-tight">
            Risk Monitoring
          </h1>
          <p className="text-[13px] text-zinc-500 mt-1">
            Automated risk detection across progress notes, health observations, medication compliance, and credentials.
          </p>
        </motion.div>

        {/* ── Summary Cards ────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryCard
            label="Critical"
            count={stats.critical}
            color="text-rose-400"
            border="border-rose-500/20"
            glow={
              stats.critical > 0
                ? "shadow-[0_0_15px_-4px_rgba(244,63,94,0.2)]"
                : undefined
            }
            delay={0.05}
          />
          <SummaryCard
            label="Warnings"
            count={stats.warnings}
            color="text-amber-400"
            border="border-amber-500/20"
            delay={0.1}
          />
          <SummaryCard
            label="Info"
            count={stats.info}
            color="text-sky-400"
            border="border-sky-500/20"
            delay={0.15}
          />
          <SummaryCard
            label="Total Active"
            count={stats.totalActive}
            color="text-zinc-100"
            border="border-white/[0.08]"
            delay={0.2}
          />
        </div>

        {/* ── Filter Tabs ────── */}
        <div className="stealth-tabs">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              data-active={activeTab === tab.key}
              className="stealth-tab"
            >
              {tab.label}
              {tab.key === "active" && stats.totalActive > 0 && (
                <span className="ml-1.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-500/15 px-1 font-mono text-[9px] font-medium text-rose-400">
                  {stats.totalActive}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Alert List ────── */}
        <div className="space-y-3">
          {loading && (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <AlertSkeleton key={i} />
              ))}
            </div>
          )}

          {!loading && filtered.length === 0 && <EmptyState />}

          <AnimatePresence mode="popLayout">
            {!loading &&
              filtered.map((alert, idx) => (
                <AlertCard
                  key={alert.id}
                  alert={alert}
                  index={idx}
                  onDismiss={handleDismiss}
                  onEscalate={handleEscalate}
                  onCreateIncident={handleCreateIncident}
                />
              ))}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Breathing Rose Glow Animation (inline CSS) ────── */}
      <style>{`
        @keyframes sentinel-breathe {
          0%, 100% {
            border-color: rgba(244, 63, 94, 0.15);
            box-shadow: 0 0 4px rgba(244, 63, 94, 0.05);
          }
          50% {
            border-color: rgba(244, 63, 94, 0.30);
            box-shadow: 0 0 15px -4px rgba(244, 63, 94, 0.15);
          }
        }
      `}</style>
    </motion.div>
  );
}

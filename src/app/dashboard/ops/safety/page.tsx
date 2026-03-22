/**
 * @page /dashboard/ops/safety
 * @status COMPLETE
 * @description Safety compliance hub with SWMS, incidents, stop-work alerts, and geofences
 * @dataSource server-action
 * @lastAudit 2026-03-22
 */
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, Search, Plus, AlertTriangle, CheckCircle2, XCircle,
  FileText, RefreshCw, Clock, MapPin, Eye,
  Activity, Users, Clipboard, AlertOctagon, Radio, Fence,
  Trash2, Send, X, ChevronRight, Loader2,
} from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import {
  getSafetyComplianceStats,
  getRecentSwmsRecords,
  getStopWorkAlerts,
  getSwmsTemplates,
  createSwmsTemplate,
  publishSwmsTemplate,
} from "@/app/actions/aegis-safety";

/* ── Types ───────────────────────────────────────────── */

interface ComplianceStats {
  active_jobs: number;
  jobs_with_swms: number;
  compliance_percentage: number;
  signed_today: number;
  pending_assessments: number;
  stop_work_alerts_24h: number;
}

interface SwmsRecord {
  id: string;
  job_id: string;
  worker_id: string;
  status: string;
  highest_residual_risk: string | null;
  final_risk_score: number | null;
  distance_from_site_meters: number | null;
  geofence_passed: boolean;
  stop_work_triggered: boolean;
  stop_work_reason: string | null;
  completed_at: string | null;
  created_at: string;
  pdf_url: string | null;
  assessed_hazards: any[];
  jobs?: { id: string; title: string } | null;
}

interface StopWorkAlert extends SwmsRecord {}

interface SwmsTemplate {
  id: string;
  title: string;
  trade_category: string | null;
  description: string | null;
  default_hazards: any[];
  required_ppe: string[];
  status: string;
  created_at: string;
  updated_at: string;
}

interface HazardEntry {
  hazard: string;
  risk: "LOW" | "MEDIUM" | "HIGH" | "EXTREME";
  control: string;
}

/* ── Constants ───────────────────────────────────────── */

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  IN_PROGRESS: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/20" },
  COMPLETED:   { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" },
  SIGNED:      { bg: "bg-green-500/10", text: "text-green-400", border: "border-green-500/20" },
  STOP_WORK:   { bg: "bg-rose-500/10", text: "text-rose-400", border: "border-rose-500/20" },
};

const RISK_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  LOW:     { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" },
  MEDIUM:  { bg: "bg-yellow-500/10", text: "text-yellow-400", border: "border-yellow-500/20" },
  HIGH:    { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20" },
  EXTREME: { bg: "bg-rose-500/10", text: "text-rose-400", border: "border-rose-500/20" },
};

const TEMPLATE_STATUS_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  DRAFT:     { bg: "bg-zinc-500/10", text: "text-zinc-400", border: "border-zinc-500/20" },
  PUBLISHED: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" },
  ARCHIVED:  { bg: "bg-zinc-500/8", text: "text-zinc-600", border: "border-zinc-500/10" },
};

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

const STAGGER_CONTAINER = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const STAGGER_ITEM = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE_OUT_EXPO } },
};

/* ── Page ─────────────────────────────────────────────── */

export default function SafetyCommandCenterPage() {
  const org = useAuthStore((s) => s.currentOrg);
  const orgId = org?.id;

  const [stats, setStats] = useState<ComplianceStats | null>(null);
  const [records, setRecords] = useState<SwmsRecord[]>([]);
  const [stopAlerts, setStopAlerts] = useState<StopWorkAlert[]>([]);
  const [templates, setTemplates] = useState<SwmsTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"records" | "templates">("records");
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);

  /* ── Data fetch ──────────────────────────────────── */

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);

    const [statsRes, recordsRes, alertsRes, templatesRes] = await Promise.all([
      getSafetyComplianceStats(orgId),
      getRecentSwmsRecords(orgId, 50),
      getStopWorkAlerts(orgId),
      getSwmsTemplates(orgId),
    ]);

    if (statsRes.data) setStats(statsRes.data);
    if (recordsRes.data) setRecords(recordsRes.data);
    if (alertsRes.data) setStopAlerts(alertsRes.data);
    if (templatesRes.data) setTemplates(templatesRes.data);

    setLoading(false);
  }, [orgId, search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  /* ── Derived ─────────────────────────────────────── */

  const activeStopWorkCount = useMemo(
    () => stopAlerts.length,
    [stopAlerts],
  );

  const formatTime = (iso: string | null) => {
    if (!iso) return "—";
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h ago`;
    return d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
  };

  /* ── Telemetry metrics config ────────────────────── */

  const telemetry = stats
    ? [
        {
          label: "ACTIVE SITES",
          value: String(stats.active_jobs),
          icon: <MapPin className="w-3.5 h-3.5" />,
          variant: "blue" as const,
          pulse: false,
        },
        {
          label: "SWMS COMPLIANCE",
          value: `${stats.compliance_percentage}%`,
          icon: <Shield className="w-3.5 h-3.5" />,
          variant: (
            stats.compliance_percentage >= 100
              ? "emerald"
              : stats.compliance_percentage >= 90
              ? "amber"
              : "rose"
          ) as "emerald" | "amber" | "rose",
          pulse: stats.compliance_percentage < 90,
        },
        {
          label: "SIGNED TODAY",
          value: String(stats.signed_today),
          icon: <CheckCircle2 className="w-3.5 h-3.5" />,
          variant: "emerald" as const,
          pulse: false,
        },
        {
          label: "PENDING ASSESSMENTS",
          value: String(stats.pending_assessments),
          icon: <Clipboard className="w-3.5 h-3.5" />,
          variant: (stats.pending_assessments > 0 ? "amber" : "default") as "amber" | "default",
          pulse: false,
        },
        {
          label: "STOP WORK 24H",
          value: String(stats.stop_work_alerts_24h),
          icon: <AlertOctagon className="w-3.5 h-3.5" />,
          variant: "rose" as const,
          pulse: stats.stop_work_alerts_24h > 0,
        },
        {
          label: "JOBS WITH SWMS",
          value: String(stats.jobs_with_swms),
          icon: <Clipboard className="w-3.5 h-3.5" />,
          variant: "emerald" as const,
          pulse: false,
        },
      ]
    : [];

  /* ── Render ──────────────────────────────────────── */

  return (
    <div className="stealth-page-canvas">
      {/* ── Stop Work Alert Banner ────────────────── */}
      <AnimatePresence>
        {stats && stats.stop_work_alerts_24h > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: EASE_OUT_EXPO }}
            className="overflow-hidden"
          >
            <div className="relative flex items-center gap-3 px-4 py-3 bg-rose-500/8 border-b border-rose-500/20 animate-pulse">
              <div className="absolute inset-0 bg-gradient-to-r from-rose-500/5 via-transparent to-rose-500/5 pointer-events-none" />
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span className="text-[13px] font-medium text-rose-300">
                ⚠ STOP WORK AUTHORITY TRIGGERED —{" "}
                <span className="font-mono font-bold text-rose-400">
                  {stats.stop_work_alerts_24h}
                </span>{" "}
                {stats.stop_work_alerts_24h === 1 ? "incident" : "incidents"} in 24h
              </span>
              <button
                onClick={() => {
                  setActiveTab("records");
                  setStatusFilter("STOP_WORK");
                }}
                className="ml-auto flex items-center gap-1 text-[11px] font-medium text-rose-400 hover:text-rose-300 transition-colors"
              >
                View incidents <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Header ────────────────────────────────── */}
      <div className="stealth-page-header">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <Shield className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">
              Safety Command Center
            </h1>
            <p className="text-xs text-[var(--text-muted)]">
              Real-time SWMS compliance monitoring
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="stealth-btn-ghost text-xs p-2"
            title="Refresh data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => setShowCreateTemplate(true)}
            className="stealth-btn-primary text-xs flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            New Template
          </button>
        </div>
      </div>

      {/* ── Telemetry Ribbon ──────────────────────── */}
      {stats && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE_OUT_EXPO }}
          className="grid grid-cols-6 gap-3 px-4 mb-5"
        >
          {telemetry.map((t) => (
            <TelemetryCard key={t.label} {...t} />
          ))}
        </motion.div>
      )}

      {/* ── Tab Navigation ────────────────────────── */}
      <div className="flex items-center gap-1 px-4 mb-4">
        <TabButton
          active={activeTab === "records"}
          onClick={() => setActiveTab("records")}
          icon={<Activity className="w-3.5 h-3.5" />}
          label="SWMS Records"
          count={records.length}
        />
        <TabButton
          active={activeTab === "templates"}
          onClick={() => setActiveTab("templates")}
          icon={<FileText className="w-3.5 h-3.5" />}
          label="Templates"
          count={templates.length}
        />
      </div>

      {/* ── Records Panel ─────────────────────────── */}
      <AnimatePresence mode="wait">
        {activeTab === "records" && (
          <motion.div
            key="records"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: EASE_OUT_EXPO }}
          >
            {/* Search & Filters */}
            <div className="flex items-center gap-3 px-4 mb-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                <input
                  type="text"
                  placeholder="Search jobs or workers..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-sm bg-[var(--surface-1)] border border-[var(--border-base)] r-input text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus-ring"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 text-xs bg-[var(--surface-1)] border border-[var(--border-base)] r-input text-[var(--text-primary)]"
              >
                <option value="">All Statuses</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="SIGNED">Signed</option>
                <option value="STOP_WORK">Stop Work</option>
              </select>
            </div>

            {/* Records Grid */}
            <div className="px-4">
              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <SkeletonCard key={i} />
                  ))}
                </div>
              ) : records.length === 0 ? (
                <EmptyState
                  icon={<Shield className="w-8 h-8" />}
                  title="No SWMS records"
                  description="Safety records will appear here as workers complete SWMS on-site"
                />
              ) : (
                <motion.div
                  variants={STAGGER_CONTAINER}
                  initial="hidden"
                  animate="show"
                  className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3"
                >
                  {records.map((record) => (
                    <SwmsRecordCard
                      key={record.id}
                      record={record}
                      formatTime={formatTime}
                    />
                  ))}
                </motion.div>
              )}
            </div>

            {/* ── Stop Work Alerts Detail ──────────── */}
            {activeStopWorkCount > 0 && (
              <div className="px-4 mt-6">
                <div className="flex items-center gap-2 mb-3">
                  <AlertOctagon className="w-4 h-4 text-rose-400" />
                  <h3 className="text-[13px] font-medium text-[var(--text-primary)]">
                    Active Stop Work Alerts
                  </h3>
                  <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-500/15 px-1 font-mono text-[9px] font-medium text-rose-400">
                    {activeStopWorkCount}
                  </span>
                </div>
                <div className="space-y-2">
                  {stopAlerts.map((alert) => (
                      <StopWorkAlertRow
                        key={alert.id}
                        alert={alert}
                        formatTime={formatTime}
                      />
                    ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ── Templates Panel ─────────────────────── */}
        {activeTab === "templates" && (
          <motion.div
            key="templates"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: EASE_OUT_EXPO }}
            className="px-4"
          >
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-20 bg-[var(--surface-1)] border border-[var(--border-base)] r-card animate-[skeleton-shimmer_1.5s_infinite]"
                  />
                ))}
              </div>
            ) : templates.length === 0 ? (
              <EmptyState
                icon={<FileText className="w-8 h-8" />}
                title="No SWMS templates"
                description="Create templates to standardize safety procedures across your team"
                action={
                  <button
                    onClick={() => setShowCreateTemplate(true)}
                    className="stealth-btn-primary text-xs flex items-center gap-1.5 mt-3"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Create Template
                  </button>
                }
              />
            ) : (
              <motion.div
                variants={STAGGER_CONTAINER}
                initial="hidden"
                animate="show"
                className="space-y-2"
              >
                {templates.map((tmpl) => (
                  <TemplateRow
                    key={tmpl.id}
                    template={tmpl}
                    orgId={orgId!}
                    onPublished={load}
                    formatTime={formatTime}
                  />
                ))}
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Create Template Modal ─────────────────── */}
      <AnimatePresence>
        {showCreateTemplate && (
          <CreateTemplateModal
            orgId={orgId!}
            onClose={() => setShowCreateTemplate(false)}
            onCreated={() => {
              setShowCreateTemplate(false);
              setActiveTab("templates");
              load();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ══════════════════════════════════════════════════════════ */

/* ── Telemetry Card ──────────────────────────────────── */

function TelemetryCard({
  label,
  value,
  icon,
  variant = "default",
  pulse = false,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  variant?: "default" | "blue" | "emerald" | "amber" | "rose";
  pulse?: boolean;
}) {
  const variantColors = {
    default: { icon: "text-[var(--text-muted)]", value: "text-[var(--text-primary)]", glow: "" },
    blue:    { icon: "text-blue-400", value: "text-blue-400", glow: "shadow-[0_0_12px_-4px_rgba(59,130,246,0.2)]" },
    emerald: { icon: "text-emerald-400", value: "text-emerald-400", glow: "shadow-[0_0_12px_-4px_rgba(16,185,129,0.2)]" },
    amber:   { icon: "text-amber-400", value: "text-amber-400", glow: "shadow-[0_0_12px_-4px_rgba(245,158,11,0.2)]" },
    rose:    { icon: "text-rose-400", value: "text-rose-400", glow: "shadow-[0_0_12px_-4px_rgba(244,63,94,0.2)]" },
  };

  const c = variantColors[variant];

  return (
    <motion.div
      variants={STAGGER_ITEM}
      className={`
        h-16 flex items-center gap-3 px-4
        bg-zinc-950/30 border border-zinc-800/50 rounded-xl
        transition-all duration-200 hover:border-zinc-700/60
        ${pulse ? "animate-pulse" : ""}
        ${variant !== "default" ? c.glow : ""}
      `}
    >
      <div className={`shrink-0 ${c.icon}`}>{icon}</div>
      <div className="min-w-0">
        <div className="text-[9px] font-bold tracking-widest text-[var(--text-muted)] uppercase truncate">
          {label}
        </div>
        <div className={`text-sm font-mono font-semibold ${c.value}`}>
          {value}
        </div>
      </div>
    </motion.div>
  );
}

/* ── Tab Button ──────────────────────────────────────── */

function TabButton({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-2 px-3 py-1.5 text-[12px] font-medium rounded-lg
        transition-all duration-150
        ${
          active
            ? "bg-white/[0.06] text-[var(--text-primary)] border border-[var(--border-active)]"
            : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/[0.03]"
        }
      `}
    >
      {icon}
      {label}
      {typeof count === "number" && (
        <span className="ml-1 font-mono text-[10px] text-[var(--text-muted)]">
          {count}
        </span>
      )}
    </button>
  );
}

/* ── SWMS Record Card ────────────────────────────────── */

function SwmsRecordCard({
  record,
  formatTime,
}: {
  record: SwmsRecord;
  formatTime: (iso: string | null) => string;
}) {
  const statusKey = record.stop_work_triggered ? "STOP_WORK" : record.status;
  const statusStyle = STATUS_STYLES[statusKey] || STATUS_STYLES.IN_PROGRESS;
  const riskRating = record.highest_residual_risk || "LOW";
  const riskStyle = RISK_STYLES[riskRating] || RISK_STYLES.LOW;
  const dist = record.distance_from_site_meters ?? 0;

  return (
    <motion.div
      variants={STAGGER_ITEM}
      className={`
        group relative overflow-hidden
        border border-[var(--border-base)] bg-zinc-950/40 r-card p-4
        transition-all duration-200 hover:border-[var(--border-active)]
        ${record.stop_work_triggered ? "border-rose-500/20 bg-rose-500/[0.02]" : ""}
      `}
    >
      {/* Stop Work diagonal stripe overlay */}
      {record.stop_work_triggered && (
        <div
          className="absolute inset-0 pointer-events-none opacity-30"
          style={{
            backgroundImage:
              "repeating-linear-gradient(135deg, transparent, transparent 4px, rgba(244,63,94,0.06) 4px, rgba(244,63,94,0.06) 5px)",
          }}
        />
      )}

      {/* Header Row */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0 flex-1">
          <h4 className="text-[13px] font-medium text-[var(--text-primary)] truncate">
            {record.jobs?.title || "Untitled Job"}
          </h4>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Users className="w-3 h-3 text-[var(--text-muted)]" />
            <span className="text-[11px] text-[var(--text-muted)] truncate">
              Worker {record.worker_id?.substring(0, 8) || "—"}
            </span>
          </div>
        </div>

        {/* Status Badge */}
        <span
          className={`
            inline-flex shrink-0 items-center px-2 py-0.5
            text-[10px] font-semibold tracking-wide rounded-full border
            ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}
          `}
        >
          {statusKey.replace(/_/g, " ")}
        </span>
      </div>

      {/* Metrics Row */}
      <div className="flex items-center gap-3 mb-3">
        {/* Risk Score */}
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-bold tracking-widest text-[var(--text-muted)] uppercase">
            Risk
          </span>
          <span
            className={`
              inline-flex items-center px-1.5 py-0.5
              text-[10px] font-semibold tracking-wide rounded border
              ${riskStyle.bg} ${riskStyle.text} ${riskStyle.border}
            `}
          >
            {record.final_risk_score ?? "—"} {riskRating}
          </span>
        </div>

        {/* Distance */}
        <div className="flex items-center gap-1">
          <Radio className="w-3 h-3 text-[var(--text-muted)]" />
          <span className="font-mono text-[11px] text-[var(--text-muted)]">
            {dist < 1000 ? `${Math.round(dist)}m` : `${(dist / 1000).toFixed(1)}km`}
          </span>
        </div>

        {/* Geofence */}
        <div className="flex items-center gap-1">
          {record.geofence_passed ? (
            <>
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span className="text-[10px] text-emerald-400 font-medium">Fence OK</span>
            </>
          ) : (
            <>
              <XCircle className="w-3 h-3 text-rose-400" />
              <span className="text-[10px] text-rose-400 font-medium">Fence Fail</span>
            </>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-[var(--border-base)]">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3 h-3 text-[var(--text-muted)]" />
          <span className="font-mono text-[11px] text-[var(--text-muted)]">
            {formatTime(record.completed_at || record.created_at)}
          </span>
        </div>

        {record.pdf_url && (
          <a
            href={record.pdf_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-white/[0.03] hover:bg-white/[0.06] rounded-md transition-all"
          >
            <Eye className="w-3 h-3" />
            View PDF
          </a>
        )}
      </div>
    </motion.div>
  );
}

/* ── Stop Work Alert Row ─────────────────────────────── */

function StopWorkAlertRow({
  alert,
  formatTime,
}: {
  alert: StopWorkAlert;
  formatTime: (iso: string | null) => string;
}) {
  return (
    <div className="flex items-center gap-4 px-4 py-3 bg-rose-500/[0.03] border border-rose-500/15 r-card">
      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-rose-500/10 shrink-0">
        <AlertTriangle className="w-4 h-4 text-rose-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-medium text-rose-300 truncate">
            {alert.jobs?.title || "Untitled Job"}
          </span>
          <span className="text-[11px] text-[var(--text-muted)]">·</span>
          <span className="text-[11px] text-[var(--text-muted)] truncate">
            Worker {alert.worker_id?.substring(0, 8) || "—"}
          </span>
        </div>
        <p className="text-[12px] text-[var(--text-muted)] mt-0.5 truncate">
          {alert.stop_work_reason || "Residual risk too high"}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <span className="font-mono text-[11px] text-[var(--text-muted)]">
          {formatTime(alert.created_at)}
        </span>
      </div>
    </div>
  );
}

/* ── Template Row ────────────────────────────────────── */

function TemplateRow({
  template,
  orgId,
  onPublished,
  formatTime,
}: {
  template: SwmsTemplate;
  orgId: string;
  onPublished: () => void;
  formatTime: (iso: string | null) => string;
}) {
  const [publishing, setPublishing] = useState(false);
  const statusStyle = TEMPLATE_STATUS_STYLES[template.status] || TEMPLATE_STATUS_STYLES.DRAFT;

  const handlePublish = async () => {
    setPublishing(true);
    await publishSwmsTemplate(template.id, orgId);
    setPublishing(false);
    onPublished();
  };

  return (
    <motion.div
      variants={STAGGER_ITEM}
      className="flex items-center gap-4 px-4 py-3 border border-[var(--border-base)] bg-zinc-950/40 r-card hover:border-[var(--border-active)] transition-all duration-200"
    >
      <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-white/[0.03] border border-[var(--border-base)] shrink-0">
        <FileText className="w-4 h-4 text-[var(--text-muted)]" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="text-[13px] font-medium text-[var(--text-primary)] truncate">
            {template.title}
          </h4>
          <span
            className={`
              inline-flex items-center px-1.5 py-0.5
              text-[10px] font-semibold tracking-wide rounded-full border
              ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}
            `}
          >
            {template.status}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          {template.description && (
            <span className="text-[11px] text-[var(--text-muted)] truncate max-w-xs">
              {template.description}
            </span>
          )}
          <span className="font-mono text-[10px] text-[var(--text-muted)]">
            {(template.default_hazards || []).length} hazard{(template.default_hazards || []).length !== 1 ? "s" : ""}
          </span>
          <span className="text-[10px] text-[var(--text-dim)]">
            Updated {formatTime(template.updated_at)}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {template.status === "DRAFT" && (
          <button
            onClick={handlePublish}
            disabled={publishing}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/20 rounded-lg transition-all"
          >
            {publishing ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Send className="w-3 h-3" />
            )}
            Publish
          </button>
        )}
      </div>
    </motion.div>
  );
}

/* ── Empty State ─────────────────────────────────────── */

function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center py-16 text-center">
      <div className="relative mb-6">
        <div className="animate-zen-ring absolute inset-0 rounded-full border border-zinc-800" />
        <div className="animate-zen-breathe flex h-12 w-12 items-center justify-center rounded-xl border border-white/5 bg-white/[0.02]">
          <div className="text-zinc-600">{icon}</div>
        </div>
      </div>
      <h3 className="text-[14px] font-medium text-zinc-300">{title}</h3>
      <p className="mt-1 text-[12px] text-zinc-600 max-w-xs">{description}</p>
      {action}
    </div>
  );
}

/* ── Skeleton Card ───────────────────────────────────── */

function SkeletonCard() {
  return (
    <div className="border border-[var(--border-base)] bg-zinc-950/40 r-card p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1">
          <div className="h-3.5 w-36 bg-[var(--surface-2)] rounded animate-[skeleton-shimmer_1.5s_infinite]" />
          <div className="h-2.5 w-24 bg-[var(--surface-2)] rounded animate-[skeleton-shimmer_1.5s_infinite]" />
        </div>
        <div className="h-5 w-20 bg-[var(--surface-2)] rounded-full animate-[skeleton-shimmer_1.5s_infinite]" />
      </div>
      <div className="flex items-center gap-3">
        <div className="h-4 w-14 bg-[var(--surface-2)] rounded animate-[skeleton-shimmer_1.5s_infinite]" />
        <div className="h-4 w-12 bg-[var(--surface-2)] rounded animate-[skeleton-shimmer_1.5s_infinite]" />
        <div className="h-4 w-16 bg-[var(--surface-2)] rounded animate-[skeleton-shimmer_1.5s_infinite]" />
      </div>
      <div className="h-px bg-[var(--border-base)]" />
      <div className="flex items-center justify-between">
        <div className="h-3 w-16 bg-[var(--surface-2)] rounded animate-[skeleton-shimmer_1.5s_infinite]" />
        <div className="h-6 w-20 bg-[var(--surface-2)] rounded animate-[skeleton-shimmer_1.5s_infinite]" />
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   CREATE TEMPLATE MODAL
   ══════════════════════════════════════════════════════════ */

function CreateTemplateModal({
  orgId,
  onClose,
  onCreated,
}: {
  orgId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [hazards, setHazards] = useState<HazardEntry[]>([
    { hazard: "", risk: "MEDIUM", control: "" },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addHazard = () => {
    setHazards((prev) => [...prev, { hazard: "", risk: "MEDIUM", control: "" }]);
  };

  const removeHazard = (index: number) => {
    setHazards((prev) => prev.filter((_, i) => i !== index));
  };

  const updateHazard = (index: number, field: keyof HazardEntry, value: string) => {
    setHazards((prev) =>
      prev.map((h, i) =>
        i === index ? { ...h, [field]: value } : h,
      ),
    );
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError("Template name is required");
      return;
    }

    const validHazards = hazards.filter((h) => h.hazard.trim() && h.control.trim());
    if (validHazards.length === 0) {
      setError("At least one hazard with a control measure is required");
      return;
    }

    setSaving(true);
    setError(null);

    const result = await createSwmsTemplate(orgId, {
      title: name.trim(),
      default_hazards: validHazards,
    });

    setSaving(false);

    if (result.error) {
      setError(result.error);
    } else {
      onCreated();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.98, opacity: 0 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-[var(--surface-1)] border border-[var(--border-base)] r-modal overflow-hidden"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-base)]">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <Clipboard className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">
                New SWMS Template
              </h2>
              <p className="text-[11px] text-[var(--text-muted)]">
                Define hazards and control measures
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/[0.05] rounded-md transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="px-6 py-5 max-h-[60vh] overflow-y-auto space-y-5">
          {/* Template Info */}
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider mb-1.5 block">
                Template Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Working at Heights — Residential"
                className="w-full px-3 py-2 text-[13px] bg-[var(--surface-0)] border border-[var(--border-base)] r-input text-[var(--text-primary)] placeholder:text-zinc-600 focus-ring transition-all"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider mb-1.5 block">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of when this SWMS applies..."
                rows={2}
                className="w-full px-3 py-2 text-[13px] bg-[var(--surface-0)] border border-[var(--border-base)] r-input text-[var(--text-primary)] placeholder:text-zinc-600 focus-ring resize-none transition-all"
              />
            </div>
          </div>

          {/* Hazard Builder */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider">
                Hazards & Control Measures
              </label>
              <button
                onClick={addHazard}
                className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/15 rounded-md transition-all"
              >
                <Plus className="w-3 h-3" />
                Add Hazard
              </button>
            </div>

            <div className="space-y-3">
              {hazards.map((h, i) => (
                <HazardRow
                  key={i}
                  index={i}
                  hazard={h}
                  onUpdate={updateHazard}
                  onRemove={removeHazard}
                  canRemove={hazards.length > 1}
                />
              ))}
            </div>
          </div>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="flex items-center gap-2 px-3 py-2 text-[12px] text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg"
              >
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                {error}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--border-base)] bg-[var(--surface-0)]/50">
          <div className="text-[11px] text-[var(--text-muted)]">
            <span className="font-mono text-[var(--text-primary)]">
              {hazards.filter((h) => h.hazard.trim()).length}
            </span>{" "}
            hazard{hazards.filter((h) => h.hazard.trim()).length !== 1 ? "s" : ""} defined
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="stealth-btn-ghost text-xs"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving || !name.trim()}
              className="stealth-btn-primary text-xs flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  Create Template
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ── Hazard Row (inside modal) ───────────────────────── */

function HazardRow({
  index,
  hazard,
  onUpdate,
  onRemove,
  canRemove,
}: {
  index: number;
  hazard: HazardEntry;
  onUpdate: (i: number, field: keyof HazardEntry, value: string) => void;
  onRemove: (i: number) => void;
  canRemove: boolean;
}) {
  const riskStyle = RISK_STYLES[hazard.risk] || RISK_STYLES.MEDIUM;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: EASE_OUT_EXPO }}
      className="group relative border border-[var(--border-base)] bg-[var(--surface-0)] r-card p-3 space-y-2.5"
    >
      {/* Row header */}
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">
          Hazard #{index + 1}
        </span>
        {canRemove && (
          <button
            onClick={() => onRemove(index)}
            className="opacity-0 group-hover:opacity-100 p-1 text-[var(--text-muted)] hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition-all"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Hazard description */}
      <input
        type="text"
        value={hazard.hazard}
        onChange={(e) => onUpdate(index, "hazard", e.target.value)}
        placeholder="Describe the hazard..."
        className="w-full px-3 py-1.5 text-[12px] bg-transparent border border-[var(--border-base)] r-input text-[var(--text-primary)] placeholder:text-zinc-600 focus-ring transition-all"
      />

      {/* Risk + Control */}
      <div className="flex items-start gap-3">
        {/* Risk dropdown */}
        <div className="w-28 shrink-0">
          <label className="text-[9px] font-bold tracking-widest text-[var(--text-muted)] uppercase mb-1 block">
            Risk
          </label>
          <select
            value={hazard.risk}
            onChange={(e) => onUpdate(index, "risk", e.target.value)}
            className={`
              w-full px-2 py-1.5 text-[11px] font-semibold
              bg-transparent border r-input transition-all
              ${riskStyle.text} ${riskStyle.border}
            `}
          >
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="EXTREME">Extreme</option>
          </select>
        </div>

        {/* Control measure */}
        <div className="flex-1">
          <label className="text-[9px] font-bold tracking-widest text-[var(--text-muted)] uppercase mb-1 block">
            Control Measure
          </label>
          <input
            type="text"
            value={hazard.control}
            onChange={(e) => onUpdate(index, "control", e.target.value)}
            placeholder="How will this hazard be controlled?"
            className="w-full px-3 py-1.5 text-[12px] bg-transparent border border-[var(--border-base)] r-input text-[var(--text-primary)] placeholder:text-zinc-600 focus-ring transition-all"
          />
        </div>
      </div>
    </motion.div>
  );
}

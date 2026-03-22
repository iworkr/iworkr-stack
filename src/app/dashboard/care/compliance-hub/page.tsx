/**
 * @page /dashboard/care/compliance-hub
 * @status COMPLETE
 * @description NDIS/Care compliance hub — audit sessions, policy status, risk matrix, and corrective actions
 * @dataSource server-action: fetchAuditSessionsAction + zustand: useCareCommandStore
 * @lastAudit 2026-03-22
 */
"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  AlertTriangle,
  ShieldCheck,
  FileSearch,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronRight,
  X,
  ArrowUpRight,
  Plus,
  Zap,
  Lock,
  Search,
  Filter,
} from "lucide-react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useOrg } from "@/lib/hooks/use-org";
import {
  useCareCommandStore,
  SEVERITY_CONFIG,
  ALERT_TYPE_LABELS,
  type SentinelAlert,
  type CredentialAlert,
} from "@/lib/care-command-store";
import {
  acknowledgeSentinelAlertAction,
  fetchAuditSessionsAction,
  createAuditSessionAction,
} from "@/app/actions/care";

/* ═══════════════════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════════════════ */

type TabKey = "sentinel" | "credentials" | "audit";
type SeverityFilter = "all" | "critical" | "warning" | "info";
type ScopeType = "participant" | "organization" | "date_range";

interface AuditSession {
  id: string;
  organization_id: string;
  scope_type: ScopeType;
  scope_participant_id?: string | null;
  scope_date_from?: string | null;
  scope_date_to?: string | null;
  title?: string | null;
  generated_by: string;
  magic_link_token: string;
  expires_at: string;
  access_count: number;
  watermark_text?: string | null;
  status?: string;
  created_at: string;
}

/* ═══════════════════════════════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════════════════════════════ */

const TABS: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "sentinel", label: "Sentinel", icon: Shield },
  { key: "credentials", label: "Credentials", icon: ShieldCheck },
  { key: "audit", label: "Audit Trail", icon: FileSearch },
];

const CREDENTIAL_STATUS_CONFIG = {
  expired: { label: "Expired", color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/20" },
  expiring_7d: { label: "< 7 Days", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
  expiring_30d: { label: "< 30 Days", color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20" },
  valid: { label: "Valid", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
} as const;

const SCOPE_BADGES: Record<ScopeType, { label: string; color: string }> = {
  participant: { label: "Participant", color: "bg-emerald-500/10 text-emerald-400" },
  organization: { label: "Organization", color: "bg-violet-500/10 text-violet-400" },
  date_range: { label: "Date Range", color: "bg-amber-500/10 text-amber-400" },
};

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });

const fmtDateTime = (d: string) =>
  new Date(d).toLocaleDateString("en-AU", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });

function getCredentialStatus(daysRemaining: number) {
  if (daysRemaining <= 0) return "expired";
  if (daysRemaining <= 7) return "expiring_7d";
  if (daysRemaining <= 30) return "expiring_30d";
  return "valid";
}

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

/* ═══════════════════════════════════════════════════════════════════════════════
   Skeleton Components
   ═══════════════════════════════════════════════════════════════════════════════ */

function CardSkeleton() {
  return (
    <div
      className="r-card border border-white/[0.05] bg-white/[0.02] p-5 space-y-3"
      style={{ boxShadow: "var(--shadow-inset-bevel)" }}
    >
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

function TableRowSkeleton({ cols = 5 }: { cols?: number }) {
  return (
    <div className="flex items-center gap-4 px-5 py-4 border-b border-white/[0.04]">
      {Array.from({ length: cols }).map((_, i) => (
        <div key={i} className="flex-1">
          <div className={`h-3 rounded skeleton-shimmer ${i === 0 ? "w-36" : "w-16"}`} />
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   Stat Card
   ═══════════════════════════════════════════════════════════════════════════════ */

function StatCard({
  label,
  count,
  subtitle,
  color,
  delay,
  icon: Icon,
}: {
  label: string;
  count: number;
  subtitle?: string;
  color: string;
  delay: number;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: EASE_OUT_EXPO }}
      className="r-card border border-white/[0.06] bg-[var(--surface-1)] p-5"
      style={{ boxShadow: "var(--shadow-inset-bevel)" }}
    >
      <div className="flex items-center justify-between mb-1">
        <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
          {label}
        </p>
        {Icon && <Icon className={`w-3.5 h-3.5 ${color} opacity-50`} />}
      </div>
      <p className="font-mono text-[28px] font-semibold tracking-tighter tabular-nums text-white">
        {count}
      </p>
      {subtitle && (
        <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{subtitle}</p>
      )}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   Sentinel Alert Card
   ═══════════════════════════════════════════════════════════════════════════════ */

function SentinelAlertCard({
  alert,
  index,
  expanded,
  onToggle,
  onAction,
}: {
  alert: SentinelAlert;
  index: number;
  expanded: boolean;
  onToggle: () => void;
  onAction: (id: string, action: string, notes?: string) => Promise<void>;
}) {
  const config = SEVERITY_CONFIG[alert.severity];
  const isCritical = alert.severity === "critical";
  const isActive = alert.status === "active";
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [dismissNotes, setDismissNotes] = useState("");
  const [showDismissInput, setShowDismissInput] = useState(false);

  const handleAction = async (action: string, notes?: string) => {
    setActionLoading(action);
    try {
      await onAction(alert.id, action, notes);
    } finally {
      setActionLoading(null);
      setShowDismissInput(false);
      setDismissNotes("");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4, transition: { duration: 0.2 } }}
      transition={{ delay: index * 0.03, duration: 0.4, ease: EASE_OUT_EXPO }}
      className={`r-card mb-2 border bg-[var(--surface-1)] overflow-hidden transition-colors hover:border-white/[0.1] ${
        isCritical && isActive ? "border-rose-500/25" : "border-white/[0.06]"
      }`}
      style={{ boxShadow: "var(--shadow-inset-bevel)" }}
    >
      {/* Main Row */}
      <button
        onClick={onToggle}
        className="w-full text-left px-4 py-4 flex items-start gap-3"
      >
        {/* Severity dot */}
        <div className="flex flex-col items-center pt-1.5 flex-shrink-0">
          <div
            className={`w-2 h-2 rounded-full ${config?.dot ?? "bg-zinc-500"} ${
              isCritical && isActive ? "animate-pulse" : ""
            }`}
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide ${config?.bg} ${config?.color} border ${config?.border}`}
            >
              {ALERT_TYPE_LABELS[alert.alert_type] ?? alert.alert_type}
            </span>
            <span
              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${config?.bg} ${config?.color}`}
            >
              {config?.label}
            </span>
            {alert.status !== "active" && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider bg-white/[0.04] text-zinc-500">
                {alert.status}
              </span>
            )}
          </div>

          <h3 className="text-[14px] font-medium text-zinc-100 tracking-tight mb-1">
            {alert.title}
          </h3>
          <p className="text-[13px] text-zinc-500 leading-relaxed line-clamp-2">
            {alert.description}
          </p>

          {/* Triggered keywords */}
          {alert.triggered_keywords?.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap mt-2">
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

          {/* Metadata row */}
          <div className="flex items-center gap-3 flex-wrap text-[11px] text-zinc-600 mt-2">
            {alert.participant_id && (
              <span>
                Participant: <span className="text-zinc-400 font-mono">{alert.participant_id.slice(0, 8)}…</span>
              </span>
            )}
            {alert.worker_id && (
              <span>
                Worker: <span className="text-zinc-400 font-mono">{alert.worker_id.slice(0, 8)}…</span>
              </span>
            )}
            <span className="font-mono text-zinc-600">{fmtDateTime(alert.created_at)}</span>
          </div>
        </div>

        {/* Expand chevron */}
        <ChevronRight
          className={`w-4 h-4 text-zinc-600 flex-shrink-0 transition-transform duration-200 mt-1 ${
            expanded ? "rotate-90" : ""
          }`}
        />
      </button>

      {/* Expanded Detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE_OUT_EXPO }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-2 border-t border-white/[0.04] ml-[23px]">
              {/* Full description */}
              <div className="mb-4">
                <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1">
                  Full Description
                </p>
                <p className="text-[13px] text-zinc-400 leading-relaxed">
                  {alert.description}
                </p>
              </div>

              {/* Source info grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                {alert.source_table && (
                  <div>
                    <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-0.5">Source</p>
                    <p className="text-[12px] text-zinc-400 font-mono">{alert.source_table}</p>
                  </div>
                )}
                {alert.source_id && (
                  <div>
                    <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-0.5">Record ID</p>
                    <p className="text-[12px] text-zinc-400 font-mono">{alert.source_id.slice(0, 12)}…</p>
                  </div>
                )}
                {alert.shift_id && (
                  <div>
                    <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-0.5">Shift</p>
                    <p className="text-[12px] text-zinc-400 font-mono">{alert.shift_id.slice(0, 12)}…</p>
                  </div>
                )}
                <div>
                  <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-0.5">Status</p>
                  <p className={`text-[12px] font-medium ${config?.color ?? "text-zinc-400"}`}>{alert.status}</p>
                </div>
              </div>

              {/* Resolution notes */}
              {alert.resolution_notes && (
                <div className="mb-4 p-3 r-card bg-white/[0.02] border border-white/[0.05]">
                  <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1">Resolution</p>
                  <p className="text-[12px] text-zinc-400">{alert.resolution_notes}</p>
                  {alert.resolved_at && (
                    <p className="text-[10px] text-[var(--text-muted)] font-mono mt-1">Resolved: {fmtDateTime(alert.resolved_at)}</p>
                  )}
                </div>
              )}

              {/* Action buttons row */}
              {isActive && (
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => handleAction("acknowledged")}
                    disabled={actionLoading !== null}
                    className="inline-flex items-center gap-1.5 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08] rounded-lg px-3 py-1.5 text-[11px] font-medium transition-colors disabled:opacity-40"
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    {actionLoading === "acknowledged" ? "Acknowledging…" : "Acknowledge"}
                  </button>

                  <button
                    onClick={() => handleAction("escalated_to_clinical")}
                    disabled={actionLoading !== null}
                    className="inline-flex items-center gap-1.5 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08] rounded-lg px-3 py-1.5 text-[11px] font-medium transition-colors disabled:opacity-40"
                  >
                    <ArrowUpRight className="w-3 h-3" />
                    {actionLoading === "escalated_to_clinical" ? "Escalating…" : "Escalate"}
                  </button>

                  {!showDismissInput ? (
                    <button
                      onClick={() => setShowDismissInput(true)}
                      disabled={actionLoading !== null}
                      className="inline-flex items-center gap-1.5 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08] rounded-lg px-3 py-1.5 text-[11px] font-medium transition-colors disabled:opacity-40"
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
                        value={dismissNotes}
                        onChange={(e) => setDismissNotes(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && dismissNotes.trim()) {
                            handleAction("dismissed_false_positive", dismissNotes);
                          }
                          if (e.key === "Escape") {
                            setShowDismissInput(false);
                            setDismissNotes("");
                          }
                        }}
                        placeholder="Reason for dismissal…"
                        className="w-48 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[13px] text-white outline-none focus:border-white/[0.15] placeholder:text-zinc-700"
                      />
                      <button
                        onClick={() => dismissNotes.trim() && handleAction("dismissed_false_positive", dismissNotes)}
                        disabled={!dismissNotes.trim() || actionLoading !== null}
                        className="p-1.5 rounded-lg bg-white/[0.06] text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-40"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => { setShowDismissInput(false); setDismissNotes(""); }}
                        className="p-1.5 text-zinc-600 hover:text-zinc-400 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </motion.div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   Credential Row
   ═══════════════════════════════════════════════════════════════════════════════ */

function CredentialRow({ cred, index }: { cred: CredentialAlert; index: number }) {
  const status = getCredentialStatus(cred.days_until_expiry);
  const statusConfig = CREDENTIAL_STATUS_CONFIG[status];

  return (
    <motion.div
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.025, duration: 0.3, ease: EASE_OUT_EXPO }}
      className="grid grid-cols-[1fr_140px_120px_80px_100px] gap-4 px-5 items-center border-b border-white/[0.03] last:border-b-0 hover:bg-white/[0.02] transition-colors"
      style={{ height: 48 }}
    >
      {/* Worker name */}
      <div className="min-w-0">
        <p className="text-[13px] text-zinc-200 font-medium truncate">{cred.worker_name}</p>
      </div>

      {/* Credential type */}
      <p className="text-[12px] text-zinc-400 truncate">{cred.credential_type}</p>

      {/* Expiry date */}
      <p className="text-[12px] text-zinc-500 font-mono">{fmtDate(cred.expires_at)}</p>

      {/* Days remaining */}
      <p className={`text-[12px] font-mono font-semibold tabular-nums ${statusConfig.color}`}>
        {cred.days_until_expiry <= 0 ? "Expired" : `${cred.days_until_expiry}d`}
      </p>

      {/* Status pill */}
      <span
        className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wide ${statusConfig.bg} ${statusConfig.color} border ${statusConfig.border}`}
      >
        {statusConfig.label}
      </span>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   Audit Session Row
   ═══════════════════════════════════════════════════════════════════════════════ */

function AuditRow({ session, index }: { session: AuditSession; index: number }) {
  const expired = new Date(session.expires_at) < new Date();
  const scope = SCOPE_BADGES[session.scope_type];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: index * 0.02 }}
      className={`grid grid-cols-[1fr_100px_120px_100px_60px_80px] gap-4 px-5 items-center border-b border-white/[0.03] last:border-b-0 hover:bg-white/[0.02] transition-colors ${
        expired ? "opacity-50" : ""
      }`}
      style={{ height: 48 }}
    >
      <div className="min-w-0">
        <p className="text-[13px] text-zinc-200 truncate font-medium">{session.title || "Untitled Session"}</p>
      </div>
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${scope.color}`}>
        {scope.label}
      </span>
      <span className="text-[12px] text-zinc-500 font-mono">{fmtDate(session.created_at)}</span>
      <span className={`text-[12px] font-mono ${expired ? "text-rose-400" : "text-zinc-500"}`}>
        {expired ? "Expired" : fmtDate(session.expires_at)}
      </span>
      <span className="text-[12px] font-mono text-zinc-500 text-center tabular-nums">{session.access_count}</span>
      <div className="flex items-center justify-end gap-1">
        <button
          className="p-1.5 rounded-md hover:bg-white/[0.04] text-zinc-600 hover:text-zinc-300 transition-colors"
          title="View link"
        >
          <Eye className="w-3.5 h-3.5" />
        </button>
        {!expired && (
          <button
            className="p-1.5 rounded-md hover:bg-white/[0.04] text-zinc-600 hover:text-zinc-300 transition-colors"
            title="Copy link"
          >
            <Lock className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   Empty States
   ═══════════════════════════════════════════════════════════════════════════════ */

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-14 h-14 rounded-full bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-4">
        <Icon className="w-5 h-5 text-zinc-600" />
      </div>
      <h3 className="text-sm font-semibold text-zinc-300 mb-1">{title}</h3>
      <p className="text-[13px] text-[var(--text-muted)] max-w-xs">{description}</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   Create Audit Modal
   ═══════════════════════════════════════════════════════════════════════════════ */

function CreateAuditModal({
  open,
  onClose,
  onSubmit,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { scope_type: ScopeType; title: string; participant_id?: string; date_from?: string; date_to?: string }) => void;
  loading: boolean;
}) {
  const [scope, setScope] = useState<ScopeType>("organization");
  const [title, setTitle] = useState("");
  const [participantId, setParticipantId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const handleSubmit = () => {
    onSubmit({
      scope_type: scope,
      title: title || `Audit — ${scope} — ${new Date().toLocaleDateString("en-AU")}`,
      participant_id: scope === "participant" ? participantId : undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
    });
  };

  if (!open) return null;

  const inputClass = "w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[13px] text-white outline-none focus:border-white/[0.15] placeholder:text-zinc-700 transition-colors";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        >
          {/* Backdrop click */}
          <div className="absolute inset-0" onClick={onClose} />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.25, ease: EASE_OUT_EXPO }}
            className="relative w-full max-w-[420px] rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#141414] p-6 shadow-[0_24px_48px_rgba(0,0,0,0.4)]"
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-0.5">
                  NEW SESSION
                </p>
                <h2 className="text-base font-semibold text-zinc-100 tracking-tight">
                  Generate Audit Dossier
                </h2>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-white/[0.04] text-zinc-600 hover:text-zinc-300 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Title */}
              <div>
                <label className="block font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1.5">
                  Title
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Q1 Compliance Review"
                  className={inputClass}
                />
              </div>

              {/* Scope */}
              <div>
                <label className="block font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1.5">
                  Scope
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["participant", "organization", "date_range"] as ScopeType[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => setScope(s)}
                      className={`px-3 py-2 rounded-lg text-[11px] font-medium border transition-colors ${
                        scope === s
                          ? "bg-white/[0.06] text-white border-white/[0.12]"
                          : "bg-white/[0.02] text-zinc-500 border-white/[0.06] hover:border-white/[0.1]"
                      }`}
                    >
                      {SCOPE_BADGES[s].label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Participant ID (conditional) */}
              {scope === "participant" && (
                <div>
                  <label className="block font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1.5">
                    Participant ID
                  </label>
                  <input
                    value={participantId}
                    onChange={(e) => setParticipantId(e.target.value)}
                    placeholder="Enter participant ID…"
                    className={inputClass}
                  />
                </div>
              )}

              {/* Date range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1.5">
                    From
                  </label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1.5">
                    To
                  </label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Submit */}
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleSubmit}
                disabled={loading || (scope === "participant" && !participantId.trim())}
                className="w-full inline-flex items-center justify-center gap-2 bg-white text-black hover:bg-zinc-200 rounded-lg px-4 py-2 text-[13px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    Generating…
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5" />
                    Generate Dossier
                  </>
                )}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   Main Page Component
   ═══════════════════════════════════════════════════════════════════════════════ */

export default function ComplianceHubPage() {
  const { orgId } = useOrg();

  // ── Global state ─────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabKey>("sentinel");
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  // ── Store state ──────────────────────────────────────────────────────────
  const alerts = useCareCommandStore((s) => s.alerts);
  const alertsLoading = useCareCommandStore((s) => s.alertsLoading);
  const fetchAlerts = useCareCommandStore((s) => s.fetchAlerts);
  const credentialAlerts = useCareCommandStore((s) => s.credentialAlerts);
  const snapshot = useCareCommandStore((s) => s.snapshot);
  const fetchSnapshot = useCareCommandStore((s) => s.fetchSnapshot);

  // ── Sentinel state ───────────────────────────────────────────────────────
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [expandedAlertId, setExpandedAlertId] = useState<string | null>(null);

  // ── Audit state ──────────────────────────────────────────────────────────
  const [auditSessions, setAuditSessions] = useState<AuditSession[]>([]);
  const [auditLoading, setAuditLoading] = useState(true);
  const [showCreateAudit, setShowCreateAudit] = useState(false);
  const [auditCreating, setAuditCreating] = useState(false);

  // ── Data loading ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!orgId) return;
    fetchAlerts(orgId);
    fetchSnapshot(orgId);
  }, [orgId, fetchAlerts, fetchSnapshot]);

  const loadAuditSessions = useCallback(async () => {
    if (!orgId) return;
    setAuditLoading(true);
    try {
      const data = await fetchAuditSessionsAction(orgId);
      setAuditSessions((data as AuditSession[]) ?? []);
    } catch (err) {
      console.error("Failed to load audit sessions:", err);
      setError("Failed to load audit sessions.");
    } finally {
      setAuditLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    if (activeTab === "audit") {
      loadAuditSessions();
    }
  }, [activeTab, loadAuditSessions]);

  // ── Sentinel alert actions ───────────────────────────────────────────────
  const handleAlertAction = useCallback(
    async (id: string, action: string, notes?: string) => {
      if (!orgId) return;
      try {
        await acknowledgeSentinelAlertAction(id, action, notes);
        await fetchAlerts(orgId);
      } catch (err) {
        console.error("Alert action failed:", err);
        setError("Failed to update alert.");
        setTimeout(() => setError(null), 3000);
      }
    },
    [orgId, fetchAlerts],
  );

  // ── Audit creation ──────────────────────────────────────────────────────
  const handleCreateAudit = useCallback(
    async (data: { scope_type: ScopeType; title: string; participant_id?: string; date_from?: string; date_to?: string }) => {
      if (!orgId) return;
      setAuditCreating(true);
      try {
        await createAuditSessionAction({
          organization_id: orgId,
          scope_type: data.scope_type,
          scope_participant_id: data.participant_id,
          scope_date_from: data.date_from,
          scope_date_to: data.date_to,
          title: data.title,
        });
        setShowCreateAudit(false);
        await loadAuditSessions();
      } catch (err) {
        console.error("Failed to create audit session:", err);
        setError("Failed to create audit session.");
        setTimeout(() => setError(null), 3000);
      } finally {
        setAuditCreating(false);
      }
    },
    [orgId, loadAuditSessions],
  );

  // ── Computed values ──────────────────────────────────────────────────────
  const sentinelStats = useMemo(() => {
    const active = alerts.filter((a) => a.status === "active");
    return {
      critical: active.filter((a) => a.severity === "critical").length,
      warnings: active.filter((a) => a.severity === "warning").length,
      total: active.length,
    };
  }, [alerts]);

  const filteredAlerts = useMemo(() => {
    let list = alerts.filter((a) => a.status === "active" || a.status === "acknowledged" || a.status === "escalated");

    if (severityFilter !== "all") {
      list = list.filter((a) => a.severity === severityFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q) ||
          (ALERT_TYPE_LABELS[a.alert_type] ?? "").toLowerCase().includes(q) ||
          a.triggered_keywords?.some((kw) => kw.toLowerCase().includes(q)),
      );
    }

    return list;
  }, [alerts, severityFilter, searchQuery]);

  const credentialStats = useMemo(() => {
    const expiring = credentialAlerts.filter((c) => c.days_until_expiry > 0 && c.days_until_expiry <= 30).length;
    const expired = credentialAlerts.filter((c) => c.days_until_expiry <= 0).length;
    return { expiring, expired };
  }, [credentialAlerts]);

  const filteredCredentials = useMemo(() => {
    let list = [...credentialAlerts].sort((a, b) => a.days_until_expiry - b.days_until_expiry);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (c) =>
          c.worker_name.toLowerCase().includes(q) ||
          c.credential_type.toLowerCase().includes(q),
      );
    }

    return list;
  }, [credentialAlerts, searchQuery]);

  const snapshotCredentials = snapshot?.credentials;

  // ── Tab counts for badges ────────────────────────────────────────────────
  const tabCounts: Record<TabKey, number> = {
    sentinel: sentinelStats.critical,
    credentials: credentialStats.expired || (snapshotCredentials?.expired ?? 0),
    audit: 0,
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full flex-col bg-[var(--background)]">
      {/* Noise overlay */}
      <div className="stealth-noise" />

      {/* Atmospheric glow */}
      <div
        className="pointer-events-none absolute top-0 left-0 right-0 h-64"
        style={{
          background: "radial-gradient(ellipse at center top, rgba(255,255,255,0.015) 0%, transparent 60%)",
        }}
      />

      {/* ── Sticky Header ──────────────────────────────────────── */}
      <div className="sticky top-0 z-20 border-b border-white/[0.04] bg-zinc-950/80 backdrop-blur-xl">
        <div className="flex items-center justify-between px-5 py-2.5">
          <span className="font-mono text-[10px] font-bold tracking-widest text-[var(--text-muted)] uppercase">
            COMPLIANCE & GOVERNANCE
          </span>

          {/* Stealth search */}
          {activeTab !== "audit" && (
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search ${activeTab === "sentinel" ? "alerts" : "credentials"}…`}
                className="w-52 pl-8 pr-3 py-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] text-[12px] text-zinc-300 placeholder:text-zinc-700 outline-none focus:border-white/[0.15] transition-colors"
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Tab Bar ─────────────────────────────────────────── */}
      <div className="flex items-center gap-1 border-b border-white/[0.06] bg-[var(--surface-1)] px-5 py-1">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const Icon = tab.icon;
          const count = tabCounts[tab.key];
          return (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
                setSearchQuery("");
              }}
              className={`relative rounded-md px-3 py-1.5 text-[12px] transition-colors duration-150 ${
                isActive ? "font-medium text-white" : "text-[var(--text-muted)] hover:text-zinc-300"
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="compliance-tab-pill"
                  className="absolute inset-0 rounded-md bg-white/[0.06]"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative flex items-center gap-1.5">
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
                {count > 0 && (
                  <span className="font-mono text-[10px] text-[var(--text-muted)]">{count}</span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Scrollable Content ─────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto scrollbar-none">
        <div className="px-5 py-5 space-y-5">
          {/* ── Error Toast ─────────────────────────────────────── */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="flex items-center gap-2 px-4 py-3 r-card bg-rose-500/10 border border-rose-500/20 text-[13px] text-rose-400"
              >
                <XCircle className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1">{error}</span>
                <button onClick={() => setError(null)} className="p-0.5 hover:text-rose-300 transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Tab Content ─────────────────────────────────────── */}
          <AnimatePresence mode="wait">
            {/* ═══════ SENTINEL TAB ═══════ */}
            {activeTab === "sentinel" && (
              <motion.div
                key="sentinel"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25, ease: EASE_OUT_EXPO }}
                className="space-y-5"
              >
                {/* Summary stat cards — 3 cards */}
                <div className="grid grid-cols-3 gap-3">
                  <StatCard
                    label="Critical"
                    count={sentinelStats.critical}
                    subtitle="Requires immediate action"
                    color="text-rose-400"
                    delay={0.05}
                    icon={AlertTriangle}
                  />
                  <StatCard
                    label="Warnings"
                    count={sentinelStats.warnings}
                    subtitle="Review recommended"
                    color="text-amber-400"
                    delay={0.1}
                    icon={AlertTriangle}
                  />
                  <StatCard
                    label="Total Active"
                    count={sentinelStats.total}
                    subtitle="Across all severities"
                    color="text-zinc-300"
                    delay={0.15}
                    icon={Shield}
                  />
                </div>

                {/* Severity filter pills */}
                <div className="flex items-center gap-2">
                  <Filter className="w-3.5 h-3.5 text-zinc-600" />
                  {(["all", "critical", "warning", "info"] as SeverityFilter[]).map((severity) => {
                    const isFilterActive = severityFilter === severity;
                    return (
                      <button
                        key={severity}
                        onClick={() => setSeverityFilter(severity)}
                        className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                          isFilterActive
                            ? "bg-white/[0.06] text-white border-white/[0.12]"
                            : "bg-white/[0.02] text-zinc-500 border-white/[0.06] hover:border-white/[0.1]"
                        }`}
                      >
                        {severity === "all" ? "All Severities" : SEVERITY_CONFIG[severity]?.label ?? severity}
                      </button>
                    );
                  })}
                </div>

                {/* Alert list */}
                <div>
                  {alertsLoading && (
                    <div className="space-y-2">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <CardSkeleton key={i} />
                      ))}
                    </div>
                  )}

                  {!alertsLoading && filteredAlerts.length === 0 && (
                    <EmptyState
                      icon={Shield}
                      title="All clear"
                      description="No active sentinel alerts. Your organization is being continuously monitored."
                    />
                  )}

                  <AnimatePresence mode="popLayout">
                    {!alertsLoading &&
                      filteredAlerts.map((alert, idx) => (
                        <SentinelAlertCard
                          key={alert.id}
                          alert={alert}
                          index={idx}
                          expanded={expandedAlertId === alert.id}
                          onToggle={() =>
                            setExpandedAlertId((prev) => (prev === alert.id ? null : alert.id))
                          }
                          onAction={handleAlertAction}
                        />
                      ))}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}

            {/* ═══════ CREDENTIALS TAB ═══════ */}
            {activeTab === "credentials" && (
              <motion.div
                key="credentials"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25, ease: EASE_OUT_EXPO }}
                className="space-y-5"
              >
                {/* Credential stat cards */}
                <div className="grid grid-cols-2 gap-3">
                  <StatCard
                    label="Expiring in 30 Days"
                    count={credentialStats.expiring || (snapshotCredentials?.expiring_30d ?? 0)}
                    subtitle="Renewal required soon"
                    color="text-amber-400"
                    delay={0.05}
                    icon={Clock}
                  />
                  <StatCard
                    label="Expired"
                    count={credentialStats.expired || (snapshotCredentials?.expired ?? 0)}
                    subtitle="Non-compliant"
                    color="text-rose-400"
                    delay={0.1}
                    icon={XCircle}
                  />
                </div>

                {/* Credentials table */}
                <div
                  className="r-card border border-white/[0.06] bg-[var(--surface-1)] overflow-hidden"
                  style={{ boxShadow: "var(--shadow-inset-bevel)" }}
                >
                  {/* Table header */}
                  <div className="grid grid-cols-[1fr_140px_120px_80px_100px] gap-4 px-5 py-3 border-b border-white/[0.06]">
                    <span className="font-mono text-[10px] font-bold tracking-widest text-[var(--text-muted)] uppercase">Worker Name</span>
                    <span className="font-mono text-[10px] font-bold tracking-widest text-[var(--text-muted)] uppercase">Credential Type</span>
                    <span className="font-mono text-[10px] font-bold tracking-widest text-[var(--text-muted)] uppercase">Expires At</span>
                    <span className="font-mono text-[10px] font-bold tracking-widest text-[var(--text-muted)] uppercase">Days</span>
                    <span className="font-mono text-[10px] font-bold tracking-widest text-[var(--text-muted)] uppercase text-center">Status</span>
                  </div>

                  {/* Rows */}
                  {alertsLoading && filteredCredentials.length === 0 && (
                    <>
                      {Array.from({ length: 4 }).map((_, i) => (
                        <TableRowSkeleton key={i} />
                      ))}
                    </>
                  )}

                  {!alertsLoading && filteredCredentials.length === 0 && !snapshotCredentials && (
                    <EmptyState
                      icon={ShieldCheck}
                      title="All credentials current"
                      description="No expiring or expired credentials found. All team members are compliant."
                    />
                  )}

                  {filteredCredentials.map((cred, idx) => (
                    <CredentialRow key={cred.id} cred={cred} index={idx} />
                  ))}

                  {/* Snapshot fallback */}
                  {filteredCredentials.length === 0 && snapshotCredentials && (snapshotCredentials.expiring_30d > 0 || snapshotCredentials.expired > 0) && (
                    <div className="px-5 py-8 text-center">
                      <p className="text-[13px] text-zinc-500 mb-1">
                        {snapshotCredentials.expiring_30d + snapshotCredentials.expired} credential issues detected
                      </p>
                      <p className="text-[11px] text-[var(--text-muted)]">
                        {snapshotCredentials.expiring_30d} expiring within 30 days · {snapshotCredentials.expired} expired
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* ═══════ AUDIT TAB ═══════ */}
            {activeTab === "audit" && (
              <motion.div
                key="audit"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25, ease: EASE_OUT_EXPO }}
                className="space-y-5"
              >
                {/* Header row with CTA */}
                <div className="flex items-center justify-between">
                  <p className="text-[13px] text-zinc-500">
                    Generate compliance dossiers with secure magic-link access for auditors.
                  </p>
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowCreateAudit(true)}
                    className="inline-flex items-center gap-2 bg-white text-black hover:bg-zinc-200 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Generate Audit Dossier
                  </motion.button>
                </div>

                {/* Audit table */}
                <div
                  className="r-card border border-white/[0.06] bg-[var(--surface-1)] overflow-hidden"
                  style={{ boxShadow: "var(--shadow-inset-bevel)" }}
                >
                  {/* Table header */}
                  <div className="grid grid-cols-[1fr_100px_120px_100px_60px_80px] gap-4 px-5 py-3 border-b border-white/[0.06]">
                    <span className="font-mono text-[10px] font-bold tracking-widest text-[var(--text-muted)] uppercase">Title</span>
                    <span className="font-mono text-[10px] font-bold tracking-widest text-[var(--text-muted)] uppercase">Scope</span>
                    <span className="font-mono text-[10px] font-bold tracking-widest text-[var(--text-muted)] uppercase">Created</span>
                    <span className="font-mono text-[10px] font-bold tracking-widest text-[var(--text-muted)] uppercase">Status</span>
                    <span className="font-mono text-[10px] font-bold tracking-widest text-[var(--text-muted)] uppercase text-center">Views</span>
                    <span className="font-mono text-[10px] font-bold tracking-widest text-[var(--text-muted)] uppercase text-right">Actions</span>
                  </div>

                  {/* Loading skeletons */}
                  {auditLoading && auditSessions.length === 0 && (
                    <>
                      {Array.from({ length: 3 }).map((_, i) => (
                        <TableRowSkeleton key={i} cols={6} />
                      ))}
                    </>
                  )}

                  {/* Empty state */}
                  {!auditLoading && auditSessions.length === 0 && (
                    <EmptyState
                      icon={FileSearch}
                      title="No audit sessions yet"
                      description="Generate your first audit dossier to create a compliance record with secure magic-link access."
                    />
                  )}

                  {/* Rows */}
                  <AnimatePresence>
                    {auditSessions.map((session, idx) => (
                      <AuditRow key={session.id} session={session} index={idx} />
                    ))}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Status Bar ── */}
      <div className="flex items-center justify-between border-t border-white/[0.03] px-5 py-2 text-[11px] text-zinc-600">
        <div className="flex items-center gap-4">
          <span>{sentinelStats.total} alert{sentinelStats.total !== 1 ? "s" : ""}</span>
          <span>{credentialAlerts.length} credential{credentialAlerts.length !== 1 ? "s" : ""}</span>
          <span>{auditSessions.length} audit session{auditSessions.length !== 1 ? "s" : ""}</span>
        </div>
        <div className="flex items-center gap-4 text-zinc-700">
          <span>Tab to switch</span>
          <span>⌘K to search</span>
        </div>
      </div>

      {/* ── Create Audit Modal ──────────────────────────────── */}
      <CreateAuditModal
        open={showCreateAudit}
        onClose={() => setShowCreateAudit(false)}
        onSubmit={handleCreateAudit}
        loading={auditCreating}
      />
    </div>
  );
}

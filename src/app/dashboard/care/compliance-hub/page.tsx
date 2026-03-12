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
  Calendar,
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

/* ═══════════════════════════════════════════════════════════════════════════════
   Skeleton Components
   ═══════════════════════════════════════════════════════════════════════════════ */

function CardSkeleton() {
  return (
    <div className="r-card border border-white/[0.05] bg-white/[0.02] p-5 space-y-3 animate-pulse" style={{ boxShadow: "var(--shadow-inset-bevel)" }}>
      <div className="flex items-start gap-3">
        <div className="h-2.5 w-2.5 rounded-full bg-white/5 mt-1.5" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-2/3 rounded bg-white/5" />
          <div className="h-3 w-full rounded bg-white/5" />
        </div>
        <div className="h-5 w-20 rounded-full bg-white/5" />
      </div>
      <div className="flex items-center gap-2 pl-5">
        <div className="h-4 w-16 rounded bg-white/5" />
        <div className="h-4 w-24 rounded bg-white/5" />
      </div>
    </div>
  );
}

function TableRowSkeleton() {
  return (
    <div className="grid grid-cols-[1fr_100px_120px_100px_60px_80px] gap-4 px-5 py-4 border-b border-white/[0.05] animate-pulse">
      <div className="w-36 h-3 rounded bg-white/5" />
      <div className="w-16 h-4 rounded bg-white/5" />
      <div className="w-20 h-3 rounded bg-white/5" />
      <div className="w-24 h-3 rounded bg-white/5" />
      <div className="w-8 h-3 rounded bg-white/5" />
      <div className="w-16 h-6 rounded bg-white/5" />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   Summary Stat Card
   ═══════════════════════════════════════════════════════════════════════════════ */

function StatCard({
  label,
  count,
  color,
  delay,
  icon: Icon,
}: {
  label: string;
  count: number;
  color: string;
  delay: number;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="r-card border border-white/[0.06] bg-[var(--surface-1)] p-5"
      style={{ boxShadow: "var(--shadow-inset-bevel)" }}
    >
      <div className="flex items-center justify-between mb-1">
        <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
          {label}
        </p>
        {Icon && <Icon className={`w-3.5 h-3.5 ${color} opacity-50`} />}
      </div>
      <p className={`font-mono text-[28px] font-semibold tracking-tighter tabular-nums text-white`}>
        {count}
      </p>
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
      transition={{ delay: index * 0.03, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={`r-card border bg-[var(--surface-1)] overflow-hidden transition-colors hover:border-white/[0.1] ${
        isCritical && isActive
          ? "border-rose-500/25"
          : "border-white/[0.06]"
      }`}
      style={{ boxShadow: "var(--shadow-inset-bevel)" }}
    >
      {/* Main Row */}
      <button
        onClick={onToggle}
        className="w-full text-left px-5 py-4 flex items-start gap-3"
      >
        {/* Severity bar */}
        <div className="flex flex-col items-center pt-0.5 flex-shrink-0">
          <div
            className={`w-[3px] h-10 rounded-full ${config?.dot ?? "bg-zinc-500"} ${
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

          {/* Metadata */}
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
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 pt-2 border-t border-white/[0.04] ml-[15px]">
              {/* Full description */}
              <div className="mb-4">
                <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1">
                  Full Description
                </p>
                <p className="text-[13px] text-zinc-400 leading-relaxed">
                  {alert.description}
                </p>
              </div>

              {/* Source info */}
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

              {/* Resolution info */}
              {alert.resolution_notes && (
                <div className="mb-4 p-3 r-card bg-white/[0.02] border border-white/[0.05]">
                  <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1">Resolution</p>
                  <p className="text-[12px] text-zinc-400">{alert.resolution_notes}</p>
                  {alert.resolved_at && (
                    <p className="text-[10px] text-[var(--text-muted)] font-mono mt-1">Resolved: {fmtDateTime(alert.resolved_at)}</p>
                  )}
                </div>
              )}

              {/* Action buttons */}
              {isActive && (
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => handleAction("acknowledged")}
                    disabled={actionLoading !== null}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium bg-white/[0.04] text-zinc-300 border border-white/[0.08] hover:bg-white/[0.08] transition-colors disabled:opacity-40"
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    {actionLoading === "acknowledged" ? "Acknowledging…" : "Acknowledge"}
                  </button>

                  {!showDismissInput ? (
                    <button
                      onClick={() => setShowDismissInput(true)}
                      disabled={actionLoading !== null}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] transition-colors disabled:opacity-40"
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
                        className="w-48 px-2.5 py-1.5 r-input bg-white/[0.04] border border-white/[0.08] text-[12px] text-zinc-300 placeholder:text-zinc-600 outline-none focus:border-white/[0.15] transition-colors"
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

                  <button
                    onClick={() => handleAction("escalated_to_clinical")}
                    disabled={actionLoading !== null}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium border border-white/[0.08] text-zinc-400 hover:text-zinc-200 hover:border-white/[0.15] hover:bg-white/[0.04] transition-colors disabled:opacity-40"
                  >
                    <ArrowUpRight className="w-3 h-3" />
                    {actionLoading === "escalated_to_clinical" ? "Escalating…" : "Escalate"}
                  </button>

                  <button
                    onClick={() => handleAction("incident_created", "Incident created from Compliance Hub")}
                    disabled={actionLoading !== null}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 transition-colors disabled:opacity-40"
                  >
                    <AlertTriangle className="w-3 h-3" />
                    {actionLoading === "incident_created" ? "Creating…" : "Create Incident"}
                  </button>
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
      transition={{ delay: index * 0.025, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="grid grid-cols-[1fr_140px_120px_80px_100px] gap-4 px-5 py-3.5 items-center border-b border-white/[0.04] last:border-b-0 hover:bg-white/[0.015] transition-colors"
    >
      {/* Worker name */}
      <div className="min-w-0">
        <p className="text-[13px] text-zinc-200 font-medium truncate">{cred.worker_name}</p>
        <p className="text-[11px] text-[var(--text-muted)] font-mono mt-0.5">{cred.id.slice(0, 12)}…</p>
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
      className={`grid grid-cols-[1fr_100px_120px_100px_60px_80px] gap-4 px-5 py-4 items-center border-b border-white/[0.04] last:border-b-0 hover:bg-white/[0.015] transition-colors ${
        expired ? "opacity-50" : ""
      }`}
    >
      <div className="min-w-0">
        <p className="text-[13px] text-zinc-200 truncate font-medium">{session.title || "Untitled Session"}</p>
        <p className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5">{session.id.slice(0, 12)}…</p>
      </div>
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${scope.color}`}>
        {scope.label}
      </span>
      <span className="text-[12px] text-zinc-500">{fmtDate(session.created_at)}</span>
      <span className={`text-[12px] ${expired ? "text-rose-400" : "text-zinc-500"}`}>
        {expired ? "Expired" : fmtDate(session.expires_at)}
      </span>
      <span className="text-[12px] font-mono text-zinc-500 text-center">{session.access_count}</span>
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

function SentinelEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="relative mb-6">
        <div className="w-14 h-14 rounded-full bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
          <Shield className="w-5 h-5 text-zinc-600" />
        </div>
      </div>
      <h3 className="text-sm font-semibold text-zinc-300 mb-1">All clear</h3>
      <p className="text-[13px] text-[var(--text-muted)] max-w-xs">
        No active sentinel alerts. Your organization is being continuously monitored.
      </p>
    </div>
  );
}

function CredentialsEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-14 h-14 rounded-full bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-4">
        <ShieldCheck className="w-5 h-5 text-zinc-600" />
      </div>
      <h3 className="text-sm font-semibold text-zinc-300 mb-1">All credentials current</h3>
      <p className="text-[13px] text-[var(--text-muted)] max-w-xs">
        No expiring or expired credentials found. All team members are compliant.
      </p>
    </div>
  );
}

function AuditEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-14 h-14 rounded-full bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-4">
        <FileSearch className="w-5 h-5 text-zinc-600" />
      </div>
      <h3 className="text-sm font-semibold text-zinc-300 mb-1">No audit sessions yet</h3>
      <p className="text-[13px] text-[var(--text-muted)] max-w-xs">
        Generate your first audit dossier to create a compliance record with secure magic-link access.
      </p>
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

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-[420px] mx-4 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#141414] p-6 shadow-[0_24px_48px_rgba(0,0,0,0.4)]"
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
                  className="w-full px-3 py-2 r-input bg-white/[0.03] border border-white/[0.08] text-[13px] text-zinc-200 placeholder:text-zinc-700 outline-none focus:border-white/[0.15] transition-colors"
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
                          ? "bg-white/[0.06] text-white font-medium border-white/[0.12]"
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
                    className="w-full px-3 py-2 r-input bg-white/[0.03] border border-white/[0.08] text-[13px] text-zinc-200 placeholder:text-zinc-700 outline-none focus:border-white/[0.15] transition-colors"
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
                    className="w-full px-3 py-2 r-input bg-white/[0.03] border border-white/[0.08] text-[12px] text-zinc-300 outline-none focus:border-white/[0.15] transition-colors"
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
                    className="w-full px-3 py-2 r-input bg-white/[0.03] border border-white/[0.08] text-[12px] text-zinc-300 outline-none focus:border-white/[0.15] transition-colors"
                  />
                </div>
              </div>

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={loading || (scope === "participant" && !participantId.trim())}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-semibold bg-white text-black hover:bg-zinc-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
              </button>
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

  // ── Sentinel state ───────────────────────────────────────────────────────
  const alerts = useCareCommandStore((s) => s.alerts);
  const alertsLoading = useCareCommandStore((s) => s.alertsLoading);
  const fetchAlerts = useCareCommandStore((s) => s.fetchAlerts);
  const credentialAlerts = useCareCommandStore((s) => s.credentialAlerts);
  const snapshot = useCareCommandStore((s) => s.snapshot);
  const fetchSnapshot = useCareCommandStore((s) => s.fetchSnapshot);
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
    const resolved = alerts.filter((a) => a.status === "resolved" || a.status === "dismissed");
    return {
      critical: active.filter((a) => a.severity === "critical").length,
      warnings: active.filter((a) => a.severity === "warning").length,
      info: active.filter((a) => a.severity === "info").length,
      resolved: resolved.length,
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
    const verified = credentialAlerts.filter((c) => c.days_until_expiry > 30).length;
    const expiring = credentialAlerts.filter((c) => c.days_until_expiry > 0 && c.days_until_expiry <= 30).length;
    const expired = credentialAlerts.filter((c) => c.days_until_expiry <= 0).length;
    return { verified, expiring, expired };
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

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full flex-col bg-[var(--background)]">
      {/* Noise overlay */}
      <div className="stealth-noise" />

      {/* Atmospheric glow */}
      <div
        className="pointer-events-none absolute top-0 left-0 right-0 h-64"
        style={{
          background:
            "radial-gradient(ellipse at center top, rgba(255,255,255,0.015) 0%, transparent 60%)",
        }}
      />

      {/* ── Sticky Header ──────────────────────────────────────── */}
      <div className="sticky top-0 z-20 border-b border-white/[0.04] bg-zinc-950/80 backdrop-blur-xl">
        <div className="flex items-center justify-between px-5 py-2.5">
          <div>
            {/* Breadcrumbs */}
            <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] mb-0.5">
              <span>Dashboard</span>
              <ChevronRight className="w-3 h-3" />
              <span className="text-zinc-300">Compliance Hub</span>
            </div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
              COMPLIANCE HUB
            </p>
          </div>

          {/* Search input */}
          {activeTab !== "audit" && (
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search ${activeTab === "sentinel" ? "alerts" : "credentials"}…`}
                className="w-52 pl-8 pr-3 py-1.5 r-input bg-white/[0.03] border border-white/[0.06] text-[12px] text-zinc-300 placeholder:text-zinc-700 outline-none focus:border-white/[0.15] transition-colors"
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Tab Bar ─────────────────────────────────────────── */}
      <div className="flex items-center border-b border-white/[0.06] bg-[var(--surface-1)] px-5">
        <div className="flex items-center gap-1">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => {
                  setActiveTab(tab.key);
                  setSearchQuery("");
                }}
                className={`relative rounded-md px-3 py-1.5 text-[12px] transition-colors duration-150 ${
                  isActive
                    ? "font-medium text-white"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="compliance-tab-pill"
                    className="absolute inset-0 rounded-md bg-white/[0.06]"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative inline-flex items-center gap-2">
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}

                  {/* Active sentinel count badge */}
                  {tab.key === "sentinel" && sentinelStats.critical > 0 && (
                    <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-500/15 px-1 font-mono text-[10px] font-medium text-rose-400">
                      {sentinelStats.critical}
                    </span>
                  )}

                  {/* Credential alert count */}
                  {tab.key === "credentials" && (snapshotCredentials?.expired ?? 0) > 0 && (
                    <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-amber-500/15 px-1 font-mono text-[10px] font-medium text-amber-400">
                      {snapshotCredentials?.expired}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
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
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-5"
              >
                {/* Summary stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatCard
                    label="Critical"
                    count={sentinelStats.critical}
                    color="text-rose-400"
                    delay={0.05}
                    icon={AlertTriangle}
                  />
                  <StatCard
                    label="Warnings"
                    count={sentinelStats.warnings}
                    color="text-amber-400"
                    delay={0.1}
                    icon={AlertTriangle}
                  />
                  <StatCard
                    label="Info"
                    count={sentinelStats.info}
                    color="text-[var(--text-muted)]"
                    delay={0.15}
                    icon={Eye}
                  />
                  <StatCard
                    label="Resolved"
                    count={sentinelStats.resolved}
                    color="text-zinc-400"
                    delay={0.2}
                    icon={CheckCircle2}
                  />
                </div>

                {/* Severity filter chips */}
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
                            ? "bg-white/[0.06] text-white font-medium border-white/[0.12]"
                            : "bg-white/[0.02] text-zinc-500 border-white/[0.06] hover:border-white/[0.1]"
                        }`}
                      >
                        {severity === "all" ? "All Severities" : SEVERITY_CONFIG[severity]?.label ?? severity}
                      </button>
                    );
                  })}
                </div>

                {/* Alerts list */}
                <div className="space-y-2">
                  {alertsLoading && (
                    <div className="space-y-2">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <CardSkeleton key={i} />
                      ))}
                    </div>
                  )}

                  {!alertsLoading && filteredAlerts.length === 0 && <SentinelEmptyState />}

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
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-5"
              >
                {/* Credential stats bar */}
                <div className="grid grid-cols-3 gap-3">
                  <StatCard
                    label="Verified"
                    count={credentialStats.verified || (snapshotCredentials ? 0 : 0)}
                    color="text-emerald-400"
                    delay={0.05}
                    icon={ShieldCheck}
                  />
                  <StatCard
                    label="Expiring Soon"
                    count={credentialStats.expiring || (snapshotCredentials?.expiring_30d ?? 0)}
                    color="text-amber-400"
                    delay={0.1}
                    icon={Clock}
                  />
                  <StatCard
                    label="Expired"
                    count={credentialStats.expired || (snapshotCredentials?.expired ?? 0)}
                    color="text-rose-400"
                    delay={0.15}
                    icon={XCircle}
                  />
                </div>

                {/* Utilization bar */}
                {(credentialStats.verified + credentialStats.expiring + credentialStats.expired) > 0 && (
                  <motion.div
                    initial={{ opacity: 0, scaleX: 0.9 }}
                    animate={{ opacity: 1, scaleX: 1 }}
                    transition={{ delay: 0.2, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    className="r-card border border-white/[0.06] bg-[var(--surface-1)] p-4"
                    style={{ boxShadow: "var(--shadow-inset-bevel)" }}
                  >
                    <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-2">
                      Credential Compliance
                    </p>
                    <div className="flex h-2 rounded-full overflow-hidden bg-white/[0.03]">
                      {credentialStats.verified > 0 && (
                        <div
                          className="bg-emerald-500 transition-all duration-700"
                          style={{
                            width: `${(credentialStats.verified / (credentialStats.verified + credentialStats.expiring + credentialStats.expired)) * 100}%`,
                          }}
                        />
                      )}
                      {credentialStats.expiring > 0 && (
                        <div
                          className="bg-amber-500 transition-all duration-700"
                          style={{
                            width: `${(credentialStats.expiring / (credentialStats.verified + credentialStats.expiring + credentialStats.expired)) * 100}%`,
                          }}
                        />
                      )}
                      {credentialStats.expired > 0 && (
                        <div
                          className="bg-rose-500 transition-all duration-700"
                          style={{
                            width: `${(credentialStats.expired / (credentialStats.verified + credentialStats.expiring + credentialStats.expired)) * 100}%`,
                          }}
                        />
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-2">
                      <span className="inline-flex items-center gap-1.5 text-[10px] text-zinc-500">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" /> Verified
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-[10px] text-zinc-500">
                        <span className="w-2 h-2 rounded-full bg-amber-500" /> Expiring
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-[10px] text-zinc-500">
                        <span className="w-2 h-2 rounded-full bg-rose-500" /> Expired
                      </span>
                    </div>
                  </motion.div>
                )}

                {/* Credentials table */}
                <div className="r-card border border-white/[0.06] bg-[var(--surface-1)] overflow-hidden" style={{ boxShadow: "var(--shadow-inset-bevel)" }}>
                  {/* Table header */}
                  <div className="grid grid-cols-[1fr_140px_120px_80px_100px] gap-4 px-5 py-3 border-b border-white/[0.06] bg-[var(--surface-1)]">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Worker</span>
                    <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Type</span>
                    <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Expires</span>
                    <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Days</span>
                    <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] text-center">Status</span>
                  </div>

                  {/* Rows */}
                  {filteredCredentials.length === 0 && !alertsLoading && <CredentialsEmptyState />}
                  {filteredCredentials.map((cred, idx) => (
                    <CredentialRow key={cred.id} cred={cred} index={idx} />
                  ))}

                  {/* Show snapshot fallback if no credential alerts but snapshot has data */}
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

            {/* ═══════ AUDIT TRAIL TAB ═══════ */}
            {activeTab === "audit" && (
              <motion.div
                key="audit"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-5"
              >
                {/* Generate button + info row */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[13px] text-zinc-500">
                      Generate compliance dossiers with secure magic-link access for auditors.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowCreateAudit(true)}
                    className="inline-flex items-center gap-2 bg-white px-3 py-1.5 text-[12px] font-semibold text-black hover:bg-zinc-200 rounded-lg transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Generate Audit Dossier
                  </button>
                </div>

                {/* Summary cards */}
                <div className="grid grid-cols-3 gap-3">
                  <StatCard
                    label="Total Sessions"
                    count={auditSessions.length}
                    color="text-zinc-300"
                    delay={0.05}
                    icon={FileSearch}
                  />
                  <StatCard
                    label="Active Links"
                    count={auditSessions.filter((s) => new Date(s.expires_at) > new Date()).length}
                    color="text-emerald-400"
                    delay={0.1}
                    icon={Lock}
                  />
                  <StatCard
                    label="Total Views"
                    count={auditSessions.reduce((sum, s) => sum + s.access_count, 0)}
                    color="text-zinc-300"
                    delay={0.15}
                    icon={Eye}
                  />
                </div>

                {/* History table */}
                <div className="r-card border border-white/[0.06] bg-[var(--surface-1)] overflow-hidden" style={{ boxShadow: "var(--shadow-inset-bevel)" }}>
                  {/* Table header */}
                  <div className="grid grid-cols-[1fr_100px_120px_100px_60px_80px] gap-4 px-5 py-3 border-b border-white/[0.06] bg-[var(--surface-1)]">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Title</span>
                    <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Scope</span>
                    <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Generated</span>
                    <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Expires</span>
                    <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] text-center">Views</span>
                    <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] text-right">Actions</span>
                  </div>

                  {/* Loading skeletons */}
                  {auditLoading && auditSessions.length === 0 && (
                    <div>
                      {Array.from({ length: 3 }).map((_, i) => (
                        <TableRowSkeleton key={i} />
                      ))}
                    </div>
                  )}

                  {/* Empty state */}
                  {!auditLoading && auditSessions.length === 0 && <AuditEmptyState />}

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

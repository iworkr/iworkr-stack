"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldAlert,
  Brain,
  CheckCircle2,
  AlertTriangle,
  ArrowDown,
  RefreshCw,
  Search,
  ChevronDown,
  Eye,
  Loader2,
  ShieldCheck,
  XCircle,
  DollarSign,
  TrendingDown,
  Zap,
  User,
  Calendar,
  FileWarning,
} from "lucide-react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useOrg } from "@/lib/hooks/use-org";
import {
  getQuarantinedClaims,
  applyClaimFix,
  getTriageStats,
} from "@/app/actions/oracle-triage";

/* ── Types ────────────────────────────────────────────── */

interface ClaimPrediction {
  id: string;
  organization_id: string;
  invoice_id: string | null;
  timesheet_id: string | null;
  participant_id: string | null;
  worker_id: string | null;
  support_item_code: string | null;
  shift_date: string | null;
  claim_amount: number | null;
  confidence_score_success: number;
  confidence_score_reject: number;
  predicted_error_code: string | null;
  predicted_error_category: string | null;
  flagged_reason: string;
  ai_suggested_fix: string | null;
  ai_suggested_code: string | null;
  status: string;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_action: string | null;
  created_at: string;
  participant?: { id: string; preferred_name?: string; clients?: { name: string } | { name: string }[] } | null;
  worker?: { id: string; full_name?: string } | null;
}

interface TriageStats {
  quarantined: number;
  fixed: number;
  overridden: number;
  false_positives: number;
  total_saved_amount: number;
}

type FilterTab = "intercepted" | "fixed" | "overridden" | "all";

/* ── Error Code Translations ──────────────────────────── */

const ERROR_TRANSLATIONS: Record<string, { title: string; severity: "critical" | "high" | "medium" }> = {
  PACE_ERR_042: { title: "Worker Compliance Conflict", severity: "critical" },
  PACE_ERR_017: { title: "Temporal Day-Type Mismatch", severity: "high" },
  PACE_ERR_031: { title: "Budget Category Exhausted", severity: "critical" },
  PACE_ERR_055: { title: "Worker Ratio Violation", severity: "medium" },
};

const SEVERITY_COLORS = {
  critical: { bg: "bg-rose-500/10", text: "text-rose-400", border: "border-rose-500/20", ring: "ring-rose-500/30" },
  high: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20", ring: "ring-amber-500/30" },
  medium: { bg: "bg-sky-500/10", text: "text-sky-400", border: "border-sky-500/20", ring: "ring-sky-500/30" },
};

/* ── Helpers ──────────────────────────────────────────── */

function formatMoney(n: number): string {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(n);
}

function confidenceBar(reject: number) {
  const pct = Math.round(reject * 100);
  const color = pct >= 90 ? "bg-rose-500" : pct >= 70 ? "bg-amber-500" : "bg-sky-500";
  return { pct, color };
}

/* ── Main Component ──────────────────────────────────── */

export default function OracleTriagePage() {
  const { orgId } = useOrg();
  const [claims, setClaims] = useState<ClaimPrediction[]>([]);
  const [stats, setStats] = useState<TriageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<FilterTab>("intercepted");
  const [expanded, setExpanded] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);

    const statusMap: Record<FilterTab, string | undefined> = {
      intercepted: "INTERCEPTED",
      fixed: "FIXED_AND_RESUBMITTED",
      overridden: "OVERRIDDEN_BY_HUMAN",
      all: undefined,
    };

    const [claimsRes, statsRes] = await Promise.all([
      getQuarantinedClaims(orgId, { status: statusMap[tab] }),
      getTriageStats(orgId),
    ]);

    setClaims((claimsRes.data ?? []) as unknown as ClaimPrediction[]);
    setStats(statsRes.data as TriageStats | null);
    setLoading(false);
  }, [orgId, tab]);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = useMemo(() => {
    if (!search) return claims;
    const q = search.toLowerCase();
    return claims.filter((c) => {
      const pName = getParticipantName(c);
      const wName = c.worker?.full_name ?? "";
      return (
        pName.toLowerCase().includes(q) ||
        wName.toLowerCase().includes(q) ||
        (c.predicted_error_code ?? "").toLowerCase().includes(q) ||
        (c.support_item_code ?? "").toLowerCase().includes(q)
      );
    });
  }, [claims, search]);

  const handleAction = useCallback(async (id: string, action: "downgrade" | "override") => {
    if (!orgId) return;
    setActioning(id);
    await applyClaimFix(orgId, id, action);
    await loadData();
    setActioning(null);
    setExpanded(null);
  }, [orgId, loadData]);

  const tabs: { id: FilterTab; label: string; count?: number }[] = [
    { id: "intercepted", label: "Quarantined", count: stats?.quarantined },
    { id: "fixed", label: "Remediated", count: stats?.fixed },
    { id: "overridden", label: "Overridden", count: stats?.overridden },
    { id: "all", label: "All" },
  ];

  return (
    <div className="flex flex-col h-full bg-[#050505]">
      {/* ── Header ─────────────────────────────────────── */}
      <div className="shrink-0 border-b border-white/[0.06] px-6 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white tracking-tight">
                Oracle Triage — PRODA Shield
              </h1>
              <p className="text-xs text-zinc-500 mt-0.5">
                AI-predicted claim rejections intercepted before PACE submission
              </p>
            </div>
          </div>
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* ── Stat Cards ───────────────────────────────── */}
        {stats && (
          <div className="grid grid-cols-5 gap-3 mt-5">
            <StatCard
              icon={<ShieldAlert className="w-4 h-4 text-rose-400" />}
              label="Quarantined"
              value={stats.quarantined}
              color="rose"
            />
            <StatCard
              icon={<CheckCircle2 className="w-4 h-4 text-emerald-400" />}
              label="Remediated"
              value={stats.fixed}
              color="emerald"
            />
            <StatCard
              icon={<Eye className="w-4 h-4 text-amber-400" />}
              label="Overridden"
              value={stats.overridden}
              color="amber"
            />
            <StatCard
              icon={<XCircle className="w-4 h-4 text-sky-400" />}
              label="False Positives"
              value={stats.false_positives}
              color="sky"
            />
            <StatCard
              icon={<DollarSign className="w-4 h-4 text-emerald-400" />}
              label="Revenue Saved"
              value={formatMoney(stats.total_saved_amount)}
              color="emerald"
            />
          </div>
        )}

        {/* ── Tabs + Search ────────────────────────────── */}
        <div className="flex items-center justify-between mt-5">
          <div className="flex gap-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  tab === t.id
                    ? "bg-white/[0.08] text-white"
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]"
                }`}
              >
                {t.label}
                {t.count != null && (
                  <span className="ml-1.5 text-[10px] text-zinc-600">
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search claims..."
              className="w-56 pl-8 pr-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/40"
            />
          </div>
        </div>
      </div>

      {/* ── Claims List ────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-64 gap-2 text-zinc-500 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Scanning claims...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-zinc-500">
            <ShieldCheck className="w-10 h-10 mb-3 text-emerald-500/30" />
            <p className="text-sm font-medium text-zinc-400">All clear</p>
            <p className="text-xs mt-1">No quarantined claims found</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            <AnimatePresence mode="popLayout">
              {filtered.map((claim) => (
                <ClaimCard
                  key={claim.id}
                  claim={claim}
                  expanded={expanded === claim.id}
                  onToggle={() =>
                    setExpanded(expanded === claim.id ? null : claim.id)
                  }
                  onAction={handleAction}
                  actioning={actioning === claim.id}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Stat Card ───────────────────────────────────────── */

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <div className={`rounded-xl border border-white/[0.06] bg-white/[0.02] p-3`}>
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-6 h-6 rounded-md bg-${color}-500/10 flex items-center justify-center`}>
          {icon}
        </div>
        <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-medium">
          {label}
        </span>
      </div>
      <p className="text-xl font-semibold text-white tracking-tight">
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
    </div>
  );
}

/* ── Claim Card ──────────────────────────────────────── */

function getParticipantName(claim: ClaimPrediction): string {
  if (!claim.participant) return "Unknown Participant";
  const p = claim.participant;
  if (p.preferred_name) return p.preferred_name;
  if (p.clients) {
    const clients = Array.isArray(p.clients) ? p.clients[0] : p.clients;
    return clients?.name ?? "Unknown";
  }
  return "Unknown";
}

function ClaimCard({
  claim,
  expanded,
  onToggle,
  onAction,
  actioning,
}: {
  claim: ClaimPrediction;
  expanded: boolean;
  onToggle: () => void;
  onAction: (id: string, action: "downgrade" | "override") => void;
  actioning: boolean;
}) {
  const rejectPct = Math.round(claim.confidence_score_reject * 100);
  const errorInfo = ERROR_TRANSLATIONS[claim.predicted_error_code ?? ""];
  const severity = errorInfo?.severity ?? "medium";
  const colors = SEVERITY_COLORS[severity];
  const bar = confidenceBar(claim.confidence_score_reject);
  const participantName = getParticipantName(claim);
  const workerName = claim.worker?.full_name ?? "Unknown Worker";
  const isIntercepted = claim.status === "INTERCEPTED";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="px-6 py-4 hover:bg-white/[0.02] transition-colors"
    >
      {/* ── Row ────────────────────────────────── */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 text-left"
      >
        {/* Severity indicator */}
        <div className={`w-1.5 h-12 rounded-full ${colors.bg} shrink-0`} />

        {/* Confidence dial */}
        <div className="w-14 shrink-0 text-center">
          <span className={`text-lg font-bold ${rejectPct >= 90 ? "text-rose-400" : rejectPct >= 70 ? "text-amber-400" : "text-sky-400"}`}>
            {rejectPct}%
          </span>
          <p className="text-[9px] text-zinc-600 uppercase tracking-wider">Reject</p>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${colors.bg} ${colors.text}`}>
              {claim.predicted_error_code ?? "UNKNOWN"}
            </span>
            <span className="text-sm text-white font-medium truncate">
              {errorInfo?.title ?? claim.predicted_error_category ?? "Prediction Flag"}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-zinc-500">
            <span className="flex items-center gap-1">
              <User className="w-3 h-3" /> {participantName}
            </span>
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3" /> {workerName}
            </span>
            {claim.shift_date && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" /> {claim.shift_date}
              </span>
            )}
          </div>
        </div>

        {/* Amount */}
        <div className="text-right shrink-0">
          <p className="text-sm font-semibold text-white">
            {formatMoney(claim.claim_amount ?? 0)}
          </p>
          <p className="text-[10px] text-zinc-600 font-mono mt-0.5">
            {claim.support_item_code}
          </p>
        </div>

        {/* Status badge */}
        <div className="w-20 shrink-0 text-right">
          {claim.status === "INTERCEPTED" && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 font-medium">
              Quarantined
            </span>
          )}
          {claim.status === "FIXED_AND_RESUBMITTED" && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-medium">
              Fixed
            </span>
          )}
          {claim.status === "OVERRIDDEN_BY_HUMAN" && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-medium">
              Overridden
            </span>
          )}
        </div>

        <ChevronDown className={`w-4 h-4 text-zinc-600 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      {/* ── Expanded Detail ───────────────────── */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-4 ml-[4.5rem] space-y-4">
              {/* Confidence bar */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] uppercase tracking-widest text-zinc-500">
                    Rejection Confidence
                  </span>
                  <span className={`text-xs font-mono ${bar.pct >= 90 ? "text-rose-400" : bar.pct >= 70 ? "text-amber-400" : "text-sky-400"}`}>
                    {bar.pct}%
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${bar.color}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${bar.pct}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </div>

              {/* AI Explanation */}
              <div className={`rounded-xl border ${colors.border} ${colors.bg} p-4`}>
                <div className="flex items-start gap-3">
                  <Brain className={`w-5 h-5 ${colors.text} mt-0.5 shrink-0`} />
                  <div>
                    <p className="text-xs font-medium text-white mb-1.5">
                      Oracle Intelligence Analysis
                    </p>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      {claim.flagged_reason}
                    </p>
                  </div>
                </div>
              </div>

              {/* Suggested fix */}
              {claim.ai_suggested_fix && (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                  <div className="flex items-start gap-3">
                    <Zap className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-emerald-300 mb-1">
                        Suggested Fix
                      </p>
                      <p className="text-xs text-zinc-400">
                        {claim.ai_suggested_fix}
                      </p>
                      {claim.ai_suggested_code && (
                        <p className="text-[10px] font-mono text-emerald-400/60 mt-1">
                          Replacement code: {claim.ai_suggested_code}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              {isIntercepted && (
                <div className="flex items-center gap-3 pt-1">
                  {claim.ai_suggested_code && (
                    <button
                      onClick={() => onAction(claim.id, "downgrade")}
                      disabled={actioning}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-medium border border-emerald-500/20 transition-all disabled:opacity-50"
                    >
                      {actioning ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5" />
                      )}
                      Downgrade to {claim.ai_suggested_code}
                    </button>
                  )}
                  <button
                    onClick={() => onAction(claim.id, "override")}
                    disabled={actioning}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-zinc-400 hover:text-white text-xs font-medium border border-white/[0.06] transition-all disabled:opacity-50"
                  >
                    {actioning ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <FileWarning className="w-3.5 h-3.5" />
                    )}
                    Override AI &amp; Submit Anyway
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

"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Search,
  ShieldAlert,
  AlertTriangle,
  Info,
  Activity,
  Check,
  X,
  ArrowUpRight,
  Shield,
  Clock,
  ChevronRight,
} from "lucide-react";
import { useOrg } from "@/lib/hooks/use-org";
import { queryKeys } from "@/lib/hooks/use-query-keys";
import {
  fetchSentinelAlertsAction,
  acknowledgeSentinelAlertAction,
} from "@/app/actions/care";

/* ── Types ──────────────────────────────────────────────── */

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

/* ── Config ─────────────────────────────────────────────── */

const SEV: Record<SentinelSeverity, { label: string; color: string; bg: string; border: string; dot: string }> = {
  critical: { label: "Critical", color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/20", dot: "bg-rose-500" },
  warning: { label: "Warning", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", dot: "bg-amber-500" },
  info: { label: "Info", color: "text-sky-400", bg: "bg-sky-500/10", border: "border-sky-500/20", dot: "bg-sky-500" },
};

const TYPE_LABEL: Record<AlertType, string> = {
  progress_note_keywords: "Keyword Detection",
  health_baseline_deviation: "Health Deviation",
  medication_non_compliance: "Medication Non-Compliance",
  credential_expiry_escalation: "Credential Expiry",
  budget_overrun: "Budget Overrun",
  care_plan_review_due: "Care Plan Review Due",
  restrictive_practice_debrief_overdue: "Restrictive Practice Debrief",
};

const SEV_ICON: Record<SentinelSeverity, typeof ShieldAlert> = {
  critical: ShieldAlert,
  warning: AlertTriangle,
  info: Info,
};

type FilterTab = "active" | "acknowledged" | "escalated" | "all";
const TABS: { key: FilterTab; label: string }[] = [
  { key: "active", label: "Active" },
  { key: "acknowledged", label: "Acknowledged" },
  { key: "escalated", label: "Escalated" },
  { key: "all", label: "All" },
];

function resolutionStatusForAction(action: string): SentinelStatus {
  if (action === "dismissed_false_positive") return "dismissed";
  if (action === "incident_created") return "resolved";
  if (action === "escalated_to_clinical") return "escalated";
  return "acknowledged";
}

/* ── Main Page ──────────────────────────────────────────── */

export default function SentinelAlertsPage() {
  const { orgId } = useOrg();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<FilterTab>("active");
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => { const t = setTimeout(() => setDebouncedSearch(search), 250); return () => clearTimeout(t); }, [search]);

  const statusFilter = activeTab === "all" ? undefined : activeTab;
  const { data: alerts = [], isLoading: loading } = useQuery<SentinelAlert[]>({
    queryKey: queryKeys.care.sentinel(orgId ?? "", statusFilter),
    queryFn: () => fetchSentinelAlertsAction(orgId!, statusFilter),
    enabled: !!orgId,
    staleTime: 60_000,
  });

  /* ── Actions ───────────────────────────────────────── */
  type AckVariables = { id: string; action: string; notes?: string };
  const acknowledgeMutation = useMutation({
    mutationFn: (v: AckVariables) => acknowledgeSentinelAlertAction(v.id, v.action, v.notes),
    onMutate: async (variables) => {
      if (!orgId) return {};
      await queryClient.cancelQueries({ queryKey: ["care", "sentinel", orgId] });
      const previous = queryClient.getQueriesData<SentinelAlert[]>({ queryKey: ["care", "sentinel", orgId] });
      const status = resolutionStatusForAction(variables.action);
      const now = new Date().toISOString();
      queryClient.setQueriesData<SentinelAlert[]>({ queryKey: ["care", "sentinel", orgId] }, (old) => {
        if (!old) return old;
        return old.map((a) =>
          a.id === variables.id
            ? {
                ...a,
                status,
                resolution_action: variables.action,
                acknowledged_at: now,
                resolution_notes: variables.notes ?? a.resolution_notes,
                resolved_at:
                  status === "dismissed" || status === "resolved" ? now : a.resolved_at,
              }
            : a
        );
      });
      return { previous };
    },
    onError: (err, variables, context) => {
      console.error(`Failed to ${variables.action} alert:`, err);
      context?.previous?.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
    },
    onSettled: () => {
      setExpandedId(null);
      void queryClient.invalidateQueries({ queryKey: ["care", "sentinel"] });
    },
  });

  const handleAction = useCallback(
    (id: string, action: string, notes?: string) => {
      acknowledgeMutation.mutate({ id, action, notes });
    },
    [acknowledgeMutation]
  );

  const actionLoadingKey =
    acknowledgeMutation.isPending && acknowledgeMutation.variables
      ? `${acknowledgeMutation.variables.id}-${acknowledgeMutation.variables.action}`
      : null;

  /* ── Stats ─────────────────────────────────────────── */
  const stats = useMemo(() => {
    const active = alerts.filter((a) => a.status === "active");
    return {
      critical: active.filter((a) => a.severity === "critical").length,
      warnings: active.filter((a) => a.severity === "warning").length,
      info: active.filter((a) => a.severity === "info").length,
      total: active.length,
    };
  }, [alerts]);

  /* ── Filtered ──────────────────────────────────────── */
  const filtered = useMemo(() => {
    let result = activeTab === "all" ? alerts : alerts.filter((a) => a.status === activeTab);
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter((a) => a.title.toLowerCase().includes(q) || a.description.toLowerCase().includes(q) || TYPE_LABEL[a.alert_type].toLowerCase().includes(q));
    }
    return result;
  }, [alerts, activeTab, debouncedSearch]);

  const tabCounts = useMemo(() => {
    const c: Record<string, number> = { all: alerts.length };
    for (const a of alerts) c[a.status] = (c[a.status] || 0) + 1;
    return c;
  }, [alerts]);

  /* ── Keyboard ──────────────────────────────────────── */
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === "f") { e.preventDefault(); searchRef.current?.focus(); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  /* ── Render ────────────────────────────────────────── */
  return (
    <div className="relative flex h-full flex-col bg-[var(--background)]">
      <div className="stealth-noise" />
      <div
        className="pointer-events-none absolute top-0 left-0 right-0 h-64 z-0"
        style={{ background: "radial-gradient(ellipse at center top, rgba(255,255,255,0.015) 0%, transparent 60%)" }}
      />

      {/* ── Sticky Header ────────────────────────────────── */}
      <div className="sticky top-0 z-20 border-b border-white/[0.04] bg-zinc-950/80 backdrop-blur-xl">
        <div className="flex items-center justify-between px-5 py-2.5">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[10px] font-bold tracking-widest text-[var(--text-muted)] uppercase">
              SENTINEL INTELLIGENCE
            </span>
            <div className="ml-4 flex items-center gap-0.5">
              {TABS.map((tab) => {
                const isActive = activeTab === tab.key;
                const count = tabCounts[tab.key] || 0;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`relative flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors duration-150 ${
                      isActive ? "text-white" : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    <span className="relative">
                      {tab.label}
                      {isActive && (
                        <motion.div
                          layoutId="sentinel-tab-dot"
                          className="absolute -bottom-1.5 left-1/2 h-[3px] w-[3px] -translate-x-1/2 rounded-full bg-emerald-500"
                          transition={{ type: "spring", stiffness: 400, damping: 30 }}
                        />
                      )}
                    </span>
                    {count > 0 && (
                      <span className={`rounded-full px-1.5 py-0.5 text-[9px] ${
                        isActive ? "bg-white/[0.06] text-zinc-300" : "text-zinc-600"
                      }`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Search ────────────────────────────────── */}
          <div className="relative flex items-center gap-2">
            <motion.div
              className="absolute left-0 top-1 bottom-1 w-[2px] rounded-r bg-emerald-500"
              initial={false}
              animate={{ opacity: searchFocused ? 1 : 0, scaleY: searchFocused ? 1 : 0 }}
              transition={{ duration: 0.15 }}
            />
            <div className="flex items-center gap-2 pl-2">
              <Search size={12} className={`shrink-0 transition-colors duration-150 ${searchFocused ? "text-emerald-500" : "text-zinc-600"}`} />
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                placeholder="Search alerts…"
                className="w-48 bg-transparent text-[12px] text-zinc-300 outline-none placeholder:text-zinc-700"
              />
              {!searchFocused && !search && (
                <kbd className="flex items-center gap-0.5 rounded border border-white/[0.06] bg-white/[0.02] px-1 py-0.5 text-[9px] font-medium text-zinc-700">
                  <span className="text-[10px]">⌘</span>F
                </kbd>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Alert List ────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto scrollbar-none">
        {/* Skeleton loading */}
        {loading && alerts.length === 0 && Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-5 py-3.5 border-b border-white/[0.02] animate-pulse">
            <div className="h-2.5 w-2.5 rounded-full bg-zinc-800" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 w-2/5 bg-zinc-800 rounded" />
              <div className="h-3 w-3/4 bg-zinc-800/60 rounded" />
            </div>
            <div className="h-5 w-16 bg-zinc-800/40 rounded-full" />
          </div>
        ))}

        {/* Empty state */}
        {!loading && filtered.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="relative flex flex-col items-center justify-center py-24 text-center"
          >
            <div className="pointer-events-none absolute top-1/2 left-1/2 h-[200px] w-[200px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/[0.015] blur-[60px]" />
            <div className="relative mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/[0.04] bg-white/[0.02]">
              <Shield size={28} className="text-zinc-600" />
            </div>
            <h3 className="text-[15px] font-medium text-zinc-200">
              {debouncedSearch || activeTab !== "active" ? "No alerts match your filters" : "All clear"}
            </h3>
            <p className="mt-1.5 max-w-[320px] text-[12px] leading-relaxed text-zinc-600">
              {debouncedSearch || activeTab !== "active"
                ? "Try adjusting your search or tab filter."
                : "No active alerts. Sentinel is monitoring your organization."}
            </p>
          </motion.div>
        )}

        {/* Alert rows */}
        <AnimatePresence mode="popLayout">
          {!loading && filtered.map((alert, idx) => {
            const sev = SEV[alert.severity];
            const SevIcon = SEV_ICON[alert.severity];
            const isCritical = alert.severity === "critical" && alert.status === "active";
            const isExpanded = expandedId === alert.id;
            const isActive = alert.status === "active";

            return (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ delay: Math.min(idx * 0.015, 0.2), duration: 0.2 }}
                className={`group border-b border-white/[0.02] transition-colors duration-100 ${
                  isCritical ? "shadow-[0_0_12px_-2px_rgba(244,63,94,0.3)]" : ""
                }`}
              >
                {/* Row */}
                <button
                  onClick={() => isActive && setExpandedId(isExpanded ? null : alert.id)}
                  className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-white/[0.02]"
                >
                  {/* Severity dot */}
                  <div className={`h-2.5 w-2.5 shrink-0 rounded-full ${sev.dot}`} />

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium text-zinc-200 truncate group-hover:text-white transition-colors">
                        {alert.title}
                      </span>
                      <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${sev.bg} ${sev.color} border ${sev.border}`}>
                        <SevIcon size={9} />
                        {sev.label}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[12px] text-zinc-500 truncate">{alert.description}</p>
                  </div>

                  {/* Alert type label */}
                  <span className="hidden shrink-0 items-center gap-1 rounded bg-white/[0.04] border border-white/[0.06] px-2 py-0.5 text-[10px] text-zinc-400 sm:inline-flex">
                    {TYPE_LABEL[alert.alert_type]}
                  </span>

                  {/* Participant ref */}
                  {alert.participant_id && (
                    <span className="hidden shrink-0 font-mono text-[10px] text-zinc-600 lg:block">
                      {alert.participant_id.slice(0, 8)}
                    </span>
                  )}

                  {/* Timestamp */}
                  <div className="flex shrink-0 items-center gap-1 text-zinc-600">
                    <Clock size={10} />
                    <span className="font-mono text-[10px]">
                      {new Date(alert.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                    </span>
                  </div>

                  {isActive && (
                    <ChevronRight size={13} className={`shrink-0 text-zinc-700 transition-transform group-hover:text-zinc-400 ${isExpanded ? "rotate-90" : ""}`} />
                  )}

                  {!isActive && alert.resolution_action && (
                    <span className="shrink-0 rounded-full bg-white/[0.04] px-2 py-0.5 text-[9px] font-medium text-zinc-500 capitalize">
                      {alert.status}
                    </span>
                  )}
                </button>

                {/* ── Expanded Resolution Panel ───────── */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="mx-5 mb-3 rounded-xl border border-white/[0.06] bg-[#0A0A0A]/80 p-4 backdrop-blur-xl">
                        {/* Keywords for NLP alerts */}
                        {alert.alert_type === "progress_note_keywords" && alert.triggered_keywords?.length > 0 && (
                          <div className="mb-3 flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] text-zinc-600 font-medium">Triggered keywords:</span>
                            {alert.triggered_keywords.map((kw) => (
                              <span key={kw} className="rounded-full bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 text-[10px] font-medium text-rose-400">
                                {kw}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase mb-2">
                          Resolution Actions
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => handleAction(alert.id, "acknowledged")}
                            disabled={actionLoadingKey !== null}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-40"
                          >
                            <Check size={12} />
                            {actionLoadingKey === `${alert.id}-acknowledged` ? "Saving…" : "Acknowledge"}
                          </button>
                          <button
                            onClick={() => handleAction(alert.id, "escalated_to_clinical")}
                            disabled={actionLoadingKey !== null}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 text-[12px] font-medium text-zinc-300 transition-colors hover:bg-white/[0.06] hover:border-white/[0.12] disabled:opacity-40"
                          >
                            <ArrowUpRight size={12} />
                            {actionLoadingKey === `${alert.id}-escalated_to_clinical` ? "Escalating…" : "Escalate to Clinical"}
                          </button>
                          <button
                            onClick={() => handleAction(alert.id, "incident_created", "Incident created from Sentinel alert")}
                            disabled={actionLoadingKey !== null}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-1.5 text-[12px] font-medium text-zinc-300 transition-colors hover:bg-white/[0.06] hover:border-white/[0.12] disabled:opacity-40"
                          >
                            <ShieldAlert size={12} />
                            {actionLoadingKey === `${alert.id}-incident_created` ? "Creating…" : "Create Incident"}
                          </button>
                          <button
                            onClick={() => handleAction(alert.id, "dismissed_false_positive", "Dismissed as false positive")}
                            disabled={actionLoadingKey !== null}
                            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium text-zinc-500 transition-colors hover:bg-white/[0.04] hover:text-zinc-300 disabled:opacity-40"
                          >
                            <X size={12} />
                            {actionLoadingKey === `${alert.id}-dismissed_false_positive` ? "Dismissing…" : "Dismiss as False Positive"}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* ── Footer ────────────────────────────────────────── */}
      {!loading && filtered.length > 0 && (
        <div className="border-t border-white/[0.03] px-5 py-2 flex items-center justify-between">
          <div className="flex items-center gap-4 text-[10px] font-mono text-zinc-600">
            <div className="flex items-center gap-1.5">
              <Activity size={10} />
              <span>{filtered.length} alerts</span>
            </div>
            <div className="w-px h-3 bg-zinc-800" />
            <div className="flex items-center gap-1.5">
              <ShieldAlert size={10} className="text-rose-500/50" />
              <span>{stats.critical} critical</span>
            </div>
            <div className="w-px h-3 bg-zinc-800" />
            <div className="flex items-center gap-1.5">
              <AlertTriangle size={10} className="text-amber-500/50" />
              <span>{stats.warnings} warnings</span>
            </div>
            <div className="w-px h-3 bg-zinc-800" />
            <div className="flex items-center gap-1.5">
              <Info size={10} className="text-sky-500/50" />
              <span>{stats.info} info</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-700">
            <span>↑↓ Navigate</span>
            <span className="text-zinc-800">·</span>
            <span>⌘F Search</span>
          </div>
        </div>
      )}
    </div>
  );
}

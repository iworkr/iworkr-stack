/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useMemo, useCallback, useEffect } from "react";
import {
  Search,
  Plus,
  Lightbulb,
  BookOpen,
  Users,
  ChevronRight,
  Check,
  X,
  Clock,
  AlertTriangle,
  Shield,
  FileText,
  Calendar,
  Loader2,
  Target,
} from "lucide-react";
import { useOrg } from "@/lib/hooks/use-org";
import {
  fetchCIActionsAction,
  createCIActionAction,
  fetchPoliciesAction,
  createPolicyAction,
  fetchGovernanceMeetingsAction,
  createGovernanceMeetingAction,
} from "@/app/actions/care-governance";

/* ── Types ─────────────────────────────────────────────── */

interface CIAction {
  id: string;
  title: string;
  source_type: "incident" | "audit" | "complaint" | "risk_review";
  source_id: string;
  status: "open" | "in_progress" | "completed" | "verified";
  owner_name: string;
  due_date: string;
  created_at: string;
  description: string;
  evidence_count: number;
}

interface Policy {
  id: string;
  title: string;
  version: string;
  category: "clinical" | "hr" | "governance" | "safety" | "operational";
  status: "current" | "under_review" | "archived";
  last_updated: string;
  acknowledgement_stats: { total: number; acknowledged: number };
}

interface GovernanceEntry {
  id: string;
  title: string;
  meeting_date: string;
  attendees_count: number;
  decisions_count: number;
  actions_generated: number;
  status: "draft" | "final";
}

type TabKey = "ci_actions" | "policy_register" | "governance_log";

/* ── Config ────────────────────────────────────────────── */

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: "ci_actions", label: "CI Actions", icon: Target },
  { key: "policy_register", label: "Policy Register", icon: BookOpen },
  { key: "governance_log", label: "Governance Log", icon: Users },
];

const ciStatusConfig: Record<
  CIAction["status"],
  { label: string; dot: string; text: string; bg: string }
> = {
  open: { label: "Open", dot: "bg-amber-400", text: "text-amber-400", bg: "bg-amber-500/15" },
  in_progress: { label: "In Progress", dot: "bg-sky-400", text: "text-sky-400", bg: "bg-sky-500/15" },
  completed: { label: "Completed", dot: "bg-emerald-400", text: "text-emerald-400", bg: "bg-emerald-500/15" },
  verified: { label: "Verified", dot: "bg-emerald-400", text: "text-emerald-400", bg: "bg-emerald-500/15" },
};

const sourceConfig: Record<CIAction["source_type"], { label: string; icon: React.ElementType; color: string }> = {
  incident: { label: "Incident", icon: AlertTriangle, color: "text-rose-400" },
  audit: { label: "Audit", icon: Shield, color: "text-sky-400" },
  complaint: { label: "Complaint", icon: FileText, color: "text-amber-400" },
  risk_review: { label: "Risk Review", icon: Target, color: "text-violet-400" },
};

const policyStatusConfig: Record<
  Policy["status"],
  { label: string; dot: string; text: string; bg: string }
> = {
  current: { label: "Current", dot: "bg-emerald-400", text: "text-emerald-400", bg: "bg-emerald-500/15" },
  under_review: { label: "Under Review", dot: "bg-amber-400", text: "text-amber-400", bg: "bg-amber-500/15" },
  archived: { label: "Archived", dot: "bg-zinc-500", text: "text-zinc-500", bg: "bg-zinc-500/15" },
};

const categoryColors: Record<Policy["category"], string> = {
  clinical: "text-sky-400 bg-sky-500/10",
  hr: "text-violet-400 bg-violet-500/10",
  governance: "text-amber-400 bg-amber-500/10",
  safety: "text-rose-400 bg-rose-500/10",
  operational: "text-zinc-400 bg-zinc-500/10",
};

/* ── Helpers ────────────────────────────────────────────── */

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

function isDueOverdue(d: string): boolean {
  return new Date(d) < new Date();
}

/** Map raw DB row to CIAction UI shape */
function mapCIAction(row: any): CIAction {
  return {
    id: row.id,
    title: row.title ?? "Untitled Action",
    source_type: row.source_type ?? "incident",
    source_id: row.source_id ?? row.source_reference ?? "—",
    status: row.status ?? "open",
    owner_name: row.owner_name ?? row.profiles?.full_name ?? "—",
    due_date: row.due_date ?? row.created_at,
    created_at: row.created_at,
    description: row.description ?? "",
    evidence_count: row.evidence_count ?? 0,
  };
}

/** Map raw DB row to Policy UI shape */
function mapPolicy(row: any): Policy {
  return {
    id: row.id,
    title: row.title ?? "Untitled Policy",
    version: row.version ?? "1.0",
    category: row.category ?? "operational",
    status: row.status ?? "current",
    last_updated: row.updated_at ?? row.created_at,
    acknowledgement_stats: {
      total: row.acknowledgement_total ?? 0,
      acknowledged: row.acknowledgement_count ?? 0,
    },
  };
}

/** Map raw DB row to GovernanceEntry UI shape */
function mapGovernance(row: any): GovernanceEntry {
  return {
    id: row.id,
    title: row.title ?? "Untitled Meeting",
    meeting_date: row.meeting_date ?? row.created_at,
    attendees_count: Array.isArray(row.attendees) ? row.attendees.length : row.attendees_count ?? 0,
    decisions_count: row.decisions_count ?? 0,
    actions_generated: row.actions_generated ?? 0,
    status: row.status ?? "draft",
  };
}

/* ── Main Page ─────────────────────────────────────────── */

export default function QualityPage() {
  const { orgId } = useOrg();
  const [activeTab, setActiveTab] = useState<TabKey>("ci_actions");
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  /* ── Data State ───────────────────────────────────────── */
  const [ciActions, setCIActions] = useState<CIAction[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [governance, setGovernance] = useState<GovernanceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* ── CI Action Create Form State ─────────────────────── */
  const [newAction, setNewAction] = useState({
    title: "",
    source_type: "incident" as CIAction["source_type"],
    description: "",
    owner: "",
    due_date: "",
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  /* ── Data Loading ─────────────────────────────────────── */
  const loadData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);

    try {
      const [ciData, policyData, govData] = await Promise.all([
        fetchCIActionsAction(orgId),
        fetchPoliciesAction(orgId),
        fetchGovernanceMeetingsAction(orgId),
      ]);

      setCIActions((ciData || []).map(mapCIAction));
      setPolicies((policyData || []).map(mapPolicy));
      setGovernance((govData || []).map(mapGovernance));
    } catch (e: any) {
      console.error("[quality] Failed to load data:", e);
      setError("Failed to load data. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { loadData(); }, [loadData]);

  /* ── Filtered Data ───────────────────────────────────── */
  const filteredCI = useMemo(() => {
    if (!search) return ciActions;
    const q = search.toLowerCase();
    return ciActions.filter(
      (a) => a.title.toLowerCase().includes(q) || a.owner_name.toLowerCase().includes(q) || a.source_id.toLowerCase().includes(q)
    );
  }, [search, ciActions]);

  const filteredPolicies = useMemo(() => {
    if (!search) return policies;
    const q = search.toLowerCase();
    return policies.filter(
      (p) => p.title.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)
    );
  }, [search, policies]);

  const filteredGovernance = useMemo(() => {
    if (!search) return governance;
    const q = search.toLowerCase();
    return governance.filter((g) => g.title.toLowerCase().includes(q));
  }, [search, governance]);

  const handleCreateAction = useCallback(async () => {
    if (!orgId) return;
    setSaving(true);
    setSaveError(null);

    try {
      await createCIActionAction({
        organization_id: orgId,
        title: newAction.title,
        source_type: newAction.source_type,
        description: newAction.description || undefined,
        owner_name: newAction.owner || undefined,
        due_date: newAction.due_date || undefined,
      });
      setCreateOpen(false);
      setNewAction({ title: "", source_type: "incident", description: "", owner: "", due_date: "" });
      loadData();
    } catch (e: any) {
      console.error("[quality] createCIAction failed:", e);
      setSaveError(e.message || "Failed to create CI action. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [orgId, newAction, loadData]);

  /* ── Render ──────────────────────────────────────────── */
  return (
    <div className="relative flex h-full flex-col bg-[var(--background)]">
      <div className="stealth-noise" />
      <div
        className="pointer-events-none absolute top-0 left-0 right-0 h-64 z-0"
        style={{ background: "radial-gradient(ellipse at center top, rgba(255,255,255,0.015) 0%, transparent 60%)" }}
      />

      {/* ── Command Bar ────────────────────────────────── */}
      <div className="sticky top-0 z-20 border-b border-white/[0.04] bg-zinc-950/80 backdrop-blur-xl">
        <div className="flex items-center justify-between px-5 py-2.5">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[10px] font-bold tracking-widest text-[var(--text-muted)] uppercase">
              Quality &amp; Improvement
            </span>

            <div className="ml-4 flex items-center gap-0.5">
              {TABS.map((tab) => {
                const isActive = activeTab === tab.key;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`relative flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-medium transition-colors duration-150 ${
                      isActive ? "text-white" : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    <Icon size={11} />
                    <span className="relative">
                      {tab.label}
                      {isActive && (
                        <motion.div
                          layoutId="quality-tab-dot"
                          className="absolute -bottom-1.5 left-1/2 h-[3px] w-[3px] -translate-x-1/2 rounded-full bg-emerald-500"
                          transition={{ type: "spring", stiffness: 400, damping: 30 }}
                        />
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Search */}
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
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                  placeholder="Search…"
                  className="w-40 bg-transparent text-[12px] text-zinc-300 outline-none placeholder:text-zinc-700"
                />
              </div>
            </div>

            {activeTab === "ci_actions" && (
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => setCreateOpen(true)}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium text-white shadow-none transition-all duration-200 bg-emerald-600 hover:bg-emerald-500"
              >
                <Plus size={12} />
                New CI Action
              </motion.button>
            )}
          </div>
        </div>
      </div>

      {/* ── Loading State ────────────────────────────────── */}
      {loading && (
        <div className="flex flex-1 items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={24} className="animate-spin text-zinc-600" />
            <span className="text-[12px] text-zinc-600">Loading quality data…</span>
          </div>
        </div>
      )}

      {/* ── Error State ──────────────────────────────────── */}
      {!loading && error && (
        <div className="flex flex-1 items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-500/10 border border-rose-500/20">
              <AlertTriangle size={20} className="text-rose-400" />
            </div>
            <h3 className="text-[15px] font-medium text-zinc-200">{error}</h3>
            <button onClick={loadData} className="mt-2 rounded-lg px-4 py-1.5 text-[12px] font-medium text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/10 transition-colors">
              Retry
            </button>
          </div>
        </div>
      )}

      {/* ── Tab Content ────────────────────────────────── */}
      {!loading && !error && (
        <div className="flex-1 overflow-y-auto scrollbar-none">
          <AnimatePresence mode="wait">
            {activeTab === "ci_actions" && (
              <motion.div
                key="ci_actions"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                {/* Column Headers */}
                <div className="flex items-center border-b border-white/[0.03] bg-[var(--surface-1)] px-5 py-2">
                  <div className="min-w-0 flex-1 px-2 font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Title</div>
                  <div className="w-28 px-2 font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Source</div>
                  <div className="w-28 px-2 font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Owner</div>
                  <div className="w-24 px-2 font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Status</div>
                  <div className="w-28 px-2 font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Due Date</div>
                  <div className="w-20 px-2 font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase text-right">Evidence</div>
                  <div className="w-8" />
                </div>

                {filteredCI.length === 0 ? (
                  <EmptyState icon={Target} message="No CI actions found" sub={search ? "Try adjusting your search criteria." : "Create your first CI action to get started."} />
                ) : (
                  filteredCI.map((action, idx) => {
                    const sc = ciStatusConfig[action.status] ?? ciStatusConfig.open;
                    const src = sourceConfig[action.source_type] ?? sourceConfig.incident;
                    const SrcIcon = src.icon;
                    const overdue = (action.status === "open" || action.status === "in_progress") && isDueOverdue(action.due_date);

                    return (
                      <motion.div
                        key={action.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: Math.min(idx * 0.02, 0.15), duration: 0.2 }}
                        className="group flex items-center px-5 py-2.5 border-b border-white/[0.02] cursor-pointer hover:bg-white/[0.02] transition-colors duration-100"
                      >
                        <div className="min-w-0 flex-1 px-2 flex items-center gap-2">
                          <Lightbulb size={12} className="shrink-0 text-zinc-600" />
                          <span className="text-sm font-medium text-zinc-200 truncate group-hover:text-white transition-colors">
                            {action.title}
                          </span>
                        </div>
                        <div className="w-28 px-2 flex items-center gap-1.5">
                          <SrcIcon size={10} className={src.color} />
                          <span className="text-[11px] text-zinc-500">{action.source_id}</span>
                        </div>
                        <div className="w-28 px-2">
                          <span className="text-xs text-zinc-400 truncate block">{action.owner_name}</span>
                        </div>
                        <div className="w-24 px-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full ${sc.bg} ${sc.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                            {sc.label}
                          </span>
                        </div>
                        <div className="w-28 px-2">
                          <span className={`text-xs font-mono ${overdue ? "text-rose-400" : "text-zinc-500"}`}>
                            {overdue && <Clock size={9} className="inline mr-1 -mt-px" />}
                            {formatDate(action.due_date)}
                          </span>
                        </div>
                        <div className="w-20 px-2 text-right">
                          {action.evidence_count > 0 ? (
                            <span className="text-[11px] font-mono text-zinc-500">
                              {action.evidence_count} file{action.evidence_count !== 1 ? "s" : ""}
                            </span>
                          ) : (
                            <span className="text-[11px] text-zinc-700">—</span>
                          )}
                        </div>
                        <div className="w-8 flex justify-end">
                          <ChevronRight size={13} className="text-zinc-700 group-hover:text-zinc-400 transition-colors" />
                        </div>
                      </motion.div>
                    );
                  })
                )}

                {/* Summary bar */}
                {filteredCI.length > 0 && (
                  <div className="flex items-center gap-6 border-t border-white/[0.02] bg-white/[0.01] px-7 py-2.5">
                    <StatBadge label="Total" value={filteredCI.length} />
                    <div className="h-3 w-px bg-white/[0.04]" />
                    <StatBadge label="Open" value={filteredCI.filter((a) => a.status === "open").length} color="text-amber-500" />
                    <div className="h-3 w-px bg-white/[0.04]" />
                    <StatBadge label="In Progress" value={filteredCI.filter((a) => a.status === "in_progress").length} color="text-sky-500" />
                    <div className="h-3 w-px bg-white/[0.04]" />
                    <StatBadge label="Completed" value={filteredCI.filter((a) => a.status === "completed" || a.status === "verified").length} color="text-emerald-500" />
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === "policy_register" && (
              <motion.div
                key="policy_register"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <div className="flex items-center border-b border-white/[0.03] bg-[var(--surface-1)] px-5 py-2">
                  <div className="min-w-0 flex-1 px-2 font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Policy</div>
                  <div className="w-24 px-2 font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Category</div>
                  <div className="w-16 px-2 font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Version</div>
                  <div className="w-28 px-2 font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Status</div>
                  <div className="w-40 px-2 font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Acknowledged</div>
                  <div className="w-28 px-2 font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase text-right">Last Updated</div>
                  <div className="w-8" />
                </div>

                {filteredPolicies.length === 0 ? (
                  <EmptyState icon={BookOpen} message="No policies found" sub={search ? "Try adjusting your search criteria." : "Add your first policy to get started."} />
                ) : (
                  filteredPolicies.map((policy, idx) => {
                    const sc = policyStatusConfig[policy.status] ?? policyStatusConfig.current;
                    const hasAck = policy.acknowledgement_stats.total > 0;
                    const ackPct = hasAck ? Math.round((policy.acknowledgement_stats.acknowledged / policy.acknowledgement_stats.total) * 100) : 0;
                    const catClass = categoryColors[policy.category] ?? categoryColors.operational;

                    return (
                      <motion.div
                        key={policy.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: Math.min(idx * 0.02, 0.15), duration: 0.2 }}
                        className="group flex items-center px-5 py-2.5 border-b border-white/[0.02] cursor-pointer hover:bg-white/[0.02] transition-colors duration-100"
                      >
                        <div className="min-w-0 flex-1 px-2 flex items-center gap-2">
                          <FileText size={12} className="shrink-0 text-zinc-600" />
                          <span className="text-sm font-medium text-zinc-200 truncate group-hover:text-white transition-colors">
                            {policy.title}
                          </span>
                        </div>
                        <div className="w-24 px-2">
                          <span className={`inline-flex px-2 py-0.5 text-[10px] font-medium rounded-md capitalize ${catClass}`}>
                            {policy.category}
                          </span>
                        </div>
                        <div className="w-16 px-2">
                          <span className="text-xs font-mono text-zinc-500">v{policy.version}</span>
                        </div>
                        <div className="w-28 px-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full ${sc.bg} ${sc.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                            {sc.label}
                          </span>
                        </div>
                        <div className="w-40 px-2 flex items-center gap-2">
                          {hasAck ? (
                            <>
                              <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    ackPct === 100 ? "bg-emerald-500" : ackPct > 60 ? "bg-amber-500" : "bg-rose-500"
                                  }`}
                                  style={{ width: `${ackPct}%` }}
                                />
                              </div>
                              <span className="text-[10px] font-mono text-zinc-500 w-14 text-right shrink-0">
                                {policy.acknowledgement_stats.acknowledged}/{policy.acknowledgement_stats.total}
                              </span>
                            </>
                          ) : (
                            <span className="text-[10px] text-zinc-700">—</span>
                          )}
                        </div>
                        <div className="w-28 px-2 text-right">
                          <span className="text-xs font-mono text-zinc-500">{formatDate(policy.last_updated)}</span>
                        </div>
                        <div className="w-8 flex justify-end">
                          <ChevronRight size={13} className="text-zinc-700 group-hover:text-zinc-400 transition-colors" />
                        </div>
                      </motion.div>
                    );
                  })
                )}

                {filteredPolicies.length > 0 && (
                  <div className="flex items-center gap-6 border-t border-white/[0.02] bg-white/[0.01] px-7 py-2.5">
                    <StatBadge label="Policies" value={filteredPolicies.length} />
                    <div className="h-3 w-px bg-white/[0.04]" />
                    <StatBadge label="Current" value={filteredPolicies.filter((p) => p.status === "current").length} color="text-emerald-500" />
                    <div className="h-3 w-px bg-white/[0.04]" />
                    <StatBadge label="Under Review" value={filteredPolicies.filter((p) => p.status === "under_review").length} color="text-amber-500" />
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === "governance_log" && (
              <motion.div
                key="governance_log"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <div className="flex items-center border-b border-white/[0.03] bg-[var(--surface-1)] px-5 py-2">
                  <div className="min-w-0 flex-1 px-2 font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Meeting</div>
                  <div className="w-28 px-2 font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Date</div>
                  <div className="w-24 px-2 font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase text-center">Attendees</div>
                  <div className="w-24 px-2 font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase text-center">Decisions</div>
                  <div className="w-24 px-2 font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase text-center">Actions</div>
                  <div className="w-24 px-2 font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">Status</div>
                  <div className="w-8" />
                </div>

                {filteredGovernance.length === 0 ? (
                  <EmptyState icon={Users} message="No governance records found" sub={search ? "Try adjusting your search criteria." : "Schedule your first governance meeting."} />
                ) : (
                  filteredGovernance.map((entry, idx) => {
                    const isDraft = entry.status === "draft";
                    return (
                      <motion.div
                        key={entry.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: Math.min(idx * 0.02, 0.15), duration: 0.2 }}
                        className="group flex items-center px-5 py-2.5 border-b border-white/[0.02] cursor-pointer hover:bg-white/[0.02] transition-colors duration-100"
                      >
                        <div className="min-w-0 flex-1 px-2 flex items-center gap-2">
                          <Calendar size={12} className="shrink-0 text-zinc-600" />
                          <span className="text-sm font-medium text-zinc-200 truncate group-hover:text-white transition-colors">
                            {entry.title}
                          </span>
                        </div>
                        <div className="w-28 px-2">
                          <span className="text-xs font-mono text-zinc-500">{formatDate(entry.meeting_date)}</span>
                        </div>
                        <div className="w-24 px-2 text-center">
                          <span className="inline-flex items-center gap-1 text-[11px] text-zinc-400">
                            <Users size={10} className="text-zinc-600" />
                            {entry.attendees_count}
                          </span>
                        </div>
                        <div className="w-24 px-2 text-center">
                          <span className="text-[11px] font-mono text-zinc-400">{entry.decisions_count}</span>
                        </div>
                        <div className="w-24 px-2 text-center">
                          <span className="text-[11px] font-mono text-emerald-500/80">{entry.actions_generated}</span>
                        </div>
                        <div className="w-24 px-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full ${
                            isDraft ? "bg-amber-500/15 text-amber-400" : "bg-emerald-500/15 text-emerald-400"
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isDraft ? "bg-amber-400" : "bg-emerald-400"}`} />
                            {isDraft ? "Draft" : "Final"}
                          </span>
                        </div>
                        <div className="w-8 flex justify-end">
                          <ChevronRight size={13} className="text-zinc-700 group-hover:text-zinc-400 transition-colors" />
                        </div>
                      </motion.div>
                    );
                  })
                )}

                {filteredGovernance.length > 0 && (
                  <div className="flex items-center gap-6 border-t border-white/[0.02] bg-white/[0.01] px-7 py-2.5">
                    <StatBadge label="Meetings" value={filteredGovernance.length} />
                    <div className="h-3 w-px bg-white/[0.04]" />
                    <StatBadge label="Total Decisions" value={filteredGovernance.reduce((s, g) => s + g.decisions_count, 0)} color="text-zinc-400" />
                    <div className="h-3 w-px bg-white/[0.04]" />
                    <StatBadge label="Actions Generated" value={filteredGovernance.reduce((s, g) => s + g.actions_generated, 0)} color="text-emerald-500" />
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── Footer ─────────────────────────────────────── */}
      <div className="border-t border-white/[0.03] px-5 py-2 flex items-center justify-between">
        <div className="flex items-center gap-4 text-[10px] font-mono text-zinc-600">
          <div className="flex items-center gap-1.5">
            <Target size={10} className="text-emerald-500/50" />
            <span>{ciActions.length} CI actions</span>
          </div>
          <div className="w-px h-3 bg-zinc-800" />
          <div className="flex items-center gap-1.5">
            <BookOpen size={10} className="text-sky-500/50" />
            <span>{policies.length} policies</span>
          </div>
          <div className="w-px h-3 bg-zinc-800" />
          <div className="flex items-center gap-1.5">
            <Shield size={10} className="text-amber-500/50" />
            <span>{governance.length} governance records</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-700">
          <span>Tab to switch</span>
          <span className="text-zinc-800">·</span>
          <span>⌘K to search</span>
        </div>
      </div>

      {/* ── Create CI Action Modal ─────────────────────── */}
      <AnimatePresence>
        {createOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setCreateOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-[#0A0A0A]/95 backdrop-blur-xl border border-white/[0.06] rounded-2xl p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-5">
                <div>
                  <span className="font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">New CI Action</span>
                  <h2 className="mt-1 text-[15px] font-medium text-zinc-200">Create Continuous Improvement Action</h2>
                </div>
                <button
                  onClick={() => setCreateOpen(false)}
                  className="rounded-lg p-1.5 text-zinc-600 hover:text-zinc-400 hover:bg-white/[0.04] transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {saveError && (
                <div className="mb-4 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-400">
                  {saveError}
                </div>
              )}

              <div className="space-y-4">
                {/* Title */}
                <div>
                  <label className="mb-1.5 block text-[10px] font-bold tracking-widest text-zinc-600 uppercase">Title</label>
                  <input
                    value={newAction.title}
                    onChange={(e) => setNewAction((s) => ({ ...s, title: e.target.value }))}
                    placeholder="e.g. Update medication administration checklist"
                    className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[13px] text-zinc-200 outline-none placeholder:text-zinc-700 focus:border-emerald-500/40 transition-colors"
                  />
                </div>

                {/* Source Type */}
                <div>
                  <label className="mb-1.5 block text-[10px] font-bold tracking-widest text-zinc-600 uppercase">Source Type</label>
                  <div className="flex gap-2">
                    {(["incident", "audit", "complaint", "risk_review"] as const).map((st) => {
                      const cfg = sourceConfig[st];
                      const active = newAction.source_type === st;
                      return (
                        <button key={st} onClick={() => setNewAction((s) => ({ ...s, source_type: st }))} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium border transition-colors ${active ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-white/[0.04] text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-300"}`}>
                          <cfg.icon size={11} />{cfg.label}
                        </button>);
                    })}
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="mb-1.5 block text-[10px] font-bold tracking-widest text-zinc-600 uppercase">Description</label>
                  <textarea
                    value={newAction.description}
                    onChange={(e) => setNewAction((s) => ({ ...s, description: e.target.value }))}
                    placeholder="Describe what needs to be done and why…"
                    rows={3}
                    className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[13px] text-zinc-200 outline-none placeholder:text-zinc-700 focus:border-emerald-500/40 resize-none transition-colors"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-[10px] font-bold tracking-widest text-zinc-600 uppercase">Owner</label>
                    <input value={newAction.owner} onChange={(e) => setNewAction((s) => ({ ...s, owner: e.target.value }))} placeholder="Staff name" className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[13px] text-zinc-200 outline-none placeholder:text-zinc-700 focus:border-emerald-500/40 transition-colors" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[10px] font-bold tracking-widest text-zinc-600 uppercase">Due Date</label>
                    <input type="date" value={newAction.due_date} onChange={(e) => setNewAction((s) => ({ ...s, due_date: e.target.value }))} className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[13px] text-zinc-200 outline-none placeholder:text-zinc-700 focus:border-emerald-500/40 transition-colors [color-scheme:dark]" />
                  </div>
                </div>
              </div>

              {/* Modal actions */}
              <div className="mt-6 flex items-center justify-end gap-2">
                <button
                  onClick={() => setCreateOpen(false)}
                  className="rounded-lg px-4 py-2 text-[12px] font-medium text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateAction}
                  disabled={!newAction.title || saving}
                  className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-[12px] font-medium text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 transition-all"
                >
                  {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                  {saving ? "Creating…" : "Create Action"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Shared Sub-components ─────────────────────────────── */

function EmptyState({ icon: Icon, message, sub }: { icon: React.ElementType; message: string; sub: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center justify-center py-24 text-center"
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.03] border border-white/[0.04]">
        <Icon size={20} className="text-zinc-600" />
      </div>
      <h3 className="text-[15px] font-medium text-zinc-200">{message}</h3>
      <p className="mt-1.5 max-w-[280px] text-[12px] leading-relaxed text-zinc-600">{sub}</p>
    </motion.div>
  );
}

function StatBadge({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="font-mono text-[9px] tracking-widest text-zinc-700 uppercase">{label}</span>
      <span className={`font-mono text-[11px] font-medium ${color || "text-zinc-400"}`}>{value}</span>
    </div>
  );
}

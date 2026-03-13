"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  Clock,
  Users,
  Target,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Shield,
  Brain,
  TrendingUp,
  FileText,
  User,
  Search,
  Filter,
  Zap,
  MapPin,
  X,
} from "lucide-react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useOrg } from "@/lib/hooks/use-org";
import {
  useCareCommandStore,
  PLAN_STATUS_CONFIG,
  GOAL_STATUS_CONFIG,
  type CarePlan,
  type CareGoal,
} from "@/lib/care-command-store";
import {
  updateCarePlanAction,
  createCareGoalAction,
  updateCareGoalAction,
} from "@/app/actions/care";
import {
  getOrgStaffProfiles,
  type StaffProfileWithMeta,
} from "@/app/actions/staff-profiles";

/* ═══════════════════════════════════════════════════════════════════════════════
   Types & Config
   ═══════════════════════════════════════════════════════════════════════════════ */

type Tab = "care-plans" | "schads-compliance";
type PlanFilter = "all" | "active" | "draft" | "under_review" | "archived";

const TABS: { id: Tab; label: string }[] = [
  { id: "care-plans", label: "Care Plans" },
  { id: "schads-compliance", label: "SCHADS Compliance" },
];

const FILTER_OPTIONS: { id: PlanFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "draft", label: "Draft" },
  { id: "under_review", label: "Under Review" },
  { id: "archived", label: "Archived" },
];

const DOMAIN_COLORS: Record<string, string> = {
  daily_living: "bg-white/[0.06] text-zinc-300 border-white/[0.08]",
  community_participation: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  health_wellbeing: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  employment: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  relationships: "bg-pink-500/10 text-pink-400 border-pink-500/20",
  choice_control: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  home_living: "bg-teal-500/10 text-teal-400 border-teal-500/20",
  lifelong_learning: "bg-orange-500/10 text-orange-400 border-orange-500/20",
};

/* Mock workers removed — real data fetched from staff_profiles + schedule_blocks */

const FATIGUE_CONFIG = {
  low: { label: "Clear", color: "text-emerald-400", bg: "bg-emerald-500/10", dot: "bg-emerald-500" },
  medium: { label: "Monitor", color: "text-amber-400", bg: "bg-amber-500/10", dot: "bg-amber-500" },
  high: { label: "At Risk", color: "text-rose-400", bg: "bg-rose-500/10", dot: "bg-rose-500" },
} as const;

const SCHADS_RULES = [
  { id: "10hr", title: "10-Hour Break Rule", description: "Workers must have a minimum 10-hour break between the end of one shift and the start of the next. If break is less than 10 hours, the next shift is paid at overtime rates.", section: "Clause 25.5(d)" },
  { id: "max-hrs", title: "Maximum Ordinary Hours", description: "Maximum of 38 ordinary hours per week (or 76 per fortnight). Hours beyond this threshold attract overtime penalties.", section: "Clause 25.1" },
  { id: "min-engage", title: "Minimum Engagement", description: "Part-time and casual workers must be engaged for a minimum of 2 hours per shift (3 hours for community access). Sleepover shifts have separate provisions.", section: "Clause 25.5(a)" },
  { id: "overtime", title: "Overtime Rates", description: "First 2 hours at 150% (time and a half), thereafter at 200% (double time). Sunday work at 200%, public holidays at 250%.", section: "Clause 28" },
  { id: "broken", title: "Broken Shifts", description: "Maximum of 2 broken shift portions per day. Workers receive an allowance for each broken shift. Maximum span of 12 hours from start of first portion to end of last.", section: "Clause 25.6" },
  { id: "sleepover", title: "Sleepover Provisions", description: "Sleepover allowance applies when worker is required to sleep at workplace. If disturbed, minimum 1-hour payment at overtime rates for each disturbance.", section: "Clause 25.7" },
];

const ease = [0.16, 1, 0.3, 1] as const;

/* ═══════════════════════════════════════════════════════════════════════════════
   Animation Variants
   ═══════════════════════════════════════════════════════════════════════════════ */

const slideRight = {
  hidden: { opacity: 0, x: 320 },
  visible: { opacity: 1, x: 0, transition: { type: "spring" as const, damping: 28, stiffness: 300 } },
  exit: { opacity: 0, x: 320, transition: { duration: 0.2 } },
};

/* ═══════════════════════════════════════════════════════════════════════════════
   Helper Utilities
   ═══════════════════════════════════════════════════════════════════════════════ */

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

function domainLabel(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function goalProgress(goals: CareGoal[] | undefined): { total: number; inProgress: number; achieved: number; pct: number } {
  if (!goals || goals.length === 0) return { total: 0, inProgress: 0, achieved: 0, pct: 0 };
  const achieved = goals.filter((g) => g.status === "achieved").length;
  const inProgress = goals.filter((g) => g.status === "in_progress").length;
  return { total: goals.length, inProgress, achieved, pct: Math.round((achieved / goals.length) * 100) };
}

/* ═══════════════════════════════════════════════════════════════════════════════
   Care Plan Card
   ═══════════════════════════════════════════════════════════════════════════════ */

function CarePlanCard({
  plan,
  isSelected,
  onSelect,
}: {
  plan: CarePlan;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const statusCfg = PLAN_STATUS_CONFIG[plan.status] || PLAN_STATUS_CONFIG.draft;
  const progress = goalProgress(plan.care_goals);
  const reviewDays = daysUntil(plan.next_review_date);
  const domains = Object.keys(plan.domains || {});

  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease }}
      onClick={onSelect}
      className={`group w-full text-left transition-all r-card p-4 ${
        isSelected
          ? "border border-white/[0.12] bg-white/[0.04]"
          : "border border-white/[0.06] bg-white/[0.02] hover:border-white/[0.08] hover:bg-white/[0.03]"
      }`}
      style={{ boxShadow: "var(--shadow-inset-bevel)" }}
    >
      {/* Top row: status pill + title */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium border ${statusCfg.bg} ${statusCfg.color} ${statusCfg.border}`}>
              {statusCfg.label}
            </span>
            <h3 className="truncate text-[13px] font-medium text-white">{plan.title}</h3>
          </div>

          {/* Participant info */}
          {plan.assessor_name && (
            <div className="mt-1.5 flex items-center gap-1.5 text-[12px] text-[var(--text-muted)]">
              <User className="h-3 w-3" />
              <span>{plan.assessor_name}</span>
              {plan.assessor_role && (
                <span className="text-zinc-600">· {plan.assessor_role}</span>
              )}
            </div>
          )}
        </div>

        <ChevronRight
          className={`h-4 w-4 shrink-0 text-zinc-600 transition-transform ${
            isSelected ? "rotate-90 text-zinc-300" : "group-hover:translate-x-0.5"
          }`}
        />
      </div>

      {/* Dates */}
      <div className="mt-3 flex items-center gap-4 text-[11px] text-[var(--text-muted)]">
        {plan.start_date && (
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <span>Start: {formatDate(plan.start_date)}</span>
          </div>
        )}
        {plan.next_review_date && (
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>Review: {formatDate(plan.next_review_date)}</span>
          </div>
        )}
      </div>

      {/* Goals progress */}
      <div className="mt-3 flex items-center gap-3">
        <div className="flex-1">
          <div className="flex items-center justify-between text-[12px]">
            <span className="text-[var(--text-muted)]">
              {progress.total === 0
                ? "No goals defined"
                : `${progress.achieved} of ${progress.total} goals achieved`}
            </span>
            {progress.total > 0 && (
              <span className="font-mono text-[10px] text-zinc-300">{progress.pct}%</span>
            )}
          </div>
          {progress.total > 0 && (
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.05]">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress.pct}%` }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className="h-full rounded-full bg-[var(--brand)]"
              />
            </div>
          )}
        </div>
      </div>

      {/* Review countdown + domain tags */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {reviewDays !== null && (
          <span
            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium ${
              reviewDays <= 14
                ? "bg-rose-500/10 text-rose-400"
                : reviewDays <= 30
                  ? "bg-amber-500/10 text-amber-400"
                  : "bg-zinc-500/10 text-zinc-400"
            }`}
          >
            <Calendar className="h-2.5 w-2.5" />
            Review in {reviewDays}d
          </span>
        )}

        {domains.slice(0, 3).map((d) => (
          <span
            key={d}
            className={`rounded-md border px-2 py-0.5 text-[10px] font-medium ${
              DOMAIN_COLORS[d] || "bg-zinc-500/10 text-zinc-400 border-zinc-500/20"
            }`}
          >
            {domainLabel(d)}
          </span>
        ))}
        {domains.length > 3 && (
          <span className="text-[10px] text-zinc-600">+{domains.length - 3} more</span>
        )}
      </div>
    </motion.button>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   Plan Detail Panel (slide-over from right)
   ═══════════════════════════════════════════════════════════════════════════════ */

function PlanDetailPanel({
  plan,
  onClose,
  onActivate,
  onArchive,
  showAddGoal,
  setShowAddGoal,
  newGoalTitle,
  setNewGoalTitle,
  newGoalDescription,
  setNewGoalDescription,
  onAddGoal,
  onUpdateGoalStatus,
}: {
  plan: CarePlan;
  onClose: () => void;
  onActivate: () => void;
  onArchive: () => void;
  showAddGoal: boolean;
  setShowAddGoal: (v: boolean) => void;
  newGoalTitle: string;
  setNewGoalTitle: (v: string) => void;
  newGoalDescription: string;
  setNewGoalDescription: (v: string) => void;
  onAddGoal: () => void;
  onUpdateGoalStatus: (goalId: string, status: string) => void;
}) {
  const statusCfg = PLAN_STATUS_CONFIG[plan.status] || PLAN_STATUS_CONFIG.draft;
  const domains = Object.entries(plan.domains || {});
  const goals = plan.care_goals || [];
  const progress = goalProgress(goals);

  return (
    <motion.div
      variants={slideRight}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-white/[0.06] bg-[var(--background)] shadow-2xl shadow-black/40 md:max-w-lg"
    >
      {/* Panel header */}
      <div className="flex items-start justify-between border-b border-white/[0.06] p-5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border ${statusCfg.bg} ${statusCfg.color} ${statusCfg.border}`}>
              {statusCfg.label}
            </span>
            <span className="text-[10px] text-zinc-600">
              Created {formatDate(plan.created_at)}
            </span>
          </div>
          <h2 className="mt-2 text-lg font-semibold tracking-tight text-white">{plan.title}</h2>
          {plan.assessor_name && (
            <p className="mt-1 text-[12px] text-[var(--text-muted)]">
              Assessed by {plan.assessor_name}{plan.assessor_role ? ` — ${plan.assessor_role}` : ""}
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          className="ml-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-white/[0.05] hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Panel body — scrollable */}
      <div className="flex-1 overflow-y-auto scrollbar-none p-5">
        {/* Dates row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Start Date", value: formatDate(plan.start_date), icon: Calendar },
            { label: "Last Review", value: formatDate(plan.review_date), icon: Clock },
            { label: "Next Review", value: formatDate(plan.next_review_date), icon: AlertTriangle },
          ].map((d) => (
            <div key={d.label} className="r-card border border-white/[0.06] bg-white/[0.02] p-3" style={{ boxShadow: "var(--shadow-inset-bevel)" }}>
              <div className="flex items-center gap-1.5 text-zinc-600">
                <d.icon className="h-3 w-3" />
                <span className="font-mono text-[10px] font-bold uppercase tracking-widest">{d.label}</span>
              </div>
              <p className="mt-1 text-[12px] font-medium text-zinc-300">{d.value}</p>
            </div>
          ))}
        </div>

        {/* Notes */}
        {plan.notes && (
          <div className="mt-5">
            <h4 className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Notes</h4>
            <p className="mt-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-[12px] leading-relaxed text-zinc-400">
              {plan.notes}
            </p>
          </div>
        )}

        {/* Domains */}
        {domains.length > 0 && (
          <div className="mt-5">
            <h4 className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Domains</h4>
            <div className="mt-2 space-y-2">
              {domains.map(([key, val]) => (
                <div
                  key={key}
                  className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3"
                >
                  <p className={`font-mono text-[10px] font-bold uppercase tracking-widest ${DOMAIN_COLORS[key]?.split(" ")[1] || "text-zinc-400"}`}>
                    {domainLabel(key)}
                  </p>
                  <p className="mt-1 text-[12px] leading-relaxed text-zinc-400">{val}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Goals */}
        <div className="mt-5">
          <div className="flex items-center justify-between">
            <h4 className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
              Goals · {progress.achieved}/{progress.total} achieved
            </h4>
            <button
              onClick={() => setShowAddGoal(!showAddGoal)}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium bg-white/[0.04] text-zinc-300 transition-colors hover:bg-white/[0.08]"
            >
              <Zap className="h-3 w-3" />
              Add Goal
            </button>
          </div>

          {/* Add goal inline form */}
          <AnimatePresence>
            {showAddGoal && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3, ease }}
                className="mt-3 overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.03] p-3"
              >
                <input
                  type="text"
                  placeholder="Goal title"
                  value={newGoalTitle}
                  onChange={(e) => setNewGoalTitle(e.target.value)}
                  className="h-8 w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 text-[12px] text-white placeholder-zinc-600 outline-none focus:border-white/[0.15]"
                />
                <textarea
                  placeholder="Description (optional)"
                  value={newGoalDescription}
                  onChange={(e) => setNewGoalDescription(e.target.value)}
                  rows={2}
                  className="mt-2 w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-[12px] text-white placeholder-zinc-600 outline-none focus:border-white/[0.15]"
                />
                <div className="mt-2 flex justify-end gap-2">
                  <button
                    onClick={() => setShowAddGoal(false)}
                    className="rounded-md px-3 py-1.5 text-[10px] font-medium text-zinc-500 hover:text-zinc-300"
                  >
                    Cancel
                  </button>
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={onAddGoal}
                    disabled={!newGoalTitle.trim()}
                    className="rounded-md bg-white px-3 py-1.5 text-[10px] font-semibold text-black transition-colors hover:bg-zinc-200 disabled:opacity-40"
                  >
                    Save Goal
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Goals list with status, priority, milestones */}
          <div className="mt-3 space-y-2">
            {goals.length === 0 ? (
              <p className="py-6 text-center text-[12px] text-zinc-600">No goals defined for this plan</p>
            ) : (
              goals.map((goal) => {
                const gcfg = GOAL_STATUS_CONFIG[goal.status] || GOAL_STATUS_CONFIG.not_started;
                const milestonesTotal = goal.milestones?.length || 0;
                const milestonesDone = goal.milestones?.filter((m) => m.achieved).length || 0;

                return (
                  <div
                    key={goal.id}
                    className="r-card border border-white/[0.06] bg-white/[0.02] p-3"
                    style={{ boxShadow: "var(--shadow-inset-bevel)" }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h5 className="truncate text-[12px] font-medium text-white">{goal.title}</h5>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${gcfg.bg} ${gcfg.color}`}>
                            {gcfg.label}
                          </span>
                        </div>
                        {goal.description && (
                          <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-muted)]">{goal.description}</p>
                        )}
                      </div>

                      {/* Quick status cycle */}
                      <div className="flex shrink-0 gap-1">
                        {goal.status !== "achieved" && (
                          <button
                            onClick={() => onUpdateGoalStatus(goal.id, goal.status === "not_started" ? "in_progress" : "achieved")}
                            title={goal.status === "not_started" ? "Start" : "Mark achieved"}
                            className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-600 transition-colors hover:bg-emerald-500/10 hover:text-emerald-400"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Milestones — checkbox style with date */}
                    {milestonesTotal > 0 && (
                      <div className="mt-2.5 space-y-1.5">
                        <div className="flex items-center justify-between text-[10px] text-zinc-600">
                          <span>Milestones</span>
                          <span className="font-mono">{milestonesDone}/{milestonesTotal}</span>
                        </div>
                        {goal.milestones?.map((ms, msIdx) => (
                          <div key={msIdx} className="flex items-center gap-2 py-0.5">
                            <div
                              className={`h-3.5 w-3.5 rounded-[4px] border flex items-center justify-center flex-shrink-0 ${
                                ms.achieved
                                  ? "bg-[var(--brand)] border-[var(--brand)]"
                                  : "border-zinc-600 bg-transparent"
                              }`}
                            >
                              {ms.achieved && <CheckCircle2 className="h-2.5 w-2.5 text-white" />}
                            </div>
                            <span className={`text-[11px] flex-1 ${ms.achieved ? "text-zinc-500 line-through" : "text-zinc-300"}`}>
                              {ms.title}
                            </span>
                            {ms.target_date && (
                              <span className="font-mono text-[10px] text-zinc-600 tabular-nums">
                                {formatDate(ms.target_date)}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Target outcome */}
                    {goal.target_outcome && (
                      <div className="mt-2 flex items-start gap-1.5">
                        <Target className="mt-0.5 h-3 w-3 shrink-0 text-zinc-500" />
                        <p className="text-[10px] text-[var(--text-muted)]">{goal.target_outcome}</p>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Panel footer — actions */}
      <div className="flex items-center gap-2 border-t border-white/[0.06] p-4">
        {plan.status === "draft" && (
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={onActivate}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-white py-2.5 text-[12px] font-semibold text-black transition-colors hover:bg-zinc-200"
          >
            <CheckCircle2 className="h-4 w-4" />
            Activate Plan
          </motion.button>
        )}
        {plan.status === "under_review" && (
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={onActivate}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-white py-2.5 text-[12px] font-semibold text-black transition-colors hover:bg-zinc-200"
          >
            <CheckCircle2 className="h-4 w-4" />
            Approve & Activate
          </motion.button>
        )}
        {plan.status !== "archived" && (
          <button
            onClick={onArchive}
            className="flex items-center justify-center gap-2 rounded-lg bg-white/[0.04] border border-white/[0.06] px-4 py-2.5 text-[12px] font-medium text-zinc-400 transition-colors hover:border-rose-500/20 hover:text-rose-400 hover:bg-white/[0.08]"
          >
            Archive
          </button>
        )}
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   Care Plans Tab
   ═══════════════════════════════════════════════════════════════════════════════ */

function CarePlansTab({
  plans,
  loading,
  planFilter,
  setPlanFilter,
  searchQuery,
  setSearchQuery,
  selectedPlanId,
  setSelectedPlanId,
}: {
  plans: CarePlan[];
  loading: boolean;
  planFilter: PlanFilter;
  setPlanFilter: (f: PlanFilter) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  selectedPlanId: string | null;
  setSelectedPlanId: (id: string | null) => void;
}) {
  return (
    <div className="p-5">
      {/* ── Filter row: status filter pills ───── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1.5">
          {FILTER_OPTIONS.map((f) => (
            <button
              key={f.id}
              onClick={() => setPlanFilter(f.id)}
              className={`relative rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                planFilter === f.id
                  ? "bg-white/[0.06] text-white border border-white/[0.08]"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] border border-transparent"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Stealth search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-600" />
          <input
            type="text"
            placeholder="Search plans, assessors, domains..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 w-full rounded-lg border border-white/[0.08] bg-white/[0.04] pl-9 pr-4 text-[13px] text-white placeholder-zinc-600 outline-none transition-colors focus:border-white/[0.15] focus:bg-white/[0.06] sm:w-72 font-mono"
          />
        </div>
      </div>

      {/* ── Plan cards grid (2 columns) ───── */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--brand)]/30 border-t-[var(--brand)]" />
        </div>
      ) : plans.length === 0 ? (
        <div className="stealth-empty-state mt-12">
          <div className="relative mb-6">
            <div className="animate-zen-ring absolute inset-0 rounded-full border border-zinc-800" />
            <div className="stealth-empty-state-icon animate-zen-breathe">
              <FileText className="w-5 h-5 text-zinc-600" />
            </div>
          </div>
          <h3 className="stealth-empty-state-title">No care plans found</h3>
          <p className="stealth-empty-state-desc">
            {planFilter !== "all" ? "Try changing the filter or search query" : "Care plans will appear here once created"}
          </p>
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
          {plans.map((plan) => (
            <CarePlanCard
              key={plan.id}
              plan={plan}
              isSelected={selectedPlanId === plan.id}
              onSelect={() => setSelectedPlanId(selectedPlanId === plan.id ? null : plan.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   SCHADS Compliance Tab
   ═══════════════════════════════════════════════════════════════════════════════ */

function SCHADSComplianceTab({ orgId }: { orgId: string }) {
  const [expandedRule, setExpandedRule] = useState<string | null>(null);
  const [staffData, setStaffData] = useState<StaffProfileWithMeta[]>([]);
  const [staffLoading, setStaffLoading] = useState(true);

  // Fetch real staff data
  useEffect(() => {
    if (!orgId) return;
    setStaffLoading(true);
    getOrgStaffProfiles(orgId)
      .then((data) => setStaffData(data))
      .catch((err) => console.error("Failed to load staff data:", err))
      .finally(() => setStaffLoading(false));
  }, [orgId]);

  // Map real data to worker rows
  const workerRows = useMemo(() => {
    return staffData.map((sp) => {
      const hoursThisWeek = sp.weekly_hours_scheduled || 0;
      const maxHours = sp.max_weekly_hours || 38;
      const overtime = hoursThisWeek > maxHours;
      const fatigueRisk: "low" | "medium" | "high" =
        sp.credential_summary.expired > 0 ? "high"
        : hoursThisWeek > maxHours * 0.9 ? "medium"
        : "low";
      const breakCompliance = sp.credential_summary.expired === 0 && sp.credential_summary.pending === 0;

      return {
        id: sp.user_id,
        name: sp.full_name,
        role: `Level ${sp.schads_level} · ${sp.employment_type.replace(/_/g, " ")}`,
        hoursThisWeek,
        maxHours,
        breakCompliance,
        fatigueRisk,
        overtime,
        credentialStatus: sp.credential_summary,
      };
    });
  }, [staffData]);

  /* ── Compliance stats from real data ───── */
  const complianceStats = useMemo(() => {
    const fatigueAtRisk = workerRows.filter((w) => w.fatigueRisk === "high").length;
    const overtimeHours = workerRows.filter((w) => w.overtime).reduce((a, w) => a + Math.max(0, w.hoursThisWeek - w.maxHours), 0);
    const minEngagementViolations = workerRows.filter((w) => w.hoursThisWeek > 0 && w.hoursThisWeek < 2).length;
    return { fatigueAtRisk, overtimeHours: overtimeHours.toFixed(1), minEngagementViolations };
  }, [workerRows]);

  return (
    <div className="p-5 space-y-6">
      {/* ── Summary Metrics: 3 cards ───── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          {
            label: "Fatigue Risk",
            value: complianceStats.fatigueAtRisk,
            subtitle: "workers at risk (10hr break rule)",
            icon: AlertTriangle,
            color: complianceStats.fatigueAtRisk > 0 ? "text-rose-400" : "text-emerald-400",
          },
          {
            label: "Overtime Hours",
            value: `${complianceStats.overtimeHours}h`,
            subtitle: "total overtime this week (>38hrs)",
            icon: Clock,
            color: Number(complianceStats.overtimeHours) > 0 ? "text-amber-400" : "text-emerald-400",
          },
          {
            label: "Min Engagement",
            value: complianceStats.minEngagementViolations,
            subtitle: "violations (<2hr shifts)",
            icon: Users,
            color: complianceStats.minEngagementViolations > 0 ? "text-amber-400" : "text-emerald-400",
          },
        ].map((card, idx) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.06, duration: 0.4, ease }}
            className="r-card border border-white/[0.06] bg-white/[0.02] p-5"
            style={{ boxShadow: "var(--shadow-inset-bevel)" }}
          >
            <div className="flex items-center gap-2 mb-2">
              <card.icon className={`w-3.5 h-3.5 ${card.color}`} />
              <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                {card.label}
              </p>
            </div>
            <p className={`font-mono text-[28px] font-semibold tabular-nums tracking-tighter ${card.color}`}>
              {card.value}
            </p>
            <p className="mt-1 text-[11px] text-[var(--text-muted)]">
              {card.subtitle}
            </p>
          </motion.div>
        ))}
      </div>

      {/* ── Workforce Compliance Table ───── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5, ease }}
        className="r-card border border-white/[0.06] bg-white/[0.02] overflow-hidden"
        style={{ boxShadow: "var(--shadow-inset-bevel)" }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.05]">
          <h3 className="text-[13px] font-semibold text-zinc-200">
            Workforce Compliance — This Week
          </h3>
          <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium text-zinc-300">
            {workerRows.length} workers
          </span>
        </div>

        {/* Table header */}
        <div className="grid grid-cols-[1fr_80px_100px_80px] items-center gap-3 px-5 py-2.5 border-b border-white/[0.04] bg-[var(--surface-1)]">
          <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Worker</span>
          <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] text-center">Hours</span>
          <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] text-center">Credentials</span>
          <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] text-center">Status</span>
        </div>

        {/* Table rows */}
        {staffLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--brand)]/30 border-t-[var(--brand)]" />
          </div>
        ) : workerRows.length === 0 ? (
          <div className="py-12 text-center text-[12px] text-zinc-600">
            No staff profiles found. Create staff profiles in Team → Member to see compliance data.
          </div>
        ) : (
          <div className="divide-y divide-white/[0.03]">
            {workerRows.map((worker, i) => {
              const fatigue = FATIGUE_CONFIG[worker.fatigueRisk];
              return (
                <motion.div
                  key={worker.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.02 * i }}
                  className={`grid grid-cols-[1fr_80px_100px_80px] items-center gap-3 px-5 py-3 transition-colors hover:bg-white/[0.02] ${
                    worker.fatigueRisk === "high" ? "bg-rose-500/[0.02]" : ""
                  }`}
                >
                  {/* Worker */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.05] text-[10px] font-semibold text-zinc-400 flex-shrink-0">
                      {worker.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[12px] font-medium text-white truncate">{worker.name}</p>
                      <p className="text-[10px] text-zinc-600 truncate">{worker.role}</p>
                    </div>
                  </div>

                  {/* Hours This Week */}
                  <div className="flex items-center justify-center">
                    <span className={`font-mono text-[12px] font-medium ${worker.hoursThisWeek > worker.maxHours ? "text-amber-400" : "text-zinc-300"}`}>
                      {worker.hoursThisWeek}h<span className="text-zinc-600">/{worker.maxHours}</span>
                    </span>
                  </div>

                  {/* Credential Compliance */}
                  <div className="flex items-center justify-center">
                    {worker.breakCompliance ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                        <CheckCircle2 className="h-2.5 w-2.5" />
                        {worker.credentialStatus.verified}/{worker.credentialStatus.total}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-medium text-rose-400">
                        <AlertTriangle className="h-2.5 w-2.5" />
                        {worker.credentialStatus.expired} expired
                      </span>
                    )}
                  </div>

                  {/* Fatigue Status */}
                  <div className="flex items-center justify-center">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${fatigue.bg} ${fatigue.color}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${fatigue.dot}`} />
                      {fatigue.label}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Legend */}
        <div className="px-5 py-2.5 border-t border-white/[0.05] flex flex-wrap items-center gap-4">
          {(Object.entries(FATIGUE_CONFIG) as [keyof typeof FATIGUE_CONFIG, (typeof FATIGUE_CONFIG)[keyof typeof FATIGUE_CONFIG]][]).map(([key, cfg]) => (
            <div key={key} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />
              <span className="text-[10px] text-[var(--text-muted)]">{cfg.label}</span>
            </div>
          ))}
          <span className="text-[10px] text-zinc-600">|</span>
          <span className="text-[10px] text-zinc-600">
            <span className="font-medium text-zinc-500">OT threshold:</span> 38 hrs/week
          </span>
        </div>
      </motion.div>

      {/* ── SCHADS Award Rules Reference (expandable accordion) ───── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5, ease }}
      >
        <div className="flex items-center gap-2.5 mb-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10 text-violet-400">
            <Brain className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-[13px] font-semibold text-white">SCHADS Award Rules Reference</h3>
            <p className="text-[11px] text-[var(--text-muted)]">Key compliance requirements from the SCHADS Industry Award 2010</p>
          </div>
        </div>

        <div className="space-y-2">
          {SCHADS_RULES.map((rule) => (
            <div key={rule.id} className="r-card border border-white/[0.06] bg-white/[0.02] overflow-hidden" style={{ boxShadow: "var(--shadow-inset-bevel)" }}>
              <button
                onClick={() => setExpandedRule(expandedRule === rule.id ? null : rule.id)}
                className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-white/[0.02]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04] text-zinc-400 flex-shrink-0">
                    <Shield className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <p className="text-[12px] font-medium text-white">{rule.title}</p>
                    <p className="text-[10px] text-zinc-600">{rule.section}</p>
                  </div>
                </div>
                <ChevronRight
                  className={`h-4 w-4 text-zinc-600 transition-transform ${
                    expandedRule === rule.id ? "rotate-90" : ""
                  }`}
                />
              </button>

              <AnimatePresence>
                {expandedRule === rule.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-white/[0.05] px-4 py-3">
                      <p className="text-[12px] leading-relaxed text-zinc-400">{rule.description}</p>
                      <div className="mt-2 flex items-center gap-1.5 text-[10px] text-violet-400/60">
                        <FileText className="h-3 w-3" />
                        <span>{rule.section} — SCHADS Industry Award 2010</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>

        {/* Compliance Advisory */}
        <div className="mt-6 r-card border border-amber-500/10 bg-amber-500/[0.03] p-4">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400/60" />
            <div>
              <p className="text-[12px] font-medium text-amber-400/80">Compliance Advisory</p>
              <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-muted)]">
                Roster Intelligence provides automated monitoring and alerts based on SCHADS Award requirements.
                This does not constitute legal advice. Always consult your industrial relations advisor or the
                Fair Work Commission for binding interpretations. Award conditions may vary based on individual
                employment arrangements and enterprise agreements.
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════
   Main Page — Archetype B
   ═══════════════════════════════════════════════════════════════════════════════ */

export default function RosterIntelligencePage() {
  const { orgId } = useOrg();
  const { plans, plansLoading, fetchPlans } = useCareCommandStore();

  const [tab, setTab] = useState<Tab>("care-plans");
  const [planFilter, setPlanFilter] = useState<PlanFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [newGoalTitle, setNewGoalTitle] = useState("");
  const [newGoalDescription, setNewGoalDescription] = useState("");

  // ── Load plans ────────────────────────────────────────
  useEffect(() => {
    if (orgId) fetchPlans(orgId);
  }, [orgId, fetchPlans]);

  // ── Derived data ──────────────────────────────────────
  const filteredPlans = useMemo(() => {
    let result = plans;
    if (planFilter !== "all") result = result.filter((p) => p.status === planFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.assessor_name?.toLowerCase().includes(q) ||
          Object.keys(p.domains || {}).some((d) => domainLabel(d).toLowerCase().includes(q)),
      );
    }
    return result;
  }, [plans, planFilter, searchQuery]);

  const selectedPlan = useMemo(() => plans.find((p) => p.id === selectedPlanId) ?? null, [plans, selectedPlanId]);

  // ── Handlers ──────────────────────────────────────────
  const handleActivatePlan = async (plan: CarePlan) => {
    if (!orgId) return;
    await updateCarePlanAction(plan.id, { status: "active" });
    fetchPlans(orgId);
  };

  const handleArchivePlan = async (plan: CarePlan) => {
    if (!orgId) return;
    await updateCarePlanAction(plan.id, { status: "archived" });
    setSelectedPlanId(null);
    fetchPlans(orgId);
  };

  const handleAddGoal = async () => {
    if (!orgId || !selectedPlan || !newGoalTitle.trim()) return;
    await createCareGoalAction({
      care_plan_id: selectedPlan.id,
      organization_id: orgId,
      participant_id: selectedPlan.participant_id,
      title: newGoalTitle.trim(),
      description: newGoalDescription.trim() || null,
      priority: 1,
      milestones: [],
    });
    setNewGoalTitle("");
    setNewGoalDescription("");
    setShowAddGoal(false);
    fetchPlans(orgId);
  };

  const handleUpdateGoalStatus = async (goalId: string, status: string) => {
    if (!orgId) return;
    await updateCareGoalAction(goalId, { status });
    fetchPlans(orgId);
  };

  return (
    <div className="flex h-full flex-col bg-[var(--background)]">
      {/* Noise overlay */}
      <div className="stealth-noise" />

      {/* Neutral radial glow */}
      <div
        className="pointer-events-none absolute top-0 left-0 right-0 h-64"
        style={{
          background:
            "radial-gradient(ellipse at center top, rgba(255,255,255,0.015) 0%, transparent 60%)",
        }}
      />

      {/* ── Sticky Header ───────────────────────────────────── */}
      <div className="sticky top-0 z-20 border-b border-white/[0.04] bg-zinc-950/80 backdrop-blur-xl">
        <div className="flex items-center justify-between px-5 py-2.5">
          <span className="font-mono text-[10px] font-bold tracking-widest text-[var(--text-muted)] uppercase">
            CARE PLANS
          </span>
        </div>
      </div>

      {/* ── Tab Bar with pill animation ─────────────────────── */}
      <div className="flex items-center gap-1 border-b border-white/[0.06] bg-[var(--surface-1)] px-5 py-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`relative rounded-md px-3 py-1.5 text-[12px] transition-colors ${
              tab === t.id
                ? "font-medium text-white"
                : "text-[var(--text-muted)] hover:text-zinc-300"
            }`}
          >
            {tab === t.id && (
              <motion.div
                layoutId="roster-tab-pill"
                className="absolute inset-0 rounded-md bg-white/[0.06]"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative">{t.label}</span>
          </button>
        ))}
      </div>

      {/* ── Scrollable Content ──────────────────────────────── */}
      <div className="flex-1 overflow-y-auto scrollbar-none">
        <AnimatePresence mode="wait">
          {tab === "care-plans" ? (
            <motion.div
              key="care-plans"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.3, ease }}
              className="relative"
            >
              <CarePlansTab
                plans={filteredPlans}
                loading={plansLoading}
                planFilter={planFilter}
                setPlanFilter={setPlanFilter}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                selectedPlanId={selectedPlanId}
                setSelectedPlanId={setSelectedPlanId}
              />

              {/* Detail slide-over */}
              <AnimatePresence>
                {selectedPlan && (
                  <PlanDetailPanel
                    plan={selectedPlan}
                    onClose={() => setSelectedPlanId(null)}
                    onActivate={() => handleActivatePlan(selectedPlan)}
                    onArchive={() => handleArchivePlan(selectedPlan)}
                    showAddGoal={showAddGoal}
                    setShowAddGoal={setShowAddGoal}
                    newGoalTitle={newGoalTitle}
                    setNewGoalTitle={setNewGoalTitle}
                    newGoalDescription={newGoalDescription}
                    setNewGoalDescription={setNewGoalDescription}
                    onAddGoal={handleAddGoal}
                    onUpdateGoalStatus={handleUpdateGoalStatus}
                  />
                )}
              </AnimatePresence>
            </motion.div>
          ) : (
            <motion.div
              key="schads-compliance"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.3, ease }}
            >
              <SCHADSComplianceTab orgId={orgId || ""} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

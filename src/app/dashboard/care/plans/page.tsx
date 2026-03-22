/**
 * @page /dashboard/care/plans
 * @status COMPLETE
 * @description Care plans list with search, create, and goal management
 * @dataSource server-action
 * @lastAudit 2026-03-22
 */
"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Plus,
  ClipboardList,
  Target,
  Calendar,
  User,
  X,
  ChevronRight,
  Edit3,
  Clock,
  AlertTriangle,
  Archive,
  FileText,
  SlidersHorizontal,
} from "lucide-react";
import { useState, useMemo, useCallback, useEffect } from "react";
import { useOrg } from "@/lib/hooks/use-org";
import { useRouter } from "next/navigation";
import {
  fetchCarePlansAction,
  createCarePlanAction,
  updateCarePlanAction,
  createCareGoalAction,
  updateCareGoalAction,
} from "@/app/actions/care";

/* ── Types ────────────────────────────────────────────── */

type PlanStatus = "draft" | "active" | "under_review" | "archived";
type GoalStatus = "not_started" | "in_progress" | "achieved" | "on_hold" | "discontinued";

interface CareGoal {
  id: string;
  title: string;
  description?: string | null;
  status: GoalStatus;
  priority: number;
  target_outcome?: string | null;
  support_category?: "core" | "capacity_building" | "capital" | null;
  milestones?: { title: string; target_date?: string; achieved: boolean }[];
  started_at?: string | null;
  achieved_at?: string | null;
}

interface CarePlan {
  id: string;
  organization_id: string;
  participant_id: string;
  title: string;
  status: PlanStatus;
  start_date?: string | null;
  review_date?: string | null;
  next_review_date?: string | null;
  domains: Record<string, string>;
  assessor_name?: string | null;
  assessor_role?: string | null;
  notes?: string | null;
  created_at: string;
  care_goals?: CareGoal[];
  participant_profiles?: {
    preferred_name?: string | null;
    full_name?: string | null;
    clients?: { name?: string | null } | null;
  } | null;
}

/* ── Status Config ────────────────────────────────────── */

const STATUS_CONFIG: Record<PlanStatus, { label: string; bg: string; text: string; border: string }> = {
  active:       { label: "Active",       bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20" },
  draft:        { label: "Draft",        bg: "bg-zinc-500/10",    text: "text-zinc-400",    border: "border-zinc-500/20" },
  under_review: { label: "Under Review", bg: "bg-amber-500/10",   text: "text-amber-400",   border: "border-amber-500/20" },
  archived:     { label: "Archived",     bg: "bg-rose-500/10",    text: "text-rose-400",    border: "border-rose-500/20" },
};

const TABS: { key: "all" | PlanStatus; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "draft", label: "Draft" },
  { key: "under_review", label: "Review" },
  { key: "archived", label: "Archived" },
];

/* ── Helpers ──────────────────────────────────────────── */

function resolveParticipantName(plan: CarePlan): string {
  const p = plan.participant_profiles;
  if (!p) return "Unknown";
  return p.preferred_name || p.full_name || p.clients?.name || "Unknown";
}

function getInitials(name: string): string {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (parts[0]?.[0] || "?").toUpperCase();
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
}

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const now = new Date();
  return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function padGoalCount(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/* ── Ghost Badge ──────────────────────────────────────── */

function GhostBadge({ status }: { status: PlanStatus }) {
  const c = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wider border ${c.bg} ${c.text} ${c.border}`}>
      {c.label}
    </span>
  );
}

/* ── Shimmer Skeleton ─────────────────────────────────── */

const SKELETON_WIDTHS = [
  { name: "w-20", title: "w-48", goals: "w-6", date: "w-20" },
  { name: "w-28", title: "w-56", goals: "w-5", date: "w-16" },
  { name: "w-24", title: "w-40", goals: "w-6", date: "w-20" },
  { name: "w-16", title: "w-52", goals: "w-5", date: "w-18" },
  { name: "w-32", title: "w-44", goals: "w-6", date: "w-16" },
];

function SkeletonRow({ idx }: { idx: number }) {
  const w = SKELETON_WIDTHS[idx % SKELETON_WIDTHS.length];
  return (
    <tr className="border-b border-white/5 h-16">
      <td className="px-8 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-zinc-900 animate-pulse shrink-0" />
          <div className="space-y-1.5">
            <div className={`h-3 ${w.name} bg-zinc-900 rounded-sm animate-pulse`} />
            <div className="h-2 w-14 bg-zinc-900/60 rounded-sm animate-pulse" />
          </div>
        </div>
      </td>
      <td className="px-4 py-3"><div className={`h-3 ${w.title} bg-zinc-900 rounded-sm animate-pulse`} /></td>
      <td className="px-4 py-3"><div className="h-5 w-16 bg-zinc-900 rounded-md animate-pulse" /></td>
      <td className="px-4 py-3 text-center"><div className={`h-3 ${w.goals} bg-zinc-900 rounded-sm animate-pulse mx-auto`} /></td>
      <td className="px-4 py-3"><div className={`h-3 ${w.date} bg-zinc-900 rounded-sm animate-pulse`} /></td>
      <td className="px-4 py-3"><div className="h-3 w-3 bg-zinc-900 rounded-sm animate-pulse" /></td>
    </tr>
  );
}

/* ── Empty State ──────────────────────────────────────── */

function EmptyState({ hasFilters, onClearFilters, onCreate }: {
  hasFilters: boolean;
  onClearFilters: () => void;
  onCreate: () => void;
}) {
  return (
    <tr>
      <td colSpan={6}>
        <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-white/5 rounded-xl bg-zinc-950/50 mx-8 my-6">
          <ClipboardList className="w-8 h-8 text-zinc-800 mb-4" />
          <p className="text-sm text-zinc-500">
            {hasFilters ? "No plans match your filters." : "No care plans yet."}
          </p>
          <div className="mt-3">
            {hasFilters ? (
              <button
                onClick={onClearFilters}
                className="text-xs text-zinc-400 hover:text-white transition-colors underline underline-offset-2"
              >
                Clear filters
              </button>
            ) : (
              <button
                onClick={onCreate}
                className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
              >
                <Plus className="w-3 h-3" />
                Create new plan
              </button>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}

/* ── Create Slide-Over (preserved from original) ──────── */

function PlanSlideOver({
  open, onClose, orgId, onCreated,
}: {
  open: boolean; onClose: () => void; orgId: string; onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [participantId, setParticipantId] = useState("");
  const [assessorName, setAssessorName] = useState("");
  const [assessorRole, setAssessorRole] = useState("");
  const [startDate, setStartDate] = useState("");
  const [reviewDate, setReviewDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!title || !participantId) return;
    setSaving(true);
    try {
      await createCarePlanAction({
        organization_id: orgId,
        participant_id: participantId,
        title,
        domains: {},
        assessor_name: assessorName || null,
        assessor_role: assessorRole || null,
        start_date: startDate || null,
        next_review_date: reviewDate || null,
        notes: notes || null,
      });
      onCreated();
      setTitle(""); setParticipantId(""); setAssessorName(""); setAssessorRole("");
      setStartDate(""); setReviewDate(""); setNotes("");
      onClose();
    } catch (err) {
      console.error("Failed to create care plan:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-[#0A0A0A] border-l border-white/[0.06] shadow-2xl overflow-y-auto"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-emerald-400" />
                <h2 className="text-sm font-semibold text-white">New Care Plan</h2>
              </div>
              <button onClick={onClose} className="p-1 rounded-md hover:bg-white/5 text-zinc-500"><X className="w-4 h-4" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {[
                { label: "Participant ID", value: participantId, set: setParticipantId, ph: "Enter participant UUID" },
                { label: "Plan Title", value: title, set: setTitle, ph: "e.g., Individual Support Plan — 2026" },
              ].map((f) => (
                <div key={f.label}>
                  <label className="block text-xs font-medium text-zinc-500 mb-1.5">{f.label}</label>
                  <input value={f.value} onChange={(e) => f.set(e.target.value)} placeholder={f.ph}
                    className="w-full px-3 py-2 bg-zinc-900/50 border border-white/[0.06] rounded-lg text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/30" />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1.5">Assessor Name</label>
                  <input value={assessorName} onChange={(e) => setAssessorName(e.target.value)} placeholder="Dr. Smith"
                    className="w-full px-3 py-2 bg-zinc-900/50 border border-white/[0.06] rounded-lg text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/30" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1.5">Assessor Role</label>
                  <input value={assessorRole} onChange={(e) => setAssessorRole(e.target.value)} placeholder="Support Coordinator"
                    className="w-full px-3 py-2 bg-zinc-900/50 border border-white/[0.06] rounded-lg text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/30" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1.5">Start Date</label>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-900/50 border border-white/[0.06] rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/30 [color-scheme:dark]" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-500 mb-1.5">Next Review</label>
                  <input type="date" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-900/50 border border-white/[0.06] rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/30 [color-scheme:dark]" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-500 mb-1.5">Notes</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Additional context..."
                  className="w-full px-3 py-2 bg-zinc-900/50 border border-white/[0.06] rounded-lg text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 resize-none" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-white/[0.06]">
              <button onClick={onClose} className="h-8 px-3 rounded-md text-xs text-zinc-400 hover:text-white hover:bg-white/5 transition-colors">Cancel</button>
              <button onClick={handleSubmit} disabled={!title || !participantId || saving}
                className="h-8 px-4 rounded-md bg-white text-black text-xs font-semibold hover:bg-zinc-200 transition-colors active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed">
                {saving ? "Creating…" : "Create Plan"}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ── Main Page ────────────────────────────────────────── */

export default function CarePlansPage() {
  const { orgId } = useOrg();
  const router = useRouter();

  const [plans, setPlans] = useState<CarePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"all" | PlanStatus>("all");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const loadPlans = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const data = await fetchCarePlansAction(orgId);
      setPlans((data as CarePlan[]) ?? []);
    } catch (err) {
      console.error("Failed to load care plans:", err);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { loadPlans(); }, [loadPlans]);

  /* ── Tab counts ──────────────────────────────────────── */
  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { all: plans.length };
    for (const t of TABS) {
      if (t.key !== "all") counts[t.key] = plans.filter((p) => p.status === t.key).length;
    }
    return counts;
  }, [plans]);

  /* ── Filtered list ───────────────────────────────────── */
  const filtered = useMemo(() => {
    let list = plans;
    if (tab !== "all") list = list.filter((p) => p.status === tab);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          resolveParticipantName(p).toLowerCase().includes(q) ||
          p.participant_id.toLowerCase().includes(q) ||
          (p.assessor_name?.toLowerCase().includes(q))
      );
    }
    return list;
  }, [plans, tab, search]);

  const hasFilters = search.length > 0 || tab !== "all";

  return (
    <div className="flex h-full flex-col bg-[#050505]">
      {/* ─── Command Header ──────────────────────────────── */}
      <div className="flex items-center justify-between h-14 px-8 border-b border-white/5 shrink-0">
        {/* Left: Breadcrumb + Pill Tabs */}
        <div className="flex items-center gap-0">
          <span className="text-[10px] tracking-[0.2em] uppercase text-zinc-500 font-semibold select-none">
            Care Plans
          </span>
          <div className="w-px h-4 bg-white/10 mx-4" />
          <div className="flex items-center gap-1 bg-zinc-900/50 p-1 rounded-lg border border-white/5">
            {TABS.map((t) => {
              const isActive = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`px-3 py-1.5 text-xs rounded-md transition-colors cursor-pointer ${
                    isActive
                      ? "text-white bg-white/10 shadow-sm font-medium"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {t.label}
                  {t.key !== "all" && (
                    <span className="ml-1.5 font-mono text-[10px] text-zinc-500">{tabCounts[t.key] ?? 0}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Search + Filter + CTA */}
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative w-64 h-8 flex items-center">
            <Search className="absolute left-3 w-3 h-3 text-zinc-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search plans…"
              className="w-full h-full bg-zinc-900 border border-white/5 rounded-md pl-8 pr-3 text-xs text-white placeholder:text-zinc-600 outline-none focus:border-zinc-700 transition-colors"
            />
          </div>

          {/* Filter */}
          <button className="h-8 px-3 flex items-center gap-2 rounded-md border border-white/5 bg-transparent hover:bg-white/5 text-xs text-zinc-300 transition-colors">
            <SlidersHorizontal className="w-3 h-3" />
            Filters
          </button>

          {/* Primary CTA — White Solid (Obsidian Standard) */}
          <button
            onClick={() => setCreateOpen(true)}
            className="h-8 px-4 rounded-md bg-white text-black text-xs font-semibold hover:bg-zinc-200 transition-colors active:scale-95"
          >
            <Plus className="w-3 h-3 inline-block mr-1.5 -mt-px" />
            New Care Plan
          </button>
        </div>
      </div>

      {/* ─── Data Grid ───────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-left border-collapse">
          {/* Column Headers */}
          <thead>
            <tr className="h-10 border-b border-white/5">
              <th className="px-8 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold w-[25%]">Participant</th>
              <th className="px-4 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold w-[35%]">Plan Title</th>
              <th className="px-4 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold w-[12%]">Status</th>
              <th className="px-4 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold w-[8%] text-center">Goals</th>
              <th className="px-4 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold w-[15%]">Next Review</th>
              <th className="px-4 w-8" />
            </tr>
          </thead>

          <tbody>
            {/* Loading Skeletons */}
            {loading && plans.length === 0 && (
              Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} idx={i} />)
            )}

            {/* Empty State */}
            {!loading && filtered.length === 0 && (
              <EmptyState
                hasFilters={hasFilters}
                onClearFilters={() => { setSearch(""); setTab("all"); }}
                onCreate={() => setCreateOpen(true)}
              />
            )}

            {/* Data Rows */}
            {!loading && filtered.map((plan) => {
              const name = resolveParticipantName(plan);
              const initials = getInitials(name);
              const goalCount = plan.care_goals?.length ?? 0;
              const reviewDays = daysUntil(plan.next_review_date);
              const isOverdue = reviewDays !== null && reviewDays < 0;
              const isUrgent = reviewDays !== null && reviewDays >= 0 && reviewDays < 30;

              return (
                <tr
                  key={plan.id}
                  onClick={() => router.push(`/dashboard/care/plans/${plan.id}`)}
                  className="group border-b border-white/5 hover:bg-white/[0.02] transition-colors cursor-pointer h-16"
                >
                  {/* Col 1: Participant */}
                  <td className="px-8 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center shrink-0 overflow-hidden">
                        <span className="text-xs text-zinc-400 font-medium select-none">{initials}</span>
                      </div>
                      <div className="flex flex-col justify-center min-w-0">
                        <span className="text-sm text-zinc-100 font-medium truncate">{name}</span>
                        <span className="text-[10px] font-mono text-zinc-600 truncate">
                          ID: {plan.participant_id.slice(0, 8)}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Col 2: Title */}
                  <td className="px-4 py-3">
                    <span className="text-sm text-zinc-300 truncate block max-w-sm">{plan.title}</span>
                  </td>

                  {/* Col 3: Status */}
                  <td className="px-4 py-3">
                    <GhostBadge status={plan.status as PlanStatus} />
                  </td>

                  {/* Col 4: Goals */}
                  <td className="px-4 py-3 text-center">
                    <span className="font-mono text-xs text-zinc-400">{padGoalCount(goalCount)}</span>
                  </td>

                  {/* Col 5: Next Review */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className={`font-mono text-xs ${isOverdue ? "text-rose-500" : "text-zinc-300"}`}>
                        {formatDate(plan.next_review_date)}
                      </span>
                      {isUrgent && !isOverdue && (
                        <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
                      )}
                      {isOverdue && (
                        <span className="text-[9px] font-mono text-rose-500 uppercase">Overdue</span>
                      )}
                    </div>
                  </td>

                  {/* Col 6: Chevron */}
                  <td className="px-4 py-3">
                    <ChevronRight className="w-4 h-4 text-zinc-700 transition-all duration-200 group-hover:text-zinc-300 group-hover:translate-x-1" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ─── Create Slide-Over ────────────────────────────── */}
      <PlanSlideOver
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        orgId={orgId ?? ""}
        onCreated={loadPlans}
      />
    </div>
  );
}

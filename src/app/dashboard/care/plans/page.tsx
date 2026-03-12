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
  CheckCircle2,
  Clock,
  AlertCircle,
  Archive,
  FileText,
} from "lucide-react";
import { useState, useMemo, useCallback, useEffect } from "react";
import { useOrg } from "@/lib/hooks/use-org";
import { useIndustryLexicon } from "@/lib/industry-lexicon";
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
}

/* ── Status Config ────────────────────────────────────── */

const STATUS_PILLS: Record<PlanStatus, { label: string; bg: string; text: string }> = {
  draft: { label: "Draft", bg: "bg-zinc-500/10", text: "text-zinc-400" },
  active: { label: "Active", bg: "bg-emerald-500/10", text: "text-emerald-400" },
  under_review: { label: "Under Review", bg: "bg-amber-500/10", text: "text-amber-400" },
  archived: { label: "Archived", bg: "bg-zinc-500/10", text: "text-zinc-500" },
};

const GOAL_STATUS: Record<GoalStatus, { label: string; bg: string; text: string }> = {
  not_started: { label: "Not Started", bg: "bg-zinc-500/10", text: "text-zinc-400" },
  in_progress: { label: "In Progress", bg: "bg-blue-500/10", text: "text-blue-400" },
  achieved: { label: "Achieved", bg: "bg-emerald-500/10", text: "text-emerald-400" },
  on_hold: { label: "On Hold", bg: "bg-amber-500/10", text: "text-amber-400" },
  discontinued: { label: "Discontinued", bg: "bg-rose-500/10", text: "text-rose-400" },
};

const TABS: { key: "all" | PlanStatus; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "draft", label: "Draft" },
  { key: "under_review", label: "Under Review" },
  { key: "archived", label: "Archived" },
];

/* ── Status Pill ──────────────────────────────────────── */

function StatusPill({ status }: { status: PlanStatus }) {
  const c = STATUS_PILLS[status] ?? STATUS_PILLS.draft;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
}

function GoalStatusPill({ status }: { status: GoalStatus }) {
  const c = GOAL_STATUS[status] ?? GOAL_STATUS.not_started;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
}

/* ── Milestone Progress ───────────────────────────────── */

function MilestoneProgress({ milestones }: { milestones?: { title: string; achieved: boolean }[] }) {
  if (!milestones || milestones.length === 0) return null;
  const achieved = milestones.filter((m) => m.achieved).length;
  const pct = Math.round((achieved / milestones.length) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full rounded-full bg-[#3B82F6] transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] font-mono text-[var(--text-muted)]">
        {achieved}/{milestones.length}
      </span>
    </div>
  );
}

/* ── Create / Edit Slide-Over ─────────────────────────── */

function PlanSlideOver({
  open,
  onClose,
  orgId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  orgId: string;
  onCreated: () => void;
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
      resetForm();
      onClose();
    } catch (err) {
      console.error("Failed to create care plan:", err);
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setParticipantId("");
    setAssessorName("");
    setAssessorRole("");
    setStartDate("");
    setReviewDate("");
    setNotes("");
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-[#0A0A0A] border-l border-[var(--border-base)] shadow-2xl overflow-y-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-base)]">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-[#3B82F6]" />
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">New Care Plan</h2>
              </div>
              <button onClick={onClose} className="p-1 rounded-md hover:bg-white/5 text-[var(--text-muted)]">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">Participant ID</label>
                <input
                  value={participantId}
                  onChange={(e) => setParticipantId(e.target.value)}
                  placeholder="Enter participant UUID"
                  className="w-full px-3 py-2 bg-[var(--surface-2)] border border-[var(--border-base)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]/50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">Plan Title</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Individual Support Plan — 2026"
                  className="w-full px-3 py-2 bg-[var(--surface-2)] border border-[var(--border-base)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]/50"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">Assessor Name</label>
                  <input
                    value={assessorName}
                    onChange={(e) => setAssessorName(e.target.value)}
                    placeholder="Dr. Smith"
                    className="w-full px-3 py-2 bg-[var(--surface-2)] border border-[var(--border-base)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">Assessor Role</label>
                  <input
                    value={assessorRole}
                    onChange={(e) => setAssessorRole(e.target.value)}
                    placeholder="Support Coordinator"
                    className="w-full px-3 py-2 bg-[var(--surface-2)] border border-[var(--border-base)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]/50"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--surface-2)] border border-[var(--border-base)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">Next Review</label>
                  <input
                    type="date"
                    value={reviewDate}
                    onChange={(e) => setReviewDate(e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--surface-2)] border border-[var(--border-base)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]/50"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Additional context or notes..."
                  className="w-full px-3 py-2 bg-[var(--surface-2)] border border-[var(--border-base)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]/50 resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[var(--border-base)]">
              <button onClick={onClose} className="stealth-btn-ghost">Cancel</button>
              <button
                onClick={handleSubmit}
                disabled={!title || !participantId || saving}
                className="stealth-btn-brand bg-[#3B82F6] hover:bg-[#2563EB] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saving ? "Creating..." : "Create Plan"}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ── Add Goal Modal ───────────────────────────────────── */

function AddGoalModal({
  open,
  onClose,
  plan,
  orgId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  plan: CarePlan | null;
  orgId: string;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetOutcome, setTargetOutcome] = useState("");
  const [category, setCategory] = useState<"core" | "capacity_building" | "capital">("core");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!title || !plan) return;
    setSaving(true);
    try {
      await createCareGoalAction({
        care_plan_id: plan.id,
        organization_id: orgId,
        participant_id: plan.participant_id,
        title,
        description: description || null,
        target_outcome: targetOutcome || null,
        support_category: category,
        priority: 0,
        milestones: [],
      });
      onCreated();
      setTitle("");
      setDescription("");
      setTargetOutcome("");
      onClose();
    } catch (err) {
      console.error("Failed to create goal:", err);
    } finally {
      setSaving(false);
    }
  };

  if (!open || !plan) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="w-full max-w-md bg-[#0A0A0A] border border-[var(--border-base)] rounded-xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-base)]">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-[#3B82F6]" />
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Add Goal</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-white/5 text-[var(--text-muted)]">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">Goal Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Improve social participation"
              className="w-full px-3 py-2 bg-[var(--surface-2)] border border-[var(--border-base)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]/50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Describe the goal in detail..."
              className="w-full px-3 py-2 bg-[var(--surface-2)] border border-[var(--border-base)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]/50 resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">Target Outcome</label>
            <input
              value={targetOutcome}
              onChange={(e) => setTargetOutcome(e.target.value)}
              placeholder="e.g., Attend community events 2x per week"
              className="w-full px-3 py-2 bg-[var(--surface-2)] border border-[var(--border-base)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]/50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">Support Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as typeof category)}
              className="w-full px-3 py-2 bg-[var(--surface-2)] border border-[var(--border-base)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]/50"
            >
              <option value="core">Core Supports</option>
              <option value="capacity_building">Capacity Building</option>
              <option value="capital">Capital Supports</option>
            </select>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[var(--border-base)]">
          <button onClick={onClose} className="stealth-btn-ghost">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={!title || saving}
            className="stealth-btn-brand bg-[#3B82F6] hover:bg-[#2563EB] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? "Adding..." : "Add Goal"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ── Detail View ──────────────────────────────────────── */

function PlanDetail({
  plan,
  onClose,
  orgId,
  onRefresh,
}: {
  plan: CarePlan;
  onClose: () => void;
  orgId: string;
  onRefresh: () => void;
}) {
  const [addGoalOpen, setAddGoalOpen] = useState(false);
  const goals = plan.care_goals ?? [];
  const domainEntries = Object.entries(plan.domains ?? {});

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="flex flex-col h-full"
    >
      {/* Detail Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-base)]">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onClose} className="p-1 rounded hover:bg-white/5 text-[var(--text-muted)]">
            <X className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-[var(--text-primary)] truncate">{plan.title}</h2>
              <StatusPill status={plan.status as PlanStatus} />
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-0.5 font-mono">{plan.participant_id.slice(0, 8)}…</p>
          </div>
        </div>
        <button className="stealth-btn-ghost text-xs">
          <Edit3 className="w-3.5 h-3.5 mr-1" />
          Edit Plan
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {/* Meta Grid */}
        <div className="grid grid-cols-2 gap-4">
          {plan.assessor_name && (
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)]">Assessor</span>
              <p className="text-sm text-[var(--text-primary)] mt-0.5">{plan.assessor_name}</p>
              {plan.assessor_role && <p className="text-xs text-[var(--text-muted)]">{plan.assessor_role}</p>}
            </div>
          )}
          {plan.start_date && (
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)]">Start Date</span>
              <p className="text-sm text-[var(--text-primary)] mt-0.5">{new Date(plan.start_date).toLocaleDateString("en-AU")}</p>
            </div>
          )}
          {plan.next_review_date && (
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)]">Next Review</span>
              <p className="text-sm text-[var(--text-primary)] mt-0.5">{new Date(plan.next_review_date).toLocaleDateString("en-AU")}</p>
            </div>
          )}
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)]">Created</span>
            <p className="text-sm text-[var(--text-primary)] mt-0.5">{new Date(plan.created_at).toLocaleDateString("en-AU")}</p>
          </div>
        </div>

        {/* Domains */}
        {domainEntries.length > 0 && (
          <div>
            <h3 className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)] mb-2">Domains</h3>
            <div className="space-y-1.5">
              {domainEntries.map(([key, val]) => (
                <div key={key} className="flex items-start gap-2 text-xs">
                  <span className="text-[#3B82F6] font-medium min-w-[100px]">{key}</span>
                  <span className="text-[var(--text-primary)]">{val}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Goals */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)]">
              Goals ({goals.length})
            </h3>
            <button
              onClick={() => setAddGoalOpen(true)}
              className="flex items-center gap-1 text-xs font-medium text-[#3B82F6] hover:text-[#60A5FA] transition-colors"
            >
              <Plus className="w-3 h-3" />
              Add Goal
            </button>
          </div>
          {goals.length === 0 ? (
            <div className="py-8 text-center">
              <Target className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-2 opacity-30" />
              <p className="text-xs text-[var(--text-muted)]">No goals added yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {goals.map((goal) => (
                <div
                  key={goal.id}
                  className="bg-[var(--surface-2)] border border-[var(--border-base)] rounded-lg p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-medium text-[var(--text-primary)]">{goal.title}</h4>
                        <GoalStatusPill status={goal.status} />
                      </div>
                      {goal.target_outcome && (
                        <p className="text-xs text-[var(--text-muted)] mt-1">{goal.target_outcome}</p>
                      )}
                    </div>
                    {goal.support_category && (
                      <span className="text-[9px] font-mono uppercase tracking-wider text-[var(--text-muted)] bg-white/5 px-1.5 py-0.5 rounded ml-2 whitespace-nowrap">
                        {goal.support_category.replace("_", " ")}
                      </span>
                    )}
                  </div>
                  {goal.milestones && goal.milestones.length > 0 && (
                    <div className="mt-3">
                      <MilestoneProgress milestones={goal.milestones} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notes */}
        {plan.notes && (
          <div>
            <h3 className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)] mb-2">Notes</h3>
            <p className="text-sm text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap">{plan.notes}</p>
          </div>
        )}
      </div>

      <AddGoalModal
        open={addGoalOpen}
        onClose={() => setAddGoalOpen(false)}
        plan={plan}
        orgId={orgId}
        onCreated={onRefresh}
      />
    </motion.div>
  );
}

/* ── Skeleton Row ─────────────────────────────────────── */

function SkeletonRow() {
  return (
    <div className="stealth-table-row animate-pulse">
      <div className="flex-1 flex items-center gap-3">
        <div className="w-24 h-3 rounded bg-white/5" />
        <div className="w-40 h-3 rounded bg-white/5" />
      </div>
      <div className="w-16 h-4 rounded bg-white/5" />
      <div className="w-8 h-3 rounded bg-white/5 ml-4" />
      <div className="w-20 h-3 rounded bg-white/5 ml-4" />
    </div>
  );
}

/* ── Main Page ────────────────────────────────────────── */

export default function CarePlansPage() {
  const { orgId } = useOrg();
  const { t } = useIndustryLexicon();

  const [plans, setPlans] = useState<CarePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"all" | PlanStatus>("all");
  const [search, setSearch] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<CarePlan | null>(null);
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

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  const filtered = useMemo(() => {
    let list = plans;
    if (tab !== "all") list = list.filter((p) => p.status === tab);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.participant_id.toLowerCase().includes(q) ||
          (p.assessor_name?.toLowerCase().includes(q))
      );
    }
    return list;
  }, [plans, tab, search]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative min-h-screen bg-[var(--background)]">
      <div className="stealth-noise" />
      {/* Atmospheric glow */}
      <div
        className="pointer-events-none absolute top-0 left-0 right-0 h-64 z-0"
        style={{ background: "radial-gradient(ellipse at center top, rgba(59,130,246,0.03) 0%, transparent 60%)" }}
      />

      <div className="relative z-10 flex h-screen">
        {/* Main List */}
        <div className={`flex-1 flex flex-col min-w-0 transition-all ${selectedPlan ? "max-w-[60%]" : ""}`}>
          {/* Header */}
          <div className="px-6 pt-8 pb-0 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-[#3B82F6] mb-1">CARE PLANS</p>
                <h1 className="text-xl font-semibold text-[var(--text-primary)] tracking-tight">
                  {t("Participant")} Plans
                </h1>
                <p className="text-sm text-[var(--text-muted)] mt-1">
                  Track goals, milestones, and review schedules for every participant.
                </p>
              </div>
              <button
                onClick={() => setCreateOpen(true)}
                className="stealth-btn-brand bg-[#3B82F6] hover:bg-[#2563EB]"
              >
                <Plus className="w-4 h-4" />
                New Care Plan
              </button>
            </div>

            {/* Tabs */}
            <div className="stealth-tabs">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  data-active={tab === t.key}
                  className="stealth-tab"
                >
                  {t.label}
                  {t.key !== "all" && (
                    <span className="ml-1.5 text-[10px] font-mono text-[var(--text-muted)]">
                      {plans.filter((p) => p.status === t.key).length}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Search */}
          <div className="px-6 py-3">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search plans..."
                className="w-full pl-9 pr-3 py-2 bg-[var(--surface-2)] border border-[var(--border-base)] rounded-lg text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]/50"
              />
            </div>
          </div>

          {/* Table Header */}
          <div className="stealth-table-header px-6">
            <span className="flex-[2]">{t("Participant")}</span>
            <span className="flex-[3]">Title</span>
            <span className="flex-1">Status</span>
            <span className="flex-1 text-center">Goals</span>
            <span className="flex-[1.5]">Next Review</span>
          </div>

          {/* Table Body */}
          <div className="flex-1 overflow-y-auto px-2">
            {loading && plans.length === 0 && (
              <div className="px-4">
                {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
              </div>
            )}

            {!loading && filtered.length === 0 && (
              <div className="stealth-empty-state">
                <div className="stealth-empty-state-icon">
                  <ClipboardList className="w-5 h-5 text-[var(--text-muted)]" />
                </div>
                <p className="stealth-empty-state-title">
                  {search || tab !== "all" ? "No plans match" : "No care plans yet"}
                </p>
                <p className="stealth-empty-state-desc">
                  {search || tab !== "all"
                    ? "Try adjusting your search or filters."
                    : "No care plans yet. Create one to begin tracking participant goals."}
                </p>
                {!search && tab === "all" && (
                  <button
                    onClick={() => setCreateOpen(true)}
                    className="stealth-btn-brand bg-[#3B82F6] hover:bg-[#2563EB] mt-2"
                  >
                    <Plus className="w-4 h-4" />
                    Create First Plan
                  </button>
                )}
              </div>
            )}

            <AnimatePresence mode="popLayout">
              {filtered.map((plan, idx) => {
                const goalCount = plan.care_goals?.length ?? 0;
                const isSelected = selectedPlan?.id === plan.id;
                return (
                  <motion.div
                    key={plan.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ delay: idx * 0.015 }}
                    data-selected={isSelected}
                    onClick={() => setSelectedPlan(plan)}
                    className={`stealth-table-row mx-4 cursor-pointer rounded-lg ${isSelected ? "bg-[#3B82F6]/5 border-[#3B82F6]/10" : ""}`}
                  >
                    <span className="flex-[2] text-sm text-[var(--text-muted)] font-mono truncate">
                      {plan.participant_id.slice(0, 8)}…
                    </span>
                    <span className="flex-[3] text-sm text-[var(--text-primary)] font-medium truncate">
                      {plan.title}
                    </span>
                    <span className="flex-1">
                      <StatusPill status={plan.status as PlanStatus} />
                    </span>
                    <span className="flex-1 text-center text-xs font-mono text-[var(--text-muted)]">
                      {goalCount}
                    </span>
                    <span className="flex-[1.5] text-xs text-[var(--text-muted)]">
                      {plan.next_review_date
                        ? new Date(plan.next_review_date).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })
                        : "—"}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)] opacity-40 ml-2" />
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>

        {/* Detail Panel */}
        <AnimatePresence>
          {selectedPlan && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: "40%", opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="border-l border-[var(--border-base)] bg-[var(--surface-1)] overflow-hidden"
            >
              <PlanDetail
                plan={selectedPlan}
                onClose={() => setSelectedPlan(null)}
                orgId={orgId ?? ""}
                onRefresh={loadPlans}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <PlanSlideOver
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        orgId={orgId ?? ""}
        onCreated={loadPlans}
      />
    </motion.div>
  );
}

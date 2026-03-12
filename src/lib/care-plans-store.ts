/**
 * Care Plans Store — Project Nightingale Phase 3
 *
 * Zustand store for care plans and goals management (NDIS participant plans).
 */

import { create } from "zustand";
import { isFresh } from "./cache-utils";
import {
  fetchCarePlansAction,
  createCarePlanAction,
  updateCarePlanAction,
  createCareGoalAction,
  updateCareGoalAction,
} from "@/app/actions/care";

/* ── Types ────────────────────────────────────────────── */

export type CarePlanStatus = "draft" | "active" | "under_review" | "archived";

export type CareGoalStatus = "not_started" | "in_progress" | "achieved" | "on_hold" | "abandoned";

export interface CareGoal {
  id: string;
  care_plan_id: string;
  organization_id: string;
  participant_id: string;
  ndis_goal_reference: string | null;
  support_category: "core" | "capacity_building" | "capital" | null;
  title: string;
  description: string | null;
  target_outcome: string | null;
  status: CareGoalStatus;
  priority: number; // 0-3
  milestones: { title: string; target_date?: string; achieved: boolean }[];
  evidence_notes: string | null;
  started_at: string | null;
  achieved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CarePlan {
  id: string;
  organization_id: string;
  participant_id: string;
  title: string;
  status: CarePlanStatus;
  start_date: string | null;
  review_date: string | null;
  next_review_date: string | null;
  domains: Record<string, string>;
  assessor_name: string | null;
  assessor_role: string | null;
  notes: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  goals?: CareGoal[];
}

/* ── Helpers ─────────────────────────────────────────── */

export const STATUS_CONFIG: Record<CarePlanStatus, { label: string; color: string; bg: string; border: string }> = {
  draft: { label: "Draft", color: "text-zinc-400", bg: "bg-zinc-500/10", border: "border-zinc-500/20" },
  active: { label: "Active", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  under_review: { label: "Under Review", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
  archived: { label: "Archived", color: "text-zinc-500", bg: "bg-zinc-500/10", border: "border-zinc-500/20" },
};

export const GOAL_STATUS_CONFIG: Record<CareGoalStatus, { label: string; color: string; bg: string; border: string }> = {
  not_started: { label: "Not Started", color: "text-zinc-400", bg: "bg-zinc-500/10", border: "border-zinc-500/20" },
  in_progress: { label: "In Progress", color: "text-sky-400", bg: "bg-sky-500/10", border: "border-sky-500/20" },
  achieved: { label: "Achieved", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  on_hold: { label: "On Hold", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
  abandoned: { label: "Abandoned", color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/20" },
};

export const DOMAIN_OPTIONS = [
  { value: "daily_living", label: "Daily Living" },
  { value: "community_participation", label: "Community Participation" },
  { value: "relationships", label: "Relationships" },
  { value: "health_wellbeing", label: "Health & Wellbeing" },
  { value: "lifelong_learning", label: "Lifelong Learning" },
  { value: "home_living", label: "Home & Living" },
  { value: "choice_control", label: "Choice & Control" },
  { value: "employment", label: "Employment" },
] as const;

export const PRIORITY_LABELS: Record<number, string> = {
  0: "None",
  1: "Low",
  2: "Medium",
  3: "High",
};

/* ── Store ───────────────────────────────────────────── */

interface CarePlansState {
  plans: CarePlan[];
  loading: boolean;
  error: string | null;
  selectedPlanId: string | null;
  _lastFetchedAt: number | null;

  // Actions
  fetchPlans: (orgId: string, participantId?: string) => Promise<void>;
  createPlan: (input: CreateCarePlanInput) => Promise<CarePlan | null>;
  updatePlan: (id: string, updates: Partial<CarePlan> & { status?: CarePlanStatus }) => Promise<boolean>;
  createGoal: (input: CreateCareGoalInput) => Promise<CareGoal | null>;
  updateGoal: (id: string, updates: Partial<CareGoal> & { status?: CareGoalStatus }) => Promise<boolean>;
  setSelectedPlanId: (id: string | null) => void;
}

export interface CreateCarePlanInput {
  organization_id: string;
  participant_id: string;
  title: string;
  start_date?: string | null;
  review_date?: string | null;
  next_review_date?: string | null;
  domains?: Record<string, string>;
  assessor_name?: string | null;
  assessor_role?: string | null;
  notes?: string | null;
}

export interface CreateCareGoalInput {
  care_plan_id: string;
  organization_id: string;
  participant_id: string;
  ndis_goal_reference?: string | null;
  support_category?: "core" | "capacity_building" | "capital" | null;
  title: string;
  description?: string | null;
  target_outcome?: string | null;
  priority?: number;
  milestones?: { title: string; target_date?: string; achieved: boolean }[];
}

export const useCarePlansStore = create<CarePlansState>((set, get) => ({
  plans: [],
  loading: false,
  error: null,
  selectedPlanId: null,
  _lastFetchedAt: null,

  fetchPlans: async (orgId, participantId) => {
    if (isFresh(get()._lastFetchedAt)) return;
    set({ loading: true, error: null });
    try {
      const data = await fetchCarePlansAction(orgId, participantId);

      const plans: CarePlan[] = (data ?? []).map((row: Record<string, unknown>) => {
        const goals = row.care_goals as Record<string, unknown>[] | null;
        return {
          ...row,
          goals: (goals ?? []) as unknown as CareGoal[],
        } as CarePlan;
      });

      set({ plans, loading: false, _lastFetchedAt: Date.now() });
    } catch (err) {
      set({ loading: false, error: (err as Error).message });
    }
  },

  createPlan: async (input) => {
    try {
      const data = await createCarePlanAction({ domains: {}, ...input });
      const plan = data as unknown as CarePlan;
      set((s) => ({ plans: [plan, ...s.plans] }));
      return plan;
    } catch (err) {
      set({ error: (err as Error).message });
      return null;
    }
  },

  updatePlan: async (id, updates) => {
    try {
      await updateCarePlanAction(id, updates);
      set((s) => ({
        plans: s.plans.map((p) => p.id === id ? { ...p, ...updates } : p),
      }));
      return true;
    } catch (err) {
      set({ error: (err as Error).message });
      return false;
    }
  },

  createGoal: async (input) => {
    try {
      const data = await createCareGoalAction({ priority: 0, milestones: [], ...input });
      const goal = data as unknown as CareGoal;
      // Add the goal to the corresponding plan's goals array
      set((s) => ({
        plans: s.plans.map((p) =>
          p.id === input.care_plan_id
            ? { ...p, goals: [...(p.goals ?? []), goal] }
            : p
        ),
      }));
      return goal;
    } catch (err) {
      set({ error: (err as Error).message });
      return null;
    }
  },

  updateGoal: async (id, updates) => {
    try {
      await updateCareGoalAction(id, updates);
      set((s) => ({
        plans: s.plans.map((p) => ({
          ...p,
          goals: (p.goals ?? []).map((g) =>
            g.id === id ? { ...g, ...updates } : g
          ),
        })),
      }));
      return true;
    } catch (err) {
      set({ error: (err as Error).message });
      return false;
    }
  },

  setSelectedPlanId: (id) => set({ selectedPlanId: id }),
}));

/* ── Selectors ───────────────────────────────────────── */

export function useSelectedPlan(): CarePlan | undefined {
  const plans = useCarePlansStore((s) => s.plans);
  const selectedPlanId = useCarePlansStore((s) => s.selectedPlanId);
  return plans.find((p) => p.id === selectedPlanId);
}

export function usePlansByStatus(status: CarePlanStatus): CarePlan[] {
  const plans = useCarePlansStore((s) => s.plans);
  return plans.filter((p) => p.status === status);
}

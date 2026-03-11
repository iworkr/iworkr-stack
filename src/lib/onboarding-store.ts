import { create } from "zustand";
import { persist } from "zustand/middleware";

export type OnboardingStep =
  | "sector"
  | "identity"
  | "trade"
  | "team"
  | "training"
  | "integrations"
  | "complete";

export type IndustryType = "trades" | "care";

export const STEP_ORDER: OnboardingStep[] = [
  "sector",
  "identity",
  "trade",
  "team",
  "training",
  "integrations",
  "complete",
];

export interface TeamInvite {
  email: string;
  id: string;
}

export interface OnboardingState {
  // Auth
  isAuthenticated: boolean;
  userEmail: string | null;
  userName: string | null;

  // Progress
  currentStep: OnboardingStep;
  completedSteps: OnboardingStep[];

  // Step data
  industryType: IndustryType | null;
  companyName: string;
  workspaceSlug: string;
  selectedTrade: string | null;
  teamInvites: TeamInvite[];
  commandMenuCompleted: boolean;
  connectedIntegrations: string[];

  // Backend link — the created organization ID (set after identity step syncs to Supabase)
  organizationId: string | null;

  // Actions
  setAuth: (email: string, name: string) => void;
  setIndustryType: (type: IndustryType) => void;
  setCompanyName: (name: string) => void;
  setTrade: (trade: string) => void;
  addTeamInvite: (email: string) => void;
  removeTeamInvite: (id: string) => void;
  setCommandMenuCompleted: () => void;
  toggleIntegration: (name: string) => void;
  setOrganizationId: (id: string) => void;
  advanceStep: () => void;
  goToStep: (step: OnboardingStep) => void;
  reset: () => void;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

const initialState = {
  isAuthenticated: false,
  userEmail: null,
  userName: null,
  currentStep: "sector" as OnboardingStep,
  completedSteps: [] as OnboardingStep[],
  industryType: null as IndustryType | null,
  companyName: "",
  workspaceSlug: "",
  selectedTrade: null,
  teamInvites: [] as TeamInvite[],
  commandMenuCompleted: false,
  connectedIntegrations: [] as string[],
  organizationId: null,
};

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setAuth: (email, name) =>
        set({ isAuthenticated: true, userEmail: email, userName: name }),

      setIndustryType: (type) => set({ industryType: type }),

      setCompanyName: (name) =>
        set({ companyName: name, workspaceSlug: slugify(name) }),

      setTrade: (trade) => set({ selectedTrade: trade }),

      addTeamInvite: (email) =>
        set((state) => ({
          teamInvites: [
            ...state.teamInvites,
            { email, id: crypto.randomUUID() },
          ],
        })),

      removeTeamInvite: (id) =>
        set((state) => ({
          teamInvites: state.teamInvites.filter((t) => t.id !== id),
        })),

      setCommandMenuCompleted: () => set({ commandMenuCompleted: true }),

      setOrganizationId: (id) => set({ organizationId: id }),

      toggleIntegration: (name) =>
        set((state) => {
          const connected = state.connectedIntegrations.includes(name);
          return {
            connectedIntegrations: connected
              ? state.connectedIntegrations.filter((n) => n !== name)
              : [...state.connectedIntegrations, name],
          };
        }),

      advanceStep: () => {
        const { currentStep, completedSteps } = get();
        const currentIndex = STEP_ORDER.indexOf(currentStep);
        const nextStep = STEP_ORDER[currentIndex + 1];
        if (nextStep) {
          set({
            currentStep: nextStep,
            completedSteps: [...new Set([...completedSteps, currentStep])],
          });
        }
      },

      goToStep: (step) => set({ currentStep: step }),

      reset: () => set(initialState),
    }),
    {
      name: "iworkr-onboarding",
    }
  )
);

export function getStepProgress(step: OnboardingStep): number {
  const index = STEP_ORDER.indexOf(step);
  return ((index + 1) / STEP_ORDER.length) * 100;
}

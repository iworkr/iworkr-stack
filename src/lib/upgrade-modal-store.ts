import { create } from "zustand";

interface UpgradeModalState {
  open: boolean;
  /** Optional: pre-select a plan when opening */
  preselectedPlan: string | null;
  /** Optional: show a specific feature that triggered the upgrade */
  triggerFeature: string | null;
  triggerDescription: string | null;

  openUpgrade: (opts?: {
    plan?: string;
    feature?: string;
    description?: string;
  }) => void;
  closeUpgrade: () => void;
}

export const useUpgradeModal = create<UpgradeModalState>((set) => ({
  open: false,
  preselectedPlan: null,
  triggerFeature: null,
  triggerDescription: null,

  openUpgrade: (opts) =>
    set({
      open: true,
      preselectedPlan: opts?.plan ?? null,
      triggerFeature: opts?.feature ?? null,
      triggerDescription: opts?.description ?? null,
    }),

  closeUpgrade: () =>
    set({
      open: false,
      preselectedPlan: null,
      triggerFeature: null,
      triggerDescription: null,
    }),
}));

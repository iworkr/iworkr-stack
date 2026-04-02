/**
 * @module lib/stores/useCommandStore.ts
 * @status STABLE
 * @description Zustand store — useCommandStore
 * @lastReview 2026-03-28
 */
"use client";

import { create } from "zustand";

interface CommandState {
  isShortcutModalOpen: boolean;
  setShortcutModalOpen: (open: boolean) => void;
  toggleShortcutModal: () => void;
}

export const useCommandStore = create<CommandState>((set) => ({
  isShortcutModalOpen: false,
  setShortcutModalOpen: (open) => set({ isShortcutModalOpen: open }),
  toggleShortcutModal: () =>
    set((state) => ({ isShortcutModalOpen: !state.isShortcutModalOpen })),
}));


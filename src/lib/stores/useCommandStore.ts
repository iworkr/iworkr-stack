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


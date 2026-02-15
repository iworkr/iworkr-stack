import { create } from "zustand";
import {
  formTemplates as initialTemplates,
  formSubmissions as initialSubmissions,
  type FormTemplate,
  type FormSubmission,
} from "./forms-data";

/* ── Types ────────────────────────────────────────────── */

export type FormsTab = "my_forms" | "library" | "submissions";

/* ── Store ────────────────────────────────────────────── */

interface FormsState {
  templates: FormTemplate[];
  submissions: FormSubmission[];
  activeTab: FormsTab;
  searchQuery: string;

  setActiveTab: (tab: FormsTab) => void;
  setSearchQuery: (q: string) => void;

  archiveTemplate: (id: string) => void;
  duplicateTemplate: (id: string) => void;
}

export const useFormsStore = create<FormsState>((set, get) => ({
  templates: initialTemplates,
  submissions: initialSubmissions,
  activeTab: "my_forms",
  searchQuery: "",

  setActiveTab: (tab) => set({ activeTab: tab }),
  setSearchQuery: (q) => set({ searchQuery: q }),

  archiveTemplate: (id) =>
    set((s) => ({
      templates: s.templates.map((t) =>
        t.id === id ? { ...t, status: "archived" as const } : t
      ),
    })),

  duplicateTemplate: (id) => {
    const original = get().templates.find((t) => t.id === id);
    if (!original) return;
    const dupe: FormTemplate = {
      ...original,
      id: `frm-${Date.now()}`,
      title: `${original.title} (Copy)`,
      source: "custom",
      status: "draft",
      version: 1,
      usedCount: 0,
      lastEdited: "Just now",
      createdBy: "Mike Thompson",
      verified: false,
    };
    set((s) => ({ templates: [dupe, ...s.templates] }));
  },
}));

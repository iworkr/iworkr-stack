/**
 * @module lib/stores/site-editor-store
 * @status STABLE
 * @description Zustand store for Loom site editor — blocks, pages, selection, global styles.
 * @lastReview 2026-03-28
 */
import { create } from "zustand";
import type {
  SiteBlock,
  SiteBlockType,
  SiteBlockContentMap,
  SiteGlobalStyles,
  SiteSettings,
  SitePage,
} from "@/components/site-editor/types";
import { makeSiteBlockId } from "@/components/site-editor/types";

interface SiteEditorState {
  siteId: string | null;
  pageId: string | null;
  blocks: SiteBlock[];
  activeBlockId: string | null;
  editingBlockId: string | null;
  globalStyles: SiteGlobalStyles;
  siteSettings: SiteSettings;
  pages: SitePage[];
  isDirty: boolean;

  setSiteId: (id: string | null) => void;
  setPageId: (id: string | null) => void;
  setBlocks: (blocks: SiteBlock[]) => void;
  addBlock: <T extends SiteBlockType>(
    type: T,
    content: SiteBlockContentMap[T],
    index?: number,
    opts?: { locked?: boolean; deletable?: boolean },
  ) => void;
  removeBlock: (id: string) => void;
  updateBlockContent: <T extends SiteBlockType>(
    id: string,
    patch: Partial<SiteBlockContentMap[T]>,
  ) => void;
  reorderBlocks: (oldIndex: number, newIndex: number) => void;
  setActiveBlock: (id: string | null) => void;
  setEditingBlock: (id: string | null) => void;
  setGlobalStyles: (patch: Partial<SiteGlobalStyles>) => void;
  setSiteSettings: (patch: Partial<SiteSettings>) => void;
  setPages: (pages: SitePage[]) => void;
  markClean: () => void;
  toJSON: () => { blocks: SiteBlock[]; globalStyles: SiteGlobalStyles };
  reset: () => void;
}

const DEFAULT_STYLES: SiteGlobalStyles = {
  primaryColor: "#10B981",
  secondaryColor: "#0D9488",
  fontHeading: "Inter",
  fontBody: "Inter",
  buttonRadius: 8,
  headerStyle: "sticky",
  footerStyle: "standard",
};

const DEFAULT_SETTINGS: SiteSettings = {
  name: "",
  subdomain: "",
  customDomain: null,
  isPublished: false,
  domainVerified: false,
};

export const useSiteEditorStore = create<SiteEditorState>((set, get) => ({
  siteId: null,
  pageId: null,
  blocks: [],
  activeBlockId: null,
  editingBlockId: null,
  globalStyles: { ...DEFAULT_STYLES },
  siteSettings: { ...DEFAULT_SETTINGS },
  pages: [],
  isDirty: false,

  setSiteId: (id) => set({ siteId: id }),
  setPageId: (id) => set({ pageId: id }),

  setBlocks: (blocks) => set({ blocks, isDirty: true }),

  addBlock: (type, content, index, opts) => {
    const block: SiteBlock = {
      id: makeSiteBlockId(),
      type,
      content,
      locked: opts?.locked,
      deletable: opts?.deletable ?? true,
    };
    set((s) => {
      const next = [...s.blocks];
      if (index !== undefined && index >= 0 && index <= next.length) {
        next.splice(index, 0, block);
      } else {
        next.push(block);
      }
      return { blocks: next, isDirty: true };
    });
  },

  removeBlock: (id) =>
    set((s) => ({
      blocks: s.blocks.filter((b) => {
        if (b.id !== id) return true;
        return b.locked === true;
      }),
      activeBlockId: s.activeBlockId === id ? null : s.activeBlockId,
      editingBlockId: s.editingBlockId === id ? null : s.editingBlockId,
      isDirty: true,
    })),

  updateBlockContent: (id, patch) =>
    set((s) => ({
      blocks: s.blocks.map((b) =>
        b.id === id ? { ...b, content: { ...b.content, ...patch } } : b,
      ),
      isDirty: true,
    })),

  reorderBlocks: (oldIndex, newIndex) =>
    set((s) => {
      const next = [...s.blocks];
      if (next[oldIndex]?.locked || next[newIndex]?.locked) return s;
      const [moved] = next.splice(oldIndex, 1);
      next.splice(newIndex, 0, moved);
      return { blocks: next, isDirty: true };
    }),

  setActiveBlock: (id) => set({ activeBlockId: id }),
  setEditingBlock: (id) => set({ editingBlockId: id }),

  setGlobalStyles: (patch) =>
    set((s) => ({
      globalStyles: { ...s.globalStyles, ...patch },
      isDirty: true,
    })),

  setSiteSettings: (patch) =>
    set((s) => ({
      siteSettings: { ...s.siteSettings, ...patch },
    })),

  setPages: (pages) => set({ pages }),
  markClean: () => set({ isDirty: false }),

  toJSON: () => ({
    blocks: get().blocks,
    globalStyles: get().globalStyles,
  }),

  reset: () =>
    set({
      siteId: null,
      pageId: null,
      blocks: [],
      activeBlockId: null,
      editingBlockId: null,
      globalStyles: { ...DEFAULT_STYLES },
      siteSettings: { ...DEFAULT_SETTINGS },
      pages: [],
      isDirty: false,
    }),
}));

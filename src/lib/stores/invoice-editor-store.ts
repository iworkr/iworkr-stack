/**
 * @module lib/stores/invoice-editor-store
 * @status STABLE
 * @description Zustand store for Moneta invoice canvas — blocks, totals, workspace branding.
 * @lastReview 2026-03-28
 */
import { create } from "zustand";
import type {
  InvoiceBlock,
  InvoiceBlockType,
  GlobalSettings,
  BlockContentMap,
  WorkspaceBrand,
} from "@/components/finance/editor/types";
import { makeBlockId } from "@/components/finance/editor/types";
import { calcTotals, type InvoiceTotals } from "@/components/finance/editor/math";

interface EditorState {
  blocks: InvoiceBlock[];
  activeBlockId: string | null;
  editingBlockId: string | null;
  globalSettings: GlobalSettings;
  workspace: WorkspaceBrand;
  invoiceId: string | null;
  templateId: string | null;

  setBlocks: (blocks: InvoiceBlock[]) => void;
  addBlock: <T extends InvoiceBlockType>(
    type: T,
    content: BlockContentMap[T],
    index?: number,
    opts?: { locked?: boolean; deletable?: boolean },
  ) => void;
  removeBlock: (id: string) => void;
  updateBlockContent: <T extends InvoiceBlockType>(
    id: string,
    patch: Partial<BlockContentMap[T]>,
  ) => void;
  reorderBlocks: (oldIndex: number, newIndex: number) => void;
  setActiveBlock: (id: string | null) => void;
  setEditingBlock: (id: string | null) => void;
  setGlobalSettings: (patch: Partial<GlobalSettings>) => void;
  setWorkspace: (ws: WorkspaceBrand) => void;
  setInvoiceId: (id: string | null) => void;
  getTotals: () => InvoiceTotals;
  toJSON: () => {
    blocks: InvoiceBlock[];
    globalSettings: GlobalSettings;
  };
  reset: () => void;
}

const DEFAULT_SETTINGS: GlobalSettings = {
  brandColor: "#10B981",
  fontFamily: "Inter",
  currency: "AUD",
  taxInclusive: false,
  taxRate: 10,
  discountType: null,
  discountValue: 0,
};

const DEFAULT_WORKSPACE: WorkspaceBrand = {
  name: "Your Company",
  logo_url: null,
  brand_color_hex: "#10B981",
  tax_id: null,
  address: null,
  email: null,
  phone: null,
};

export const useInvoiceEditorStore = create<EditorState>((set, get) => ({
  blocks: [],
  activeBlockId: null,
  editingBlockId: null,
  globalSettings: { ...DEFAULT_SETTINGS },
  workspace: { ...DEFAULT_WORKSPACE },
  invoiceId: null,
  templateId: null,

  setBlocks: (blocks) => set({ blocks }),

  addBlock: (type, content, index, opts) => {
    const block: InvoiceBlock = {
      id: makeBlockId(),
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
      return { blocks: next };
    });
  },

  removeBlock: (id) =>
    set((s) => ({
      blocks: s.blocks.filter((b) => {
        if (b.id !== id) return true;
        return b.locked === true ? true : false;
      }),
      activeBlockId: s.activeBlockId === id ? null : s.activeBlockId,
      editingBlockId: s.editingBlockId === id ? null : s.editingBlockId,
    })),

  updateBlockContent: (id, patch) =>
    set((s) => ({
      blocks: s.blocks.map((b) =>
        b.id === id
          ? { ...b, content: { ...b.content, ...patch } }
          : b,
      ),
    })),

  reorderBlocks: (oldIndex, newIndex) =>
    set((s) => {
      const next = [...s.blocks];
      if (next[oldIndex]?.locked || next[newIndex]?.locked) return s;
      const [moved] = next.splice(oldIndex, 1);
      next.splice(newIndex, 0, moved);
      return { blocks: next };
    }),

  setActiveBlock: (id) => set({ activeBlockId: id }),
  setEditingBlock: (id) => set({ editingBlockId: id }),

  setGlobalSettings: (patch) =>
    set((s) => ({
      globalSettings: { ...s.globalSettings, ...patch },
    })),

  setWorkspace: (ws) => set({ workspace: ws }),
  setInvoiceId: (id) => set({ invoiceId: id }),

  getTotals: () => calcTotals(get().blocks, get().globalSettings),

  toJSON: () => ({
    blocks: get().blocks,
    globalSettings: get().globalSettings,
  }),

  reset: () =>
    set({
      blocks: [],
      activeBlockId: null,
      editingBlockId: null,
      globalSettings: { ...DEFAULT_SETTINGS },
      invoiceId: null,
      templateId: null,
    }),
}));

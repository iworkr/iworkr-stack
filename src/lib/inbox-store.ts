import { create } from "zustand";
import { inboxItems, type InboxItem } from "./data";

/* ── Inbox tab types ─────────────────────────────────── */
export type InboxTab = "all" | "unread" | "snoozed";

/* ── Store interface ─────────────────────────────────── */
interface InboxStore {
  items: InboxItem[];
  selectedId: string | null;
  focusedIndex: number;
  activeTab: InboxTab;
  replyText: string;

  /* Derived selectors */
  getFilteredItems: () => InboxItem[];
  getSelectedItem: () => InboxItem | undefined;
  getUnreadCount: () => number;

  /* Actions */
  setSelectedId: (id: string | null) => void;
  setFocusedIndex: (index: number) => void;
  setActiveTab: (tab: InboxTab) => void;
  setReplyText: (text: string) => void;

  /* Triage */
  markAsRead: (id: string) => void;
  archive: (id: string) => InboxItem | undefined;
  unarchive: (item: InboxItem) => void;
  snooze: (id: string, until: string) => InboxItem | undefined;
  unsnooze: (item: InboxItem) => void;

  /* Reply */
  sendReply: (id: string, text: string) => void;

  /* Navigation */
  moveDown: () => void;
  moveUp: () => void;
  selectFocused: () => void;
}

export const useInboxStore = create<InboxStore>((set, get) => ({
  items: inboxItems.map((item) => ({ ...item, archived: false, snoozedUntil: null })),
  selectedId: inboxItems[0]?.id || null,
  focusedIndex: 0,
  activeTab: "all",
  replyText: "",

  /* ── Derived ───────────────────────────────────────── */
  getFilteredItems: () => {
    const { items, activeTab } = get();
    switch (activeTab) {
      case "unread":
        return items.filter((i) => !i.read && !i.archived && !i.snoozedUntil);
      case "snoozed":
        return items.filter((i) => !!i.snoozedUntil && !i.archived);
      default:
        return items.filter((i) => !i.archived && !i.snoozedUntil);
    }
  },

  getSelectedItem: () => {
    const { items, selectedId } = get();
    return items.find((i) => i.id === selectedId);
  },

  getUnreadCount: () => {
    const { items } = get();
    return items.filter((i) => !i.read && !i.archived && !i.snoozedUntil).length;
  },

  /* ── Setters ───────────────────────────────────────── */
  setSelectedId: (id) => set({ selectedId: id }),
  setFocusedIndex: (index) => set({ focusedIndex: index }),
  setActiveTab: (tab) => {
    set({ activeTab: tab, focusedIndex: 0 });
    // Auto-select first item of new tab
    const filtered = get().getFilteredItems();
    set({ selectedId: filtered[0]?.id || null });
  },
  setReplyText: (text) => set({ replyText: text }),

  /* ── Triage actions ────────────────────────────────── */
  markAsRead: (id) =>
    set((s) => ({
      items: s.items.map((i) => (i.id === id ? { ...i, read: true } : i)),
    })),

  archive: (id) => {
    const item = get().items.find((i) => i.id === id);
    if (!item) return undefined;
    set((s) => ({
      items: s.items.map((i) => (i.id === id ? { ...i, archived: true } : i)),
    }));
    // Move selection to next visible item
    const filtered = get().getFilteredItems();
    const idx = get().focusedIndex;
    const next = filtered[idx] || filtered[idx - 1] || filtered[0];
    set({
      selectedId: next?.id || null,
      focusedIndex: Math.min(idx, Math.max(filtered.length - 1, 0)),
    });
    return item;
  },

  unarchive: (item) =>
    set((s) => ({
      items: s.items.map((i) => (i.id === item.id ? { ...i, archived: false } : i)),
    })),

  snooze: (id, until) => {
    const item = get().items.find((i) => i.id === id);
    if (!item) return undefined;
    set((s) => ({
      items: s.items.map((i) => (i.id === id ? { ...i, snoozedUntil: until } : i)),
    }));
    // Move selection to next visible item
    const filtered = get().getFilteredItems();
    const idx = get().focusedIndex;
    const next = filtered[idx] || filtered[idx - 1] || filtered[0];
    set({
      selectedId: next?.id || null,
      focusedIndex: Math.min(idx, Math.max(filtered.length - 1, 0)),
    });
    return item;
  },

  unsnooze: (item) =>
    set((s) => ({
      items: s.items.map((i) => (i.id === item.id ? { ...i, snoozedUntil: null } : i)),
    })),

  /* ── Reply ─────────────────────────────────────────── */
  sendReply: (id, text) => {
    if (!text.trim()) return;
    // Mark as read on reply
    set((s) => ({
      items: s.items.map((i) => (i.id === id ? { ...i, read: true } : i)),
      replyText: "",
    }));
  },

  /* ── Navigation ────────────────────────────────────── */
  moveDown: () => {
    const filtered = get().getFilteredItems();
    const newIndex = Math.min(get().focusedIndex + 1, filtered.length - 1);
    const item = filtered[newIndex];
    set({ focusedIndex: newIndex, selectedId: item?.id || null });
  },

  moveUp: () => {
    const filtered = get().getFilteredItems();
    const newIndex = Math.max(get().focusedIndex - 1, 0);
    const item = filtered[newIndex];
    set({ focusedIndex: newIndex, selectedId: item?.id || null });
  },

  selectFocused: () => {
    const filtered = get().getFilteredItems();
    const item = filtered[get().focusedIndex];
    if (item) {
      set({ selectedId: item.id });
      // Mark as read on select
      get().markAsRead(item.id);
    }
  },
}));

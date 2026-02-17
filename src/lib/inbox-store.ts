import { create } from "zustand";
import { type InboxItem } from "./data";
import {
  getNotifications,
  markRead,
  archiveNotification,
  unarchiveNotification,
  snoozeNotification,
  unsnoozeNotification,
  sendReplyAction,
} from "@/app/actions/notifications";

/* ── Inbox tab types ─────────────────────────────────── */
export type InboxTab = "all" | "unread" | "snoozed";

/* ── Helper function to generate initials ─────────────── */
function getInitials(name: string): string {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

/* ── Map server notification to InboxItem ────────────── */
function mapNotification(n: any): InboxItem {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body || "",
    time: n.created_at
      ? new Date(n.created_at).toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        })
      : "",
    read: n.read || false,
    jobRef: n.related_job_id || undefined,
    sender: n.sender_name || "System",
    senderInitials: getInitials(n.sender_name || "System"),
    context: n.context || undefined,
    snoozedUntil: n.snoozed_until || null,
    archived: n.archived || false,
  };
}

/* ── Filter mode type ────────────────────────────────── */
export type InboxFilter = "all" | "mentions";

/* ── Store interface ─────────────────────────────────── */
interface InboxStore {
  items: InboxItem[];
  loaded: boolean;
  loading: boolean;
  selectedId: string | null;
  focusedIndex: number;
  activeTab: InboxTab;
  filter: InboxFilter;
  replyText: string;

  loadFromServer: (orgId: string) => Promise<void>;
  refresh: () => Promise<void>;
  addRealtimeItem: (payload: any) => void;

  /* Derived selectors */
  getFilteredItems: () => InboxItem[];
  getSelectedItem: () => InboxItem | undefined;
  getUnreadCount: () => number;

  /* Actions */
  setSelectedId: (id: string | null) => void;
  setFocusedIndex: (index: number) => void;
  setActiveTab: (tab: InboxTab) => void;
  setReplyText: (text: string) => void;
  toggleFilter: () => void;

  /* Triage — now server-synced */
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
  items: [],
  loaded: false,
  loading: false,
  selectedId: null,
  focusedIndex: 0,
  activeTab: "all",
  filter: "all",
  replyText: "",

  loadFromServer: async (_orgId: string) => {
    set({ loading: true });
    try {
      const result = await getNotifications();

      if (result.data && result.data.length > 0) {
        const mappedItems = result.data.map(mapNotification);
        set({
          items: mappedItems,
          loaded: true,
          loading: false,
          selectedId: mappedItems[0]?.id || null,
        });
      } else {
        // Empty server response = no notifications — show clean empty state
        set({
          items: [],
          loaded: true,
          loading: false,
          selectedId: null,
        });
      }
    } catch (error) {
      console.error("Failed to load inbox data:", error);
      set({ loading: false });
    }
  },

  refresh: async () => {
    try {
      const result = await getNotifications();
      if (result.data && result.data.length > 0) {
        const mappedItems = result.data.map(mapNotification);
        const { selectedId } = get();
        set({
          items: mappedItems,
          selectedId: mappedItems.find(i => i.id === selectedId) ? selectedId : mappedItems[0]?.id || null,
        });
      }
    } catch (error) {
      console.error("Failed to refresh inbox:", error);
    }
  },

  addRealtimeItem: (payload: any) => {
    const newItem = mapNotification(payload.new);
    set((s) => ({
      items: [newItem, ...s.items],
    }));
  },

  /* ── Derived ───────────────────────────────────────── */
  getFilteredItems: () => {
    const { items, activeTab, filter } = get();
    let result: InboxItem[];
    switch (activeTab) {
      case "unread":
        result = items.filter((i) => !i.read && !i.archived && !i.snoozedUntil);
        break;
      case "snoozed":
        result = items.filter((i) => !!i.snoozedUntil && !i.archived);
        break;
      default:
        result = items.filter((i) => !i.archived && !i.snoozedUntil);
    }
    if (filter === "mentions") {
      result = result.filter((i) => i.type === "mention");
    }
    return result;
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
    const filtered = get().getFilteredItems();
    set({ selectedId: filtered[0]?.id || null });
  },
  setReplyText: (text) => set({ replyText: text }),
  toggleFilter: () => {
    const next = get().filter === "all" ? "mentions" : "all";
    set({ filter: next, focusedIndex: 0 });
    const filtered = get().getFilteredItems();
    set({ selectedId: filtered[0]?.id || null });
  },

  /* ── Triage actions — optimistic + server sync ─────── */
  markAsRead: (id) => {
    // Optimistic update
    set((s) => ({
      items: s.items.map((i) => (i.id === id ? { ...i, read: true } : i)),
    }));
    // Fire-and-forget server sync
    markRead(id).catch(console.error);
  },

  archive: (id) => {
    const item = get().items.find((i) => i.id === id);
    if (!item) return undefined;

    // Optimistic update
    set((s) => ({
      items: s.items.map((i) => (i.id === id ? { ...i, archived: true, read: true } : i)),
    }));

    // Move selection to next visible item
    const filtered = get().getFilteredItems();
    const idx = get().focusedIndex;
    const next = filtered[idx] || filtered[idx - 1] || filtered[0];
    set({
      selectedId: next?.id || null,
      focusedIndex: Math.min(idx, Math.max(filtered.length - 1, 0)),
    });

    // Server sync
    archiveNotification(id).catch(console.error);
    return item;
  },

  unarchive: (item) => {
    // Optimistic update
    set((s) => ({
      items: s.items.map((i) => (i.id === item.id ? { ...i, archived: false } : i)),
    }));
    // Server sync
    unarchiveNotification(item.id).catch(console.error);
  },

  snooze: (id, until) => {
    const item = get().items.find((i) => i.id === id);
    if (!item) return undefined;

    // Convert friendly labels to ISO timestamps
    const snoozeUntil = resolveSnoozeTime(until);

    // Optimistic update
    set((s) => ({
      items: s.items.map((i) => (i.id === id ? { ...i, snoozedUntil: snoozeUntil } : i)),
    }));

    // Move selection to next visible item
    const filtered = get().getFilteredItems();
    const idx = get().focusedIndex;
    const next = filtered[idx] || filtered[idx - 1] || filtered[0];
    set({
      selectedId: next?.id || null,
      focusedIndex: Math.min(idx, Math.max(filtered.length - 1, 0)),
    });

    // Server sync with resolved ISO timestamp
    snoozeNotification(id, snoozeUntil).catch(console.error);
    return item;
  },

  unsnooze: (item) => {
    // Optimistic update
    set((s) => ({
      items: s.items.map((i) => (i.id === item.id ? { ...i, snoozedUntil: null } : i)),
    }));
    // Server sync
    unsnoozeNotification(item.id).catch(console.error);
  },

  /* ── Reply ─────────────────────────────────────────── */
  sendReply: (id, text) => {
    if (!text.trim()) return;
    // Mark as read on reply
    set((s) => ({
      items: s.items.map((i) => (i.id === id ? { ...i, read: true } : i)),
      replyText: "",
    }));
    // Persist reply to server
    sendReplyAction(id, text).catch(console.error);
    markRead(id).catch(console.error);
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
      get().markAsRead(item.id);
    }
  },
}));

/* ── Snooze time resolver ────────────────────────────── */
function resolveSnoozeTime(value: string): string {
  const now = new Date();

  switch (value) {
    case "later_today": {
      // 3 hours from now, or 5 PM today, whichever is sooner
      const threeHours = new Date(now.getTime() + 3 * 60 * 60 * 1000);
      const fivePM = new Date(now);
      fivePM.setHours(17, 0, 0, 0);
      return (threeHours < fivePM ? threeHours : fivePM).toISOString();
    }
    case "tomorrow": {
      // Tomorrow at 9 AM
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      return tomorrow.toISOString();
    }
    case "next_week": {
      // Next Monday at 9 AM
      const nextMonday = new Date(now);
      const daysUntilMonday = (8 - now.getDay()) % 7 || 7;
      nextMonday.setDate(nextMonday.getDate() + daysUntilMonday);
      nextMonday.setHours(9, 0, 0, 0);
      return nextMonday.toISOString();
    }
    default:
      // If it's already an ISO string, return as-is
      if (value.includes("T") || value.includes("-")) return value;
      // Fallback: 3 hours
      return new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString();
  }
}

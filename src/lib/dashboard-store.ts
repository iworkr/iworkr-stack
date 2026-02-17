"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Layout, LayoutItem, ResponsiveLayouts } from "react-grid-layout";

/* ── Widget Registry ────────────────────────────────────── */

export interface WidgetDef {
  id: string;
  label: string;
  description: string;
  icon: string; // lucide icon name
  defaultW: number;
  defaultH: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
}

export const WIDGET_REGISTRY: WidgetDef[] = [
  { id: "revenue",   label: "Revenue",       description: "Monthly revenue with sparkline chart",  icon: "TrendingUp",    defaultW: 2, defaultH: 2, minW: 1, minH: 1 },
  { id: "dispatch",  label: "Live Dispatch",  description: "Real-time technician locations",       icon: "Radio",         defaultW: 2, defaultH: 3, minW: 1, minH: 2 },
  { id: "inbox",     label: "Inbox",          description: "Unread notifications triage",          icon: "Inbox",         defaultW: 1, defaultH: 2, minW: 1, minH: 1 },
  { id: "schedule",  label: "My Schedule",    description: "Today's job schedule",                 icon: "Calendar",      defaultW: 1, defaultH: 2, minW: 1, minH: 1 },
  { id: "actions",   label: "Quick Actions",  description: "Create jobs, invoices, clients",       icon: "Zap",           defaultW: 1, defaultH: 2, minW: 1, minH: 1 },
  { id: "insights",  label: "AI Insights",    description: "Smart recommendations",                icon: "Sparkles",      defaultW: 1, defaultH: 2, minW: 1, minH: 1 },
  { id: "team",      label: "Team Status",    description: "Who's online and working",             icon: "Users",         defaultW: 1, defaultH: 2, minW: 1, minH: 1 },
  { id: "links",     label: "Quick Links",    description: "Custom shortcut buttons",              icon: "Link",          defaultW: 1, defaultH: 1, minW: 1, minH: 1 },
  { id: "notepad",   label: "Notepad",        description: "Scratch notes and reminders",          icon: "FileText",      defaultW: 1, defaultH: 2, minW: 1, minH: 1 },
];

/* ── Default Layout ─────────────────────────────────────── */

export const DEFAULT_LAYOUT: LayoutItem[] = [
  { i: "revenue",  x: 0, y: 0, w: 2, h: 2, minW: 1, minH: 1 },
  { i: "dispatch", x: 2, y: 0, w: 2, h: 3, minW: 1, minH: 2 },
  { i: "inbox",    x: 0, y: 2, w: 1, h: 2, minW: 1, minH: 1 },
  { i: "schedule", x: 1, y: 2, w: 1, h: 2, minW: 1, minH: 1 },
  { i: "actions",  x: 2, y: 3, w: 1, h: 2, minW: 1, minH: 1 },
  { i: "insights", x: 3, y: 3, w: 1, h: 2, minW: 1, minH: 1 },
];

/* ── Snapshot Types ─────────────────────────────────────── */

export interface DashboardSnapshot {
  revenue: {
    current: number;
    previous: number;
    growth_pct: number;
    history: { date: string; amount: number; invoice_count: number }[];
  };
  active_jobs: number;
  inbox_count: number;
  schedule: {
    id: string;
    job_id: string | null;
    title: string;
    location: string | null;
    start_time: string;
    end_time: string;
    status: string;
  }[];
  team: {
    user_id: string;
    name: string;
    initials: string;
    avatar_url: string | null;
    member_status: string;
  }[];
}

/* ── Store ──────────────────────────────────────────────── */

interface DashboardState {
  // Layout
  layouts: ResponsiveLayouts;
  activeWidgets: string[]; // ordered list of widget IDs on the board
  editMode: boolean;
  drawerOpen: boolean;

  // Snapshot data (aggregated)
  snapshot: DashboardSnapshot | null;
  snapshotLoading: boolean;
  snapshotFetchedAt: number | null;

  // Notepad
  notepadContent: string;

  // Quick Links
  quickLinks: { label: string; href: string; icon?: string }[];

  // Actions
  setLayouts: (layouts: ResponsiveLayouts) => void;
  setActiveWidgets: (widgets: string[]) => void;
  addWidget: (widgetId: string) => void;
  removeWidget: (widgetId: string) => void;
  setEditMode: (on: boolean) => void;
  setDrawerOpen: (on: boolean) => void;
  setSnapshot: (snap: DashboardSnapshot) => void;
  setSnapshotLoading: (loading: boolean) => void;
  setNotepadContent: (content: string) => void;
  setQuickLinks: (links: { label: string; href: string; icon?: string }[]) => void;
  resetLayout: () => void;
}

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set, get) => ({
      layouts: { lg: DEFAULT_LAYOUT },
      activeWidgets: DEFAULT_LAYOUT.map((l) => l.i),
      editMode: false,
      drawerOpen: false,

      snapshot: null,
      snapshotLoading: false,
      snapshotFetchedAt: null,

      notepadContent: "",
      quickLinks: [
        { label: "New Job", href: "/dashboard/jobs", icon: "Briefcase" },
        { label: "Schedule", href: "/dashboard/schedule", icon: "Calendar" },
        { label: "Finance", href: "/dashboard/finance", icon: "Banknote" },
      ],

      setLayouts: (layouts) => set({ layouts }),
      setActiveWidgets: (widgets) => set({ activeWidgets: widgets }),

      addWidget: (widgetId) => {
        const state = get();
        if (state.activeWidgets.includes(widgetId)) return;

        const def = WIDGET_REGISTRY.find((w) => w.id === widgetId);
        if (!def) return;

        const lgLayout = [...(state.layouts.lg || [])];
        // Place new widget at the bottom
        const maxY = lgLayout.reduce((max, l) => Math.max(max, l.y + l.h), 0);
        lgLayout.push({
          i: widgetId,
          x: 0,
          y: maxY,
          w: def.defaultW,
          h: def.defaultH,
          minW: def.minW,
          minH: def.minH,
        });

        set({
          activeWidgets: [...state.activeWidgets, widgetId],
          layouts: { ...state.layouts, lg: lgLayout },
        });
      },

      removeWidget: (widgetId) => {
        const state = get();
        set({
          activeWidgets: state.activeWidgets.filter((w) => w !== widgetId),
          layouts: {
            ...state.layouts,
            lg: (state.layouts.lg || []).filter((l) => l.i !== widgetId),
          },
        });
      },

      setEditMode: (on) => set({ editMode: on, drawerOpen: on ? get().drawerOpen : false }),
      setDrawerOpen: (on) => set({ drawerOpen: on }),

      setSnapshot: (snap) => set({ snapshot: snap, snapshotLoading: false, snapshotFetchedAt: Date.now() }),
      setSnapshotLoading: (loading) => set({ snapshotLoading: loading }),

      setNotepadContent: (content) => set({ notepadContent: content }),
      setQuickLinks: (links) => set({ quickLinks: links }),

      resetLayout: () =>
        set({
          layouts: { lg: DEFAULT_LAYOUT },
          activeWidgets: DEFAULT_LAYOUT.map((l) => l.i),
        }),
    }),
    {
      name: "iworkr-dashboard",
      partialize: (state) => ({
        layouts: state.layouts,
        activeWidgets: state.activeWidgets,
        notepadContent: state.notepadContent,
        quickLinks: state.quickLinks,
        snapshot: state.snapshot,
        snapshotFetchedAt: state.snapshotFetchedAt,
      }),
    }
  )
);

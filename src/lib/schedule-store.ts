import { create } from "zustand";
import { persist } from "zustand/middleware";
import { isFresh } from "./cache-utils";
import {
  type ScheduleBlock,
  type ScheduleBlockStatus,
  type Technician,
} from "./data";
import {
  getScheduleBlocks,
  getOrgTechnicians,
  getScheduleView,
  moveScheduleBlockServer,
  resizeScheduleBlockServer,
  deleteScheduleBlock as deleteBlockServer,
  updateScheduleBlock as updateBlockServer,
  assignJobToSchedule as assignJobServer,
  unscheduleJob as unscheduleJobServer,
  type BacklogJob,
  type ScheduleEvent,
} from "@/app/actions/schedule";

export type ViewScale = "day" | "week" | "month";

/* ── Helper function to generate initials ─────────────── */
function getInitials(name: string): string {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

/* ── Helper function to convert time to decimal hours ─── */
function timeToDecimalHours(timeStr: string): number {
  const date = new Date(timeStr);
  const hours = date.getHours();
  const minutes = date.getMinutes();
  return hours + minutes / 60;
}

/* ── Helper function to calculate duration in hours ────── */
function calculateDuration(startTime: string, endTime: string): number {
  const start = new Date(startTime);
  const end = new Date(endTime);
  return (end.getTime() - start.getTime()) / (1000 * 60 * 60);
}

/* ── Convert decimal hour to ISO timestamp for a given date ── */
function decimalHourToISO(date: string, hour: number): string {
  const d = new Date(date);
  const h = Math.floor(hour);
  const m = Math.round((hour - h) * 60);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

interface ScheduleState {
  blocks: ScheduleBlock[];
  technicians: Technician[];
  backlogJobs: BacklogJob[];
  scheduleEvents: ScheduleEvent[];
  loaded: boolean;
  loading: boolean;
  orgId: string | null;
  viewScale: ViewScale;
  selectedDate: string;
  draggingBlockId: string | null;
  peekBlockId: string | null;
  unscheduledDrawerOpen: boolean;

  loadFromServer: (orgId: string, date: string) => Promise<void>;
  refresh: () => Promise<void>;
  setViewScale: (scale: ViewScale) => void;
  setSelectedDate: (date: string) => void;
  setDraggingBlockId: (id: string | null) => void;
  setPeekBlockId: (id: string | null) => void;
  toggleUnscheduledDrawer: () => void;
  setUnscheduledDrawerOpen: (open: boolean) => void;

  moveBlock: (blockId: string, newStartHour: number, newTechId?: string) => void;
  resizeBlock: (blockId: string, newDuration: number) => void;
  deleteBlock: (blockId: string) => void;
  restoreBlock: (block: ScheduleBlock) => void;
  addBlock: (block: ScheduleBlock) => void;
  updateBlockStatus: (blockId: string, status: ScheduleBlockStatus) => void;

  /** Assign a backlog job to the schedule (drag-to-assign) */
  assignBacklogJob: (job: BacklogJob, technicianId: string, startHour: number) => Promise<void>;
  /** Unschedule a block — returns job to backlog */
  unscheduleBlock: (blockId: string) => void;

  _stale: boolean;
  _lastFetchedAt: number | null;

  /** Called by realtime when a schedule_block changes */
  handleRealtimeUpdate: () => void;
}

function mapServerBlock(b: any): ScheduleBlock {
  return {
    id: b.id,
    jobId: b.job_id || "",
    technicianId: b.technician_id || "",
    title: b.title,
    client: b.client_name || "",
    location: b.location || "",
    startHour: b.start_time ? timeToDecimalHours(b.start_time) : 0,
    duration: b.start_time && b.end_time ? calculateDuration(b.start_time, b.end_time) : 0,
    status: b.status,
    travelTime: b.travel_minutes || undefined,
    conflict: b.is_conflict || false,
  };
}

function mapServerTechnician(t: any): Technician {
  return {
    id: t.id,
    name: t.full_name || "",
    initials: getInitials(t.full_name || ""),
    skill: "general" as const,
    status: "offline" as const,
    hoursBooked: typeof t.hours_booked === "number" ? Math.round(t.hours_booked * 10) / 10 : 0,
    hoursAvailable: 8,
    avatar: undefined,
  };
}

export const useScheduleStore = create<ScheduleState>()(
  persist(
    (set, get) => ({
  blocks: [],
  technicians: [],
  backlogJobs: [],
  scheduleEvents: [],
  loaded: false,
  loading: false,
  orgId: null,
  viewScale: "day",
  selectedDate: new Date().toISOString().split("T")[0],
  draggingBlockId: null,
  peekBlockId: null,
  unscheduledDrawerOpen: false,
  _stale: true,
  _lastFetchedAt: null,

  loadFromServer: async (orgId: string, date: string) => {
    const state = get();
    if (state.loading) return;
    if (isFresh(state._lastFetchedAt) && state.orgId === orgId && state.selectedDate === date) return;

    const hasCache = state.blocks.length > 0 && state.orgId === orgId;
    set({ loading: !hasCache, orgId, selectedDate: date });
    try {
      // Try unified RPC first
      const { data } = await getScheduleView(orgId, date);

      if (data) {
        const mappedBlocks = (data.blocks || []).map(mapServerBlock);
        const mappedTechs = (data.technicians || []).map(mapServerTechnician);

        set({
          blocks: mappedBlocks,
          technicians: mappedTechs,
          backlogJobs: data.backlog || [],
          scheduleEvents: data.events || [],
          loaded: true,
          loading: false,
          _stale: false,
          _lastFetchedAt: Date.now(),
        });
        return;
      }

      // Fallback to old method
      const [blocksResult, techniciansResult] = await Promise.all([
        getScheduleBlocks(orgId, date),
        getOrgTechnicians(orgId),
      ]);

      const allBlocks: any[] = [];
      if (blocksResult.data) {
        Object.values(blocksResult.data).forEach((techBlocks: any) => {
          if (Array.isArray(techBlocks)) allBlocks.push(...techBlocks);
        });
      }
      const mappedBlocks2 = allBlocks.map(mapServerBlock);
      const mappedTechs2 = (techniciansResult.data || []).map(mapServerTechnician);

      set({
        blocks: mappedBlocks2,
        technicians: mappedTechs2,
        loaded: true,
        loading: false,
        _stale: false,
        _lastFetchedAt: Date.now(),
      });
    } catch (error) {
      console.error("Failed to load schedule data:", error);
      set({ loaded: true, loading: false });
    }
  },

  refresh: async () => {
    const { orgId, selectedDate } = get();
    if (!orgId) return;
    try {
      const { data } = await getScheduleView(orgId, selectedDate);
      if (data) {
        const mappedBlocks = (data.blocks || []).map(mapServerBlock);
        const mappedTechs = (data.technicians || []).map(mapServerTechnician);
        set({
          blocks: mappedBlocks,
          technicians: mappedTechs,
          backlogJobs: data.backlog || [],
          scheduleEvents: data.events || [],
          _lastFetchedAt: Date.now(),
          _stale: false,
        });
      }
    } catch {
      // silent refresh failure
    }
  },

  setViewScale: (scale) => set({ viewScale: scale }),
  setSelectedDate: (date) => set({ selectedDate: date }),
  setDraggingBlockId: (id) => set({ draggingBlockId: id }),
  setPeekBlockId: (id) => set({ peekBlockId: id }),
  toggleUnscheduledDrawer: () =>
    set((s) => ({ unscheduledDrawerOpen: !s.unscheduledDrawerOpen })),
  setUnscheduledDrawerOpen: (open) => set({ unscheduledDrawerOpen: open }),

  moveBlock: (blockId, newStartHour, newTechId) => {
    const block = get().blocks.find((b) => b.id === blockId);
    if (!block) return;
    const snappedHour = Math.round(newStartHour * 4) / 4;

    // Optimistic local update
    set((s) => ({
      blocks: s.blocks.map((b) =>
        b.id === blockId
          ? {
              ...b,
              startHour: snappedHour,
              ...(newTechId ? { technicianId: newTechId } : {}),
            }
          : b
      ),
    }));

    // Persist to server
    const date = get().selectedDate;
    const startISO = decimalHourToISO(date, snappedHour);
    const endISO = decimalHourToISO(date, snappedHour + block.duration);
    const techId = newTechId || block.technicianId;

    moveScheduleBlockServer(blockId, techId, startISO, endISO).catch((err) => {
      console.error("Failed to persist block move:", err);
    });
  },

  resizeBlock: (blockId, newDuration) => {
    const block = get().blocks.find((b) => b.id === blockId);
    if (!block) return;
    const snapped = Math.max(0.25, Math.round(newDuration * 4) / 4);

    // Optimistic local update
    set((s) => ({
      blocks: s.blocks.map((b) =>
        b.id === blockId ? { ...b, duration: snapped } : b
      ),
    }));

    // Persist to server
    const date = get().selectedDate;
    const endISO = decimalHourToISO(date, block.startHour + snapped);
    resizeScheduleBlockServer(blockId, endISO).catch((err) => {
      console.error("Failed to persist block resize:", err);
    });
  },

  deleteBlock: (blockId) => {
    const block = get().blocks.find((b) => b.id === blockId);
    if (!block) return;
    // Optimistic local delete
    set((s) => ({
      blocks: s.blocks.filter((b) => b.id !== blockId),
    }));

    // Persist to server
    deleteBlockServer(blockId).catch((err) => {
      console.error("Failed to persist block delete:", err);
    });
  },

  restoreBlock: (block) =>
    set((s) => ({
      blocks: [...s.blocks, block].sort((a, b) => a.startHour - b.startHour),
    })),

  addBlock: (block) =>
    set((s) => ({
      blocks: [...s.blocks, block].sort((a, b) => a.startHour - b.startHour),
    })),

  updateBlockStatus: (blockId, status) => {
    const prevBlock = get().blocks.find((b) => b.id === blockId);
    // Optimistic update
    set((s) => ({
      blocks: s.blocks.map((b) =>
        b.id === blockId ? { ...b, status } : b
      ),
    }));
    // Server sync with rollback on failure
    updateBlockServer(blockId, { status }).catch((err) => {
      console.error("Failed to persist status update:", err);
      if (prevBlock) {
        set((s) => ({
          blocks: s.blocks.map((b) =>
            b.id === blockId ? { ...b, status: prevBlock.status } : b
          ),
        }));
      }
    });
  },

  assignBacklogJob: async (job: BacklogJob, technicianId: string, startHour: number) => {
    const { orgId, selectedDate, backlogJobs } = get();
    if (!orgId) return;

    const duration = (job.estimated_duration_minutes || 60) / 60;
    const snappedHour = Math.round(startHour * 4) / 4;

    const startISO = decimalHourToISO(selectedDate, snappedHour);
    const endISO = decimalHourToISO(selectedDate, snappedHour + duration);

    // Optimistic: create a temp block and remove from backlog
    const tempBlock: ScheduleBlock = {
      id: `temp-${job.id}`,
      jobId: job.display_id,
      technicianId,
      title: job.title,
      client: job.client_name || "",
      location: job.location || "",
      startHour: snappedHour,
      duration,
      status: "scheduled",
      travelTime: undefined,
      conflict: false,
    };

    set((s) => ({
      blocks: [...s.blocks, tempBlock].sort((a, b) => a.startHour - b.startHour),
      backlogJobs: s.backlogJobs.filter((j) => j.id !== job.id),
    }));

    // Persist to server
    const result = await assignJobServer(orgId, job.id, technicianId, startISO, endISO);

    if (result.error) {
      // Rollback
      set((s) => ({
        blocks: s.blocks.filter((b) => b.id !== tempBlock.id),
        backlogJobs: [...s.backlogJobs, job],
      }));
      return;
    }

    // Refresh to get the real block_id from the server
    get().refresh();
  },

  unscheduleBlock: (blockId: string) => {
    const block = get().blocks.find((b) => b.id === blockId);
    // Optimistic: remove block from schedule
    set((s) => ({
      blocks: s.blocks.filter((b) => b.id !== blockId),
    }));

    // Persist to server
    unscheduleJobServer(blockId).then(() => {
      get().refresh();
    }).catch((err) => {
      console.error("Failed to unschedule:", err);
      // Restore on failure
      if (block) {
        set((s) => ({
          blocks: [...s.blocks, block].sort((a, b) => a.startHour - b.startHour),
        }));
      }
    });
  },

  handleRealtimeUpdate: () => {
    get().refresh();
  },
    }),
    {
      name: "iworkr-schedule",
      onRehydrateStorage: () => (state) => {
        if (state && state.blocks && state.blocks.length > 0) {
          state.loaded = true;
        }
      },
      partialize: (state) => ({
        blocks: state.blocks,
        technicians: state.technicians,
        scheduleEvents: state.scheduleEvents,
        backlogJobs: state.backlogJobs,
        orgId: state.orgId,
        selectedDate: state.selectedDate,
        _lastFetchedAt: state._lastFetchedAt,
      }),
    }
  )
);

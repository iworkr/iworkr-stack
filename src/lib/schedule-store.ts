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
import { useToastStore } from "@/components/app/action-toast";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/lib/auth-store";

export type ViewScale = "day" | "week" | "month";

/* ── Toast helper (callable outside React) ────────────── */
function showToast(message: string, type: "success" | "error" | "info" = "error", undoAction?: () => void) {
  useToastStore.getState().addToast(message, undoAction, type);
}

/* ── Mutation guard: prevents realtime refresh from overwriting in-flight optimistic updates ── */
let _mutationInFlight = 0;
let _pendingRefresh = false;
let _realtimeDebounceTimer: ReturnType<typeof setTimeout> | null = null;

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

/* ── Convert decimal hour to strict UTC ISO timestamp ──── */
/* PRD §2.2: All mutation timestamps MUST be UTC. We construct
   the Date in UTC explicitly so .toISOString() yields the
   exact intended hour regardless of browser timezone offset. */
function decimalHourToISO(date: string, hour: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const h = Math.floor(hour);
  const m = Math.round((hour - h) * 60);
  const d = new Date(Date.UTC(year, month - 1, day, h, m, 0, 0));
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

  /** Compute travel time warnings for consecutive blocks per technician */
  getTravelWarnings: () => Array<{
    blockId: string;
    technicianId: string;
    prevBlockId: string;
    gapMinutes: number;
    travelMinutes: number;
  }>;

  /** Called by realtime when a schedule_block changes */
  handleRealtimeUpdate: () => void;
}

function mapServerBlock(b: any): ScheduleBlock {
  return {
    id: b.id,
    jobId: b.job_id || "",
    technicianId: b.technician_id || "",
    participantId: b.participant_id || undefined,
    title: b.title,
    client: b.client_name || "",
    location: b.location || "",
    startHour: b.start_time ? timeToDecimalHours(b.start_time) : 0,
    duration: b.start_time && b.end_time ? calculateDuration(b.start_time, b.end_time) : 0,
    status: b.status,
    travelTime: b.travel_minutes || undefined,
    conflict: b.is_conflict || false,
    parentShiftId: b.parent_shift_id || null,
    isShadowShift: b.is_shadow_shift === true || b.metadata?.is_shadow_shift === true,
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
        const d = data as { blocks: any[]; technicians: any[]; backlog: BacklogJob[]; events: ScheduleEvent[] };
        const mappedBlocks = (d.blocks || []).map(mapServerBlock);
        const mappedTechs = (d.technicians || []).map(mapServerTechnician);

        set({
          blocks: mappedBlocks,
          technicians: mappedTechs,
          backlogJobs: d.backlog || [],
          scheduleEvents: d.events || [],
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

    // If a mutation (move/resize/assign) is in-flight, defer the refresh
    // so we don't overwrite the optimistic state with stale server data.
    if (_mutationInFlight > 0) {
      _pendingRefresh = true;
      return;
    }

    try {
      const { data } = await getScheduleView(orgId, selectedDate);
      if (data) {
        const d = data as { blocks: any[]; technicians: any[]; backlog: BacklogJob[]; events: ScheduleEvent[] };
        const mappedBlocks = (d.blocks || []).map(mapServerBlock);
        const mappedTechs = (d.technicians || []).map(mapServerTechnician);
        set({
          blocks: mappedBlocks,
          technicians: mappedTechs,
          backlogJobs: d.backlog || [],
          scheduleEvents: d.events || [],
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

    // Guard: temp blocks haven't been persisted to DB yet — wait for assignment to finish
    if (blockId.startsWith("temp-")) {
      showToast("This block is still being assigned — try again in a moment.", "error");
      return;
    }

    const snappedHour = Math.round(newStartHour * 4) / 4;

    /* ── Step 1: onMutate — Clone previous state ───────── */
    const previousBlocks = [...get().blocks];

    /* ── Step 2: Optimistic local update ───────────────── */
    const movedDelta = snappedHour - block.startHour;
    set((s) => ({
      blocks: s.blocks.map((b) => {
        if (b.id === blockId) {
          return {
            ...b,
            startHour: snappedHour,
            ...(newTechId ? { technicianId: newTechId } : {}),
          };
        }
        // Shadow blocks visually tether to parent while dragging.
        if (b.parentShiftId === blockId && b.isShadowShift) {
          return {
            ...b,
            startHour: b.startHour + movedDelta,
            ...(newTechId ? { technicianId: newTechId } : {}),
          };
        }
        return b;
      }),
    }));

    /* ── Step 3: Persist to server (UTC-normalized) ────── */
    const date = get().selectedDate;
    const startISO = decimalHourToISO(date, snappedHour);
    const endISO = decimalHourToISO(date, snappedHour + block.duration);
    const techId = newTechId || block.technicianId;

    // Lock: prevent realtime refresh from overwriting our optimistic state
    _mutationInFlight++;

    moveScheduleBlockServer(blockId, techId, startISO, endISO)
      .then((result) => {
        _mutationInFlight--;
        if (result.error) {
          /* ── onError — Rollback to cloned state ──────── */
          set({ blocks: previousBlocks });
          const isConflict = result.error.includes("conflict") || result.error.includes("overlap");
          showToast(
            isConflict
              ? `Scheduling Conflict: ${result.error}`
              : `Failed to move block: ${result.error}`,
            "error",
            undefined
          );
        }
        /* ── onSettled — Reconcile with server truth ──── */
        // Slight delay so the DB write is fully committed before we read
        setTimeout(() => get().refresh(), 300);
      })
      .catch((err) => {
        _mutationInFlight--;
        /* ── Network error — Rollback ──────────────────── */
        set({ blocks: previousBlocks });
        showToast("Network error — move was not saved. Please try again.", "error");
        console.error("Failed to persist block move:", err);
      });

    // Re-validate travel time after reposition
    const orgId = get().orgId;
    if (orgId) {
      fetch("/api/schedule/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organization_id: orgId,
          technician_id: techId,
          participant_id: block.participantId,
          start_time: startISO,
          end_time: endISO,
          location: block.location,
        }),
      })
        .then((r) => r.json())
        .then((v) => {
          if (v?.travel?.estimated_minutes != null) {
            set((s) => ({
              blocks: s.blocks.map((b) =>
                b.id === blockId
                  ? { ...b, travelTime: v.travel.estimated_minutes }
                  : b
              ),
            }));
          }
        })
        .catch(() => {});
    }
  },

  resizeBlock: (blockId, newDuration) => {
    const block = get().blocks.find((b) => b.id === blockId);
    if (!block) return;
    if (blockId.startsWith("temp-")) {
      showToast("This block is still being assigned — try again in a moment.", "error");
      return;
    }
    const snapped = Math.max(0.25, Math.round(newDuration * 4) / 4);

    /* ── Clone previous state for rollback ──────────────── */
    const previousBlocks = [...get().blocks];

    // Optimistic local update
    set((s) => ({
      blocks: s.blocks.map((b) => {
        if (b.id === blockId) return { ...b, duration: snapped };
        // Shadow duration follows parent shift.
        if (b.parentShiftId === blockId && b.isShadowShift) return { ...b, duration: snapped };
        return b;
      }),
    }));

    // Persist to server (UTC-normalized)
    const date = get().selectedDate;
    const endISO = decimalHourToISO(date, block.startHour + snapped);
    _mutationInFlight++;
    resizeScheduleBlockServer(blockId, endISO)
      .then((result) => {
        _mutationInFlight--;
        if (result.error) {
          set({ blocks: previousBlocks });
          showToast(`Failed to resize block: ${result.error}`, "error");
          return;
        }
        setTimeout(() => get().refresh(), 300);
      })
      .catch((err) => {
        _mutationInFlight--;
        set({ blocks: previousBlocks });
        showToast("Network error — resize was not saved.", "error");
        console.error("Failed to persist block resize:", err);
      });
  },

  deleteBlock: (blockId) => {
    const block = get().blocks.find((b) => b.id === blockId);
    if (!block) return;

    /* ── Clone for rollback ────────────────────────────── */
    const previousBlocks = [...get().blocks];

    // Optimistic local delete
    set((s) => ({
      blocks: s.blocks.filter((b) => b.id !== blockId),
    }));

    // Persist to server
    deleteBlockServer(blockId)
      .then((result) => {
        if (result.error) {
          set({ blocks: previousBlocks });
          showToast(`Failed to delete block: ${result.error}`, "error");
          return;
        }
        get().refresh();
      })
      .catch((err) => {
        set({ blocks: previousBlocks });
        showToast("Network error — deletion was not saved.", "error");
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

    // ─── Nightingale: Credential Hard Gate ────────────────────
    // For care organizations, validate that the worker has all required
    // credentials before allowing the shift assignment.
    try {
      const currentOrg = useAuthStore.getState().currentOrg as Record<string, unknown> | null;
      if (currentOrg?.industry_type === "care") {
        const supabase = createClient();
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;

        if (token) {
          const validateRes = await supabase.functions.invoke("validate-schedule", {
            body: {
              organization_id: orgId,
              worker_id: technicianId,
            },
          });

          if (validateRes.error || (validateRes.data && !validateRes.data.valid)) {
            const errorData = validateRes.data || {};
            const issues = errorData.issues || [];
            const issueList = issues
              .map((i: { credential_name: string; status: string }) => `• ${i.credential_name} (${i.status})`)
              .join("\n");
            const techName = get().technicians.find((t) => t.id === technicianId)?.name || "Worker";
            showToast(
              `⛔ Compliance Block: ${techName} cannot be assigned to "${job.title}". ${issues.length} credential issue(s):\n${issueList}`,
              "error"
            );
            return;
          }
        }
      }
    } catch (credErr) {
      // If validation service is unreachable, log but don't block for trades
      const currentOrg = useAuthStore.getState().currentOrg as Record<string, unknown> | null;
      if (currentOrg?.industry_type === "care") {
        console.error("[Schedule] Credential validation failed:", credErr);
        showToast("⚠ Unable to verify worker credentials. Please try again.", "error");
        return;
      }
    }
    // ────────────────────────────────────────────────────────────

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

    // Fire validation + assignment in parallel
    const [result] = await Promise.all([
      assignJobServer(orgId, job.id, technicianId, startISO, endISO),
      fetch("/api/schedule/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organization_id: orgId,
          technician_id: technicianId,
          start_time: startISO,
          end_time: endISO,
          job_id: job.id,
          location: job.location,
        }),
      })
        .then((r) => r.json())
        .then((validation) => {
          if (validation?.travel?.estimated_minutes != null) {
            set((s) => ({
              blocks: s.blocks.map((b) =>
                b.id === tempBlock.id
                  ? { ...b, travelTime: validation.travel.estimated_minutes }
                  : b
              ),
            }));
          }
          if (validation?.warnings?.length > 0) {
            console.warn("[Schedule] Drop warnings:", validation.warnings);
          }
        })
        .catch(() => {}),
    ]);

    if (result.error) {
      /* ── Conflict/Error Rollback — snap back to backlog ── */
      set((s) => ({
        blocks: s.blocks.filter((b) => b.id !== tempBlock.id),
        backlogJobs: [...s.backlogJobs, job],
      }));
      const isConflict = result.error.includes("conflict") || result.error.includes("overlap");
      showToast(
        isConflict
          ? `Scheduling Conflict: Cannot assign "${job.title}". ${result.error}`
          : `Failed to assign "${job.title}": ${result.error}`,
        "error"
      );
      return;
    }

    // Replace temp block with real server ID if returned
    const resultData = result.data as { id: string } | null;
    if (resultData?.id) {
      set((s) => ({
        blocks: s.blocks.map((b) =>
          b.id === tempBlock.id ? { ...b, id: resultData!.id } : b
        ),
      }));
    }

    showToast(`"${job.title}" assigned to schedule`, "success");
    get().refresh();
  },

  unscheduleBlock: (blockId: string) => {
    if (blockId.startsWith("temp-")) {
      showToast("This block is still being assigned — try again in a moment.", "error");
      return;
    }
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

  getTravelWarnings: () => {
    const { blocks, technicians } = get();
    const warnings: Array<{
      blockId: string;
      technicianId: string;
      prevBlockId: string;
      gapMinutes: number;
      travelMinutes: number;
    }> = [];

    for (const tech of technicians) {
      const techBlocks = blocks
        .filter((b) => b.technicianId === tech.id && b.status !== "cancelled")
        .sort((a, b) => a.startHour - b.startHour);

      for (let i = 1; i < techBlocks.length; i++) {
        const prev = techBlocks[i - 1];
        const curr = techBlocks[i];
        const prevEnd = prev.startHour + prev.duration;
        const gapMinutes = Math.round((curr.startHour - prevEnd) * 60);
        const travelNeeded = curr.travelTime || 15;

        if (gapMinutes < travelNeeded && gapMinutes >= 0) {
          warnings.push({
            blockId: curr.id,
            technicianId: tech.id,
            prevBlockId: prev.id,
            gapMinutes,
            travelMinutes: travelNeeded,
          });
        }
      }
    }

    return warnings;
  },

  handleRealtimeUpdate: () => {
    // Debounce realtime updates to avoid hammering the server
    // and to let in-flight mutations settle first
    if (_realtimeDebounceTimer) clearTimeout(_realtimeDebounceTimer);
    _realtimeDebounceTimer = setTimeout(() => {
      _realtimeDebounceTimer = null;
      get().refresh();
    }, 500);
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

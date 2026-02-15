import { create } from "zustand";
import {
  scheduleBlocks as initialBlocks,
  type ScheduleBlock,
  type ScheduleBlockStatus,
} from "./data";

export type ViewScale = "day" | "week" | "month";

interface ScheduleState {
  blocks: ScheduleBlock[];
  viewScale: ViewScale;
  selectedDate: string; // ISO date string
  draggingBlockId: string | null;
  peekBlockId: string | null;
  unscheduledDrawerOpen: boolean;

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
}

export const useScheduleStore = create<ScheduleState>((set) => ({
  blocks: initialBlocks,
  viewScale: "day",
  selectedDate: new Date().toISOString().split("T")[0],
  draggingBlockId: null,
  peekBlockId: null,
  unscheduledDrawerOpen: false,

  setViewScale: (scale) => set({ viewScale: scale }),
  setSelectedDate: (date) => set({ selectedDate: date }),
  setDraggingBlockId: (id) => set({ draggingBlockId: id }),
  setPeekBlockId: (id) => set({ peekBlockId: id }),
  toggleUnscheduledDrawer: () =>
    set((s) => ({ unscheduledDrawerOpen: !s.unscheduledDrawerOpen })),
  setUnscheduledDrawerOpen: (open) => set({ unscheduledDrawerOpen: open }),

  moveBlock: (blockId, newStartHour, newTechId) =>
    set((s) => ({
      blocks: s.blocks.map((b) =>
        b.id === blockId
          ? {
              ...b,
              startHour: Math.round(newStartHour * 4) / 4, // snap to 15m
              ...(newTechId ? { technicianId: newTechId } : {}),
            }
          : b
      ),
    })),

  resizeBlock: (blockId, newDuration) =>
    set((s) => ({
      blocks: s.blocks.map((b) =>
        b.id === blockId
          ? { ...b, duration: Math.max(0.25, Math.round(newDuration * 4) / 4) }
          : b
      ),
    })),

  deleteBlock: (blockId) =>
    set((s) => ({
      blocks: s.blocks.filter((b) => b.id !== blockId),
    })),

  restoreBlock: (block) =>
    set((s) => ({
      blocks: [...s.blocks, block].sort((a, b) => a.startHour - b.startHour),
    })),

  addBlock: (block) =>
    set((s) => ({
      blocks: [...s.blocks, block].sort((a, b) => a.startHour - b.startHour),
    })),

  updateBlockStatus: (blockId, status) =>
    set((s) => ({
      blocks: s.blocks.map((b) =>
        b.id === blockId ? { ...b, status } : b
      ),
    })),
}));

/**
 * @store ChronosStore
 * @status COMPLETE
 * @description Time-tracking state — activity logging, timesheets, and duration tracking
 * @resetSafe YES — reset() method available for workspace switching
 * @lastAudit 2026-03-22
 */

"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ChronosActivityType =
  | "phone"
  | "email"
  | "research"
  | "meeting"
  | "report_writing"
  | "travel"
  | "other";

export type ChronosTimerStatus = "running" | "paused" | "ready_to_save";

export interface ChronosTimer {
  id: string;
  participantId: string;
  participantName: string;
  activityType: ChronosActivityType;
  ndisLineItem: string;
  hourlyRate: number;
  startedAtIso: string;
  stoppedAtIso: string | null;
  accumulatedMs: number;
  status: ChronosTimerStatus;
  caseNoteDraft: string;
  autoPausedAtIso: string | null;
  metadata?: Record<string, unknown>;
}

interface ChronosState {
  timers: ChronosTimer[];
  selectedTimerId: string | null;
  lastInteractionAtIso: string | null;
  setLastInteractionNow: () => void;
  selectTimer: (id: string | null) => void;
  startTimer: (input: {
    participantId: string;
    participantName: string;
    activityType: ChronosActivityType;
    ndisLineItem: string;
    hourlyRate: number;
    metadata?: Record<string, unknown>;
  }) => string;
  pauseTimer: (id: string, auto?: boolean) => void;
  resumeTimer: (id: string) => void;
  stopTimer: (id: string) => void;
  removeTimer: (id: string) => void;
  updateTimerDraft: (id: string, patch: Partial<Pick<ChronosTimer, "caseNoteDraft" | "activityType" | "participantId" | "participantName" | "ndisLineItem" | "hourlyRate" | "metadata">>) => void;
  elapsedMs: (id: string) => number;
  runningTimerCount: () => number;

  /** Reset all state for workspace switching */
  reset: () => void;
}

function nowIso() {
  return new Date().toISOString();
}

function uuid() {
  return crypto.randomUUID();
}

export const useChronosStore = create<ChronosState>()(
  persist(
    (set, get) => ({
      timers: [],
      selectedTimerId: null,
      lastInteractionAtIso: nowIso(),

      setLastInteractionNow: () => set({ lastInteractionAtIso: nowIso() }),

      selectTimer: (id) => set({ selectedTimerId: id }),

      startTimer: (input) => {
        const id = uuid();
        const timer: ChronosTimer = {
          id,
          participantId: input.participantId,
          participantName: input.participantName,
          activityType: input.activityType,
          ndisLineItem: input.ndisLineItem,
          hourlyRate: input.hourlyRate,
          startedAtIso: nowIso(),
          stoppedAtIso: null,
          accumulatedMs: 0,
          status: "running",
          caseNoteDraft: "",
          autoPausedAtIso: null,
          metadata: input.metadata,
        };
        set((state) => ({
          timers: [timer, ...state.timers],
          selectedTimerId: id,
          lastInteractionAtIso: nowIso(),
        }));
        return id;
      },

      pauseTimer: (id, auto = false) =>
        set((state) => ({
          timers: state.timers.map((t) => {
            if (t.id !== id || t.status !== "running") return t;
            const delta = new Date().getTime() - new Date(t.startedAtIso).getTime();
            return {
              ...t,
              accumulatedMs: Math.max(0, t.accumulatedMs + delta),
              startedAtIso: nowIso(),
              status: "paused",
              autoPausedAtIso: auto ? nowIso() : t.autoPausedAtIso,
            };
          }),
          lastInteractionAtIso: nowIso(),
        })),

      resumeTimer: (id) =>
        set((state) => ({
          timers: state.timers.map((t) =>
            t.id === id && t.status !== "running"
              ? { ...t, startedAtIso: nowIso(), status: "running", autoPausedAtIso: null }
              : t
          ),
          selectedTimerId: id,
          lastInteractionAtIso: nowIso(),
        })),

      stopTimer: (id) =>
        set((state) => ({
          timers: state.timers.map((t) => {
            if (t.id !== id) return t;
            if (t.status === "running") {
              const delta = new Date().getTime() - new Date(t.startedAtIso).getTime();
              return {
                ...t,
                accumulatedMs: Math.max(0, t.accumulatedMs + delta),
                startedAtIso: nowIso(),
                stoppedAtIso: nowIso(),
                status: "ready_to_save",
              };
            }
            return { ...t, stoppedAtIso: nowIso(), status: "ready_to_save" };
          }),
          selectedTimerId: id,
          lastInteractionAtIso: nowIso(),
        })),

      removeTimer: (id) =>
        set((state) => ({
          timers: state.timers.filter((t) => t.id !== id),
          selectedTimerId: state.selectedTimerId === id ? null : state.selectedTimerId,
          lastInteractionAtIso: nowIso(),
        })),

      updateTimerDraft: (id, patch) =>
        set((state) => ({
          timers: state.timers.map((t) => (t.id === id ? { ...t, ...patch } : t)),
          lastInteractionAtIso: nowIso(),
        })),

      elapsedMs: (id) => {
        const timer = get().timers.find((t) => t.id === id);
        if (!timer) return 0;
        if (timer.status !== "running") return timer.accumulatedMs;
        return timer.accumulatedMs + (new Date().getTime() - new Date(timer.startedAtIso).getTime());
      },

      runningTimerCount: () => get().timers.filter((t) => t.status === "running").length,

      reset: () => {
        set({
          timers: [],
          selectedTimerId: null,
          lastInteractionAtIso: null,
        });
      },
    }),
    {
      name: "chronos-v1",
      partialize: (state) => ({
        timers: state.timers,
        selectedTimerId: state.selectedTimerId,
        lastInteractionAtIso: state.lastInteractionAtIso,
      }),
    }
  )
);


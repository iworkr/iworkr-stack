import { create } from "zustand";
import { jobs as initialJobs, type Job, type JobStatus, type Priority, type SubTask } from "./data";

interface JobsState {
  jobs: Job[];
  focusedIndex: number;
  selected: Set<string>;

  setFocusedIndex: (i: number) => void;
  toggleSelect: (id: string) => void;
  clearSelection: () => void;
  selectAll: () => void;

  updateJob: (id: string, patch: Partial<Job>) => void;
  deleteJob: (id: string) => void;
  restoreJobs: (jobs: Job[]) => void;
  addJob: (job: Job) => void;

  toggleSubtask: (jobId: string, subtaskId: string) => void;
}

export const useJobsStore = create<JobsState>((set) => ({
  jobs: initialJobs,
  focusedIndex: 0,
  selected: new Set(),

  setFocusedIndex: (i) => set({ focusedIndex: i }),

  toggleSelect: (id) =>
    set((s) => {
      const next = new Set(s.selected);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selected: next };
    }),

  clearSelection: () => set({ selected: new Set() }),
  selectAll: () => set((s) => ({ selected: new Set(s.jobs.map((j) => j.id)) })),

  updateJob: (id, patch) =>
    set((s) => ({
      jobs: s.jobs.map((j) => (j.id === id ? { ...j, ...patch } : j)),
    })),

  deleteJob: (id) =>
    set((s) => ({
      jobs: s.jobs.filter((j) => j.id !== id),
      selected: (() => {
        const next = new Set(s.selected);
        next.delete(id);
        return next;
      })(),
    })),

  restoreJobs: (restoredJobs) =>
    set((s) => ({
      jobs: [...s.jobs, ...restoredJobs].sort((a, b) => a.id.localeCompare(b.id)),
    })),

  addJob: (job) => set((s) => ({ jobs: [job, ...s.jobs] })),

  toggleSubtask: (jobId, subtaskId) =>
    set((s) => ({
      jobs: s.jobs.map((j) =>
        j.id === jobId
          ? {
              ...j,
              subtasks: j.subtasks?.map((st) =>
                st.id === subtaskId ? { ...st, completed: !st.completed } : st
              ),
            }
          : j
      ),
    })),
}));

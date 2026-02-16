import { create } from "zustand";
import { jobs as mockJobs, type Job, type SubTask } from "./data";
import {
  getJobs,
  updateJob as updateJobAction,
  deleteJob as deleteJobAction,
  createJob as createJobAction,
  toggleSubtask as toggleSubtaskAction,
  type CreateJobParams,
  type CreateJobLineItemInput,
} from "@/app/actions/jobs";

interface JobsState {
  jobs: Job[];
  focusedIndex: number;
  selected: Set<string>;
  loaded: boolean;
  loading: boolean;
  orgId: string | null;

  setFocusedIndex: (i: number) => void;
  toggleSelect: (id: string) => void;
  clearSelection: () => void;
  selectAll: () => void;

  updateJob: (id: string, patch: Partial<Job>) => void;
  deleteJob: (id: string) => void;
  restoreJobs: (jobs: Job[]) => void;
  addJob: (job: Job) => void;

  /** Server-synced create — persists to DB and updates local state */
  createJobServer: (params: CreateJobParams) => Promise<{ success: boolean; displayId?: string; error?: string }>;

  toggleSubtask: (jobId: string, subtaskId: string) => void;

  loadFromServer: (orgId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

function mapServerJob(sj: any): Job {
  return {
    id: sj.display_id || sj.id,
    title: sj.title,
    priority: sj.priority || "none",
    status: sj.status || "backlog",
    assignee: sj.assignee_name || sj.profiles?.full_name || "Unassigned",
    assigneeInitials: getInitials(sj.assignee_name || sj.profiles?.full_name || ""),
    client: sj.client_name || sj.clients?.name || "",
    due: sj.due_date ? formatRelativeDate(sj.due_date) : "",
    labels: sj.labels || [],
    created: formatRelativeDate(sj.created_at),
    location: sj.location,
    locationCoords: sj.location_lat && sj.location_lng ? { lat: sj.location_lat, lng: sj.location_lng } : undefined,
    description: sj.description,
    subtasks: sj.job_subtasks?.map((st: any) => ({
      id: st.id,
      title: st.title,
      completed: st.completed,
    })) || [],
    activity: sj.job_activity?.map((a: any) => ({
      id: a.id,
      type: a.type,
      text: a.text,
      user: a.user_name || "System",
      time: formatRelativeDate(a.created_at),
      photos: a.photos,
    })) || [],
    revenue: sj.revenue ? Number(sj.revenue) : undefined,
    cost: sj.cost ? Number(sj.cost) : undefined,
    estimatedHours: sj.estimated_hours ? Number(sj.estimated_hours) : undefined,
    actualHours: sj.actual_hours ? Number(sj.actual_hours) : undefined,
  };
}

function getInitials(name: string): string {
  if (!name) return "??";
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function formatRelativeDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return d.toLocaleDateString("en-AU", { month: "short", day: "numeric" });
}

export const useJobsStore = create<JobsState>((set, get) => ({
  jobs: mockJobs,
  focusedIndex: 0,
  selected: new Set(),
  loaded: false,
  loading: false,
  orgId: null,

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

  updateJob: (id, patch) => {
    set((s) => ({
      jobs: s.jobs.map((j) => (j.id === id ? { ...j, ...patch } : j)),
    }));
  },

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

  createJobServer: async (params: CreateJobParams) => {
    try {
      const { data, error } = await createJobAction(params);
      if (error || !data) {
        return { success: false, error: error || "Failed to create job" };
      }

      const mapped = mapServerJob(data);
      set((s) => ({ jobs: [mapped, ...s.jobs] }));
      return { success: true, displayId: data.display_id || mapped.id };
    } catch (err: any) {
      return { success: false, error: err.message || "Unexpected error" };
    }
  },

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

  loadFromServer: async (orgId: string) => {
    if (get().loaded || get().loading) return;
    set({ loading: true, orgId });
    try {
      const { data, error } = await getJobs(orgId);
      if (data && !error) {
        const mapped = data.map(mapServerJob);
        set({ jobs: mapped.length > 0 ? mapped : mockJobs, loaded: true, loading: false });
      } else {
        set({ loading: false });
      }
    } catch {
      set({ loading: false });
    }
  },

  refresh: async () => {
    const orgId = get().orgId;
    if (!orgId) return;
    try {
      const { data, error } = await getJobs(orgId);
      if (data && !error) {
        const mapped = data.map(mapServerJob);
        set({ jobs: mapped.length > 0 ? mapped : get().jobs });
      }
    } catch {
      // silently fail refresh
    }
  },
}));

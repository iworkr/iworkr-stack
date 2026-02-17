import { create } from "zustand";
import { persist } from "zustand/middleware";
import { isFresh } from "./cache-utils";
import {
  type FormTemplate,
  type FormSubmission,
  type FormBlock,
  type SubmissionTelemetry,
} from "./forms-data";
import {
  getForms,
  getFormSubmissions,
  getFormsOverview,
  createForm as createFormServer,
  updateForm as updateFormServer,
  deleteForm as deleteFormServer,
  publishForm as publishFormServer,
  createFormSubmission as createSubmissionServer,
  saveFormDraft as saveFormDraftServer,
  signAndLockSubmission as signAndLockServer,
  type FormsOverview,
} from "@/app/actions/forms";

/* ── Types ────────────────────────────────────────────── */

export type FormsTab = "my_forms" | "library" | "submissions";

/* ── Helpers ──────────────────────────────────────────── */

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatSignedAt(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const date = d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const time = d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
    hour12: true,
  });
  return `${date} — ${time}`;
}

function timeSince(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapServerTemplate(s: any): FormTemplate {
  return {
    id: s.id,
    title: s.title || "",
    description: s.description || "",
    source: s.is_library || s.is_verified ? "library" : "custom",
    status: s.status || "draft",
    version: s.version || 1,
    category: s.category || "custom",
    blocks: Array.isArray(s.blocks) ? s.blocks : [],
    usedCount: s.submissions_count || 0,
    lastEdited: timeSince(s.updated_at || s.created_at),
    createdBy: s.created_by_name || "Unknown",
    verified: s.is_verified || s.is_library || false,
    tags: [],
  };
}

function mapServerSubmission(s: any): FormSubmission {
  const meta = s.metadata || {};
  const hasTelemetry = !!(meta.ip || meta.gps || meta.device);
  const telemetry: SubmissionTelemetry | undefined = hasTelemetry
    ? {
        ip: meta.ip || "",
        browser: meta.device?.split("/")[0]?.trim() || "",
        os: meta.device?.split("/")[1]?.trim() || "",
        gpsLat: meta.gps?.lat || 0,
        gpsLng: meta.gps?.lng || 0,
        gpsAddress: meta.gps_address || "",
        timestamp: s.signed_at || s.created_at || "",
        sha256: s.document_hash || "",
      }
    : undefined;

  const formData = s.data || {};
  const fields = Object.entries(formData).map(([key, val]) => ({
    label: key,
    value: String(val),
  }));

  return {
    id: s.id,
    formId: s.form_id,
    formTitle: s.forms?.title || "",
    formVersion: s.forms?.version || 1,
    status: s.status === "signed" ? "signed" : s.status === "expired" ? "expired" : "pending",
    submittedBy: s.submitter_name || "",
    submittedByInitials: getInitials(s.submitter_name || "?"),
    jobRef: s.job_id ? `JOB-${s.job_id.slice(0, 3)}` : undefined,
    clientName: s.client_name || undefined,
    submittedAt: formatDate(s.created_at),
    signedAt: s.signed_at ? formatSignedAt(s.signed_at) : undefined,
    telemetry,
    fields,
  };
}

/* ── Store ────────────────────────────────────────────── */

interface FormsState {
  templates: FormTemplate[];
  submissions: FormSubmission[];
  overview: FormsOverview | null;
  activeTab: FormsTab;
  searchQuery: string;
  loaded: boolean;
  loading: boolean;
  orgId: string | null;
  _stale: boolean;
  _lastFetchedAt: number | null;

  setActiveTab: (tab: FormsTab) => void;
  setSearchQuery: (q: string) => void;

  loadFromServer: (orgId: string) => Promise<void>;
  refresh: () => Promise<void>;
  handleRealtimeUpdate: () => void;

  archiveTemplate: (id: string) => void;
  duplicateTemplate: (id: string) => void;

  createFormServer: (params: {
    organization_id: string;
    title: string;
    description?: string;
    category?: string;
    blocks?: FormBlock[];
  }) => Promise<{ data: any; error: string | null }>;

  updateFormServer: (
    formId: string,
    updates: {
      title?: string;
      description?: string;
      status?: string;
      blocks?: FormBlock[];
      category?: string;
      layout_config?: any;
    }
  ) => Promise<{ data: any; error: string | null }>;

  deleteFormServer: (formId: string) => Promise<{ error: string | null }>;
  publishFormServer: (formId: string) => Promise<{ data: any; error: string | null }>;

  createSubmission: (params: {
    form_id: string;
    organization_id: string;
    job_id?: string;
    client_id?: string;
    data: any;
  }) => Promise<{ data: any; error: string | null }>;

  saveDraft: (submissionId: string, formData: any) => Promise<{ error: string | null }>;

  signAndLock: (
    submissionId: string,
    signatureData: string,
    documentHash: string,
    metadata?: { ip?: string; device?: string; gps?: { lat: number; lng: number } }
  ) => Promise<{ data: any; error: string | null; missingFields?: string[] }>;
}

export const useFormsStore = create<FormsState>()(
  persist(
    (set, get) => ({
  templates: [],
  submissions: [],
  overview: null,
  activeTab: "my_forms",
  searchQuery: "",
  loaded: false,
  loading: false,
  orgId: null,
  _stale: true,
  _lastFetchedAt: null,

  setActiveTab: (tab) => set({ activeTab: tab }),
  setSearchQuery: (q) => set({ searchQuery: q }),

  /* ── Load from server ──────────────────────── */

  loadFromServer: async (orgId: string) => {
    const state = get();
    if (state.loading) return;
    if (isFresh(state._lastFetchedAt) && state.orgId === orgId) return;

    const hasCache = state.templates.length > 0 && state.orgId === orgId;
    set({ loading: !hasCache, orgId });

    try {
      const [formsRes, subsRes, overviewRes] = await Promise.all([
        getForms(orgId),
        getFormSubmissions(orgId),
        getFormsOverview(orgId),
      ]);

      const serverTemplates = formsRes.data
        ? formsRes.data.map(mapServerTemplate)
        : [];

      const serverSubmissions = subsRes.data
        ? subsRes.data.map(mapServerSubmission)
        : [];

      set({
        templates: serverTemplates,
        submissions: serverSubmissions,
        overview: overviewRes.data || null,
        loaded: true,
        loading: false,
        _stale: false,
        _lastFetchedAt: Date.now(),
      });
    } catch {
      set({ loaded: true, loading: false });
    }
  },

  refresh: async () => {
    const orgId = get().orgId;
    if (!orgId) return;

    try {
      const [formsRes, subsRes, overviewRes] = await Promise.all([
        getForms(orgId),
        getFormSubmissions(orgId),
        getFormsOverview(orgId),
      ]);

      if (formsRes.data) set({ templates: formsRes.data.map(mapServerTemplate) });
      if (subsRes.data) set({ submissions: subsRes.data.map(mapServerSubmission) });
      if (overviewRes.data) set({ overview: overviewRes.data });
      set({ _lastFetchedAt: Date.now(), _stale: false });
    } catch {
      // Silently fail on refresh
    }
  },

  handleRealtimeUpdate: () => {
    get().refresh();
  },

  /* ── Template actions ──────────────────────── */

  archiveTemplate: (id) => {
    set((s) => ({
      templates: s.templates.map((t) =>
        t.id === id ? { ...t, status: "archived" as const } : t
      ),
    }));
    updateFormServer(id, { status: "archived" });
  },

  duplicateTemplate: (id) => {
    const original = get().templates.find((t) => t.id === id);
    if (!original) return;
    const dupe: FormTemplate = {
      ...original,
      id: `frm-${Date.now()}`,
      title: `${original.title} (Copy)`,
      source: "custom",
      status: "draft",
      version: 1,
      usedCount: 0,
      lastEdited: "Just now",
      createdBy: "You",
      verified: false,
    };
    set((s) => ({ templates: [dupe, ...s.templates] }));

    const orgId = get().orgId;
    if (orgId) {
      createFormServer({
        organization_id: orgId,
        title: dupe.title,
        description: original.description,
        category: original.category,
        blocks: original.blocks,
      });
    }
  },

  /* ── Server-backed CRUD ────────────────────── */

  createFormServer: async (params) => {
    const res = await createFormServer(params);
    if (!res.error) get().refresh();
    return { data: res.data, error: res.error };
  },

  updateFormServer: async (formId, updates) => {
    const res = await updateFormServer(formId, updates);
    if (!res.error) get().refresh();
    return { data: res.data, error: res.error };
  },

  deleteFormServer: async (formId) => {
    set((s) => ({
      templates: s.templates.filter((t) => t.id !== formId),
    }));
    const res = await deleteFormServer(formId);
    if (res.error) get().refresh();
    return { error: res.error };
  },

  publishFormServer: async (formId) => {
    set((s) => ({
      templates: s.templates.map((t) =>
        t.id === formId ? { ...t, status: "published" as const, version: t.version + 1 } : t
      ),
    }));
    const res = await publishFormServer(formId);
    if (res.error) get().refresh();
    return { data: res.data, error: res.error };
  },

  /* ── Submissions ───────────────────────────── */

  createSubmission: async (params) => {
    const res = await createSubmissionServer(params);
    if (!res.error) get().refresh();
    return { data: res.data, error: res.error };
  },

  saveDraft: async (submissionId, formData) => {
    const res = await saveFormDraftServer(submissionId, formData);
    return { error: res.error };
  },

  signAndLock: async (submissionId, signatureData, documentHash, metadata) => {
    const res = await signAndLockServer(submissionId, signatureData, documentHash, metadata);

    if (!res.error) {
      set((s) => ({
        submissions: s.submissions.map((sub) =>
          sub.id === submissionId ? { ...sub, status: "signed" as const } : sub
        ),
      }));
      get().refresh();
    }

    return {
      data: res.data,
      error: res.error,
      missingFields: (res as any).missingFields,
    };
  },
    }),
    {
      name: "iworkr-forms",
      onRehydrateStorage: () => (state) => {
        if (state && state.templates && state.templates.length > 0) {
          state.loaded = true;
        }
      },
      partialize: (state) => ({
        templates: state.templates,
        submissions: state.submissions,
        overview: state.overview,
        orgId: state.orgId,
        _lastFetchedAt: state._lastFetchedAt,
      }),
    }
  )
);

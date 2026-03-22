/**
 * @store CredentialsStore
 * @status COMPLETE
 * @description Workforce compliance credentials — CRUD, expiry tracking, and realtime updates (Nightingale)
 * @resetSafe NO — No reset() method for workspace switching
 * @lastAudit 2026-03-22
 */

import { create } from "zustand";
import { isFresh } from "./cache-utils";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";

/* ── Types ────────────────────────────────────────────── */

export type CredentialType =
  | "NDIS_SCREENING"
  | "WWCC"
  | "FIRST_AID"
  | "MANUAL_HANDLING"
  | "MEDICATION_COMPETENCY"
  | "COVID_VACCINATION"
  | "CPR"
  | "DRIVERS_LICENSE"
  | "POLICE_CHECK"
  | "OTHER";

export type VerificationStatus = "pending" | "verified" | "rejected" | "expired";

export interface WorkerCredential {
  id: string;
  organization_id: string;
  user_id: string;
  credential_type: CredentialType;
  credential_name: string | null;
  document_url: string | null;
  issued_date: string | null;
  expiry_date: string | null;
  verification_status: VerificationStatus;
  verified_by: string | null;
  verified_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields (populated via query)
  worker_name?: string;
  worker_email?: string;
  worker_avatar?: string;
}

export type CredentialStatusFilter = "all" | VerificationStatus | "expiring";

/* ── Helpers ─────────────────────────────────────────── */

const CREDENTIAL_TYPE_LABELS: Record<CredentialType, string> = {
  NDIS_SCREENING: "NDIS Worker Screening",
  WWCC: "Working With Children Check",
  FIRST_AID: "First Aid Certificate",
  MANUAL_HANDLING: "Manual Handling",
  MEDICATION_COMPETENCY: "Medication Competency",
  COVID_VACCINATION: "COVID-19 Vaccination",
  CPR: "CPR Certificate",
  DRIVERS_LICENSE: "Driver's License",
  POLICE_CHECK: "Police Check",
  OTHER: "Other",
};

export function getCredentialTypeLabel(type: CredentialType): string {
  return CREDENTIAL_TYPE_LABELS[type] ?? type;
}

export function getExpiryStatus(expiryDate: string | null): "valid" | "expiring" | "expired" | "unknown" {
  if (!expiryDate) return "unknown";
  const expiry = new Date(expiryDate);
  const now = new Date();
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  if (expiry < now) return "expired";
  if (expiry <= thirtyDaysFromNow) return "expiring";
  return "valid";
}

export function getDaysUntilExpiry(expiryDate: string | null): number | null {
  if (!expiryDate) return null;
  const expiry = new Date(expiryDate);
  const now = new Date();
  return Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

/* ── Store ───────────────────────────────────────────── */

interface CredentialsState {
  credentials: WorkerCredential[];
  loading: boolean;
  error: string | null;
  _lastFetchedAt: number | null;

  // Filters
  statusFilter: CredentialStatusFilter;
  typeFilter: CredentialType | "all";
  memberFilter: string | "all"; // user_id or "all"

  // Actions
  loadFromServer: (orgId: string) => Promise<void>;
  createCredential: (params: CreateCredentialParams) => Promise<WorkerCredential | null>;
  updateCredential: (id: string, updates: Partial<WorkerCredential>) => Promise<boolean>;
  deleteCredential: (id: string) => Promise<boolean>;
  uploadDocument: (orgId: string, credentialId: string, file: File) => Promise<string | null>;
  setStatusFilter: (filter: CredentialStatusFilter) => void;
  setTypeFilter: (filter: CredentialType | "all") => void;
  setMemberFilter: (filter: string | "all") => void;
  handleRealtimeInsert: (payload: WorkerCredential) => void;
  handleRealtimeUpdate: (payload: WorkerCredential) => void;
  handleRealtimeDelete: (id: string) => void;
}

export interface CreateCredentialParams {
  organization_id: string;
  user_id: string;
  credential_type: CredentialType;
  credential_name?: string;
  issued_date?: string;
  expiry_date?: string;
  notes?: string;
}

export const useCredentialsStore = create<CredentialsState>((set, get) => ({
  credentials: [],
  loading: false,
  error: null,
  _lastFetchedAt: null,
  statusFilter: "all",
  typeFilter: "all",
  memberFilter: "all",

  loadFromServer: async (orgId: string) => {
    if (isFresh(get()._lastFetchedAt)) return;
    set({ loading: true, error: null });
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("worker_credentials")
        .select("*, profiles:user_id ( full_name, email, avatar_url )")
        .eq("organization_id", orgId)
        .order("expiry_date", { ascending: true, nullsFirst: false });

      if (error) throw error;

      const credentials: WorkerCredential[] = (data ?? []).map((row: Record<string, unknown>) => {
        const profile = row.profiles as Record<string, unknown> | null;
        return {
          id: row.id as string,
          organization_id: row.organization_id as string,
          user_id: row.user_id as string,
          credential_type: row.credential_type as CredentialType,
          credential_name: (row.credential_name as string) ?? null,
          document_url: (row.document_url as string) ?? null,
          issued_date: (row.issued_date as string) ?? null,
          expiry_date: (row.expiry_date as string) ?? null,
          verification_status: row.verification_status as VerificationStatus,
          verified_by: (row.verified_by as string) ?? null,
          verified_at: (row.verified_at as string) ?? null,
          notes: (row.notes as string) ?? null,
          created_at: row.created_at as string,
          updated_at: row.updated_at as string,
          worker_name: (profile?.full_name as string) ?? null,
          worker_email: (profile?.email as string) ?? null,
          worker_avatar: (profile?.avatar_url as string) ?? null,
        };
      });

      set({ credentials, loading: false, _lastFetchedAt: Date.now() });
    } catch (err) {
      set({ loading: false, error: (err as Error).message });
    }
  },

  createCredential: async (params: CreateCredentialParams) => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("worker_credentials")
        .insert(params as Database["public"]["Tables"]["worker_credentials"]["Insert"])
        .select()
        .single();

      if (error) throw error;
      const cred = data as WorkerCredential;

      set((s) => ({ credentials: [...s.credentials, cred] }));
      return cred;
    } catch (err) {
      set({ error: (err as Error).message });
      return null;
    }
  },

  updateCredential: async (id: string, updates: Partial<WorkerCredential>) => {
    try {
      const supabase = createClient();
      const tableColumns = ["worker_name", "worker_email", "worker_avatar"];
      const tableUpdates = Object.fromEntries(
        Object.entries(updates).filter(([k]) => !tableColumns.includes(k))
      ) as Database["public"]["Tables"]["worker_credentials"]["Update"];
      const { error } = await supabase
        .from("worker_credentials")
        .update(tableUpdates)
        .eq("id", id);

      if (error) throw error;

      set((s) => ({
        credentials: s.credentials.map((c) =>
          c.id === id ? { ...c, ...updates } : c
        ),
      }));
      return true;
    } catch (err) {
      set({ error: (err as Error).message });
      return false;
    }
  },

  deleteCredential: async (id: string) => {
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("worker_credentials")
        .delete()
        .eq("id", id);

      if (error) throw error;

      set((s) => ({
        credentials: s.credentials.filter((c) => c.id !== id),
      }));
      return true;
    } catch (err) {
      set({ error: (err as Error).message });
      return false;
    }
  },

  uploadDocument: async (orgId: string, credentialId: string, file: File) => {
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() || "pdf";
      const storagePath = `${orgId}/credentials/${credentialId}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("credentials")
        .upload(storagePath, file, {
          contentType: file.type,
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("credentials")
        .getPublicUrl(storagePath);

      const publicUrl = urlData.publicUrl;

      // Update the credential record with the document URL
      await get().updateCredential(credentialId, { document_url: publicUrl } as Partial<WorkerCredential>);

      return publicUrl;
    } catch (err) {
      set({ error: (err as Error).message });
      return null;
    }
  },

  setStatusFilter: (filter) => set({ statusFilter: filter }),
  setTypeFilter: (filter) => set({ typeFilter: filter }),
  setMemberFilter: (filter) => set({ memberFilter: filter }),

  handleRealtimeInsert: (payload) => {
    set((s) => ({
      credentials: [...s.credentials, payload],
    }));
  },

  handleRealtimeUpdate: (payload) => {
    set((s) => ({
      credentials: s.credentials.map((c) =>
        c.id === payload.id ? { ...c, ...payload } : c
      ),
    }));
  },

  handleRealtimeDelete: (id) => {
    set((s) => ({
      credentials: s.credentials.filter((c) => c.id !== id),
    }));
  },
}));

/* ── Selectors ───────────────────────────────────────── */

export function useFilteredCredentials() {
  const credentials = useCredentialsStore((s) => s.credentials);
  const statusFilter = useCredentialsStore((s) => s.statusFilter);
  const typeFilter = useCredentialsStore((s) => s.typeFilter);
  const memberFilter = useCredentialsStore((s) => s.memberFilter);

  return credentials.filter((cred) => {
    // Status filter
    if (statusFilter !== "all") {
      if (statusFilter === "expiring") {
        if (getExpiryStatus(cred.expiry_date) !== "expiring") return false;
      } else {
        if (cred.verification_status !== statusFilter) return false;
      }
    }

    // Type filter
    if (typeFilter !== "all" && cred.credential_type !== typeFilter) return false;

    // Member filter
    if (memberFilter !== "all" && cred.user_id !== memberFilter) return false;

    return true;
  });
}

/**
 * @store BudgetStore
 * @status COMPLETE
 * @description NDIS budget allocations, claim line items, and PRODA batch management (Nightingale Phase 3)
 * @resetSafe NO — No reset() method for workspace switching
 * @lastAudit 2026-03-22
 */

import { create } from "zustand";
import { isFresh } from "./cache-utils";
import {
  fetchBudgetAllocationsAction,
  fetchClaimLineItemsAction,
  fetchClaimBatchesAction,
} from "@/app/actions/care";

/* ── Types ────────────────────────────────────────────── */

export type BudgetCategory = "core" | "capacity_building" | "capital";

export type ClaimLineStatus = "draft" | "approved" | "submitted" | "paid" | "rejected" | "written_off";

export type BatchStatus = "draft" | "validating" | "submitted" | "processing" | "partially_reconciled" | "reconciled" | "failed";

export interface BudgetAllocation {
  id: string;
  organization_id: string;
  service_agreement_id: string;
  participant_id: string;
  category: BudgetCategory;
  total_budget: number;
  consumed_budget: number;
  quarantined_budget: number;
  created_at: string;
  updated_at: string;
  // Joined
  service_agreement?: {
    title: string;
    start_date: string;
    end_date: string;
    status: string;
  };
}

export interface ClaimLineItem {
  id: string;
  organization_id: string;
  claim_batch_id: string | null;
  shift_id: string | null;
  participant_id: string;
  funder_id: string | null;
  ndis_item_number: string | null;
  description: string;
  quantity: number;
  unit_rate: number;
  total_amount: number;
  region_modifier: number | null;
  gst_amount: number;
  status: ClaimLineStatus;
  rejection_code: string | null;
  rejection_reason: string | null;
  service_date: string;
  worker_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProdaClaimBatch {
  id: string;
  organization_id: string;
  batch_number: string | null;
  status: BatchStatus;
  total_claims: number;
  total_amount: number;
  successful_claims: number;
  failed_claims: number;
  paid_amount: number;
  submitted_at: string | null;
  submitted_by: string | null;
  reconciled_at: string | null;
  proda_reference: string | null;
  payload_url: string | null;
  remittance_url: string | null;
  error_log: unknown; // jsonb
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/* ── Helpers ─────────────────────────────────────────── */

export const CATEGORY_LABELS: Record<BudgetCategory, string> = {
  core: "Core Supports",
  capacity_building: "Capacity Building",
  capital: "Capital Supports",
};

export const CATEGORY_CONFIG: Record<BudgetCategory, { label: string; color: string; bg: string; border: string }> = {
  core: { label: "Core Supports", color: "text-sky-400", bg: "bg-sky-500/10", border: "border-sky-500/20" },
  capacity_building: { label: "Capacity Building", color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20" },
  capital: { label: "Capital Supports", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
};

export const CLAIM_STATUS_CONFIG: Record<ClaimLineStatus, { label: string; color: string; bg: string; border: string }> = {
  draft: { label: "Draft", color: "text-zinc-400", bg: "bg-zinc-500/10", border: "border-zinc-500/20" },
  approved: { label: "Approved", color: "text-sky-400", bg: "bg-sky-500/10", border: "border-sky-500/20" },
  submitted: { label: "Submitted", color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20" },
  paid: { label: "Paid", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  rejected: { label: "Rejected", color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/20" },
  written_off: { label: "Written Off", color: "text-zinc-500", bg: "bg-zinc-500/10", border: "border-zinc-500/20" },
};

export const BATCH_STATUS_CONFIG: Record<BatchStatus, { label: string; color: string; bg: string; border: string }> = {
  draft: { label: "Draft", color: "text-zinc-400", bg: "bg-zinc-500/10", border: "border-zinc-500/20" },
  validating: { label: "Validating", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
  submitted: { label: "Submitted", color: "text-sky-400", bg: "bg-sky-500/10", border: "border-sky-500/20" },
  processing: { label: "Processing", color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20" },
  partially_reconciled: { label: "Partially Reconciled", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
  reconciled: { label: "Reconciled", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  failed: { label: "Failed", color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/20" },
};

/* ── Store ───────────────────────────────────────────── */

interface BudgetState {
  allocations: BudgetAllocation[];
  claimLines: ClaimLineItem[];
  batches: ProdaClaimBatch[];
  loading: boolean;
  error: string | null;
  _lastAllocFetchedAt: number | null;
  _lastClaimsFetchedAt: number | null;
  _lastBatchesFetchedAt: number | null;

  // Actions
  fetchAllocations: (orgId: string, participantId?: string) => Promise<void>;
  fetchClaimLines: (orgId: string, batchId?: string, status?: ClaimLineStatus) => Promise<void>;
  fetchBatches: (orgId: string) => Promise<void>;
  createClaimBatch: (orgId: string, lineItemIds: string[]) => Promise<ProdaClaimBatch | null>;
}

export const useBudgetStore = create<BudgetState>((set, get) => ({
  allocations: [],
  claimLines: [],
  batches: [],
  loading: false,
  error: null,
  _lastAllocFetchedAt: null,
  _lastClaimsFetchedAt: null,
  _lastBatchesFetchedAt: null,

  fetchAllocations: async (orgId, participantId) => {
    if (isFresh(get()._lastAllocFetchedAt)) return;
    set({ loading: true, error: null });
    try {
      const data = await fetchBudgetAllocationsAction(orgId, participantId);

      const allocations: BudgetAllocation[] = (data ?? []).map((row: Record<string, unknown>) => {
        const sa = row.service_agreements as Record<string, unknown> | null;
        return {
          ...row,
          service_agreement: sa
            ? {
                title: sa.title as string,
                start_date: sa.start_date as string,
                end_date: sa.end_date as string,
                status: sa.status as string,
              }
            : undefined,
        } as BudgetAllocation;
      });

      set({ allocations, loading: false, _lastAllocFetchedAt: Date.now() });
    } catch (err) {
      set({ loading: false, error: (err as Error).message });
    }
  },

  fetchClaimLines: async (orgId, batchId, status) => {
    if (isFresh(get()._lastClaimsFetchedAt)) return;
    set({ loading: true, error: null });
    try {
      const data = await fetchClaimLineItemsAction(orgId, batchId, status);
      set({
        claimLines: (data ?? []) as unknown as ClaimLineItem[],
        loading: false,
        _lastClaimsFetchedAt: Date.now(),
      });
    } catch (err) {
      set({ loading: false, error: (err as Error).message });
    }
  },

  fetchBatches: async (orgId) => {
    if (isFresh(get()._lastBatchesFetchedAt)) return;
    set({ loading: true, error: null });
    try {
      const data = await fetchClaimBatchesAction(orgId);
      set({
        batches: (data ?? []) as unknown as ProdaClaimBatch[],
        loading: false,
        _lastBatchesFetchedAt: Date.now(),
      });
    } catch (err) {
      set({ loading: false, error: (err as Error).message });
    }
  },

  createClaimBatch: async (orgId, lineItemIds) => {
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("proda_claim_batches")
        .insert({
          organization_id: orgId,
          status: "draft",
          total_claims: lineItemIds.length,
          total_amount: 0,
        })
        .select()
        .single();

      if (error) throw error;
      const batch = data as ProdaClaimBatch;

      // Link selected line items to this batch
      if (lineItemIds.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: updateError } = await (supabase as any)
          .from("claim_line_items")
          .update({ claim_batch_id: batch.id })
          .in("id", lineItemIds);

        if (updateError) throw updateError;
      }

      set((s) => ({ batches: [batch, ...s.batches] }));
      return batch;
    } catch (err) {
      set({ error: (err as Error).message });
      return null;
    }
  },
}));

/* ── Selectors ───────────────────────────────────────── */

export function useBudgetSummary(participantId?: string) {
  const allocations = useBudgetStore((s) => s.allocations);
  const filtered = participantId
    ? allocations.filter((a) => a.participant_id === participantId)
    : allocations;

  const totals = filtered.reduce(
    (acc, a) => ({
      total: acc.total + a.total_budget,
      consumed: acc.consumed + a.consumed_budget,
      quarantined: acc.quarantined + a.quarantined_budget,
      available: acc.available + (a.total_budget - a.consumed_budget - a.quarantined_budget),
    }),
    { total: 0, consumed: 0, quarantined: 0, available: 0 }
  );

  return totals;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

/**
 * Project Synapse-Prod — Production Accounting Sync (Xero & QBO)
 *
 * Server actions for:
 *  1. Token lifecycle: fetch valid tokens, refresh, disconnect
 *  2. Sync queue management: enqueue, retry, cancel, purge
 *  3. Integration mappings: CRUD for entity ↔ account mappings
 *  4. Reference data caches: tax codes, account codes, tracking categories
 *  5. Health & observability: metrics, sync history, connected providers
 */

import { createServerSupabaseClient } from "@/lib/supabase/server";

/* ── Types ──────────────────────────────────────────────────────────────── */

export type IntegrationProvider = "xero" | "qbo";

export type QueueStatus =
  | "queued"
  | "QUEUED"
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "FAILED_PERMANENTLY"
  | "cancelled";

export interface QueueItem {
  id: string;
  organization_id: string;
  provider: string;
  operation: string;
  endpoint: string;
  method: string;
  payload: Record<string, any>;
  status: QueueStatus;
  attempt_count: number;
  max_attempts: number;
  next_attempt_at: string;
  last_error: string | null;
  response_status: number | null;
  created_at: string;
}

export interface IntegrationMapping {
  id: string;
  workspace_id: string;
  provider: string;
  iworkr_entity_type: string;
  iworkr_entity_id: string;
  iworkr_entity_label: string;
  external_account_code: string;
  external_account_name: string;
  external_tax_type: string;
  external_tracking_category: string | null;
}

export interface TaxCode {
  tax_type: string;
  tax_name: string;
  tax_rate: number;
  is_active: boolean;
}

export interface AccountCode {
  account_code: string;
  account_name: string;
  account_type: string;
  is_active: boolean;
}

export interface TrackingCategory {
  category_id: string;
  category_name: string;
  option_id?: string;
  option_name?: string;
}

export interface TokenResult {
  access_token: string;
  refresh_token: string;
  expires_at: string;
  external_tenant_id: string;
  connection_id: string;
  needs_refresh: boolean;
  locked_by_other: boolean;
}

export interface HealthStats {
  synced_30d: number;
  pending_queue: number;
  failed: number;
  rate_limit_hits_7d: number;
  providers: Array<{
    provider: string;
    connected: boolean;
    is_production: boolean;
    expires_at: string;
    external_org: string;
  }>;
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

async function assertOrgMember(orgId: string) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const { data: membership } = await (supabase as any)
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (!membership) throw new Error("Not a member of this organization");
  return { supabase, userId: user.id };
}

/* ═══════════════════════════════════════════════════════════════════════════
   1. TOKEN LIFECYCLE
   ═══════════════════════════════════════════════════════════════════════════ */

/** Fetch a valid integration token via the RPC, including refresh status. */
export async function getValidToken(
  orgId: string,
  provider: string,
): Promise<{ data: TokenResult | null; error: string | null }> {
  try {
    const { supabase } = await assertOrgMember(orgId);

    const { data, error } = await supabase.rpc(
      "get_valid_integration_token" as any,
      {
        p_workspace_id: orgId,
        p_provider: provider,
      },
    );

    if (error) return { data: null, error: error.message };
    return { data: data as unknown as TokenResult, error: null };
  } catch (err: any) {
    return { data: null, error: err.message ?? "Failed to get token" };
  }
}

/** Persist a refreshed token pair via the RPC. */
export async function refreshAndUpdateToken(
  orgId: string,
  provider: string,
  newAccessToken: string,
  newRefreshToken: string,
  expiresInSeconds: number,
): Promise<{ data: any | null; error: string | null }> {
  try {
    const { supabase } = await assertOrgMember(orgId);

    const { data, error } = await supabase.rpc(
      "update_integration_token" as any,
      {
        p_workspace_id: orgId,
        p_provider: provider,
        p_access_token: newAccessToken,
        p_refresh_token: newRefreshToken,
        p_expires_in_seconds: expiresInSeconds,
      },
    );

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message ?? "Failed to update token" };
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   2. HEALTH & OBSERVABILITY
   ═══════════════════════════════════════════════════════════════════════════ */

/** Fetch aggregated integration health stats via RPC. */
export async function getIntegrationHealthStats(
  orgId: string,
): Promise<{ data: HealthStats | null; error: string | null }> {
  try {
    const { supabase } = await assertOrgMember(orgId);

    const { data, error } = await supabase.rpc(
      "get_integration_health_stats" as any,
      { p_org_id: orgId },
    );

    if (error) return { data: null, error: error.message };
    return { data: data as unknown as HealthStats, error: null };
  } catch (err: any) {
    return { data: null, error: err.message ?? "Failed to get health stats" };
  }
}

/** Fetch health metrics for a specific provider over last N days. */
export async function getHealthMetrics(
  orgId: string,
  provider: string,
  days: number = 30,
): Promise<{ data: any[] | null; error: string | null }> {
  try {
    const { supabase } = await assertOrgMember(orgId);

    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - days);

    const { data, error } = await (supabase as any)
      .from("integration_health_metrics")
      .select("*")
      .eq("organization_id", orgId)
      .eq("provider", provider)
      .gte("metric_date", sinceDate.toISOString().split("T")[0])
      .order("metric_date", { ascending: false });

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message ?? "Failed to get health metrics" };
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   3. SYNC QUEUE MANAGEMENT
   ═══════════════════════════════════════════════════════════════════════════ */

/** List sync queue items, optionally filtered by status. */
export async function getQueueItems(
  orgId: string,
  status?: string,
): Promise<{ data: QueueItem[] | null; error: string | null }> {
  try {
    const { supabase } = await assertOrgMember(orgId);

    let query = (supabase as any)
      .from("integration_sync_queue")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) return { data: null, error: error.message };
    return { data: data as QueueItem[], error: null };
  } catch (err: any) {
    return { data: null, error: err.message ?? "Failed to get queue items" };
  }
}

/** Enqueue a new sync operation. */
export async function enqueueSync(
  orgId: string,
  provider: string,
  endpoint: string,
  method: string,
  payload: Record<string, any>,
  idempotencyKey?: string,
): Promise<{ data: QueueItem | null; error: string | null }> {
  try {
    const { supabase } = await assertOrgMember(orgId);

    const row: Record<string, any> = {
      organization_id: orgId,
      provider,
      endpoint,
      method,
      payload,
      status: "queued",
      attempt_count: 0,
      max_attempts: 5,
      next_attempt_at: new Date().toISOString(),
    };

    if (idempotencyKey) {
      row.idempotency_key = idempotencyKey;
    }

    const { data, error } = await (supabase as any)
      .from("integration_sync_queue")
      .insert(row)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data: data as QueueItem, error: null };
  } catch (err: any) {
    return { data: null, error: err.message ?? "Failed to enqueue sync item" };
  }
}

/** Retry a failed queue item — resets status and bumps attempt_count. */
export async function retryQueueItem(
  orgId: string,
  itemId: string,
): Promise<{ data: QueueItem | null; error: string | null }> {
  try {
    const { supabase } = await assertOrgMember(orgId);

    // First verify the item belongs to this org
    const { data: existing, error: fetchErr } = await (supabase as any)
      .from("integration_sync_queue")
      .select("attempt_count")
      .eq("id", itemId)
      .eq("organization_id", orgId)
      .single();

    if (fetchErr || !existing) {
      return { data: null, error: fetchErr?.message ?? "Queue item not found" };
    }

    const { data, error } = await (supabase as any)
      .from("integration_sync_queue")
      .update({
        status: "queued",
        attempt_count: existing.attempt_count + 1,
        next_attempt_at: new Date().toISOString(),
        last_error: null,
      })
      .eq("id", itemId)
      .eq("organization_id", orgId)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data: data as QueueItem, error: null };
  } catch (err: any) {
    return { data: null, error: err.message ?? "Failed to retry queue item" };
  }
}

/** Cancel a queue item. */
export async function cancelQueueItem(
  orgId: string,
  itemId: string,
): Promise<{ data: QueueItem | null; error: string | null }> {
  try {
    const { supabase } = await assertOrgMember(orgId);

    const { data, error } = await (supabase as any)
      .from("integration_sync_queue")
      .update({
        status: "cancelled",
        completed_at: new Date().toISOString(),
      })
      .eq("id", itemId)
      .eq("organization_id", orgId)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data: data as QueueItem, error: null };
  } catch (err: any) {
    return { data: null, error: err.message ?? "Failed to cancel queue item" };
  }
}

/** Delete all permanently-failed items from the queue. */
export async function purgeFailedItems(
  orgId: string,
): Promise<{ data: { purged: number }; error: string | null }> {
  try {
    const { supabase } = await assertOrgMember(orgId);

    const { data, error } = await (supabase as any)
      .from("integration_sync_queue")
      .delete()
      .eq("organization_id", orgId)
      .eq("status", "FAILED_PERMANENTLY")
      .select("id");

    if (error) return { data: { purged: 0 }, error: error.message };
    return { data: { purged: data?.length ?? 0 }, error: null };
  } catch (err: any) {
    return { data: { purged: 0 }, error: err.message ?? "Failed to purge items" };
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   4. INTEGRATION MAPPINGS
   ═══════════════════════════════════════════════════════════════════════════ */

/** List all integration mappings for a workspace. */
export async function getIntegrationMappings(
  orgId: string,
): Promise<{ data: IntegrationMapping[] | null; error: string | null }> {
  try {
    const { supabase } = await assertOrgMember(orgId);

    const { data, error } = await (supabase as any)
      .from("integration_mappings")
      .select("*")
      .eq("workspace_id", orgId)
      .order("iworkr_entity_type", { ascending: true });

    if (error) return { data: null, error: error.message };
    return { data: data as IntegrationMapping[], error: null };
  } catch (err: any) {
    return { data: null, error: err.message ?? "Failed to get mappings" };
  }
}

/** Upsert an integration mapping. */
export async function upsertMapping(
  orgId: string,
  mapping: {
    provider: string;
    iworkr_entity_type: string;
    iworkr_entity_id: string;
    iworkr_entity_label: string;
    external_account_code: string;
    external_account_name: string;
    external_tax_type: string;
    external_tracking_category?: string;
  },
): Promise<{ data: IntegrationMapping | null; error: string | null }> {
  try {
    const { supabase } = await assertOrgMember(orgId);

    const { data, error } = await (supabase as any)
      .from("integration_mappings")
      .upsert(
        {
          workspace_id: orgId,
          provider: mapping.provider,
          iworkr_entity_type: mapping.iworkr_entity_type,
          iworkr_entity_id: mapping.iworkr_entity_id,
          iworkr_entity_label: mapping.iworkr_entity_label,
          external_account_code: mapping.external_account_code,
          external_account_name: mapping.external_account_name,
          external_tax_type: mapping.external_tax_type,
          external_tracking_category:
            mapping.external_tracking_category ?? null,
        },
        {
          onConflict: "workspace_id,provider,iworkr_entity_type,iworkr_entity_id",
        },
      )
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data: data as IntegrationMapping, error: null };
  } catch (err: any) {
    return { data: null, error: err.message ?? "Failed to upsert mapping" };
  }
}

/** Delete an integration mapping by ID. */
export async function deleteMapping(
  orgId: string,
  mappingId: string,
): Promise<{ data: { deleted: boolean }; error: string | null }> {
  try {
    const { supabase } = await assertOrgMember(orgId);

    const { error } = await (supabase as any)
      .from("integration_mappings")
      .delete()
      .eq("id", mappingId)
      .eq("workspace_id", orgId);

    if (error) return { data: { deleted: false }, error: error.message };
    return { data: { deleted: true }, error: null };
  } catch (err: any) {
    return { data: { deleted: false }, error: err.message ?? "Failed to delete mapping" };
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   5. TAX CODES CACHE
   ═══════════════════════════════════════════════════════════════════════════ */

/** Fetch cached tax codes for a provider. */
export async function getTaxCodes(
  orgId: string,
  provider: string,
): Promise<{ data: TaxCode[] | null; error: string | null }> {
  try {
    const { supabase } = await assertOrgMember(orgId);

    const { data, error } = await (supabase as any)
      .from("integration_tax_cache")
      .select("tax_type, tax_name, tax_rate, is_active")
      .eq("organization_id", orgId)
      .eq("provider", provider)
      .order("tax_name", { ascending: true });

    if (error) return { data: null, error: error.message };
    return { data: data as TaxCode[], error: null };
  } catch (err: any) {
    return { data: null, error: err.message ?? "Failed to get tax codes" };
  }
}

/** Replace all cached tax codes for a provider (delete + bulk insert). */
export async function saveTaxCodes(
  orgId: string,
  provider: string,
  codes: Array<{
    tax_type: string;
    tax_name: string;
    tax_rate: number;
    is_active: boolean;
  }>,
): Promise<{ data: { saved: number }; error: string | null }> {
  try {
    const { supabase } = await assertOrgMember(orgId);

    // Delete existing codes for this org + provider
    const { error: deleteErr } = await (supabase as any)
      .from("integration_tax_cache")
      .delete()
      .eq("organization_id", orgId)
      .eq("provider", provider);

    if (deleteErr) return { data: { saved: 0 }, error: deleteErr.message };

    if (codes.length === 0) {
      return { data: { saved: 0 }, error: null };
    }

    // Bulk insert new codes
    const rows = codes.map((c) => ({
      organization_id: orgId,
      provider,
      tax_type: c.tax_type,
      tax_name: c.tax_name,
      tax_rate: c.tax_rate,
      is_active: c.is_active,
      fetched_at: new Date().toISOString(),
    }));

    const { data, error } = await (supabase as any)
      .from("integration_tax_cache")
      .insert(rows)
      .select("id");

    if (error) return { data: { saved: 0 }, error: error.message };
    return { data: { saved: data?.length ?? 0 }, error: null };
  } catch (err: any) {
    return { data: { saved: 0 }, error: err.message ?? "Failed to save tax codes" };
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   6. ACCOUNT CODES CACHE
   ═══════════════════════════════════════════════════════════════════════════ */

/** Fetch cached account codes for a provider. */
export async function getAccountCodes(
  orgId: string,
  provider: string,
): Promise<{ data: AccountCode[] | null; error: string | null }> {
  try {
    const { supabase } = await assertOrgMember(orgId);

    const { data, error } = await (supabase as any)
      .from("integration_account_cache")
      .select("account_code, account_name, account_type, is_active")
      .eq("organization_id", orgId)
      .eq("provider", provider)
      .order("account_code", { ascending: true });

    if (error) return { data: null, error: error.message };
    return { data: data as AccountCode[], error: null };
  } catch (err: any) {
    return { data: null, error: err.message ?? "Failed to get account codes" };
  }
}

/** Replace all cached account codes for a provider (delete + bulk insert). */
export async function saveAccountCodes(
  orgId: string,
  provider: string,
  accounts: Array<{
    account_code: string;
    account_name: string;
    account_type: string;
    is_active: boolean;
  }>,
): Promise<{ data: { saved: number }; error: string | null }> {
  try {
    const { supabase } = await assertOrgMember(orgId);

    // Delete existing accounts for this org + provider
    const { error: deleteErr } = await (supabase as any)
      .from("integration_account_cache")
      .delete()
      .eq("organization_id", orgId)
      .eq("provider", provider);

    if (deleteErr) return { data: { saved: 0 }, error: deleteErr.message };

    if (accounts.length === 0) {
      return { data: { saved: 0 }, error: null };
    }

    // Bulk insert new accounts
    const rows = accounts.map((a) => ({
      organization_id: orgId,
      provider,
      account_code: a.account_code,
      account_name: a.account_name,
      account_type: a.account_type,
      is_active: a.is_active,
      fetched_at: new Date().toISOString(),
    }));

    const { data, error } = await (supabase as any)
      .from("integration_account_cache")
      .insert(rows)
      .select("id");

    if (error) return { data: { saved: 0 }, error: error.message };
    return { data: { saved: data?.length ?? 0 }, error: null };
  } catch (err: any) {
    return { data: { saved: 0 }, error: err.message ?? "Failed to save account codes" };
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   7. TRACKING CATEGORIES CACHE
   ═══════════════════════════════════════════════════════════════════════════ */

/** Fetch cached tracking categories for a provider. */
export async function getTrackingCategories(
  orgId: string,
  provider: string,
): Promise<{ data: TrackingCategory[] | null; error: string | null }> {
  try {
    const { supabase } = await assertOrgMember(orgId);

    const { data, error } = await (supabase as any)
      .from("integration_tracking_cache")
      .select("category_id, category_name, option_id, option_name")
      .eq("organization_id", orgId)
      .eq("provider", provider)
      .order("category_name", { ascending: true });

    if (error) return { data: null, error: error.message };
    return { data: data as TrackingCategory[], error: null };
  } catch (err: any) {
    return {
      data: null,
      error: err.message ?? "Failed to get tracking categories",
    };
  }
}

/** Replace all cached tracking categories for a provider (delete + bulk insert). */
export async function saveTrackingCategories(
  orgId: string,
  provider: string,
  categories: Array<{
    category_id: string;
    category_name: string;
    option_id?: string;
    option_name?: string;
  }>,
): Promise<{ data: { saved: number }; error: string | null }> {
  try {
    const { supabase } = await assertOrgMember(orgId);

    // Delete existing categories for this org + provider
    const { error: deleteErr } = await (supabase as any)
      .from("integration_tracking_cache")
      .delete()
      .eq("organization_id", orgId)
      .eq("provider", provider);

    if (deleteErr) return { data: { saved: 0 }, error: deleteErr.message };

    if (categories.length === 0) {
      return { data: { saved: 0 }, error: null };
    }

    // Bulk insert new categories
    const rows = categories.map((c) => ({
      organization_id: orgId,
      provider,
      category_id: c.category_id,
      category_name: c.category_name,
      option_id: c.option_id ?? null,
      option_name: c.option_name ?? null,
      fetched_at: new Date().toISOString(),
    }));

    const { data, error } = await (supabase as any)
      .from("integration_tracking_cache")
      .insert(rows)
      .select("id");

    if (error) return { data: { saved: 0 }, error: error.message };
    return { data: { saved: data?.length ?? 0 }, error: null };
  } catch (err: any) {
    return {
      data: { saved: 0 },
      error: err.message ?? "Failed to save tracking categories",
    };
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   8. CONNECTED PROVIDERS
   ═══════════════════════════════════════════════════════════════════════════ */

/** List all connected providers for a workspace. */
export async function getConnectedProviders(
  orgId: string,
): Promise<{
  data: Array<{
    provider: string;
    external_org_name: string | null;
    expires_at: string | null;
    is_production: boolean;
    connection_id: string | null;
  }> | null;
  error: string | null;
}> {
  try {
    const { supabase } = await assertOrgMember(orgId);

    const { data, error } = await (supabase as any)
      .from("integration_tokens")
      .select(
        "provider, external_org_name, expires_at, is_production, connection_id",
      )
      .eq("workspace_id", orgId);

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (err: any) {
    return {
      data: null,
      error: err.message ?? "Failed to get connected providers",
    };
  }
}

/** Disconnect (delete) a provider's tokens from the workspace. */
export async function disconnectProvider(
  orgId: string,
  provider: string,
): Promise<{ data: { disconnected: boolean }; error: string | null }> {
  try {
    const { supabase } = await assertOrgMember(orgId);

    const { error } = await (supabase as any)
      .from("integration_tokens")
      .delete()
      .eq("workspace_id", orgId)
      .eq("provider", provider);

    if (error)
      return { data: { disconnected: false }, error: error.message };
    return { data: { disconnected: true }, error: null };
  } catch (err: any) {
    return {
      data: { disconnected: false },
      error: err.message ?? "Failed to disconnect provider",
    };
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   9. SYNC HISTORY
   ═══════════════════════════════════════════════════════════════════════════ */

/** Fetch recent sync log entries for a workspace. */
export async function getSyncHistory(
  orgId: string,
  limit: number = 50,
): Promise<{ data: any[] | null; error: string | null }> {
  try {
    const { supabase } = await assertOrgMember(orgId);

    const { data, error } = await (supabase as any)
      .from("integration_sync_log")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message ?? "Failed to get sync history" };
  }
}

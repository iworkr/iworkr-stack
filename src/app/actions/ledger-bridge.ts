/**
 * @module LedgerBridge Server Actions
 * @status COMPLETE
 * @description Project Ledger-Bridge — Two-way accounting sync server actions.
 *   Queue management, GL code mapping, payroll earnings rate mapping,
 *   entity map CRUD, Xero Earnings Rates fetch, connection health, and queue monitor.
 * @exports enqueueInvoiceSync, enqueuePaymentSync, enqueueTimesheetSync,
 *   getAccountCodes, saveAccountCodes, fetchXeroEarningsRates,
 *   getQueueDashboard, getEntityMappings, retryQueueItem, purgeCompletedQueue
 * @lastAudit 2026-03-24
 */
"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ── Types ─────────────────────────────────────────────────

export interface AccountCode {
  id: string;
  iworkr_code_type: string;
  iworkr_code_key: string;
  iworkr_code_label: string | null;
  external_code: string;
  external_name: string | null;
  external_tax_type: string | null;
  external_category: string | null;
  is_gst_free: boolean;
  is_active: boolean;
}

export interface EntityMapping {
  id: string;
  entity_type: string;
  iworkr_id: string;
  external_id: string;
  external_number: string | null;
  sync_status: string;
  last_synced_at: string | null;
  last_error: string | null;
}

export interface QueueDashboard {
  total_queued: number;
  total_processing: number;
  total_completed: number;
  total_failed: number;
  oldest_queued_at: string | null;
  recent_items: QueueItem[];
}

export interface QueueItem {
  id: string;
  entity_type: string;
  action: string;
  status: string;
  attempt_count: number;
  last_error: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface XeroEarningsRate {
  earningsRateId: string;
  name: string;
  earningsType: string;
  rateType: string;
  accountCode: string;
  isActive: boolean;
}

export interface ConnectionHealth {
  provider: string;
  is_connected: boolean;
  connection_status: string | null;
  external_org_name: string | null;
  expires_at: string | null;
  is_expired: boolean;
  refresh_failure_count: number;
  disconnect_reason: string | null;
  disconnected_at: string | null;
  queue_pending: number;
  queue_failed: number;
  entity_count: number;
}

// ── Queue Management ──────────────────────────────────────

export async function enqueueInvoiceSync(
  orgId: string,
  invoiceId: string,
  action: "CREATE" | "UPDATE" | "VOID" = "CREATE"
): Promise<{ ok: boolean; queueId: string | null; error: string | null }> {
  try {
    const supabase = await createServerSupabaseClient();

    const { data: invoice } = await (supabase as any)
      .from("invoices")
      .select("id, display_id, client_id, total, due_date, issue_date, status, notes, external_id, external_contact_id")
      .eq("id", invoiceId)
      .maybeSingle();

    if (!invoice) return { ok: false, queueId: null, error: "Invoice not found" };

    const { data: lineItems } = await (supabase as any)
      .from("invoice_line_items")
      .select("id, description, quantity, unit_price, amount")
      .eq("invoice_id", invoiceId);

    let clientData = null;
    if (invoice.client_id) {
      const { data: client } = await (supabase as any)
        .from("clients")
        .select("id, first_name, last_name, business_name, email, phone, address_line_1, city, state, postcode, abn")
        .eq("id", invoice.client_id)
        .maybeSingle();
      clientData = client;
    }

    const payload = {
      ...invoice,
      invoice_number: invoice.display_id,
      line_items: lineItems || [],
      client: clientData,
    };

    const { data: queueId, error: rpcError } = await (supabase as any).rpc(
      "enqueue_ledger_sync",
      {
        p_workspace_id: orgId,
        p_entity_type: "INVOICE",
        p_entity_id: invoiceId,
        p_action: action,
        p_payload: payload,
      }
    );

    if (rpcError) return { ok: false, queueId: null, error: rpcError.message };

    await (supabase as any)
      .from("invoices")
      .update({ sync_status: "PENDING", sync_error: null })
      .eq("id", invoiceId);

    revalidatePath("/dashboard/finance/invoicing");
    return { ok: true, queueId, error: null };
  } catch (err) {
    return {
      ok: false,
      queueId: null,
      error: err instanceof Error ? err.message : "Failed to enqueue invoice",
    };
  }
}

export async function enqueuePaymentSync(
  orgId: string,
  invoiceId: string,
  paymentData: {
    amount: number;
    paid_date: string;
    stripe_payment_id?: string;
    reference?: string;
  }
): Promise<{ ok: boolean; error: string | null }> {
  try {
    const supabase = await createServerSupabaseClient();

    const payload = {
      invoice_id: invoiceId,
      ...paymentData,
    };

    const { error: rpcError } = await (supabase as any).rpc(
      "enqueue_ledger_sync",
      {
        p_workspace_id: orgId,
        p_entity_type: "PAYMENT",
        p_entity_id: invoiceId,
        p_action: "CREATE",
        p_payload: payload,
      }
    );

    if (rpcError) return { ok: false, error: rpcError.message };
    return { ok: true, error: null };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to enqueue payment",
    };
  }
}

export async function enqueueTimesheetSync(
  orgId: string,
  workerId: string,
  periodStart: string,
  periodEnd: string,
  payLines: Array<{
    pay_category: string;
    units: number;
    shift_date: string;
    base_rate?: number;
    multiplier?: number;
    total?: number;
  }>
): Promise<{ ok: boolean; error: string | null }> {
  try {
    const supabase = await createServerSupabaseClient();

    const payload = {
      worker_id: workerId,
      period_start: periodStart,
      period_end: periodEnd,
      pay_lines: payLines,
    };

    const { error: rpcError } = await (supabase as any).rpc(
      "enqueue_ledger_sync",
      {
        p_workspace_id: orgId,
        p_entity_type: "TIMESHEET",
        p_entity_id: workerId,
        p_action: "CREATE",
        p_payload: payload,
      }
    );

    if (rpcError) return { ok: false, error: rpcError.message };
    return { ok: true, error: null };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to enqueue timesheet",
    };
  }
}

export async function enqueueContactSync(
  orgId: string,
  clientId: string,
  action: "CREATE" | "UPDATE" = "CREATE"
): Promise<{ ok: boolean; error: string | null }> {
  try {
    const supabase = await createServerSupabaseClient();

    const { data: client } = await supabase
      .from("clients")
      .select("id, first_name, last_name, business_name, email, phone, address_line_1, city, state, postcode, abn")
      .eq("id", clientId)
      .maybeSingle();

    if (!client) return { ok: false, error: "Client not found" };

    const { error: rpcError } = await (supabase as any).rpc(
      "enqueue_ledger_sync",
      {
        p_workspace_id: orgId,
        p_entity_type: "CONTACT",
        p_entity_id: clientId,
        p_action: action,
        p_payload: client,
      }
    );

    if (rpcError) return { ok: false, error: rpcError.message };
    return { ok: true, error: null };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to enqueue contact",
    };
  }
}

// ── Account Code Mapping ──────────────────────────────────

export async function getAccountCodes(
  orgId: string,
  codeType?: string
): Promise<{ data: AccountCode[] | null; error: string | null }> {
  const supabase = await createServerSupabaseClient();

  let query = (supabase as any)
    .from("integration_account_codes")
    .select("*")
    .eq("workspace_id", orgId)
    .eq("is_active", true)
    .order("iworkr_code_type", { ascending: true });

  if (codeType) {
    query = query.eq("iworkr_code_type", codeType);
  }

  const { data, error } = await query;
  if (error) return { data: null, error: error.message };
  return { data: data as AccountCode[], error: null };
}

export async function saveAccountCodes(
  orgId: string,
  codes: Array<{
    iworkr_code_type: string;
    iworkr_code_key: string;
    iworkr_code_label?: string;
    external_code: string;
    external_name?: string;
    external_tax_type?: string;
    external_category?: string;
    is_gst_free?: boolean;
  }>
): Promise<{ error: string | null }> {
  const supabase = await createServerSupabaseClient();

  const rows = codes.map((c) => ({
    workspace_id: orgId,
    provider: "XERO",
    iworkr_code_type: c.iworkr_code_type,
    iworkr_code_key: c.iworkr_code_key,
    iworkr_code_label: c.iworkr_code_label ?? null,
    external_code: c.external_code,
    external_name: c.external_name ?? null,
    external_tax_type: c.external_tax_type ?? null,
    external_category: c.external_category ?? null,
    is_gst_free: c.is_gst_free ?? false,
    is_active: true,
  }));

  const { error } = await (supabase as any)
    .from("integration_account_codes")
    .upsert(rows, {
      onConflict: "workspace_id,provider,iworkr_code_type,iworkr_code_key",
    });

  if (error) return { error: error.message };
  revalidatePath("/dashboard/settings/integrations");
  return { error: null };
}

// ── Xero Earnings Rates Fetch ─────────────────────────────

export async function fetchXeroEarningsRates(
  orgId: string
): Promise<{ data: XeroEarningsRate[] | null; error: string | null }> {
  const supabase = await createServerSupabaseClient();

  const { data: tokenRow } = await (supabase as any)
    .from("integration_tokens")
    .select("access_token, external_tenant_id, expires_at, refresh_token")
    .eq("workspace_id", orgId)
    .eq("provider", "XERO")
    .maybeSingle();

  if (!tokenRow) return { data: null, error: "Xero not connected" };

  let accessToken = tokenRow.access_token;

  if (new Date(tokenRow.expires_at) <= new Date(Date.now() + 60_000)) {
    try {
      const creds = Buffer.from(
        `${process.env.XERO_CLIENT_ID}:${process.env.XERO_CLIENT_SECRET}`
      ).toString("base64");
      const res = await fetch("https://identity.xero.com/connect/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${creds}`,
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: tokenRow.refresh_token,
        }),
      });
      if (res.ok) {
        const refreshed = await res.json();
        accessToken = refreshed.access_token;
        await (supabase as any).rpc("upsert_integration_token", {
          p_workspace_id: orgId,
          p_provider: "XERO",
          p_access_token: refreshed.access_token,
          p_refresh_token: refreshed.refresh_token ?? tokenRow.refresh_token,
          p_external_tenant_id: tokenRow.external_tenant_id,
          p_external_org_name: null,
          p_expires_at: new Date(
            Date.now() + refreshed.expires_in * 1000
          ).toISOString(),
        });
      }
    } catch {
      // Use existing token
    }
  }

  try {
    const res = await fetch(
      "https://api.xero.com/payroll.xro/1.0/PayItems",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "xero-tenant-id": tokenRow.external_tenant_id,
          Accept: "application/json",
        },
      }
    );

    if (!res.ok) return { data: null, error: `Xero Payroll API error: ${res.status}` };

    const json = await res.json();
    const earningsRates = (json?.PayItems?.EarningsRates ?? []).map(
      (rate: Record<string, unknown>) => ({
        earningsRateId: rate.EarningsRateID ?? "",
        name: rate.Name ?? "",
        earningsType: rate.EarningsType ?? "",
        rateType: rate.RateType ?? "",
        accountCode: rate.AccountCode ?? "",
        isActive: rate.IsExemptFromTax !== undefined,
      })
    );

    return { data: earningsRates, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : "Failed to fetch earnings rates",
    };
  }
}

// ── Queue Dashboard ───────────────────────────────────────

export async function getQueueDashboard(
  orgId: string
): Promise<{ data: QueueDashboard | null; error: string | null }> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await (supabase as any).rpc("get_queue_dashboard", {
    p_workspace_id: orgId,
  });

  if (error) return { data: null, error: error.message };

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    return {
      data: {
        total_queued: 0,
        total_processing: 0,
        total_completed: 0,
        total_failed: 0,
        oldest_queued_at: null,
        recent_items: [],
      },
      error: null,
    };
  }

  return {
    data: {
      total_queued: Number(row.total_queued) || 0,
      total_processing: Number(row.total_processing) || 0,
      total_completed: Number(row.total_completed) || 0,
      total_failed: Number(row.total_failed) || 0,
      oldest_queued_at: row.oldest_queued_at,
      recent_items: (row.recent_items || []) as QueueItem[],
    },
    error: null,
  };
}

export async function retryQueueItem(
  orgId: string,
  queueItemId: string
): Promise<{ error: string | null }> {
  const supabase = await createServerSupabaseClient();

  const { error } = await (supabase as any)
    .from("integration_sync_queue")
    .update({
      status: "queued",
      attempt_count: 0,
      next_attempt_at: new Date().toISOString(),
      last_error: null,
      error_log: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", queueItemId)
    .eq("organization_id", orgId);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/settings/integrations");
  return { error: null };
}

export async function purgeCompletedQueue(
  orgId: string,
  olderThanDays: number = 30
): Promise<{ deleted: number; error: string | null }> {
  const supabase = await createServerSupabaseClient();
  const cutoff = new Date(
    Date.now() - olderThanDays * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data, error } = await (supabase as any)
    .from("integration_sync_queue")
    .delete()
    .eq("organization_id", orgId)
    .in("status", ["completed", "done"])
    .lt("completed_at", cutoff)
    .select("id");

  if (error) return { deleted: 0, error: error.message };
  return { deleted: data?.length || 0, error: null };
}

// ── Entity Mappings ───────────────────────────────────────

export async function getEntityMappings(
  orgId: string,
  entityType?: string
): Promise<{ data: EntityMapping[] | null; error: string | null }> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await (supabase as any).rpc("get_entity_mappings", {
    p_workspace_id: orgId,
    p_entity_type: entityType ?? null,
    p_limit: 200,
  });

  if (error) return { data: null, error: error.message };
  return { data: data as EntityMapping[], error: null };
}

// ── Connection Health ─────────────────────────────────────

export async function getConnectionHealth(
  orgId: string
): Promise<{ data: ConnectionHealth | null; error: string | null }> {
  const supabase = await createServerSupabaseClient();

  const { data: token } = await (supabase as any)
    .from("integration_tokens")
    .select(
      "provider, external_org_name, expires_at, connection_status, refresh_failure_count, disconnect_reason, disconnected_at"
    )
    .eq("workspace_id", orgId)
    .eq("provider", "XERO")
    .maybeSingle();

  if (!token) {
    return {
      data: {
        provider: "XERO",
        is_connected: false,
        connection_status: null,
        external_org_name: null,
        expires_at: null,
        is_expired: true,
        refresh_failure_count: 0,
        disconnect_reason: null,
        disconnected_at: null,
        queue_pending: 0,
        queue_failed: 0,
        entity_count: 0,
      },
      error: null,
    };
  }

  const isExpired = new Date(token.expires_at) < new Date();

  const { count: queuePending } = await (supabase as any)
    .from("integration_sync_queue")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .in("status", ["queued", "pending", "QUEUED"]);

  const { count: queueFailed } = await (supabase as any)
    .from("integration_sync_queue")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .in("status", ["failed", "FAILED_PERMANENTLY"]);

  const { count: entityCount } = await (supabase as any)
    .from("integration_entity_map")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", orgId);

  return {
    data: {
      provider: "XERO",
      is_connected:
        token.connection_status !== "DISCONNECTED" && !isExpired,
      connection_status: token.connection_status,
      external_org_name: token.external_org_name,
      expires_at: token.expires_at,
      is_expired: isExpired,
      refresh_failure_count: token.refresh_failure_count || 0,
      disconnect_reason: token.disconnect_reason,
      disconnected_at: token.disconnected_at,
      queue_pending: queuePending || 0,
      queue_failed: queueFailed || 0,
      entity_count: entityCount || 0,
    },
    error: null,
  };
}

export async function reconnectIntegration(
  orgId: string
): Promise<{ error: string | null }> {
  const supabase = await createServerSupabaseClient();

  await (supabase as any)
    .from("integration_tokens")
    .update({
      connection_status: "CONNECTED",
      disconnect_reason: null,
      disconnected_at: null,
      refresh_failure_count: 0,
      updated_at: new Date().toISOString(),
    })
    .eq("workspace_id", orgId)
    .eq("provider", "XERO");

  await (supabase as any)
    .from("integrations")
    .update({
      status: "connected",
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", orgId)
    .in("provider", ["xero", "XERO"]);

  revalidatePath("/dashboard/settings/integrations");
  return { error: null };
}

// ── Trigger sync-engine manually ──────────────────────────

export async function triggerSyncEngine(): Promise<{
  ok: boolean;
  processed: number;
  failed: number;
  error: string | null;
}> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/sync-engine`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({}),
      }
    );

    if (!res.ok) {
      return { ok: false, processed: 0, failed: 0, error: `HTTP ${res.status}` };
    }

    const body = await res.json();
    return {
      ok: true,
      processed: body.processed || 0,
      failed: body.failed || 0,
      error: null,
    };
  } catch (err) {
    return {
      ok: false,
      processed: 0,
      failed: 0,
      error: err instanceof Error ? err.message : "Sync engine trigger failed",
    };
  }
}

"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type AccountingProvider = "XERO" | "MYOB";
export type IntegrationEntityType = "NDIS_CATEGORY" | "PAY_CATEGORY" | "TAX_RATE";
export type SyncStatus = "SUCCESS" | "PENDING" | "FAILED";

export interface IntegrationStatus {
  provider: AccountingProvider;
  is_connected: boolean;
  external_org_name: string | null;
  expires_at: string | null;
  updated_at: string | null;
  is_expired: boolean;
  mapping_count: number;
  last_sync_at: string | null;
  last_sync_status: SyncStatus | null;
  failed_count: number;
}

export interface IntegrationMapping {
  id: string;
  iworkr_entity_type: IntegrationEntityType;
  iworkr_entity_id: string;
  iworkr_entity_label: string | null;
  external_account_code: string;
  external_account_name: string | null;
  external_tax_type: string | null;
  external_tracking_category: string | null;
}

export interface SyncError {
  id: string;
  provider: AccountingProvider;
  direction: string;
  entity_type: string;
  entity_id: string | null;
  entity_label: string | null;
  error_message: string | null;
  http_status: number | null;
  retry_count: number;
  created_at: string;
}

// ── Get the Xero OAuth connect URL ───────────────────────
export async function getXeroConnectUrl(workspaceId: string): Promise<string> {
  const clientId = process.env.XERO_CLIENT_ID!;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/xero/callback`;
  const scopes = [
    "openid", "profile", "email",
    "accounting.transactions", "accounting.contacts",
    "accounting.settings", "offline_access",
  ].join(" ");

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: scopes,
    state: workspaceId,
  });

  return `https://login.xero.com/identity/connect/authorize?${params.toString()}`;
}

// ── Get integration status for all providers ─────────────
export async function getIntegrationStatuses(
  orgId: string
): Promise<{ data: IntegrationStatus[] | null; error: string | null }> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await (supabase as any).rpc("get_integration_status", {
    p_workspace_id: orgId,
  });
  if (error) return { data: null, error: error.message };
  return { data: data as IntegrationStatus[], error: null };
}

// ── Get mappings for a provider ──────────────────────────
export async function getIntegrationMappings(
  orgId: string,
  provider: AccountingProvider
): Promise<{ data: IntegrationMapping[] | null; error: string | null }> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await (supabase as any)
    .from("integration_mappings")
    .select("*")
    .eq("workspace_id", orgId)
    .eq("provider", provider)
    .order("iworkr_entity_type", { ascending: true });
  if (error) return { data: null, error: error.message };
  return { data: data as IntegrationMapping[], error: null };
}

// ── Save mappings (bulk upsert) ──────────────────────────
export async function saveIntegrationMappings(
  orgId: string,
  provider: AccountingProvider,
  mappings: Array<{
    iworkr_entity_type: IntegrationEntityType;
    iworkr_entity_id: string;
    iworkr_entity_label?: string;
    external_account_code: string;
    external_account_name?: string;
    external_tax_type?: string;
  }>
): Promise<{ error: string | null }> {
  const supabase = await createServerSupabaseClient();

  const rows = mappings.map((m) => ({
    workspace_id: orgId,
    provider,
    iworkr_entity_type: m.iworkr_entity_type,
    iworkr_entity_id: m.iworkr_entity_id,
    iworkr_entity_label: m.iworkr_entity_label ?? null,
    external_account_code: m.external_account_code,
    external_account_name: m.external_account_name ?? null,
    external_tax_type: m.external_tax_type ?? null,
  }));

  const { error } = await (supabase as any)
    .from("integration_mappings")
    .upsert(rows, { onConflict: "workspace_id,provider,iworkr_entity_type,iworkr_entity_id" });

  if (error) return { error: error.message };
  revalidatePath("/dashboard/settings/integrations");
  return { error: null };
}

// ── Disconnect provider ──────────────────────────────────
export async function disconnectIntegration(
  orgId: string,
  provider: AccountingProvider
): Promise<{ error: string | null }> {
  const supabase = await createServerSupabaseClient();
  const { error } = await (supabase as any).rpc("disconnect_integration", {
    p_workspace_id: orgId,
    p_provider: provider,
  });
  if (error) return { error: error.message };
  revalidatePath("/dashboard/settings/integrations");
  return { error: null };
}

// ── Fetch live Xero accounts ─────────────────────────────
export async function fetchXeroAccounts(
  orgId: string
): Promise<{ data: Array<{ code: string; name: string; type: string; taxType: string }> | null; error: string | null }> {
  const supabase = await createServerSupabaseClient();

  const { data: tokenRow, error: tokenErr } = await (supabase as any)
    .from("integration_tokens")
    .select("access_token, external_tenant_id, expires_at, refresh_token")
    .eq("workspace_id", orgId)
    .eq("provider", "XERO")
    .maybeSingle();

  if (tokenErr || !tokenRow) return { data: null, error: "Xero not connected" };

  let accessToken = tokenRow.access_token;

  // If expired, attempt refresh
  if (new Date(tokenRow.expires_at) <= new Date(Date.now() + 60_000)) {
    try {
      const creds = Buffer.from(`${process.env.XERO_CLIENT_ID}:${process.env.XERO_CLIENT_SECRET}`).toString("base64");
      const res = await fetch("https://identity.xero.com/connect/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${creds}` },
        body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: tokenRow.refresh_token }),
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
          p_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
        });
      }
    } catch {
      // Use existing token anyway
    }
  }

  try {
    const res = await fetch("https://api.xero.com/api.xro/2.0/Accounts?where=Status%3D%3D%22ACTIVE%22", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "xero-tenant-id": tokenRow.external_tenant_id,
        Accept: "application/json",
      },
    });

    if (!res.ok) return { data: null, error: `Xero API error: ${res.status}` };
    const json = await res.json();
    const accounts = (json.Accounts ?? []).map((a: any) => ({
      code: a.Code ?? "",
      name: a.Name ?? "",
      type: a.Type ?? "",
      taxType: a.TaxType ?? "NONE",
    }));

    return { data: accounts, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

// ── Get sync errors ──────────────────────────────────────
export async function getSyncErrors(
  orgId: string
): Promise<{ data: SyncError[] | null; error: string | null }> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await (supabase as any).rpc("get_sync_errors", {
    p_workspace_id: orgId,
    p_limit: 100,
  });
  if (error) return { data: null, error: error.message };
  return { data: data as SyncError[], error: null };
}

// ── Retry a failed sync ──────────────────────────────────
export async function retrySyncLog(
  orgId: string,
  logId: string
): Promise<{ error: string | null }> {
  const supabase = await createServerSupabaseClient();

  // Fetch log to get entity_id
  const { data: log } = await (supabase as any)
    .from("integration_sync_logs")
    .select("entity_id, entity_type")
    .eq("id", logId)
    .maybeSingle();

  if (!log) return { error: "Log not found" };

  // Increment retry count and reset to PENDING
  await (supabase as any)
    .from("integration_sync_logs")
    .update({ status: "PENDING", retry_count: (supabase as any).raw("retry_count + 1") })
    .eq("id", logId);

  // Trigger outbound sync
  if (log.entity_type === "INVOICE" && log.entity_id) {
    try {
      await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/sync-outbound`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({ invoice_id: log.entity_id, workspace_id: orgId }),
        }
      );
    } catch (err: any) {
      return { error: err.message };
    }
  }

  revalidatePath("/dashboard/finance/sync-errors");
  return { error: null };
}

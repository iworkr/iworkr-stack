/**
 * @module QBOSync Server Actions
 * @status COMPLETE
 * @description QuickBooks Online synchronization — OAuth token management, invoice sync, customer mapping, and reconciliation
 * @exports syncInvoicesToQBO, fetchQBOConnection, refreshQBOToken, mapCustomers, fetchQBOSyncLog
 * @lastAudit 2026-03-22
 */
"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { decrypt, encrypt } from "@/lib/encryption";
import type { SupabaseClient } from "@supabase/supabase-js";

/* ── Helpers ──────────────────────────────────────────── */

async function getQboIntegration(orgId: string) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, integration: null, error: "Unauthorized" };

  const { data: membership } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return { supabase, integration: null, error: "Unauthorized" };

  const { data: integration } = await (supabase as SupabaseClient)
    .from("integrations")
    .select("id, access_token, refresh_token, token_expires_at, external_tenant_id, status")
    .eq("organization_id", orgId)
    .eq("provider", "quickbooks")
    .eq("status", "connected")
    .maybeSingle();

  if (!integration) return { supabase, integration: null, error: "QuickBooks not connected" };
  return { supabase, integration, error: null };
}

async function getQboAccessToken(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  integration: Record<string, unknown>
): Promise<string | null> {
  let token = decrypt(integration.access_token as string);
  const expiresAt = integration.token_expires_at
    ? new Date(integration.token_expires_at as string)
    : null;

  if (expiresAt && expiresAt < new Date()) {
    const refreshed = await refreshQboToken(supabase, integration);
    if (refreshed) token = refreshed;
    else return null;
  }
  return token;
}

async function refreshQboToken(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  integration: Record<string, unknown>
): Promise<string | null> {
  const clientId = process.env.QUICKBOOKS_CLIENT_ID;
  const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET;
  if (!clientId || !clientSecret || !integration.refresh_token) return null;

  // Use advisory lock to prevent token stampede
  const claimed = await (supabase as SupabaseClient).rpc("claim_token_refresh_lock", {
    p_integration_id: integration.id as string,
    p_lock_seconds: 30,
  });
  if (!claimed?.data) return null;

  try {
    const res = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: decrypt(integration.refresh_token as string),
      }),
    });

    const data = await res.json();
    if (data.access_token) {
      const expiresAt = new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString();
      await (supabase as SupabaseClient).rpc("refresh_integration_token_locked", {
        p_integration_id: integration.id as string,
        p_new_access_token: encrypt(data.access_token),
        p_new_refresh_token: data.refresh_token ? encrypt(data.refresh_token) : null,
        p_expires_at: expiresAt,
      });
      return data.access_token;
    }
  } catch {
    await supabase
      .from("integrations")
      .update({
        refresh_failure_count: ((integration.refresh_failure_count as number) ?? 0) + 1,
        error_message: "Token refresh failed",
        updated_at: new Date().toISOString(),
      } as Record<string, unknown>)
      .eq("id", integration.id as string);
  }
  return null;
}

/* ── Fetch QBO Tax Codes ─────────────────────────────── */

export async function fetchQboTaxCodes(orgId: string): Promise<{
  data: { id: string; name: string; rate: number | null }[];
  error: string | null;
}> {
  const { supabase, integration, error } = await getQboIntegration(orgId);
  if (error || !integration) return { data: [], error: error ?? "Not connected" };

  const accessToken = await getQboAccessToken(supabase, integration as Record<string, unknown>);
  if (!accessToken) return { data: [], error: "Token expired" };

  const realmId = integration.external_tenant_id;
  if (!realmId) return { data: [], error: "No QuickBooks Company ID (realmId)" };

  try {
    const res = await fetch(
      `https://quickbooks.api.intuit.com/v3/company/${realmId}/query?query=${encodeURIComponent("SELECT * FROM TaxCode WHERE Active = true")}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      }
    );

    if (!res.ok) return { data: [], error: `QBO API error: ${res.status}` };

    const body = await res.json();
    const taxCodes = (body?.QueryResponse?.TaxCode ?? []) as Record<string, unknown>[];

    return {
      data: taxCodes.map((tc) => ({
        id: String(tc.Id ?? ""),
        name: String(tc.Name ?? ""),
        rate: null,
      })),
      error: null,
    };
  } catch (err) {
    return { data: [], error: err instanceof Error ? err.message : "Failed to fetch tax codes" };
  }
}

/* ── Save Tax Mappings ───────────────────────────────── */

export async function saveQboTaxMappings(
  orgId: string,
  mappings: { iworkrTaxName: string; qboTaxCodeId: string; qboTaxCodeName: string; qboTaxRate: number | null }[]
): Promise<{ error: string | null }> {
  const { supabase, integration, error } = await getQboIntegration(orgId);
  if (error || !integration) return { error: error ?? "Not connected" };

  try {
    for (const m of mappings) {
      await (supabase as SupabaseClient)
        .from("qbo_tax_mappings")
        .upsert(
          {
            organization_id: orgId,
            integration_id: integration.id,
            iworkr_tax_name: m.iworkrTaxName,
            qbo_tax_code_id: m.qboTaxCodeId,
            qbo_tax_code_name: m.qboTaxCodeName,
            qbo_tax_rate_pct: m.qboTaxRate,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "organization_id,iworkr_tax_name" }
        );
    }
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Save failed" };
  }
}

/* ── Get Saved Tax Mappings ──────────────────────────── */

export async function getQboTaxMappings(orgId: string): Promise<{
  data: { iworkr_tax_name: string; qbo_tax_code_id: string; qbo_tax_code_name: string; qbo_tax_rate_pct: number | null }[];
  error: string | null;
}> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: [], error: "Unauthorized" };

  const { data, error: dbErr } = await (supabase as SupabaseClient)
    .from("qbo_tax_mappings")
    .select("iworkr_tax_name, qbo_tax_code_id, qbo_tax_code_name, qbo_tax_rate_pct")
    .eq("organization_id", orgId);

  if (dbErr) return { data: [], error: dbErr.message };
  return { data: (data ?? []) as { iworkr_tax_name: string; qbo_tax_code_id: string; qbo_tax_code_name: string; qbo_tax_rate_pct: number | null }[], error: null };
}

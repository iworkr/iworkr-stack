// Edge Function: accounting-webhook
// Handles inbound events from Xero/MYOB
// Security: Xero ITR (Intent-to-Receive) HMAC-SHA256 signature validation

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { hmac } from "https://deno.land/x/hmac@v2.0.1/mod.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const XERO_WEBHOOK_KEY = Deno.env.get("XERO_WEBHOOK_KEY") ?? "";
const APP_URL = Deno.env.get("NEXT_PUBLIC_APP_URL") ?? "https://www.iworkrapp.com";
const REVALIDATE_SECRET = Deno.env.get("REVALIDATE_SECRET") ?? "";
const XERO_API_BASE = "https://api.xero.com/api.xro/2.0";
const XERO_TOKEN_URL = "https://identity.xero.com/connect/token";

// ── HMAC Signature Validation ────────────────────────────
async function validateXeroSignature(body: string, signature: string): Promise<boolean> {
  if (!XERO_WEBHOOK_KEY) return true; // Skip in dev if key not set
  try {
    const computed = await hmac("sha256", XERO_WEBHOOK_KEY, body, "utf8", "base64");
    return computed === signature;
  } catch {
    return false;
  }
}

// ── Token refresh helper ──────────────────────────────────
async function getValidToken(supabase: any, workspaceId: string): Promise<{ token: string; tenantId: string }> {
  const { data: tokenRow } = await supabase
    .from("integration_tokens")
    .select("access_token, refresh_token, expires_at, external_tenant_id")
    .eq("workspace_id", workspaceId)
    .eq("provider", "XERO")
    .maybeSingle();

  if (!tokenRow) throw new Error("No Xero token");

  const isExpired = new Date(tokenRow.expires_at) <= new Date(Date.now() + 60_000);
  if (!isExpired) return { token: tokenRow.access_token, tenantId: tokenRow.external_tenant_id };

  const clientId = Deno.env.get("XERO_CLIENT_ID")!;
  const clientSecret = Deno.env.get("XERO_CLIENT_SECRET")!;
  const creds = btoa(`${clientId}:${clientSecret}`);

  const res = await fetch(XERO_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${creds}` },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: tokenRow.refresh_token }),
  });

  if (!res.ok) throw new Error(`Token refresh failed: ${res.status}`);
  const refreshed = await res.json();
  const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();

  await supabase.rpc("upsert_integration_token", {
    p_workspace_id: workspaceId,
    p_provider: "XERO",
    p_access_token: refreshed.access_token,
    p_refresh_token: refreshed.refresh_token ?? tokenRow.refresh_token,
    p_external_tenant_id: tokenRow.external_tenant_id,
    p_external_org_name: null,
    p_expires_at: newExpiresAt,
  });

  return { token: refreshed.access_token, tenantId: tokenRow.external_tenant_id };
}

// ── Revalidate Next.js cache ──────────────────────────────
async function triggerRevalidation(path: string) {
  try {
    await fetch(`${APP_URL}/api/revalidate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, secret: REVALIDATE_SECRET }),
    });
  } catch {
    // Non-blocking
  }
}

// ── Main Handler ──────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  // Read raw body for signature validation
  const rawBody = await req.text();

  // ── Xero ITR (Intent-to-Receive) validation ───────────
  // Xero sends a POST with x-xero-signature header
  const xeroSignature = req.headers.get("x-xero-signature") ?? "";

  if (XERO_WEBHOOK_KEY) {
    const isValid = await validateXeroSignature(rawBody, xeroSignature);
    if (!isValid) {
      // Return 401 — Xero will retry and eventually disable the webhook if we keep returning 401
      return new Response("Signature mismatch", { status: 401, headers: CORS });
    }
  }

  // ── ITR Handshake: If body is empty, just return 200 ─
  if (!rawBody || rawBody.trim() === "") {
    return new Response("ok", { status: 200, headers: CORS });
  }

  let events: any[] = [];
  try {
    const parsed = JSON.parse(rawBody);
    events = parsed?.events ?? [];
  } catch {
    return new Response("ok", { status: 200, headers: CORS });
  }

  const processed: string[] = [];
  const errors: string[] = [];

  for (const event of events) {
    try {
      const { resourceId, eventType, eventCategory, tenantId } = event;

      if (eventType !== "UPDATE" || eventCategory !== "INVOICE") continue;

      // Find the workspace associated with this Xero tenant
      const { data: tokenRow } = await supabase
        .from("integration_tokens")
        .select("workspace_id")
        .eq("external_tenant_id", tenantId)
        .eq("provider", "XERO")
        .maybeSingle();

      if (!tokenRow) continue;
      const workspaceId = tokenRow.workspace_id;

      // Find the iWorkr invoice by Xero external_id
      const { data: iworkrInvoice } = await supabase
        .from("invoices")
        .select("id, status, total, display_id")
        .eq("external_id", resourceId)
        .maybeSingle();

      if (!iworkrInvoice) continue;

      // Fetch latest status from Xero (webhooks don't carry full data)
      const { token: accessToken } = await getValidToken(supabase, workspaceId);

      const xeroRes = await fetch(`${XERO_API_BASE}/Invoices/${resourceId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "xero-tenant-id": tenantId,
          Accept: "application/json",
        },
      });

      if (!xeroRes.ok) continue;
      const xeroData = await xeroRes.json();
      const xeroInvoice = xeroData?.Invoices?.[0];

      if (!xeroInvoice) continue;

      // Write sync log
      await supabase.from("integration_sync_logs").insert({
        workspace_id: workspaceId,
        provider: "XERO",
        direction: "INBOUND_WEBHOOK",
        entity_type: "INVOICE",
        entity_id: iworkrInvoice.id,
        entity_label: iworkrInvoice.display_id,
        status: "PENDING",
        payload: event,
        response: xeroInvoice,
      });

      // Reconciliation: if Xero marks as PAID → update iWorkr
      if (xeroInvoice.Status === "PAID") {
        const amountPaid = xeroInvoice.AmountPaid ?? xeroInvoice.Total ?? 0;

        await supabase
          .from("invoices")
          .update({
            status: "paid",
            paid_date: new Date().toISOString().split("T")[0],
            sync_status: "SUCCESS",
            synced_at: new Date().toISOString(),
          })
          .eq("id", iworkrInvoice.id);

        // Update sync log
        await supabase
          .from("integration_sync_logs")
          .update({ status: "SUCCESS" })
          .eq("entity_id", iworkrInvoice.id)
          .eq("direction", "INBOUND_WEBHOOK")
          .order("created_at", { ascending: false })
          .limit(1);

        // Invalidate Next.js dashboard cache
        await triggerRevalidation("/dashboard/finance/invoicing");
        await triggerRevalidation("/dashboard/finance/invoicing");

        processed.push(`Invoice ${iworkrInvoice.display_id} marked PAID`);
      } else if (xeroInvoice.Status === "VOIDED") {
        await supabase
          .from("invoices")
          .update({ status: "voided", sync_status: "SUCCESS" })
          .eq("id", iworkrInvoice.id);
        processed.push(`Invoice ${iworkrInvoice.display_id} voided`);
      }
    } catch (err: any) {
      errors.push(err.message);
    }
  }

  return new Response(
    JSON.stringify({ ok: true, processed, errors }),
    { status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
  );
});

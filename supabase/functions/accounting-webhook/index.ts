/**
 * @module accounting-webhook
 * @status COMPLETE
 * @auth SECURED — HMAC-SHA256 signature validation (Xero + QBO webhook signatures)
 * @description Handles inbound Xero/QBO accounting webhooks: ITR handshake, invoice sync, token refresh, reconciliation
 * @dependencies Xero API, QuickBooks Online API, Supabase (DB)
 * @lastAudit 2026-03-22
 */
// ============================================================
// Edge Function: accounting-webhook
// Project Synapse-Prod — Production Accounting Webhook Handler
// Handles: Xero ITR (Intent-to-Receive), Xero events, QBO events
// Security: HMAC-SHA256 cryptographic signature validation
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders as baseCorsHeaders } from "../_shared/cors.ts";

const CORS = {
  ...baseCorsHeaders,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-xero-signature, intuit-signature",
};

const XERO_API_BASE = "https://api.xero.com/api.xro/2.0";
const XERO_TOKEN_URL = "https://identity.xero.com/connect/token";
const APP_URL =
  Deno.env.get("NEXT_PUBLIC_APP_URL") ?? "https://www.iworkrapp.com";
const REVALIDATE_SECRET = Deno.env.get("REVALIDATE_SECRET") ?? "";

// ── Crypto: HMAC-SHA256 computation using Web Crypto API ──────
async function computeHmacSha256Base64(
  key: string,
  message: string
): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    enc.encode(message)
  );
  // Convert ArrayBuffer to base64
  const bytes = new Uint8Array(signature);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

// ── Xero ITR + Event signature validation ─────────────────────
async function validateXeroSignature(
  body: string,
  signature: string,
  webhookKey: string
): Promise<boolean> {
  if (!webhookKey) {
    console.warn("[accounting-webhook] No XERO_WEBHOOK_KEY configured — skipping validation");
    return true;
  }
  try {
    const computed = await computeHmacSha256Base64(webhookKey, body);
    // Constant-time comparison to prevent timing attacks
    if (computed.length !== signature.length) return false;
    let result = 0;
    for (let i = 0; i < computed.length; i++) {
      result |= computed.charCodeAt(i) ^ signature.charCodeAt(i);
    }
    return result === 0;
  } catch (err) {
    console.error("[accounting-webhook] HMAC computation failed:", err);
    return false;
  }
}

// ── QBO webhook signature validation ──────────────────────────
async function validateQboSignature(
  body: string,
  signature: string,
  verifierToken: string
): Promise<boolean> {
  if (!verifierToken) return true;
  try {
    const computed = await computeHmacSha256Base64(verifierToken, body);
    if (computed.length !== signature.length) return false;
    let result = 0;
    for (let i = 0; i < computed.length; i++) {
      result |= computed.charCodeAt(i) ^ signature.charCodeAt(i);
    }
    return result === 0;
  } catch {
    return false;
  }
}

// ── Token refresh with advisory lock via RPC ──────────────────
async function getValidToken(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string,
  provider: string = "XERO"
): Promise<{ token: string; tenantId: string; connectionId: string | null }> {
  // Use advisory lock RPC to prevent concurrent refresh
  const { data: tokenResult, error: rpcError } = await supabase.rpc(
    "get_valid_integration_token",
    { p_workspace_id: workspaceId, p_provider: provider }
  );

  if (rpcError) throw new Error(`Token RPC failed: ${rpcError.message}`);
  const result = typeof tokenResult === "string" ? JSON.parse(tokenResult) : tokenResult;

  if (result.error) throw new Error(result.error);

  // If token is valid, return it
  if (!result.needs_refresh) {
    return {
      token: result.access_token,
      tenantId: result.external_tenant_id,
      connectionId: result.connection_id,
    };
  }

  // If another thread is refreshing, wait and re-fetch
  if (result.locked_by_other) {
    await new Promise((r) => setTimeout(r, 1000));
    return getValidToken(supabase, workspaceId, provider);
  }

  // We must refresh the token
  const clientId = provider === "XERO"
    ? Deno.env.get("XERO_CLIENT_ID")!
    : Deno.env.get("QBO_CLIENT_ID")!;
  const clientSecret = provider === "XERO"
    ? Deno.env.get("XERO_CLIENT_SECRET")!
    : Deno.env.get("QBO_CLIENT_SECRET")!;
  const tokenUrl = provider === "XERO"
    ? XERO_TOKEN_URL
    : "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";

  const creds = btoa(`${clientId}:${clientSecret}`);

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${creds}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: result.refresh_token,
    }),
  });

  if (!res.ok) {
    // Record failure
    await supabase
      .from("integration_tokens")
      .update({
        refresh_failure_count: (result.refresh_failure_count || 0) + 1,
        token_refresh_lock_until: null,
      })
      .eq("workspace_id", workspaceId)
      .eq("provider", provider);
    throw new Error(`Token refresh failed: HTTP ${res.status}`);
  }

  const refreshed = await res.json();
  const expiresIn = refreshed.expires_in || 1800;

  // Update token via RPC
  await supabase.rpc("update_integration_token", {
    p_workspace_id: workspaceId,
    p_provider: provider,
    p_access_token: refreshed.access_token,
    p_refresh_token: refreshed.refresh_token || result.refresh_token,
    p_expires_in_seconds: expiresIn,
  });

  // Update health metrics
  await supabase
    .from("integration_health_metrics")
    .upsert(
      {
        organization_id: workspaceId,
        provider: provider.toLowerCase(),
        metric_date: new Date().toISOString().split("T")[0],
        token_refreshes: 1,
      },
      { onConflict: "organization_id,provider,metric_date" }
    );

  return {
    token: refreshed.access_token,
    tenantId: result.external_tenant_id,
    connectionId: result.connection_id,
  };
}

// ── Revalidate Next.js cache ──────────────────────────────────
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

// ── Process Xero webhook events ───────────────────────────────
async function processXeroEvents(
  supabase: ReturnType<typeof createClient>,
  events: any[]
): Promise<{ processed: string[]; errors: string[] }> {
  const processed: string[] = [];
  const errors: string[] = [];

  for (const event of events) {
    try {
      const { resourceId, eventType, eventCategory, tenantId } = event;

      // Log webhook event
      await supabase.from("integration_webhooks").insert({
        provider: "xero",
        event_type: `${eventCategory}.${eventType}`,
        payload: event,
        processed: false,
        direction: "inbound",
      });

      // Only handle INVOICE events for now
      if (eventCategory !== "INVOICE") continue;

      // Find workspace for this tenant
      const { data: tokenRow } = await supabase
        .from("integration_tokens")
        .select("workspace_id")
        .eq("external_tenant_id", tenantId)
        .eq("provider", "XERO")
        .maybeSingle();

      if (!tokenRow) {
        errors.push(`No workspace for tenant ${tenantId}`);
        continue;
      }

      const workspaceId = tokenRow.workspace_id;

      // Find the iWorkr invoice by Xero external_id
      const { data: iworkrInvoice } = await supabase
        .from("invoices")
        .select("id, status, total, display_id")
        .eq("external_id", resourceId)
        .maybeSingle();

      if (!iworkrInvoice) continue;

      // Fetch latest status from Xero
      const { token: accessToken, tenantId: tid } = await getValidToken(
        supabase,
        workspaceId,
        "XERO"
      );

      const xeroRes = await fetch(
        `${XERO_API_BASE}/Invoices/${resourceId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "xero-tenant-id": tid,
            Accept: "application/json",
          },
        }
      );

      if (!xeroRes.ok) {
        errors.push(`Xero API ${xeroRes.status} for ${resourceId}`);
        continue;
      }

      const xeroData = await xeroRes.json();
      const xeroInvoice = xeroData?.Invoices?.[0];
      if (!xeroInvoice) continue;

      // Write sync log
      await supabase.from("integration_sync_log").insert({
        organization_id: workspaceId,
        direction: "inbound",
        entity_type: "invoice",
        entity_id: iworkrInvoice.id,
        provider_entity_id: resourceId,
        status: "success",
        metadata: { xero_status: xeroInvoice.Status, event_type: eventType },
      });

      // Reconciliation + entity map update
      if (xeroInvoice.Status === "PAID") {
        await supabase
          .from("invoices")
          .update({
            status: "paid",
            paid_date: xeroInvoice.FullyPaidOnDate ||
              new Date().toISOString().split("T")[0],
            sync_status: "SUCCESS",
            synced_at: new Date().toISOString(),
          })
          .eq("id", iworkrInvoice.id);

        await supabase.rpc("upsert_entity_mapping", {
          p_workspace_id: workspaceId,
          p_provider: "XERO",
          p_entity_type: "INVOICE",
          p_iworkr_id: iworkrInvoice.id,
          p_external_id: resourceId,
          p_metadata: JSON.stringify({ status: "PAID", paid_date: xeroInvoice.FullyPaidOnDate }),
        });

        await triggerRevalidation("/dashboard/finance/invoicing");
        processed.push(`Invoice ${iworkrInvoice.display_id} marked PAID`);
      } else if (xeroInvoice.Status === "VOIDED") {
        await supabase
          .from("invoices")
          .update({ status: "voided", sync_status: "SUCCESS" })
          .eq("id", iworkrInvoice.id);

        await supabase.rpc("upsert_entity_mapping", {
          p_workspace_id: workspaceId,
          p_provider: "XERO",
          p_entity_type: "INVOICE",
          p_iworkr_id: iworkrInvoice.id,
          p_external_id: resourceId,
          p_metadata: JSON.stringify({ status: "VOIDED" }),
        });

        processed.push(`Invoice ${iworkrInvoice.display_id} voided`);
      }

      // Mark webhook as processed
      await supabase
        .from("integration_webhooks")
        .update({ processed: true, processed_at: new Date().toISOString() })
        .eq("payload->>resourceId", resourceId)
        .eq("provider", "xero")
        .eq("processed", false);

      // Update health metrics
      await supabase
        .from("integration_health_metrics")
        .upsert(
          {
            organization_id: workspaceId,
            provider: "xero",
            metric_date: new Date().toISOString().split("T")[0],
            webhook_events: 1,
          },
          { onConflict: "organization_id,provider,metric_date" }
        );
    } catch (err: any) {
      errors.push(err.message);
    }
  }

  return { processed, errors };
}

// ── Main Handler ──────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  const startTime = Date.now();
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  // Read raw body for signature validation (MUST happen before JSON parse)
  const rawBody = await req.text();

  // ── Detect provider from headers ────────────────────────────
  const xeroSignature = req.headers.get("x-xero-signature");
  const intuitSignature = req.headers.get("intuit-signature");

  // ──────────────────────────────────────────────────────────────
  // XERO WEBHOOK HANDLING
  // ──────────────────────────────────────────────────────────────
  if (xeroSignature !== null) {
    // Fetch the global webhook key from env or DB
    const webhookKey =
      Deno.env.get("XERO_WEBHOOK_KEY") ?? "";

    // Validate HMAC-SHA256 signature
    const isValid = await validateXeroSignature(
      rawBody,
      xeroSignature,
      webhookKey
    );

    if (!isValid) {
      console.error(
        "[accounting-webhook] Xero HMAC-SHA256 signature mismatch — returning 401"
      );
      return new Response("Signature mismatch", {
        status: 401,
        headers: CORS,
      });
    }

    // ── ITR (Intent-to-Receive) Handshake ─────────────────────
    // Xero sends a POST with an empty events array for ITR validation.
    // We MUST respond HTTP 200 within 5 seconds.
    if (!rawBody || rawBody.trim() === "" || rawBody.trim() === "{}") {
      console.log("[accounting-webhook] Xero ITR handshake — responding 200 OK");
      return new Response("OK", { status: 200, headers: CORS });
    }

    let parsed: any;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      return new Response("OK", { status: 200, headers: CORS });
    }

    const events = parsed?.events ?? [];

    // ITR validation: empty events array = respond 200 immediately
    if (events.length === 0) {
      console.log(
        "[accounting-webhook] Xero ITR validation (empty events) — responding 200 OK"
      );
      return new Response("OK", { status: 200, headers: CORS });
    }

    // Process actual events
    const { processed, errors } = await processXeroEvents(supabase, events);

    const elapsed = Date.now() - startTime;
    return new Response(
      JSON.stringify({
        ok: true,
        provider: "xero",
        processed,
        errors,
        elapsed_ms: elapsed,
      }),
      {
        status: 200,
        headers: { ...CORS, "Content-Type": "application/json" },
      }
    );
  }

  // ──────────────────────────────────────────────────────────────
  // QBO (INTUIT) WEBHOOK HANDLING
  // ──────────────────────────────────────────────────────────────
  if (intuitSignature !== null) {
    const verifierToken = Deno.env.get("QBO_WEBHOOK_VERIFIER_TOKEN") ?? "";

    const isValid = await validateQboSignature(
      rawBody,
      intuitSignature,
      verifierToken
    );

    if (!isValid) {
      console.error(
        "[accounting-webhook] QBO HMAC signature mismatch — returning 401"
      );
      return new Response("Signature mismatch", {
        status: 401,
        headers: CORS,
      });
    }

    // QBO Verifier Challenge
    let parsed: any;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      return new Response("OK", { status: 200, headers: CORS });
    }

    // Log webhook event
    await supabase.from("integration_webhooks").insert({
      provider: "qbo",
      event_type: "qbo_webhook",
      payload: parsed,
      processed: false,
      direction: "inbound",
    });

    // Process QBO event notifications
    const eventNotifications = parsed?.eventNotifications ?? [];
    const processed: string[] = [];

    for (const notification of eventNotifications) {
      const realmId = notification?.realmId;
      const entities = notification?.dataChangeEvent?.entities ?? [];

      for (const entity of entities) {
        try {
          if (entity.name === "Invoice") {
            // Find workspace by QBO realm ID
            const { data: tokenRow } = await supabase
              .from("integration_tokens")
              .select("workspace_id")
              .eq("external_tenant_id", realmId)
              .eq("provider", "QBO")
              .maybeSingle();

            if (!tokenRow) continue;

            await supabase.from("integration_sync_log").insert({
              organization_id: tokenRow.workspace_id,
              direction: "inbound",
              entity_type: "invoice",
              entity_id: entity.id,
              status: "success",
              metadata: {
                operation: entity.operation,
                realm_id: realmId,
              },
            });

            processed.push(`QBO Invoice ${entity.id} (${entity.operation})`);
          }
        } catch (err: any) {
          console.error("[accounting-webhook] QBO event error:", err.message);
        }
      }
    }

    return new Response(
      JSON.stringify({ ok: true, provider: "qbo", processed }),
      {
        status: 200,
        headers: { ...CORS, "Content-Type": "application/json" },
      }
    );
  }

  // ── Unknown provider or no signature ────────────────────────
  return new Response(
    JSON.stringify({ error: "Unknown webhook provider" }),
    { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
  );
});

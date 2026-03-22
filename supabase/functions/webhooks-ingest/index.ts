import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";
import { withZodInterceptor } from "../_shared/withZodInterceptor.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ALLOWED_ORIGINS = [
  Deno.env.get("APP_URL") || "https://iworkrapp.com",
  "http://localhost:3000",
];

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  const allowOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-iworkr-provider, x-iworkr-signature, x-iworkr-org-id, stripe-signature, x-xero-signature",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };
}

function json(req: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(req) });
}

function headersToJson(req: Request) {
  const entries = Array.from(req.headers.entries());
  return Object.fromEntries(entries);
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.length % 2 === 0 ? hex : `0${hex}`;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.slice(i, i + 2), 16);
  }
  return bytes;
}

function timingSafeEqualHex(leftHex: string, rightHex: string) {
  if (leftHex.length !== rightHex.length) return false;
  const left = hexToBytes(leftHex);
  const right = hexToBytes(rightHex);
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left[i] ^ right[i];
  return diff === 0;
}

async function hmacSha256Hex(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256Hex(message: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(message));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function verifyStripeSignature(rawBody: string, signatureHeader: string, secret: string) {
  const parts = signatureHeader.split(",").map((v) => v.trim());
  const timestamp = parts.find((p) => p.startsWith("t="))?.slice(2);
  const signatures = parts.filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  if (!timestamp || signatures.length === 0) return false;
  const payload = `${timestamp}.${rawBody}`;
  const expected = await hmacSha256Hex(secret, payload);
  return signatures.some((sig) => timingSafeEqualHex(sig, expected));
}

async function verifyXeroSignature(rawBody: string, signatureHeader: string, secret: string) {
  // Xero sends base64(HMAC_SHA256(rawBody, webhook_secret))
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const expectedBase64 = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return expectedBase64 === signatureHeader;
}

const GenericIngestSchema = z.object({
  tenant_id: z.string().uuid("Invalid Tenant ID mapping"),
  event_type: z.string().min(1),
  payload: z.record(z.unknown()),
  timestamp: z.string().datetime(),
  provider: z.string().optional(),
  organization_id: z.string().uuid().optional(),
  org_id: z.string().uuid().optional(),
}).strict();

const StripeEnvelopeSchema = z.object({
  provider: z.literal("stripe").optional(),
  type: z.string().min(1),
  data: z.object({
    object: z.record(z.unknown()).optional(),
  }).strict(),
  organization_id: z.string().uuid().optional(),
  org_id: z.string().uuid().optional(),
}).strict();

const XeroEnvelopeSchema = z.object({
  provider: z.literal("xero").optional(),
  events: z.array(z.record(z.unknown())),
  tenant_id: z.string().optional(),
  tenantId: z.string().optional(),
  organization_id: z.string().uuid().optional(),
  org_id: z.string().uuid().optional(),
}).strict();

const WebhooksIngestSchema = z.union([GenericIngestSchema, StripeEnvelopeSchema, XeroEnvelopeSchema]);

Deno.serve(withZodInterceptor(WebhooksIngestSchema, async (req: Request, parsed, ctx) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  try {
    const rawBody = ctx.rawBody;
    const payloadHash = await sha256Hex(rawBody);
    const normalized = parsed as Record<string, unknown>;
    const requestHeaders = headersToJson(req);
    const provider = (
      req.headers.get("x-iworkr-provider") ||
      normalized.provider ||
      (String(normalized.type || "").startsWith("customer.") || String(normalized.type || "").startsWith("payment_intent.")
        ? "stripe"
        : "xero")
    ).toString().toLowerCase();

    const orgId = req.headers.get("x-iworkr-org-id") || normalized.organization_id || normalized.org_id || null;
    const xeroTenantIdHeader = req.headers.get("xero-tenant-id") || req.headers.get("x-xero-tenant-id");
    const firstXeroEvent = Array.isArray(normalized.events) ? normalized.events[0] as Record<string, unknown> : null;
    const tenantId =
      xeroTenantIdHeader ||
      normalized.tenant_id ||
      normalized.realmId ||
      normalized.tenantId ||
      firstXeroEvent?.tenantId as string ||
      firstXeroEvent?.tenant_id as string ||
      null;
    const eventType =
      normalized.type ||
      normalized.event_type ||
      normalized.eventType ||
      (Array.isArray(normalized.events) && (normalized.events[0] as Record<string, unknown>)?.eventType as string) ||
      "unknown";

    // Verify signatures when secrets are configured.
    const iworkrSig = req.headers.get("x-iworkr-signature");
    if (iworkrSig && Deno.env.get("INTEGRATIONS_WEBHOOK_SIGNING_SECRET")) {
      const expected = await hmacSha256Hex(Deno.env.get("INTEGRATIONS_WEBHOOK_SIGNING_SECRET")!, rawBody);
      if (!timingSafeEqualHex(iworkrSig, expected)) {
        return json(req, { error: "Invalid x-iworkr-signature" }, 401);
      }
    }

    const stripeSig = req.headers.get("stripe-signature");
    if (provider === "stripe" && stripeSig && Deno.env.get("STRIPE_WEBHOOK_SECRET")) {
      const ok = await verifyStripeSignature(rawBody, stripeSig, Deno.env.get("STRIPE_WEBHOOK_SECRET")!);
      if (!ok) return json(req, { error: "Invalid stripe signature" }, 401);
    }

    const xeroSig = req.headers.get("x-xero-signature");
    if (provider === "xero" && xeroSig && Deno.env.get("XERO_WEBHOOK_SECRET")) {
      const ok = await verifyXeroSignature(rawBody, xeroSig, Deno.env.get("XERO_WEBHOOK_SECRET")!);
      if (!ok) return json(req, { error: "Invalid xero signature" }, 401);
    }

    let resolvedOrgId = orgId;
    if (provider === "xero" && tenantId) {
      const { data: tenantIntegration } = await supabase
        .from("tenant_integrations")
        .select("organization_id")
        .eq("integration_type", "xero")
        .eq("xero_tenant_id", tenantId)
        .maybeSingle();
      resolvedOrgId = tenantIntegration?.organization_id ?? resolvedOrgId;
    }

    let integrationQuery = supabase
      .from("integrations")
      .select("id, organization_id, provider, provider_org_id, settings")
      .eq("provider", provider);

    if (resolvedOrgId) integrationQuery = integrationQuery.eq("organization_id", resolvedOrgId);
    const { data: integrationRows } = await integrationQuery.limit(20);
    const integration =
      integrationRows?.find((row) => {
        if (!tenantId) return true;
        const tenantFromSettings = row.settings?.tenant_id || row.settings?.xero_tenant_id;
        return row.provider_org_id === tenantId || tenantFromSettings === tenantId;
      }) || integrationRows?.[0];

    const integrationId = integration?.id ?? null;
    resolvedOrgId = integration?.organization_id ?? resolvedOrgId;

    const routeToDlq = async (failureReason: string, metadata?: Record<string, unknown>) => {
      await supabase.from("webhook_dead_letters").insert({
        organization_id: resolvedOrgId,
        source: provider || "unknown",
        event_type: String(eventType || "unknown"),
        raw_payload: normalized,
        headers: requestHeaders,
        failure_reason: failureReason,
        is_resolved: false,
      });
      if (integrationId) {
        await supabase.from("integration_sync_log").insert({
          organization_id: resolvedOrgId,
          integration_id: integrationId,
          direction: "inbound",
          entity_type: "webhook",
          status: "error",
          error_message: failureReason,
          metadata: metadata || {},
        });
      }
    };

    if (!integrationId) {
      await routeToDlq(
        `UNRESOLVED_INTEGRATION_ID${tenantId ? `:${tenantId}` : ""}`,
        { provider, tenant_id: tenantId, event_type: eventType },
      );
      return json(req, {
        success: true,
        status: "dlq_routed",
        reason: "UNRESOLVED_INTEGRATION_ID",
        provider,
      });
    }

    const { data: webhookRow } = await supabase
      .from("integration_webhooks")
      .insert({
        organization_id: resolvedOrgId,
        integration_id: integrationId,
        provider,
        event_type: String(eventType),
        direction: "inbound",
        signature: iworkrSig || stripeSig || xeroSig || null,
          payload: normalized,
        payload_hash: payloadHash,
        processed: false,
      })
      .select("id")
      .maybeSingle();

    const log = async (status: "success" | "error" | "pending", entityType: string, errorMessage?: string, metadata?: Record<string, unknown>) => {
      if (!integrationId) return;
      await supabase.from("integration_sync_log").insert({
        organization_id: resolvedOrgId,
        integration_id: integrationId,
        direction: "inbound",
        entity_type: entityType,
        status,
        error_message: errorMessage || null,
        metadata: metadata || {},
      });
    };

    let processedCount = 0;

    if (provider === "stripe") {
      const stripeData = (normalized.data as Record<string, unknown> | undefined) || {};
      const stripeObject = (stripeData.object as Record<string, unknown> | undefined) || {};
      const internalInvoiceId = stripeObject.metadata?.invoice_id || stripeObject.metadata?.internal_invoice_id || null;
      const providerInvoiceId = stripeObject.invoice || stripeObject.id || null;

      if (
        ["charge.succeeded", "payment_intent.succeeded", "invoice.payment_succeeded"].includes(String(eventType))
      ) {
        let invoiceId = internalInvoiceId as string | null;

        if (!invoiceId && providerInvoiceId && integrationId) {
          const { data: mapping } = await supabase
            .from("external_mappings")
            .select("internal_record_id")
            .eq("integration_id", integrationId)
            .eq("internal_table", "invoices")
            .eq("external_id", String(providerInvoiceId))
            .maybeSingle();
          invoiceId = mapping?.internal_record_id || null;
        }

        if (invoiceId) {
          await supabase.from("invoices").update({ status: "paid" }).eq("id", invoiceId);
          await log("success", "invoice", undefined, {
            invoice_id: invoiceId,
            provider_invoice_id: providerInvoiceId,
            event_type: eventType,
          });
          processedCount += 1;
        } else {
          await log("pending", "invoice", "Invoice mapping missing for stripe event", {
            provider_invoice_id: providerInvoiceId,
            event_type: eventType,
          });
        }
      } else {
        await log("success", "webhook", undefined, { event_type: eventType });
      }
    } else if (provider === "xero") {
      const events = Array.isArray(normalized.events) ? normalized.events : [];
      for (const evt of events) {
        const xeroEvent = evt as Record<string, unknown>;
        const resourceId = (xeroEvent.resourceId as string) || (xeroEvent.resource_id as string);
        const eventTypeValue = (xeroEvent.eventType as string) || (xeroEvent.event_type as string) || "xero_event";
        if (!integrationId || !resolvedOrgId || !resourceId) continue;

        // Xero webhook payloads don't always include full resource state, queue a fetch task.
        const { error: enqueueError } = await supabase.rpc("enqueue_integration_sync_job", {
          p_organization_id: resolvedOrgId,
          p_integration_id: integrationId,
          p_provider: "xero",
          p_operation: "refresh_invoice",
          p_payload: { resource_id: resourceId, event_type: eventTypeValue, tenant_id: tenantId },
          p_idempotency_key: `${tenantId || "tenantless"}:${resourceId}:${eventTypeValue}`,
        });
        if (enqueueError) {
          await routeToDlq("QUEUE_ENQUEUE_FAILED", {
            provider: "xero",
            tenant_id: tenantId,
            resource_id: resourceId,
            event_type: eventTypeValue,
            message: enqueueError.message,
          });
          continue;
        }

        await log("pending", "invoice", undefined, {
          provider_invoice_id: resourceId,
          event_type: eventTypeValue,
          note: "Queued for pull enrichment before applying state",
        });
        processedCount += 1;
      }
    } else {
      await log("success", "webhook", undefined, { event_type: eventType });
    }

    if (integrationId) {
      await supabase.from("integrations").update({
        last_sync: new Date().toISOString(),
        error_message: null,
      }).eq("id", integrationId);
    }

    if (webhookRow?.id) {
      await supabase
        .from("integration_webhooks")
        .update({
          processed: true,
          processed_at: new Date().toISOString(),
        })
        .eq("id", webhookRow.id);
    }

    return json(req, {
      success: true,
      provider,
      processed: processedCount,
      integration_id: integrationId,
    });
  } catch (err) {
    console.error("[webhooks-ingest] error:", err);
    return json(req, { error: (err as Error).message || "Webhook ingest failed" }, 500);
  }
}, { bypassMethods: ["OPTIONS"] }));


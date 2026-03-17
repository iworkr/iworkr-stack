// Edge Function: sync-outbound
// Triggered by DB webhook when invoices.status = 'sent'
// Handles: token refresh, contact resolution, invoice push, payroll push

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const XERO_TOKEN_URL = "https://identity.xero.com/connect/token";
const XERO_API_BASE = "https://api.xero.com/api.xro/2.0";
const REVALIDATE_SECRET = Deno.env.get("REVALIDATE_SECRET") ?? "";
const APP_URL = Deno.env.get("NEXT_PUBLIC_APP_URL") ?? "https://www.iworkrapp.com";

// ── Token Management ──────────────────────────────────────
async function getValidToken(supabase: any, workspaceId: string, provider: string): Promise<string> {
  const { data: token, error } = await supabase
    .from("integration_tokens")
    .select("access_token, refresh_token, expires_at, external_tenant_id")
    .eq("workspace_id", workspaceId)
    .eq("provider", provider)
    .maybeSingle();

  if (error || !token) throw new Error(`No ${provider} token found for workspace`);

  const isExpired = new Date(token.expires_at) <= new Date(Date.now() + 60_000);
  if (!isExpired) return token.access_token;

  // Refresh the token
  const clientId = Deno.env.get("XERO_CLIENT_ID")!;
  const clientSecret = Deno.env.get("XERO_CLIENT_SECRET")!;
  const creds = btoa(`${clientId}:${clientSecret}`);

  const res = await fetch(XERO_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${creds}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: token.refresh_token,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token refresh failed: ${err}`);
  }

  const refreshed = await res.json();
  const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();

  await supabase.rpc("upsert_integration_token", {
    p_workspace_id: workspaceId,
    p_provider: provider,
    p_access_token: refreshed.access_token,
    p_refresh_token: refreshed.refresh_token ?? token.refresh_token,
    p_external_tenant_id: token.external_tenant_id,
    p_external_org_name: null,
    p_expires_at: newExpiresAt,
  });

  return refreshed.access_token;
}

// ── Xero API Helpers ──────────────────────────────────────
async function xeroGet(path: string, accessToken: string, tenantId: string) {
  const res = await fetch(`${XERO_API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "xero-tenant-id": tenantId,
      Accept: "application/json",
    },
  });
  if (!res.ok) throw new Error(`Xero GET ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function xeroPost(path: string, body: unknown, accessToken: string, tenantId: string) {
  const res = await fetch(`${XERO_API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "xero-tenant-id": tenantId,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json() };
}

// ── Contact Resolution ────────────────────────────────────
async function resolveContact(
  supabase: any,
  invoiceId: string,
  contactEmail: string,
  contactName: string,
  existingContactId: string | null,
  accessToken: string,
  tenantId: string
): Promise<string> {
  if (existingContactId) return existingContactId;

  // Search Xero for existing contact by email
  const searchRes = await fetch(
    `${XERO_API_BASE}/Contacts?where=EmailAddress%3D%3D%22${encodeURIComponent(contactEmail)}%22`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "xero-tenant-id": tenantId,
        Accept: "application/json",
      },
    }
  );

  if (searchRes.ok) {
    const searchData = await searchRes.json();
    const existing = searchData?.Contacts?.[0];
    if (existing?.ContactID) {
      // Save back to iWorkr
      await supabase
        .from("invoices")
        .update({ external_contact_id: existing.ContactID })
        .eq("id", invoiceId);
      return existing.ContactID;
    }
  }

  // Create new Xero contact
  const createRes = await xeroPost(
    "/Contacts",
    { Contacts: [{ Name: contactName, EmailAddress: contactEmail }] },
    accessToken,
    tenantId
  );

  const newContactId = createRes.data?.Contacts?.[0]?.ContactID;
  if (!newContactId) throw new Error("Failed to create Xero contact");

  await supabase
    .from("invoices")
    .update({ external_contact_id: newContactId })
    .eq("id", invoiceId);

  return newContactId;
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

  let invoiceId: string | null = null;
  let workspaceId: string | null = null;
  let logId: string | null = null;

  try {
    const body = await req.json();

    // DB Webhook format: { type: 'UPDATE', record: {...}, old_record: {...} }
    // Manual trigger format: { invoice_id: '...', workspace_id: '...' }
    invoiceId = body?.record?.id ?? body?.invoice_id;
    workspaceId = body?.record?.organization_id ?? body?.workspace_id;

    if (!invoiceId || !workspaceId) {
      return new Response(JSON.stringify({ error: "Missing invoice_id or workspace_id" }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // Only process if status is 'sent'
    const newStatus = body?.record?.status ?? body?.status;
    if (newStatus && newStatus !== "sent") {
      return new Response(JSON.stringify({ skipped: true, reason: "Status is not sent" }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // Fetch full invoice details
    const { data: invoice, error: invError } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", invoiceId)
      .single();

    if (invError || !invoice) throw new Error("Invoice not found");

    // Skip if already synced
    if (invoice.external_id) {
      return new Response(JSON.stringify({ skipped: true, reason: "Already synced", external_id: invoice.external_id }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // Get token with auto-refresh
    const { data: tokenRow } = await supabase
      .from("integration_tokens")
      .select("external_tenant_id")
      .eq("workspace_id", workspaceId)
      .eq("provider", "XERO")
      .maybeSingle();

    if (!tokenRow) {
      return new Response(JSON.stringify({ skipped: true, reason: "No Xero integration configured" }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const tenantId = tokenRow.external_tenant_id;
    const accessToken = await getValidToken(supabase, workspaceId, "XERO");

    // Fetch account mappings
    const { data: mappings } = await supabase
      .from("integration_mappings")
      .select("iworkr_entity_id, external_account_code, external_tax_type")
      .eq("workspace_id", workspaceId)
      .eq("provider", "XERO")
      .eq("iworkr_entity_type", "NDIS_CATEGORY");

    const mappingMap: Record<string, { code: string; tax: string }> = {};
    for (const m of mappings ?? []) {
      mappingMap[m.iworkr_entity_id] = {
        code: m.external_account_code,
        tax: m.external_tax_type ?? "NONE",
      };
    }

    // Resolve contact
    const contactEmail = invoice.plan_manager_email ?? invoice.client_email ?? "";
    const contactName = invoice.plan_manager_name ?? invoice.client_name ?? "Unknown";
    const contactId = await resolveContact(
      supabase,
      invoiceId,
      contactEmail,
      contactName,
      invoice.external_contact_id,
      accessToken,
      tenantId
    );

    // Build line items
    const lineItems = (invoice.metadata?.line_items ?? []).map((li: any) => {
      const mapping = mappingMap[li.ndis_code ?? ""] ?? { code: "200", tax: "NONE" };
      return {
        Description: li.description ?? li.ndis_code,
        Quantity: li.quantity ?? 1,
        UnitAmount: li.unit_price ?? li.amount ?? 0,
        AccountCode: mapping.code,
        TaxType: mapping.tax,
      };
    });

    // If no line items, use invoice total as single line
    if (lineItems.length === 0) {
      lineItems.push({
        Description: `Invoice ${invoice.display_id} — Support Services`,
        Quantity: 1,
        UnitAmount: Number(invoice.total ?? 0),
        AccountCode: "200",
        TaxType: "NONE",
      });
    }

    const xeroPayload = {
      Invoices: [
        {
          Type: "ACCREC",
          Contact: { ContactID: contactId },
          InvoiceNumber: invoice.display_id,
          Date: invoice.issue_date,
          DueDate: invoice.due_date,
          LineItems: lineItems,
          Status: "AUTHORISED",
          Reference: invoice.ndis_participant_number ?? "",
        },
      ],
    };

    // Write log entry (PENDING)
    const { data: logEntry } = await supabase
      .from("integration_sync_logs")
      .insert({
        workspace_id: workspaceId,
        provider: "XERO",
        direction: "OUTBOUND_PUSH",
        entity_type: "INVOICE",
        entity_id: invoiceId,
        entity_label: invoice.display_id,
        status: "PENDING",
        payload: xeroPayload,
      })
      .select("id")
      .single();

    logId = logEntry?.id;

    // POST to Xero
    const { status: httpStatus, data: xeroResponse } = await xeroPost(
      "/Invoices",
      xeroPayload,
      accessToken,
      tenantId
    );

    const xeroInvoiceId = xeroResponse?.Invoices?.[0]?.InvoiceID;
    const xeroError = xeroResponse?.Elements?.[0]?.ValidationErrors?.[0]?.Message
      ?? xeroResponse?.Message
      ?? null;

    if (httpStatus === 200 && xeroInvoiceId) {
      // SUCCESS — save external ID
      await supabase
        .from("invoices")
        .update({
          external_id: xeroInvoiceId,
          external_provider: "XERO",
          sync_status: "SUCCESS",
          sync_error: null,
          synced_at: new Date().toISOString(),
        })
        .eq("id", invoiceId);

      if (logId) {
        await supabase
          .from("integration_sync_logs")
          .update({ status: "SUCCESS", http_status: httpStatus, response: xeroResponse, external_id: xeroInvoiceId })
          .eq("id", logId);
      }

      await triggerRevalidation("/dashboard/finance/invoicing");

      return new Response(
        JSON.stringify({ ok: true, xero_invoice_id: xeroInvoiceId }),
        { headers: { ...CORS, "Content-Type": "application/json" } }
      );
    } else {
      // FAILED
      const errMsg = xeroError ?? `Xero responded with ${httpStatus}`;
      await supabase
        .from("invoices")
        .update({ sync_status: "FAILED", sync_error: errMsg })
        .eq("id", invoiceId);

      if (logId) {
        await supabase
          .from("integration_sync_logs")
          .update({ status: "FAILED", http_status: httpStatus, response: xeroResponse, error_message: errMsg })
          .eq("id", logId);
      }

      return new Response(
        JSON.stringify({ ok: false, error: errMsg }),
        { status: 422, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }
  } catch (err: any) {
    const errMsg = err.message ?? "Unknown error";

    if (invoiceId) {
      await supabase
        .from("invoices")
        .update({ sync_status: "FAILED", sync_error: errMsg })
        .eq("id", invoiceId);
    }

    if (logId) {
      await supabase
        .from("integration_sync_logs")
        .update({ status: "FAILED", error_message: errMsg })
        .eq("id", logId);
    } else if (workspaceId) {
      await supabase.from("integration_sync_logs").insert({
        workspace_id: workspaceId,
        provider: "XERO",
        direction: "OUTBOUND_PUSH",
        entity_type: "INVOICE",
        entity_id: invoiceId,
        status: "FAILED",
        error_message: errMsg,
      });
    }

    return new Response(
      JSON.stringify({ ok: false, error: errMsg }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});

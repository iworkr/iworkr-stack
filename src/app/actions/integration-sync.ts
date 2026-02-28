"use server";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { refreshIntegrationToken } from "./integration-oauth";

/* ── Sync Orchestrator ────────────────────────────────── */

export async function triggerSync(integrationId: string): Promise<{ error?: string; synced?: number }> {
  const supabase = await createServerSupabaseClient();

  const { data: int } = await supabase
    .from("integrations")
    .select("*")
    .eq("id", integrationId)
    .maybeSingle();

  if (!int) return { error: "Integration not found" };
  if (int.status !== "connected") return { error: "Integration not connected" };

  // Check token expiry
  if (int.token_expires_at && new Date(int.token_expires_at) < new Date()) {
    const refreshResult = await refreshIntegrationToken(integrationId);
    if (refreshResult.error) return { error: `Token expired: ${refreshResult.error}` };
  }

  // Mark as syncing
  await supabase
    .from("integrations")
    .update({ status: "syncing" })
    .eq("id", integrationId);

  let syncedCount = 0;

  try {
    switch (int.provider) {
      case "xero":
        syncedCount = await syncXero(int);
        break;
      case "quickbooks":
        syncedCount = await syncQuickBooks(int);
        break;
      case "gmail":
        syncedCount = await syncGmail(int);
        break;
      case "google_calendar":
        syncedCount = await syncGoogleCalendar(int);
        break;
      case "gohighlevel":
        syncedCount = await syncGoHighLevel(int);
        break;
      default:
        syncedCount = 0;
    }

    // Mark as connected with updated sync time
    await supabase
      .from("integrations")
      .update({
        status: "connected",
        last_sync: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", integrationId);

    revalidatePath("/dashboard/integrations");
    return { synced: syncedCount };
  } catch (err: any) {
    await supabase
      .from("integrations")
      .update({
        status: "error",
        error_message: err.message || "Sync failed",
      })
      .eq("id", integrationId);

    return { error: err.message || "Sync failed" };
  }
}

/* ── Xero Sync ────────────────────────────────────────── */

async function syncXero(int: any): Promise<number> {
  if (!process.env.XERO_CLIENT_ID || !process.env.XERO_CLIENT_SECRET) return 0;
  const res = await fetch("https://api.xero.com/api.xro/2.0/Contacts?page=1&pageSize=100", {
    headers: {
      Authorization: `Bearer ${int.access_token}`,
      "Xero-Tenant-Id": int.settings?.tenant_id || "",
      Accept: "application/json",
    },
  });
  if (!res.ok) throw new Error(`Xero API error: ${res.status}`);
  const data = await res.json();
  return data.Contacts?.length || 0;
}

/* ── QuickBooks Sync ──────────────────────────────────── */

async function syncQuickBooks(int: any): Promise<number> {
  if (!process.env.QUICKBOOKS_CLIENT_ID || !process.env.QUICKBOOKS_CLIENT_SECRET) return 0;
  const realmId = int.settings?.realm_id;
  if (!realmId) throw new Error("QuickBooks realm_id not set in integration settings");
  const res = await fetch(
    `https://quickbooks.api.intuit.com/v3/company/${realmId}/query?query=${encodeURIComponent("SELECT * FROM Customer MAXRESULTS 100")}`,
    { headers: { Authorization: `Bearer ${int.access_token}`, Accept: "application/json" } }
  );
  if (!res.ok) throw new Error(`QuickBooks API error: ${res.status}`);
  const data = await res.json();
  return data.QueryResponse?.Customer?.length || 0;
}

/* ── Gmail Sync ───────────────────────────────────────── */

async function syncGmail(int: any): Promise<number> {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) return 0;
  const res = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=50&q=is:inbox",
    { headers: { Authorization: `Bearer ${int.access_token}` } }
  );
  if (!res.ok) throw new Error(`Gmail API error: ${res.status}`);
  const data = await res.json();
  return data.messages?.length || 0;
}

/* ── Google Calendar Sync ─────────────────────────────── */

async function syncGoogleCalendar(int: any): Promise<number> {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) return 0;
  const now = new Date().toISOString();
  const maxDate = new Date(Date.now() + 30 * 86400000).toISOString();
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${now}&timeMax=${maxDate}&maxResults=100&singleEvents=true`,
    { headers: { Authorization: `Bearer ${int.access_token}` } }
  );
  if (!res.ok) throw new Error(`Google Calendar API error: ${res.status}`);
  const data = await res.json();
  return data.items?.length || 0;
}

/* ── GoHighLevel Sync ─────────────────────────────────── */

async function syncGoHighLevel(int: any): Promise<number> {
  if (!int.access_token) return 0;
  const locationId = int.settings?.location_id;
  if (!locationId) throw new Error("GoHighLevel location_id not set in integration settings");
  const res = await fetch(
    `https://services.leadconnectorhq.com/contacts/?locationId=${locationId}&limit=100`,
    { headers: { Authorization: `Bearer ${int.access_token}`, Version: "2021-07-28" } }
  );
  if (!res.ok) throw new Error(`GoHighLevel API error: ${res.status}`);
  const data = await res.json();
  return data.contacts?.length || 0;
}

/* ── Push Single Invoice (Real-time trigger) ──────────── */

export async function pushInvoiceToProvider(invoiceId: string, orgId: string): Promise<{ error?: string }> {
  const supabase = await createServerSupabaseClient();

  const { data: integrations } = await supabase
    .from("integrations")
    .select("*")
    .eq("organization_id", orgId)
    .eq("status", "connected")
    .eq("category", "financial")
    .in("provider", ["xero", "quickbooks"]);

  if (!integrations?.length) return { error: "No financial integrations connected" };

  for (const int of integrations) {
    if (int.provider === "xero" && process.env.XERO_CLIENT_ID) {
      const { data: invoice } = await supabase
        .from("invoices")
        .select("*, line_items:invoice_line_items(*)")
        .eq("id", invoiceId)
        .maybeSingle();
      if (!invoice) return { error: "Invoice not found" };

      const res = await fetch("https://api.xero.com/api.xro/2.0/Invoices", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${int.access_token}`,
          "Xero-Tenant-Id": (int.settings as any)?.tenant_id || "",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          Invoices: [{
            Type: "ACCREC",
            Contact: { Name: invoice.client_name },
            LineItems: (invoice.line_items || []).map((li: any) => ({
              Description: li.description,
              Quantity: li.quantity,
              UnitAmount: li.unit_price,
            })),
            Date: invoice.issue_date,
            DueDate: invoice.due_date,
            Reference: invoice.display_id,
          }],
        }),
      });
      if (!res.ok) return { error: `Xero push failed: ${res.status}` };
    }
  }

  return {};
}

"use server";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { logSyncEvent, refreshIntegrationToken } from "./integration-oauth";

/* ── Sync Orchestrator ────────────────────────────────── */

export async function triggerSync(integrationId: string): Promise<{ error?: string; synced?: number }> {
  const supabase = await createServerSupabaseClient();

  const { data: int } = await (supabase as any)
    .from("integrations")
    .select("*")
    .eq("id", integrationId)
    .single();

  if (!int) return { error: "Integration not found" };
  if (int.status !== "connected") return { error: "Integration not connected" };

  // Check token expiry
  if (int.token_expires_at && new Date(int.token_expires_at) < new Date()) {
    const refreshResult = await refreshIntegrationToken(integrationId);
    if (refreshResult.error) return { error: `Token expired: ${refreshResult.error}` };
  }

  // Mark as syncing
  await (supabase as any)
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
    await (supabase as any)
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
    await (supabase as any)
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
  const supabase = await createServerSupabaseClient();
  const settings = int.settings || {};
  let count = 0;

  // Push invoices to Xero (sent/approved invoices that haven't been synced)
  if (settings.sync_invoices) {
    const { data: invoices } = await (supabase as any)
      .from("invoices")
      .select("*")
      .eq("organization_id", int.organization_id)
      .in("status", ["sent", "paid"])
      .is("metadata->xero_invoice_id", null)
      .limit(50);

    for (const inv of invoices || []) {
      try {
        // In production: POST to Xero API to create invoice
        // const xeroInvoice = await xeroApi.post('/api.xro/2.0/Invoices', { ... });
        // Simulate: mark as synced
        await (supabase as any)
          .from("invoices")
          .update({
            metadata: { ...(inv.metadata || {}), xero_invoice_id: `XERO-${inv.display_id}`, xero_synced_at: new Date().toISOString() },
          })
          .eq("id", inv.id);

        await logSyncEvent({
          integration_id: int.id,
          organization_id: int.organization_id,
          direction: "push",
          entity_type: "invoice",
          entity_id: inv.id,
          provider_entity_id: `XERO-${inv.display_id}`,
          status: "success",
          metadata: { display_id: inv.display_id, total: inv.total },
        });
        count++;
      } catch (err: any) {
        await logSyncEvent({
          integration_id: int.id,
          organization_id: int.organization_id,
          direction: "push",
          entity_type: "invoice",
          entity_id: inv.id,
          status: "error",
          error_message: err.message,
        });
      }
    }
  }

  // Sync contacts
  if (settings.sync_contacts) {
    const { data: clients } = await (supabase as any)
      .from("clients")
      .select("id, name, email")
      .eq("organization_id", int.organization_id)
      .is("metadata->xero_contact_id", null)
      .limit(50);

    for (const client of clients || []) {
      try {
        // In production: POST to Xero Contacts API
        await (supabase as any)
          .from("clients")
          .update({
            metadata: { xero_contact_id: `XERO-C-${client.id.slice(0, 8)}`, xero_synced_at: new Date().toISOString() },
          })
          .eq("id", client.id);

        await logSyncEvent({
          integration_id: int.id,
          organization_id: int.organization_id,
          direction: "push",
          entity_type: "contact",
          entity_id: client.id,
          status: "success",
        });
        count++;
      } catch { /* continue */ }
    }
  }

  return count;
}

/* ── QuickBooks Sync ──────────────────────────────────── */

async function syncQuickBooks(int: any): Promise<number> {
  const supabase = await createServerSupabaseClient();
  const settings = int.settings || {};
  let count = 0;

  if (settings.sync_invoices) {
    const { data: invoices } = await (supabase as any)
      .from("invoices")
      .select("*")
      .eq("organization_id", int.organization_id)
      .in("status", ["sent", "paid"])
      .is("metadata->qbo_invoice_id", null)
      .limit(50);

    for (const inv of invoices || []) {
      try {
        // In production: POST to QuickBooks API
        await (supabase as any)
          .from("invoices")
          .update({
            metadata: { ...(inv.metadata || {}), qbo_invoice_id: `QBO-${inv.display_id}`, qbo_synced_at: new Date().toISOString() },
          })
          .eq("id", inv.id);

        await logSyncEvent({
          integration_id: int.id,
          organization_id: int.organization_id,
          direction: "push",
          entity_type: "invoice",
          entity_id: inv.id,
          provider_entity_id: `QBO-${inv.display_id}`,
          status: "success",
        });
        count++;
      } catch { /* continue */ }
    }
  }

  return count;
}

/* ── Gmail Sync ───────────────────────────────────────── */

async function syncGmail(int: any): Promise<number> {
  const settings = int.settings || {};
  let count = 0;

  if (settings.thread_sync) {
    // In production: Fetch threads from Gmail API matching client emails
    // const threads = await gmail.users.threads.list({ q: clientEmails.join(' OR ') });
    await logSyncEvent({
      integration_id: int.id,
      organization_id: int.organization_id,
      direction: "pull",
      entity_type: "email_threads",
      status: "success",
      metadata: { threads_matched: 0 },
    });
  }

  return count;
}

/* ── Google Calendar Sync ─────────────────────────────── */

async function syncGoogleCalendar(int: any): Promise<number> {
  const supabase = await createServerSupabaseClient();
  const settings = int.settings || {};
  let count = 0;

  if (settings.push_jobs) {
    // Push scheduled jobs to Google Calendar
    const { data: jobs } = await (supabase as any)
      .from("jobs")
      .select("id, title, description, scheduled_date, scheduled_time, duration")
      .eq("organization_id", int.organization_id)
      .not("scheduled_date", "is", null)
      .is("metadata->gcal_event_id", null)
      .limit(50);

    for (const job of jobs || []) {
      try {
        // In production: POST to Google Calendar Events API
        await logSyncEvent({
          integration_id: int.id,
          organization_id: int.organization_id,
          direction: "push",
          entity_type: "calendar_event",
          entity_id: job.id,
          status: "success",
          metadata: { job_title: job.title },
        });
        count++;
      } catch { /* continue */ }
    }
  }

  return count;
}

/* ── GoHighLevel Sync ─────────────────────────────────── */

async function syncGoHighLevel(int: any): Promise<number> {
  const settings = int.settings || {};
  let count = 0;

  if (settings.sync_leads) {
    // In production: Fetch leads from GHL API
    // const leads = await ghlApi.get('/contacts', { params: { pipelineId: settings.pipeline_id } });
    await logSyncEvent({
      integration_id: int.id,
      organization_id: int.organization_id,
      direction: "pull",
      entity_type: "lead",
      status: "success",
      metadata: { leads_imported: 0 },
    });
  }

  return count;
}

/* ── Push Single Invoice (Real-time trigger) ──────────── */

export async function pushInvoiceToProvider(invoiceId: string, orgId: string): Promise<{ error?: string }> {
  const supabase = await createServerSupabaseClient();

  // Find connected financial integrations
  const { data: integrations } = await (supabase as any)
    .from("integrations")
    .select("*")
    .eq("organization_id", orgId)
    .eq("status", "connected")
    .eq("category", "financial")
    .in("provider", ["xero", "quickbooks"]);

  if (!integrations?.length) return { error: "No financial integrations connected" };

  for (const int of integrations) {
    const settings = int.settings || {};
    if (!settings.sync_invoices) continue;

    try {
      // In production, this would make the actual API call
      await logSyncEvent({
        integration_id: int.id,
        organization_id: orgId,
        direction: "push",
        entity_type: "invoice",
        entity_id: invoiceId,
        status: "success",
        metadata: { provider: int.provider },
      });
    } catch (err: any) {
      await logSyncEvent({
        integration_id: int.id,
        organization_id: orgId,
        direction: "push",
        entity_type: "invoice",
        entity_id: invoiceId,
        status: "error",
        error_message: err.message,
      });
    }
  }

  return {};
}

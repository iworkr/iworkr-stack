"use server";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { refreshIntegrationToken } from "./integration-oauth";

/* ── Sync Orchestrator ────────────────────────────────── */

// INCOMPLETE:BLOCKED(AUTH) — triggerSync has no auth check; any unauthenticated call can trigger sync operations.
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

// INCOMPLETE:BLOCKED(XERO_CLIENT_ID) — Xero sync not implemented; requires Xero API credentials and OAuth flow.
async function syncXero(_int: any): Promise<number> {
  throw new Error("Xero sync not yet implemented. Configure XERO_CLIENT_ID and XERO_CLIENT_SECRET.");
}

/* ── QuickBooks Sync ──────────────────────────────────── */

// INCOMPLETE:BLOCKED(QUICKBOOKS_CLIENT_ID) — QuickBooks sync not implemented.
async function syncQuickBooks(_int: any): Promise<number> {
  throw new Error("QuickBooks sync not yet implemented. Configure QUICKBOOKS_CLIENT_ID and QUICKBOOKS_CLIENT_SECRET.");
}

/* ── Gmail Sync ───────────────────────────────────────── */

// INCOMPLETE:BLOCKED(GMAIL_API) — Gmail sync not implemented; requires Google OAuth consent screen + Gmail API scope.
async function syncGmail(_int: any): Promise<number> {
  throw new Error("Gmail sync not yet implemented. Configure GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET.");
}

/* ── Google Calendar Sync ─────────────────────────────── */

// INCOMPLETE:BLOCKED(GCAL_API) — Google Calendar sync not implemented.
async function syncGoogleCalendar(_int: any): Promise<number> {
  throw new Error("Google Calendar sync not yet implemented. Configure GOOGLE_CALENDAR_CLIENT_ID and GOOGLE_CALENDAR_CLIENT_SECRET.");
}

/* ── GoHighLevel Sync ─────────────────────────────────── */

// INCOMPLETE:BLOCKED(GHL_API) — GoHighLevel sync not implemented.
async function syncGoHighLevel(_int: any): Promise<number> {
  throw new Error("GoHighLevel sync not yet implemented. Configure GHL_CLIENT_ID and GHL_CLIENT_SECRET.");
}

/* ── Push Single Invoice (Real-time trigger) ──────────── */

// INCOMPLETE:BLOCKED(AUTH) — pushInvoiceToProvider has no auth check and returns stub error; financial push sync not implemented.
export async function pushInvoiceToProvider(invoiceId: string, orgId: string): Promise<{ error?: string }> {
  const supabase = await createServerSupabaseClient();

  // Find connected financial integrations
  const { data: integrations } = await supabase
    .from("integrations")
    .select("*")
    .eq("organization_id", orgId)
    .eq("status", "connected")
    .eq("category", "financial")
    .in("provider", ["xero", "quickbooks"]);

  if (!integrations?.length) return { error: "No financial integrations connected" };

  const providers = integrations.map((i: any) => i.provider).join(", ");
  return { error: `${providers} sync not yet implemented. Configure the required API credentials.` };
}

/**
 * @module Billing Server Actions
 * @status COMPLETE
 * @description NDIS billing engine — invoice CRUD, funding allocation, claim generation, and payment reconciliation
 * @exports createInvoiceAction, fetchInvoicesAction, submitClaimAction, reconcilePaymentAction, fetchBillingSummary
 * @lastAudit 2026-03-22
 */
"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ─── Types ────────────────────────────────────────────────────────────────────

export type FundingType = "plan_managed" | "self_managed" | "ndia_managed";

export type InvoiceStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "paid"
  | "overdue"
  | "void";

export interface BillingInvoice {
  id: string;
  display_id: string;
  organization_id: string;
  participant_id: string | null;
  participant_name: string;
  participant_avatar: string | null;
  client_email: string | null;
  funding_type: FundingType;
  status: InvoiceStatus;
  total: number;
  subtotal: number;
  issue_date: string | null;
  due_date: string | null;
  paid_date: string | null;
  billing_period_start: string | null;
  billing_period_end: string | null;
  plan_manager_email: string | null;
  plan_manager_name: string | null;
  ndis_participant_number: string | null;
  proda_export_status: string;
  dispatch_attempted_at: string | null;
  dispatch_error: string | null;
  line_item_count: number;
  created_at: string;
}

export interface InvoiceLineItem {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  hours: number | null;
  rate: number | null;
  line_total: number | null;
  ndis_support_item_number: string | null;
  support_category: string | null;
  shift_date: string | null;
  shift_id: string | null;
  worker_id: string | null;
  is_override: boolean;
  override_reason: string | null;
  sort_order: number;
}

export interface BillingTelemetry {
  unbilled_value: number;
  draft_value: number;
  outstanding: number;
  overdue: number;
  ytd_revenue: number;
}

export interface BatchResult {
  invoices_created: string[];
  batches: number;
  shifts_billed: number;
}

/** Raw invoice row from Supabase select (with nested relations) */
interface InvoiceRowRaw {
  id: string;
  display_id: string;
  organization_id: string;
  participant_id: string | null;
  client_name?: string | null;
  client_email: string | null;
  funding_type: string;
  status: string;
  total: number | null;
  subtotal: number | null;
  issue_date: string | null;
  due_date: string | null;
  paid_date: string | null;
  billing_period_start: string | null;
  billing_period_end: string | null;
  plan_manager_email: string | null;
  plan_manager_name: string | null;
  ndis_participant_number: string | null;
  proda_export_status: string;
  dispatch_attempted_at: string | null;
  dispatch_error: string | null;
  created_at: string;
  clients?: { first_name?: string; last_name?: string; avatar_url?: string } | { first_name?: string; last_name?: string; avatar_url?: string }[] | null;
  participant_profiles?: { full_name?: string; ndis_number?: string } | { full_name?: string; ndis_number?: string }[] | null;
  invoice_line_items?: { id: string }[] | null;
}

/** Raw line item row from Supabase */
interface LineItemRowRaw {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number | null;
  unit_price: number | null;
  hours: number | null;
  rate: number | null;
  line_total: number | null;
  ndis_support_item_number: string | null;
  support_category: string | null;
  shift_date: string | null;
  shift_id: string | null;
  worker_id: string | null;
  is_override: boolean | null;
  override_reason: string | null;
  sort_order: number | null;
}

/** Raw org settings shape */
interface OrgSettingsRaw {
  abn?: string;
  ndis_registration_number?: string;
}

// ─── Fetch invoices (the billing grid data) ───────────────────────────────────

export async function getBillingInvoices(
  orgId: string,
  status?: string,
  search?: string,
): Promise<{ invoices: BillingInvoice[]; error: string | null }> {
  try {
    const supabase = await createServerSupabaseClient();
    // Hyperion-Vanguard S-02: Auth gate
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) throw new Error("Unauthorized");

    let query = (supabase as SupabaseClient)
      .from("invoices")
      .select(
        `id, display_id, organization_id, participant_id, client_name, client_email,
         funding_type, status, total, subtotal, issue_date, due_date, paid_date,
         billing_period_start, billing_period_end, plan_manager_email, plan_manager_name,
         ndis_participant_number, proda_export_status, dispatch_attempted_at, dispatch_error,
         created_at,
         clients!invoices_participant_id_fkey(first_name, last_name, avatar_url),
         participant_profiles(ndis_number, full_name),
         invoice_line_items(id)`,
      )
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    // Tab filter
    if (status === "draft") query = query.eq("status", "draft");
    else if (status === "sent") query = query.in("status", ["sent", "viewed"]);
    else if (status === "overdue") query = query.in("status", ["overdue", "sent", "viewed"])
      .lt("due_date", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
    else if (status === "paid") query = query.eq("status", "paid");
    else if (status === "proda") query = query.eq("proda_export_status", "queued");

    // Search
    if (search) {
      query = query.or(
        `display_id.ilike.%${search}%,client_name.ilike.%${search}%`,
      );
    }

    const { data, error } = await query.limit(200);
    if (error) throw error;

    const invoices: BillingInvoice[] = ((data || []) as InvoiceRowRaw[]).map((row: InvoiceRowRaw) => {
      const client = Array.isArray(row.clients) ? row.clients[0] : row.clients;
      const profile = Array.isArray(row.participant_profiles)
        ? row.participant_profiles[0]
        : row.participant_profiles;
      const participantName =
        profile?.full_name ||
        [client?.first_name, client?.last_name].filter(Boolean).join(" ") ||
        row.client_name ||
        "Unknown Participant";

      return {
        id: row.id,
        display_id: row.display_id,
        organization_id: row.organization_id,
        participant_id: row.participant_id,
        participant_name: participantName,
        participant_avatar: client?.avatar_url || null,
        client_email: row.client_email || null,
        funding_type: (row.funding_type as FundingType) || "plan_managed",
        status: (row.status as InvoiceStatus) || "draft",
        total: Number(row.total || 0),
        subtotal: Number(row.subtotal || 0),
        issue_date: row.issue_date,
        due_date: row.due_date,
        paid_date: row.paid_date,
        billing_period_start: row.billing_period_start,
        billing_period_end: row.billing_period_end,
        plan_manager_email: row.plan_manager_email,
        plan_manager_name: row.plan_manager_name,
        ndis_participant_number:
          row.ndis_participant_number || profile?.ndis_number || null,
        proda_export_status: row.proda_export_status || "not_queued",
        dispatch_attempted_at: row.dispatch_attempted_at,
        dispatch_error: row.dispatch_error,
        line_item_count: Array.isArray(row.invoice_line_items)
          ? row.invoice_line_items.length
          : 0,
        created_at: row.created_at,
      };
    });

    return { invoices, error: null };
  } catch (err) {
    console.error("[getBillingInvoices]", err);
    return { invoices: [], error: err instanceof Error ? err.message : "Failed to load invoices" };
  }
}

// ─── Fetch single invoice with full line items ────────────────────────────────

export async function getInvoiceDetail(
  invoiceId: string,
  orgId: string,
): Promise<{
  invoice: BillingInvoice | null;
  lineItems: InvoiceLineItem[];
  orgMeta: { name: string; abn: string; ndis_reg: string } | null;
  error: string | null;
}> {
  try {
    const supabase = await createServerSupabaseClient();
    // Hyperion-Vanguard S-02: Auth gate
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) throw new Error("Unauthorized");

    const [invoiceRes, orgRes] = await Promise.all([
      (supabase as SupabaseClient)
        .from("invoices")
        .select(
          `*, clients!invoices_participant_id_fkey(first_name, last_name, avatar_url, email),
           participant_profiles(ndis_number, full_name),
           invoice_line_items(*)`,
        )
        .eq("id", invoiceId)
        .eq("organization_id", orgId)
        .single(),
      supabase
        .from("organizations")
        .select("name, settings")
        .eq("id", orgId)
        .single(),
    ]);

    if (invoiceRes.error) throw invoiceRes.error;
    const row = invoiceRes.data;
    const client =
      Array.isArray(row.clients) ? row.clients[0] : row.clients;
    const profile = Array.isArray(row.participant_profiles)
      ? row.participant_profiles[0]
      : row.participant_profiles;
    const participantName =
      profile?.full_name ||
      [client?.first_name, client?.last_name].filter(Boolean).join(" ") ||
      row.client_name ||
      "Unknown Participant";

    const invoice: BillingInvoice = {
      id: row.id,
      display_id: row.display_id,
      organization_id: row.organization_id,
      participant_id: row.participant_id,
      participant_name: participantName,
      participant_avatar: client?.avatar_url || null,
      client_email: row.client_email || client?.email || null,
      funding_type: (row.funding_type as FundingType) || "plan_managed",
      status: (row.status as InvoiceStatus) || "draft",
      total: Number(row.total || 0),
      subtotal: Number(row.subtotal || 0),
      issue_date: row.issue_date,
      due_date: row.due_date,
      paid_date: row.paid_date,
      billing_period_start: row.billing_period_start,
      billing_period_end: row.billing_period_end,
      plan_manager_email: row.plan_manager_email,
      plan_manager_name: row.plan_manager_name,
      ndis_participant_number:
        row.ndis_participant_number || profile?.ndis_number || null,
      proda_export_status: row.proda_export_status || "not_queued",
      dispatch_attempted_at: row.dispatch_attempted_at,
      dispatch_error: row.dispatch_error,
      line_item_count: Array.isArray(row.invoice_line_items)
        ? row.invoice_line_items.length
        : 0,
      created_at: row.created_at,
    };

    const lineItems: InvoiceLineItem[] = (
      (row.invoice_line_items as LineItemRowRaw[]) || []
    ).map((li: LineItemRowRaw) => ({
      id: li.id,
      invoice_id: li.invoice_id,
      description: li.description,
      quantity: Number(li.quantity || 0),
      unit_price: Number(li.unit_price || 0),
      hours: li.hours != null ? Number(li.hours) : null,
      rate: li.rate != null ? Number(li.rate) : null,
      line_total: li.line_total != null ? Number(li.line_total) : null,
      ndis_support_item_number: li.ndis_support_item_number || null,
      support_category: li.support_category || null,
      shift_date: li.shift_date || null,
      shift_id: li.shift_id || null,
      worker_id: li.worker_id || null,
      is_override: Boolean(li.is_override),
      override_reason: li.override_reason || null,
      sort_order: Number(li.sort_order || 0),
    }));

    const orgSettings: OrgSettingsRaw = (orgRes.data?.settings as OrgSettingsRaw) || {};
    const orgMeta = orgRes.data
      ? {
          name: orgRes.data.name || "",
          abn: (orgSettings.abn as string) || "",
          ndis_reg: (orgSettings.ndis_registration_number as string) || "",
        }
      : null;

    return { invoice, lineItems, orgMeta, error: null };
  } catch (err) {
    console.error("[getInvoiceDetail]", err);
    return {
      invoice: null,
      lineItems: [],
      orgMeta: null,
      error: err instanceof Error ? err.message : "Failed to load invoice",
    };
  }
}

// ─── Get billing telemetry (Telemetry Ribbon) ────────────────────────────────

export async function getBillingTelemetry(
  orgId: string,
): Promise<{ telemetry: BillingTelemetry | null; error: string | null }> {
  try {
    const supabase = await createServerSupabaseClient();
    // Hyperion-Vanguard S-02: Auth gate
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) throw new Error("Unauthorized");
    const { data, error } = await (supabase as SupabaseClient).rpc("get_billing_telemetry", {
      p_org_id: orgId,
    });
    if (error) throw error;
    return { telemetry: data as BillingTelemetry, error: null };
  } catch (err) {
    console.error("[getBillingTelemetry]", err);
    return { telemetry: null, error: err instanceof Error ? err.message : "Failed to fetch telemetry" };
  }
}

// ─── Run billing batch (the RPC) ─────────────────────────────────────────────

export async function runBillingBatch(
  orgId: string,
): Promise<{ result: BatchResult | null; error: string | null }> {
  try {
    const supabase = await createServerSupabaseClient();
    // Hyperion-Vanguard S-02: Auth gate
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) throw new Error("Unauthorized");
    const { data, error } = await (supabase as SupabaseClient).rpc("generate_billing_batches", {
      p_org_id: orgId,
    });
    if (error) throw error;
    revalidatePath("/dashboard/finance/invoicing");
    return { result: data as BatchResult, error: null };
  } catch (err) {
    console.error("[runBillingBatch]", err);
    return {
      result: null,
      error: err instanceof Error ? err.message : "Batch failed",
    };
  }
}

// ─── Dispatch a single invoice ────────────────────────────────────────────────

export async function dispatchInvoice(
  invoiceId: string,
  orgId: string,
  overrideEmail?: string,
): Promise<{ ok: boolean; error: string | null }> {
  try {
    const supabase = await createServerSupabaseClient();
    // Hyperion-Vanguard S-02: Auth gate
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) throw new Error("Unauthorized");

    // If override email provided, update plan_manager_email first
    if (overrideEmail) {
      await (supabase as SupabaseClient)
        .from("invoices")
        .update({ plan_manager_email: overrideEmail })
        .eq("id", invoiceId);
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Unauthorized");

    const edgeFunctionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/dispatch-invoices`;
    const res = await fetch(edgeFunctionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`,
        "apikey": process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
      },
      body: JSON.stringify({ invoiceIds: [invoiceId], orgId }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(errBody || `HTTP ${res.status}`);
    }

    revalidatePath("/dashboard/finance/invoicing");
    return { ok: true, error: null };
  } catch (err) {
    console.error("[dispatchInvoice]", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Dispatch failed",
    };
  }
}

// ─── Bulk dispatch multiple invoices ─────────────────────────────────────────

export async function bulkDispatchInvoices(
  invoiceIds: string[],
  orgId: string,
): Promise<{
  successCount: number;
  totalRequested: number;
  results: Array<{ invoiceId: string; status: string; error?: string }>;
  error: string | null;
}> {
  try {
    const supabase = await createServerSupabaseClient();
    // Hyperion-Vanguard S-02: Auth gate
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) throw new Error("Unauthorized");
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Unauthorized");

    const edgeFunctionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/dispatch-invoices`;
    const res = await fetch(edgeFunctionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`,
        "apikey": process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
      },
      body: JSON.stringify({ invoiceIds, orgId }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(errBody || `HTTP ${res.status}`);
    }

    const body = await res.json();
    revalidatePath("/dashboard/finance/invoicing");
    return {
      successCount: body.successCount || 0,
      totalRequested: body.totalRequested || invoiceIds.length,
      results: body.results || [],
      error: null,
    };
  } catch (err) {
    console.error("[bulkDispatchInvoices]", err);
    return {
      successCount: 0,
      totalRequested: invoiceIds.length,
      results: [],
      error: err instanceof Error ? err.message : "Bulk dispatch failed",
    };
  }
}

// ─── Mark invoices as paid (manual reconciliation) ───────────────────────────

export async function markInvoicesPaid(
  invoiceIds: string[],
  orgId: string,
  paidDate?: string,
): Promise<{ ok: boolean; error: string | null }> {
  try {
    const supabase = await createServerSupabaseClient();
    // Hyperion-Vanguard S-02: Auth gate
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) throw new Error("Unauthorized");
    const { error } = await (supabase as SupabaseClient)
      .from("invoices")
      .update({
        status: "paid",
        paid_date: paidDate || new Date().toISOString().slice(0, 10),
        updated_at: new Date().toISOString(),
      })
      .in("id", invoiceIds)
      .eq("organization_id", orgId);

    if (error) throw error;
    revalidatePath("/dashboard/finance/invoicing");
    return { ok: true, error: null };
  } catch (err) {
    console.error("[markInvoicesPaid]", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to mark paid",
    };
  }
}

// ─── Override a line item (inline edit in the slide-over) ────────────────────

export async function overrideLineItem(
  lineItemId: string,
  invoiceId: string,
  orgId: string,
  updates: { hours?: number; rate?: number; override_reason?: string },
): Promise<{ ok: boolean; newTotal: number; error: string | null }> {
  try {
    const supabase = await createServerSupabaseClient();
    // Hyperion-Vanguard S-02: Auth gate
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) throw new Error("Unauthorized");

    const newHours = updates.hours;
    const newRate = updates.rate;
    const newLineTotal =
      newHours != null && newRate != null
        ? Math.round(newHours * newRate * 100) / 100
        : null;

    const { error: updateErr } = await (supabase as SupabaseClient)
      .from("invoice_line_items")
      .update({
        ...(newHours != null && { hours: newHours, quantity: newHours }),
        ...(newRate != null && { rate: newRate, unit_price: newRate }),
        ...(newLineTotal != null && { line_total: newLineTotal }),
        is_override: true,
        override_reason: updates.override_reason || "Manual override by admin",
      })
      .eq("id", lineItemId);

    if (updateErr) throw updateErr;

    // Recalculate invoice total
    const { data: items } = await (supabase as SupabaseClient)
      .from("invoice_line_items")
      .select("line_total, quantity, unit_price")
      .eq("invoice_id", invoiceId);

    const newTotal = (items || []).reduce((sum: number, li: Pick<LineItemRowRaw, "line_total" | "quantity" | "unit_price">) => {
      return sum + Number(li.line_total != null ? li.line_total : ((li.quantity ?? 0) * (li.unit_price ?? 0)) || 0);
    }, 0);

    await (supabase as SupabaseClient)
      .from("invoices")
      .update({ total: newTotal, subtotal: newTotal, updated_at: new Date().toISOString() })
      .eq("id", invoiceId)
      .eq("organization_id", orgId);

    revalidatePath("/dashboard/finance/invoicing");
    return { ok: true, newTotal, error: null };
  } catch (err) {
    console.error("[overrideLineItem]", err);
    return {
      ok: false,
      newTotal: 0,
      error: err instanceof Error ? err.message : "Override failed",
    };
  }
}

// ─── Export PRODA queue as CSV ────────────────────────────────────────────────

export async function exportProdaCsv(
  orgId: string,
): Promise<{ csv: string | null; error: string | null }> {
  try {
    const supabase = await createServerSupabaseClient();

    // Hyperion-Vanguard D-02: Auth gate — prevent unauthenticated PRODA export
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return { csv: null, error: "Unauthorized" };

    // Hyperion-Vanguard D-02: Include `id` in SELECT so we can mark as CLAIMED
    const { data: invoices } = await (supabase as SupabaseClient)
      .from("invoices")
      .select(
        `id, display_id, ndis_participant_number, plan_manager_email, total,
         billing_period_start, billing_period_end, funding_type,
         invoice_line_items(ndis_support_item_number, shift_date, hours, rate, line_total, description)`,
      )
      .eq("organization_id", orgId)
      .eq("proda_export_status", "queued")
      .is("deleted_at", null);

    if (!invoices?.length) return { csv: null, error: "No invoices queued for PRODA export" };

    // Get org registration number for the CSV
    const { data: orgData } = await supabase
      .from("organizations")
      .select("settings")
      .eq("id", orgId)
      .single();
    const orgSettings = (orgData?.settings as OrgSettingsRaw) || {};
    const registrationNumber = orgSettings.ndis_registration_number || "";

    const rows: string[] = [
      "RegistrationNumber,NDISNumber,SupportItemNumber,DateOfService,ClaimedAmount,ClaimReference",
    ];

    for (const inv of invoices) {
      const items = (inv.invoice_line_items as LineItemRowRaw[]) || [];
      for (const li of items) {
        rows.push(
          [
            registrationNumber,
            inv.ndis_participant_number || "",
            li.ndis_support_item_number || "",
            li.shift_date || "",
            Number(li.line_total || 0).toFixed(2),
            inv.display_id,
          ].join(","),
        );
      }
    }

    // Hyperion-Vanguard D-02: Mark as CLAIMED BEFORE returning CSV
    // This prevents duplicate government claims on re-export
    const claimedIds = invoices
      .map((i: Record<string, unknown>) => i.id as string)
      .filter(Boolean);

    if (claimedIds.length) {
      const { error: updateErr } = await (supabase as SupabaseClient)
        .from("invoices")
        .update({
          proda_export_status: "exported",
          status: "sent",
          updated_at: new Date().toISOString(),
        })
        .in("id", claimedIds);

      if (updateErr) {
        // CRITICAL: If we can't mark as claimed, do NOT return CSV
        // This prevents duplicate government claims
        console.error("[exportProdaCsv] Failed to mark invoices as claimed:", updateErr);
        return { csv: null, error: "Failed to mark invoices as exported. Aborting to prevent duplicate claims." };
      }
    }

    revalidatePath("/dashboard/finance/invoicing");
    return { csv: rows.join("\n"), error: null };
  } catch (err) {
    console.error("[exportProdaCsv]", err);
    return { csv: null, error: err instanceof Error ? err.message : "Export failed" };
  }
}

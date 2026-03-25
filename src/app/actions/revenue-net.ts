/**
 * @module RevenueNet Server Actions
 * @status COMPLETE
 * @description Project Revenue-Net — Payment mandate CRUD, SetupIntent creation,
 *   dunning dashboard data, auto-charge configuration, and manual sweep triggers.
 * @exports fetchMandatesAction, createSetupIntentAction, revokeMandateAction,
 *   fetchDunningStatsAction, fetchDunningInvoicesAction, triggerManualSweepAction,
 *   resetDunningAction, updateGracePeriodAction, fetchSecureMandateDataAction
 * @lastAudit 2026-03-24
 */
"use server";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import { withAuth, withAuthAndOrg } from "@/lib/safe-action";
import { revalidatePath } from "next/cache";

// ── Types ─────────────────────────────────────────────────────────

export interface PaymentMandate {
  id: string;
  organization_id: string;
  client_id: string;
  stripe_customer_id: string;
  stripe_payment_method_id: string;
  mandate_type: "CREDIT_CARD" | "BECS_DEBIT";
  status: "ACTIVE" | "REVOKED" | "EXPIRED" | "FAILED_SETUP";
  card_brand: string | null;
  last4: string | null;
  exp_month: number | null;
  exp_year: number | null;
  bsb_last4: string | null;
  account_last4: string | null;
  is_default: boolean;
  created_at: string;
}

export interface DunningInvoice {
  id: string;
  display_id: string;
  client_id: string;
  client_name: string;
  total: number;
  status: string;
  dunning_status: string;
  dunning_attempts: number;
  last_charge_error: string | null;
  auto_charge_date: string | null;
  created_at: string;
}

export interface DunningStats {
  active_mandates: number;
  pending_charges: number;
  dunning_fail_1: number;
  dunning_fail_2: number;
  dunning_fail_3: number;
  collections: number;
  suspended_clients: number;
  auto_collected_30d: number;
}

export interface SetupIntentResult {
  clientSecret: string;
  stripeCustomerId: string;
}

// ── Mandate CRUD ──────────────────────────────────────────────────

export async function fetchMandatesAction(
  orgId: string,
  clientId?: string
): Promise<{ data: PaymentMandate[] | null; error: string | null }> {
  return withAuthAndOrg(orgId, async () => {
    const supabase = await createServerSupabaseClient();
    let query = (supabase as any)
      .from("payment_mandates")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });

    if (clientId) {
      query = query.eq("client_id", clientId);
    }

    const { data, error } = await query;
    if (error) return { data: null, error: error.message };
    return { data: data as PaymentMandate[], error: null };
  });
}

export async function createSetupIntentAction(
  orgId: string,
  clientId: string,
  paymentMethodTypes: string[] = ["card", "au_becs_debit"]
): Promise<{ data: SetupIntentResult | null; error: string | null }> {
  return withAuthAndOrg(orgId, async () => {
    const supabase = await createServerSupabaseClient();
    const stripe = getStripe();

    // Get or create Stripe customer for this client
    const { data: client } = await (supabase as any)
      .from("clients")
      .select("id, stripe_customer_id, display_name, email, phone")
      .eq("id", clientId)
      .eq("organization_id", orgId)
      .single();

    if (!client) return { data: null, error: "Client not found" };

    let stripeCustomerId = (client as Record<string, unknown>).stripe_customer_id as string;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        name: (client as Record<string, unknown>).display_name as string || undefined,
        email: (client as Record<string, unknown>).email as string || undefined,
        phone: (client as Record<string, unknown>).phone as string || undefined,
        metadata: {
          iworkr_client_id: clientId,
          iworkr_org_id: orgId,
        },
      });
      stripeCustomerId = customer.id;

      await (supabase as any)
        .from("clients")
        .update({ stripe_customer_id: customer.id })
        .eq("id", clientId);
    }

    const setupIntent = await stripe.setupIntents.create({
      customer: stripeCustomerId,
      payment_method_types: paymentMethodTypes,
      usage: "off_session",
      metadata: {
        mandate_flow: "revenue_net",
        client_id: clientId,
        organization_id: orgId,
      },
    });

    return {
      data: {
        clientSecret: setupIntent.client_secret!,
        stripeCustomerId,
      },
      error: null,
    };
  });
}

export async function revokeMandateAction(
  orgId: string,
  mandateId: string
): Promise<{ success: boolean; error: string | null }> {
  return withAuthAndOrg(orgId, async () => {
    const supabase = await createServerSupabaseClient();

    const { error } = await (supabase as any)
      .from("payment_mandates")
      .update({ status: "REVOKED", updated_at: new Date().toISOString() })
      .eq("id", mandateId)
      .eq("organization_id", orgId);

    if (error) return { success: false, error: error.message };

    revalidatePath("/dashboard/finance/revenue-net");
    return { success: true, error: null };
  });
}

export async function setDefaultMandateAction(
  orgId: string,
  clientId: string,
  mandateId: string
): Promise<{ success: boolean; error: string | null }> {
  return withAuthAndOrg(orgId, async () => {
    const supabase = await createServerSupabaseClient();

    // Clear existing defaults for this client
    await (supabase as any)
      .from("payment_mandates")
      .update({ is_default: false, updated_at: new Date().toISOString() })
      .eq("client_id", clientId)
      .eq("is_default", true);

    const { error } = await (supabase as any)
      .from("payment_mandates")
      .update({ is_default: true, updated_at: new Date().toISOString() })
      .eq("id", mandateId)
      .eq("organization_id", orgId);

    if (error) return { success: false, error: error.message };

    revalidatePath("/dashboard/finance/revenue-net");
    return { success: true, error: null };
  });
}

// ── Dunning Dashboard ─────────────────────────────────────────────

export async function fetchDunningStatsAction(
  orgId: string
): Promise<{ data: DunningStats | null; error: string | null }> {
  return withAuthAndOrg(orgId, async () => {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await (supabase as any).rpc("get_dunning_stats", {
      p_org_id: orgId,
    });

    if (error) return { data: null, error: error.message };
    return { data: data as DunningStats, error: null };
  });
}

export async function fetchDunningInvoicesAction(
  orgId: string,
  filter?: "all" | "FAIL_1" | "FAIL_2" | "FAIL_3" | "SENT_TO_COLLECTIONS"
): Promise<{ data: DunningInvoice[] | null; error: string | null }> {
  return withAuthAndOrg(orgId, async () => {
    const supabase = await createServerSupabaseClient();

    let query = (supabase as any)
      .from("invoices")
      .select(`
        id, display_id, client_id, total, status,
        dunning_status, dunning_attempts, last_charge_error,
        auto_charge_date, created_at,
        clients!inner(display_name)
      `)
      .eq("organization_id", orgId)
      .neq("dunning_status", "NONE")
      .order("dunning_attempts", { ascending: false })
      .limit(100);

    if (filter && filter !== "all") {
      query = query.eq("dunning_status", filter);
    }

    const { data, error } = await query;
    if (error) return { data: null, error: error.message };

    const mapped = (data || []).map((row: any) => ({
      ...row,
      client_name: row.clients?.display_name || "Unknown",
      clients: undefined,
    }));

    return { data: mapped as DunningInvoice[], error: null };
  });
}

// ── Manual Sweep Trigger ──────────────────────────────────────────

export async function triggerManualSweepAction(
  orgId: string,
  invoiceId?: string
): Promise<{ data: any; error: string | null }> {
  return withAuthAndOrg(orgId, async () => {
    const supabase = await createServerSupabaseClient();

    const fnUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/cron-auto-charge`;
    const resp = await fetch(fnUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        "x-cron-secret": process.env.CRON_SECRET || "",
      },
      body: JSON.stringify({
        org_id: orgId,
        ...(invoiceId ? { invoice_id: invoiceId } : {}),
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      return { data: null, error: `Sweep failed: ${text}` };
    }

    const result = await resp.json();
    revalidatePath("/dashboard/finance/revenue-net");
    return { data: result, error: null };
  });
}

// ── Dunning Reset (admin override) ───────────────────────────────

export async function resetDunningAction(
  orgId: string,
  invoiceId: string
): Promise<{ success: boolean; error: string | null }> {
  return withAuthAndOrg(orgId, async () => {
    const supabase = await createServerSupabaseClient();

    const { data: inv } = await (supabase as any)
      .from("invoices")
      .select("client_id")
      .eq("id", invoiceId)
      .eq("organization_id", orgId)
      .single();

    if (!inv) return { success: false, error: "Invoice not found" };

    await (supabase as any)
      .from("invoices")
      .update({
        dunning_status: "NONE",
        dunning_attempts: 0,
        last_charge_error: null,
        status: "sent",
        updated_at: new Date().toISOString(),
      })
      .eq("id", invoiceId);

    // Lift suspension if this was the only overdue invoice
    const { count } = await (supabase as any)
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("client_id", (inv as any).client_id)
      .eq("status", "overdue")
      .neq("id", invoiceId);

    if ((count ?? 0) === 0) {
      await (supabase as any)
        .from("clients")
        .update({ is_financially_suspended: false })
        .eq("id", (inv as any).client_id);
    }

    revalidatePath("/dashboard/finance/revenue-net");
    return { success: true, error: null };
  });
}

// ── Grace Period Configuration ────────────────────────────────────

export async function updateGracePeriodAction(
  orgId: string,
  days: number
): Promise<{ success: boolean; error: string | null }> {
  return withAuthAndOrg(orgId, async () => {
    const supabase = await createServerSupabaseClient();

    const { data: org } = await (supabase as any)
      .from("organizations")
      .select("settings")
      .eq("id", orgId)
      .single();

    const settings = ((org as any)?.settings as Record<string, unknown>) ?? {};

    await (supabase as any)
      .from("organizations")
      .update({
        settings: { ...settings, auto_charge_grace_days: days },
      })
      .eq("id", orgId);

    revalidatePath("/dashboard/settings/billing");
    return { success: true, error: null };
  });
}

// ── Secure Mandate Portal (unauthenticated) ──────────────────────

export async function fetchSecureMandateDataAction(
  clientId: string
): Promise<{
  data: {
    client_name: string;
    org_name: string;
    org_id: string;
    has_mandate: boolean;
    mandate_display: string | null;
    overdue_total: number;
    overdue_count: number;
  } | null;
  error: string | null;
}> {
  try {
    const supabase = await createServerSupabaseClient();

    const { data: client } = await (supabase as any)
      .from("clients")
      .select("id, display_name, organization_id, stripe_customer_id")
      .eq("id", clientId)
      .single();

    if (!client) return { data: null, error: "Client not found" };

    const c = client as Record<string, unknown>;

    const { data: org } = await (supabase as any)
      .from("organizations")
      .select("name")
      .eq("id", c.organization_id)
      .single();

    const { data: mandate } = await (supabase as any)
      .from("payment_mandates")
      .select("card_brand, last4, mandate_type")
      .eq("client_id", clientId)
      .eq("status", "ACTIVE")
      .eq("is_default", true)
      .maybeSingle();

    const { data: overdueInvoices } = await (supabase as any)
      .from("invoices")
      .select("total")
      .eq("client_id", clientId)
      .eq("status", "overdue");

    const overdueTotal = (overdueInvoices || []).reduce(
      (sum: number, inv: any) => sum + (inv.total || 0),
      0
    );

    let mandateDisplay: string | null = null;
    if (mandate) {
      const m = mandate as Record<string, unknown>;
      if (m.mandate_type === "BECS_DEBIT") {
        mandateDisplay = `Bank account ending in ${m.last4}`;
      } else {
        mandateDisplay = `${m.card_brand || "Card"} ending in ${m.last4}`;
      }
    }

    return {
      data: {
        client_name: c.display_name as string || "Client",
        org_name: (org as Record<string, unknown>)?.name as string || "Business",
        org_id: c.organization_id as string,
        has_mandate: !!mandate,
        mandate_display: mandateDisplay,
        overdue_total: overdueTotal,
        overdue_count: (overdueInvoices || []).length,
      },
      error: null,
    };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

// ── Lift Suspension (manual admin) ────────────────────────────────

export async function liftSuspensionAction(
  orgId: string,
  clientId: string
): Promise<{ success: boolean; error: string | null }> {
  return withAuthAndOrg(orgId, async () => {
    const supabase = await createServerSupabaseClient();

    const { error } = await (supabase as any)
      .from("clients")
      .update({ is_financially_suspended: false })
      .eq("id", clientId)
      .eq("organization_id", orgId);

    if (error) return { success: false, error: error.message };

    revalidatePath("/dashboard/finance/revenue-net");
    return { success: true, error: null };
  });
}

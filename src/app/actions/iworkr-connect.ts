"use server";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";

// ── Types ─────────────────────────────────────────────────────────────────

export interface ConnectStatus {
  isActivated: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  stripeAccountId: string | null;
}

export interface ConnectBalance {
  availableCents: number;
  pendingCents: number;
  currency: string;
}

export interface ConnectPayout {
  id: string;
  amount: number;
  arrivalDate: number;
  status: string;
  currency: string;
  createdAt: number;
}

export interface ConnectTransaction {
  id: string;
  type: string;
  amount: number;
  fee: number;
  net: number;
  currency: string;
  status: string;
  description: string | null;
  customerId: string | null;
  customerName: string | null;
  customerEmail: string | null;
  invoiceRef: string | null;
  createdAt: string;
}

export interface NetworkCustomer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  totalInvoiced: number;
  totalPaid: number;
  networkIdentity: {
    trustGrade: string;
    trustScore: number;
    workspaceCount: number;
    totalInvoicesOverdue: number;
    totalChargebacks: number;
    totalCollections: number;
    totalOutstanding: number;
  } | null;
}

export interface ConnectStats {
  volume7Day: number;
  disputeRate: number;
  nextPayoutDate: string | null;
  nextPayoutAmount: number;
}

// ── Actions ───────────────────────────────────────────────────────────────

export async function getConnectStatus(orgId: string): Promise<ConnectStatus> {
  const supabase = await createServerSupabaseClient();
  const { data: org } = await (supabase as any)
    .from("organizations")
    .select("stripe_account_id, settings, charges_enabled, payouts_enabled, stripe_account_active")
    .eq("id", orgId)
    .single();

  if (!org) return { isActivated: false, chargesEnabled: false, payoutsEnabled: false, stripeAccountId: null };

  const settings = (org.settings as Record<string, unknown>) ?? {};
  const accountId = org.stripe_account_id || (settings.stripe_account_id as string) || null;

  return {
    isActivated: !!accountId && (org.charges_enabled || org.payouts_enabled),
    chargesEnabled: !!org.charges_enabled,
    payoutsEnabled: !!org.payouts_enabled,
    stripeAccountId: accountId,
  };
}

export async function getConnectBalance(orgId: string): Promise<ConnectBalance | null> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: org } = await (supabase as any)
    .from("organizations")
    .select("stripe_account_id, settings")
    .eq("id", orgId)
    .single();

  const settings = (org?.settings as Record<string, unknown>) ?? {};
  const accountId = org?.stripe_account_id || (settings.stripe_account_id as string);
  if (!accountId) return null;

  try {
    const stripe = getStripe();
    const balance = await stripe.balance.retrieve({}, { stripeAccount: accountId });
    const available = balance.available.find((b) => b.currency === "aud") ?? balance.available[0];
    const pending = balance.pending.find((b) => b.currency === "aud") ?? balance.pending[0];
    return {
      availableCents: available?.amount ?? 0,
      pendingCents: pending?.amount ?? 0,
      currency: available?.currency ?? "aud",
    };
  } catch {
    return null;
  }
}

export async function getConnectTransactions(
  orgId: string,
  limit = 50
): Promise<ConnectTransaction[]> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: org } = await (supabase as any)
    .from("organizations")
    .select("stripe_account_id, settings")
    .eq("id", orgId)
    .single();

  const settings = (org?.settings as Record<string, unknown>) ?? {};
  const accountId = org?.stripe_account_id || (settings.stripe_account_id as string);
  if (!accountId) return [];

  try {
    const stripe = getStripe();
    const charges = await stripe.charges.list(
      { limit, expand: ["data.invoice"] },
      { stripeAccount: accountId }
    );

    return charges.data.map((charge) => {
      const invoice = (charge as any).invoice as any;
      return {
        id: charge.id,
        type: "payment",
        amount: charge.amount,
        fee: (charge as any).application_fee_amount ?? 0,
        net: charge.amount - ((charge as any).application_fee_amount ?? 0),
        currency: charge.currency,
        status: charge.status,
        description: charge.description,
        customerId: charge.customer as string | null,
        customerName: (charge.billing_details?.name) ?? null,
        customerEmail: (charge.billing_details?.email) ?? null,
        invoiceRef: invoice?.number ?? null,
        createdAt: new Date(charge.created * 1000).toISOString(),
      };
    });
  } catch {
    return [];
  }
}

export async function getConnectPayouts(orgId: string, limit = 10): Promise<ConnectPayout[]> {
  const supabase = await createServerSupabaseClient();

  const { data: org } = await (supabase as any)
    .from("organizations")
    .select("stripe_account_id, settings, payouts_enabled")
    .eq("id", orgId)
    .single();

  const settings = (org?.settings as Record<string, unknown>) ?? {};
  const accountId = org?.stripe_account_id || (settings.stripe_account_id as string);
  if (!accountId || !org?.payouts_enabled) return [];

  try {
    const stripe = getStripe();
    const payouts = await stripe.payouts.list({ limit }, { stripeAccount: accountId });
    return payouts.data.map((p) => ({
      id: p.id,
      amount: p.amount,
      arrivalDate: p.arrival_date,
      status: p.status,
      currency: p.currency,
      createdAt: p.created,
    }));
  } catch {
    return [];
  }
}

export async function getConnectStats(orgId: string): Promise<ConnectStats> {
  const supabase = await createServerSupabaseClient();

  const { data: org } = await (supabase as any)
    .from("organizations")
    .select("stripe_account_id, settings")
    .eq("id", orgId)
    .single();

  const settings = (org?.settings as Record<string, unknown>) ?? {};
  const accountId = org?.stripe_account_id || (settings.stripe_account_id as string);

  if (!accountId) {
    return { volume7Day: 0, disputeRate: 0, nextPayoutDate: null, nextPayoutAmount: 0 };
  }

  try {
    const stripe = getStripe();
    const sevenDaysAgo = Math.floor(Date.now() / 1000) - 7 * 24 * 3600;

    const [charges, disputes, payouts] = await Promise.all([
      stripe.charges.list({ created: { gte: sevenDaysAgo }, limit: 100 }, { stripeAccount: accountId }),
      stripe.disputes.list({ created: { gte: sevenDaysAgo - 30 * 24 * 3600 }, limit: 10 }, { stripeAccount: accountId }),
      stripe.payouts.list({ limit: 3, status: "pending" }, { stripeAccount: accountId }),
    ]);

    const volume7Day = charges.data.filter(c => c.status === "succeeded").reduce((s, c) => s + c.amount, 0);
    const totalCharged = charges.data.length;
    const disputeRate = totalCharged > 0 ? (disputes.data.length / totalCharged) * 100 : 0;

    const nextPayout = payouts.data[0];
    const nextPayoutDate = nextPayout ? new Date(nextPayout.arrival_date * 1000).toLocaleDateString("en-AU", { weekday: "long", month: "short", day: "numeric" }) : null;

    return {
      volume7Day,
      disputeRate: Math.round(disputeRate * 100) / 100,
      nextPayoutDate,
      nextPayoutAmount: nextPayout?.amount ?? 0,
    };
  } catch {
    return { volume7Day: 0, disputeRate: 0, nextPayoutDate: null, nextPayoutAmount: 0 };
  }
}

export async function getNetworkCustomers(orgId: string): Promise<NetworkCustomer[]> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: clients } = await (supabase as any)
    .from("clients")
    .select(`
      id, first_name, last_name, email, phone,
      network_identity_id,
      network_identities (
        trust_grade, trust_score, workspace_count,
        total_invoices_overdue, total_chargebacks_filed,
        total_collections, total_outstanding_aud
      )
    `)
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (!clients) return [];

  // Get invoice summaries
  const clientIds = clients.map((c: any) => c.id);
  const { data: invoiceSums } = await (supabase as any)
    .from("invoices")
    .select("client_id, total, status")
    .eq("organization_id", orgId)
    .in("client_id", clientIds);

  const invoiceMap = new Map<string, { totalInvoiced: number; totalPaid: number }>();
  for (const inv of (invoiceSums ?? [])) {
    const cur = invoiceMap.get(inv.client_id) ?? { totalInvoiced: 0, totalPaid: 0 };
    cur.totalInvoiced += inv.total ?? 0;
    if (inv.status === "paid") cur.totalPaid += inv.total ?? 0;
    invoiceMap.set(inv.client_id, cur);
  }

  return clients.map((c: any) => {
    const ni = c.network_identities as any;
    const invData = invoiceMap.get(c.id) ?? { totalInvoiced: 0, totalPaid: 0 };
    return {
      id: c.id,
      name: [c.first_name, c.last_name].filter(Boolean).join(" ") || "Unknown",
      email: c.email,
      phone: c.phone,
      totalInvoiced: invData.totalInvoiced,
      totalPaid: invData.totalPaid,
      networkIdentity: ni ? {
        trustGrade: ni.trust_grade,
        trustScore: ni.trust_score,
        workspaceCount: ni.workspace_count,
        totalInvoicesOverdue: ni.total_invoices_overdue,
        totalChargebacks: ni.total_chargebacks_filed,
        totalCollections: ni.total_collections,
        totalOutstanding: ni.total_outstanding_aud,
      } : null,
    };
  });
}

export async function triggerOnboarding(orgId: string): Promise<{ url?: string; error?: string }> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;

  if (!token) return { error: "No session token" };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const res = await fetch(`${supabaseUrl}/functions/v1/stripe-connect-onboard`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({ orgId }),
  });

  const data = await res.json();
  if (!res.ok) return { error: data.error ?? "Failed to start onboarding" };
  return { url: data.url };
}

export async function exportStatementCsv(orgId: string): Promise<{ csv: string }> {
  const transactions = await getConnectTransactions(orgId, 500);
  const header = "Date,Transaction ID,Customer,Invoice,Gross (AUD),Fee (AUD),Net (AUD),Status\n";
  const rows = transactions.map((t) => {
    const gross = (t.amount / 100).toFixed(2);
    const fee = (t.fee / 100).toFixed(2);
    const net = (t.net / 100).toFixed(2);
    const date = new Date(t.createdAt).toLocaleDateString("en-AU");
    return `${date},${t.id},${t.customerName ?? ""},${t.invoiceRef ?? ""},${gross},${fee},${net},${t.status}`;
  });
  return { csv: header + rows.join("\n") };
}

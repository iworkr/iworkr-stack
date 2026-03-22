/**
 * @module Wallets Server Actions
 * @status COMPLETE
 * @description Petty cash & wallet management — wallet CRUD, transaction logging, balance tracking, and financial delegation
 * @exports createWalletAction, fetchWalletsAction, logTransactionAction, fetchTransactionsAction, updateWalletAction
 * @lastAudit 2026-03-22
 */
"use server";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const CreateWalletSchema = z.object({
  organization_id: z.string().uuid(),
  participant_id: z.string().uuid().optional().nullable(),
  facility_id: z.string().uuid().optional().nullable(),
  name: z.string().min(1).max(160),
  wallet_type: z.enum(["cash", "debit_card"]),
  card_last_four: z.string().regex(/^\d{4}$/).optional().nullable(),
  requires_financial_delegation: z.boolean().default(false),
  initial_balance: z.number().min(0),
});

const LogWalletTransactionSchema = z.object({
  wallet_id: z.string().uuid(),
  shift_id: z.string().uuid(),
  entry_type: z.enum(["expense", "injection", "discrepancy_writeoff"]),
  amount: z.number(),
  category: z.string().max(100).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  receipt_image_url: z.string().url().optional().nullable(),
  no_receipt_justification: z.string().max(2000).optional().nullable(),
  linked_incident_id: z.string().uuid().optional().nullable(),
});

async function getAuthed() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return { supabase, user };
}

export async function listParticipantWalletsAction(input: {
  organization_id: string;
  participant_id?: string | null;
  include_inactive?: boolean;
}) {
  const { supabase } = await getAuthed();
  let query = (supabase as any)
    .from("participant_wallets")
    .select("*")
    .eq("organization_id", input.organization_id)
    .order("created_at", { ascending: false })
    .limit(200);

  if (input.participant_id) query = query.eq("participant_id", input.participant_id);
  if (!input.include_inactive) query = query.eq("is_active", true);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listWalletLedgerEntriesAction(walletId: string) {
  const { supabase } = await getAuthed();
  const { data, error } = await (supabase as any)
    .from("wallet_ledger_entries")
    .select("*")
    .eq("wallet_id", walletId)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createParticipantWalletAction(input: z.infer<typeof CreateWalletSchema>) {
  const parsed = CreateWalletSchema.parse(input);
  const { supabase } = await getAuthed();

  const { data: wallet, error } = await (supabase as any)
    .from("participant_wallets")
    .insert({
      organization_id: parsed.organization_id,
      participant_id: parsed.participant_id || null,
      facility_id: parsed.facility_id || null,
      name: parsed.name,
      wallet_type: parsed.wallet_type,
      card_last_four: parsed.wallet_type === "debit_card" ? parsed.card_last_four || null : null,
      requires_financial_delegation: parsed.requires_financial_delegation,
      current_balance: 0,
      is_active: true,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  const { error: initError } = await (supabase as any).rpc("initialize_wallet", {
    p_wallet_id: wallet.id,
    p_initial_balance: parsed.initial_balance,
    p_description: "Genesis block: wallet initialization",
  });
  if (initError) throw new Error(initError.message);

  revalidatePath(`/dashboard/participants/${parsed.participant_id}/finance`);
  revalidatePath(`/dashboard/care/participants/${parsed.participant_id}`);
  revalidatePath("/dashboard/finance/petty-cash");
  return wallet;
}

export async function listWalletDiscrepanciesAction(input: {
  organization_id: string;
  status?: "open" | "resolved" | "written_off";
}) {
  const { supabase } = await getAuthed();
  let query = (supabase as any)
    .from("wallet_discrepancies")
    .select("*, participant_wallets(name, participant_id)")
    .eq("organization_id", input.organization_id)
    .order("created_at", { ascending: false })
    .limit(200);
  if (input.status) query = query.eq("status", input.status);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getWalletHealthSummaryAction(organizationId: string) {
  const { supabase } = await getAuthed();
  const staleBefore = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  const [{ data: wallets }, { data: staleSessions }, { data: openDiscrepancies }] = await Promise.all([
    (supabase as any)
      .from("participant_wallets")
      .select("id, name, current_balance, updated_at, participant_id, facility_id, wallet_type, card_last_four, participant_profiles(preferred_name, full_name), care_facilities(name)")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .order("updated_at", { ascending: true }),
    (supabase as any)
      .from("wallet_shift_sessions")
      .select("wallet_id, closed_at")
      .is("closed_at", null)
      .lt("updated_at", staleBefore),
    (supabase as any)
      .from("wallet_discrepancies")
      .select("wallet_id")
      .eq("organization_id", organizationId)
      .eq("status", "open"),
  ]);

  const staleWalletIds = new Set((staleSessions || []).map((s: any) => s.wallet_id as string));
  const discrepancyWalletIds = new Set((openDiscrepancies || []).map((d: any) => d.wallet_id as string));
  const totalFundsHeld = (wallets || []).reduce((sum: number, w: any) => sum + Number(w.current_balance || 0), 0);

  return {
    wallets: (wallets || []).map((w: any) => ({
      ...w,
      is_stale: staleWalletIds.has(w.id),
      has_open_discrepancy: discrepancyWalletIds.has(w.id),
    })),
    totals: {
      active_wallets: (wallets || []).length,
      total_funds_held: totalFundsHeld,
      stale_wallets: staleWalletIds.size,
      discrepant_wallets: discrepancyWalletIds.size,
    },
  };
}

export async function logWalletTransactionAction(input: z.infer<typeof LogWalletTransactionSchema>) {
  const parsed = LogWalletTransactionSchema.parse(input);
  const { supabase } = await getAuthed();
  const { data, error } = await (supabase as any).rpc("log_wallet_transaction", {
    p_wallet_id: parsed.wallet_id,
    p_shift_id: parsed.shift_id,
    p_entry_type: parsed.entry_type,
    p_amount: parsed.amount,
    p_category: parsed.category || null,
    p_description: parsed.description || null,
    p_receipt_image_url: parsed.receipt_image_url || null,
    p_no_receipt_justification: parsed.no_receipt_justification || null,
    p_linked_incident_id: parsed.linked_incident_id || null,
  });
  if (error) throw new Error(error.message);
  return data;
}

// ── Reconcile a wallet (physical count vs DB balance) ─────────

export async function reconcileWalletAction(input: {
  wallet_id: string;
  organization_id: string;
  physical_count: number;
  reason?: string;
}) {
  const { supabase, user } = await getAuthed();

  // Get current balance
  const { data: wallet, error: fetchError } = await (supabase as any)
    .from("participant_wallets")
    .select("current_balance")
    .eq("id", input.wallet_id)
    .eq("organization_id", input.organization_id)
    .single();

  if (fetchError) throw new Error(fetchError.message);

  const currentBalance = Number(wallet.current_balance || 0);
  const variance = input.physical_count - currentBalance;

  if (Math.abs(variance) < 0.01) {
    // No discrepancy — mark as reconciled
    await (supabase as any)
      .from("participant_wallets")
      .update({ last_reconciled_at: new Date().toISOString() })
      .eq("id", input.wallet_id);
    revalidatePath("/dashboard/finance/petty-cash");
    return { status: "balanced", variance: 0 };
  }

  // Insert discrepancy record
  const { error: discError } = await (supabase as any)
    .from("wallet_discrepancies")
    .insert({
      wallet_id: input.wallet_id,
      organization_id: input.organization_id,
      expected_balance: currentBalance,
      physical_count: input.physical_count,
      variance,
      reason: input.reason || null,
      status: "open",
      reported_by: user.id,
    });

  if (discError) throw new Error(discError.message);

  // Update wallet balance to physical count
  await (supabase as any)
    .from("participant_wallets")
    .update({
      current_balance: input.physical_count,
      last_reconciled_at: new Date().toISOString(),
    })
    .eq("id", input.wallet_id);

  revalidatePath("/dashboard/finance/petty-cash");
  return { status: "discrepancy", variance };
}

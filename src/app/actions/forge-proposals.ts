/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

// ============================================================================
// Project Forge-Proposals — Kit Admin + Public Proposal Actions
// ============================================================================

/* ── Types ───────────────────────────────────────────────── */

export type TradeKit = {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  trade_category: string | null;
  fixed_sell_price: number | null;
  target_margin_pct: number | null;
  calculated_cost: number;
  calculated_sell: number;
  margin_warning: boolean;
  current_margin_pct: number;
  image_url: string | null;
  customer_description: string | null;
  estimated_duration_mins: number | null;
  tier_label: string | null;
  usage_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type KitComponent = {
  id: string;
  kit_id: string;
  item_type: string;
  item_id: string | null;
  label: string | null;
  quantity: number;
  unit_cost: number;
  sell_price: number;
  sort_order: number;
  is_client_selectable: boolean;
  component_type: string | null;
  created_at: string;
};

export type KitMarginMath = {
  kit_id: string;
  kit_name: string;
  total_cost: number;
  total_sell: number;
  target_margin_pct: number | null;
  required_sell_for_target: number;
  actual_margin_pct: number;
  margin_warning: boolean;
};

/* ── Kit Admin Actions ──────────────────────────────────── */

export async function getKits(
  orgId: string
): Promise<{ data: TradeKit[] | null; error: string | null }> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await (supabase as any)
      .from("trade_kits")
      .select("*")
      .eq("organization_id", orgId)
      .is("archived_at", null)
      .order("created_at", { ascending: false });
    if (error) return { data: null, error: error.message };
    return { data: data as TradeKit[], error: null };
  } catch (err: any) {
    return { data: null, error: err.message ?? "Failed to fetch kits" };
  }
}

export async function createKit(input: {
  orgId: string;
  name: string;
  description?: string;
  trade_category?: string;
  target_margin_pct?: number;
}): Promise<{ data: TradeKit | null; error: string | null }> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await (supabase as any)
      .from("trade_kits")
      .insert({
        organization_id: input.orgId,
        name: input.name,
        description: input.description ?? null,
        trade_category: input.trade_category ?? null,
        target_margin_pct: input.target_margin_pct ?? 40,
      })
      .select()
      .single();
    if (error) return { data: null, error: error.message };
    return { data: data as TradeKit, error: null };
  } catch (err: any) {
    return { data: null, error: err.message ?? "Failed to create kit" };
  }
}

export async function deleteKit(
  kitId: string,
  orgId: string
): Promise<{ error: string | null }> {
  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await (supabase as any)
      .from("trade_kits")
      .delete()
      .eq("id", kitId)
      .eq("organization_id", orgId);
    if (error) return { error: error.message };
    return { error: null };
  } catch (err: any) {
    return { error: err.message ?? "Failed to delete kit" };
  }
}

export async function getKitComponents(
  kitId: string,
  orgId: string
): Promise<{ data: KitComponent[] | null; error: string | null }> {
  try {
    void orgId; // used for RLS scoping
    const supabase = await createServerSupabaseClient();
    const { data, error } = await (supabase as any)
      .from("kit_components")
      .select("*")
      .eq("kit_id", kitId)
      .order("sort_order", { ascending: true });
    if (error) return { data: null, error: error.message };
    return { data: data as KitComponent[], error: null };
  } catch (err: any) {
    return { data: null, error: err.message ?? "Failed to fetch components" };
  }
}

export async function addKitComponent(input: {
  kit_id: string;
  orgId: string;
  label: string;
  item_type: string;
  quantity: number;
  unit_cost: number;
  sell_price: number;
}): Promise<{ data: KitComponent | null; error: string | null }> {
  try {
    void input.orgId;
    const supabase = await createServerSupabaseClient();
    // Get next sort order
    const { data: existing } = await (supabase as any)
      .from("kit_components")
      .select("sort_order")
      .eq("kit_id", input.kit_id)
      .order("sort_order", { ascending: false })
      .limit(1);
    const nextSort = existing?.[0]?.sort_order != null ? existing[0].sort_order + 1 : 0;

    const { data, error } = await (supabase as any)
      .from("kit_components")
      .insert({
        kit_id: input.kit_id,
        label: input.label,
        item_type: input.item_type,
        quantity: input.quantity,
        unit_cost: input.unit_cost,
        sell_price: input.sell_price,
        sort_order: nextSort,
      })
      .select()
      .single();
    if (error) return { data: null, error: error.message };
    return { data: data as KitComponent, error: null };
  } catch (err: any) {
    return { data: null, error: err.message ?? "Failed to add component" };
  }
}

export async function deleteKitComponent(
  componentId: string,
  orgId: string
): Promise<{ error: string | null }> {
  try {
    void orgId;
    const supabase = await createServerSupabaseClient();
    const { error } = await (supabase as any)
      .from("kit_components")
      .delete()
      .eq("id", componentId);
    if (error) return { error: error.message };
    return { error: null };
  } catch (err: any) {
    return { error: err.message ?? "Failed to delete component" };
  }
}

export async function getKitMarginMath(
  kitId: string,
  orgId: string
): Promise<{ data: KitMarginMath | null; error: string | null }> {
  try {
    void orgId;
    const supabase = await createServerSupabaseClient();
    const { data, error } = await (supabase as any).rpc("get_kit_margin_math", {
      p_kit_id: kitId,
    });
    if (error) return { data: null, error: error.message };
    if (data?.error) return { data: null, error: data.error };
    return { data: data as KitMarginMath, error: null };
  } catch (err: any) {
    return { data: null, error: err.message ?? "Failed to get margin math" };
  }
}

// ============================================================================
// Public Proposal Actions (no auth — secured via unique token)
// ============================================================================

export type QuoteTierLine = {
  id: string;
  description: string;
  item_type: string;
  quantity: number;
  unit_sell: number;
  line_total: number;
  is_optional_addon: boolean;
  is_included: boolean;
  kit_name: string | null;
  sort_order: number;
};

export type QuoteTier = {
  id: string;
  tier_name: string;
  tier_description: string | null;
  sort_order: number;
  is_recommended: boolean;
  subtotal: number;
  tax: number;
  total: number;
  status: string;
  lines: QuoteTierLine[];
};

export type ProposalData = {
  quote_id: string;
  display_id: string;
  title: string | null;
  client_name: string | null;
  client_email: string | null;
  client_address: string | null;
  status: string;
  is_multi_option: boolean;
  issue_date: string | null;
  valid_until: string | null;
  terms: string | null;
  notes: string | null;
  organization_name: string | null;
  tiers: QuoteTier[];
  // Error fields (set by RPC when not_found/expired/already_accepted)
  error?: string;
  accepted_at?: string;
};

/* ── Get Proposal By Token (public) ──────────────────────── */

export async function getProposalByToken(
  token: string
): Promise<{ data: ProposalData | null; error: string | null }> {
  try {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await (supabase as any).rpc(
      "get_proposal_by_token",
      { p_token: token }
    );

    if (error) return { data: null, error: error.message };
    if (!data) return { data: null, error: "Proposal not found" };

    // The RPC returns a JSON object; if it has an error field, pass it through
    return { data: data as ProposalData, error: null };
  } catch (err: any) {
    return { data: null, error: err.message ?? "Something went wrong" };
  }
}

/* ── Accept Quote Tier (public — atomic conversion) ──────── */

export async function acceptQuoteTier(input: {
  quote_id: string;
  tier_id: string;
  signer_name: string;
  signer_email?: string;
  signature_data: string;
}): Promise<{ data: any; error: string | null }> {
  try {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await (supabase as any).rpc("accept_quote_tier", {
      p_quote_id: input.quote_id,
      p_tier_id: input.tier_id,
      p_signer_name: input.signer_name,
      p_signer_email: input.signer_email ?? null,
      p_signature_data: input.signature_data,
      p_ip_address: null,
    });

    if (error) return { data: null, error: error.message };

    // RPC may return { error: "..." } inside the data
    if (data?.error) return { data: null, error: data.error };

    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message ?? "Something went wrong" };
  }
}

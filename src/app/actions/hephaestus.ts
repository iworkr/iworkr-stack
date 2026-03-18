/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logger } from "@/lib/logger";

// ============================================================================
// Project Hephaestus — Server Actions
// ============================================================================
// CPQ Engine: Inventory, Trade Kits, Supplier Invoice Triage, Proposals,
// Zero-Day Seed, Bulk Price Adjustments, Margin Cascade.
// ============================================================================

/* ── Helpers ──────────────────────────────────────── */

async function assertOrgMember(orgId: string) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (!membership) throw new Error("Not a member of this organization");
  return { supabase, user, role: membership.role };
}

/* ══════════════════════════════════════════════════════
   INVENTORY ITEMS
   ══════════════════════════════════════════════════════ */

const InventoryItemSchema = z.object({
  organization_id: z.string().uuid(),
  name: z.string().min(1).max(200),
  sku: z.string().max(50).optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  trade_category: z.string().max(50).optional().nullable(),
  unit_cost: z.number().min(0).optional(),
  moving_average_cost: z.number().min(0).optional(),
  sell_price: z.number().min(0).optional(),
  quantity: z.number().int().min(0).optional(),
  min_quantity: z.number().int().min(0).optional(),
  unit: z.string().max(20).optional(),
  brand: z.string().max(100).optional().nullable(),
  barcode: z.string().max(100).optional().nullable(),
  supplier: z.string().max(200).optional().nullable(),
  supplier_code: z.string().max(100).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});

export async function getInventoryItems(
  orgId: string,
  options?: {
    search?: string;
    category?: string;
    stockLevel?: string;
    limit?: number;
    offset?: number;
  }
) {
  try {
    const { supabase } = await assertOrgMember(orgId);

    let query = (supabase as any)
      .from("inventory_items")
      .select("*", { count: "exact" })
      .eq("organization_id", orgId)
      .order("name");

    if (options?.search) {
      query = query.or(`name.ilike.%${options.search}%,sku.ilike.%${options.search}%`);
    }
    if (options?.category) {
      query = query.or(`category.eq.${options.category},trade_category.eq.${options.category}`);
    }
    if (options?.stockLevel) {
      query = query.eq("stock_level", options.stockLevel);
    }

    const limit = options?.limit || 50;
    const offset = options?.offset || 0;
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) return { data: null, error: error.message, count: 0 };
    return { data, error: null, count: count || 0 };
  } catch (err: any) {
    return { data: null, error: err.message, count: 0 };
  }
}

export async function createInventoryItem(input: z.infer<typeof InventoryItemSchema>) {
  try {
    const parsed = InventoryItemSchema.safeParse(input);
    if (!parsed.success) return { data: null, error: parsed.error.message };

    const { supabase } = await assertOrgMember(input.organization_id);

    const { data, error } = await (supabase as any)
      .from("inventory_items")
      .insert({
        ...parsed.data,
        moving_average_cost: parsed.data.moving_average_cost || parsed.data.unit_cost || 0,
        latest_cost: parsed.data.unit_cost || 0,
      })
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    revalidatePath("/dashboard/ops/inventory");
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function updateInventoryItem(orgId: string, itemId: string, updates: Record<string, any>) {
  try {
    const { supabase } = await assertOrgMember(orgId);

    const { data, error } = await (supabase as any)
      .from("inventory_items")
      .update(updates)
      .eq("id", itemId)
      .eq("organization_id", orgId)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    revalidatePath("/dashboard/ops/inventory");
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function getInventoryOverview(orgId: string) {
  try {
    const { supabase } = await assertOrgMember(orgId);

    const { data, error } = await (supabase as any).rpc("get_assets_overview", {
      p_org_id: orgId,
    });

    // Also get Hephaestus-specific stats
    const { data: kitsBelow } = await (supabase as any)
      .from("trade_kits")
      .select("id", { count: "exact" })
      .eq("organization_id", orgId)
      .eq("margin_warning", true)
      .is("archived_at", null);

    const { data: pendingInvoices } = await (supabase as any)
      .from("supplier_invoices")
      .select("id", { count: "exact" })
      .eq("organization_id", orgId)
      .in("processing_status", ["PENDING_AI", "NEEDS_REVIEW"]);

    if (error) return { data: null, error: error.message };

    return {
      data: {
        ...data,
        kits_below_margin: kitsBelow?.length || 0,
        pending_supplier_invoices: pendingInvoices?.length || 0,
      },
      error: null,
    };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/* ── Bulk Price Adjustment ────────────────────────── */

export async function bulkPriceAdjustment(
  orgId: string,
  category: string,
  adjustmentPct: number
) {
  try {
    const { supabase, user } = await assertOrgMember(orgId);

    const { data, error } = await (supabase as any).rpc("bulk_price_adjustment", {
      p_org_id: orgId,
      p_category: category,
      p_adjustment_pct: adjustmentPct,
      p_actor_id: user.id,
    });

    if (error) return { data: null, error: error.message };
    revalidatePath("/dashboard/ops/inventory");
    revalidatePath("/dashboard/ops/kits");
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/* ══════════════════════════════════════════════════════
   TRADE KITS
   ══════════════════════════════════════════════════════ */

const KitSchema = z.object({
  organization_id: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  customer_description: z.string().max(2000).optional().nullable(),
  trade_category: z.string().max(50).optional().nullable(),
  target_margin_pct: z.number().min(0).max(99).optional(),
  fixed_sell_price: z.number().min(0).optional().nullable(),
  estimated_duration_mins: z.number().int().min(0).optional().nullable(),
  image_url: z.string().url().optional().nullable(),
  tier_label: z.string().max(50).optional(),
});

export async function getTradeKits(
  orgId: string,
  options?: {
    search?: string;
    category?: string;
    marginWarning?: boolean;
    limit?: number;
    offset?: number;
  }
) {
  try {
    const { supabase } = await assertOrgMember(orgId);

    let query = (supabase as any)
      .from("trade_kits")
      .select("*, kit_components(*)", { count: "exact" })
      .eq("organization_id", orgId)
      .is("archived_at", null)
      .order("name");

    if (options?.search) {
      query = query.ilike("name", `%${options.search}%`);
    }
    if (options?.category) {
      query = query.eq("trade_category", options.category);
    }
    if (options?.marginWarning) {
      query = query.eq("margin_warning", true);
    }

    const limit = options?.limit || 50;
    const offset = options?.offset || 0;
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) return { data: null, error: error.message, count: 0 };
    return { data, error: null, count: count || 0 };
  } catch (err: any) {
    return { data: null, error: err.message, count: 0 };
  }
}

export async function getTradeKit(orgId: string, kitId: string) {
  try {
    const { supabase } = await assertOrgMember(orgId);

    const { data, error } = await (supabase as any)
      .from("trade_kits")
      .select(`
        *,
        kit_components (
          *,
          inventory_items:item_id (id, name, sku, moving_average_cost, sell_price, quantity, stock_level)
        )
      `)
      .eq("id", kitId)
      .eq("organization_id", orgId)
      .single();

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function createTradeKit(input: z.infer<typeof KitSchema>) {
  try {
    const parsed = KitSchema.safeParse(input);
    if (!parsed.success) return { data: null, error: parsed.error.message };

    const { supabase } = await assertOrgMember(input.organization_id);

    const { data, error } = await (supabase as any)
      .from("trade_kits")
      .insert(parsed.data)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    revalidatePath("/dashboard/ops/kits");
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function updateTradeKit(orgId: string, kitId: string, updates: Record<string, any>) {
  try {
    const { supabase } = await assertOrgMember(orgId);

    const { data, error } = await (supabase as any)
      .from("trade_kits")
      .update(updates)
      .eq("id", kitId)
      .eq("organization_id", orgId)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    revalidatePath("/dashboard/ops/kits");
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function addKitComponent(
  orgId: string,
  kitId: string,
  component: {
    item_type: "INVENTORY_ITEM" | "LABOR_RATE";
    item_id?: string;
    label?: string;
    quantity: number;
    unit_cost: number;
    sell_price?: number;
  }
) {
  try {
    const { supabase } = await assertOrgMember(orgId);

    const { data, error } = await (supabase as any)
      .from("kit_components")
      .insert({ kit_id: kitId, ...component })
      .select()
      .single();

    if (error) return { data: null, error: error.message };

    // Recalculate margins
    await (supabase as any).rpc("recalculate_all_kit_margins", { p_org_id: orgId });

    revalidatePath("/dashboard/ops/kits");
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function removeKitComponent(orgId: string, componentId: string) {
  try {
    const { supabase } = await assertOrgMember(orgId);

    // Get kit_id before deleting
    const { data: comp } = await (supabase as any)
      .from("kit_components")
      .select("kit_id")
      .eq("id", componentId)
      .single();

    const { error } = await (supabase as any)
      .from("kit_components")
      .delete()
      .eq("id", componentId);

    if (error) return { error: error.message };

    // Recalculate margins
    await (supabase as any).rpc("recalculate_all_kit_margins", { p_org_id: orgId });

    revalidatePath("/dashboard/ops/kits");
    return { error: null };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function recalculateKitPricesToTarget(orgId: string) {
  try {
    const { supabase } = await assertOrgMember(orgId);

    // Get all kits with margin warnings
    const { data: warningKits } = await (supabase as any)
      .from("trade_kits")
      .select("id, calculated_cost, target_margin_pct")
      .eq("organization_id", orgId)
      .eq("margin_warning", true)
      .is("archived_at", null);

    let updated = 0;
    for (const kit of warningKits || []) {
      const newSell = Math.round(
        (kit.calculated_cost / (1 - kit.target_margin_pct / 100)) * 100
      ) / 100;

      await (supabase as any)
        .from("trade_kits")
        .update({
          fixed_sell_price: newSell,
          margin_warning: false,
          current_margin_pct: kit.target_margin_pct,
        })
        .eq("id", kit.id);

      updated++;
    }

    revalidatePath("/dashboard/ops/kits");
    return { data: { kits_updated: updated }, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/* ══════════════════════════════════════════════════════
   SUPPLIER INVOICES (Triage)
   ══════════════════════════════════════════════════════ */

export async function getSupplierInvoices(
  orgId: string,
  options?: {
    status?: string;
    limit?: number;
    offset?: number;
  }
) {
  try {
    const { supabase } = await assertOrgMember(orgId);

    let query = (supabase as any)
      .from("supplier_invoices")
      .select("*", { count: "exact" })
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });

    if (options?.status) {
      query = query.eq("processing_status", options.status);
    }

    const limit = options?.limit || 50;
    const offset = options?.offset || 0;
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) return { data: null, error: error.message, count: 0 };
    return { data, error: null, count: count || 0 };
  } catch (err: any) {
    return { data: null, error: err.message, count: 0 };
  }
}

export async function getSupplierInvoiceDetail(orgId: string, invoiceId: string) {
  try {
    const { supabase } = await assertOrgMember(orgId);

    const { data: invoice, error } = await (supabase as any)
      .from("supplier_invoices")
      .select("*")
      .eq("id", invoiceId)
      .eq("organization_id", orgId)
      .single();

    if (error) return { data: null, error: error.message };

    const { data: lines } = await (supabase as any)
      .from("supplier_invoice_lines")
      .select(`
        *,
        inventory_items:matched_inventory_id (id, name, sku, moving_average_cost, sell_price, quantity)
      `)
      .eq("invoice_id", invoiceId)
      .order("created_at");

    return { data: { ...invoice, lines: lines || [] }, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function mapInvoiceLine(
  orgId: string,
  lineId: string,
  inventoryItemId: string,
  supplierName?: string,
  supplierSku?: string
) {
  try {
    const { supabase } = await assertOrgMember(orgId);

    // Update the line
    const { data, error } = await (supabase as any)
      .from("supplier_invoice_lines")
      .update({
        matched_inventory_id: inventoryItemId,
        match_status: "CONFIRMED",
        match_method: "manual",
        match_confidence: 100,
      })
      .eq("id", lineId)
      .select()
      .single();

    if (error) return { data: null, error: error.message };

    // Learn the mapping for future invoices
    if (supplierName && supplierSku) {
      await (supabase as any)
        .from("supplier_item_mappings")
        .upsert({
          organization_id: orgId,
          supplier_name: supplierName,
          supplier_sku: supplierSku,
          supplier_desc: data.raw_description,
          inventory_item_id: inventoryItemId,
          confidence: 100,
        }, { onConflict: "organization_id,supplier_name,supplier_sku" });
    }

    revalidatePath("/dashboard/finance/supplier-invoices");
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function approveSupplierInvoice(orgId: string, invoiceId: string) {
  try {
    const { supabase, user } = await assertOrgMember(orgId);

    // Get the invoice and its lines
    const { data: invoice } = await (supabase as any)
      .from("supplier_invoices")
      .select("*")
      .eq("id", invoiceId)
      .eq("organization_id", orgId)
      .single();

    if (!invoice) return { error: "Invoice not found" };

    const { data: lines } = await (supabase as any)
      .from("supplier_invoice_lines")
      .select("*")
      .eq("invoice_id", invoiceId)
      .in("match_status", ["AUTO_MATCHED", "FUZZY_MATCHED", "CONFIRMED"]);

    // Update MAC for each matched line
    for (const line of lines || []) {
      if (line.matched_inventory_id && line.raw_quantity > 0) {
        await (supabase as any).rpc("update_inventory_mac", {
          p_item_id: line.matched_inventory_id,
          p_new_qty: line.raw_quantity,
          p_new_cost: line.raw_unit_cost,
        });

        // Mark line as synced
        await (supabase as any)
          .from("supplier_invoice_lines")
          .update({ synced_at: new Date().toISOString() })
          .eq("id", line.id);
      }
    }

    // Update invoice status
    await (supabase as any)
      .from("supplier_invoices")
      .update({
        processing_status: "SYNCED",
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", invoiceId);

    // Audit log
    await (supabase as any).from("audit_log").insert({
      organization_id: orgId,
      user_id: user.id,
      action: "supplier_invoice.approved",
      entity_type: "supplier_invoices",
      entity_id: invoiceId,
      new_data: {
        supplier: invoice.supplier_name,
        total: invoice.total_amount,
        lines_synced: lines?.length || 0,
      },
    });

    logger.info(`Supplier invoice ${invoiceId} approved: ${invoice.supplier_name}, ${lines?.length} lines synced`);

    revalidatePath("/dashboard/finance/supplier-invoices");
    revalidatePath("/dashboard/ops/inventory");
    revalidatePath("/dashboard/ops/kits");
    return { error: null };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function rejectSupplierInvoice(
  orgId: string,
  invoiceId: string,
  reason?: string
) {
  try {
    const { supabase, user } = await assertOrgMember(orgId);

    await (supabase as any)
      .from("supplier_invoices")
      .update({
        processing_status: "REJECTED",
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        review_notes: reason,
      })
      .eq("id", invoiceId)
      .eq("organization_id", orgId);

    revalidatePath("/dashboard/finance/supplier-invoices");
    return { error: null };
  } catch (err: any) {
    return { error: err.message };
  }
}

/* ══════════════════════════════════════════════════════
   PROPOSALS (Good/Better/Best)
   ══════════════════════════════════════════════════════ */

const ProposalSchema = z.object({
  organization_id: z.string().uuid(),
  title: z.string().min(1).max(200),
  client_id: z.string().uuid().optional().nullable(),
  site_address: z.string().max(500).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  options: z.array(z.object({
    label: z.string(),
    kits: z.array(z.object({
      kit_id: z.string().uuid().optional(),
      name: z.string(),
      components: z.array(z.any()).optional(),
      total_cost: z.number(),
      total_price: z.number(),
    })),
    total_cost: z.number(),
    total_price: z.number(),
  })),
});

export async function getProposals(
  orgId: string,
  options?: { status?: string; clientId?: string; limit?: number; offset?: number }
) {
  try {
    const { supabase } = await assertOrgMember(orgId);

    let query = (supabase as any)
      .from("proposals")
      .select("*, clients:client_id(name), profiles:created_by(full_name)", { count: "exact" })
      .eq("organization_id", orgId)
      .is("archived_at", null)
      .order("created_at", { ascending: false });

    if (options?.status) query = query.eq("status", options.status);
    if (options?.clientId) query = query.eq("client_id", options.clientId);

    const limit = options?.limit || 50;
    const offset = options?.offset || 0;
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) return { data: null, error: error.message, count: 0 };
    return { data, error: null, count: count || 0 };
  } catch (err: any) {
    return { data: null, error: err.message, count: 0 };
  }
}

export async function createProposal(input: z.infer<typeof ProposalSchema>) {
  try {
    const parsed = ProposalSchema.safeParse(input);
    if (!parsed.success) return { data: null, error: parsed.error.message };

    const { supabase, user } = await assertOrgMember(input.organization_id);

    const { data, error } = await (supabase as any)
      .from("proposals")
      .insert({
        ...parsed.data,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    revalidatePath("/dashboard/ops/proposals");
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function winProposal(
  orgId: string,
  proposalId: string,
  selectedOption: number,
  signatureData?: string,
  signedByName?: string
) {
  try {
    const { supabase } = await assertOrgMember(orgId);

    const { data, error } = await (supabase as any).rpc("win_proposal", {
      p_proposal_id: proposalId,
      p_selected_option: selectedOption,
      p_signature_data: signatureData,
      p_signed_by: signedByName,
    });

    if (error) return { data: null, error: error.message };
    revalidatePath("/dashboard/ops/proposals");
    revalidatePath("/dashboard/jobs");
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/* ══════════════════════════════════════════════════════
   ZERO-DAY SEED ENGINE
   ══════════════════════════════════════════════════════ */

export async function cloneIndustrySeed(orgId: string, trade: string) {
  try {
    const { supabase } = await assertOrgMember(orgId);

    const { data, error } = await (supabase as any).rpc("clone_industry_seed", {
      p_org_id: orgId,
      p_trade: trade,
    });

    if (error) return { data: null, error: error.message };

    logger.info(`Industry seed cloned for org ${orgId}: ${trade}`);

    revalidatePath("/dashboard/ops/inventory");
    revalidatePath("/dashboard/ops/kits");
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function getGlobalSeedCatalog(trade: string) {
  try {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await (supabase as any)
      .from("global_trade_seed")
      .select("*")
      .eq("trade_category", trade.toUpperCase())
      .eq("is_active", true)
      .order("type")
      .order("sort_order");

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/* ══════════════════════════════════════════════════════
   UPLOAD SUPPLIER INVOICE (proxied to Edge Function)
   ══════════════════════════════════════════════════════ */

export async function uploadSupplierInvoice(orgId: string, formData: FormData) {
  try {
    const { supabase } = await assertOrgMember(orgId);

    // Get the current session for auth
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { data: null, error: "No session" };

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    formData.append("organization_id", orgId);

    const response = await fetch(
      `${supabaseUrl}/functions/v1/inbound-supplier-invoice`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
      }
    );

    const result = await response.json();
    if (!response.ok) return { data: null, error: result.error || "Upload failed" };

    revalidatePath("/dashboard/finance/supplier-invoices");
    return { data: result, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

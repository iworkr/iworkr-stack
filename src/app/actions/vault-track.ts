"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ── Types ──────────────────────────────────────────────────────

export interface InventoryLocation {
  id: string;
  organization_id: string;
  name: string;
  type: string;
  assigned_worker_id?: string;
  address?: string;
  is_active: boolean;
  item_count?: number;
  total_units?: number;
}

export interface InventoryLevel {
  item_id: string;
  location_id: string;
  quantity: number;
  last_audited_at: string;
  item_name?: string;
  item_sku?: string;
  location_name?: string;
}

export interface InventoryTransaction {
  id: string;
  item_id: string;
  location_id: string;
  job_id?: string;
  worker_id?: string;
  transaction_type: string;
  quantity_change: number;
  unit_cost_at_time: number;
  notes?: string;
  created_at: string;
  item_name?: string;
  location_name?: string;
  worker_name?: string;
  job_display_id?: string;
}

export interface InventoryDashboard {
  total_items: number;
  total_locations: number;
  total_value: number;
  low_stock_count: number;
  critical_stock_count: number;
  recent_transactions: InventoryTransaction[];
  locations: InventoryLocation[];
}

export interface CartItem {
  item_id: string;
  qty: number;
  notes?: string;
}

export interface ConsumptionResult {
  success: boolean;
  items_processed: number;
  items_failed: number;
  errors?: string[];
  invoice_id?: string;
  line_items_created: number;
  financial_summary: {
    total_cost: number;
    total_sell: number;
    total_margin: number;
    margin_percent: number;
  };
  negative_stock_alerts: Array<{ item_id: string; name: string }>;
}

// ── Helper: cast supabase for new tables/RPCs not yet in generated types ──
async function getSupabase(): Promise<any> {
  return (await createServerSupabaseClient()) as any;
}

// ── Dashboard ──────────────────────────────────────────────────

export async function getInventoryDashboard(
  orgId: string
): Promise<InventoryDashboard | null> {
  const supabase = await getSupabase();
  const { data, error } = await supabase.rpc("get_inventory_dashboard", {
    p_org_id: orgId,
  });
  if (error) {
    console.error("getInventoryDashboard error:", error.message);
    return null;
  }
  return typeof data === "string" ? JSON.parse(data) : data;
}

// ── Locations CRUD ─────────────────────────────────────────────

export async function getLocations(orgId: string): Promise<InventoryLocation[]> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("inventory_locations")
    .select("*")
    .eq("organization_id", orgId)
    .eq("is_active", true)
    .order("name");
  if (error) return [];
  return data || [];
}

export async function createLocation(
  orgId: string,
  name: string,
  type: string,
  assignedWorkerId?: string,
  address?: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from("inventory_locations")
    .insert({
      organization_id: orgId,
      name,
      type,
      assigned_worker_id: assignedWorkerId || null,
      address: address || null,
    })
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/ops/inventory");
  return { success: true, id: data.id };
}

export async function updateLocation(
  locationId: string,
  updates: Partial<InventoryLocation>
): Promise<{ success: boolean; error?: string }> {
  const supabase = await getSupabase();
  const { error } = await supabase
    .from("inventory_locations")
    .update(updates)
    .eq("id", locationId);

  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/ops/inventory");
  return { success: true };
}

// ── Inventory Levels ───────────────────────────────────────────

export async function getInventoryLevels(
  orgId: string,
  locationId?: string
): Promise<InventoryLevel[]> {
  const supabase = await getSupabase();

  let query = supabase
    .from("inventory_levels")
    .select(
      "*, inventory_items(name, sku, min_quantity, unit_cost, stock_level), inventory_locations(name, organization_id)"
    )
    .order("quantity", { ascending: true });

  if (locationId) {
    query = query.eq("location_id", locationId);
  }

  const { data, error } = await query;
  if (error) return [];

  return (data || [])
    .filter((row: any) => {
      const loc = row.inventory_locations;
      return loc && loc.organization_id === orgId;
    })
    .map((row: any) => ({
      item_id: row.item_id,
      location_id: row.location_id,
      quantity: row.quantity,
      last_audited_at: row.last_audited_at,
      item_name: row.inventory_items?.name,
      item_sku: row.inventory_items?.sku,
      location_name: row.inventory_locations?.name,
    }));
}

// ── Transaction Ledger ─────────────────────────────────────────

export async function getTransactionLedger(
  orgId: string,
  filters?: {
    item_id?: string;
    location_id?: string;
    transaction_type?: string;
    limit?: number;
  }
): Promise<InventoryTransaction[]> {
  const supabase = await getSupabase();

  let query = (supabase as any)
    .from("inventory_transactions")
    .select(
      "*, inventory_items(name), inventory_locations(name), profiles(full_name), jobs(display_id)"
    )
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(filters?.limit || 100);

  if (filters?.item_id) query = query.eq("item_id", filters.item_id);
  if (filters?.location_id) query = query.eq("location_id", filters.location_id);
  if (filters?.transaction_type)
    query = query.eq("transaction_type", filters.transaction_type);

  const { data, error } = await query;
  if (error) return [];

  return (data || []).map((row: any) => ({
    id: row.id,
    item_id: row.item_id,
    location_id: row.location_id,
    job_id: row.job_id,
    worker_id: row.worker_id,
    transaction_type: row.transaction_type,
    quantity_change: row.quantity_change,
    unit_cost_at_time: row.unit_cost_at_time,
    notes: row.notes,
    created_at: row.created_at,
    item_name: row.inventory_items?.name,
    location_name: row.inventory_locations?.name,
    worker_name: row.profiles?.full_name,
    job_display_id: row.jobs?.display_id,
  }));
}

// ── Consume / Restock / Transfer RPCs ──────────────────────────

export async function consumeInventory(
  itemId: string,
  locationId: string,
  qty: number,
  jobId?: string,
  workerId?: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  const supabase = await getSupabase();
  const { data, error } = await supabase.rpc("consume_inventory_v2", {
    p_item_id: itemId,
    p_location_id: locationId,
    p_job_id: jobId || null,
    p_worker_id: workerId || null,
    p_qty: qty,
  });
  if (error) return { success: false, error: error.message };
  const parsed = typeof data === "string" ? JSON.parse(data) : data;
  revalidatePath("/dashboard/ops/inventory");
  return { success: parsed.success, data: parsed, error: parsed.error };
}

export async function restockInventory(
  itemId: string,
  locationId: string,
  qty: number,
  workerId?: string,
  unitCost?: number
): Promise<{ success: boolean; data?: any; error?: string }> {
  const supabase = await getSupabase();
  const { data, error } = await supabase.rpc("restock_inventory", {
    p_item_id: itemId,
    p_location_id: locationId,
    p_qty: qty,
    p_worker_id: workerId || null,
    p_unit_cost: unitCost || null,
  });
  if (error) return { success: false, error: error.message };
  const parsed = typeof data === "string" ? JSON.parse(data) : data;
  revalidatePath("/dashboard/ops/inventory");
  return { success: parsed.success, data: parsed, error: parsed.error };
}

export async function transferInventory(
  itemId: string,
  fromLocationId: string,
  toLocationId: string,
  qty: number,
  workerId?: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  const supabase = await getSupabase();
  const { data, error } = await supabase.rpc("transfer_inventory", {
    p_item_id: itemId,
    p_from_location_id: fromLocationId,
    p_to_location_id: toLocationId,
    p_qty: qty,
    p_worker_id: workerId || null,
  });
  if (error) return { success: false, error: error.message };
  const parsed = typeof data === "string" ? JSON.parse(data) : data;
  revalidatePath("/dashboard/ops/inventory");
  return { success: parsed.success, data: parsed, error: parsed.error };
}

// ── Process Material Cart (calls Edge Function) ────────────────

export async function processMaterialCart(
  orgId: string,
  jobId: string,
  workerId: string,
  locationId: string,
  items: CartItem[],
  taxRate?: number
): Promise<ConsumptionResult | null> {
  const supabase = await getSupabase();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error("Missing Supabase env vars");
    return null;
  }

  try {
    const res = await fetch(
      `${supabaseUrl}/functions/v1/process-inventory-consumption`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          organization_id: orgId,
          job_id: jobId,
          worker_id: workerId,
          location_id: locationId,
          items,
          tax_rate: taxRate || 10,
          auto_invoice: true,
        }),
      }
    );

    const result = await res.json();
    revalidatePath("/dashboard/ops/inventory");
    revalidatePath("/dashboard/finance/invoicing");
    return result;
  } catch (err: any) {
    console.error("processMaterialCart error:", err.message);
    return null;
  }
}

// ── CSV Import (Supplier Price File) ───────────────────────────

export async function importSupplierPriceCSV(
  orgId: string,
  csvRows: Array<{
    sku: string;
    name: string;
    cost: number;
    barcode?: string;
    category?: string;
    unit?: string;
  }>
): Promise<{
  success: boolean;
  updated: number;
  created: number;
  errors: string[];
}> {
  const supabase = await getSupabase();
  let updated = 0;
  let created = 0;
  const errors: string[] = [];

  for (const row of csvRows) {
    if (!row.sku || !row.name || row.cost == null) {
      errors.push(`Skipped row: missing sku/name/cost`);
      continue;
    }

    // Try to update existing item by SKU
    const { data: existing } = await supabase
      .from("inventory_items")
      .select("id, unit_cost, moving_average_cost")
      .eq("organization_id", orgId)
      .eq("sku", row.sku)
      .maybeSingle();

    if (existing) {
      // Update with moving average cost calculation
      const oldMac = existing.moving_average_cost || existing.unit_cost || 0;
      const newMac = oldMac > 0 ? (oldMac * 0.7 + row.cost * 0.3) : row.cost;

      await supabase
        .from("inventory_items")
        .update({
          unit_cost: row.cost,
          latest_cost: row.cost,
          moving_average_cost: parseFloat(newMac.toFixed(4)),
          cost_updated_at: new Date().toISOString(),
          ...(row.barcode ? { barcode: row.barcode } : {}),
          ...(row.category ? { category: row.category } : {}),
          ...(row.unit ? { unit: row.unit } : {}),
        })
        .eq("id", existing.id);

      updated++;
    } else {
      // Create new item
      const { error: insertError } = await supabase
        .from("inventory_items")
        .insert({
          organization_id: orgId,
          sku: row.sku,
          name: row.name,
          unit_cost: row.cost,
          latest_cost: row.cost,
          moving_average_cost: row.cost,
          barcode: row.barcode || null,
          category: row.category || null,
          unit: row.unit || "each",
          default_markup_percent: 20,
        });

      if (insertError) {
        errors.push(`Failed to create ${row.sku}: ${insertError.message}`);
      } else {
        created++;
      }
    }
  }

  revalidatePath("/dashboard/ops/inventory");
  return { success: true, updated, created, errors };
}

// ── Barcode Lookup ─────────────────────────────────────────────

export async function barcodeLookup(
  orgId: string,
  code: string
): Promise<any> {
  const supabase = await getSupabase();
  const { data, error } = await supabase.rpc("barcode_lookup", {
    p_org_id: orgId,
    p_code: code,
  });
  if (error) return { found: false, code };
  return typeof data === "string" ? JSON.parse(data) : data;
}

// ── Generate Low-Stock PO ──────────────────────────────────────

export async function generateLowStockPO(
  orgId: string,
  itemId: string,
  locationId: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  const supabase = await getSupabase();
  const { data, error } = await supabase.rpc("generate_low_stock_po", {
    p_org_id: orgId,
    p_item_id: itemId,
    p_location_id: locationId,
  });
  if (error) return { success: false, error: error.message };
  const parsed = typeof data === "string" ? JSON.parse(data) : data;
  revalidatePath("/dashboard/ops/purchase-orders");
  return { success: parsed.success, data: parsed, error: parsed.error };
}

// ── Batch Audit Adjustment ─────────────────────────────────────

export async function auditAdjustment(
  orgId: string,
  itemId: string,
  locationId: string,
  actualQty: number,
  workerId?: string,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await getSupabase();

  // Get current level
  const { data: level } = await supabase
    .from("inventory_levels")
    .select("quantity")
    .eq("item_id", itemId)
    .eq("location_id", locationId)
    .maybeSingle();

  const currentQty = level?.quantity ?? 0;
  const adjustment = actualQty - currentQty;

  if (adjustment === 0) return { success: true };

  // Update level
  await supabase
    .from("inventory_levels")
    .upsert(
      {
        item_id: itemId,
        location_id: locationId,
        quantity: actualQty,
        last_audited_at: new Date().toISOString(),
      },
      { onConflict: "item_id,location_id" }
    );

  // Record in immutable ledger
  const { data: item } = await supabase
    .from("inventory_items")
    .select("name, unit_cost")
    .eq("id", itemId)
    .single();

  await supabase
    .from("inventory_transactions")
    .insert({
      organization_id: orgId,
      item_id: itemId,
      location_id: locationId,
      worker_id: workerId || null,
      transaction_type: "AUDIT_ADJUSTMENT",
      quantity_change: adjustment,
      unit_cost_at_time: item?.unit_cost || 0,
      notes:
        notes ||
        `Audit adjustment: ${currentQty} → ${actualQty} (${adjustment > 0 ? "+" : ""}${adjustment})`,
      metadata: { previous_qty: currentQty, actual_qty: actualQty },
    });

  revalidatePath("/dashboard/ops/inventory");
  return { success: true };
}

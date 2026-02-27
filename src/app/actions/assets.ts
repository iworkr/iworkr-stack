/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";
import { revalidatePath } from "next/cache";
import { Events, dispatch } from "@/lib/automation";
import { logger } from "@/lib/logger";
import { z } from "zod";

/* ── Schemas ──────────────────────────────────────── */

const assetCategorySchema = z.enum(["vehicle", "tool", "equipment", "other"]);
const assetStatusSchema = z.enum(["available", "assigned", "maintenance", "retired"]);

const CreateAssetSchema = z.object({
  organization_id: z.string().uuid(),
  name: z.string().min(1, "Name is required").max(200),
  category: assetCategorySchema,
  status: assetStatusSchema.optional(),
  assigned_to: z.string().uuid().optional().nullable(),
  serial_number: z.string().max(200).optional().nullable(),
  barcode: z.string().max(200).optional().nullable(),
  make: z.string().max(100).optional().nullable(),
  model: z.string().max(100).optional().nullable(),
  year: z.number().min(1900).max(2100).optional().nullable(),
  location: z.string().max(500).optional().nullable(),
  location_lat: z.number().min(-90).max(90).optional().nullable(),
  location_lng: z.number().min(-180).max(180).optional().nullable(),
  purchase_date: z.string().optional().nullable(),
  purchase_cost: z.number().min(0).max(99999999).optional().nullable(),
  warranty_expiry: z.string().optional().nullable(),
  last_service: z.string().optional().nullable(),
  next_service: z.string().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  image_url: z.string().url().max(2000).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
  ingestion_method: z.enum(["manual", "scan"]).optional(),
});

const UpdateAssetSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  category: assetCategorySchema.optional(),
  status: assetStatusSchema.optional(),
  assigned_to: z.string().uuid().optional().nullable(),
  serial_number: z.string().max(200).optional().nullable(),
  barcode: z.string().max(200).optional().nullable(),
  make: z.string().max(100).optional().nullable(),
  model: z.string().max(100).optional().nullable(),
  year: z.number().min(1900).max(2100).optional().nullable(),
  location: z.string().max(500).optional().nullable(),
  location_lat: z.number().min(-90).max(90).optional().nullable(),
  location_lng: z.number().min(-180).max(180).optional().nullable(),
  purchase_date: z.string().optional().nullable(),
  purchase_cost: z.number().min(0).max(99999999).optional().nullable(),
  warranty_expiry: z.string().optional().nullable(),
  last_service: z.string().optional().nullable(),
  next_service: z.string().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  image_url: z.string().url().max(2000).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});

const CreateInventoryItemSchema = z.object({
  organization_id: z.string().uuid(),
  name: z.string().min(1, "Name is required").max(200),
  sku: z.string().max(100).optional().nullable(),
  barcode: z.string().max(200).optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  quantity: z.number().min(0).max(999999).optional(),
  min_quantity: z.number().min(0).max(999999).optional(),
  unit_cost: z.number().min(0).max(99999999).optional().nullable(),
  location: z.string().max(500).optional().nullable(),
  bin_location: z.string().max(200).optional().nullable(),
  supplier: z.string().max(200).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
  ingestion_method: z.enum(["manual", "scan"]).optional(),
});

const UpdateInventoryItemSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  sku: z.string().max(100).optional().nullable(),
  barcode: z.string().max(200).optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  quantity: z.number().min(0).max(999999).optional(),
  min_quantity: z.number().min(0).max(999999).optional(),
  unit_cost: z.number().min(0).max(99999999).optional().nullable(),
  location: z.string().max(500).optional().nullable(),
  bin_location: z.string().max(200).optional().nullable(),
  supplier: z.string().max(200).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});

export interface Asset {
  id: string;
  organization_id: string;
  name: string;
  category: "vehicle" | "tool" | "equipment" | "other";
  status: "available" | "assigned" | "maintenance" | "retired";
  assigned_to: string | null;
  serial_number: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  location: string | null;
  location_lat: number | null;
  location_lng: number | null;
  purchase_date: string | null;
  purchase_cost: number | null;
  last_service: string | null;
  next_service: string | null;
  notes: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  assigned_to_name?: string | null;
}

export interface InventoryItem {
  id: string;
  organization_id: string;
  name: string;
  sku: string | null;
  category: string | null;
  quantity: number;
  min_quantity: number;
  unit_cost: number | null;
  location: string | null;
  stock_level: "ok" | "low" | "critical";
  supplier: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}

export interface AssetAudit {
  id: string;
  organization_id: string;
  asset_id: string | null;
  inventory_id: string | null;
  action: string;
  notes: string | null;
  user_id: string | null;
  user_name: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
}

export interface CreateAssetParams {
  organization_id: string;
  name: string;
  category: "vehicle" | "tool" | "equipment" | "other";
  status?: "available" | "assigned" | "maintenance" | "retired";
  assigned_to?: string | null;
  serial_number?: string | null;
  barcode?: string | null;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  location?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
  purchase_date?: string | null;
  purchase_cost?: number | null;
  warranty_expiry?: string | null;
  last_service?: string | null;
  next_service?: string | null;
  notes?: string | null;
  image_url?: string | null;
  metadata?: Record<string, any> | null;
  ingestion_method?: "manual" | "scan";
}

export interface UpdateAssetParams {
  name?: string;
  category?: "vehicle" | "tool" | "equipment" | "other";
  status?: "available" | "assigned" | "maintenance" | "retired";
  assigned_to?: string | null;
  serial_number?: string | null;
  barcode?: string | null;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  location?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
  purchase_date?: string | null;
  purchase_cost?: number | null;
  warranty_expiry?: string | null;
  last_service?: string | null;
  next_service?: string | null;
  notes?: string | null;
  image_url?: string | null;
  metadata?: Record<string, any> | null;
}

export interface CreateInventoryItemParams {
  organization_id: string;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  category?: string | null;
  quantity?: number;
  min_quantity?: number;
  unit_cost?: number | null;
  location?: string | null;
  bin_location?: string | null;
  supplier?: string | null;
  metadata?: Record<string, any> | null;
  ingestion_method?: "manual" | "scan";
}

export interface UpdateInventoryItemParams {
  name?: string;
  sku?: string | null;
  barcode?: string | null;
  category?: string | null;
  quantity?: number;
  min_quantity?: number;
  unit_cost?: number | null;
  location?: string | null;
  bin_location?: string | null;
  supplier?: string | null;
  metadata?: Record<string, any> | null;
}

/**
 * Get all non-deleted assets with assigned_to profile name
 */
export async function getAssets(orgId: string) {
  try {
    const supabase = await createServerSupabaseClient();

    const { data: assets, error } = await supabase
      .from("assets")
      .select(`
        *,
        profiles:assigned_to (
          full_name
        )
      `)
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .order("name", { ascending: true });

    if (error) {
      return { data: null, error: error.message };
    }

    const formattedAssets = (assets || []).map((asset: any) => ({
      ...asset,
      assigned_to_name: asset.profiles?.full_name || null,
      profiles: undefined,
    }));

    return { data: formattedAssets, error: null };
  } catch (error: any) {
    return { data: null, error: error.message || "Failed to fetch assets" };
  }
}

/**
 * Create an asset and create audit entry
 */
export async function createAsset(params: CreateAssetParams) {
  try {
    // Validate input
    const parsed = CreateAssetSchema.safeParse(params);
    if (!parsed.success) {
      return { data: null, error: parsed.error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join("; ") };
    }

    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { data: null, error: "Not authenticated" };
    }

    const assetData = {
      organization_id: params.organization_id,
      name: params.name,
      category: params.category,
      status: params.status || "available",
      assigned_to: params.assigned_to || null,
      serial_number: params.serial_number || null,
      barcode: params.barcode || null,
      make: params.make || null,
      model: params.model || null,
      year: params.year || null,
      location: params.location || null,
      location_lat: params.location_lat || null,
      location_lng: params.location_lng || null,
      purchase_date: params.purchase_date || null,
      purchase_cost: params.purchase_cost || null,
      warranty_expiry: params.warranty_expiry || null,
      last_service: params.last_service || null,
      next_service: params.next_service || null,
      notes: params.notes || null,
      image_url: params.image_url || null,
      metadata: params.metadata || null,
    };

    const { data: asset, error: assetError } = await supabase
      .from("assets")
      .insert(assetData)
      .select()
      .single();

    if (assetError) {
      return { data: null, error: assetError.message };
    }

    const method = params.ingestion_method || "manual";
    const userName = user?.user_metadata?.full_name || user?.email || "Unknown";
    await supabase
      .from("asset_audits")
      .insert({
        organization_id: params.organization_id,
        asset_id: asset.id,
        inventory_id: null,
        action: "created",
        notes: `Asset "${params.name}" was created via ${method} ingestion`,
        user_id: user.id,
        user_name: userName,
        metadata: { asset_name: params.name, method },
      });

    revalidatePath("/dashboard/assets");
    return { data: asset, error: null };
  } catch (error: any) {
    return { data: null, error: error.message || "Failed to create asset" };
  }
}

/**
 * Update an asset and create audit entry
 */
export async function updateAsset(assetId: string, updates: UpdateAssetParams) {
  try {
    // Validate input
    const parsed = UpdateAssetSchema.safeParse(updates);
    if (!parsed.success) {
      return { data: null, error: parsed.error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join("; ") };
    }

    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { data: null, error: "Not authenticated" };
    }

    // Get current asset for audit
    const { data: currentAsset, error: fetchError } = await supabase
      .from("assets")
      .select("name, status, assigned_to")
      .eq("id", assetId)
      .is("deleted_at", null)
      .single();

    if (fetchError) {
      return { data: null, error: fetchError.message };
    }

    const updateData: any = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.category !== undefined) updateData.category = updates.category;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.assigned_to !== undefined) updateData.assigned_to = updates.assigned_to;
    if (updates.serial_number !== undefined) updateData.serial_number = updates.serial_number;
    if (updates.barcode !== undefined) updateData.barcode = updates.barcode;
    if (updates.make !== undefined) updateData.make = updates.make;
    if (updates.model !== undefined) updateData.model = updates.model;
    if (updates.year !== undefined) updateData.year = updates.year;
    if (updates.location !== undefined) updateData.location = updates.location;
    if (updates.location_lat !== undefined) updateData.location_lat = updates.location_lat;
    if (updates.location_lng !== undefined) updateData.location_lng = updates.location_lng;
    if (updates.purchase_date !== undefined) updateData.purchase_date = updates.purchase_date;
    if (updates.purchase_cost !== undefined) updateData.purchase_cost = updates.purchase_cost;
    if (updates.warranty_expiry !== undefined) updateData.warranty_expiry = updates.warranty_expiry;
    if (updates.last_service !== undefined) updateData.last_service = updates.last_service;
    if (updates.next_service !== undefined) updateData.next_service = updates.next_service;
    if (updates.notes !== undefined) updateData.notes = updates.notes;
    if (updates.image_url !== undefined) updateData.image_url = updates.image_url;
    if (updates.metadata !== undefined) updateData.metadata = updates.metadata;

    updateData.updated_at = new Date().toISOString();

    const { data: asset, error: updateError } = await supabase
      .from("assets")
      .update(updateData)
      .eq("id", assetId)
      .is("deleted_at", null)
      .select()
      .single();

    if (updateError) {
      return { data: null, error: updateError.message };
    }

    // Create audit entry for significant changes
    const userName = user?.user_metadata?.full_name || user?.email || "Unknown";
    const auditNotes: string[] = [];
    
    if (updates.status && updates.status !== currentAsset.status) {
      auditNotes.push(`Status changed from ${currentAsset.status} to ${updates.status}`);
    }
    if (updates.assigned_to !== undefined && updates.assigned_to !== currentAsset.assigned_to) {
      auditNotes.push(`Assignment changed`);
    }
    if (updates.name && updates.name !== currentAsset.name) {
      auditNotes.push(`Name changed from "${currentAsset.name}" to "${updates.name}"`);
    }

    if (auditNotes.length > 0) {
      await supabase
        .from("asset_audits")
        .insert({
          organization_id: asset.organization_id,
          asset_id: asset.id,
          inventory_id: null,
          action: "updated",
          notes: auditNotes.join("; "),
          user_id: user.id,
          user_name: userName,
          metadata: { updates } as unknown as Json,
        });
    }

    revalidatePath("/dashboard/assets");
    return { data: asset, error: null };
  } catch (error: any) {
    return { data: null, error: error.message || "Failed to update asset" };
  }
}

/**
 * Get all inventory items for an organization
 */
export async function getInventoryItems(orgId: string) {
  try {
    const supabase = await createServerSupabaseClient();

    const { data: items, error } = await supabase
      .from("inventory_items")
      .select("*")
      .eq("organization_id", orgId)
      .order("name", { ascending: true });

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: items || [], error: null };
  } catch (error: any) {
    return { data: null, error: error.message || "Failed to fetch inventory items" };
  }
}

/**
 * Update inventory item quantity and auto-calculate stock_level
 */
export async function updateInventoryItem(itemId: string, updates: UpdateInventoryItemParams) {
  try {
    // Validate input
    const parsed = UpdateInventoryItemSchema.safeParse(updates);
    if (!parsed.success) {
      return { data: null, error: parsed.error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join("; ") };
    }

    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { data: null, error: "Not authenticated" };
    }

    // Get current item to calculate stock level
    const { data: currentItem, error: fetchError } = await supabase
      .from("inventory_items")
      .select("quantity, min_quantity")
      .eq("id", itemId)
      .single();

    if (fetchError) {
      return { data: null, error: fetchError.message };
    }

    const updateData: any = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.sku !== undefined) updateData.sku = updates.sku;
    if (updates.barcode !== undefined) updateData.barcode = updates.barcode;
    if (updates.category !== undefined) updateData.category = updates.category;
    if (updates.quantity !== undefined) updateData.quantity = updates.quantity;
    if (updates.min_quantity !== undefined) updateData.min_quantity = updates.min_quantity;
    if (updates.unit_cost !== undefined) updateData.unit_cost = updates.unit_cost;
    if (updates.location !== undefined) updateData.location = updates.location;
    if (updates.bin_location !== undefined) updateData.bin_location = updates.bin_location;
    if (updates.supplier !== undefined) updateData.supplier = updates.supplier;
    if (updates.metadata !== undefined) updateData.metadata = updates.metadata;

    // Auto-calculate stock_level based on quantity vs min_quantity
    const quantity = updates.quantity !== undefined ? updates.quantity : (currentItem.quantity ?? 0);
    const minQuantity = updates.min_quantity !== undefined ? updates.min_quantity : (currentItem.min_quantity ?? 0);

    if (quantity <= 0) {
      updateData.stock_level = "critical";
    } else if (quantity <= minQuantity) {
      updateData.stock_level = "low";
    } else {
      updateData.stock_level = "ok";
    }

    updateData.updated_at = new Date().toISOString();

    const { data: item, error: updateError } = await supabase
      .from("inventory_items")
      .update(updateData)
      .eq("id", itemId)
      .select()
      .single();

    if (updateError) {
      return { data: null, error: updateError.message };
    }

    // Dispatch low/critical stock alerts
    if (item.stock_level === "low") {
      dispatch(Events.inventoryLowStock(item.organization_id, itemId, {
        name: item.name,
        quantity: item.quantity,
        min_quantity: item.min_quantity,
        stock_level: "low",
      }));
    } else if (item.stock_level === "critical") {
      dispatch(Events.inventoryCriticalStock(item.organization_id, itemId, {
        name: item.name,
        quantity: item.quantity,
        min_quantity: item.min_quantity,
        stock_level: "critical",
      }));
    }

    revalidatePath("/dashboard/assets");
    return { data: item, error: null };
  } catch (error: any) {
    return { data: null, error: error.message || "Failed to update inventory item" };
  }
}

/**
 * Create a new inventory item
 */
export async function createInventoryItem(params: CreateInventoryItemParams) {
  try {
    // Validate input
    const parsed = CreateInventoryItemSchema.safeParse(params);
    if (!parsed.success) {
      return { data: null, error: parsed.error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join("; ") };
    }

    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { data: null, error: "Not authenticated" };
    }

    const quantity = params.quantity || 0;
    const minQuantity = params.min_quantity || 0;

    // Auto-calculate stock_level
    let stockLevel: "ok" | "low" | "critical" = "ok";
    if (quantity <= 0) {
      stockLevel = "critical";
    } else if (quantity <= minQuantity) {
      stockLevel = "low";
    }

    const itemData = {
      organization_id: params.organization_id,
      name: params.name,
      sku: params.sku || null,
      barcode: params.barcode || null,
      category: params.category || null,
      quantity,
      min_quantity: minQuantity,
      unit_cost: params.unit_cost || null,
      location: params.location || null,
      bin_location: params.bin_location || null,
      stock_level: stockLevel,
      supplier: params.supplier || null,
      metadata: params.metadata || null,
    };

    const { data: item, error: itemError } = await supabase
      .from("inventory_items")
      .insert(itemData)
      .select()
      .single();

    if (itemError) {
      return { data: null, error: itemError.message };
    }

    const method = params.ingestion_method || "manual";
    const userName = user?.user_metadata?.full_name || user?.email || "Unknown";
    await supabase
      .from("asset_audits")
      .insert({
        organization_id: params.organization_id,
        asset_id: null,
        inventory_id: item.id,
        action: "created",
        notes: `Stock item "${params.name}" (qty: ${quantity}) added via ${method}`,
        user_id: user.id,
        user_name: userName,
        metadata: { item_name: params.name, quantity, method },
      });

    revalidatePath("/dashboard/assets");
    return { data: item, error: null };
  } catch (error: any) {
    return { data: null, error: error.message || "Failed to create inventory item" };
  }
}

/**
 * Get recent asset audit entries for an organization
 */
export async function getAssetAudits(orgId: string) {
  try {
    const supabase = await createServerSupabaseClient();

    const { data: audits, error } = await supabase
      .from("asset_audits")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      return { data: null, error: error.message };
    }

    return { data: audits || [], error: null };
  } catch (error: any) {
    return { data: null, error: error.message || "Failed to fetch asset audits" };
  }
}

/* ── RPC-backed Operations ─────────────────────────────── */

export interface AssetsOverview {
  total_assets: number;
  total_asset_value: number;
  vehicles_active: number;
  assets_assigned: number;
  assets_maintenance: number;
  service_due_count: number;
  low_stock_count: number;
  critical_stock_count: number;
  total_inventory_value: number;
}

/**
 * Get assets overview stats via RPC
 */
export async function getAssetsOverview(orgId: string) {
  try {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase.rpc("get_assets_overview", {
      p_org_id: orgId,
    });

    if (error) {
      logger.error("get_assets_overview RPC failed", "assets", undefined, { error: error.message });
      return { data: null, error: error.message };
    }

    return { data: data as unknown as AssetsOverview, error: null };
  } catch (error: any) {
    return { data: null, error: error.message || "Failed to fetch assets overview" };
  }
}

/**
 * Toggle asset custody (check-in / check-out) via RPC
 */
export async function toggleAssetCustody(
  assetId: string,
  targetUserId: string | null,
  notes?: string
) {
  try {
    const supabase = await createServerSupabaseClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Not authenticated" };

    const { data, error } = await supabase.rpc("toggle_asset_custody", {
      p_asset_id: assetId,
      p_target_user_id: targetUserId ?? undefined,
      p_actor_id: user.id,
      p_notes: notes || undefined,
    });

    if (error) {
      logger.error("toggle_asset_custody RPC failed", "assets", undefined, { error: error.message });
      return { data: null, error: error.message };
    }

    const rpcResult = data as Record<string, any> | null;
    if (rpcResult?.error) {
      return { data: null, error: rpcResult.error };
    }

    revalidatePath("/dashboard/assets");
    return { data, error: null };
  } catch (error: any) {
    return { data: null, error: error.message || "Failed to toggle custody" };
  }
}

/**
 * Consume inventory on a job via RPC
 */
export async function consumeInventory(
  inventoryId: string,
  quantity: number,
  jobId?: string,
  notes?: string
) {
  try {
    const supabase = await createServerSupabaseClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Not authenticated" };

    const { data, error } = await supabase.rpc("consume_inventory", {
      p_inventory_id: inventoryId,
      p_quantity: quantity,
      p_job_id: jobId || undefined,
      p_actor_id: user.id,
      p_notes: notes || undefined,
    });

    if (error) {
      logger.error("consume_inventory RPC failed", "assets", undefined, { error: error.message });
      return { data: null, error: error.message };
    }

    const rpcResult = data as Record<string, any> | null;
    if (rpcResult?.error) {
      return { data: null, error: rpcResult.error };
    }

    // Dispatch low stock alerts
    if (rpcResult?.low_stock_alert) {
      const { data: item } = await supabase
        .from("inventory_items")
        .select("name, quantity, min_quantity, organization_id")
        .eq("id", inventoryId)
        .single();

      if (item) {
        if (rpcResult.stock_level === "critical") {
          dispatch(Events.inventoryCriticalStock(item.organization_id, inventoryId, {
            name: item.name, quantity: rpcResult.new_quantity, min_quantity: item.min_quantity, stock_level: "critical",
          }));
        } else {
          dispatch(Events.inventoryLowStock(item.organization_id, inventoryId, {
            name: item.name, quantity: rpcResult.new_quantity, min_quantity: item.min_quantity, stock_level: "low",
          }));
        }
      }
    }

    revalidatePath("/dashboard/assets");
    return { data, error: null };
  } catch (error: any) {
    return { data: null, error: error.message || "Failed to consume inventory" };
  }
}

/**
 * Scan lookup — resolve barcode/QR to an existing asset or inventory item
 */
export async function scanLookup(orgId: string, barcode: string) {
  try {
    const supabase = await createServerSupabaseClient();

    // Check assets first
    const { data: asset } = await supabase
      .from("assets")
      .select("id, name, category, status, serial_number, barcode")
      .eq("organization_id", orgId)
      .or(`barcode.eq.${barcode},serial_number.eq.${barcode}`)
      .is("deleted_at", null)
      .maybeSingle();

    if (asset) {
      return { data: { type: "asset" as const, item: asset }, error: null };
    }

    // Check inventory
    const { data: stock } = await supabase
      .from("inventory_items")
      .select("id, name, sku, barcode, quantity, min_quantity")
      .eq("organization_id", orgId)
      .or(`barcode.eq.${barcode},sku.eq.${barcode}`)
      .maybeSingle();

    if (stock) {
      return { data: { type: "stock" as const, item: stock }, error: null };
    }

    return { data: { type: "not_found" as const, barcode }, error: null };
  } catch (error: any) {
    return { data: null, error: error.message || "Scan lookup failed" };
  }
}

/**
 * Get audit trail for a specific entity (asset or inventory item)
 */
export async function getEntityAudits(entityId: string, entityType: "asset" | "inventory") {
  try {
    const supabase = await createServerSupabaseClient();
    const column = entityType === "asset" ? "asset_id" : "inventory_id";

    const { data: audits, error } = await supabase
      .from("asset_audits")
      .select("*")
      .eq(column, entityId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) return { data: null, error: error.message };
    return { data: audits || [], error: null };
  } catch (error: any) {
    return { data: null, error: error.message || "Failed to fetch entity audits" };
  }
}

/**
 * Log service for an asset via RPC
 */
export async function logAssetService(assetId: string, notes?: string) {
  try {
    const supabase = await createServerSupabaseClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Not authenticated" };

    const { data, error } = await supabase.rpc("log_asset_service", {
      p_asset_id: assetId,
      p_actor_id: user.id,
      p_notes: notes || undefined,
    });

    if (error) {
      logger.error("log_asset_service RPC failed", "assets", undefined, { error: error.message });
      return { data: null, error: error.message };
    }

    const rpcResult = data as Record<string, any> | null;
    if (rpcResult?.error) {
      return { data: null, error: rpcResult.error };
    }

    revalidatePath("/dashboard/assets");
    return { data, error: null };
  } catch (error: any) {
    return { data: null, error: error.message || "Failed to log service" };
  }
}

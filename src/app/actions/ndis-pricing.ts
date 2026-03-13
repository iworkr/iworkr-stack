/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/* ── Types ────────────────────────────────────────────── */

export interface NDISCatalogueItem {
  id: string;
  support_item_number: string;
  support_item_name: string;
  registration_group: string | null;
  support_category: "core" | "capacity_building" | "capital";
  unit: string;
  base_rate_national: number;
  base_rate_remote: number | null;
  base_rate_very_remote: number | null;
  effective_from: string;
  effective_to: string | null;
  is_group_based: boolean;
  provider_travel_eligible: boolean;
  cancellation_eligible: boolean;
  non_face_to_face_eligible: boolean;
  created_at: string;
}

export interface NDISSyncLogEntry {
  id: string;
  organization_id: string | null;
  effective_from: string;
  items_inserted: number;
  items_updated: number;
  items_closed: number;
  source: string;
  filename: string | null;
  status: string;
  error_message: string | null;
  created_at: string;
}

export interface NDISSyncStatus {
  active_items: number;
  latest_effective_from: string | null;
  synced: boolean;
  category_counts: { core: number; capacity_building: number; capital: number };
  last_sync: NDISSyncLogEntry | null;
}

/* ── Fetch Catalogue Items ────────────────────────────── */

export async function fetchNDISCatalogue(
  search?: string,
  category?: string,
  limit = 200,
  offset = 0,
): Promise<{ data: NDISCatalogueItem[]; total: number }> {
  const supabase = await createServerSupabaseClient();

  let query = (supabase as any)
    .from("ndis_catalogue")
    .select("*", { count: "exact" })
    .is("effective_to", null)
    .order("support_item_number")
    .range(offset, offset + limit - 1);

  if (category && category !== "all") query = query.eq("support_category", category);
  if (search) {
    query = query.or(
      `support_item_number.ilike.%${search}%,support_item_name.ilike.%${search}%`
    );
  }

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);
  return { data: (data || []) as NDISCatalogueItem[], total: count || 0 };
}

/* ── Sync Status ──────────────────────────────────────── */

export async function fetchNDISSyncStatus(): Promise<NDISSyncStatus> {
  const supabase = await createServerSupabaseClient();

  // Active item count
  const { count: activeCount } = await (supabase as any)
    .from("ndis_catalogue")
    .select("*", { count: "exact", head: true })
    .is("effective_to", null);

  // Latest effective_from
  const { data: latest } = await (supabase as any)
    .from("ndis_catalogue")
    .select("effective_from")
    .is("effective_to", null)
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Category counts — use direct queries (most reliable)
  const categoryCounts = { core: 0, capacity_building: 0, capital: 0 };
  for (const cat of ["core", "capacity_building", "capital"] as const) {
    const { count } = await (supabase as any)
      .from("ndis_catalogue")
      .select("*", { count: "exact", head: true })
      .is("effective_to", null)
      .eq("support_category", cat);
    categoryCounts[cat] = count || 0;
  }

  // Last sync log (may return null if no logs yet — that's fine)
  let lastSync = null;
  try {
    const { data } = await (supabase as any)
      .from("ndis_sync_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    lastSync = data;
  } catch {
    // sync_log table might not be visible — ignore
  }

  return {
    active_items: activeCount || 0,
    latest_effective_from: latest?.effective_from || null,
    synced: (activeCount || 0) > 0,
    category_counts: categoryCounts,
    last_sync: lastSync || null,
  };
}

/* ── Upload CSV and Sync ──────────────────────────────── */

export async function syncNDISCatalogueFromCSV(
  csvContent: string,
  effectiveFrom: string,
  filename: string,
): Promise<{ success: boolean; items_inserted: number; items_parsed: number; error?: string }> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, items_inserted: 0, items_parsed: 0, error: "Unauthorized" };

  // Get org
  const { data: membership } = await (supabase as any)
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  const orgId = membership?.organization_id;

  try {
    // Parse CSV
    const lines = csvContent.split("\n").filter((l: string) => l.trim());
    if (lines.length < 2) {
      return { success: false, items_inserted: 0, items_parsed: 0, error: "CSV must have a header row and at least one data row" };
    }

    const header = parseCSVLine(lines[0]).map((h: string) => h.toLowerCase().replace(/\s+/g, "_"));

    // Detect column positions (flexible matching for different NDIS CSV formats)
    const itemNumIdx = header.findIndex((h: string) =>
      h.includes("support_item_number") || h.includes("item_number") || h.includes("support_item")
    );
    const itemNameIdx = header.findIndex((h: string) =>
      h.includes("support_item_name") || h.includes("item_name") || h.includes("support_name") || h.includes("description")
    );
    const regGroupIdx = header.findIndex((h: string) =>
      h.includes("registration_group") || h.includes("reg_group")
    );
    const categoryIdx = header.findIndex((h: string) =>
      h.includes("support_category") || h.includes("category") || h.includes("outcome_domain")
    );
    const unitIdx = header.findIndex((h: string) =>
      h.includes("unit") || h.includes("quote") || h.includes("measure")
    );
    const rateIdx = header.findIndex((h: string) =>
      h.includes("national") || h.includes("act") || h.includes("nsw") || h.includes("price_limit") || h.includes("price") || h.includes("rate")
    );
    const remoteIdx = header.findIndex((h: string) =>
      h.includes("remote") && !h.includes("very") && !h.includes("non")
    );
    const veryRemoteIdx = header.findIndex((h: string) =>
      h.includes("very_remote")
    );

    if (itemNumIdx === -1 || rateIdx === -1) {
      return {
        success: false,
        items_inserted: 0,
        items_parsed: 0,
        error: `Cannot detect required columns. Found headers: ${header.slice(0, 10).join(", ")}. Need support_item_number and a price/rate column.`,
      };
    }

    // Parse rows
    const rows: Array<Record<string, unknown>> = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      const itemNum = cols[itemNumIdx]?.trim();
      if (!itemNum || itemNum.length < 3) continue;

      const rate = parseFloat(cols[rateIdx]?.replace(/[$,\s]/g, "") || "0");
      if (isNaN(rate) || rate <= 0) continue;

      const remoteRate = remoteIdx >= 0 ? parseFloat(cols[remoteIdx]?.replace(/[$,\s]/g, "") || "0") : null;
      const veryRemoteRate = veryRemoteIdx >= 0 ? parseFloat(cols[veryRemoteIdx]?.replace(/[$,\s]/g, "") || "0") : null;

      rows.push({
        support_item_number: itemNum,
        support_item_name: cols[itemNameIdx]?.trim() || itemNum,
        registration_group: regGroupIdx >= 0 ? (cols[regGroupIdx]?.trim() || null) : null,
        support_category: mapCategory(categoryIdx >= 0 ? (cols[categoryIdx] || "core") : inferCategoryFromNumber(itemNum)),
        unit: unitIdx >= 0 ? (cols[unitIdx]?.trim().toLowerCase() || "hour") : "hour",
        base_rate_national: rate,
        base_rate_remote: remoteRate && !isNaN(remoteRate) && remoteRate > 0 ? remoteRate : null,
        base_rate_very_remote: veryRemoteRate && !isNaN(veryRemoteRate) && veryRemoteRate > 0 ? veryRemoteRate : null,
        effective_from: effectiveFrom,
        effective_to: null,
        is_group_based: false,
        provider_travel_eligible: false,
        cancellation_eligible: false,
        non_face_to_face_eligible: false,
      });
    }

    if (rows.length === 0) {
      return { success: false, items_inserted: 0, items_parsed: 0, error: "No valid rows parsed from CSV. Ensure the file contains NDIS support item numbers and prices." };
    }

    // Use service role for writes (RLS blocks authenticated writes to ndis_catalogue)
    // We call the Supabase Edge Function for the actual insert
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return { success: false, items_inserted: 0, items_parsed: rows.length, error: "Missing Supabase configuration" };
    }

    // Close out previous active items
    const closeRes = await fetch(`${supabaseUrl}/rest/v1/ndis_catalogue?effective_to=is.null&effective_from=lt.${effectiveFrom}`, {
      method: "PATCH",
      headers: {
        "apikey": serviceRoleKey,
        "Authorization": `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
      },
      body: JSON.stringify({ effective_to: getPreviousDay(effectiveFrom) }),
    });

    if (!closeRes.ok) {
      console.error("Failed to close previous catalogue items:", await closeRes.text());
    }

    // Check for idempotency
    const checkRes = await fetch(
      `${supabaseUrl}/rest/v1/ndis_catalogue?effective_from=eq.${effectiveFrom}&select=id&limit=1`,
      {
        headers: {
          "apikey": serviceRoleKey,
          "Authorization": `Bearer ${serviceRoleKey}`,
        },
      }
    );
    const existing = await checkRes.json();
    if (existing && existing.length > 0) {
      return {
        success: true,
        items_inserted: 0,
        items_parsed: rows.length,
        error: `Catalogue for ${effectiveFrom} already exists. Delete existing items first to re-sync.`,
      };
    }

    // Batch insert
    let inserted = 0;
    const batchSize = 200;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const insertRes = await fetch(`${supabaseUrl}/rest/v1/ndis_catalogue`, {
        method: "POST",
        headers: {
          "apikey": serviceRoleKey,
          "Authorization": `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
          "Prefer": "return=minimal",
        },
        body: JSON.stringify(batch),
      });

      if (insertRes.ok) {
        inserted += batch.length;
      } else {
        console.error(`Batch insert error at offset ${i}:`, await insertRes.text());
      }
    }

    // Log the sync
    await (supabase as any).from("ndis_sync_log").insert({
      organization_id: orgId || null,
      synced_by: user.id,
      effective_from: effectiveFrom,
      items_inserted: inserted,
      items_updated: 0,
      items_closed: 0,
      source: "csv_upload",
      filename,
      status: inserted === rows.length ? "success" : "partial",
    });

    revalidatePath("/dashboard/settings/ndis-pricing");

    return {
      success: true,
      items_inserted: inserted,
      items_parsed: rows.length,
    };
  } catch (err) {
    // Log failure
    if (orgId) {
      await (supabase as any).from("ndis_sync_log").insert({
        organization_id: orgId,
        synced_by: user.id,
        effective_from: effectiveFrom,
        items_inserted: 0,
        source: "csv_upload",
        filename,
        status: "failed",
        error_message: (err as Error).message,
      });
    }

    return {
      success: false,
      items_inserted: 0,
      items_parsed: 0,
      error: (err as Error).message,
    };
  }
}

/* ── Get NDIS Rate with Regional Modifier ─────────────── */

export async function getNDISRate(
  supportItemNumber: string,
  mmmClassification: number = 1,
  date?: string,
) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await (supabase as any).rpc("get_ndis_rate", {
    p_support_item_number: supportItemNumber,
    p_date: date || new Date().toISOString().split("T")[0],
    p_mmm_classification: mmmClassification,
  });

  if (error) throw new Error(error.message);
  return data?.[0] || null;
}

/* ── Delete catalogue for a specific effective_from ───── */

export async function deleteNDISCatalogueVersion(effectiveFrom: string): Promise<{ success: boolean; deleted: number; error?: string }> {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, deleted: 0, error: "Unauthorized" };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return { success: false, deleted: 0, error: "Missing Supabase configuration" };
  }

  // Count items first
  const countRes = await fetch(
    `${supabaseUrl}/rest/v1/ndis_catalogue?effective_from=eq.${effectiveFrom}&select=id`,
    {
      headers: {
        "apikey": serviceRoleKey,
        "Authorization": `Bearer ${serviceRoleKey}`,
      },
    }
  );
  const items = await countRes.json();
  const itemCount = items?.length || 0;

  // Delete
  const deleteRes = await fetch(
    `${supabaseUrl}/rest/v1/ndis_catalogue?effective_from=eq.${effectiveFrom}`,
    {
      method: "DELETE",
      headers: {
        "apikey": serviceRoleKey,
        "Authorization": `Bearer ${serviceRoleKey}`,
        "Prefer": "return=minimal",
      },
    }
  );

  if (!deleteRes.ok) {
    return { success: false, deleted: 0, error: `Delete failed: ${await deleteRes.text()}` };
  }

  // Re-open the previous version if exists
  // (Set effective_to = null for the most recent closed items)
  await fetch(
    `${supabaseUrl}/rest/v1/ndis_catalogue?effective_to=eq.${getPreviousDay(effectiveFrom)}&select=id&limit=1`,
    {
      headers: {
        "apikey": serviceRoleKey,
        "Authorization": `Bearer ${serviceRoleKey}`,
      },
    }
  ).then(async (res) => {
    const prev = await res.json();
    if (prev && prev.length > 0) {
      const prevDay = getPreviousDay(effectiveFrom);
      await fetch(
        `${supabaseUrl}/rest/v1/ndis_catalogue?effective_to=eq.${prevDay}`,
        {
          method: "PATCH",
          headers: {
            "apikey": serviceRoleKey,
            "Authorization": `Bearer ${serviceRoleKey}`,
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
          },
          body: JSON.stringify({ effective_to: null }),
        }
      );
    }
  }).catch(() => { /* ignore */ });

  revalidatePath("/dashboard/settings/ndis-pricing");

  return { success: true, deleted: itemCount };
}

/* ── Fetch Sync History ───────────────────────────────── */

export async function fetchNDISSyncHistory(): Promise<NDISSyncLogEntry[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await (supabase as any)
    .from("ndis_sync_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return [];
  return (data || []) as NDISSyncLogEntry[];
}

/* ── Helpers ──────────────────────────────────────────── */

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function mapCategory(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes("core") || lower.includes("daily_life") || lower.includes("daily life")) return "core";
  if (lower.includes("capacity") || lower.includes("building")) return "capacity_building";
  if (lower.includes("capital")) return "capital";
  return "core";
}

function inferCategoryFromNumber(itemNumber: string): string {
  const prefix = itemNumber.split("_")[0];
  if (!prefix) return "core";
  const num = parseInt(prefix);
  // Based on NDIS Support Catalogue structure:
  // 01-04: Core, 05-06: Capital, 07-15: Capacity Building
  if (num >= 1 && num <= 4) return "core";
  if (num >= 5 && num <= 6) return "capital";
  if (num >= 7) return "capacity_building";
  return "core";
}

function getPreviousDay(dateStr: string): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
}

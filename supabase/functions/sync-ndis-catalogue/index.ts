/**
 * sync-ndis-catalogue — NDIS Price Guide Synchronization
 *
 * Edge Function: Accepts NDIS Support Catalogue CSV uploads, parses all support items,
 * and upserts into the ndis_catalogue table with temporal versioning.
 * Also supports GET for sync status and category counts.
 *
 * POST /sync-ndis-catalogue  — Upload and sync CSV
 * GET  /sync-ndis-catalogue  — Get sync status + category breakdown
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_URL") || "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

interface CatalogueRow {
  support_item_number: string;
  support_item_name: string;
  registration_group: string | null;
  support_category: string;
  unit: string;
  base_rate_national: number;
  base_rate_remote: number | null;
  base_rate_very_remote: number | null;
  is_group_based: boolean;
  provider_travel_eligible: boolean;
  cancellation_eligible: boolean;
  non_face_to_face_eligible: boolean;
}

/* ── CSV Parser ──────────────────────────────────────── */

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

/* ── Category Mapping ────────────────────────────────── */

function mapCategory(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes("core") || lower.includes("daily life") || lower.includes("daily_life")) return "core";
  if (lower.includes("capacity") || lower.includes("building")) return "capacity_building";
  if (lower.includes("capital")) return "capital";
  return "core";
}

function inferCategoryFromNumber(itemNumber: string): string {
  const prefix = itemNumber.split("_")[0];
  if (!prefix) return "core";
  const num = parseInt(prefix);
  if (num >= 1 && num <= 4) return "core";
  if (num >= 5 && num <= 6) return "capital";
  if (num >= 7) return "capacity_building";
  return "core";
}

/* ── Boolean flag detection ──────────────────────────── */

function parseBool(val: string | undefined): boolean {
  if (!val) return false;
  const lower = val.toLowerCase().trim();
  return lower === "y" || lower === "yes" || lower === "true" || lower === "1";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ─── GET: Return sync status ──────────────────────────────────
    if (req.method === "GET") {
      // Active count
      const { count: activeCount } = await adminClient
        .from("ndis_catalogue")
        .select("*", { count: "exact", head: true })
        .is("effective_to", null);

      // Latest effective_from
      const { data: latest } = await adminClient
        .from("ndis_catalogue")
        .select("effective_from")
        .is("effective_to", null)
        .order("effective_from", { ascending: false })
        .limit(1)
        .single();

      // Category breakdown
      const categories: Record<string, number> = {};
      for (const cat of ["core", "capacity_building", "capital"]) {
        const { count } = await adminClient
          .from("ndis_catalogue")
          .select("*", { count: "exact", head: true })
          .is("effective_to", null)
          .eq("support_category", cat);
        categories[cat] = count || 0;
      }

      return new Response(
        JSON.stringify({
          status: "ok",
          active_items: activeCount || 0,
          latest_effective_from: latest?.effective_from || null,
          synced: activeCount !== null && activeCount > 0,
          categories,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── POST: Upload and sync CSV ──────────────────────────────────
    const body = await req.json();
    const { csv_content, effective_from } = body;

    if (!csv_content || !effective_from) {
      return new Response(
        JSON.stringify({ error: "csv_content and effective_from (YYYY-MM-DD) are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse CSV
    const lines = csv_content.split("\n").filter((l: string) => l.trim());
    if (lines.length < 2) {
      return new Response(
        JSON.stringify({ error: "CSV must have a header row and at least one data row" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse header — flexible matching for various NDIS CSV formats
    const rawHeader = parseCSVLine(lines[0]);
    const header = rawHeader.map((h: string) => h.toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/_+/g, "_"));

    const findCol = (patterns: string[]) =>
      header.findIndex((h: string) => patterns.some((p) => h.includes(p)));

    const itemNumIdx = findCol(["support_item_number", "item_number", "support_item_ref", "support_item"]);
    const itemNameIdx = findCol(["support_item_name", "item_name", "support_name", "description"]);
    const regGroupIdx = findCol(["registration_group_number", "registration_group", "reg_group"]);
    const categoryIdx = findCol(["support_category_number", "support_category", "outcome_domain", "category"]);
    const unitIdx = findCol(["unit_of_measure", "unit", "quote", "measure"]);
    const rateIdx = findCol(["price_limit", "national", "act_nsw_qld_vic", "non_remote", "price", "rate"]);
    const remoteIdx = header.findIndex((h: string) => h.includes("remote") && !h.includes("very") && !h.includes("non"));
    const veryRemoteIdx = findCol(["very_remote"]);
    const groupIdx = findCol(["group_based", "is_group"]);
    const travelIdx = findCol(["provider_travel", "travel"]);
    const cancelIdx = findCol(["short_notice_cancel", "cancellation"]);
    const nftfIdx = findCol(["non_face_to_face", "nftf"]);

    if (itemNumIdx === -1) {
      return new Response(
        JSON.stringify({
          error: `Cannot detect "Support Item Number" column. Detected headers: ${rawHeader.slice(0, 8).join(", ")}`,
          headers_found: rawHeader,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (rateIdx === -1) {
      return new Response(
        JSON.stringify({
          error: `Cannot detect price/rate column. Detected headers: ${rawHeader.slice(0, 8).join(", ")}`,
          headers_found: rawHeader,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse rows
    const rows: CatalogueRow[] = [];
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      const itemNum = cols[itemNumIdx]?.trim();
      if (!itemNum || itemNum.length < 3) continue;

      const rateStr = cols[rateIdx]?.replace(/[$,\s]/g, "") || "0";
      const rate = parseFloat(rateStr);
      if (isNaN(rate) || rate <= 0) {
        if (itemNum.length > 5) errors.push(`Row ${i}: Invalid rate "${cols[rateIdx]}" for ${itemNum}`);
        continue;
      }

      const remoteRate = remoteIdx >= 0 ? parseFloat(cols[remoteIdx]?.replace(/[$,\s]/g, "") || "0") : null;
      const veryRemoteRate = veryRemoteIdx >= 0 ? parseFloat(cols[veryRemoteIdx]?.replace(/[$,\s]/g, "") || "0") : null;
      const rawCategory = categoryIdx >= 0 ? cols[categoryIdx] || "" : "";

      rows.push({
        support_item_number: itemNum,
        support_item_name: itemNameIdx >= 0 ? (cols[itemNameIdx]?.trim() || itemNum) : itemNum,
        registration_group: regGroupIdx >= 0 ? (cols[regGroupIdx]?.trim() || null) : null,
        support_category: rawCategory ? mapCategory(rawCategory) : inferCategoryFromNumber(itemNum),
        unit: unitIdx >= 0 ? (cols[unitIdx]?.trim().toLowerCase() || "hour") : "hour",
        base_rate_national: rate,
        base_rate_remote: remoteRate && !isNaN(remoteRate) && remoteRate > 0 ? remoteRate : null,
        base_rate_very_remote: veryRemoteRate && !isNaN(veryRemoteRate) && veryRemoteRate > 0 ? veryRemoteRate : null,
        is_group_based: groupIdx >= 0 ? parseBool(cols[groupIdx]) : false,
        provider_travel_eligible: travelIdx >= 0 ? parseBool(cols[travelIdx]) : false,
        cancellation_eligible: cancelIdx >= 0 ? parseBool(cols[cancelIdx]) : false,
        non_face_to_face_eligible: nftfIdx >= 0 ? parseBool(cols[nftfIdx]) : false,
      });
    }

    if (rows.length === 0) {
      return new Response(
        JSON.stringify({
          error: "No valid rows parsed from CSV",
          parse_errors: errors.slice(0, 10),
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Temporal versioning: close previous active items
    const newEffectiveFrom = new Date(effective_from);
    const prevEffectiveTo = new Date(newEffectiveFrom);
    prevEffectiveTo.setDate(prevEffectiveTo.getDate() - 1);
    const prevEffectiveToStr = prevEffectiveTo.toISOString().split("T")[0];

    await adminClient
      .from("ndis_catalogue")
      .update({ effective_to: prevEffectiveToStr })
      .is("effective_to", null)
      .lt("effective_from", effective_from);

    // Idempotency check
    const { count: existingCount } = await adminClient
      .from("ndis_catalogue")
      .select("*", { count: "exact", head: true })
      .eq("effective_from", effective_from);

    if (existingCount && existingCount > 0) {
      return new Response(
        JSON.stringify({
          status: "no_change",
          message: `Catalogue for ${effective_from} already exists with ${existingCount} items. No changes made.`,
          items: existingCount,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Batch insert
    let inserted = 0;
    const batchSize = 500;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize).map((r) => ({
        ...r,
        effective_from,
        effective_to: null,
      }));

      const { error: insertError } = await adminClient.from("ndis_catalogue").insert(batch);
      if (insertError) {
        console.error(`Batch insert error at offset ${i}:`, insertError);
        errors.push(`Batch at offset ${i} failed: ${insertError.message}`);
        continue;
      }
      inserted += batch.length;
    }

    return new Response(
      JSON.stringify({
        status: "synced",
        effective_from,
        items_inserted: inserted,
        items_parsed: rows.length,
        previous_items_closed: true,
        parse_errors: errors.length > 0 ? errors.slice(0, 20) : undefined,
        columns_detected: {
          item_number: rawHeader[itemNumIdx],
          item_name: itemNameIdx >= 0 ? rawHeader[itemNameIdx] : null,
          rate: rawHeader[rateIdx],
          category: categoryIdx >= 0 ? rawHeader[categoryIdx] : "inferred from item number",
          unit: unitIdx >= 0 ? rawHeader[unitIdx] : "default: hour",
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal server error", details: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

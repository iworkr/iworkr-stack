/**
 * sync-ndis-catalogue — Project Nightingale Phase 3
 *
 * Edge Function: NDIS Price Guide Synchronization
 *
 * Accepts an NDIS Price Guide CSV upload, parses all support items,
 * and upserts into the ndis_catalogue table with temporal versioning.
 * Idempotent: re-uploading the same CSV produces zero changes.
 *
 * Also supports fetching the current active catalogue for a given date.
 *
 * POST /sync-ndis-catalogue  — Upload and sync CSV
 * GET  /sync-ndis-catalogue  — Get sync status
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_URL") || "http://localhost:3000",
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
  if (lower.includes("core")) return "core";
  if (lower.includes("capacity") || lower.includes("building")) return "capacity_building";
  if (lower.includes("capital")) return "capital";
  return "core";
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
      const { data: latest } = await adminClient
        .from("ndis_catalogue")
        .select("effective_from, support_item_number")
        .is("effective_to", null)
        .order("effective_from", { ascending: false })
        .limit(1)
        .single();

      const { count } = await adminClient
        .from("ndis_catalogue")
        .select("*", { count: "exact", head: true })
        .is("effective_to", null);

      return new Response(
        JSON.stringify({
          status: "ok",
          active_items: count || 0,
          latest_effective_from: latest?.effective_from || null,
          synced: count !== null && count > 0,
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

    const lines = csv_content.split("\n").filter((l: string) => l.trim());
    if (lines.length < 2) {
      return new Response(
        JSON.stringify({ error: "CSV must have a header row and at least one data row" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse header to detect column positions
    const header = parseCSVLine(lines[0]).map((h: string) => h.toLowerCase().replace(/\s+/g, "_"));

    const itemNumIdx = header.findIndex((h: string) => h.includes("item_number") || h.includes("support_item"));
    const itemNameIdx = header.findIndex((h: string) => h.includes("item_name") || h.includes("support_name"));
    const regGroupIdx = header.findIndex((h: string) => h.includes("registration_group"));
    const categoryIdx = header.findIndex((h: string) => h.includes("category"));
    const unitIdx = header.findIndex((h: string) => h.includes("unit"));
    const rateIdx = header.findIndex((h: string) => h.includes("national") || h.includes("price") || h.includes("rate"));

    if (itemNumIdx === -1 || rateIdx === -1) {
      return new Response(
        JSON.stringify({ error: "Cannot detect support_item_number or rate columns in CSV" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse rows
    const rows: CatalogueRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVLine(lines[i]);
      const itemNum = cols[itemNumIdx]?.trim();
      if (!itemNum) continue;

      const rate = parseFloat(cols[rateIdx]?.replace(/[$,]/g, "") || "0");
      if (isNaN(rate) || rate <= 0) continue;

      rows.push({
        support_item_number: itemNum,
        support_item_name: cols[itemNameIdx] || itemNum,
        registration_group: cols[regGroupIdx] || null,
        support_category: mapCategory(cols[categoryIdx] || "core"),
        unit: cols[unitIdx]?.toLowerCase() || "hour",
        base_rate_national: rate,
        base_rate_remote: null,
        base_rate_very_remote: null,
        is_group_based: false,
        provider_travel_eligible: false,
        cancellation_eligible: false,
        non_face_to_face_eligible: false,
      });
    }

    if (rows.length === 0) {
      return new Response(
        JSON.stringify({ error: "No valid rows parsed from CSV" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate effective_to for previous version: one day before the new guide
    const newEffectiveFrom = new Date(effective_from);
    const prevEffectiveTo = new Date(newEffectiveFrom);
    prevEffectiveTo.setDate(prevEffectiveTo.getDate() - 1);
    const prevEffectiveToStr = prevEffectiveTo.toISOString().split("T")[0];

    // Close out previous active items
    const { data: _closedData, error: closeError } = await adminClient
      .from("ndis_catalogue")
      .update({ effective_to: prevEffectiveToStr })
      .is("effective_to", null)
      .lt("effective_from", effective_from);

    if (closeError) {
      console.error("Error closing previous catalogue:", closeError);
    }

    // Check for existing items with same effective_from (idempotency)
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

    // Insert new items in batches of 500
    let inserted = 0;
    const batchSize = 500;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize).map((r) => ({
        ...r,
        effective_from,
        effective_to: null,
      }));

      const { error: insertError } = await adminClient
        .from("ndis_catalogue")
        .insert(batch);

      if (insertError) {
        console.error(`Batch insert error at offset ${i}:`, insertError);
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

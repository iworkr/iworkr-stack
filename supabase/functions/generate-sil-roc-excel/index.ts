/**
 * @module generate-sil-roc-excel
 * @status COMPLETE
 * @auth SECURED — Authorization header + auth.getUser() verified
 * @description Generates NDIS SIL Roster of Care Excel workbook with provider, participant, roster, and financial sheets
 * @dependencies Supabase, ExcelJS
 * @lastAudit 2026-03-22
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import ExcelJS from "npm:exceljs@4.4.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } },
    );
    const {
      data: { user },
    } = await authClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    const quoteId = String(body.quote_id || "");
    const organizationId = String(body.organization_id || "");
    if (!quoteId || !organizationId) {
      return new Response(JSON.stringify({ error: "quote_id and organization_id are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: quote } = await admin
      .from("sil_quotes")
      .select("id, name, base_week_start, care_facilities(name), organizations(name, metadata)")
      .eq("id", quoteId)
      .eq("organization_id", organizationId)
      .single();

    const [{ data: participants }, { data: blocks }, { data: lineItems }] = await Promise.all([
      admin
        .from("sil_quote_participants")
        .select("participant_id, participant_profiles(preferred_name, ndis_number, primary_diagnosis)")
        .eq("quote_id", quoteId),
      admin
        .from("sil_quote_blocks")
        .select("day_of_week, start_time, active_workers, active_participants, is_sleepover, is_active_night")
        .eq("quote_id", quoteId)
        .order("day_of_week")
        .order("start_time"),
      admin
        .from("sil_quote_line_items")
        .select("participant_id, ndis_line_item_code, total_hours_per_week, hourly_rate, weekly_cost, annual_cost")
        .eq("quote_id", quoteId),
    ]);

    const workbook = new ExcelJS.Workbook();
    const providerSheet = workbook.addWorksheet("Provider Details");
    const participantSheet = workbook.addWorksheet("Participant Details");
    const rosterSheet = workbook.addWorksheet("24-7 Roster");

    providerSheet.getCell("A1").value = "NDIS SIL Roster of Care";
    providerSheet.getCell("A2").value = "Provider Name";
    providerSheet.getCell("B2").value = quote?.organizations?.name || "iWorkr Provider";
    providerSheet.getCell("A3").value = "Facility";
    providerSheet.getCell("B3").value = quote?.care_facilities?.name || "";
    providerSheet.getCell("A4").value = "Quote Name";
    providerSheet.getCell("B4").value = quote?.name || "";
    providerSheet.getCell("A5").value = "Base Week Start";
    providerSheet.getCell("B5").value = quote?.base_week_start || "";

    participantSheet.columns = [
      { header: "Participant", key: "name", width: 28 },
      { header: "NDIS Number", key: "ndis", width: 22 },
      { header: "Diagnosis", key: "dx", width: 38 },
    ];
    for (const row of participants || []) {
      participantSheet.addRow({
        name: row.participant_profiles?.preferred_name || "Participant",
        ndis: row.participant_profiles?.ndis_number || "",
        dx: row.participant_profiles?.primary_diagnosis || "",
      });
    }

    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    rosterSheet.getCell("A1").value = "Time";
    days.forEach((d, i) => {
      rosterSheet.getCell(1, i + 2).value = d;
    });

    for (let slot = 0; slot < 48; slot++) {
      const h = Math.floor((slot * 30) / 60);
      const m = (slot * 30) % 60;
      rosterSheet.getCell(slot + 2, 1).value = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }

    for (const block of blocks || []) {
      const dayIdx = Number(block.day_of_week) - 1;
      const time = String(block.start_time).slice(0, 5);
      const [hh, mm] = time.split(":").map(Number);
      const slot = hh * 2 + (mm >= 30 ? 1 : 0);
      const row = slot + 2;
      const col = dayIdx + 2;
      const ratio = block.active_participants > 0
        ? `${block.active_workers}:${block.active_participants}`
        : `${block.active_workers}:0`;
      const flag = block.is_sleepover ? "SLEEP" : block.is_active_night ? "NIGHT" : "";
      rosterSheet.getCell(row, col).value = flag ? `${ratio} ${flag}` : ratio;
    }

    const ledgerSheet = workbook.addWorksheet("Financial Ledger");
    ledgerSheet.columns = [
      { header: "Participant ID", key: "pid", width: 38 },
      { header: "NDIS Line Item", key: "code", width: 24 },
      { header: "Hours / Week", key: "hours", width: 14 },
      { header: "Hourly Rate", key: "rate", width: 12 },
      { header: "Weekly Cost", key: "weekly", width: 14 },
      { header: "Annual Cost", key: "annual", width: 14 },
    ];
    for (const row of lineItems || []) {
      ledgerSheet.addRow({
        pid: row.participant_id,
        code: row.ndis_line_item_code,
        hours: Number(row.total_hours_per_week || 0),
        rate: Number(row.hourly_rate || 0),
        weekly: Number(row.weekly_cost || 0),
        annual: Number(row.annual_cost || 0),
      });
    }

    const bytes = await workbook.xlsx.writeBuffer();
    const path = `sil-roc/${organizationId}/${quoteId}/ndis-roc.xlsx`;

    const upload = await admin.storage.from("documents").upload(path, bytes, {
      upsert: true,
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    if (upload.error) throw new Error(upload.error.message);

    const signed = await admin.storage.from("documents").createSignedUrl(path, 60 * 60);
    if (signed.error) throw new Error(signed.error.message);

    return new Response(
      JSON.stringify({
        success: true,
        file_path: path,
        download_url: signed.data.signedUrl,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});


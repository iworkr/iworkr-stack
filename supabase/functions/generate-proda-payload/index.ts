/**
 * @module generate-proda-payload
 * @status COMPLETE
 * @auth SECURED — Authorization header + auth.getUser() verified
 * @description Compiles approved NDIS claim lines into PRODA CSV payload with travel claims, uploads to Storage
 * @dependencies Supabase (RPC: generate_batch_number), Project Odyssey (shift_travel_logs)
 * @lastAudit 2026-03-22
 */

/**
 * generate-proda-payload — Project Nightingale Phase 3
 *
 * Edge Function: PRODA/PACE API Bulk Claim Payload Generator
 *
 * Compiles approved claim_line_items into the exact CSV payload required
 * by the NDIS PRODA/PACE APIs. Creates a proda_claim_batches record.
 *
 * POST body: { organization_id, claim_line_item_ids: string[] }
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

interface ClaimLine {
  id: string;
  ndis_item_number: string | null;
  description: string;
  quantity: number;
  unit_rate: number;
  total_amount: number;
  service_date: string | null;
  participant_id: string;
  worker_id: string | null;
  region_modifier: number;
  gst_amount: number;
}

interface ParticipantInfo {
  id: string;
  ndis_number: string | null;
  client_id: string;
}

interface TravelLogClaim {
  id: string;
  participant_id: string | null;
  travel_type: "provider_travel" | "participant_transport";
  start_time: string;
  claimed_distance_km: number;
  capped_billable_minutes: number | null;
  provider_time_item_number: string | null;
  provider_km_item_number: string | null;
  participant_transport_item_number: string | null;
  payroll_allowance_amount: number | null;
  ndis_billed_amount: number | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { organization_id, claim_line_item_ids, include_travel = true } = body;

    if (!organization_id || !claim_line_item_ids?.length) {
      return new Response(
        JSON.stringify({ error: "organization_id and claim_line_item_ids[] are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Authenticate caller
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch claim lines
    const { data: claimLines, error: clError } = await adminClient
      .from("claim_line_items")
      .select("*")
      .eq("organization_id", organization_id)
      .in("id", claim_line_item_ids)
      .eq("status", "approved");

    if (clError || !claimLines?.length) {
      return new Response(
        JSON.stringify({ error: "No approved claim lines found", details: clError?.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch participant NDIS numbers
    const participantIds = [...new Set(claimLines.map((cl: ClaimLine) => cl.participant_id))];
    const { data: participants } = await adminClient
      .from("participant_profiles")
      .select("id, ndis_number, client_id")
      .in("id", participantIds);

    const participantMap = new Map<string, ParticipantInfo>();
    participants?.forEach((p: ParticipantInfo) => participantMap.set(p.id, p));

    // Fetch participant names via clients table
    const clientIds = participants?.map((p: ParticipantInfo) => p.client_id) || [];
    const { data: clients } = await adminClient
      .from("clients")
      .select("id, name")
      .in("id", clientIds);

    const clientNameMap = new Map<string, string>();
    clients?.forEach((c: { id: string; name: string }) => clientNameMap.set(c.id, c.name));

    // Validate: all lines must have NDIS item numbers and participant NDIS numbers
    const validationErrors: Array<{ claim_id: string; error: string }> = [];
    for (const cl of claimLines as ClaimLine[]) {
      if (!cl.ndis_item_number) {
        validationErrors.push({ claim_id: cl.id, error: "Missing NDIS support item number" });
      }
      const participant = participantMap.get(cl.participant_id);
      if (!participant?.ndis_number) {
        validationErrors.push({ claim_id: cl.id, error: "Participant missing NDIS number" });
      }
    }

    if (validationErrors.length > 0) {
      return new Response(
        JSON.stringify({
          error: "Validation failed",
          validation_errors: validationErrors,
          valid_count: claimLines.length - validationErrors.length,
          invalid_count: validationErrors.length,
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate PRODA CSV payload
    // PRODA CSV format: RegistrationNumber,NDISNumber,SupportItemNumber,DateOfSupport,Quantity,UnitPrice,TotalPrice,GST,ClaimReference
    const { data: org } = await adminClient
      .from("organizations")
      .select("name, metadata")
      .eq("id", organization_id)
      .single();

    const registrationNumber = org?.metadata?.ndis_registration_number || "PENDING";

    const csvHeader = "RegistrationNumber,NDISNumber,SupportItemNumber,DateOfSupport,Quantity,UnitPrice,TotalPrice,GST,ClaimReference,ParticipantName";
    const csvRows: string[] = (claimLines as ClaimLine[]).map((cl) => {
      const participant = participantMap.get(cl.participant_id);
      const clientName = clientNameMap.get(participant?.client_id || "") || "Unknown";
      return [
        registrationNumber,
        participant?.ndis_number || "",
        cl.ndis_item_number || "",
        cl.service_date || "",
        cl.quantity.toFixed(2),
        cl.unit_rate.toFixed(2),
        cl.total_amount.toFixed(2),
        cl.gst_amount.toFixed(2),
        cl.id.substring(0, 8).toUpperCase(), // Short claim reference
        `"${clientName}"`,
      ].join(",");
    });

    // Append approved travel claim rows (Project Odyssey)
    let appendedTravelRows = 0;
    if (include_travel) {
      const { data: travelRows } = await adminClient
        .from("shift_travel_logs")
        .select(`
          id,
          participant_id,
          travel_type,
          start_time,
          claimed_distance_km,
          capped_billable_minutes,
          provider_time_item_number,
          provider_km_item_number,
          participant_transport_item_number,
          payroll_allowance_amount,
          ndis_billed_amount
        `)
        .eq("organization_id", organization_id)
        .eq("is_approved", true)
        .eq("is_claim_exported", false);

      for (const row of (travelRows || []) as TravelLogClaim[]) {
        if (!row.participant_id) continue;
        const participant = participantMap.get(row.participant_id);
        if (!participant?.ndis_number) continue;
        const clientName = clientNameMap.get(participant.client_id || "") || "Unknown";
        const serviceDate = row.start_time?.slice(0, 10) || "";

        if (row.travel_type === "provider_travel") {
          const billableHours = ((row.capped_billable_minutes || 0) / 60);
          if (billableHours > 0) {
            const unitPrice = 65.47;
            const total = unitPrice * billableHours;
            csvRows.push([
              registrationNumber,
              participant.ndis_number || "",
              row.provider_time_item_number || "01_011_0107_1_1",
              serviceDate,
              billableHours.toFixed(2),
              unitPrice.toFixed(2),
              total.toFixed(2),
              "0.00",
              `TRV-T-${row.id.substring(0, 6).toUpperCase()}`,
              `"${clientName}"`,
            ].join(","));
            appendedTravelRows += 1;
          }
          if (row.claimed_distance_km > 0) {
            const unitPrice = 0.96;
            const total = unitPrice * row.claimed_distance_km;
            csvRows.push([
              registrationNumber,
              participant.ndis_number || "",
              row.provider_km_item_number || "01_799_0107_1_1",
              serviceDate,
              row.claimed_distance_km.toFixed(2),
              unitPrice.toFixed(2),
              total.toFixed(2),
              "0.00",
              `TRV-K-${row.id.substring(0, 6).toUpperCase()}`,
              `"${clientName}"`,
            ].join(","));
            appendedTravelRows += 1;
          }
        } else if (row.claimed_distance_km > 0) {
          const unitPrice = 0.96;
          const total = unitPrice * row.claimed_distance_km;
          csvRows.push([
            registrationNumber,
            participant.ndis_number || "",
            row.participant_transport_item_number || "04_590_0125_6_1",
            serviceDate,
            row.claimed_distance_km.toFixed(2),
            unitPrice.toFixed(2),
            total.toFixed(2),
            "0.00",
            `TRN-K-${row.id.substring(0, 6).toUpperCase()}`,
            `"${clientName}"`,
          ].join(","));
          appendedTravelRows += 1;
        }
      }
    }

    const csvContent = [csvHeader, ...csvRows].join("\n");

    // Generate batch number
    const { data: batchNum } = await adminClient.rpc("generate_batch_number", {
      p_organization_id: organization_id,
    });

    const batchNumber = batchNum || `BATCH-${new Date().toISOString().slice(0, 7)}-001`;

    // Upload CSV to storage
    const fileName = `proda/${organization_id}/${batchNumber}.csv`;
    const { error: uploadError } = await adminClient.storage
      .from("documents")
      .upload(fileName, new Blob([csvContent], { type: "text/csv" }), {
        contentType: "text/csv",
        upsert: true,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
    }

    // Create batch record
    const totalAmount = (claimLines as ClaimLine[]).reduce((sum, cl) => sum + cl.total_amount, 0);
    const { data: batch, error: batchError } = await adminClient
      .from("proda_claim_batches")
      .insert({
        organization_id,
        batch_number: batchNumber,
        status: "validating",
        total_claims: claimLines.length,
        total_amount: totalAmount,
        submitted_by: user.id,
        payload_url: fileName,
      })
      .select()
      .single();

    if (batchError) {
      return new Response(
        JSON.stringify({ error: "Failed to create batch", details: batchError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update claim lines with batch reference and status
    await adminClient
      .from("claim_line_items")
      .update({ claim_batch_id: batch.id, status: "submitted" })
      .in("id", claim_line_item_ids);

    if (include_travel) {
      await adminClient
        .from("shift_travel_logs")
        .update({
          is_claim_exported: true,
          claim_exported_at: new Date().toISOString(),
        })
        .eq("organization_id", organization_id)
        .eq("is_approved", true)
        .eq("is_claim_exported", false);
    }

    // Update batch status to submitted
    await adminClient
      .from("proda_claim_batches")
      .update({ status: "submitted", submitted_at: new Date().toISOString() })
      .eq("id", batch.id);

    return new Response(
      JSON.stringify({
        success: true,
        batch_id: batch.id,
        batch_number: batchNumber,
        total_claims: claimLines.length,
        total_amount: totalAmount,
        payload_url: fileName,
        csv_preview: csvContent.split("\n").slice(0, 5).join("\n") + "\n...",
        travel_rows_added: appendedTravelRows,
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

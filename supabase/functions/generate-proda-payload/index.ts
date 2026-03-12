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

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_URL") || "http://localhost:3000",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { organization_id, claim_line_item_ids } = body;

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
    const csvRows = (claimLines as ClaimLine[]).map((cl) => {
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

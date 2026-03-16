// ═══════════════════════════════════════════════════════════════════
// Project Asclepius — S8 Controlled Drug Double-Signing Verification
// ═══════════════════════════════════════════════════════════════════
// Validates the secondary witness for Schedule 8 narcotic administrations.
// Prevents self-witnessing, validates clinical PIN cryptographically,
// and verifies the witness is an active org member at the same facility.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface S8WitnessRequest {
  medication_id: string;
  primary_worker_id: string;
  witness_employee_id: string;
  witness_pin: string;
  organization_id: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  try {
    const body: S8WitnessRequest = await req.json();
    const {
      medication_id,
      primary_worker_id,
      witness_employee_id,
      witness_pin,
      organization_id,
    } = body;

    if (!medication_id || !primary_worker_id || !witness_employee_id || !witness_pin || !organization_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // 1. Look up the witness by their Employee ID within the organization
    const { data: witnessProfile, error: witnessError } = await supabase
      .from("staff_profiles")
      .select("user_id, clinical_pin_hash, organization_id")
      .eq("employee_id", witness_employee_id)
      .eq("organization_id", organization_id)
      .maybeSingle();

    if (witnessError || !witnessProfile) {
      return new Response(
        JSON.stringify({ error: "Invalid Employee ID. No staff member found with that ID in this organization." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Prevent self-witnessing — primary worker cannot be their own witness
    if (witnessProfile.user_id === primary_worker_id) {
      return new Response(
        JSON.stringify({ error: "SELF-WITNESS BLOCKED: The primary administering worker cannot act as their own witness for Schedule 8 medications." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Verify the witness is an active organization member
    const { data: membership, error: memberError } = await supabase
      .from("organization_members")
      .select("id, status, role")
      .eq("user_id", witnessProfile.user_id)
      .eq("organization_id", organization_id)
      .eq("status", "active")
      .maybeSingle();

    if (memberError || !membership) {
      return new Response(
        JSON.stringify({ error: "Witness is not an active member of this organization." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Validate the Clinical PIN
    // For initial deployment, we use a simple hash comparison.
    // In production, this would use bcrypt or argon2.
    if (!witnessProfile.clinical_pin_hash) {
      return new Response(
        JSON.stringify({ error: "Witness has not set a Clinical PIN. Please configure a PIN in Profile Settings." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Simple SHA-256 comparison for the PIN
    const encoder = new TextEncoder();
    const data = encoder.encode(witness_pin);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const pinHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    if (pinHash !== witnessProfile.clinical_pin_hash) {
      return new Response(
        JSON.stringify({ error: "Incorrect Clinical PIN." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Verify the medication is indeed S8
    const { data: medication } = await supabase
      .from("participant_medications")
      .select("id, is_s8_controlled, medication_name")
      .eq("id", medication_id)
      .maybeSingle();

    if (!medication?.is_s8_controlled) {
      return new Response(
        JSON.stringify({ error: "This medication is not flagged as Schedule 8. Dual-signing is not required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6. Success — return the authorized witness ID
    return new Response(
      JSON.stringify({
        success: true,
        witness_id: witnessProfile.user_id,
        medication_name: medication.medication_name,
        verified_at: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `Internal error: ${(err as Error).message}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

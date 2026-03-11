/**
 * validate-schedule — Project Nightingale
 *
 * Edge Function: Scheduling Hard Gate
 *
 * Called before a schedule block is created/updated for "care" organizations.
 * Validates that the assigned worker holds all mandatory, non-expired credentials.
 *
 * For "trades" organizations, this function passes through immediately (no checks).
 *
 * Returns:
 *   200 — All credentials valid, safe to proceed
 *   409 — Missing or expired credentials (body contains details)
 *   400 — Invalid request
 *   401 — Unauthorized
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_URL") || "http://localhost:3000",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Mandatory credentials for care sector workers assigned to shifts
const MANDATORY_CREDENTIAL_TYPES = [
  "NDIS_SCREENING",
  "WWCC",
  "FIRST_AID",
];

interface ValidationRequest {
  organization_id: string;
  worker_id: string;
  /** Optional: additional credential types required for this specific shift */
  required_credentials?: string[];
}

interface CredentialIssue {
  credential_type: string;
  credential_name: string;
  status: "missing" | "expired" | "pending" | "rejected";
  expiry_date?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: ValidationRequest = await req.json();
    const { organization_id, worker_id, required_credentials } = body;

    if (!organization_id || !worker_id) {
      return new Response(
        JSON.stringify({ error: "organization_id and worker_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create authenticated client
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    // Verify caller is authenticated
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role for cross-table queries
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check the organization's industry type
    const { data: org, error: orgError } = await adminClient
      .from("organizations")
      .select("industry_type")
      .eq("id", organization_id)
      .single();

    if (orgError || !org) {
      return new Response(
        JSON.stringify({ error: "Organization not found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── TRADES PASS-THROUGH ───────────────────────────────────────
    // For trades organizations, skip all credential checks
    if (org.industry_type !== "care") {
      return new Response(
        JSON.stringify({ valid: true, industry_type: org.industry_type, message: "No credential checks required for trades organizations." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── CARE SECTOR: CREDENTIAL VALIDATION ────────────────────────

    // Build the list of required credential types
    const requiredTypes = [
      ...MANDATORY_CREDENTIAL_TYPES,
      ...(required_credentials ?? []),
    ];
    // De-duplicate
    const uniqueRequired = [...new Set(requiredTypes)];

    // Fetch all credentials for this worker in this org
    const { data: credentials, error: credError } = await adminClient
      .from("worker_credentials")
      .select("credential_type, credential_name, expiry_date, verification_status")
      .eq("organization_id", organization_id)
      .eq("user_id", worker_id);

    if (credError) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch worker credentials" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const issues: CredentialIssue[] = [];
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

    for (const requiredType of uniqueRequired) {
      const cred = credentials?.find((c: any) => c.credential_type === requiredType);

      if (!cred) {
        // Missing credential entirely
        issues.push({
          credential_type: requiredType,
          credential_name: requiredType.replace(/_/g, " "),
          status: "missing",
        });
        continue;
      }

      // Check verification status
      if (cred.verification_status === "rejected") {
        issues.push({
          credential_type: requiredType,
          credential_name: cred.credential_name || requiredType.replace(/_/g, " "),
          status: "rejected",
          expiry_date: cred.expiry_date,
        });
        continue;
      }

      if (cred.verification_status === "expired") {
        issues.push({
          credential_type: requiredType,
          credential_name: cred.credential_name || requiredType.replace(/_/g, " "),
          status: "expired",
          expiry_date: cred.expiry_date,
        });
        continue;
      }

      // Check if expired by date (in case auto-expire cron hasn't run yet)
      if (cred.expiry_date && cred.expiry_date < today) {
        issues.push({
          credential_type: requiredType,
          credential_name: cred.credential_name || requiredType.replace(/_/g, " "),
          status: "expired",
          expiry_date: cred.expiry_date,
        });
        continue;
      }

      if (cred.verification_status === "pending") {
        issues.push({
          credential_type: requiredType,
          credential_name: cred.credential_name || requiredType.replace(/_/g, " "),
          status: "pending",
          expiry_date: cred.expiry_date,
        });
        continue;
      }

      // Credential is verified and not expired — valid ✓
    }

    if (issues.length > 0) {
      // ─── COMPLIANCE FAILURE: BLOCK SCHEDULING ───────────────────
      return new Response(
        JSON.stringify({
          valid: false,
          industry_type: "care",
          message: `Worker is missing ${issues.length} required credential(s). Cannot assign to shift.`,
          issues,
          worker_id,
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── ALL CLEAR ──────────────────────────────────────────────────
    return new Response(
      JSON.stringify({
        valid: true,
        industry_type: "care",
        message: "All required credentials verified.",
        credentials_checked: uniqueRequired.length,
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

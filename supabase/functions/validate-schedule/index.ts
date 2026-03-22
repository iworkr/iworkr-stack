/**
 * @module validate-schedule
 * @status COMPLETE
 * @auth SECURED — Validates JWT via Supabase auth
 * @description Scheduling hard gate — validates credentials, fatigue rules, qualifications, and overtime for care organizations
 * @dependencies Supabase
 * @lastAudit 2026-03-22
 */
/**
 * validate-schedule — Project Nightingale
 *
 * Edge Function: Scheduling Hard Gate
 *
 * Called before a schedule block is created/updated for "care" organizations.
 * Validates:
 *   1. Mandatory credentials (NDIS_SCREENING, WWCC, FIRST_AID)
 *   2. 10-hour fatigue rest rule (SCHADS compliance)
 *   3. Qualification match (worker qualifications vs participant requirements)
 *   4. Weekly hours / overtime warning
 *
 * For "trades" organizations, this function passes through immediately (no checks).
 *
 * Returns:
 *   200 — All checks passed (may include warnings)
 *   409 — Hard block (credentials or fatigue breach)
 *   400 — Invalid request
 *   401 — Unauthorized
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Mandatory credentials for care sector workers
const MANDATORY_CREDENTIAL_TYPES = [
  "NDIS_SCREENING",
  "WWCC",
  "FIRST_AID",
];

interface ValidationRequest {
  organization_id: string;
  worker_id: string;
  /** Proposed shift start (ISO string) — for fatigue & hours checks */
  shift_start?: string;
  /** Proposed shift end (ISO string) — for hours checks */
  shift_end?: string;
  /** Participant ID — for qualification matching */
  participant_id?: string;
  /** Additional credential types required for this shift */
  required_credentials?: string[];
  /** Additional qualifications required (from care plan) */
  required_qualifications?: string[];
}

interface ValidationIssue {
  type: "credential" | "fatigue" | "qualification" | "overtime";
  severity: "hard_block" | "warning";
  message: string;
  details?: Record<string, unknown>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: ValidationRequest = await req.json();
    const {
      organization_id,
      worker_id,
      shift_start,
      shift_end,
      participant_id,
      required_credentials,
      required_qualifications,
    } = body;

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
    if (org.industry_type !== "care") {
      return new Response(
        JSON.stringify({
          allowed: true,
          industry_type: org.industry_type,
          message: "No compliance checks required for trades organizations.",
          reasons: [],
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── CARE SECTOR: FULL VALIDATION ──────────────────────────────

    const reasons: ValidationIssue[] = [];
    const today = new Date().toISOString().split("T")[0];

    // ── 1. CREDENTIAL CHECK ────────────────────────────────────────
    const requiredTypes = [...new Set([...MANDATORY_CREDENTIAL_TYPES, ...(required_credentials ?? [])])];

    const { data: credentials } = await adminClient
      .from("worker_credentials")
      .select("credential_type, credential_name, expiry_date, verification_status")
      .eq("organization_id", organization_id)
      .eq("user_id", worker_id);

    for (const requiredType of requiredTypes) {
      const cred = credentials?.find((c: any) => c.credential_type === requiredType);

      if (!cred) {
        reasons.push({
          type: "credential",
          severity: "hard_block",
          message: `Missing credential: ${requiredType.replace(/_/g, " ")}`,
          details: { credential_type: requiredType, status: "missing" },
        });
        continue;
      }

      if (cred.verification_status === "rejected" || cred.verification_status === "expired") {
        reasons.push({
          type: "credential",
          severity: "hard_block",
          message: `${cred.credential_name || requiredType.replace(/_/g, " ")} is ${cred.verification_status}`,
          details: { credential_type: requiredType, status: cred.verification_status, expiry_date: cred.expiry_date },
        });
        continue;
      }

      if (cred.expiry_date && cred.expiry_date < today) {
        reasons.push({
          type: "credential",
          severity: "hard_block",
          message: `${cred.credential_name || requiredType.replace(/_/g, " ")} expired on ${cred.expiry_date}`,
          details: { credential_type: requiredType, status: "expired", expiry_date: cred.expiry_date },
        });
        continue;
      }

      if (cred.verification_status === "pending") {
        reasons.push({
          type: "credential",
          severity: "hard_block",
          message: `${cred.credential_name || requiredType.replace(/_/g, " ")} is pending verification`,
          details: { credential_type: requiredType, status: "pending" },
        });
      }
    }

    // ── 2. FATIGUE CHECK (10-hour rest rule) ──────────────────────
    if (shift_start) {
      const proposedStart = new Date(shift_start);

      // Get worker's most recent shift end before proposed start
      const { data: recentBlocks } = await adminClient
        .from("schedule_blocks")
        .select("end_time")
        .eq("organization_id", organization_id)
        .eq("technician_id", worker_id)
        .lt("end_time", shift_start)
        .neq("status", "cancelled")
        .order("end_time", { ascending: false })
        .limit(1);

      if (recentBlocks && recentBlocks.length > 0) {
        const lastEnd = new Date(recentBlocks[0].end_time);
        const gapHours = (proposedStart.getTime() - lastEnd.getTime()) / 3600000;

        // Get org fatigue gap setting (default 10h)
        let fatigueGap = 10;
        try {
          const { data: ruleVal } = await adminClient.rpc("get_award_rule", {
            p_organization_id: organization_id,
            p_rule_type: "fatigue_gap_hours",
          });
          if (ruleVal) fatigueGap = parseFloat(ruleVal);
        } catch { /* use default */ }

        if (gapHours < fatigueGap) {
          const earliestStart = new Date(lastEnd.getTime() + fatigueGap * 3600000);
          const earliestFormatted = earliestStart.toLocaleTimeString("en-AU", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          });

          reasons.push({
            type: "fatigue",
            severity: "hard_block",
            message: `SCHADS 10-Hour Rest Breach: Only ${gapHours.toFixed(1)}h gap. Earliest start: ${earliestFormatted}`,
            details: {
              gap_hours: Math.round(gapHours * 10) / 10,
              minimum_required: fatigueGap,
              last_shift_end: recentBlocks[0].end_time,
              earliest_allowed_start: earliestStart.toISOString(),
            },
          });
        }
      }
    }

    // ── 3. QUALIFICATION CHECK ───────────────────────────────────
    if (required_qualifications && required_qualifications.length > 0) {
      const { data: staffProfile } = await adminClient
        .from("staff_profiles")
        .select("qualifications")
        .eq("user_id", worker_id)
        .eq("organization_id", organization_id)
        .maybeSingle();

      const workerQuals = new Set(staffProfile?.qualifications || []);

      for (const reqQual of required_qualifications) {
        if (!workerQuals.has(reqQual)) {
          reasons.push({
            type: "qualification",
            severity: "hard_block",
            message: `Missing required qualification: ${reqQual.replace(/_/g, " ")}`,
            details: { qualification: reqQual },
          });
        }
      }
    }

    // ── 4. WEEKLY HOURS / OVERTIME CHECK ─────────────────────────
    if (shift_start && shift_end) {
      const shiftStart = new Date(shift_start);
      const shiftEnd = new Date(shift_end);
      const shiftHours = (shiftEnd.getTime() - shiftStart.getTime()) / 3600000;

      // Get week boundaries (Monday start)
      const day = shiftStart.getDay();
      const weekStart = new Date(shiftStart);
      weekStart.setDate(weekStart.getDate() - day + (day === 0 ? -6 : 1));
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const { data: weekBlocks } = await adminClient
        .from("schedule_blocks")
        .select("start_time, end_time")
        .eq("organization_id", organization_id)
        .eq("technician_id", worker_id)
        .gte("start_time", weekStart.toISOString())
        .lt("end_time", weekEnd.toISOString())
        .neq("status", "cancelled");

      const currentWeeklyHours = (weekBlocks || []).reduce((sum: number, b: any) => {
        return sum + (new Date(b.end_time).getTime() - new Date(b.start_time).getTime()) / 3600000;
      }, 0);

      const projectedTotal = currentWeeklyHours + shiftHours;

      // Get max weekly hours from staff profile
      let maxHours = 38;
      const { data: sp } = await adminClient
        .from("staff_profiles")
        .select("max_weekly_hours")
        .eq("user_id", worker_id)
        .eq("organization_id", organization_id)
        .maybeSingle();
      if (sp?.max_weekly_hours) maxHours = sp.max_weekly_hours;

      if (projectedTotal > maxHours) {
        reasons.push({
          type: "overtime",
          severity: "warning",
          message: `Overtime risk: ${projectedTotal.toFixed(1)}h projected (max ${maxHours}h). Overtime rates may apply.`,
          details: {
            current_weekly_hours: Math.round(currentWeeklyHours * 10) / 10,
            shift_hours: Math.round(shiftHours * 10) / 10,
            projected_total: Math.round(projectedTotal * 10) / 10,
            max_weekly_hours: maxHours,
          },
        });
      } else if (projectedTotal >= maxHours * 0.9) {
        reasons.push({
          type: "overtime",
          severity: "warning",
          message: `Approaching limit: ${projectedTotal.toFixed(1)}/${maxHours}h this week`,
          details: {
            current_weekly_hours: Math.round(currentWeeklyHours * 10) / 10,
            projected_total: Math.round(projectedTotal * 10) / 10,
            max_weekly_hours: maxHours,
          },
        });
      }
    }

    // ── RESPONSE ─────────────────────────────────────────────────
    const hardBlocks = reasons.filter(r => r.severity === "hard_block");
    const warnings = reasons.filter(r => r.severity === "warning");
    const allowed = hardBlocks.length === 0;

    return new Response(
      JSON.stringify({
        allowed,
        industry_type: "care",
        message: allowed
          ? (warnings.length > 0 ? `Passed with ${warnings.length} warning(s)` : "All compliance checks passed.")
          : `Blocked: ${hardBlocks.length} compliance issue(s)`,
        reasons,
        hard_blocks: hardBlocks.length,
        warnings: warnings.length,
        credentials_checked: requiredTypes.length,
      }),
      {
        status: allowed ? 200 : 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal server error", details: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

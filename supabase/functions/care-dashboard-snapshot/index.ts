/**
 * @module care-dashboard-snapshot
 * @status COMPLETE
 * @auth SECURED — Auth guard via supabase.auth.getUser()
 * @description Aggregated care dashboard: parallel queries for participants, shifts, incidents, sentinel alerts, credentials, budget, claims, care plans, clinical observations
 * @dependencies Supabase (Auth, DB)
 * @lastAudit 2026-03-22
 */
// ═══════════════════════════════════════════════════════════════════════════════
// care-dashboard-snapshot — Aggregated care metrics in one call
// Project Nightingale: Powers the Participant Command Center
// ═══════════════════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders as _baseCorsHeaders } from "../_shared/cors.ts";

const corsHeaders = {
  ..._baseCorsHeaders,
  "Access-Control-Allow-Headers": _baseCorsHeaders["Access-Control-Allow-Headers"] + ", x-active-workspace-id",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "No auth" }), { status: 401, headers: corsHeaders });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    // Get organization ID from membership
    const { data: membership } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1)
      .single();

    if (!membership) return new Response(JSON.stringify({ error: "No org" }), { status: 403, headers: corsHeaders });
    const orgId = membership.organization_id;

    // Run all queries in parallel for speed
    const [
      participantRes,
      activeShiftsRes,
      incidentsRes,
      sentinelRes,
      credentialsRes,
      budgetRes,
      claimsRes,
      plansRes,
      recentObsRes,
      recentMARRes,
      recentNotesRes,
    ] = await Promise.all([
      // Total active participants
      supabase.from("participant_profiles").select("id", { count: "exact", head: true }).eq("organization_id", orgId).eq("status", "active"),
      // Today's shifts
      supabase.from("jobs").select("id, status, scheduled_start, scheduled_end", { count: "exact" }).eq("organization_id", orgId).gte("scheduled_start", new Date().toISOString().split("T")[0]).lte("scheduled_start", new Date().toISOString().split("T")[0] + "T23:59:59"),
      // Open incidents
      supabase.from("incidents").select("id, severity, status", { count: "exact" }).eq("organization_id", orgId).in("status", ["reported", "under_review", "investigation"]),
      // Active sentinel alerts
      supabase.from("sentinel_alerts").select("id, severity, alert_type, status, created_at").eq("organization_id", orgId).eq("status", "active").order("created_at", { ascending: false }).limit(10),
      // Expiring credentials (next 30 days)
      supabase.from("worker_credentials").select("id, credential_type, expires_at, verification_status").eq("organization_id", orgId).lte("expires_at", new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()).gte("expires_at", new Date().toISOString()),
      // Budget summary
      supabase.from("budget_allocations").select("category, total_budget, consumed_budget, quarantined_budget").eq("organization_id", orgId),
      // Claim stats
      supabase.from("claim_line_items").select("status, total_amount").eq("organization_id", orgId),
      // Active care plans
      supabase.from("care_plans").select("id, status, next_review_date", { count: "exact" }).eq("organization_id", orgId).eq("status", "active"),
      // Recent observations (last 24h)
      supabase.from("health_observations").select("id, observation_type, is_abnormal, recorded_at").eq("organization_id", orgId).gte("recorded_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()).order("recorded_at", { ascending: false }).limit(20),
      // Recent MAR entries (last 24h)
      supabase.from("medication_administration_records").select("id, outcome, administered_at").eq("organization_id", orgId).gte("administered_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
      // Recent progress notes (last 7 days)
      supabase.from("progress_notes").select("id, participant_mood, created_at").eq("organization_id", orgId).gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
    ]);

    // Compute budget totals
    const budgetAllocations = budgetRes.data || [];
    const budgetTotals = budgetAllocations.reduce((acc: any, a: any) => {
      acc.total += Number(a.total_budget) || 0;
      acc.consumed += Number(a.consumed_budget) || 0;
      acc.quarantined += Number(a.quarantined_budget) || 0;
      return acc;
    }, { total: 0, consumed: 0, quarantined: 0 });

    // Compute claim totals
    const claimLines = claimsRes.data || [];
    const claimTotals = claimLines.reduce((acc: any, c: any) => {
      acc[c.status] = (acc[c.status] || 0) + Number(c.total_amount);
      acc.count = (acc.count || 0) + 1;
      return acc;
    }, {});

    // Compute sentinel severity breakdown
    const sentinelAlerts = sentinelRes.data || [];
    const sentinelBreakdown = {
      critical: sentinelAlerts.filter((a: any) => a.severity === "critical").length,
      warning: sentinelAlerts.filter((a: any) => a.severity === "warning").length,
      info: sentinelAlerts.filter((a: any) => a.severity === "info").length,
      total: sentinelAlerts.length,
      recent: sentinelAlerts.slice(0, 5),
    };

    // Compute incident severity breakdown
    const incidents = incidentsRes.data || [];
    const incidentBreakdown = {
      critical: incidents.filter((i: any) => i.severity === "critical").length,
      high: incidents.filter((i: any) => i.severity === "high").length,
      total: incidentsRes.count || 0,
    };

    // MAR compliance rate (last 24h)
    const marEntries = recentMARRes.data || [];
    const marGiven = marEntries.filter((m: any) => m.outcome === "given" || m.outcome === "self_administered" || m.outcome === "prn_given").length;
    const marCompliance = marEntries.length > 0 ? Math.round((marGiven / marEntries.length) * 100) : 100;

    // Abnormal observations
    const recentObs = recentObsRes.data || [];
    const abnormalCount = recentObs.filter((o: any) => o.is_abnormal).length;

    // Plans needing review (next 30 days)
    const activePlans = plansRes.data || [];
    const plansNeedingReview = activePlans.filter((p: any) => {
      if (!p.next_review_date) return false;
      const reviewDate = new Date(p.next_review_date);
      return reviewDate <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }).length;

    // Mood distribution (last 7 days)
    const recentNotes = recentNotesRes.data || [];
    const moodDist: Record<string, number> = {};
    for (const n of recentNotes) {
      if (n.participant_mood) moodDist[n.participant_mood] = (moodDist[n.participant_mood] || 0) + 1;
    }

    const snapshot = {
      timestamp: new Date().toISOString(),
      participants: { active: participantRes.count || 0 },
      shifts: {
        today: activeShiftsRes.count || 0,
        scheduled: (activeShiftsRes.data || []).filter((s: any) => s.status === "scheduled").length,
        in_progress: (activeShiftsRes.data || []).filter((s: any) => s.status === "in_progress" || s.status === "on_site").length,
        completed: (activeShiftsRes.data || []).filter((s: any) => s.status === "done" || s.status === "completed").length,
      },
      clinical: {
        observations_24h: recentObs.length,
        abnormal_observations: abnormalCount,
        mar_entries_24h: marEntries.length,
        mar_compliance_pct: marCompliance,
        mood_distribution: moodDist,
        progress_notes_7d: recentNotes.length,
      },
      incidents: incidentBreakdown,
      sentinel: sentinelBreakdown,
      credentials: {
        expiring_30d: (credentialsRes.data || []).length,
        expired: (credentialsRes.data || []).filter((c: any) => new Date(c.expires_at) < new Date()).length,
      },
      budget: {
        ...budgetTotals,
        available: budgetTotals.total - budgetTotals.consumed - budgetTotals.quarantined,
        utilization_pct: budgetTotals.total > 0 ? Math.round((budgetTotals.consumed / budgetTotals.total) * 100) : 0,
      },
      claims: {
        total_count: claimTotals.count || 0,
        total_paid: claimTotals.paid || 0,
        total_submitted: claimTotals.submitted || 0,
        total_rejected: claimTotals.rejected || 0,
      },
      care_plans: {
        active: plansRes.count || 0,
        needs_review: plansNeedingReview,
      },
    };

    return new Response(JSON.stringify(snapshot), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});

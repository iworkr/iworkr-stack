/**
 * @module sentinel-scan
 * @status COMPLETE
 * @auth UNSECURED — No user auth; triggered by database webhooks or scheduled cron
 * @description Project Nightingale Phase 4: Automated risk detection — keyword scanning in progress notes, health baseline deviation alerts, medication non-compliance tracking, and care plan review monitoring
 * @dependencies Supabase
 * @lastAudit 2026-03-22
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type TriggerType =
  | "progress_note"
  | "health_observation"
  | "medication_administration"
  | "scheduled_scan";

interface ScanRequest {
  trigger_type: TriggerType;
  record_id?: string;
  organization_id: string;
}

interface AlertPayload {
  organization_id: string;
  alert_type: string;
  severity: "info" | "warning" | "critical";
  title: string;
  description: string;
  participant_id?: string | null;
  worker_id?: string | null;
  shift_id?: string | null;
  source_table: string;
  source_id: string;
  triggered_keywords?: string[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: ScanRequest = await req.json();
    const { trigger_type, record_id, organization_id } = body;

    if (!organization_id || !trigger_type) {
      return new Response(
        JSON.stringify({ error: "organization_id and trigger_type are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const alerts: AlertPayload[] = [];

    // ─── 1. PROGRESS NOTE KEYWORD SCAN ─────────────────────────────
    if (trigger_type === "progress_note" && record_id) {
      const { data: note } = await adminClient
        .from("progress_notes")
        .select("*, participant_profiles!progress_notes_participant_id_fkey(id)")
        .eq("id", record_id)
        .single();

      if (note) {
        // Get keywords (system defaults + org-specific)
        const { data: keywords } = await adminClient
          .from("sentinel_keywords")
          .select("keyword, severity, category")
          .or(`is_system_default.eq.true,organization_id.eq.${organization_id}`);

        if (keywords?.length) {
          // Build searchable text from all note fields
          const searchText = [
            note.context_of_support,
            note.outcomes_achieved,
            note.risks_identified,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          // Find matching keywords
          const matchedKeywords = keywords.filter(
            (kw: { keyword: string }) =>
              searchText.includes(kw.keyword.toLowerCase())
          );

          if (matchedKeywords.length > 0) {
            // Check if an incident report exists for this shift
            let hasIncident = false;
            if (note.job_id) {
              const { count } = await adminClient
                .from("incidents")
                .select("*", { count: "exact", head: true })
                .eq("shift_id", note.job_id)
                .eq("organization_id", organization_id);
              hasIncident = (count || 0) > 0;
            }

            if (!hasIncident) {
              const keywordStrings = matchedKeywords.map(
                (kw: { keyword: string }) => kw.keyword
              );
              const maxSeverity = matchedKeywords.some(
                (kw: { severity: string }) => kw.severity === "critical"
              )
                ? "critical"
                : "warning";

              alerts.push({
                organization_id,
                alert_type: "progress_note_keywords",
                severity: maxSeverity as "warning" | "critical",
                title: `High-risk keywords detected in progress note`,
                description: `Keywords found: ${keywordStrings.join(", ")}. No incident report filed for this shift. Review required.`,
                participant_id: note.participant_id,
                worker_id: note.worker_id,
                shift_id: note.job_id,
                source_table: "progress_notes",
                source_id: note.id,
                triggered_keywords: keywordStrings,
              });
            }
          }
        }
      }
    }

    // ─── 2. HEALTH BASELINE DEVIATION ──────────────────────────────
    if (trigger_type === "health_observation" && record_id) {
      const { data: obs } = await adminClient
        .from("health_observations")
        .select("*")
        .eq("id", record_id)
        .single();

      if (obs && obs.is_abnormal) {
        // Check for 3+ abnormal readings in rolling 7 days
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const { count } = await adminClient
          .from("health_observations")
          .select("*", { count: "exact", head: true })
          .eq("participant_id", obs.participant_id)
          .eq("observation_type", obs.observation_type)
          .eq("is_abnormal", true)
          .gte("observed_at", sevenDaysAgo.toISOString());

        if ((count || 0) >= 3) {
          // Check if we already have an active alert for this pattern
          const { count: existingAlerts } = await adminClient
            .from("sentinel_alerts")
            .select("*", { count: "exact", head: true })
            .eq("organization_id", organization_id)
            .eq("alert_type", "health_baseline_deviation")
            .eq("participant_id", obs.participant_id)
            .eq("status", "active")
            .gte("created_at", sevenDaysAgo.toISOString());

          if (!existingAlerts || existingAlerts === 0) {
            const typeLabel = obs.observation_type.replace(/_/g, " ");
            alerts.push({
              organization_id,
              alert_type: "health_baseline_deviation",
              severity: "warning",
              title: `Abnormal ${typeLabel} pattern detected`,
              description: `${count} abnormal ${typeLabel} readings in the last 7 days for this participant. Clinical review recommended.`,
              participant_id: obs.participant_id,
              worker_id: obs.worker_id,
              shift_id: obs.shift_id,
              source_table: "health_observations",
              source_id: obs.id,
            });
          }
        }
      }
    }

    // ─── 3. MEDICATION NON-COMPLIANCE ─────────────────────────────
    if (trigger_type === "medication_administration" && record_id) {
      const { data: mar } = await adminClient
        .from("medication_administration_records")
        .select("*")
        .eq("id", record_id)
        .single();

      if (mar && (mar.outcome === "refused" || mar.outcome === "absent")) {
        // Check last 3 consecutive scheduled doses for this medication
        const { data: recentMARs } = await adminClient
          .from("medication_administration_records")
          .select("outcome")
          .eq("medication_id", mar.medication_id)
          .eq("participant_id", mar.participant_id)
          .order("administered_at", { ascending: false })
          .limit(3);

        if (recentMARs && recentMARs.length >= 3) {
          const allNonCompliant = recentMARs.every(
            (r: { outcome: string }) =>
              r.outcome === "refused" || r.outcome === "absent"
          );

          if (allNonCompliant) {
            // Get medication name
            const { data: med } = await adminClient
              .from("participant_medications")
              .select("medication_name")
              .eq("id", mar.medication_id)
              .single();

            const medName = med?.medication_name || "Unknown medication";

            alerts.push({
              organization_id,
              alert_type: "medication_non_compliance",
              severity: "warning",
              title: `Medication non-compliance: ${medName}`,
              description: `3 consecutive doses of ${medName} have been ${mar.outcome}. Medication review required.`,
              participant_id: mar.participant_id,
              source_table: "medication_administration_records",
              source_id: mar.id,
            });
          }
        }
      }
    }

    // ─── 4. SCHEDULED SCAN: CARE PLAN REVIEWS ─────────────────────
    if (trigger_type === "scheduled_scan") {
      // Find care plans with overdue or upcoming reviews
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      const { data: duePlans } = await adminClient
        .from("care_plans")
        .select("id, participant_id, title, next_review_date")
        .eq("organization_id", organization_id)
        .eq("status", "active")
        .lte("next_review_date", thirtyDaysFromNow.toISOString().split("T")[0]);

      if (duePlans) {
        for (const plan of duePlans) {
          // Check if alert already exists
          const { count: existing } = await adminClient
            .from("sentinel_alerts")
            .select("*", { count: "exact", head: true })
            .eq("source_id", plan.id)
            .eq("alert_type", "care_plan_review_due")
            .eq("status", "active");

          if (!existing || existing === 0) {
            const isOverdue = new Date(plan.next_review_date) < new Date();
            alerts.push({
              organization_id,
              alert_type: "care_plan_review_due",
              severity: isOverdue ? "warning" : "info",
              title: `Care plan review ${isOverdue ? "overdue" : "due soon"}: ${plan.title}`,
              description: `Review date: ${plan.next_review_date}. ${isOverdue ? "This review is overdue and must be completed immediately." : "This review is due within 30 days."}`,
              participant_id: plan.participant_id,
              source_table: "care_plans",
              source_id: plan.id,
            });
          }
        }
      }
    }

    // ─── INSERT ALERTS ────────────────────────────────────────────
    if (alerts.length > 0) {
      const { error: insertError } = await adminClient
        .from("sentinel_alerts")
        .insert(alerts);

      if (insertError) {
        console.error("Failed to insert sentinel alerts:", insertError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        trigger_type,
        alerts_created: alerts.length,
        alerts: alerts.map((a) => ({
          type: a.alert_type,
          severity: a.severity,
          title: a.title,
        })),
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

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ═══════════════════════════════════════════════════════════════
// Project Aegis — SIRS Triage Router
// ═══════════════════════════════════════════════════════════════
// Triggered on incident creation (via database webhook or direct call).
// Classifies SIRS priority, calculates SLA deadline, and updates
// the incident record. Fires escalation alerts for reportable incidents.

interface IncidentRecord {
  id: string;
  organization_id: string;
  category: string;
  severity: string;
  is_emergency_services_involved: boolean;
  is_reportable: boolean;
  occurred_at: string;
  reported_at: string;
  incident_payload: Record<string, unknown>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();

    // Support both webhook payload (record) and direct invocation
    const incident: IncidentRecord = body.record ?? body;

    if (!incident.id) {
      return new Response(
        JSON.stringify({ error: "No incident record provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const payload = incident.incident_payload ?? {};

    // ── SIRS Priority Classification Engine ─────────────────
    let sirsPriority = "internal_only";
    let hoursToAdd = 0;

    // Priority 1 triggers (24-hour SLA)
    const isP1 =
      incident.is_emergency_services_involved === true ||
      payload.requires_hospitalization === true ||
      payload.is_unlawful_contact === true ||
      payload.is_sexual_misconduct === true ||
      payload.is_unexplained_absence === true ||
      payload.is_death === true ||
      incident.category === "abuse_allegation" ||
      (incident.severity === "critical" && incident.is_reportable === true);

    // Priority 2 triggers (5-day / 120-hour SLA)
    const isP2 =
      !isP1 &&
      (payload.is_unauthorized_restrictive_practice === true ||
        (incident.category === "restrictive_practice" &&
          incident.severity !== "low") ||
        (incident.is_reportable === true && incident.severity === "high"));

    if (isP1) {
      sirsPriority = "priority_1";
      hoursToAdd = 24;
    } else if (isP2) {
      sirsPriority = "priority_2";
      hoursToAdd = 120;
    }

    // ── Calculate SLA Deadline ───────────────────────────────
    let slaDeadline: string | null = null;
    if (sirsPriority !== "internal_only") {
      // SLA clock starts from reported_at (when provider became aware)
      const reportedAt = new Date(incident.reported_at || new Date().toISOString());
      reportedAt.setHours(reportedAt.getHours() + hoursToAdd);
      slaDeadline = reportedAt.toISOString();
    }

    // ── Update the incident record ──────────────────────────
    const { error: updateError } = await supabase
      .from("incidents")
      .update({
        sirs_priority: sirsPriority,
        sirs_sla_deadline: slaDeadline,
        updated_at: new Date().toISOString(),
      })
      .eq("id", incident.id);

    if (updateError) {
      console.error("Failed to update incident:", updateError);
      return new Response(
        JSON.stringify({ error: updateError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Detect late reporting (>6 hour gap) ──────────────────
    let lateReportingWarning = false;
    if (incident.occurred_at && incident.reported_at) {
      const occurred = new Date(incident.occurred_at);
      const reported = new Date(incident.reported_at);
      const gapHours =
        (reported.getTime() - occurred.getTime()) / (1000 * 60 * 60);
      if (gapHours > 6) {
        lateReportingWarning = true;
      }
    }

    // ── Create Sentinel Alert for Priority 1 incidents ──────
    if (sirsPriority === "priority_1") {
      try {
        await supabase.from("sentinel_alerts").insert({
          organization_id: incident.organization_id,
          alert_type: "sirs_priority_1",
          severity: "critical",
          title: `SIRS Priority 1: ${incident.category} incident requires NDIS notification within 24 hours`,
          description: `Incident ${incident.id} has been classified as Priority 1. SLA deadline: ${slaDeadline}`,
          source_table: "incidents",
          source_id: incident.id,
          status: "active",
        });
      } catch (alertErr) {
        console.error("Failed to create sentinel alert:", alertErr);
        // Non-fatal — don't block the triage
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        incident_id: incident.id,
        sirs_priority: sirsPriority,
        sirs_sla_deadline: slaDeadline,
        late_reporting_warning: lateReportingWarning,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Aegis triage error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

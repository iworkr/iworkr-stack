/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/* ── Helpers ──────────────────────────────────────────────── */
async function assertOrgMember(orgId: string) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const { data: membership } = await (supabase as any)
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (!membership) throw new Error("Not a member of this organization");
  return { supabase, user, role: membership.role };
}

/* ══════════════════════════════════════════════════════════════
   SIRS TRIAGE DASHBOARD — Server Actions
   ══════════════════════════════════════════════════════════════ */

/** Fetches aggregated triage telemetry via the get_sirs_triage_data RPC */
export async function getSirsTriageData(orgId: string) {
  try {
    const { supabase } = await assertOrgMember(orgId);
    const { data, error } = await supabase.rpc("get_sirs_triage_data" as any, {
      p_org_id: orgId,
    });
    if (error) throw error;
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/** Fetches all SIRS-reportable incidents with their submission records */
export async function getSirsIncidents(orgId: string) {
  try {
    const { supabase } = await assertOrgMember(orgId);
    const { data, error } = await (supabase as any)
      .from("incident_reports")
      .select("*, sirs_submissions(*)")
      .eq("organization_id", orgId)
      .eq("is_sirs_reportable", true)
      .order("statutory_deadline", { ascending: true });
    if (error) throw error;
    return { data: data || [], error: null };
  } catch (err: any) {
    return { data: [], error: err.message };
  }
}

/** Fetches a single SIRS submission by incident ID */
export async function getSirsSubmission(orgId: string, incidentId: string) {
  try {
    const { supabase } = await assertOrgMember(orgId);
    const { data, error } = await (supabase as any)
      .from("sirs_submissions")
      .select("*")
      .eq("organization_id", orgId)
      .eq("incident_id", incidentId)
      .maybeSingle();
    if (error) throw error;
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/** Runs AI sanitization on raw worker notes */
export async function runAiSanitization(orgId: string, submissionId: string) {
  try {
    const { supabase } = await assertOrgMember(orgId);

    // Fetch raw notes
    const { data: sub, error: fetchErr } = await (supabase as any)
      .from("sirs_submissions")
      .select("raw_worker_notes")
      .eq("id", submissionId)
      .eq("organization_id", orgId)
      .single();
    if (fetchErr) throw fetchErr;

    // Call OpenAI via edge function or direct API
    const sanitized = await sanitizeNotesWithAI(sub.raw_worker_notes);

    // Update submission
    const { data, error } = await (supabase as any)
      .from("sirs_submissions")
      .update({
        ai_sanitized_draft: sanitized,
        sanitization_model: "gpt-4o",
        sanitization_prompt_version: "v1.0",
        sanitization_ran_at: new Date().toISOString(),
        status: "IN_SANITIZATION",
        updated_at: new Date().toISOString(),
      })
      .eq("id", submissionId)
      .eq("organization_id", orgId)
      .select()
      .single();
    if (error) throw error;

    revalidatePath("/dashboard/clinical/sirs-triage");
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/** Approve final sanitized notes */
export async function approveSanitizedNotes(
  orgId: string,
  submissionId: string,
  finalNotes: string
) {
  try {
    const { supabase, user } = await assertOrgMember(orgId);
    const { data, error } = await (supabase as any)
      .from("sirs_submissions")
      .update({
        final_commission_notes: finalNotes,
        compliance_officer_id: user.id,
        status: "READY_FOR_EXPORT",
        updated_at: new Date().toISOString(),
      })
      .eq("id", submissionId)
      .eq("organization_id", orgId)
      .select()
      .single();
    if (error) throw error;

    revalidatePath("/dashboard/clinical/sirs-triage");
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/** Update statutory submission fields */
export async function updateSubmissionFields(
  orgId: string,
  submissionId: string,
  fields: {
    police_notified?: boolean;
    police_reference_number?: string;
    family_notified?: boolean;
    family_notification_details?: string;
    immediate_actions_taken?: string;
    participant_ndis_number?: string;
    participant_name?: string;
    worker_name?: string;
    worker_role?: string;
  }
) {
  try {
    const { supabase } = await assertOrgMember(orgId);
    const { data, error } = await (supabase as any)
      .from("sirs_submissions")
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq("id", submissionId)
      .eq("organization_id", orgId)
      .select()
      .single();
    if (error) throw error;

    revalidatePath("/dashboard/clinical/sirs-triage");
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/** Generate the SIRS export JSON payload */
export async function generateExportPayload(
  orgId: string,
  submissionId: string
) {
  try {
    const { supabase } = await assertOrgMember(orgId);

    // Fetch complete submission + incident
    const { data: sub, error: fetchErr } = await (supabase as any)
      .from("sirs_submissions")
      .select("*, incident_reports(*)")
      .eq("id", submissionId)
      .eq("organization_id", orgId)
      .single();
    if (fetchErr) throw fetchErr;

    const incident = sub.incident_reports;

    const payload = {
      schema_version: "1.0.0",
      generated_at: new Date().toISOString(),
      incident: {
        id: incident.id,
        title: incident.title,
        category: incident.category,
        severity: incident.severity,
        sirs_priority: incident.sirs_priority,
        statutory_deadline: incident.statutory_deadline,
        location: incident.location,
        occurred_at: sub.incident_datetime,
        reported_at: sub.reported_datetime,
      },
      participant: {
        name: sub.participant_name,
        ndis_number: sub.participant_ndis_number,
        dob: sub.participant_dob,
      },
      worker: {
        name: sub.worker_name,
        role: sub.worker_role,
      },
      notes: {
        final_commission_notes: sub.final_commission_notes,
        immediate_actions_taken: sub.immediate_actions_taken,
      },
      notifications: {
        police_notified: sub.police_notified,
        police_reference_number: sub.police_reference_number,
        family_notified: sub.family_notified,
        family_notification_details: sub.family_notification_details,
      },
    };

    // Save to submission record
    const { data, error } = await (supabase as any)
      .from("sirs_submissions")
      .update({
        export_json: payload,
        updated_at: new Date().toISOString(),
      })
      .eq("id", submissionId)
      .eq("organization_id", orgId)
      .select()
      .single();
    if (error) throw error;

    revalidatePath("/dashboard/clinical/sirs-triage");
    return { data: payload, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/** Mark as submitted to NDIS Quality & Safeguards Commission */
export async function markSubmittedToCommission(
  orgId: string,
  submissionId: string,
  ndisReference: string
) {
  try {
    const { supabase } = await assertOrgMember(orgId);
    const { data, error } = await (supabase as any)
      .from("sirs_submissions")
      .update({
        status: "SUBMITTED_TO_COMMISSION",
        ndis_sirs_reference: ndisReference,
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", submissionId)
      .eq("organization_id", orgId)
      .select()
      .single();
    if (error) throw error;

    revalidatePath("/dashboard/clinical/sirs-triage");
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/** Acknowledge commission receipt */
export async function acknowledgeCommission(
  orgId: string,
  submissionId: string
) {
  try {
    const { supabase } = await assertOrgMember(orgId);
    const { data, error } = await (supabase as any)
      .from("sirs_submissions")
      .update({
        status: "COMMISSION_ACKNOWLEDGED",
        acknowledged_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", submissionId)
      .eq("organization_id", orgId)
      .select()
      .single();
    if (error) throw error;

    revalidatePath("/dashboard/clinical/sirs-triage");
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/** Create a new incident report (also triggers SIRS auto-creation) */
export async function createIncidentReport(
  orgId: string,
  input: {
    title: string;
    description: string;
    severity: string;
    category: string;
    location?: string;
    participant_id?: string;
    injuries_observed?: string;
  }
) {
  try {
    const { supabase, user } = await assertOrgMember(orgId);
    const { data, error } = await (supabase as any)
      .from("incident_reports")
      .insert({
        organization_id: orgId,
        reported_by: user.id,
        title: input.title,
        description: input.description,
        severity: input.severity.toLowerCase(),
        category: input.category.toLowerCase(),
        location: input.location || null,
        participant_id: input.participant_id || null,
        injuries_observed: input.injuries_observed || null,
        device_timestamp: new Date().toISOString(),
      })
      .select("*, sirs_submissions(*)")
      .single();
    if (error) throw error;

    revalidatePath("/dashboard/clinical/sirs-triage");
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/* ── AI Sanitization Helper (internal) ────────────────────── */
async function sanitizeNotesWithAI(rawNotes: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    // Fallback: return a cleaned-up version without AI
    return rawNotes
      .replace(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/g, "[PARTICIPANT]")
      .replace(/\b\d{3,}\b/g, "[REDACTED]");
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content: `You are a NDIS SIRS compliance assistant. Sanitize the following worker field notes for submission to the NDIS Quality & Safeguards Commission.

Rules:
1. Remove subjective opinions and emotional language
2. Replace participant names with "[PARTICIPANT]" unless clearly needed
3. Remove worker personal opinions about management or colleagues
4. Keep factual observations, times, actions taken
5. Maintain clinical/professional tone
6. Preserve all safety-critical information
7. Flag any potential mandatory reporting obligations
8. Return ONLY the sanitized text, no preamble`,
          },
          { role: "user", content: rawNotes },
        ],
      }),
    });

    const result = await response.json();
    return result.choices?.[0]?.message?.content || rawNotes;
  } catch {
    return rawNotes;
  }
}

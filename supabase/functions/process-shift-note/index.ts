/**
 * @module process-shift-note
 * @status COMPLETE
 * @auth SECURED — Hyperion-Vanguard S-03 Aegis Auth Gate
 * @description Processes shift note submissions with template resolution, family-visible data projection, signature handling, and Glasshouse progress note publishing
 * @dependencies Supabase
 * @lastAudit 2026-03-22
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

type ShiftNotePayload = {
  submission_id?: string;
  shift_id: string;
  organization_id: string;
  participant_id?: string | null;
  worker_id: string;
  template_id?: string | null;
  template_version?: number;
  submission_data: Record<string, unknown>;
  worker_signature_token?: string | null;
  participant_signature_url?: string | null;
  participant_signature_base64?: string | null;
  participant_signature_exemption_reason?: "asleep" | "physical_incapacity" | "refusal_agitation" | null;
  participant_signature_exemption_notes?: string | null;
  worker_declared: boolean;
  evv_clock_out_location?: { lat: number; lng: number; accuracy?: number } | null;
};

function sanitizeFamilyProjection(
  templateSchema: any,
  submissionData: Record<string, unknown>,
): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  const fields = Array.isArray(templateSchema?.fields) ? templateSchema.fields : [];
  for (const field of fields) {
    if (!field || typeof field !== "object") continue;
    if (field.family_visible !== true) continue;
    const fieldId = String(field.id ?? "");
    if (!fieldId) continue;
    safe[fieldId] = submissionData[fieldId] ?? null;
  }
  return safe;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // ── Hyperion-Vanguard S-03: Aegis Auth Gate ──────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Missing authorization" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const supabaseAuth = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user: authUser }, error: authError } = await supabaseAuth.auth.getUser();
  if (authError || !authUser) {
    return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const payload = (await req.json()) as ShiftNotePayload;
    if (!payload.organization_id || !payload.shift_id || !payload.worker_id) {
      return new Response(JSON.stringify({ error: "organization_id, shift_id and worker_id are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!payload.worker_declared) {
      return new Response(JSON.stringify({ error: "worker_declared must be true before finalization" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Resolve template from shift if omitted by client.
    let templateId = payload.template_id ?? null;
    let templateVersion = payload.template_version ?? 1;
    if (!templateId) {
      const { data: shift } = await supabase
        .from("schedule_blocks")
        .select("required_shift_note_template_id, required_shift_note_template_version, participant_id")
        .eq("id", payload.shift_id)
        .single();
      templateId = shift?.required_shift_note_template_id ?? null;
      templateVersion = shift?.required_shift_note_template_version ?? 1;
    }

    let templateSchema: any = null;
    if (templateId) {
      const { data: template } = await supabase
        .from("shift_note_templates")
        .select("schema_payload, version")
        .eq("id", templateId)
        .maybeSingle();
      templateSchema = template?.schema_payload ?? null;
      templateVersion = template?.version ?? templateVersion;
    }

    const familyVisibleData = sanitizeFamilyProjection(templateSchema, payload.submission_data || {});
    const needsReview =
      Boolean(payload.participant_signature_exemption_reason) ||
      Boolean((payload.submission_data as any)?.bgl_warning === true);

    const upsertPayload = {
      id: payload.submission_id ?? undefined,
      organization_id: payload.organization_id,
      shift_id: payload.shift_id,
      worker_id: payload.worker_id,
      participant_id: payload.participant_id ?? null,
      template_id: templateId,
      template_version: templateVersion,
      submission_data: payload.submission_data || {},
      family_visible_data: familyVisibleData,
      worker_signature_token: payload.worker_signature_token ?? null,
      participant_signature_url: payload.participant_signature_url ?? null,
      participant_signature_base64: payload.participant_signature_base64 ?? null,
      participant_signature_exemption_reason: payload.participant_signature_exemption_reason ?? null,
      participant_signature_exemption_notes: payload.participant_signature_exemption_notes ?? null,
      participant_signed_at: payload.participant_signature_base64 ? new Date().toISOString() : null,
      worker_declared: true,
      evv_clock_out_location: payload.evv_clock_out_location ?? null,
      status: needsReview ? "review_required" : "submitted",
      flags: needsReview ? { requires_review: true } : {},
      updated_at: new Date().toISOString(),
    };

    const { data: submission, error: submissionError } = await supabase
      .from("shift_note_submissions")
      .upsert(upsertPayload, { onConflict: "shift_id" })
      .select("*")
      .single();

    if (submissionError) {
      return new Response(JSON.stringify({ error: submissionError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Publish family-safe note into Glasshouse-friendly progress notes when available.
    if (submission.participant_id) {
      const familySummary = Object.entries(familyVisibleData)
        .map(([key, value]) => `- ${key}: ${String(value ?? "")}`)
        .join("\n");

      if (familySummary.trim().length > 0) {
        await supabase.from("progress_notes").insert({
          organization_id: payload.organization_id,
          participant_id: submission.participant_id,
          job_id: payload.shift_id,
          worker_id: payload.worker_id,
          note_type: "shift_summary",
          summary: "Rosetta shift note submitted",
          internal_narrative: JSON.stringify(payload.submission_data || {}, null, 2),
          family_facing_narrative: familySummary,
          is_published_to_portal: true,
          family_note_approval_status: needsReview ? "pending" : "approved",
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        submission_id: submission.id,
        status: submission.status,
        family_visible_fields: Object.keys(familyVisibleData).length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

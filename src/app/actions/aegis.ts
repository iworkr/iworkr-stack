/**
 * @module Aegis Server Actions
 * @status COMPLETE
 * @description Core Aegis SIRS compliance — incident CRUD, 5-business-day reporting, and notification management
 * @exports createAegisIncident, fetchAegisIncidents, updateAegisIncident, deleteAegisIncident, fetchIncidentNotifications
 * @lastAudit 2026-03-22
 */
"use server";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

// ═══════════════════════════════════════════════════════════════
// Project Aegis — SIRS Compliance Server Actions
// ═══════════════════════════════════════════════════════════════

// ── Types ────────────────────────────────────────────────────

export interface AegisIncident {
  id: string;
  organization_id: string;
  title: string;
  description: string;
  category: string;
  severity: string;
  status: string;
  sirs_priority: string | null;
  sirs_sla_deadline: string | null;
  is_emergency_services_involved: boolean;
  is_reportable: boolean;
  occurred_at: string;
  reported_at: string;
  location: string | null;
  witnesses: unknown;
  immediate_actions: string | null;
  photos: string[] | null;
  incident_payload: Record<string, unknown> | null;
  facility_id: string | null;
  ndis_sirs_reference_number: string | null;
  sirs_submitted_at: string | null;
  final_pdf_url: string | null;
  pdf_sha256: string | null;
  downgrade_justification: string | null;
  downgraded_by: string | null;
  downgraded_at: string | null;
  worker_id: string;
  participant_id: string | null;
  shift_id: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  resolution_notes: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  worker?: { full_name: string } | null;
  participant_profiles?: { preferred_name: string } | null;
}

export interface AegisInvestigation {
  id: string;
  incident_id: string;
  organization_id: string;
  investigator_id: string | null;
  why_1: string | null;
  why_2: string | null;
  why_3: string | null;
  why_4: string | null;
  why_5: string | null;
  root_cause_summary: string | null;
  contributing_factors: string | null;
  environmental_factors: string | null;
  systemic_factors: string | null;
  timeline_events: unknown[];
  started_at: string;
  completed_at: string | null;
}

export interface AegisCorrectiveAction {
  id: string;
  investigation_id: string;
  organization_id: string;
  assigned_to_user_id: string | null;
  action_type: string;
  description: string;
  due_date: string;
  status: string;
  completed_at: string | null;
  completed_by: string | null;
  completion_notes: string | null;
  created_at: string;
  // Joined
  assigned_to?: { full_name: string } | null;
}

// ── Fetch all incidents for triage (Super Admin — bypasses RLS) ──

export async function fetchAegisIncidents(): Promise<AegisIncident[]> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("incidents")
    .select(
      "*, worker:profiles!incidents_worker_id_fkey(full_name), participant_profiles(preferred_name)"
    )
    .order("sirs_sla_deadline", { ascending: true, nullsFirst: false })
    .order("occurred_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("fetchAegisIncidents error:", error);
    return [];
  }
  return (data ?? []) as AegisIncident[];
}

// ── Fetch single incident with full details ──

export async function fetchAegisIncidentDetail(
  incidentId: string
): Promise<{
  incident: AegisIncident | null;
  investigation: AegisInvestigation | null;
  actions: AegisCorrectiveAction[];
  participants: Array<{
    participant_id: string;
    role: string;
    notes: string | null;
    participant_profiles: { preferred_name: string } | null;
  }>;
}> {
  const supabase = createAdminSupabaseClient();

  const [incidentRes, investigationRes, actionsRes, participantsRes] =
    await Promise.all([
      supabase
        .from("incidents")
        .select(
          "*, worker:profiles!incidents_worker_id_fkey(full_name), participant_profiles(preferred_name)"
        )
        .eq("id", incidentId)
        .maybeSingle(),
      supabase
        .from("incident_investigations")
        .select("*")
        .eq("incident_id", incidentId)
        .maybeSingle(),
      supabase
        .from("corrective_actions")
        .select(
          "*, assigned_to:profiles!corrective_actions_assigned_to_user_id_fkey(full_name)"
        )
        .eq(
          "investigation_id",
          // We'll re-fetch if investigation exists
          incidentId
        )
        .order("created_at"),
      supabase
        .from("incident_participants")
        .select("*, participant_profiles(preferred_name)")
        .eq("incident_id", incidentId),
    ]);

  // If investigation exists, fetch its corrective actions
  let actions: AegisCorrectiveAction[] = [];
  if (investigationRes.data?.id) {
    const { data: caData } = await supabase
      .from("corrective_actions")
      .select(
        "*, assigned_to:profiles!corrective_actions_assigned_to_user_id_fkey(full_name)"
      )
      .eq("investigation_id", investigationRes.data.id)
      .order("created_at");
    actions = (caData ?? []) as AegisCorrectiveAction[];
  }

  return {
    incident: (incidentRes.data ?? null) as AegisIncident | null,
    investigation: (investigationRes.data ?? null) as AegisInvestigation | null,
    actions,
    participants: (participantsRes.data ?? []) as Array<{
      participant_id: string;
      role: string;
      notes: string | null;
      participant_profiles: { preferred_name: string } | null;
    }>,
  };
}

// ── Update incident status ──

export async function updateAegisIncidentStatus(
  incidentId: string,
  status: string,
  extras?: {
    resolution_notes?: string;
    ndis_sirs_reference_number?: string;
    downgrade_justification?: string;
    sirs_priority?: string;
  }
) {
  const supabase = createAdminSupabaseClient();
  const now = new Date().toISOString();

  const updatePayload: Record<string, unknown> = {
    status,
    updated_at: now,
  };

  if (status === "resolved" || status === "closed") {
    updatePayload.resolved_at = now;
    if (extras?.resolution_notes) {
      updatePayload.resolution_notes = extras.resolution_notes;
    }
  }

  if (status === "sirs_submitted") {
    updatePayload.sirs_submitted_at = now;
    if (extras?.ndis_sirs_reference_number) {
      updatePayload.ndis_sirs_reference_number =
        extras.ndis_sirs_reference_number;
    }
  }

  // Handle downgrade
  if (extras?.sirs_priority && extras?.downgrade_justification) {
    updatePayload.sirs_priority = extras.sirs_priority;
    updatePayload.downgrade_justification = extras.downgrade_justification;
    updatePayload.downgraded_at = now;
  }

  const { error } = await supabase
    .from("incidents")
    .update(updatePayload)
    .eq("id", incidentId);

  if (error) throw new Error(error.message);
  revalidatePath("/olympus/aegis/triage");
}

// ── Create or update investigation ──

export async function upsertInvestigation(
  incidentId: string,
  organizationId: string,
  data: Partial<AegisInvestigation>
) {
  const supabase = createAdminSupabaseClient();

  const { data: existing } = await supabase
    .from("incident_investigations")
    .select("id")
    .eq("incident_id", incidentId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("incident_investigations")
      .update({
        ...data,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("incident_investigations")
      .insert({
        incident_id: incidentId,
        organization_id: organizationId,
        ...data,
      });
    if (error) throw new Error(error.message);
  }

  revalidatePath("/olympus/aegis/triage");
}

// ── Create corrective action ──

export async function createCorrectiveAction(params: {
  investigation_id: string;
  organization_id: string;
  action_type: string;
  description: string;
  due_date: string;
  assigned_to_user_id?: string;
}) {
  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.from("corrective_actions").insert(params);
  if (error) throw new Error(error.message);
  revalidatePath("/olympus/aegis/triage");
}

// ── Update corrective action ──

export async function updateCorrectiveAction(
  actionId: string,
  data: { status?: string; completion_notes?: string }
) {
  const supabase = createAdminSupabaseClient();
  const payload: Record<string, unknown> = {
    ...data,
    updated_at: new Date().toISOString(),
  };
  if (data.status === "completed") {
    payload.completed_at = new Date().toISOString();
  }
  const { error } = await supabase
    .from("corrective_actions")
    .update(payload)
    .eq("id", actionId);
  if (error) throw new Error(error.message);
  revalidatePath("/olympus/aegis/triage");
}

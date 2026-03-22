/**
 * @module CareCompliance Server Actions
 * @status COMPLETE
 * @description Compliance management — restrictive practices tracking, behaviour support plans, and regulatory audit trails
 * @exports createRestrictivePracticeAction, fetchRestrictivePracticesAction, updateRestrictivePracticeAction, fetchComplianceReportAction
 * @lastAudit 2026-03-22
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ── Restrictive Practices ────────────────────────────────────────────────────

export async function createRestrictivePracticeAction(input: {
  organization_id: string;
  participant_id: string;
  behaviour_event_id?: string;
  practice_type: string;
  authorised_in_bsp: boolean;
  duration_minutes?: number;
  reason: string;
  description: string;
  outcome?: string;
  reportable?: boolean;
  notes?: string;
}) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const { data, error } = await (supabase as any)
      .from("restrictive_practices")
      .insert({ ...input, worker_id: user.id })
      .select()
      .single();

    if (error) throw new Error(error.message);

    // Auto-create CI action for governance review
    try {
      await (supabase as any)
        .from("ci_actions")
        .insert({
          organization_id: input.organization_id,
          title: `Restrictive Practice Review: ${input.practice_type.replace(/_/g, " ")}`,
          source_type: "restrictive_practice",
          source_id: data.id,
          status: "open",
          priority: input.reportable ? "critical" : "high",
          description: `Automatic CI action generated from restrictive practice use. ${input.reason}`,
        });
    } catch { /* non-blocking */ }

    revalidatePath("/dashboard/care/behaviour");
    return data;
  } catch (e: any) {
    console.error("[care] createRestrictivePracticeAction failed:", e);
    throw e;
  }
}

export async function fetchRestrictivePracticesAction(organizationId: string, participantId?: string) {
  try {
    const supabase = await createServerSupabaseClient();
    let query = (supabase as any)
      .from("restrictive_practices")
      .select("*")
      .eq("organization_id", organizationId)
      .order("occurred_at", { ascending: false })
      .limit(200);

    if (participantId) query = query.eq("participant_id", participantId);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data;
  } catch (e: any) {
    console.error("[care] fetchRestrictivePracticesAction failed:", e);
    return [];
  }
}

// ── Onboarding Checklists ────────────────────────────────────────────────────

export async function createOnboardingChecklistAction(input: {
  organization_id: string;
  user_id: string;
}) {
  try {
    const supabase = await createServerSupabaseClient();

    const defaultItems = [
      { key: "contract_signed", label: "Employment Contract Signed", required: true, completed: false },
      { key: "worker_screening", label: "Worker Screening Check (NDIS)", required: true, completed: false },
      { key: "wwcc", label: "Working With Children Check", required: true, completed: false },
      { key: "police_check", label: "National Police Check", required: true, completed: false },
      { key: "first_aid", label: "First Aid Certificate", required: true, completed: false },
      { key: "manual_handling", label: "Manual Handling Training", required: false, completed: false },
      { key: "medication_competency", label: "Medication Competency", required: false, completed: false },
      { key: "orientation_completed", label: "Orientation Completed", required: true, completed: false },
      { key: "code_of_conduct", label: "Code of Conduct Acknowledged", required: true, completed: false },
      { key: "privacy_policy", label: "Privacy Policy Acknowledged", required: true, completed: false },
      { key: "emergency_contact", label: "Emergency Contact Provided", required: true, completed: false },
      { key: "superannuation", label: "Superannuation Details", required: true, completed: false },
      { key: "tax_file", label: "Tax File Number Declaration", required: true, completed: false },
      { key: "bank_details", label: "Bank Details Provided", required: true, completed: false },
    ];

    const { data, error } = await (supabase as any)
      .from("onboarding_checklists")
      .insert({
        organization_id: input.organization_id,
        user_id: input.user_id,
        checklist_items: defaultItems,
        status: "pending",
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    revalidatePath("/dashboard/team");
    return data;
  } catch (e: any) {
    console.error("[care] createOnboardingChecklistAction failed:", e);
    throw e;
  }
}

export async function updateOnboardingChecklistAction(id: string, updates: any) {
  try {
    const supabase = await createServerSupabaseClient();

    const payload: any = { ...updates, updated_at: new Date().toISOString() };

    // Check if all required items completed → auto-advance status
    if (updates.checklist_items) {
      const allRequiredDone = updates.checklist_items
        .filter((item: any) => item.required)
        .every((item: any) => item.completed);
      if (allRequiredDone && updates.status !== "authorised") {
        payload.status = "completed";
      }
    }

    const { data, error } = await (supabase as any)
      .from("onboarding_checklists")
      .update(payload)
      .eq("id", id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    revalidatePath("/dashboard/team");
    return data;
  } catch (e: any) {
    console.error("[care] updateOnboardingChecklistAction failed:", e);
    throw e;
  }
}

export async function authoriseWorkerAction(checklistId: string) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const { data, error } = await (supabase as any)
      .from("onboarding_checklists")
      .update({
        status: "authorised",
        authorised_to_work: true,
        authorised_at: new Date().toISOString(),
        signed_off_by: user.id,
        signed_off_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", checklistId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    revalidatePath("/dashboard/team");
    return data;
  } catch (e: any) {
    console.error("[care] authoriseWorkerAction failed:", e);
    throw e;
  }
}

export async function fetchOnboardingChecklistAction(organizationId: string, userId?: string) {
  try {
    const supabase = await createServerSupabaseClient();
    let query = (supabase as any)
      .from("onboarding_checklists")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });

    if (userId) query = query.eq("user_id", userId);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data;
  } catch (e: any) {
    console.error("[care] fetchOnboardingChecklistAction failed:", e);
    return [];
  }
}

// ── Sentinel Alerts ──────────────────────────────────────────────────────────

export async function fetchSentinelAlertsAction(organizationId: string, status?: string) {
  try {
    const supabase = await createServerSupabaseClient();
    let query = (supabase as any)
      .from("sentinel_alerts")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (status) {
      query = query.eq("status", status);
    } else {
      query = query.in("status", ["active", "acknowledged", "escalated"]);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data;
  } catch (e: any) {
    console.error("[care] fetchSentinelAlertsAction failed:", e);
    return [];
  }
}

export async function acknowledgeSentinelAlertAction(id: string, action: string, notes?: string) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const updates: any = {
      acknowledged_by: user.id,
      acknowledged_at: new Date().toISOString(),
      resolution_action: action,
    };

    if (action === "dismissed_false_positive") {
      updates.status = "dismissed";
      updates.resolved_at = new Date().toISOString();
      updates.resolution_notes = notes;
    } else if (action === "incident_created") {
      updates.status = "resolved";
      updates.resolved_at = new Date().toISOString();
      updates.resolution_notes = notes;
    } else if (action === "escalated_to_clinical") {
      updates.status = "escalated";
      updates.resolution_notes = notes;
    } else {
      updates.status = "acknowledged";
    }

    const { data, error } = await (supabase as any)
      .from("sentinel_alerts")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    revalidatePath("/dashboard");
    return data;
  } catch (e: any) {
    console.error("[care] acknowledgeSentinelAlertAction failed:", e);
    throw e;
  }
}

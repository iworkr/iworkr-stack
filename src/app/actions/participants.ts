/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

/* ── Types ────────────────────────────────────────────── */

export interface ParticipantProfile {
  id: string;
  client_id: string;
  organization_id: string;
  ndis_number: string | null;
  date_of_birth: string | null;
  primary_diagnosis: string | null;
  mobility_requirements: string | null;
  communication_preferences: string | null;
  triggers_and_risks: string | null;
  support_categories: string[];
  emergency_contacts: any[];
  notes: string | null;
  management_type: string | null;
  mobility_status: string | null;
  communication_type: string | null;
  critical_alerts: string[];
  plan_manager_id: string | null;
  support_coordinator_id: string | null;
  primary_nominee: any;
  gender: string | null;
  preferred_name: string | null;
  address: string | null;
  address_lat: number | null;
  address_lng: number | null;
  intake_status: string;
  status: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  client_name?: string;
  client_email?: string;
  client_phone?: string;
}

export interface ParticipantWithBudget extends ParticipantProfile {
  total_budget: number;
  consumed_budget: number;
  quarantined_budget: number;
  remaining_budget: number;
  active_agreement: ServiceAgreementSummary | null;
  plan_manager_name?: string;
  support_coordinator_name?: string;
}

export interface ServiceAgreementSummary {
  id: string;
  title: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  total_budget: number;
  consumed_budget: number;
  quarantined_budget: number;
  category_allocations: any;
  funding_management_type: string | null;
  document_url: string | null;
}

export interface ExternalAgency {
  id: string;
  name: string;
  type: string;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
}

/* ── NDIS Number Validation ───────────────────────────── */
/* Pure utility functions moved to @/lib/ndis-utils.ts     */
/* Import { validateNDISNumber, formatNDISNumber } from "@/lib/ndis-utils" for client use */

import { validateNDISNumber } from "@/lib/ndis-utils";

/* ── Fetch Participants List ──────────────────────────── */

export async function fetchParticipants(
  orgId: string,
  options?: {
    search?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }
): Promise<{ data: ParticipantProfile[]; total: number }> {
  try {
    const supabase = await createServerSupabaseClient();

    let query = (supabase as any)
      .from("participant_profiles")
      .select("*, clients!inner(name, email, phone)", { count: "exact" })
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });

    if (options?.status && options.status !== "all") {
      query = query.eq("status", options.status);
    }

    if (options?.search) {
      const s = `%${options.search}%`;
      query = query.or(`ndis_number.ilike.${s},clients.name.ilike.${s}`);
    }

    if (options?.limit) query = query.limit(options.limit);
    if (options?.offset) query = query.range(options.offset, options.offset + (options.limit || 50) - 1);

    const { data, error, count } = await query;
    if (error) return { data: [], total: 0 };

    return {
      data: (data || []).map((row: any) => ({
        ...row,
        client_name: row.clients?.name || "",
        client_email: row.clients?.email || "",
        client_phone: row.clients?.phone || "",
        critical_alerts: row.critical_alerts || [],
        address_lat: row.address_lat ? parseFloat(row.address_lat) : null,
        address_lng: row.address_lng ? parseFloat(row.address_lng) : null,
      })),
      total: count || 0,
    };
  } catch (e: any) {
    console.error("[participants] fetchParticipants failed:", e);
    return { data: [], total: 0 };
  }
}

/* ── Fetch Single Participant (Dossier) ───────────────── */

export async function fetchParticipantDossier(
  participantId: string,
  orgId: string,
): Promise<ParticipantWithBudget | null> {
  try {
    const supabase = await createServerSupabaseClient();

    // Profile + client data (use left join so missing client doesn't block)
    const { data: profile, error: profileError } = await (supabase as any)
      .from("participant_profiles")
      .select("*, clients(name, email, phone)")
      .eq("id", participantId)
      .eq("organization_id", orgId)
      .maybeSingle();

    if (profileError) {
      console.error("[participants] dossier query error:", profileError);
      return null;
    }
    if (!profile) return null;

    // Active service agreement
    const { data: agreement } = await (supabase as any)
      .from("service_agreements")
      .select("*")
      .eq("participant_id", participantId)
      .eq("organization_id", orgId)
      .in("status", ["active", "draft", "pending_signature"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Budget allocations for active agreement
    let totalBudget = 0;
    let consumedBudget = 0;
    let quarantinedBudget = 0;

    if (agreement) {
      const { data: allocations } = await (supabase as any)
        .from("budget_allocations")
        .select("total_budget, consumed_budget, quarantined_budget")
        .eq("service_agreement_id", agreement.id);

      for (const alloc of (allocations || [])) {
        totalBudget += parseFloat(alloc.total_budget) || 0;
        consumedBudget += parseFloat(alloc.consumed_budget) || 0;
        quarantinedBudget += parseFloat(alloc.quarantined_budget) || 0;
      }
    }

    // External agencies
    let planManagerName: string | undefined;
    let supportCoordinatorName: string | undefined;

    if (profile.plan_manager_id) {
      const { data: pm } = await (supabase as any)
        .from("external_agencies")
        .select("name")
        .eq("id", profile.plan_manager_id)
        .maybeSingle();
      planManagerName = pm?.name;
    }
    if (profile.support_coordinator_id) {
      const { data: sc } = await (supabase as any)
        .from("external_agencies")
        .select("name")
        .eq("id", profile.support_coordinator_id)
        .maybeSingle();
      supportCoordinatorName = sc?.name;
    }

    return {
      ...profile,
      client_name: profile.clients?.name || "",
      client_email: profile.clients?.email || "",
      client_phone: profile.clients?.phone || "",
      critical_alerts: profile.critical_alerts || [],
      address_lat: profile.address_lat ? parseFloat(profile.address_lat) : null,
      address_lng: profile.address_lng ? parseFloat(profile.address_lng) : null,
      total_budget: totalBudget,
      consumed_budget: consumedBudget,
      quarantined_budget: quarantinedBudget,
      remaining_budget: totalBudget - consumedBudget - quarantinedBudget,
      active_agreement: agreement ? {
        id: agreement.id,
        title: agreement.title,
        status: agreement.status,
        start_date: agreement.start_date,
        end_date: agreement.end_date,
        total_budget: parseFloat(agreement.total_budget) || 0,
        consumed_budget: parseFloat(agreement.consumed_budget) || 0,
        quarantined_budget: parseFloat(agreement.quarantined_budget) || 0,
        category_allocations: agreement.category_allocations || {},
        funding_management_type: agreement.funding_management_type,
        document_url: agreement.document_url,
      } : null,
      plan_manager_name: planManagerName,
      support_coordinator_name: supportCoordinatorName,
    };
  } catch (e: any) {
    console.error("[participants] fetchParticipantDossier failed:", e);
    return null;
  }
}

/* ── Create Participant (Step 1 of Intake) ────────────── */

export async function createParticipantIntake(data: {
  organization_id: string;
  first_name: string;
  last_name: string;
  preferred_name?: string;
  date_of_birth?: string;
  gender?: string;
  ndis_number?: string;
  primary_diagnosis?: string;
  address?: string;
  address_lat?: number;
  address_lng?: number;
  email?: string;
  phone?: string;
}): Promise<{ success: boolean; participant_id?: string; error?: string }> {
  try {
    const supabase = await createServerSupabaseClient();

    // Validate NDIS if provided
    if (data.ndis_number) {
      const cleaned = data.ndis_number.replace(/\s/g, "");
      if (!validateNDISNumber(cleaned)) {
        return { success: false, error: "Invalid NDIS number. Must be exactly 9 digits." };
      }
    }

    // Create the client first
    const { data: client, error: clientError } = await (supabase as any)
      .from("clients")
      .insert({
        organization_id: data.organization_id,
        name: `${data.first_name} ${data.last_name}`,
        email: data.email || null,
        phone: data.phone || null,
        type: "residential",
      })
      .select("id")
      .single();

    if (clientError) return { success: false, error: clientError.message };

    // Create participant profile
    const { data: participant, error: ppError } = await (supabase as any)
      .from("participant_profiles")
      .insert({
        client_id: client.id,
        organization_id: data.organization_id,
        ndis_number: data.ndis_number?.replace(/\s/g, "") || null,
        date_of_birth: data.date_of_birth || null,
        primary_diagnosis: data.primary_diagnosis || null,
        gender: data.gender || null,
        preferred_name: data.preferred_name || null,
        address: data.address || null,
        address_lat: data.address_lat || null,
        address_lng: data.address_lng || null,
        intake_status: "step_1",
        status: "pending_agreement",
      })
      .select("id")
      .single();

    if (ppError) return { success: false, error: ppError.message };

    return { success: true, participant_id: participant.id };
  } catch (e: any) {
    console.error("[participants] createParticipantIntake failed:", e);
    return { success: false, error: e?.message || "An unexpected error occurred" };
  }
}

/* ── Update Participant (Steps 2-4) ───────────────────── */

export async function updateParticipantIntake(
  participantId: string,
  step: "step_2" | "step_3" | "step_4" | "complete",
  data: Record<string, any>,
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerSupabaseClient();

    const updatePayload: Record<string, any> = { intake_status: step };

    if (step === "step_2") {
      // Care network
      if (data.primary_nominee) updatePayload.primary_nominee = data.primary_nominee;
      if (data.plan_manager_id) updatePayload.plan_manager_id = data.plan_manager_id;
      if (data.support_coordinator_id) updatePayload.support_coordinator_id = data.support_coordinator_id;
      if (data.management_type) updatePayload.management_type = data.management_type;
      if (data.emergency_contacts) updatePayload.emergency_contacts = data.emergency_contacts;
    }

    if (step === "step_3") {
      // Clinical baseline — normalize display labels to DB enum values
      const MOBILITY_MAP: Record<string, string> = {
        "Independent": "independent", "independent": "independent",
        "Mobility Aid": "mobility_aid", "mobility_aid": "mobility_aid",
        "Wheelchair": "wheelchair", "wheelchair": "wheelchair",
        "Hoist Required": "hoist_required", "hoist_required": "hoist_required",
      };
      const COMM_MAP: Record<string, string> = {
        "Verbal": "verbal", "verbal": "verbal",
        "Non-Verbal": "non_verbal", "non_verbal": "non_verbal",
        "Uses AAC Device": "uses_aac_device", "uses_aac_device": "uses_aac_device",
        "Limited Verbal": "limited_verbal", "limited_verbal": "limited_verbal",
      };
      if (data.mobility_status) updatePayload.mobility_status = MOBILITY_MAP[data.mobility_status] ?? data.mobility_status;
      if (data.communication_type) updatePayload.communication_type = COMM_MAP[data.communication_type] ?? data.communication_type;
      if (data.critical_alerts) updatePayload.critical_alerts = data.critical_alerts;
      if (data.mobility_requirements) updatePayload.mobility_requirements = data.mobility_requirements;
      if (data.communication_preferences) updatePayload.communication_preferences = data.communication_preferences;
      if (data.triggers_and_risks) updatePayload.triggers_and_risks = data.triggers_and_risks;
    }

    if (step === "step_4" || step === "complete") {
      updatePayload.intake_status = "complete";
      updatePayload.status = "active";
    }

    const { error } = await (supabase as any)
      .from("participant_profiles")
      .update(updatePayload)
      .eq("id", participantId);

    if (error) return { success: false, error: error.message };

    return { success: true };
  } catch (e: any) {
    console.error("[participants] updateParticipantIntake failed:", e);
    return { success: false, error: e?.message || "An unexpected error occurred" };
  }
}

/* ── Create Service Agreement ─────────────────────────── */

export async function createServiceAgreement(data: {
  organization_id: string;
  participant_id: string;
  title: string;
  start_date: string;
  end_date: string;
  funding_management_type: string;
  category_allocations: {
    core?: number;
    capacity_building?: number;
    capital?: number;
  };
}): Promise<{ success: boolean; agreement_id?: string; error?: string }> {
  try {
    const supabase = await createServerSupabaseClient();

    const totalBudget =
      (data.category_allocations.core || 0) +
      (data.category_allocations.capacity_building || 0) +
      (data.category_allocations.capital || 0);

    // Create agreement
    const { data: agreement, error: agError } = await (supabase as any)
      .from("service_agreements")
      .insert({
        organization_id: data.organization_id,
        participant_id: data.participant_id,
        title: data.title,
        start_date: data.start_date,
        end_date: data.end_date,
        total_budget: totalBudget,
        status: "active",
        funding_management_type: data.funding_management_type,
        category_allocations: data.category_allocations,
      })
      .select("id")
      .single();

    if (agError) return { success: false, error: agError.message };

    // Create budget allocations for each category
    const allocations = [];
    for (const [cat, amount] of Object.entries(data.category_allocations)) {
      if (amount && amount > 0) {
        allocations.push({
          organization_id: data.organization_id,
          service_agreement_id: agreement.id,
          participant_id: data.participant_id,
          category: cat,
          total_budget: amount,
        });
      }
    }

    if (allocations.length > 0) {
      await (supabase as any).from("budget_allocations").insert(allocations);
    }

    return { success: true, agreement_id: agreement.id };
  } catch (e: any) {
    console.error("[participants] createServiceAgreement failed:", e);
    return { success: false, error: e?.message || "An unexpected error occurred" };
  }
}

/* ── Fetch External Agencies ──────────────────────────── */

export async function fetchExternalAgencies(
  orgId: string,
  type?: string,
): Promise<ExternalAgency[]> {
  try {
    const supabase = await createServerSupabaseClient();

    let query = (supabase as any)
      .from("external_agencies")
      .select("id, name, type, contact_name, contact_email, contact_phone")
      .eq("organization_id", orgId)
      .eq("is_active", true)
      .order("name");

    if (type) query = query.eq("type", type);

    const { data } = await query;
    return data || [];
  } catch (e: any) {
    console.error("[participants] fetchExternalAgencies failed:", e);
    return [];
  }
}

/* ── Create External Agency ───────────────────────────── */

export async function createExternalAgency(data: {
  organization_id: string;
  name: string;
  type: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const supabase = await createServerSupabaseClient();

    const { data: agency, error } = await (supabase as any)
      .from("external_agencies")
      .insert(data)
      .select("id")
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, id: agency.id };
  } catch (e: any) {
    console.error("[participants] createExternalAgency failed:", e);
    return { success: false, error: e?.message || "An unexpected error occurred" };
  }
}

/* ── Fetch Budget Telemetry ───────────────────────────── */

export async function fetchBudgetTelemetry(
  participantId: string,
  orgId: string,
): Promise<{
  total: number;
  consumed: number;
  quarantined: number;
  remaining: number;
  by_category: { category: string; total: number; consumed: number; quarantined: number }[];
  burn_rate: number;
  days_elapsed: number;
  days_total: number;
}> {
  try {
    const supabase = await createServerSupabaseClient();

    // Active agreement
    const { data: agreement } = await (supabase as any)
      .from("service_agreements")
      .select("id, start_date, end_date")
      .eq("participant_id", participantId)
      .eq("organization_id", orgId)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (!agreement) {
      return { total: 0, consumed: 0, quarantined: 0, remaining: 0, by_category: [], burn_rate: 0, days_elapsed: 0, days_total: 0 };
    }

    const { data: allocations } = await (supabase as any)
      .from("budget_allocations")
      .select("category, total_budget, consumed_budget, quarantined_budget")
      .eq("service_agreement_id", agreement.id);

    let total = 0, consumed = 0, quarantined = 0;
    const byCategory = (allocations || []).map((a: any) => {
      const t = parseFloat(a.total_budget) || 0;
      const c = parseFloat(a.consumed_budget) || 0;
      const q = parseFloat(a.quarantined_budget) || 0;
      total += t;
      consumed += c;
      quarantined += q;
      return { category: a.category, total: t, consumed: c, quarantined: q };
    });

    // Burn rate calculation
    const startDate = new Date(agreement.start_date);
    const endDate = new Date(agreement.end_date);
    const now = new Date();
    const daysTotal = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000));
    const daysElapsed = Math.max(0, Math.ceil((now.getTime() - startDate.getTime()) / 86400000));
    const expectedSpend = total * (daysElapsed / daysTotal);
    const burnRate = expectedSpend > 0 ? consumed / expectedSpend : 0;

    return {
      total,
      consumed,
      quarantined,
      remaining: total - consumed - quarantined,
      by_category: byCategory,
      burn_rate: Math.round(burnRate * 100) / 100,
      days_elapsed: daysElapsed,
      days_total: daysTotal,
    };
  } catch (e: any) {
    console.error("[participants] fetchBudgetTelemetry failed:", e);
    return { total: 0, consumed: 0, quarantined: 0, remaining: 0, by_category: [], burn_rate: 0, days_elapsed: 0, days_total: 0 };
  }
}

/* ── Fetch Clinical Timeline ──────────────────────────── */

export async function fetchClinicalTimeline(
  participantId: string,
  orgId: string,
  limit = 50,
): Promise<any[]> {
  try {
    const supabase = await createServerSupabaseClient();

    // Helper: format snake_case to Title Case
    const formatLabel = (s: string) =>
      s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

    // ── 1) Progress notes ───────────────────────────────────
    const fetchNotes = async () => {
      try {
        const { data } = await (supabase as any)
          .from("progress_notes")
          .select(
            "id, context_of_support, outcomes_achieved, risks_identified, evv_start_time, evv_end_time, created_at, worker_id, profiles!progress_notes_worker_id_fkey(full_name, avatar_url)",
          )
          .eq("participant_id", participantId)
          .eq("organization_id", orgId)
          .order("created_at", { ascending: false })
          .limit(limit);
        return data || [];
      } catch (err) {
        console.error("[participants] fetchClinicalTimeline – progress_notes query failed:", err);
        return [];
      }
    };

    // ── 2) Health observations ──────────────────────────────
    const fetchObservations = async () => {
      try {
        const { data } = await (supabase as any)
          .from("health_observations")
          .select(
            "id, observation_type, value_numeric, value_text, value_systolic, value_diastolic, unit, is_abnormal, notes, observed_at, worker_id, profiles!health_observations_worker_id_fkey(full_name, avatar_url)",
          )
          .eq("participant_id", participantId)
          .eq("organization_id", orgId)
          .order("observed_at", { ascending: false })
          .limit(limit);
        return data || [];
      } catch (err) {
        console.error("[participants] fetchClinicalTimeline – health_observations query failed:", err);
        return [];
      }
    };

    // ── 3) Incidents ────────────────────────────────────────
    const fetchIncidents = async () => {
      try {
        const { data } = await (supabase as any)
          .from("incidents")
          .select(
            "id, title, category, severity, description, occurred_at, status, worker_id, profiles!incidents_worker_id_fkey(full_name, avatar_url)",
          )
          .eq("participant_id", participantId)
          .eq("organization_id", orgId)
          .order("occurred_at", { ascending: false })
          .limit(limit);
        return data || [];
      } catch (err) {
        // FK name may differ — retry without the join
        console.error("[participants] fetchClinicalTimeline – incidents join query failed, retrying without join:", err);
        try {
          const { data } = await (supabase as any)
            .from("incidents")
            .select("id, title, category, severity, description, occurred_at, status, worker_id")
            .eq("participant_id", participantId)
            .eq("organization_id", orgId)
            .order("occurred_at", { ascending: false })
            .limit(limit);
          return data || [];
        } catch (retryErr) {
          console.error("[participants] fetchClinicalTimeline – incidents fallback query failed:", retryErr);
          return [];
        }
      }
    };

    // ── 4) Medication administration records (MAR) ──────────
    const fetchMAR = async () => {
      try {
        const { data } = await (supabase as any)
          .from("medication_administration_records")
          .select(
            "id, outcome, notes, administered_at, worker_id, medication_id, participant_medications!medication_administration_records_medication_id_fkey(medication_name, dosage), profiles!medication_administration_records_worker_id_fkey(full_name, avatar_url)",
          )
          .eq("participant_id", participantId)
          .eq("organization_id", orgId)
          .order("administered_at", { ascending: false })
          .limit(limit);
        return data || [];
      } catch (err) {
        // Medication join may not exist — fallback without it
        console.error("[participants] fetchClinicalTimeline – MAR join query failed, retrying without medication join:", err);
        try {
          const { data } = await (supabase as any)
            .from("medication_administration_records")
            .select(
              "id, outcome, notes, administered_at, worker_id, medication_id, profiles!medication_administration_records_worker_id_fkey(full_name, avatar_url)",
            )
            .eq("participant_id", participantId)
            .eq("organization_id", orgId)
            .order("administered_at", { ascending: false })
            .limit(limit);
          return data || [];
        } catch (retryErr) {
          console.error("[participants] fetchClinicalTimeline – MAR fallback query failed:", retryErr);
          return [];
        }
      }
    };

    // ── Run all queries in parallel ─────────────────────────
    const [notes, observations, incidents, mars] = await Promise.all([
      fetchNotes(),
      fetchObservations(),
      fetchIncidents(),
      fetchMAR(),
    ]);

    // ── Map progress notes ──────────────────────────────────
    const noteEvents = notes.map((n: any) => ({
      id: n.id,
      type: "progress_note" as const,
      title: "Shift Note",
      summary: n.context_of_support || n.outcomes_achieved || "Note recorded",
      worker_name: n.profiles?.full_name || "Unknown",
      worker_avatar: n.profiles?.avatar_url ?? null,
      timestamp: n.created_at,
      metadata: {
        evv_start: n.evv_start_time,
        evv_end: n.evv_end_time,
        risks_identified: n.risks_identified,
      },
    }));

    // ── Map health observations ─────────────────────────────
    const observationEvents = observations.map((o: any) => {
      let valueSummary: string;
      if (o.observation_type === "blood_pressure" && o.value_systolic != null && o.value_diastolic != null) {
        valueSummary = `${o.value_systolic}/${o.value_diastolic} ${o.unit || "mmHg"}`;
      } else if (o.value_numeric != null) {
        valueSummary = `${o.value_numeric} ${o.unit || ""}`.trim();
      } else {
        valueSummary = o.value_text || o.notes || "Observation recorded";
      }

      return {
        id: o.id,
        type: "health_observation" as const,
        title: formatLabel(o.observation_type || "Health Observation"),
        summary: valueSummary,
        is_abnormal: o.is_abnormal ?? false,
        worker_name: o.profiles?.full_name || "Unknown",
        worker_avatar: o.profiles?.avatar_url ?? null,
        timestamp: o.observed_at,
        metadata: {
          observation_type: o.observation_type,
          unit: o.unit,
          value_numeric: o.value_numeric,
          value_systolic: o.value_systolic,
          value_diastolic: o.value_diastolic,
        },
      };
    });

    // ── Map incidents ───────────────────────────────────────
    const incidentEvents = incidents.map((i: any) => ({
      id: i.id,
      type: "incident" as const,
      title: i.title || "Incident",
      summary: i.description
        ? i.description.length > 200
          ? `${i.description.slice(0, 200)}…`
          : i.description
        : "Incident reported",
      severity: i.severity as "low" | "medium" | "high" | "critical" | undefined,
      worker_name: i.profiles?.full_name || "Unknown",
      worker_avatar: i.profiles?.avatar_url ?? null,
      timestamp: i.occurred_at,
      metadata: {
        category: i.category,
        status: i.status,
      },
    }));

    // ── Map medication administration records ────────────────
    const marEvents = mars.map((m: any) => {
      const medName = m.participant_medications?.medication_name;
      const dosage = m.participant_medications?.dosage;

      return {
        id: m.id,
        type: "medication_administration" as const,
        title: medName ? `Medication: ${medName}` : "Medication Administered",
        summary: [m.outcome, dosage].filter(Boolean).join(": ") || "Administered",
        worker_name: m.profiles?.full_name || "Unknown",
        worker_avatar: m.profiles?.avatar_url ?? null,
        timestamp: m.administered_at,
        metadata: {
          medication_id: m.medication_id,
          medication_name: medName,
          dosage,
          notes: m.notes,
        },
      };
    });

    // ── Merge & sort by timestamp descending, then slice ────
    const timeline = [
      ...noteEvents,
      ...observationEvents,
      ...incidentEvents,
      ...marEvents,
    ]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);

    return timeline;
  } catch (e: any) {
    console.error("[participants] fetchClinicalTimeline failed:", e);
    return [];
  }
}

/* ── Apply NDIS Extension ─────────────────────────────── */

export async function applyNDISExtension(
  agreementId: string,
  days: number = 28,
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerSupabaseClient();

    const { data: agreement } = await (supabase as any)
      .from("service_agreements")
      .select("end_date")
      .eq("id", agreementId)
      .single();

    if (!agreement) return { success: false, error: "Agreement not found" };

    const currentEnd = new Date(agreement.end_date);
    currentEnd.setDate(currentEnd.getDate() + days);

    const { error } = await (supabase as any)
      .from("service_agreements")
      .update({
        end_date: currentEnd.toISOString().split("T")[0],
        notes: `NDIS ${days}-day automatic extension applied ${new Date().toISOString().split("T")[0]}`,
      })
      .eq("id", agreementId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (e: any) {
    console.error("[participants] applyNDISExtension failed:", e);
    return { success: false, error: e?.message || "An unexpected error occurred" };
  }
}

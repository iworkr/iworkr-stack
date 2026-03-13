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
}

/* ── Fetch Single Participant (Dossier) ───────────────── */

export async function fetchParticipantDossier(
  participantId: string,
  orgId: string,
): Promise<ParticipantWithBudget | null> {
  const supabase = await createServerSupabaseClient();

  // Profile + client data
  const { data: profile } = await (supabase as any)
    .from("participant_profiles")
    .select("*, clients!inner(name, email, phone)")
    .eq("id", participantId)
    .eq("organization_id", orgId)
    .single();

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
      type: "individual",
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
}

/* ── Update Participant (Steps 2-4) ───────────────────── */

export async function updateParticipantIntake(
  participantId: string,
  step: "step_2" | "step_3" | "step_4" | "complete",
  data: Record<string, any>,
): Promise<{ success: boolean; error?: string }> {
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
    // Clinical baseline
    if (data.mobility_status) updatePayload.mobility_status = data.mobility_status;
    if (data.communication_type) updatePayload.communication_type = data.communication_type;
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
}

/* ── Fetch External Agencies ──────────────────────────── */

export async function fetchExternalAgencies(
  orgId: string,
  type?: string,
): Promise<ExternalAgency[]> {
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
  const supabase = await createServerSupabaseClient();

  const { data: agency, error } = await (supabase as any)
    .from("external_agencies")
    .insert(data)
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, id: agency.id };
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
}

/* ── Fetch Clinical Timeline ──────────────────────────── */

export async function fetchClinicalTimeline(
  participantId: string,
  orgId: string,
  limit = 50,
): Promise<any[]> {
  const supabase = await createServerSupabaseClient();

  // Fetch progress notes
  const { data: notes } = await (supabase as any)
    .from("progress_notes")
    .select("id, context_of_support, outcomes_achieved, risks_identified, evv_start_time, evv_end_time, created_at, worker_id, profiles!inner(full_name, avatar_url)")
    .eq("participant_id", participantId)
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(limit);

  // TODO: Merge health observations, incidents, medication records into unified timeline
  const timeline = (notes || []).map((n: any) => ({
    id: n.id,
    type: "progress_note" as const,
    title: "Shift Note",
    summary: n.context_of_support || n.outcomes_achieved || "Progress note recorded",
    worker_name: n.profiles?.full_name || "Unknown",
    worker_avatar: n.profiles?.avatar_url,
    timestamp: n.created_at,
    evv_start: n.evv_start_time,
    evv_end: n.evv_end_time,
  }));

  return timeline;
}

/* ── Apply NDIS Extension ─────────────────────────────── */

export async function applyNDISExtension(
  agreementId: string,
  days: number = 28,
): Promise<{ success: boolean; error?: string }> {
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
}

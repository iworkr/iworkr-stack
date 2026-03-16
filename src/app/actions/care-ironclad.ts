"use server";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const CreateAuditorPortalSchema = z.object({
  organization_id: z.string().uuid(),
  auditor_email: z.string().email(),
  auditor_phone: z.string().min(8).max(24),
  passcode: z.string().min(6).max(64),
  scope_date_start: z.string().min(1),
  scope_date_end: z.string().min(1),
  allowed_participant_ids: z.array(z.string().uuid()).min(1),
  allowed_staff_ids: z.array(z.string().uuid()).min(1),
  title: z.string().max(180).optional(),
  expires_in_days: z.number().int().min(1).max(30).optional().default(14),
});

const RevokeAuditorPortalSchema = z.object({
  portal_id: z.string().uuid(),
  organization_id: z.string().uuid(),
});

async function requireAuthedUser() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  return { supabase, user };
}

function hashPasscode(passcode: string) {
  return createHash("sha256").update(passcode).digest("hex");
}

export async function listIroncladScopeOptionsAction(organizationId: string) {
  try {
    const { supabase } = await requireAuthedUser();
    const [{ data: participants }, { data: staff }] = await Promise.all([
      (supabase as any)
        .from("participant_profiles")
        .select("id, preferred_name, clients(name)")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(300),
      (supabase as any)
        .from("organization_members")
        .select("user_id, profiles(full_name, email)")
        .eq("organization_id", organizationId)
        .eq("status", "active")
        .order("joined_at", { ascending: false })
        .limit(300),
    ]);

    return {
      participants:
        (participants || []).map((p: any) => ({
          id: p.id as string,
          name: (p.preferred_name as string | null) || (p.clients?.name as string) || "Participant",
        })) ?? [],
      staff:
        (staff || []).map((s: any) => ({
          id: s.user_id as string,
          name: (s.profiles?.full_name as string | null) || (s.profiles?.email as string) || "Staff",
        })) ?? [],
    };
  } catch (error) {
    console.error("[ironclad] listIroncladScopeOptionsAction", error);
    return { participants: [], staff: [] };
  }
}

export async function createAuditorPortalAction(input: z.infer<typeof CreateAuditorPortalSchema>) {
  const parsed = CreateAuditorPortalSchema.parse(input);
  const { supabase, user } = await requireAuthedUser();

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + parsed.expires_in_days);

  const { data, error } = await (supabase as any)
    .from("auditor_portals")
    .insert({
      organization_id: parsed.organization_id,
      created_by: user.id,
      auditor_email: parsed.auditor_email.toLowerCase(),
      auditor_phone: parsed.auditor_phone,
      passcode_hash: hashPasscode(parsed.passcode),
      expires_at: expiresAt.toISOString(),
      scope_date_start: parsed.scope_date_start,
      scope_date_end: parsed.scope_date_end,
      allowed_participant_ids: parsed.allowed_participant_ids,
      allowed_staff_ids: parsed.allowed_staff_ids,
      title: parsed.title ?? "Ironclad Auditor Data Room",
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/compliance/audits");
  return data;
}

export async function listAuditorPortalsAction(organizationId: string) {
  try {
    const { supabase } = await requireAuthedUser();
    const { data, error } = await (supabase as any)
      .from("auditor_portals")
      .select("*, auditor_access_logs(count)")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  } catch (error) {
    console.error("[ironclad] listAuditorPortalsAction", error);
    return [];
  }
}

export async function revokeAuditorPortalAction(input: z.infer<typeof RevokeAuditorPortalSchema>) {
  const parsed = RevokeAuditorPortalSchema.parse(input);
  const { supabase } = await requireAuthedUser();
  const { data, error } = await (supabase as any)
    .from("auditor_portals")
    .update({ is_revoked: true })
    .eq("id", parsed.portal_id)
    .eq("organization_id", parsed.organization_id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/compliance/audits");
  return data;
}

export async function getComplianceReadinessAction(organizationId: string) {
  try {
    const { supabase } = await requireAuthedUser();
    const now = new Date();
    const nextWeek = new Date(now);
    nextWeek.setDate(nextWeek.getDate() + 7);
    const monthAgo = new Date(now);
    monthAgo.setDate(monthAgo.getDate() - 30);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [{ data: upcomingShifts }, { data: expiredAgreements }, { data: incidents }, { data: ciActions }, { data: shiftNotes }] =
      await Promise.all([
        (supabase as any)
          .from("schedule_blocks")
          .select("id, technician_id")
          .eq("organization_id", organizationId)
          .gte("start_time", now.toISOString())
          .lte("start_time", nextWeek.toISOString())
          .in("status", ["scheduled", "en_route", "in_progress"]),
        (supabase as any)
          .from("service_agreements")
          .select("id, participant_id")
          .eq("organization_id", organizationId)
          .eq("status", "active")
          .lt("end_date", now.toISOString().slice(0, 10)),
        (supabase as any)
          .from("incidents")
          .select("id")
          .eq("organization_id", organizationId)
          .gte("occurred_at", monthStart.toISOString()),
        (supabase as any)
          .from("ci_actions")
          .select("source_id")
          .eq("organization_id", organizationId)
          .eq("source_type", "incident"),
        (supabase as any)
          .from("shift_note_submissions")
          .select("id, evv_clock_out_location")
          .eq("organization_id", organizationId)
          .gte("created_at", monthAgo.toISOString()),
      ]);

    const techIds = Array.from(
      new Set((upcomingShifts || []).map((s: any) => s.technician_id).filter(Boolean)),
    );
    let validCredentialUsers = new Set<string>();
    if (techIds.length > 0) {
      const { data: credentials } = await (supabase as any)
        .from("worker_credentials")
        .select("user_id")
        .eq("organization_id", organizationId)
        .eq("credential_type", "NDIS_SCREENING")
        .eq("verification_status", "verified")
        .gte("expiry_date", now.toISOString().slice(0, 10))
        .in("user_id", techIds);
      validCredentialUsers = new Set((credentials || []).map((c: any) => c.user_id as string));
    }

    const staffingGapCount = (upcomingShifts || []).filter(
      (s: any) => !s.technician_id || !validCredentialUsers.has(s.technician_id),
    ).length;
    const documentationGapCount = (expiredAgreements || []).length;
    const incidentIds = new Set((incidents || []).map((i: any) => i.id as string));
    const coveredIncidentIds = new Set((ciActions || []).map((c: any) => c.source_id as string));
    const clinicalGapCount = Array.from(incidentIds).filter((id) => !coveredIncidentIds.has(id)).length;
    const evvGapCount = (shiftNotes || []).filter((s: any) => {
      const loc = s.evv_clock_out_location as any;
      if (!loc) return true;
      const lat = Number(loc.lat ?? 0);
      const lng = Number(loc.lng ?? 0);
      return !Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0);
    }).length;
    const evvGapRate = (shiftNotes || []).length > 0 ? (evvGapCount / (shiftNotes || []).length) * 100 : 0;

    const scorePenalty = staffingGapCount * 3 + documentationGapCount * 5 + clinicalGapCount * 4 + evvGapRate * 0.8;
    const complianceScore = Math.max(0, Math.min(100, Math.round(100 - scorePenalty)));

    return {
      compliance_score: complianceScore,
      gaps: {
        staffing: staffingGapCount,
        documentation: documentationGapCount,
        clinical: clinicalGapCount,
        evv_rate: Number(evvGapRate.toFixed(1)),
      },
      computed_at: new Date().toISOString(),
    };
  } catch (error) {
    console.error("[ironclad] getComplianceReadinessAction", error);
    return {
      compliance_score: 0,
      gaps: { staffing: 0, documentation: 0, clinical: 0, evv_rate: 0 },
      computed_at: new Date().toISOString(),
    };
  }
}

export async function triggerCredentialRemediationAction(organizationId: string) {
  const { supabase } = await requireAuthedUser();
  const now = new Date();
  const nextWeek = new Date(now);
  nextWeek.setDate(nextWeek.getDate() + 7);

  const { data: shifts, error } = await (supabase as any)
    .from("schedule_blocks")
    .select("technician_id")
    .eq("organization_id", organizationId)
    .gte("start_time", now.toISOString())
    .lte("start_time", nextWeek.toISOString())
    .in("status", ["scheduled", "en_route", "in_progress"]);
  if (error) throw new Error(error.message);

  const techIds = Array.from(new Set((shifts || []).map((s: any) => s.technician_id).filter(Boolean)));
  if (techIds.length === 0) return { notified: 0 };

  const { data: validCredentials } = await (supabase as any)
    .from("worker_credentials")
    .select("user_id")
    .eq("organization_id", organizationId)
    .eq("credential_type", "NDIS_SCREENING")
    .eq("verification_status", "verified")
    .gte("expiry_date", now.toISOString().slice(0, 10))
    .in("user_id", techIds);
  const validSet = new Set((validCredentials || []).map((c: any) => c.user_id as string));
  const nonCompliant = techIds.filter((id) => !validSet.has(id));

  await Promise.all(
    nonCompliant.map((userId) =>
      supabase.functions.invoke("send-push", {
        body: {
          record: {
            user_id: userId,
            title: "URGENT: Credential expiry action required",
            body: "Your NDIS Worker Screening check is missing/expired. Upload a valid credential to keep upcoming shifts.",
            type: "compliance_alert",
          },
        },
      }),
    ),
  );

  revalidatePath("/dashboard/compliance/readiness");
  return { notified: nonCompliant.length };
}

export async function verifyDocumentHashAction(sha256Hash: string) {
  const { supabase } = await requireAuthedUser();
  const hash = sha256Hash.trim().toLowerCase();
  const { data, error } = await (supabase as any)
    .from("document_hashes")
    .select("*")
    .eq("sha256_hash", hash)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

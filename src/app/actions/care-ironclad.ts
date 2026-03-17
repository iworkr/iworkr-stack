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

// ── Compliance Gap Grid (Project Ironclad Redesign) ──────────────────────────

export interface ComplianceGapRow {
  id: string;
  gap_title: string;
  gap_detail: string;
  category: "staffing" | "documentation" | "clinical" | "evv";
  severity: "critical" | "warning" | "monitor";
  affected_entity_name: string;
  affected_entity_avatar: string | null;
  affected_entity_id: string;
  source_table: string;
  source_id: string;
}

export async function listComplianceGapsAction(organizationId: string): Promise<ComplianceGapRow[]> {
  try {
    const { supabase } = await requireAuthedUser();
    const now = new Date();
    const nextWeek = new Date(now);
    nextWeek.setDate(nextWeek.getDate() + 7);
    const next30 = new Date(now);
    next30.setDate(next30.getDate() + 30);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const gaps: ComplianceGapRow[] = [];

    // 1. Staffing gaps - expired/missing worker credentials
    const { data: credentials } = await (supabase as any)
      .from("worker_credentials")
      .select("id, user_id, credential_name, credential_type, expiry_date, verification_status, profiles!worker_credentials_user_id_fkey(full_name, avatar_url)")
      .eq("organization_id", organizationId);

    for (const cred of (credentials || [])) {
      const expiry = cred.expiry_date ? new Date(cred.expiry_date) : null;
      const name = cred.profiles?.full_name || "Unknown Worker";
      const avatar = cred.profiles?.avatar_url || null;

      if (cred.verification_status !== "verified" || !expiry || expiry < now) {
        gaps.push({
          id: `cred-${cred.id}`,
          gap_title: cred.credential_name || cred.credential_type || "Missing Credential",
          gap_detail: expiry ? `Expired on ${expiry.toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" })}` : "Not uploaded",
          category: "staffing",
          severity: "critical",
          affected_entity_name: name,
          affected_entity_avatar: avatar,
          affected_entity_id: cred.user_id,
          source_table: "worker_credentials",
          source_id: cred.id,
        });
      } else if (expiry && expiry < next30) {
        gaps.push({
          id: `cred-${cred.id}`,
          gap_title: cred.credential_name || cred.credential_type || "Expiring Credential",
          gap_detail: `Expires ${expiry.toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" })}`,
          category: "staffing",
          severity: "warning",
          affected_entity_name: name,
          affected_entity_avatar: avatar,
          affected_entity_id: cred.user_id,
          source_table: "worker_credentials",
          source_id: cred.id,
        });
      }
    }

    // 2. Documentation gaps - expired service agreements
    const { data: expiredAgreements } = await (supabase as any)
      .from("service_agreements")
      .select("id, participant_id, end_date, participant_profiles(preferred_name, full_name)")
      .eq("organization_id", organizationId)
      .eq("status", "active")
      .lt("end_date", now.toISOString().slice(0, 10));

    for (const sa of (expiredAgreements || [])) {
      const pName = sa.participant_profiles?.preferred_name || sa.participant_profiles?.full_name || "Participant";
      gaps.push({
        id: `sa-${sa.id}`,
        gap_title: "Service Agreement Expired",
        gap_detail: `Expired on ${new Date(sa.end_date).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" })}`,
        category: "documentation",
        severity: "critical",
        affected_entity_name: pName,
        affected_entity_avatar: null,
        affected_entity_id: sa.participant_id,
        source_table: "service_agreements",
        source_id: sa.id,
      });
    }

    // 3. Clinical gaps - incidents without linked quality actions
    const [{ data: incidents }, { data: ciActions }] = await Promise.all([
      (supabase as any)
        .from("incidents")
        .select("id, title, occurred_at")
        .eq("organization_id", organizationId)
        .gte("occurred_at", monthStart.toISOString()),
      (supabase as any)
        .from("ci_actions")
        .select("source_id")
        .eq("organization_id", organizationId)
        .eq("source_type", "incident"),
    ]);

    const coveredIncidents = new Set((ciActions || []).map((c: any) => c.source_id as string));
    for (const inc of (incidents || [])) {
      if (!coveredIncidents.has(inc.id)) {
        gaps.push({
          id: `inc-${inc.id}`,
          gap_title: inc.title || "Incident Missing Quality Action",
          gap_detail: `Occurred ${new Date(inc.occurred_at).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" })}`,
          category: "clinical",
          severity: "critical",
          affected_entity_name: "Incident Report",
          affected_entity_avatar: null,
          affected_entity_id: inc.id,
          source_table: "incidents",
          source_id: inc.id,
        });
      }
    }

    // 4. Pending policy acknowledgements (documentation)
    const { data: pendingAcks } = await (supabase as any)
      .from("policy_acknowledgements")
      .select("id, user_id, policy_id, due_at, policy_register(title), profiles!policy_acknowledgements_user_id_fkey(full_name, avatar_url)")
      .eq("organization_id", organizationId)
      .eq("status", "pending")
      .limit(100);

    for (const ack of (pendingAcks || [])) {
      const name = ack.profiles?.full_name || "Unknown Worker";
      const avatar = ack.profiles?.avatar_url || null;
      const policyTitle = (ack as any).policy_register?.title || "Policy";
      const isOverdue = ack.due_at && new Date(ack.due_at) < now;

      gaps.push({
        id: `ack-${ack.id}`,
        gap_title: `${policyTitle} — Unacknowledged`,
        gap_detail: isOverdue ? `Overdue since ${new Date(ack.due_at).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" })}` : "Pending signature",
        category: "documentation",
        severity: isOverdue ? "warning" : "monitor",
        affected_entity_name: name,
        affected_entity_avatar: avatar,
        affected_entity_id: ack.user_id,
        source_table: "policy_acknowledgements",
        source_id: ack.id,
      });
    }

    // Sort: critical first, then warning, then monitor
    const severityOrder = { critical: 0, warning: 1, monitor: 2 };
    gaps.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return gaps;
  } catch (error) {
    console.error("[ironclad] listComplianceGapsAction", error);
    return [];
  }
}

// ── Auditor Portal Telemetry (Project Overseer) ─────────────────────────────

export async function getAuditorPortalTelemetryAction(organizationId: string) {
  try {
    const { supabase } = await requireAuthedUser();
    const now = new Date();

    const { data: portals } = await (supabase as any)
      .from("auditor_portals")
      .select("id, is_revoked, expires_at, created_at")
      .eq("organization_id", organizationId);

    const active = (portals || []).filter(
      (p: any) => !p.is_revoked && new Date(p.expires_at) > now
    ).length;

    // Count access logs for evidence files
    const activeIds = (portals || [])
      .filter((p: any) => !p.is_revoked && new Date(p.expires_at) > now)
      .map((p: any) => p.id);

    let evidenceFiles = 0;
    let lastLogin = "—";
    let securityExceptions = 0;

    if (activeIds.length > 0) {
      const { data: logs } = await (supabase as any)
        .from("auditor_access_logs")
        .select("id, action, created_at")
        .in("portal_id", activeIds)
        .order("created_at", { ascending: false })
        .limit(500);

      evidenceFiles = (logs || []).filter((l: any) => l.action === "view_file" || l.action === "download").length;
      securityExceptions = (logs || []).filter((l: any) => l.action === "otp_failed" || l.action === "auth_failed").length;

      if (logs && logs.length > 0) {
        const d = new Date(logs[0].created_at);
        const isToday = d.toDateString() === now.toDateString();
        lastLogin = isToday
          ? `Today, ${d.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: true })}`
          : d.toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
      }
    }

    return {
      active_data_rooms: active,
      evidence_files_linked: evidenceFiles,
      last_auditor_login: lastLogin,
      security_exceptions: securityExceptions,
    };
  } catch (error) {
    console.error("[overseer] getAuditorPortalTelemetryAction", error);
    return {
      active_data_rooms: 0,
      evidence_files_linked: 0,
      last_auditor_login: "—",
      security_exceptions: 0,
    };
  }
}

export async function getAuditTrailAction(portalId: string) {
  try {
    const { supabase } = await requireAuthedUser();
    const { data, error } = await (supabase as any)
      .from("auditor_access_logs")
      .select("id, action, target_record_id, ip_address, user_agent, created_at")
      .eq("portal_id", portalId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data || [];
  } catch (error) {
    console.error("[overseer] getAuditTrailAction", error);
    return [];
  }
}

export async function sendTargetedRemediationAction(input: {
  organization_id: string;
  user_id: string;
  gap_title: string;
}) {
  const { supabase } = await requireAuthedUser();
  await supabase.functions.invoke("send-push", {
    body: {
      record: {
        user_id: input.user_id,
        title: "Action Required: Compliance Gap",
        body: `Please address: ${input.gap_title}. Upload the required document or contact your manager.`,
        type: "compliance_alert",
      },
    },
  });
  revalidatePath("/dashboard/compliance/readiness");
  return { success: true };
}

// ── Ironclad-Remediation: Upload Certificate ─────────────────────────────────

export interface UploadCertificateInput {
  worker_id: string;
  organization_id: string;
  credential_type: string;
  issued_date: string;
  expiry_date: string;
  file_name: string;
  file_base64: string;
  mime_type: string;
}

export async function uploadWorkerCertificateAction(input: UploadCertificateInput): Promise<{
  success: boolean;
  storage_path?: string;
  public_url?: string;
  error?: string;
}> {
  try {
    const { supabase, user } = await requireAuthedUser();

    // Build sanitized file path: [worker_uuid]/[credential_type]_[timestamp].[ext]
    const ext = input.mime_type === "application/pdf" ? "pdf"
      : input.mime_type === "image/png" ? "png"
      : input.mime_type === "image/webp" ? "webp"
      : "jpg";
    const ts = Math.floor(Date.now() / 1000);
    const safeType = input.credential_type.toLowerCase().replace(/[^a-z0-9]/g, "_");
    const filePath = `${input.worker_id}/${safeType}_${ts}.${ext}`;

    // Decode base64 → Uint8Array
    const binaryStr = atob(input.file_base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    const { error: uploadError } = await supabase.storage
      .from("compliance-documents")
      .upload(filePath, bytes, {
        contentType: input.mime_type,
        upsert: true,
      });

    if (uploadError) throw new Error(uploadError.message);

    // Upsert credential record
    const { error: dbError } = await (supabase as any)
      .from("worker_credentials")
      .upsert({
        user_id: input.worker_id,
        organization_id: input.organization_id,
        credential_type: input.credential_type,
        storage_path: filePath,
        document_url: filePath,
        issued_date: input.issued_date,
        expiry_date: input.expiry_date,
        verification_status: "verified",
        verified_by: user.id,
        verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "user_id,credential_type,organization_id",
      });

    if (dbError) throw new Error(dbError.message);

    revalidatePath("/dashboard/compliance/readiness");
    return { success: true, storage_path: filePath };
  } catch (err: any) {
    console.error("[ironclad] uploadWorkerCertificateAction", err);
    return { success: false, error: err?.message || "Upload failed" };
  }
}

// ── Ironclad-Remediation: Preview Suspension Impact ──────────────────────────

export interface SuspensionImpact {
  worker_name: string;
  orphaned_shifts: number;
  has_active_timesheet: boolean;
}

export async function previewSuspensionImpactAction(workerId: string): Promise<SuspensionImpact> {
  try {
    const { supabase } = await requireAuthedUser();
    const { data, error } = await (supabase as any).rpc("preview_suspension_impact", {
      p_worker_id: workerId,
    });
    if (error) throw new Error(error.message);
    return {
      worker_name: data?.worker_name || "Unknown",
      orphaned_shifts: data?.orphaned_shifts || 0,
      has_active_timesheet: data?.has_active_timesheet || false,
    };
  } catch (err: any) {
    console.error("[ironclad] previewSuspensionImpactAction", err);
    return { worker_name: "Unknown", orphaned_shifts: 0, has_active_timesheet: false };
  }
}

// ── Ironclad-Remediation: Suspend Worker Cascade ─────────────────────────────

export async function suspendWorkerCascadeAction(input: {
  worker_id: string;
  admin_id: string;
  reason: string;
}): Promise<{
  success: boolean;
  orphaned_shifts?: number;
  revenue_risk?: number;
  worker_name?: string;
  error?: string;
}> {
  try {
    const { supabase } = await requireAuthedUser();
    const { data, error } = await (supabase as any).rpc("suspend_worker_cascade", {
      p_worker_id: input.worker_id,
      p_admin_id: input.admin_id,
      p_reason: input.reason,
    });
    if (error) throw new Error(error.message);
    revalidatePath("/dashboard/compliance/readiness");
    revalidatePath("/dashboard/workforce/team");
    return {
      success: true,
      orphaned_shifts: data?.orphaned_shifts || 0,
      revenue_risk: data?.revenue_risk || 0,
      worker_name: data?.worker_name || "Worker",
    };
  } catch (err: any) {
    console.error("[ironclad] suspendWorkerCascadeAction", err);
    return { success: false, error: err?.message || "Suspension failed" };
  }
}

// ── Ironclad-Remediation: Lift Suspension ─────────────────────────────────────

export async function liftWorkerSuspensionAction(input: {
  worker_id: string;
  admin_id: string;
  notes?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase } = await requireAuthedUser();
    const { data, error } = await (supabase as any).rpc("lift_worker_suspension", {
      p_worker_id: input.worker_id,
      p_admin_id: input.admin_id,
      p_notes: input.notes || null,
    });
    if (error) throw new Error(error.message);
    if (!data?.success) throw new Error("RPC returned failure");
    revalidatePath("/dashboard/compliance/readiness");
    revalidatePath("/dashboard/workforce/team");
    return { success: true };
  } catch (err: any) {
    console.error("[ironclad] liftWorkerSuspensionAction", err);
    return { success: false, error: err?.message || "Failed to lift suspension" };
  }
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

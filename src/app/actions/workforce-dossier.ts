/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/* ── Types ────────────────────────────────────────────── */

export interface WorkforceMember {
  user_id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  phone: string | null;
  role: string;
  branch: string;
  status: string;
  skills: string[];
  hourly_rate: number | null;
  joined_at: string;
  last_active_at: string | null;
  // Staff profile data
  employment_type: string | null;
  schads_level: string | null;
  max_weekly_hours: number | null;
  // Computed
  credential_status: "compliant" | "expiring" | "non_compliant" | "unknown";
  credential_count: number;
  next_shift: string | null;
  weekly_hours_scheduled: number;
}

export interface WorkforceTelemetry {
  total_headcount: number;
  active_on_shift: number;
  compliance_rate: number;
  avg_utilization: number;
}

export interface WorkerCredential {
  id: string;
  credential_type: string;
  credential_name: string | null;
  document_url: string | null;
  issued_date: string | null;
  expiry_date: string | null;
  verification_status: string;
  verified_by: string | null;
  verified_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkerActivity {
  id: string;
  type: "system" | "hr" | "shift" | "compliance" | "security";
  action: string;
  description: string;
  actor_name: string | null;
  metadata: any;
  created_at: string;
}

export interface ParticipantExclusion {
  id: string;
  participant_id: string;
  participant_name: string;
  reason: string | null;
  created_at: string;
}

/* ── Workforce Directory (Master Grid) ──────────────── */

export async function getWorkforceDirectory(
  orgId: string
): Promise<{ members: WorkforceMember[]; telemetry: WorkforceTelemetry }> {
  try {
    const supabase = await createServerSupabaseClient();

    // 1. Get all active members
    const { data: members, error } = await supabase
      .from("organization_members")
      .select(
        `
        user_id,
        role,
        status,
        branch,
        skills,
        hourly_rate,
        joined_at,
        last_active_at,
        profiles:user_id (
          id,
          full_name,
          email,
          avatar_url,
          phone
        )
      `
      )
      .eq("organization_id", orgId)
      .in("status", ["active", "pending", "suspended"])
      .order("joined_at", { ascending: true });

    if (error || !members) return { members: [], telemetry: { total_headcount: 0, active_on_shift: 0, compliance_rate: 0, avg_utilization: 0 } };

    const userIds = members.map((m: any) => m.user_id);

    // 2. Get staff_profiles
    const { data: staffRows } = await (supabase as any)
      .from("staff_profiles")
      .select("user_id, employment_type, schads_level, max_weekly_hours")
      .eq("organization_id", orgId)
      .in("user_id", userIds);

    const staffMap = new Map<string, any>((staffRows || []).map((s: any) => [s.user_id, s]));

    // 3. Get credentials for compliance status
    const { data: allCreds } = await (supabase as any)
      .from("worker_credentials")
      .select("user_id, credential_type, verification_status, expiry_date")
      .eq("organization_id", orgId)
      .in("user_id", userIds);

    const today = new Date().toISOString().split("T")[0];
    const thirtyDaysOut = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];

    // Build credential status per user
    const credMap = new Map<string, { status: "compliant" | "expiring" | "non_compliant" | "unknown"; count: number }>();
    for (const uid of userIds) {
      const userCreds = (allCreds || []).filter((c: any) => c.user_id === uid);
      if (userCreds.length === 0) {
        credMap.set(uid, { status: "unknown", count: 0 });
        continue;
      }
      const hasExpired = userCreds.some((c: any) => c.verification_status === "expired" || (c.expiry_date && c.expiry_date < today));
      const hasExpiring = userCreds.some((c: any) => c.verification_status === "verified" && c.expiry_date && c.expiry_date >= today && c.expiry_date <= thirtyDaysOut);
      const allVerified = userCreds.every((c: any) => c.verification_status === "verified" && (!c.expiry_date || c.expiry_date >= today));

      credMap.set(uid, {
        status: hasExpired ? "non_compliant" : hasExpiring ? "expiring" : allVerified ? "compliant" : "unknown",
        count: userCreds.length,
      });
    }

    // 4. Get next shift per user
    const now = new Date().toISOString();
    const { data: nextShifts } = await (supabase as any)
      .from("schedule_blocks")
      .select("technician_id, start_time, end_time")
      .eq("organization_id", orgId)
      .in("technician_id", userIds)
      .gte("start_time", now)
      .neq("status", "cancelled")
      .order("start_time", { ascending: true });

    const nextShiftMap = new Map<string, string>();
    for (const b of (nextShifts || [])) {
      if (!nextShiftMap.has(b.technician_id)) {
        nextShiftMap.set(b.technician_id, b.start_time);
      }
    }

    // 5. Get weekly hours scheduled
    const weekStart = getWeekStart(new Date());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const { data: weekBlocks } = await (supabase as any)
      .from("schedule_blocks")
      .select("technician_id, start_time, end_time")
      .eq("organization_id", orgId)
      .in("technician_id", userIds)
      .gte("start_time", weekStart.toISOString())
      .lt("end_time", weekEnd.toISOString())
      .neq("status", "cancelled");

    const hoursMap = new Map<string, number>();
    for (const b of (weekBlocks || [])) {
      const h = (new Date(b.end_time).getTime() - new Date(b.start_time).getTime()) / 3600000;
      hoursMap.set(b.technician_id, (hoursMap.get(b.technician_id) || 0) + h);
    }

    // 6. Count active on shift (shifts in progress now)
    const { data: activeShifts } = await (supabase as any)
      .from("schedule_blocks")
      .select("technician_id")
      .eq("organization_id", orgId)
      .lte("start_time", now)
      .gte("end_time", now)
      .neq("status", "cancelled");

    const activeOnShiftSet = new Set<string>((activeShifts || []).map((b: any) => b.technician_id));

    // Build results
    const result: WorkforceMember[] = members.map((m: any) => {
      const profile = m.profiles;
      const staff = staffMap.get(m.user_id);
      const cred = credMap.get(m.user_id) || { status: "unknown" as const, count: 0 };
      const hours = Math.round((hoursMap.get(m.user_id) || 0) * 10) / 10;

      return {
        user_id: m.user_id,
        full_name: profile?.full_name || "",
        email: profile?.email || "",
        avatar_url: profile?.avatar_url || null,
        phone: profile?.phone || null,
        role: m.role || "technician",
        branch: m.branch || "HQ",
        status: m.status || "active",
        skills: m.skills || [],
        hourly_rate: m.hourly_rate ? parseFloat(m.hourly_rate) : null,
        joined_at: m.joined_at || "",
        last_active_at: m.last_active_at || null,
        employment_type: staff?.employment_type || null,
        schads_level: staff?.schads_level || null,
        max_weekly_hours: staff?.max_weekly_hours || null,
        credential_status: cred.status,
        credential_count: cred.count,
        next_shift: nextShiftMap.get(m.user_id) || null,
        weekly_hours_scheduled: hours,
      };
    });

    // Telemetry
    const activeMembers = result.filter((m) => m.status === "active");
    const compliantCount = activeMembers.filter((m) => m.credential_status === "compliant").length;
    const totalHours = activeMembers.reduce((sum, m) => sum + m.weekly_hours_scheduled, 0);
    const avgUtil = activeMembers.length > 0 ? Math.round(totalHours / activeMembers.length * 10) / 10 : 0;

    return {
      members: result,
      telemetry: {
        total_headcount: activeMembers.length,
        active_on_shift: activeOnShiftSet.size,
        compliance_rate: activeMembers.length > 0 ? Math.round((compliantCount / activeMembers.length) * 100) : 0,
        avg_utilization: avgUtil,
      },
    };
  } catch (e: any) {
    console.error("[workforce-dossier] getWorkforceDirectory failed:", e);
    return { members: [], telemetry: { total_headcount: 0, active_on_shift: 0, compliance_rate: 0, avg_utilization: 0 } };
  }
}

/* ── Worker Credentials (Tab 2) ──────────────────────── */

export async function getWorkerCredentials(
  userId: string,
  orgId: string
): Promise<WorkerCredential[]> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await (supabase as any)
      .from("worker_credentials")
      .select("*")
      .eq("user_id", userId)
      .eq("organization_id", orgId)
      .order("credential_type");

    if (error) return [];
    return (data || []).map((c: any) => ({
      id: c.id,
      credential_type: c.credential_type,
      credential_name: c.credential_name || null,
      document_url: c.document_url || null,
      issued_date: c.issued_date || null,
      expiry_date: c.expiry_date || null,
      verification_status: c.verification_status || "pending",
      verified_by: c.verified_by || null,
      verified_at: c.verified_at || null,
      notes: c.notes || null,
      created_at: c.created_at,
      updated_at: c.updated_at,
    }));
  } catch (e: any) {
    console.error("[workforce-dossier] getWorkerCredentials failed:", e);
    return [];
  }
}

/* ── Worker Activity Log (Tab 4) ─────────────────────── */

export async function getWorkerActivity(
  userId: string,
  orgId: string
): Promise<WorkerActivity[]> {
  try {
    const supabase = await createServerSupabaseClient();

    // Get audit log entries for this user
    const { data: auditLogs } = await (supabase as any)
      .from("audit_logs")
      .select("*")
      .eq("organization_id", orgId)
      .or(`actor_id.eq.${userId},target_user_id.eq.${userId}`)
      .order("created_at", { ascending: false })
      .limit(50);

    // Get recent shift clock-ins/outs
    const { data: recentShifts } = await (supabase as any)
      .from("schedule_blocks")
      .select("id, title, start_time, end_time, status")
      .eq("organization_id", orgId)
      .eq("technician_id", userId)
      .order("start_time", { ascending: false })
      .limit(20);

    const activities: WorkerActivity[] = [];

    // Convert audit logs
    for (const log of (auditLogs || [])) {
      const isSecurityAction = ["password_reset", "mfa_reset", "login", "logout", "role_change", "suspend", "reactivate"].includes(log.action);
      const isHrAction = ["schads_update", "profile_update", "employment_change", "qualification_add", "qualification_remove"].includes(log.action);
      const isComplianceAction = ["credential_upload", "credential_verified", "credential_expired"].includes(log.action);

      activities.push({
        id: log.id,
        type: isSecurityAction ? "security" : isHrAction ? "hr" : isComplianceAction ? "compliance" : "system",
        action: log.action || "unknown",
        description: log.description || log.action || "",
        actor_name: log.actor_name || null,
        metadata: log.metadata || {},
        created_at: log.created_at,
      });
    }

    // Convert shift logs
    for (const shift of (recentShifts || [])) {
      activities.push({
        id: `shift-${shift.id}`,
        type: "shift",
        action: "shift_completed",
        description: `${shift.status === "completed" ? "Completed" : "Scheduled"} shift: ${shift.title || "Untitled"}`,
        actor_name: null,
        metadata: { start: shift.start_time, end: shift.end_time, status: shift.status },
        created_at: shift.start_time,
      });
    }

    // Sort by date descending
    activities.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return activities.slice(0, 50);
  } catch (e: any) {
    console.error("[workforce-dossier] getWorkerActivity failed:", e);
    return [];
  }
}

/* ── Update Staff Banking Details ─────────────────────── */

export async function updateStaffBanking(data: {
  user_id: string;
  organization_id: string;
  bank_account_name?: string | null;
  bank_bsb?: string | null;
  bank_account_number?: string | null;
  super_fund_name?: string | null;
  super_usi?: string | null;
  super_member_number?: string | null;
  tfn_hash?: string | null;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerSupabaseClient();

    const { error } = await (supabase as any)
      .from("staff_profiles")
      .update({
        bank_account_name: data.bank_account_name,
        bank_bsb: data.bank_bsb,
        bank_account_number: data.bank_account_number,
        super_fund_name: data.super_fund_name,
        super_usi: data.super_usi,
        super_member_number: data.super_member_number,
        tfn_hash: data.tfn_hash,
      })
      .eq("user_id", data.user_id)
      .eq("organization_id", data.organization_id);

    if (error) return { success: false, error: error.message };

    revalidatePath(`/dashboard/workforce/team/${data.user_id}`);
    return { success: true };
  } catch (e: any) {
    console.error("[workforce-dossier] updateStaffBanking failed:", e);
    return { success: false, error: e?.message || "An unexpected error occurred" };
  }
}

/* ── Update Worker Availability ──────────────────────── */

export async function updateWorkerAvailability(data: {
  user_id: string;
  organization_id: string;
  availability: Record<string, { start: string; end: string; available: boolean }[]>;
  max_weekly_hours: number;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerSupabaseClient();

    // Transform availability to the storage format (only include available slots)
    const cleanAvailability: Record<string, { start: string; end: string }[]> = {};
    for (const [day, slots] of Object.entries(data.availability)) {
      const available = slots.filter((s) => s.available);
      if (available.length > 0) {
        cleanAvailability[day] = available.map((s) => ({ start: s.start, end: s.end }));
      }
    }

    const { error } = await (supabase as any)
      .from("staff_profiles")
      .update({
        availability: cleanAvailability,
        max_weekly_hours: data.max_weekly_hours,
      })
      .eq("user_id", data.user_id)
      .eq("organization_id", data.organization_id);

    if (error) return { success: false, error: error.message };

    revalidatePath(`/dashboard/workforce/team/${data.user_id}`);
    return { success: true };
  } catch (e: any) {
    console.error("[workforce-dossier] updateWorkerAvailability failed:", e);
    return { success: false, error: e?.message || "An unexpected error occurred" };
  }
}

/* ── Update Worker Skills ────────────────────────────── */

export async function updateWorkerSkills(data: {
  user_id: string;
  organization_id: string;
  qualifications: string[];
  service_regions: string[];
}): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerSupabaseClient();

    // Update staff_profiles qualifications
    const { error } = await (supabase as any)
      .from("staff_profiles")
      .update({
        qualifications: data.qualifications,
      })
      .eq("user_id", data.user_id)
      .eq("organization_id", data.organization_id);

    if (error) return { success: false, error: error.message };

    // Update organization_members skills (service regions are stored as skills)
    await (supabase as any)
      .from("organization_members")
      .update({ skills: data.service_regions })
      .eq("user_id", data.user_id)
      .eq("organization_id", data.organization_id);

    revalidatePath(`/dashboard/workforce/team/${data.user_id}`);
    return { success: true };
  } catch (e: any) {
    console.error("[workforce-dossier] updateWorkerSkills failed:", e);
    return { success: false, error: e?.message || "An unexpected error occurred" };
  }
}

/* ── Update Worker Role (with audit logging) ─────────── */

export async function updateWorkerRole(data: {
  target_user_id: string;
  organization_id: string;
  new_role: string;
  confirmation?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerSupabaseClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Unauthorized" };

    // If elevating to admin/owner, require confirmation
    if ((data.new_role === "admin" || data.new_role === "owner") && data.confirmation !== "GRANT ADMIN") {
      return { success: false, error: "Confirmation required: type GRANT ADMIN" };
    }

    // Get current role for audit
    const { data: currentMember } = await (supabase as any)
      .from("organization_members")
      .select("role")
      .eq("user_id", data.target_user_id)
      .eq("organization_id", data.organization_id)
      .maybeSingle();

    const previousRole = currentMember?.role || "unknown";

    // Update role
    const { error } = await (supabase as any)
      .from("organization_members")
      .update({ role: data.new_role })
      .eq("user_id", data.target_user_id)
      .eq("organization_id", data.organization_id);

    if (error) return { success: false, error: error.message };

    // Log audit entry
    try {
      await (supabase as any).from("audit_logs").insert({
        organization_id: data.organization_id,
        actor_id: user.id,
        target_user_id: data.target_user_id,
        action: "role_change",
        description: `Role updated from ${previousRole} to ${data.new_role}`,
        metadata: { previous_role: previousRole, new_role: data.new_role },
      });
    } catch {
      // audit log is non-fatal
    }

    revalidatePath(`/dashboard/workforce/team/${data.target_user_id}`);
    revalidatePath("/dashboard/workforce/team");
    return { success: true };
  } catch (e: any) {
    console.error("[workforce-dossier] updateWorkerRole failed:", e);
    return { success: false, error: e?.message || "An unexpected error occurred" };
  }
}

/* ── Suspend / Reactivate Worker ─────────────────────── */

export async function toggleWorkerSuspension(data: {
  user_id: string;
  organization_id: string;
  action: "suspend" | "reactivate";
}): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerSupabaseClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Unauthorized" };

    const newStatus = data.action === "suspend" ? "suspended" : "active";

    const { error } = await (supabase as any)
      .from("organization_members")
      .update({ status: newStatus })
      .eq("user_id", data.user_id)
      .eq("organization_id", data.organization_id);

    if (error) return { success: false, error: error.message };

    // Audit log
    try {
      await (supabase as any).from("audit_logs").insert({
        organization_id: data.organization_id,
        actor_id: user.id,
        target_user_id: data.user_id,
        action: data.action,
        description: `Worker ${data.action === "suspend" ? "suspended" : "reactivated"}`,
        metadata: { new_status: newStatus },
      });
    } catch { /* non-fatal */ }

    revalidatePath(`/dashboard/workforce/team/${data.user_id}`);
    revalidatePath("/dashboard/workforce/team");
    return { success: true };
  } catch (e: any) {
    console.error("[workforce-dossier] toggleWorkerSuspension failed:", e);
    return { success: false, error: e?.message || "An unexpected error occurred" };
  }
}

/* ── Get Full Dossier (combines profile, creds, banking, availability) ── */

export async function getWorkerDossier(userId: string, orgId: string) {
  try {
    const supabase = await createServerSupabaseClient();

    // Parallel fetch all data
    const [staffResult, memberResult, profileResult, credsResult, scheduledResult] = await Promise.all([
      (supabase as any)
        .from("staff_profiles")
        .select("*")
        .eq("user_id", userId)
        .eq("organization_id", orgId)
        .maybeSingle(),
      (supabase as any)
        .from("organization_members")
        .select("role, branch, status, skills, hourly_rate, joined_at, last_active_at")
        .eq("user_id", userId)
        .eq("organization_id", orgId)
        .maybeSingle(),
      (supabase as any)
        .from("profiles")
        .select("full_name, email, avatar_url, phone")
        .eq("id", userId)
        .maybeSingle(),
      (supabase as any)
        .from("worker_credentials")
        .select("*")
        .eq("user_id", userId)
        .eq("organization_id", orgId)
        .order("credential_type"),
      (supabase as any)
        .from("schedule_blocks")
        .select("start_time, end_time")
        .eq("organization_id", orgId)
        .eq("technician_id", userId)
        .gte("start_time", getWeekStart(new Date()).toISOString())
        .lt("end_time", new Date(getWeekStart(new Date()).getTime() + 7 * 86400000).toISOString())
        .neq("status", "cancelled"),
    ]);

    const sp = staffResult.data;
    const member = memberResult.data;
    const profile = profileResult.data;
    const creds = credsResult.data || [];

    if (!profile || !member) return null;

    // Credential summary
    const today = new Date().toISOString().split("T")[0];
    const thirtyDaysOut = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];
    const credSummary = {
      total: creds.length,
      verified: creds.filter((c: any) => c.verification_status === "verified").length,
      expired: creds.filter((c: any) => c.verification_status === "expired" || (c.expiry_date && c.expiry_date < today)).length,
      pending: creds.filter((c: any) => c.verification_status === "pending").length,
      expiring_soon: creds.filter((c: any) => c.verification_status === "verified" && c.expiry_date && c.expiry_date >= today && c.expiry_date <= thirtyDaysOut).length,
    };

    // Weekly hours
    const weeklyHours = (scheduledResult.data || []).reduce((sum: number, b: any) => {
      return sum + (new Date(b.end_time).getTime() - new Date(b.start_time).getTime()) / 3600000;
    }, 0);

    return {
      user_id: userId,
      organization_id: orgId,
      full_name: profile.full_name || "",
      email: profile.email || "",
      avatar_url: profile.avatar_url || null,
      phone: profile.phone || null,
      role: member.role || "technician",
      branch: member.branch || "HQ",
      status: member.status || "active",
      skills: member.skills || [],
      hourly_rate: member.hourly_rate ? parseFloat(member.hourly_rate) : null,
      joined_at: member.joined_at || "",
      last_active_at: member.last_active_at || null,
      // Staff profile
      employment_type: sp?.employment_type || "casual",
      schads_level: sp?.schads_level || null,
      base_hourly_rate: sp?.base_hourly_rate ? parseFloat(sp.base_hourly_rate) : 0,
      max_weekly_hours: sp?.max_weekly_hours || 38,
      contracted_hours: sp?.contracted_hours || null,
      qualifications: sp?.qualifications || [],
      availability: sp?.availability || {},
      home_address: sp?.home_address || null,
      emergency_contact: sp?.emergency_contact || null,
      date_of_birth: sp?.date_of_birth || null,
      superannuation_fund: sp?.superannuation_fund || null,
      superannuation_number: sp?.superannuation_number || null,
      bank_account_name: sp?.bank_account_name || null,
      bank_bsb: sp?.bank_bsb || null,
      bank_account_number: sp?.bank_account_number || null,
      super_fund_name: sp?.super_fund_name || null,
      super_usi: sp?.super_usi || null,
      super_member_number: sp?.super_member_number || null,
      tfn_hash: sp?.tfn_hash || null,
      visa_status: sp?.visa_status || null,
      notes: sp?.notes || null,
      // Computed
      credential_summary: credSummary,
      credentials: creds.map((c: any) => ({
        id: c.id,
        credential_type: c.credential_type,
        credential_name: c.credential_name,
        document_url: c.document_url,
        issued_date: c.issued_date,
        expiry_date: c.expiry_date,
        verification_status: c.verification_status,
        verified_by: c.verified_by,
        verified_at: c.verified_at,
        notes: c.notes,
        created_at: c.created_at,
        updated_at: c.updated_at,
      })),
      weekly_hours_scheduled: Math.round(weeklyHours * 10) / 10,
    };
  } catch (e: any) {
    console.error("[workforce-dossier] getWorkerDossier failed:", e);
    return null;
  }
}

/* ── Helpers ──────────────────────────────────────────── */

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/* ── Types ────────────────────────────────────────────── */

export interface RosterTemplate {
  id: string;
  organization_id: string;
  participant_id: string;
  name: string;
  cycle_length_days: number;
  is_active: boolean;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  participant_name?: string;
  shift_count?: number;
}

export interface TemplateShift {
  id: string;
  template_id: string;
  organization_id: string;
  day_of_cycle: number;
  start_time: string;
  end_time: string;
  ndis_line_item: string | null;
  support_purpose: string | null;
  title: string | null;
  primary_worker_id: string | null;
  backup_worker_id: string | null;
  public_holiday_behavior: "proceed" | "cancel" | "flag";
  notes: string | null;
  // Joined
  primary_worker_name?: string;
  backup_worker_name?: string;
}

export interface RolloutConflict {
  template_shift_id: string;
  target_date: string;
  conflict_type: "leave" | "compliance" | "budget" | "plan_expiry" | "public_holiday" | "fatigue";
  severity: "hard_block" | "warning" | "info";
  message: string;
  details: Record<string, any>;
  resolution?: {
    type: "backup_worker" | "unassigned" | "skip" | "flag";
    backup_worker_id?: string;
    backup_worker_name?: string;
  };
}

export interface RolloutProjection {
  template_shift_id: string;
  target_date: string;
  start_datetime: string;
  end_datetime: string;
  assigned_worker_id: string | null;
  assigned_worker_name: string | null;
  participant_id: string;
  ndis_line_item: string | null;
  support_purpose: string | null;
  title: string | null;
  status: "ok" | "conflict" | "flagged" | "skipped";
  conflict?: RolloutConflict;
  is_public_holiday: boolean;
  public_holiday_behavior: string;
  projected_cost?: number;
  projected_revenue?: number;
}

export interface RolloutPreview {
  template_id: string;
  template_name: string;
  rollout_start: string;
  rollout_end: string;
  projections: RolloutProjection[];
  conflicts: RolloutConflict[];
  summary: {
    total: number;
    ok: number;
    conflicts: number;
    flagged: number;
    skipped: number;
  };
}

export interface StaffLeave {
  id: string;
  user_id: string;
  organization_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  status: string;
  notes: string | null;
  approved_by: string | null;
  approved_at: string | null;
  // Joined
  user_name?: string;
}

/* ── Roster Template CRUD ─────────────────────────────── */

export async function fetchRosterTemplates(
  orgId: string,
  participantId?: string,
): Promise<RosterTemplate[]> {
  const supabase = await createServerSupabaseClient();

  let query = (supabase as any)
    .from("roster_templates")
    .select(`
      *,
      participant_profiles!inner(
        clients!inner(name)
      ),
      template_shifts(id)
    `)
    .eq("organization_id", orgId)
    .order("updated_at", { ascending: false });

  if (participantId) query = query.eq("participant_id", participantId);

  const { data, error } = await query;
  if (error) return [];

  return (data || []).map((t: any) => ({
    ...t,
    participant_name: t.participant_profiles?.clients?.name || "Unknown",
    shift_count: t.template_shifts?.length || 0,
    participant_profiles: undefined,
    template_shifts: undefined,
  }));
}

export async function createRosterTemplate(data: {
  organization_id: string;
  participant_id: string;
  name: string;
  cycle_length_days: number;
  notes?: string;
  created_by?: string;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  const supabase = await createServerSupabaseClient();

  const { data: template, error } = await (supabase as any)
    .from("roster_templates")
    .insert(data)
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/roster/master");
  return { success: true, id: template.id };
}

export async function updateRosterTemplate(
  id: string,
  updates: Partial<Pick<RosterTemplate, "name" | "cycle_length_days" | "is_active" | "notes">>,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient();

  const { error } = await (supabase as any)
    .from("roster_templates")
    .update(updates)
    .eq("id", id);

  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/roster/master");
  return { success: true };
}

export async function deleteRosterTemplate(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient();

  const { error } = await (supabase as any)
    .from("roster_templates")
    .delete()
    .eq("id", id);

  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/roster/master");
  return { success: true };
}

/* ── Template Shift CRUD ──────────────────────────────── */

export async function fetchTemplateShifts(
  templateId: string,
): Promise<TemplateShift[]> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await (supabase as any)
    .from("template_shifts")
    .select(`
      *,
      primary_worker:profiles!template_shifts_primary_worker_id_fkey(full_name),
      backup_worker:profiles!template_shifts_backup_worker_id_fkey(full_name)
    `)
    .eq("template_id", templateId)
    .order("day_of_cycle")
    .order("start_time");

  if (error) return [];

  return (data || []).map((s: any) => ({
    ...s,
    primary_worker_name: s.primary_worker?.full_name || null,
    backup_worker_name: s.backup_worker?.full_name || null,
    primary_worker: undefined,
    backup_worker: undefined,
  }));
}

export async function createTemplateShift(data: {
  template_id: string;
  organization_id: string;
  day_of_cycle: number;
  start_time: string;
  end_time: string;
  ndis_line_item?: string;
  support_purpose?: string;
  title?: string;
  primary_worker_id?: string;
  backup_worker_id?: string;
  public_holiday_behavior?: string;
  notes?: string;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  const supabase = await createServerSupabaseClient();

  const { data: shift, error } = await (supabase as any)
    .from("template_shifts")
    .insert({
      ...data,
      public_holiday_behavior: data.public_holiday_behavior || "flag",
    })
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/roster/master");
  return { success: true, id: shift.id };
}

export async function updateTemplateShift(
  id: string,
  updates: Partial<Omit<TemplateShift, "id" | "template_id" | "organization_id">>,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient();

  const { error } = await (supabase as any)
    .from("template_shifts")
    .update(updates)
    .eq("id", id);

  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/roster/master");
  return { success: true };
}

export async function deleteTemplateShift(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient();

  const { error } = await (supabase as any)
    .from("template_shifts")
    .delete()
    .eq("id", id);

  if (error) return { success: false, error: error.message };
  revalidatePath("/dashboard/roster/master");
  return { success: true };
}

/* ── Bulk Worker Replacement ──────────────────────────── */

export async function bulkReplaceWorker(
  oldWorkerId: string,
  newWorkerId: string | null,
  orgId: string,
  scope: "primary" | "backup" | "both",
): Promise<{ success: boolean; updated: number; error?: string }> {
  const supabase = await createServerSupabaseClient();
  let updated = 0;

  if (scope === "primary" || scope === "both") {
    const { count } = await (supabase as any)
      .from("template_shifts")
      .update({ primary_worker_id: newWorkerId })
      .eq("organization_id", orgId)
      .eq("primary_worker_id", oldWorkerId)
      .select("id", { count: "exact", head: true });
    updated += count || 0;
  }

  if (scope === "backup" || scope === "both") {
    const { count } = await (supabase as any)
      .from("template_shifts")
      .update({ backup_worker_id: newWorkerId })
      .eq("organization_id", orgId)
      .eq("backup_worker_id", oldWorkerId)
      .select("id", { count: "exact", head: true });
    updated += count || 0;
  }

  revalidatePath("/dashboard/roster/master");
  return { success: true, updated };
}

/* ── Staff Leave ──────────────────────────────────────── */

export async function fetchStaffLeave(
  orgId: string,
  options?: { userId?: string; startDate?: string; endDate?: string; status?: string },
): Promise<StaffLeave[]> {
  const supabase = await createServerSupabaseClient();

  let query = (supabase as any)
    .from("staff_leave")
    .select("*, profiles!staff_leave_user_id_fkey(full_name)")
    .eq("organization_id", orgId)
    .order("start_date", { ascending: true });

  if (options?.userId) query = query.eq("user_id", options.userId);
  if (options?.status) query = query.eq("status", options.status);
  if (options?.startDate) query = query.gte("end_date", options.startDate);
  if (options?.endDate) query = query.lte("start_date", options.endDate);

  const { data } = await query;
  return (data || []).map((l: any) => ({
    ...l,
    user_name: l.profiles?.full_name || "Unknown",
    profiles: undefined,
  }));
}

export async function createStaffLeave(data: {
  organization_id: string;
  user_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  notes?: string;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  const supabase = await createServerSupabaseClient();

  const { data: leave, error } = await (supabase as any)
    .from("staff_leave")
    .insert({ ...data, status: "pending" })
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, id: leave.id };
}

export async function approveStaffLeave(
  leaveId: string,
  approverId: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createServerSupabaseClient();

  const { error } = await (supabase as any)
    .from("staff_leave")
    .update({
      status: "approved",
      approved_by: approverId,
      approved_at: new Date().toISOString(),
    })
    .eq("id", leaveId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

/* ── The Rollout Engine ───────────────────────────────── */

export async function generateRolloutPreview(
  templateId: string,
  orgId: string,
  rolloutStartDate: string,
  rolloutWeeks: number = 4,
): Promise<RolloutPreview> {
  const supabase = await createServerSupabaseClient();

  // 1. Fetch template + shifts
  const { data: template } = await (supabase as any)
    .from("roster_templates")
    .select("*, participant_profiles!inner(clients!inner(name))")
    .eq("id", templateId)
    .single();

  if (!template) throw new Error("Template not found");

  const { data: shifts } = await (supabase as any)
    .from("template_shifts")
    .select(`
      *,
      primary_worker:profiles!template_shifts_primary_worker_id_fkey(full_name),
      backup_worker:profiles!template_shifts_backup_worker_id_fkey(full_name)
    `)
    .eq("template_id", templateId)
    .order("day_of_cycle")
    .order("start_time");

  const templateShifts: any[] = shifts || [];
  const cycleLength = template.cycle_length_days;
  const start = new Date(rolloutStartDate);
  const totalDays = rolloutWeeks * 7;
  const endDate = new Date(start);
  endDate.setDate(endDate.getDate() + totalDays - 1);

  // 2. Fetch approved leave for all involved workers in the range
  const workerIds = new Set<string>();
  templateShifts.forEach((s: any) => {
    if (s.primary_worker_id) workerIds.add(s.primary_worker_id);
    if (s.backup_worker_id) workerIds.add(s.backup_worker_id);
  });

  const leaveMap = new Map<string, { start_date: string; end_date: string }[]>();
  if (workerIds.size > 0) {
    const { data: leaves } = await (supabase as any)
      .from("staff_leave")
      .select("user_id, start_date, end_date")
      .eq("organization_id", orgId)
      .eq("status", "approved")
      .lte("start_date", endDate.toISOString().split("T")[0])
      .gte("end_date", rolloutStartDate)
      .in("user_id", Array.from(workerIds));

    for (const l of (leaves || [])) {
      if (!leaveMap.has(l.user_id)) leaveMap.set(l.user_id, []);
      leaveMap.get(l.user_id)!.push({ start_date: l.start_date, end_date: l.end_date });
    }
  }

  // 3. Fetch public holidays
  const { data: holidays } = await (supabase as any)
    .from("public_holidays")
    .select("date, name, state")
    .eq("organization_id", orgId)
    .gte("date", rolloutStartDate)
    .lte("date", endDate.toISOString().split("T")[0]);

  const holidayDates = new Set<string>((holidays || []).map((h: any) => h.date));
  const holidayNames = new Map<string, string>(
    (holidays || []).map((h: any) => [h.date, h.name])
  );

  // 4. Fetch active service agreement for budget check
  const { data: agreement } = await (supabase as any)
    .from("service_agreements")
    .select("id, end_date, total_budget, consumed_budget, quarantined_budget")
    .eq("participant_id", template.participant_id)
    .eq("organization_id", orgId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  // 5. Fetch worker credentials for compliance checks
  const credentialStatus = new Map<string, boolean>();
  if (workerIds.size > 0) {
    const { data: creds } = await (supabase as any)
      .from("worker_credentials")
      .select("user_id, credential_type, status, expiry_date")
      .in("user_id", Array.from(workerIds))
      .in("credential_type", ["NDIS_SCREENING", "WWCC", "FIRST_AID"]);

    const requiredTypes = ["NDIS_SCREENING", "WWCC", "FIRST_AID"];
    for (const wid of workerIds) {
      const workerCreds = (creds || []).filter((c: any) => c.user_id === wid);
      const allValid = requiredTypes.every((t) => {
        const cred = workerCreds.find((c: any) => c.credential_type === t);
        return cred && cred.status === "verified" && (!cred.expiry_date || new Date(cred.expiry_date) > endDate);
      });
      credentialStatus.set(wid, allValid);
    }
  }

  // 6. Generate projections
  const projections: RolloutProjection[] = [];
  const conflicts: RolloutConflict[] = [];

  for (let dayOffset = 0; dayOffset < totalDays; dayOffset++) {
    const targetDate = new Date(start);
    targetDate.setDate(targetDate.getDate() + dayOffset);
    const dayOfCycle = (dayOffset % cycleLength) + 1;
    const dateStr = targetDate.toISOString().split("T")[0];
    const isHoliday = holidayDates.has(dateStr);

    const dayShifts = templateShifts.filter((s: any) => s.day_of_cycle === dayOfCycle);

    for (const shift of dayShifts) {
      const startDT = `${dateStr}T${shift.start_time}`;
      const endDT = `${dateStr}T${shift.end_time}`;

      // Public holiday check
      if (isHoliday && shift.public_holiday_behavior === "cancel") {
        projections.push({
          template_shift_id: shift.id,
          target_date: dateStr,
          start_datetime: startDT,
          end_datetime: endDT,
          assigned_worker_id: null,
          assigned_worker_name: null,
          participant_id: template.participant_id,
          ndis_line_item: shift.ndis_line_item,
          support_purpose: shift.support_purpose,
          title: shift.title,
          status: "skipped",
          is_public_holiday: true,
          public_holiday_behavior: shift.public_holiday_behavior,
        });
        continue;
      }

      let assignedWorkerId = shift.primary_worker_id;
      let assignedWorkerName = shift.primary_worker?.full_name || null;
      let status: RolloutProjection["status"] = "ok";
      let conflict: RolloutConflict | undefined;

      // Leave check
      if (assignedWorkerId) {
        const workerLeaves = leaveMap.get(assignedWorkerId) || [];
        const isOnLeave = workerLeaves.some(
          (l) => dateStr >= l.start_date && dateStr <= l.end_date
        );

        if (isOnLeave) {
          if (shift.backup_worker_id) {
            // Check if backup is also on leave
            const backupLeaves = leaveMap.get(shift.backup_worker_id) || [];
            const backupOnLeave = backupLeaves.some(
              (l) => dateStr >= l.start_date && dateStr <= l.end_date
            );

            if (!backupOnLeave) {
              assignedWorkerId = shift.backup_worker_id;
              assignedWorkerName = shift.backup_worker?.full_name || null;
              conflict = {
                template_shift_id: shift.id,
                target_date: dateStr,
                conflict_type: "leave",
                severity: "warning",
                message: `Primary worker on leave. Backup worker ${assignedWorkerName || "assigned"}.`,
                details: { original_worker: shift.primary_worker?.full_name },
                resolution: {
                  type: "backup_worker",
                  backup_worker_id: shift.backup_worker_id,
                  backup_worker_name: assignedWorkerName || undefined,
                },
              };
              status = "flagged";
            } else {
              assignedWorkerId = null;
              assignedWorkerName = null;
              conflict = {
                template_shift_id: shift.id,
                target_date: dateStr,
                conflict_type: "leave",
                severity: "hard_block",
                message: "Primary AND backup workers on leave. Shift requires cover.",
                details: {
                  primary: shift.primary_worker?.full_name,
                  backup: shift.backup_worker?.full_name,
                },
                resolution: { type: "unassigned" },
              };
              status = "conflict";
            }
          } else {
            assignedWorkerId = null;
            assignedWorkerName = null;
            conflict = {
              template_shift_id: shift.id,
              target_date: dateStr,
              conflict_type: "leave",
              severity: "hard_block",
              message: `Primary worker on leave. No backup assigned.`,
              details: { worker: shift.primary_worker?.full_name },
              resolution: { type: "unassigned" },
            };
            status = "conflict";
          }
        }
      }

      // Compliance check (credential expiry)
      if (assignedWorkerId && !credentialStatus.get(assignedWorkerId)) {
        const compConflict: RolloutConflict = {
          template_shift_id: shift.id,
          target_date: dateStr,
          conflict_type: "compliance",
          severity: "warning",
          message: "Worker has expired or missing mandatory credentials.",
          details: { worker_id: assignedWorkerId },
        };
        if (!conflict || conflict.severity !== "hard_block") {
          conflict = compConflict;
          status = status === "ok" ? "flagged" : status;
        }
        conflicts.push(compConflict);
      }

      // Public holiday flag
      if (isHoliday && shift.public_holiday_behavior === "flag") {
        const holConflict: RolloutConflict = {
          template_shift_id: shift.id,
          target_date: dateStr,
          conflict_type: "public_holiday",
          severity: "warning",
          message: `Public Holiday: ${holidayNames.get(dateStr) || "Unknown"}. 250% penalty rate applies.`,
          details: { holiday: holidayNames.get(dateStr), date: dateStr },
        };
        if (!conflict) {
          conflict = holConflict;
          status = "flagged";
        }
        conflicts.push(holConflict);
      }

      // Plan expiry check
      if (agreement && agreement.end_date && dateStr > agreement.end_date) {
        const planConflict: RolloutConflict = {
          template_shift_id: shift.id,
          target_date: dateStr,
          conflict_type: "plan_expiry",
          severity: "hard_block",
          message: "Service Agreement has expired. Cannot bill NDIS.",
          details: { agreement_end: agreement.end_date },
        };
        conflict = planConflict;
        status = "conflict";
        conflicts.push(planConflict);
      }

      // Budget check (simplified — check if total is close to limit)
      if (agreement) {
        const remaining = parseFloat(agreement.total_budget) -
          parseFloat(agreement.consumed_budget) -
          parseFloat(agreement.quarantined_budget);
        if (remaining <= 0) {
          const budgetConflict: RolloutConflict = {
            template_shift_id: shift.id,
            target_date: dateStr,
            conflict_type: "budget",
            severity: "hard_block",
            message: "Participant budget exhausted. Cannot schedule additional services.",
            details: {
              total: parseFloat(agreement.total_budget),
              consumed: parseFloat(agreement.consumed_budget),
              quarantined: parseFloat(agreement.quarantined_budget),
            },
          };
          conflict = budgetConflict;
          status = "conflict";
          conflicts.push(budgetConflict);
        }
      }

      if (conflict && !conflicts.includes(conflict)) conflicts.push(conflict);

      projections.push({
        template_shift_id: shift.id,
        target_date: dateStr,
        start_datetime: startDT,
        end_datetime: endDT,
        assigned_worker_id: assignedWorkerId,
        assigned_worker_name: assignedWorkerName,
        participant_id: template.participant_id,
        ndis_line_item: shift.ndis_line_item,
        support_purpose: shift.support_purpose,
        title: shift.title,
        status,
        conflict,
        is_public_holiday: isHoliday,
        public_holiday_behavior: shift.public_holiday_behavior,
      });
    }
  }

  const summary = {
    total: projections.length,
    ok: projections.filter((p) => p.status === "ok").length,
    conflicts: projections.filter((p) => p.status === "conflict").length,
    flagged: projections.filter((p) => p.status === "flagged").length,
    skipped: projections.filter((p) => p.status === "skipped").length,
  };

  return {
    template_id: templateId,
    template_name: template.name,
    rollout_start: rolloutStartDate,
    rollout_end: endDate.toISOString().split("T")[0],
    projections,
    conflicts,
    summary,
  };
}

/* ── Commit Rollout to Live ───────────────────────────── */

export async function commitRollout(
  preview: RolloutPreview,
  orgId: string,
  userId: string,
): Promise<{ success: boolean; committed: number; rollout_id?: string; error?: string }> {
  const supabase = await createServerSupabaseClient();

  // Create rollout log entry
  const { data: rolloutLog, error: logError } = await (supabase as any)
    .from("rollout_log")
    .insert({
      organization_id: orgId,
      template_id: preview.template_id,
      rollout_start_date: preview.rollout_start,
      rollout_end_date: preview.rollout_end,
      total_projected: preview.summary.total,
      total_committed: preview.summary.ok + preview.summary.flagged,
      total_conflicts: preview.summary.conflicts,
      conflicts_detail: preview.conflicts,
      status: "committed",
      committed_by: userId,
      committed_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (logError) return { success: false, committed: 0, error: logError.message };

  // Insert live schedule_blocks for all non-skipped, non-hard-blocked projections
  const blocksToInsert = preview.projections
    .filter((p) => p.status === "ok" || p.status === "flagged")
    .map((p) => ({
      organization_id: orgId,
      technician_id: p.assigned_worker_id,
      participant_id: p.participant_id,
      title: p.title || p.support_purpose || "Care Shift",
      start_time: p.start_datetime,
      end_time: p.end_datetime,
      status: p.assigned_worker_id ? "scheduled" : "scheduled",
      generated_from_template_id: p.template_shift_id,
      rollout_id: rolloutLog.id,
      metadata: {
        ndis_line_item: p.ndis_line_item,
        support_purpose: p.support_purpose,
        is_public_holiday: p.is_public_holiday,
        from_rollout: true,
      },
      notes: p.conflict
        ? `⚠ ${p.conflict.message}`
        : null,
    }));

  // Also create unassigned blocks for conflicts that need cover
  const unassignedBlocks = preview.projections
    .filter((p) => p.status === "conflict" && p.conflict?.resolution?.type === "unassigned")
    .map((p) => ({
      organization_id: orgId,
      technician_id: null,
      participant_id: p.participant_id,
      title: `⚠ REQUIRES COVER: ${p.title || p.support_purpose || "Care Shift"}`,
      start_time: p.start_datetime,
      end_time: p.end_datetime,
      status: "scheduled",
      generated_from_template_id: p.template_shift_id,
      rollout_id: rolloutLog.id,
      is_conflict: true,
      metadata: {
        ndis_line_item: p.ndis_line_item,
        requires_cover: true,
        conflict_reason: p.conflict?.message,
        from_rollout: true,
      },
    }));

  const allBlocks = [...blocksToInsert, ...unassignedBlocks];

  if (allBlocks.length > 0) {
    const { error: insertError } = await (supabase as any)
      .from("schedule_blocks")
      .insert(allBlocks);

    if (insertError) {
      // Update rollout log to failed
      await (supabase as any)
        .from("rollout_log")
        .update({ status: "failed" })
        .eq("id", rolloutLog.id);
      return { success: false, committed: 0, error: insertError.message };
    }
  }

  revalidatePath("/dashboard/schedule");
  revalidatePath("/dashboard/roster/master");
  return {
    success: true,
    committed: allBlocks.length,
    rollout_id: rolloutLog.id,
  };
}

/* ── NDIS Cancellation Logic ──────────────────────────── */

export async function cancelShiftWithNDISLogic(
  blockId: string,
  orgId: string,
  reason: string,
  forceShortNotice?: boolean,
): Promise<{
  success: boolean;
  cancellation_type: "standard" | "short_notice_billable";
  is_short_notice: boolean;
  error?: string;
}> {
  const supabase = await createServerSupabaseClient();

  // Fetch the block
  const { data: block } = await (supabase as any)
    .from("schedule_blocks")
    .select("id, start_time, end_time, technician_id, participant_id, metadata")
    .eq("id", blockId)
    .eq("organization_id", orgId)
    .single();

  if (!block) return { success: false, cancellation_type: "standard", is_short_notice: false, error: "Shift not found" };

  const scheduledStart = new Date(block.start_time);
  const now = new Date();
  const daysDifference = Math.floor((scheduledStart.getTime() - now.getTime()) / 86400000);
  const isShortNotice = daysDifference < 7;

  const cancellationType = (isShortNotice || forceShortNotice) ? "short_notice_billable" : "standard";

  // Update the block
  const { error } = await (supabase as any)
    .from("schedule_blocks")
    .update({
      status: "cancelled",
      is_short_notice_cancellation: isShortNotice || forceShortNotice,
      cancellation_reason: reason,
      cancellation_type: cancellationType,
      cancelled_at: new Date().toISOString(),
    })
    .eq("id", blockId);

  if (error) return { success: false, cancellation_type: "standard", is_short_notice: isShortNotice, error: error.message };

  // If standard cancellation, release quarantined budget
  if (cancellationType === "standard" && block.participant_id) {
    // Release budget from quarantine ledger
    await (supabase as any).rpc("release_shift_quarantine", { p_shift_id: blockId });
  }

  // If short notice billable, keep the quarantine but flag for NDIS claim
  if (cancellationType === "short_notice_billable") {
    // Worker still gets paid — the financial ledger stays intact
    // The PRODA billing engine picks up the cancellation_type flag
  }

  revalidatePath("/dashboard/schedule");
  return {
    success: true,
    cancellation_type: cancellationType,
    is_short_notice: isShortNotice,
  };
}

/* ── Exception Management: Apply Change Scope ─────────── */

export async function applyShiftChange(
  blockId: string,
  changes: { worker_id?: string },
  scope: "this_only" | "all_future",
  orgId: string,
): Promise<{ success: boolean; updated: number; error?: string }> {
  const supabase = await createServerSupabaseClient();

  if (scope === "this_only") {
    // Just update this single live block
    const updatePayload: Record<string, any> = {};
    if (changes.worker_id !== undefined) updatePayload.technician_id = changes.worker_id;

    const { error } = await (supabase as any)
      .from("schedule_blocks")
      .update(updatePayload)
      .eq("id", blockId);

    if (error) return { success: false, updated: 0, error: error.message };
    revalidatePath("/dashboard/schedule");
    return { success: true, updated: 1 };
  }

  if (scope === "all_future") {
    // Get the template shift ID from this block
    const { data: block } = await (supabase as any)
      .from("schedule_blocks")
      .select("generated_from_template_id, technician_id")
      .eq("id", blockId)
      .single();

    if (!block?.generated_from_template_id) {
      return { success: false, updated: 0, error: "This shift was not generated from a template." };
    }

    let updated = 0;

    // Update the template shift (primary worker)
    if (changes.worker_id !== undefined) {
      await (supabase as any)
        .from("template_shifts")
        .update({ primary_worker_id: changes.worker_id })
        .eq("id", block.generated_from_template_id);
    }

    // Update all future live blocks from this template shift
    const { count } = await (supabase as any)
      .from("schedule_blocks")
      .update({ technician_id: changes.worker_id })
      .eq("generated_from_template_id", block.generated_from_template_id)
      .eq("organization_id", orgId)
      .gt("start_time", new Date().toISOString())
      .neq("status", "cancelled")
      .select("id", { count: "exact", head: true });

    updated = (count || 0) + 1; // +1 for the template

    revalidatePath("/dashboard/schedule");
    revalidatePath("/dashboard/roster/master");
    return { success: true, updated };
  }

  return { success: false, updated: 0, error: "Invalid scope" };
}

/* ── Fetch Rollout History ────────────────────────────── */

export async function fetchRolloutHistory(
  orgId: string,
  limit: number = 20,
): Promise<any[]> {
  const supabase = await createServerSupabaseClient();

  const { data } = await (supabase as any)
    .from("rollout_log")
    .select("*, roster_templates(name, participant_profiles(clients(name)))")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data || []).map((r: any) => ({
    ...r,
    template_name: r.roster_templates?.name,
    participant_name: r.roster_templates?.participant_profiles?.clients?.name,
  }));
}

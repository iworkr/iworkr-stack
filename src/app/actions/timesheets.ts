/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ── Types ────────────────────────────────────────────────────────────────────

export interface Timesheet {
  id: string;
  organization_id: string;
  worker_id: string;
  period_start: string;
  period_end: string;
  status: "draft" | "submitted" | "approved" | "exported" | "adjustment";
  is_locked: boolean;
  total_hours: number;
  total_ordinary: number;
  total_overtime: number;
  total_leave: number;
  total_allowances: number;
  notes: string | null;
  approved_by: string | null;
  approved_at: string | null;
  exported_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  worker_name?: string;
  worker_email?: string;
  worker_avatar?: string | null;
  entry_count?: number;
  exception_count?: number;
}

export interface TimeEntry {
  id: string;
  organization_id: string;
  timesheet_id: string | null;
  shift_id: string | null;
  worker_id: string;
  clock_in: string;
  clock_out: string | null;
  clock_in_location: { lat: number; lng: number; accuracy_m?: number; is_verified?: boolean } | null;
  clock_out_location: { lat: number; lng: number; accuracy_m?: number; is_verified?: boolean } | null;
  total_hours: number | null;
  break_minutes: number;
  travel_minutes: number;
  travel_km: number;
  status: "active" | "completed" | "approved" | "disputed" | "auto_resolved";
  is_geofence_override: boolean;
  geofence_override_reason: string | null;
  is_manual_entry: boolean;
  is_auto_clock_out: boolean;
  scheduled_start: string | null;
  scheduled_end: string | null;
  variance_minutes: number;
  exception_type: string | null;
  exception_resolved: boolean;
  exception_resolved_by: string | null;
  exception_notes: string | null;
  award_interpretation: any;
  breaks: any[];
  allowances_captured: any[];
  is_leave_entry: boolean;
  leave_type: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  worker_name?: string;
  participant_name?: string;
}

export interface PayrollExport {
  id: string;
  organization_id: string;
  timesheet_ids: string[];
  target_platform: "xero" | "myob" | "keypay" | "csv";
  batch_status: "processing" | "success" | "partial_fail" | "failed";
  period_start: string;
  period_end: string;
  worker_count: number;
  total_hours: number;
  total_cost: number;
  api_response: any;
  error_details: any;
  exported_by: string | null;
  created_at: string;
}

// ── Timesheets CRUD ──────────────────────────────────────────────────────────

export async function fetchTimesheetsAction(
  organizationId: string,
  filters?: { status?: string; period_start?: string; worker_id?: string }
) {
  const supabase = await createServerSupabaseClient();
  let query = (supabase as any)
    .from("timesheets")
    .select("*, profiles!timesheets_worker_id_fkey(full_name, email, avatar_url)")
    .eq("organization_id", organizationId)
    .order("period_start", { ascending: false })
    .limit(200);

  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.period_start) query = query.eq("period_start", filters.period_start);
  if (filters?.worker_id) query = query.eq("worker_id", filters.worker_id);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data || []).map((ts: any) => ({
    ...ts,
    total_hours: parseFloat(ts.total_hours) || 0,
    total_ordinary: parseFloat(ts.total_ordinary) || 0,
    total_overtime: parseFloat(ts.total_overtime) || 0,
    total_leave: parseFloat(ts.total_leave) || 0,
    total_allowances: parseFloat(ts.total_allowances) || 0,
    worker_name: ts.profiles?.full_name || "Unknown",
    worker_email: ts.profiles?.email || "",
    worker_avatar: ts.profiles?.avatar_url,
  }));
}

export async function createTimesheetAction(input: {
  organization_id: string;
  worker_id: string;
  period_start: string;
  period_end: string;
}) {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await (supabase as any)
    .from("timesheets")
    .insert(input)
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/timesheets");
  return data;
}

export async function updateTimesheetStatusAction(
  id: string,
  status: string,
  lock?: boolean
) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const updates: any = { status, updated_at: new Date().toISOString() };
  if (status === "approved") {
    updates.approved_by = user.id;
    updates.approved_at = new Date().toISOString();
  }
  if (status === "exported") {
    updates.exported_at = new Date().toISOString();
    updates.is_locked = true;
  }
  if (lock !== undefined) {
    updates.is_locked = lock;
  }

  const { data, error } = await (supabase as any)
    .from("timesheets")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/timesheets");
  return data;
}

export async function bulkApproveTimesheetsAction(ids: string[]) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data, error } = await (supabase as any)
    .from("timesheets")
    .update({
      status: "approved",
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .in("id", ids)
    .eq("is_locked", false)
    .select();

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/timesheets");
  return data;
}

// ── Time Entries CRUD ────────────────────────────────────────────────────────

export async function fetchTimeEntriesAction(
  organizationId: string,
  filters?: {
    timesheet_id?: string;
    worker_id?: string;
    status?: string;
    has_exception?: boolean;
    date_from?: string;
    date_to?: string;
  }
) {
  const supabase = await createServerSupabaseClient();
  let query = (supabase as any)
    .from("time_entries")
    .select("*, profiles!time_entries_worker_id_fkey(full_name)")
    .eq("organization_id", organizationId)
    .order("clock_in", { ascending: false })
    .limit(500);

  if (filters?.timesheet_id) query = query.eq("timesheet_id", filters.timesheet_id);
  if (filters?.worker_id) query = query.eq("worker_id", filters.worker_id);
  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.has_exception) query = query.not("exception_type", "is", null);
  if (filters?.date_from) query = query.gte("clock_in", filters.date_from);
  if (filters?.date_to) query = query.lte("clock_in", filters.date_to);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data || []).map((e: any) => ({
    ...e,
    total_hours: e.total_hours != null ? parseFloat(e.total_hours) : null,
    travel_km: parseFloat(e.travel_km) || 0,
    worker_name: e.profiles?.full_name || "Unknown",
  }));
}

export async function createTimeEntryAction(input: {
  organization_id: string;
  worker_id: string;
  timesheet_id?: string;
  shift_id?: string;
  clock_in: string;
  clock_out?: string;
  clock_in_location?: any;
  clock_out_location?: any;
  scheduled_start?: string;
  scheduled_end?: string;
  is_manual_entry?: boolean;
  is_leave_entry?: boolean;
  leave_type?: string;
  notes?: string;
}) {
  const supabase = await createServerSupabaseClient();

  // Calculate total hours if clock_out provided
  let total_hours = null;
  let variance_minutes = 0;
  let exception_type = null;

  if (input.clock_out) {
    const diffMs = new Date(input.clock_out).getTime() - new Date(input.clock_in).getTime();
    total_hours = Math.round((diffMs / 3600000) * 100) / 100;
  }

  // Calculate variance from schedule
  if (input.scheduled_start && input.scheduled_end && input.clock_in) {
    const scheduledStart = new Date(input.scheduled_start).getTime();
    const actualStart = new Date(input.clock_in).getTime();
    const startVariance = Math.round((actualStart - scheduledStart) / 60000);

    if (input.clock_out && input.scheduled_end) {
      const scheduledEnd = new Date(input.scheduled_end).getTime();
      const actualEnd = new Date(input.clock_out).getTime();
      const endVariance = Math.round((actualEnd - scheduledEnd) / 60000);
      variance_minutes = Math.max(Math.abs(startVariance), Math.abs(endVariance));

      if (startVariance > 15) exception_type = "late_start";
      else if (endVariance < -15) exception_type = "early_finish";
      else if (endVariance > 15) exception_type = "overtime";
    }
  }

  const status = input.clock_out ? "completed" : "active";

  const { data, error } = await (supabase as any)
    .from("time_entries")
    .insert({
      ...input,
      total_hours,
      variance_minutes,
      exception_type,
      status,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/timesheets");
  return data;
}

export async function clockOutAction(
  entryId: string,
  clockOut: string,
  location?: any,
  allowances?: any[]
) {
  const supabase = await createServerSupabaseClient();

  // Get the entry to calculate hours
  const { data: entry } = await (supabase as any)
    .from("time_entries")
    .select("clock_in, scheduled_end")
    .eq("id", entryId)
    .single();

  if (!entry) throw new Error("Time entry not found");

  const diffMs = new Date(clockOut).getTime() - new Date(entry.clock_in).getTime();
  const total_hours = Math.round((diffMs / 3600000) * 100) / 100;

  // Check for variance
  let variance_minutes = 0;
  let exception_type = null;
  if (entry.scheduled_end) {
    const scheduledEnd = new Date(entry.scheduled_end).getTime();
    const actualEnd = new Date(clockOut).getTime();
    const endVariance = Math.round((actualEnd - scheduledEnd) / 60000);
    variance_minutes = Math.abs(endVariance);
    if (endVariance > 15) exception_type = "overtime";
    else if (endVariance < -15) exception_type = "early_finish";
  }

  // Auto-clock-out detection (>4h past scheduled end)
  const is_auto_clock_out = entry.scheduled_end
    ? (new Date(clockOut).getTime() - new Date(entry.scheduled_end).getTime()) > 4 * 3600000
    : false;

  const updates: any = {
    clock_out: clockOut,
    clock_out_location: location || null,
    total_hours,
    variance_minutes,
    exception_type,
    status: "completed",
    is_auto_clock_out,
    updated_at: new Date().toISOString(),
  };

  if (allowances && allowances.length > 0) {
    updates.allowances_captured = allowances;
  }

  const { data, error } = await (supabase as any)
    .from("time_entries")
    .update(updates)
    .eq("id", entryId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/timesheets");
  return data;
}

export async function resolveExceptionAction(
  entryId: string,
  resolution: "approve" | "truncate" | "dispute",
  notes?: string
) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const updates: any = {
    exception_resolved: true,
    exception_resolved_by: user.id,
    exception_notes: notes || null,
    updated_at: new Date().toISOString(),
  };

  if (resolution === "approve") {
    updates.status = "approved";
  } else if (resolution === "truncate") {
    // Get original entry for scheduled_end
    const { data: entry } = await (supabase as any)
      .from("time_entries")
      .select("clock_in, scheduled_end, break_minutes")
      .eq("id", entryId)
      .single();

    if (entry?.scheduled_end) {
      const diffMs = new Date(entry.scheduled_end).getTime() - new Date(entry.clock_in).getTime();
      updates.clock_out = entry.scheduled_end;
      updates.total_hours = Math.round(((diffMs / 3600000) - (entry.break_minutes || 0) / 60) * 100) / 100;
      updates.variance_minutes = 0;
      updates.exception_type = null;
    }
    updates.status = "approved";
  } else {
    updates.status = "disputed";
  }

  const { data, error } = await (supabase as any)
    .from("time_entries")
    .update(updates)
    .eq("id", entryId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/timesheets");
  return data;
}

export async function createManualTimeEntryAction(input: {
  organization_id: string;
  worker_id: string;
  timesheet_id?: string;
  clock_in: string;
  clock_out: string;
  notes?: string;
}) {
  const diffMs = new Date(input.clock_out).getTime() - new Date(input.clock_in).getTime();
  const total_hours = Math.round((diffMs / 3600000) * 100) / 100;

  const supabase = await createServerSupabaseClient();
  const { data, error } = await (supabase as any)
    .from("time_entries")
    .insert({
      ...input,
      total_hours,
      status: "completed",
      is_manual_entry: true,
      exception_notes: input.notes,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/timesheets");
  return data;
}

// ── Payroll Exports ──────────────────────────────────────────────────────────

export async function fetchPayrollExportsAction(organizationId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await (supabase as any)
    .from("payroll_exports")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message);
  return (data || []).map((e: any) => ({
    ...e,
    total_hours: parseFloat(e.total_hours) || 0,
    total_cost: parseFloat(e.total_cost) || 0,
  }));
}

export async function createPayrollExportAction(input: {
  organization_id: string;
  timesheet_ids: string[];
  target_platform: "xero" | "myob" | "keypay" | "csv";
  period_start: string;
  period_end: string;
}) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  // Calculate summary stats from timesheets
  const { data: timesheets } = await (supabase as any)
    .from("timesheets")
    .select("total_hours, worker_id")
    .in("id", input.timesheet_ids);

  const worker_count = new Set((timesheets || []).map((t: any) => t.worker_id)).size;
  const total_hours = (timesheets || []).reduce((sum: number, t: any) => sum + (parseFloat(t.total_hours) || 0), 0);

  const { data, error } = await (supabase as any)
    .from("payroll_exports")
    .insert({
      ...input,
      worker_count,
      total_hours,
      exported_by: user.id,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  // Lock the exported timesheets
  await (supabase as any)
    .from("timesheets")
    .update({
      status: "exported",
      is_locked: true,
      exported_at: new Date().toISOString(),
    })
    .in("id", input.timesheet_ids);

  revalidatePath("/dashboard/timesheets");
  return data;
}

// ── Timesheet Adjustments ────────────────────────────────────────────────────

export async function createTimesheetAdjustmentAction(input: {
  organization_id: string;
  original_entry_id: string;
  adjustment_type: string;
  reason: string;
  old_values: any;
  new_values: any;
}) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data, error } = await (supabase as any)
    .from("timesheet_adjustments")
    .insert({ ...input, created_by: user.id })
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/timesheets");
  return data;
}

export async function fetchTimesheetAdjustmentsAction(organizationId: string, entryId?: string) {
  const supabase = await createServerSupabaseClient();
  let query = (supabase as any)
    .from("timesheet_adjustments")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (entryId) query = query.eq("original_entry_id", entryId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}

// ── Summary Stats ────────────────────────────────────────────────────────────

export async function fetchTimesheetSummaryAction(organizationId: string, periodStart?: string) {
  const supabase = await createServerSupabaseClient();

  // Get timesheet counts by status
  const { data: timesheets } = await (supabase as any)
    .from("timesheets")
    .select("id, status, total_hours, total_overtime")
    .eq("organization_id", organizationId)
    .order("period_start", { ascending: false })
    .limit(500);

  // Get unresolved exceptions
  const { data: exceptions } = await (supabase as any)
    .from("time_entries")
    .select("id, exception_type")
    .eq("organization_id", organizationId)
    .eq("exception_resolved", false)
    .not("exception_type", "is", null)
    .limit(200);

  const statusCounts: Record<string, number> = {};
  let totalHours = 0;
  let totalOvertime = 0;

  (timesheets || []).forEach((ts: any) => {
    statusCounts[ts.status] = (statusCounts[ts.status] || 0) + 1;
    totalHours += parseFloat(ts.total_hours) || 0;
    totalOvertime += parseFloat(ts.total_overtime) || 0;
  });

  return {
    statusCounts,
    totalHours: Math.round(totalHours * 100) / 100,
    totalOvertime: Math.round(totalOvertime * 100) / 100,
    totalTimesheets: (timesheets || []).length,
    unresolvedExceptions: (exceptions || []).length,
    exceptionsByType: (exceptions || []).reduce((acc: Record<string, number>, e: any) => {
      acc[e.exception_type] = (acc[e.exception_type] || 0) + 1;
      return acc;
    }, {}),
  };
}

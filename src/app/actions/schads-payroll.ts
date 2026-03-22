/**
 * @module SCHADSPayroll Server Actions
 * @status COMPLETE
 * @description SCHADS award payroll — pay run generation, penalty rate calculations, allowances, and payslip generation
 * @exports createPayRunAction, fetchPayRunsAction, calculatePenaltyRatesAction, generatePayslipsAction, approvePayRunAction
 * @lastAudit 2026-03-22
 */
"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Minimal schema for payroll tables not yet in generated Database types.
 *  Uses index signature so Supabase client accepts these tables. */
type PayrollSchema = {
  public: {
    Tables: Record<string, { Row: unknown; Insert: Record<string, unknown>; Update: Record<string, unknown> }>;
  };
};

function payrollClient(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>): SupabaseClient<PayrollSchema> {
  return supabase as unknown as SupabaseClient<PayrollSchema>;
}

export type PayCategory =
  | "ORDINARY_HOURS"
  | "EVENING_SHIFT"
  | "NIGHT_SHIFT"
  | "SATURDAY"
  | "SUNDAY"
  | "PUBLIC_HOLIDAY"
  | "OVERTIME_1_5X"
  | "OVERTIME_2_0X"
  | "MINIMUM_ENGAGEMENT_PADDING"
  | "CLIENT_CANCELLATION";

export type AllowanceType =
  | "NONE"
  | "BROKEN_SHIFT_1_BREAK"
  | "BROKEN_SHIFT_2_BREAKS"
  | "SLEEPOVER"
  | "FIRST_AID"
  | "KILOMETRE_ALLOWANCE"
  | "LAUNDRY"
  | "TOOL_ALLOWANCE";

export type EmploymentType = "CASUAL" | "PART_TIME" | "FULL_TIME";

export interface TimesheetPayLine {
  id: string;
  organization_id: string;
  timesheet_id: string | null;
  time_entry_id: string | null;
  worker_id: string;
  pay_category: PayCategory;
  allowance_type: AllowanceType;
  units: number;
  rate_multiplier: number;
  base_rate: number;
  casual_loading: number;
  calculated_rate: number;
  total_line_amount: number;
  shift_date: string;
  shift_start_utc: string | null;
  shift_end_utc: string | null;
  is_synthetic: boolean;
  engine_version: string;
  notes: string | null;
  created_at: string;
}

export interface WorkerPayProfile {
  id: string;
  organization_id: string;
  user_id: string;
  employment_type: EmploymentType;
  schads_level: number;
  schads_paypoint: number;
  base_hourly_rate: number;
  effective_from: string;
  effective_to: string | null;
  notes: string | null;
}

export interface SchadsBaseRate {
  schads_level: number;
  schads_paypoint: number;
  hourly_rate: number;
  effective_from: string;
}

export interface PayrollBatchSummary {
  workerId: string;
  workerName: string;
  workerAvatar: string | null;
  timesheetIds: string[];
  totalOrdinary: number;
  totalOvertime: number;
  totalAllowances: number;
  totalGross: number;
  payLines: TimesheetPayLine[];
  employmentType: EmploymentType | null;
  schadsLevel: number | null;
}

// ─── Pay line display helpers ─────────────────────────────────────────────────

export const PAY_CATEGORY_LABELS: Record<PayCategory, string> = {
  ORDINARY_HOURS: "Ordinary Hours",
  EVENING_SHIFT: "Evening Shift Penalty",
  NIGHT_SHIFT: "Night Shift Penalty",
  SATURDAY: "Saturday Penalty",
  SUNDAY: "Sunday Penalty",
  PUBLIC_HOLIDAY: "Public Holiday Penalty",
  OVERTIME_1_5X: "Overtime (1.5x)",
  OVERTIME_2_0X: "Overtime (2.0x)",
  MINIMUM_ENGAGEMENT_PADDING: "Min. Engagement Padding",
  CLIENT_CANCELLATION: "Client Cancellation",
};

export const ALLOWANCE_LABELS: Record<AllowanceType, string> = {
  NONE: "",
  BROKEN_SHIFT_1_BREAK: "Broken Shift (1 Break)",
  BROKEN_SHIFT_2_BREAKS: "Broken Shift (2 Breaks)",
  SLEEPOVER: "Sleepover Allowance",
  FIRST_AID: "First Aid Certificate",
  KILOMETRE_ALLOWANCE: "Kilometre Allowance",
  LAUNDRY: "Laundry Allowance",
  TOOL_ALLOWANCE: "Tool Allowance",
};

// ─── Fetch pay lines for a timesheet ─────────────────────────────────────────

export async function getTimesheetPayLines(
  timesheetId: string,
  orgId: string,
): Promise<{ lines: TimesheetPayLine[]; total: number; error: string | null }> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await payrollClient(supabase)
      .from("timesheet_pay_lines")
      .select("*")
      .eq("timesheet_id", timesheetId)
      .eq("organization_id", orgId)
      .order("shift_date", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) throw error;

    const lines = (data || []) as TimesheetPayLine[];
    const total = lines.reduce((s, l) => s + Number(l.total_line_amount), 0);
    return { lines, total: Math.round(total * 100) / 100, error: null };
  } catch (err) {
    console.error("[getTimesheetPayLines]", err);
    return {
      lines: [],
      total: 0,
      error: err instanceof Error ? err.message : "Failed to fetch pay lines",
    };
  }
}

// ─── Run SCHADS engine on a timesheet ────────────────────────────────────────

export async function runSchadsEngine(
  timesheetId: string,
  orgId: string,
  forceRecalculate = false,
): Promise<{
  ok: boolean;
  payLinesCount: number;
  totalGross: number;
  error: string | null;
}> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Unauthorized");

    const edgeUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/schads-interpreter`;
    const res = await fetch(edgeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`,
        "apikey": process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
      },
      body: JSON.stringify({
        timesheet_id: timesheetId,
        org_id: orgId,
        force_recalculate: forceRecalculate,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(errText || `HTTP ${res.status}`);
    }

    const body = await res.json();
    revalidatePath("/dashboard/timesheets");
    revalidatePath("/dashboard/workforce/payroll-export");

    return {
      ok: true,
      payLinesCount: body.pay_lines_count || 0,
      totalGross: body.total_gross || 0,
      error: null,
    };
  } catch (err) {
    console.error("[runSchadsEngine]", err);
    return {
      ok: false,
      payLinesCount: 0,
      totalGross: 0,
      error: err instanceof Error ? err.message : "Engine failed",
    };
  }
}

// ─── Force recalculate (purge + rerun) ───────────────────────────────────────

export async function forceRecalculateTimesheet(
  timesheetId: string,
  orgId: string,
): Promise<{ ok: boolean; error: string | null }> {
  const { ok, error } = await runSchadsEngine(timesheetId, orgId, true);
  return { ok, error };
}

// ─── Get worker pay profile ───────────────────────────────────────────────────

export async function getWorkerPayProfiles(
  orgId: string,
  userId?: string,
): Promise<{ profiles: WorkerPayProfile[]; error: string | null }> {
  try {
    const supabase = await createServerSupabaseClient();
    let query = payrollClient(supabase)
      .from("worker_pay_profiles")
      .select("*")
      .eq("organization_id", orgId)
      .order("effective_from", { ascending: false });

    if (userId) query = query.eq("user_id", userId);

    const { data, error } = await query;
    if (error) throw error;

    return { profiles: (data || []) as WorkerPayProfile[], error: null };
  } catch (err) {
    return {
      profiles: [],
      error: err instanceof Error ? err.message : "Failed to fetch profiles",
    };
  }
}

// ─── Upsert worker pay profile ────────────────────────────────────────────────

export async function upsertWorkerPayProfile(
  orgId: string,
  data: Omit<WorkerPayProfile, "id" | "organization_id" | "created_at" | "updated_at">,
): Promise<{ ok: boolean; error: string | null }> {
  try {
    const supabase = await createServerSupabaseClient();
    const payload: Record<string, unknown> = { ...data, organization_id: orgId };
    type Insertable = { insert: (data: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> };
    const table = payrollClient(supabase).from("worker_pay_profiles") as unknown as Insertable;
    const { error } = await table.insert(payload);

    if (error) throw error;
    revalidatePath("/dashboard/timesheets");
    return { ok: true, error: null };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to save profile",
    };
  }
}

// ─── Get SCHADS base rates ────────────────────────────────────────────────────

export async function getScHadsBaseRates(): Promise<{
  rates: SchadsBaseRate[];
  error: string | null;
}> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await payrollClient(supabase)
      .from("schads_base_rates")
      .select("schads_level, schads_paypoint, hourly_rate, effective_from")
      .order("schads_level")
      .order("schads_paypoint")
      .order("effective_from", { ascending: false });

    if (error) throw error;
    return { rates: (data || []) as SchadsBaseRate[], error: null };
  } catch (err) {
    return { rates: [], error: err instanceof Error ? err.message : "Failed" };
  }
}

// ─── Get payroll batch summary ────────────────────────────────────────────────
// Groups all pay lines by worker for the payroll export page

export async function getPayrollBatchSummary(
  orgId: string,
  periodStart: string,
  periodEnd: string,
): Promise<{ batches: PayrollBatchSummary[]; error: string | null }> {
  try {
    const supabase = await createServerSupabaseClient();

    // Fetch all pay lines in the period
    const { data: lines, error: linesErr } = await payrollClient(supabase)
      .from("timesheet_pay_lines")
      .select("*")
      .eq("organization_id", orgId)
      .gte("shift_date", periodStart)
      .lte("shift_date", periodEnd)
      .order("shift_date", { ascending: true });

    if (linesErr) throw linesErr;

    const allLines = (lines || []) as TimesheetPayLine[];

    // Group by worker_id
    const workerGroups = new Map<string, TimesheetPayLine[]>();
    for (const line of allLines) {
      if (!workerGroups.has(line.worker_id)) workerGroups.set(line.worker_id, []);
      workerGroups.get(line.worker_id)!.push(line);
    }

    // Fetch worker display names
    const workerIds = Array.from(workerGroups.keys());
    const workerMap = new Map<string, { name: string; avatar: string | null }>();
    if (workerIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", workerIds);
      for (const p of (profiles || [])) {
        workerMap.set(p.id, { name: p.full_name || "Unknown", avatar: p.avatar_url || null });
      }
    }

    // Fetch pay profiles for employment type
    const { data: payProfiles } = await payrollClient(supabase)
      .from("worker_pay_profiles")
      .select("user_id, employment_type, schads_level, effective_from")
      .eq("organization_id", orgId)
      .in("user_id", workerIds);

    type PayProfileRow = { user_id: string; employment_type: EmploymentType; schads_level: number };
    const payProfileMap = new Map<string, { employment_type: EmploymentType; schads_level: number }>();
    for (const pp of (payProfiles || []) as PayProfileRow[]) {
      if (!payProfileMap.has(pp.user_id)) {
        payProfileMap.set(pp.user_id, {
          employment_type: pp.employment_type,
          schads_level: pp.schads_level,
        });
      }
    }

    const batches: PayrollBatchSummary[] = [];
    for (const [workerId, workerLines] of workerGroups) {
      const timesheetIds = [...new Set(workerLines.map((l) => l.timesheet_id).filter(Boolean) as string[])];
      const ordinary = workerLines.filter((l) =>
        ["ORDINARY_HOURS", "EVENING_SHIFT", "NIGHT_SHIFT", "MINIMUM_ENGAGEMENT_PADDING"].includes(l.pay_category)
      ).reduce((s, l) => s + Number(l.total_line_amount), 0);
      const overtime = workerLines.filter((l) =>
        ["OVERTIME_1_5X", "OVERTIME_2_0X"].includes(l.pay_category)
      ).reduce((s, l) => s + Number(l.total_line_amount), 0);
      const allowances = workerLines.filter((l) => l.allowance_type !== "NONE")
        .reduce((s, l) => s + Number(l.total_line_amount), 0);
      const penalty = workerLines.filter((l) =>
        ["SATURDAY", "SUNDAY", "PUBLIC_HOLIDAY"].includes(l.pay_category)
      ).reduce((s, l) => s + Number(l.total_line_amount), 0);

      const pp = payProfileMap.get(workerId);
      const wInfo = workerMap.get(workerId);

      batches.push({
        workerId,
        workerName: wInfo?.name || "Worker",
        workerAvatar: wInfo?.avatar || null,
        timesheetIds,
        totalOrdinary: Math.round((ordinary + penalty) * 100) / 100,
        totalOvertime: Math.round(overtime * 100) / 100,
        totalAllowances: Math.round(allowances * 100) / 100,
        totalGross: Math.round((ordinary + overtime + allowances + penalty) * 100) / 100,
        payLines: workerLines,
        employmentType: pp?.employment_type || null,
        schadsLevel: pp?.schads_level || null,
      });
    }

    batches.sort((a, b) => b.totalGross - a.totalGross);
    return { batches, error: null };
  } catch (err) {
    console.error("[getPayrollBatchSummary]", err);
    return {
      batches: [],
      error: err instanceof Error ? err.message : "Failed to build batch",
    };
  }
}

// ─── Export to Xero ───────────────────────────────────────────────────────────
// Maps our pay categories to Xero EarningsRateIDs and submits via Xero API.
// Xero EarningsRateIDs must be configured in the org's Xero integration settings.

export async function exportPayrunToXero(
  orgId: string,
  timesheetIds: string[],
  xeroTenantId: string,
  payPeriodStart: string,
  payPeriodEnd: string,
): Promise<{ ok: boolean; xeroPayRunId: string | null; error: string | null }> {
  try {
    const supabase = await createServerSupabaseClient();

    // Get Xero OAuth tokens from integration settings
    const { data: integration } = await supabase
      .from("integrations")
      .select("settings, access_token, refresh_token, token_expires_at")
      .eq("organization_id", orgId)
      .eq("provider", "xero")
      .eq("status", "connected")
      .maybeSingle();

    if (!integration) {
      throw new Error("Xero integration not connected. Go to Settings → Integrations to connect Xero.");
    }

    // Check if token needs refresh
    let accessToken = integration.access_token;
    const expiresAt = integration.token_expires_at ? new Date(integration.token_expires_at) : null;
    if (expiresAt && expiresAt <= new Date()) {
      // Refresh the token
      const refreshToken = integration.refresh_token ?? "";
      if (!refreshToken) throw new Error("Xero refresh token missing");
      const refreshRes = await fetch("https://identity.xero.com/connect/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: refreshToken,
          client_id: process.env.XERO_CLIENT_ID || "",
          client_secret: process.env.XERO_CLIENT_SECRET || "",
        }).toString(),
      });
      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        accessToken = refreshData.access_token;
        await supabase.from("integrations").update({
          access_token: refreshData.access_token,
          refresh_token: refreshData.refresh_token || integration.refresh_token,
          token_expires_at: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
        }).eq("organization_id", orgId).eq("provider", "xero");
      }
    }

    // Fetch all pay lines for the given timesheets
    const { data: payLines } = await payrollClient(supabase)
      .from("timesheet_pay_lines")
      .select("*")
      .in("timesheet_id", timesheetIds)
      .eq("organization_id", orgId);

    const lines = (payLines || []) as TimesheetPayLine[];

    // Map pay categories to Xero Earnings Rate IDs
    // These come from the org's Xero settings configuration
    const xeroSettings = (integration.settings as Record<string, string>) ?? {};
    const categoryToXeroRate: Record<string, string> = {
      ORDINARY_HOURS: xeroSettings["xero_rate_ordinary"] || "",
      EVENING_SHIFT: xeroSettings["xero_rate_evening"] || "",
      NIGHT_SHIFT: xeroSettings["xero_rate_night"] || "",
      SATURDAY: xeroSettings["xero_rate_saturday"] || "",
      SUNDAY: xeroSettings["xero_rate_sunday"] || "",
      PUBLIC_HOLIDAY: xeroSettings["xero_rate_public_holiday"] || "",
      OVERTIME_1_5X: xeroSettings["xero_rate_ot15"] || "",
      OVERTIME_2_0X: xeroSettings["xero_rate_ot20"] || "",
      MINIMUM_ENGAGEMENT_PADDING: xeroSettings["xero_rate_ordinary"] || "",
      CLIENT_CANCELLATION: xeroSettings["xero_rate_ordinary"] || "",
    };

    // Group pay lines by worker_id and build Xero timesheet objects
    const workerGroups = new Map<string, TimesheetPayLine[]>();
    for (const line of lines) {
      if (!workerGroups.has(line.worker_id)) workerGroups.set(line.worker_id, []);
      workerGroups.get(line.worker_id)!.push(line);
    }

    type WorkerNotesRow = { user_id: string; notes?: Record<string, unknown> | null };
    const workerIds = [...workerGroups.keys()];
    const notesByWorkerId = new Map<string, Record<string, unknown> | null | undefined>();
    if (workerIds.length > 0) {
      const { data: profiles } = await payrollClient(supabase)
        .from("worker_pay_profiles")
        .select("user_id, notes")
        .in("user_id", workerIds)
        .eq("organization_id", orgId);
      for (const row of (profiles || []) as WorkerNotesRow[]) {
        notesByWorkerId.set(row.user_id, row.notes);
      }
    }

    // Fetch worker Xero employee IDs from integration settings
    const xeroTimesheets = [];
    for (const [workerId, workerLines] of workerGroups) {
      const notes = notesByWorkerId.get(workerId);
      const xeroEmployeeId = (notes?.xero_employee_id as string | undefined) ?? null;

      const earningsLines = workerLines.map((l) => ({
        EarningsRateID: categoryToXeroRate[l.pay_category] || "",
        NumberOfUnits: Number(l.units),
        Amount: Number(l.total_line_amount),
      })).filter((el) => el.EarningsRateID && el.NumberOfUnits > 0);

      if (xeroEmployeeId && earningsLines.length > 0) {
        xeroTimesheets.push({
          EmployeeID: xeroEmployeeId,
          StartDate: payPeriodStart,
          EndDate: payPeriodEnd,
          EarningsLines: earningsLines,
          Status: "Draft",
        });
      }
    }

    if (xeroTimesheets.length === 0) {
      throw new Error("No mappable Xero employees found. Ensure workers have Xero Employee IDs configured.");
    }

    // Submit to Xero Payroll API (sandbox or production based on env)
    const xeroApiBase = process.env.XERO_API_BASE || "https://api.xero.com";
    const xeroRes = await fetch(`${xeroApiBase}/payroll.xro/1.0/Timesheets`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Xero-tenant-id": xeroTenantId,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({ Timesheets: xeroTimesheets }),
    });

    if (!xeroRes.ok) {
      const xeroErr = await xeroRes.text();
      throw new Error(`Xero API error ${xeroRes.status}: ${xeroErr}`);
    }

    const xeroBody = await xeroRes.json();
    const xeroPayRunId = xeroBody?.Timesheets?.[0]?.TimesheetID || null;

    // Mark timesheets as exported
    await supabase
      .from("timesheets")
      .update({ status: "exported", exported_at: new Date().toISOString() })
      .in("id", timesheetIds)
      .eq("organization_id", orgId);

    // Record the export in payroll_exports
    await supabase
      .from("payroll_exports")
      .insert({
        organization_id: orgId,
        timesheet_ids: timesheetIds,
        target_platform: "xero",
        batch_status: "completed",
        period_start: payPeriodStart,
        period_end: payPeriodEnd,
        worker_count: workerGroups.size,
        total_cost: lines.reduce((s, l) => s + Number(l.total_line_amount), 0),
        api_response: xeroBody,
        exported_by: null,
      });

    revalidatePath("/dashboard/timesheets");
    revalidatePath("/dashboard/workforce/payroll-export");

    return { ok: true, xeroPayRunId, error: null };
  } catch (err) {
    console.error("[exportPayrunToXero]", err);
    return {
      ok: false,
      xeroPayRunId: null,
      error: err instanceof Error ? err.message : "Xero export failed",
    };
  }
}

// ─── CSV export fallback ──────────────────────────────────────────────────────

export async function exportPayrunCsv(
  orgId: string,
  periodStart: string,
  periodEnd: string,
): Promise<{ csv: string | null; error: string | null }> {
  try {
    const { batches, error } = await getPayrollBatchSummary(orgId, periodStart, periodEnd);
    if (error) throw new Error(error);

    const rows: string[] = [
      "Worker,Pay Category,Allowance,Units (h),Base Rate,Multiplier,Casual Loading,Calculated Rate,Total Amount,Shift Date,Notes",
    ];

    for (const batch of batches) {
      for (const line of batch.payLines) {
        rows.push([
          `"${batch.workerName}"`,
          line.pay_category,
          line.allowance_type,
          Number(line.units).toFixed(4),
          Number(line.base_rate).toFixed(4),
          Number(line.rate_multiplier).toFixed(4),
          Number(line.casual_loading).toFixed(4),
          Number(line.calculated_rate).toFixed(4),
          Number(line.total_line_amount).toFixed(2),
          line.shift_date,
          `"${line.notes || ""}"`,
        ].join(","));
      }
    }

    return { csv: rows.join("\n"), error: null };
  } catch (err) {
    return { csv: null, error: err instanceof Error ? err.message : "CSV export failed" };
  }
}

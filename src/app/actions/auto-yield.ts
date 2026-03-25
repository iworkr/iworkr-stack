/**
 * @module Auto-Yield Server Actions
 * @status COMPLETE
 * @description Project Auto-Yield: Zero-touch billing & payroll pipeline.
 *   Orchestrates the bifurcated yield engine, pay run management, and telemetry.
 * @lastAudit 2026-03-24
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ── Types ────────────────────────────────────────────────────────────────────

export interface YieldResult {
  batch_id: string;
  timesheets_processed: number;
  timesheets_failed: number;
  payroll: { lines: number; total: number };
  ar: { lines: number; total: number };
  errors: Array<{ timesheet_id: string; error: string }>;
}

export interface PayRun {
  id: string;
  organization_id: string;
  period_start: string;
  period_end: string;
  status: string;
  total_gross: number;
  total_lines: number;
  worker_count: number;
  timesheet_count: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  creator_name?: string;
}

export interface YieldLogEntry {
  id: string;
  batch_id: string;
  timesheet_id: string | null;
  fork: string;
  status: string;
  payroll_amount: number;
  ar_amount: number;
  pay_lines_count: number;
  invoice_lines_count: number;
  error_message: string | null;
  processing_ms: number | null;
  created_at: string;
}

export interface YieldStats {
  pay_runs_draft: number;
  pay_runs_locked: number;
  total_payroll_30d: number;
  total_invoiced_30d: number;
  yield_processed_7d: number;
  yield_failed_7d: number;
}

export interface ReadyTimesheets {
  ready_count: number;
  total_hours: number;
  worker_count: number;
}

// ── Execute Yield Pipeline ───────────────────────────────────────────────────

export async function executeYieldPipelineAction(
  orgId: string,
  options: {
    mode?: "PAYROLL_ONLY" | "AR_ONLY" | "BOTH";
    timesheetIds?: string[];
    periodStart?: string;
    periodEnd?: string;
  } = {},
): Promise<{ ok: boolean; result: YieldResult | null; error: string | null }> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new Error("Unauthorized");

    const edgeUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/finance-yield-router`;
    const res = await fetch(edgeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
      },
      body: JSON.stringify({
        org_id: orgId,
        mode: options.mode || "BOTH",
        timesheet_ids: options.timesheetIds,
        period_start: options.periodStart,
        period_end: options.periodEnd,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(errText || `HTTP ${res.status}`);
    }

    const body = await res.json();

    revalidatePath("/dashboard/finance/yield-control");
    revalidatePath("/dashboard/finance/invoicing");
    revalidatePath("/dashboard/timesheets");
    revalidatePath("/dashboard/workforce/payroll-export");

    return { ok: true, result: body.result || null, error: null };
  } catch (err) {
    console.error("[auto-yield] executeYieldPipeline:", err);
    return {
      ok: false,
      result: null,
      error: err instanceof Error ? err.message : "Pipeline execution failed",
    };
  }
}

// ── Fetch Ready Timesheets ───────────────────────────────────────────────────

export async function fetchReadyTimesheetsAction(
  orgId: string,
): Promise<ReadyTimesheets> {
  try {
    const supabase = await createServerSupabaseClient();
    const sb = supabase as any;

    const { data, error } = await sb.rpc("get_yield_ready_timesheets", {
      p_org_id: orgId,
    });

    if (error) throw error;
    return data as ReadyTimesheets;
  } catch (err) {
    console.error("[auto-yield] fetchReadyTimesheets:", err);
    return { ready_count: 0, total_hours: 0, worker_count: 0 };
  }
}

// ── Fetch Pay Runs ───────────────────────────────────────────────────────────

export async function fetchPayRunsAction(
  orgId: string,
  status?: string,
): Promise<PayRun[]> {
  try {
    const supabase = await createServerSupabaseClient();
    const sb = supabase as any;

    let query = sb
      .from("pay_runs")
      .select("*, creator:profiles!created_by(full_name)")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map((r: any) => ({
      ...r,
      creator_name: r.creator?.full_name || null,
    }));
  } catch (err) {
    console.error("[auto-yield] fetchPayRuns:", err);
    return [];
  }
}

// ── Lock Pay Run ─────────────────────────────────────────────────────────────

export async function lockPayRunAction(
  payRunId: string,
): Promise<{ ok: boolean; error: string | null }> {
  try {
    const supabase = await createServerSupabaseClient();
    const sb = supabase as any;

    const { error } = await sb
      .from("pay_runs")
      .update({ status: "LOCKED", updated_at: new Date().toISOString() })
      .eq("id", payRunId);

    if (error) throw error;

    revalidatePath("/dashboard/finance/yield-control");
    return { ok: true, error: null };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Lock failed",
    };
  }
}

// ── Fetch Yield Stats ────────────────────────────────────────────────────────

export async function fetchYieldStatsAction(
  orgId: string,
): Promise<YieldStats> {
  try {
    const supabase = await createServerSupabaseClient();
    const sb = supabase as any;

    const { data, error } = await sb.rpc("get_yield_stats", {
      p_org_id: orgId,
    });

    if (error) throw error;
    return data as YieldStats;
  } catch (err) {
    console.error("[auto-yield] fetchYieldStats:", err);
    return {
      pay_runs_draft: 0,
      pay_runs_locked: 0,
      total_payroll_30d: 0,
      total_invoiced_30d: 0,
      yield_processed_7d: 0,
      yield_failed_7d: 0,
    };
  }
}

// ── Fetch Yield Processing Log ───────────────────────────────────────────────

export async function fetchYieldLogAction(
  orgId: string,
  batchId?: string,
  limit = 100,
): Promise<YieldLogEntry[]> {
  try {
    const supabase = await createServerSupabaseClient();
    const sb = supabase as any;

    let query = sb
      .from("yield_processing_log")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (batchId) query = query.eq("batch_id", batchId);

    const { data, error } = await query;
    if (error) throw error;

    return (data || []) as YieldLogEntry[];
  } catch (err) {
    console.error("[auto-yield] fetchYieldLog:", err);
    return [];
  }
}

// ── Export Pay Run ───────────────────────────────────────────────────────────

export async function exportPayRunAction(
  orgId: string,
  payRunId: string,
  format: "csv" | "xero" = "csv",
): Promise<{ ok: boolean; csv?: string; error: string | null }> {
  try {
    const supabase = await createServerSupabaseClient();
    const sb = supabase as any;

    const { data: lines, error } = await sb
      .from("timesheet_pay_lines")
      .select(
        "*, worker:profiles!worker_id(full_name, email)",
      )
      .eq("pay_run_id", payRunId)
      .order("shift_date", { ascending: true });

    if (error) throw error;
    if (!lines || lines.length === 0) {
      return { ok: false, error: "No pay lines in this run" };
    }

    if (format === "csv") {
      const header =
        "Worker,Email,Date,Category,Units,Base Rate,Multiplier,Calculated Rate,Total";
      const rows = (lines as any[]).map((l) =>
        [
          l.worker?.full_name || "",
          l.worker?.email || "",
          l.shift_date,
          l.pay_category,
          l.units,
          l.base_rate,
          l.rate_multiplier,
          l.calculated_rate,
          l.total_line_amount,
        ].join(","),
      );

      const csv = [header, ...rows].join("\n");

      await sb
        .from("pay_runs")
        .update({
          status: "EXPORTED",
          exported_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", payRunId);

      revalidatePath("/dashboard/finance/yield-control");
      return { ok: true, csv, error: null };
    }

    return { ok: false, error: `Format ${format} not yet implemented` };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Export failed",
    };
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

/* ── Types ────────────────────────────────────────────── */

export interface TimeSegment {
  type: "standard" | "evening_loading" | "night_loading" | "saturday" | "sunday" | "public_holiday";
  hours: number;
  multiplier: number;
  segment_cost: number;
}

export interface Allowance {
  type: string;
  amount: number;
  description?: string;
}

export interface ShiftCostBreakdown {
  schads_evaluation: {
    worker_level: string;
    employment_type: string;
    base_rate: number;
    casual_loading_applied: boolean;
    effective_rate: number;
    total_hours: number;
    time_segments: TimeSegment[];
    allowances: Allowance[];
    total_projected_cost: number;
  };
}

export interface ShiftRevenueBreakdown {
  ndis_evaluation: {
    line_item: string;
    line_item_name: string | null;
    national_rate: number;
    region_modifier: number;
    effective_rate: number;
    total_hours: number;
    total_projected_revenue: number;
  };
}

export interface ShiftEvaluation {
  schedule_block_id: string;
  projected_cost: number;
  projected_revenue: number;
  projected_margin: number;
  margin_percentage: number;
  cost_breakdown: ShiftCostBreakdown;
  revenue_breakdown: ShiftRevenueBreakdown;
  travel_cost: number;
  travel_revenue: number;
  is_overtime: boolean;
  is_broken_shift: boolean;
  is_public_holiday: boolean;
  penalty_type: string | null;
}

/* ── Main: Evaluate Shift Cost ────────────────────────── */

export async function evaluateShiftCost(
  scheduleBlockId: string,
): Promise<ShiftEvaluation | null> {
  const supabase = await createServerSupabaseClient();

  // 1. Fetch the schedule block
  const { data: block } = await (supabase as any)
    .from("schedule_blocks")
    .select("*")
    .eq("id", scheduleBlockId)
    .single();

  if (!block) return null;

  const orgId = block.organization_id;
  const workerId = block.technician_id;
  const startTime = new Date(block.start_time);
  const endTime = new Date(block.end_time);
  const totalHours = (endTime.getTime() - startTime.getTime()) / 3600000;

  // 2. Fetch worker's staff profile
  const { data: staff } = await (supabase as any)
    .from("staff_profiles")
    .select("schads_level, base_hourly_rate, employment_type, max_weekly_hours")
    .eq("user_id", workerId)
    .eq("organization_id", orgId)
    .maybeSingle();

  // Fallback to organization_members hourly_rate if no staff profile
  let baseRate = staff ? parseFloat(staff.base_hourly_rate) : 0;
  let employmentType = staff?.employment_type || "casual";
  let schadsLevel = staff?.schads_level || "2.1";
  const maxWeeklyHours = staff?.max_weekly_hours || 38;

  if (!baseRate) {
    const { data: member } = await (supabase as any)
      .from("organization_members")
      .select("hourly_rate")
      .eq("user_id", workerId)
      .eq("organization_id", orgId)
      .maybeSingle();
    baseRate = parseFloat(member?.hourly_rate) || 0;
  }

  // Apply casual loading
  const casualLoading = employmentType === "casual" ? 1.25 : 1.0;
  const effectiveRate = Math.round(baseRate * casualLoading * 100) / 100;

  // 3. Check public holiday
  const shiftDate = startTime.toISOString().split("T")[0];
  let isHoliday = false;
  try {
    const { data: holidayCheck } = await (supabase as any).rpc("is_public_holiday", {
      p_organization_id: orgId,
      p_date: shiftDate,
      p_state: "National",
    });
    isHoliday = !!holidayCheck;
  } catch { /* ignore */ }

  // 4. Time segmentation — compute penalty multipliers
  const segments = calculateTimeSegments(startTime, endTime, effectiveRate, isHoliday);

  // 5. Check broken shift
  let isBrokenShift = false;
  const brokenShiftAllowances: Allowance[] = [];

  const dayStart = new Date(startTime);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const { data: sameDayBlocks } = await (supabase as any)
    .from("schedule_blocks")
    .select("id, start_time, end_time")
    .eq("organization_id", orgId)
    .eq("technician_id", workerId)
    .gte("start_time", dayStart.toISOString())
    .lt("end_time", dayEnd.toISOString())
    .neq("status", "cancelled")
    .order("start_time");

  if (sameDayBlocks && sameDayBlocks.length >= 2) {
    let gapCount = 0;
    for (let i = 1; i < sameDayBlocks.length; i++) {
      const prevEnd = new Date(sameDayBlocks[i - 1].end_time).getTime();
      const currStart = new Date(sameDayBlocks[i].start_time).getTime();
      const gapHours = (currStart - prevEnd) / 3600000;
      if (gapHours >= 1) gapCount++;
    }

    if (gapCount >= 1) {
      isBrokenShift = true;
      // Get broken shift allowance from award_rules
      let allowanceAmount = 15.73; // SCHADS default
      try {
        const { data: ruleVal } = await (supabase as any).rpc("get_award_rule", {
          p_organization_id: orgId,
          p_rule_type: "broken_shift_allowance",
        });
        if (ruleVal) allowanceAmount = parseFloat(ruleVal);
      } catch { /* use default */ }

      brokenShiftAllowances.push({
        type: gapCount >= 2 ? "broken_shift_2" : "broken_shift_1",
        amount: gapCount >= 2 ? allowanceAmount * 1.5 : allowanceAmount,
        description: gapCount >= 2 ? "Broken shift allowance (3+ segments)" : "Broken shift allowance (2 segments)",
      });
    }
  }

  // 6. Check overtime
  const weekStart = getWeekStart(startTime);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const { data: weekBlocks } = await (supabase as any)
    .from("schedule_blocks")
    .select("start_time, end_time")
    .eq("organization_id", orgId)
    .eq("technician_id", workerId)
    .gte("start_time", weekStart.toISOString())
    .lt("end_time", weekEnd.toISOString())
    .neq("status", "cancelled");

  const weeklyHours = (weekBlocks || []).reduce((sum: number, b: any) => {
    return sum + (new Date(b.end_time).getTime() - new Date(b.start_time).getTime()) / 3600000;
  }, 0);

  const isOvertime = weeklyHours > maxWeeklyHours;

  // 7. Total cost
  const segmentsCost = segments.reduce((s, seg) => s + seg.segment_cost, 0);
  const allowancesCost = brokenShiftAllowances.reduce((s, a) => s + a.amount, 0);
  const totalCost = Math.round((segmentsCost + allowancesCost) * 100) / 100;

  // 8. Revenue — lookup NDIS rate
  const ndisLineItem = block.metadata?.ndis_line_item || block.metadata?.ndis_item || "";
  let revenueBreakdown: ShiftRevenueBreakdown = {
    ndis_evaluation: {
      line_item: ndisLineItem,
      line_item_name: null,
      national_rate: 0,
      region_modifier: 1.0,
      effective_rate: 0,
      total_hours: totalHours,
      total_projected_revenue: 0,
    },
  };

  let totalRevenue = 0;
  if (ndisLineItem) {
    try {
      const { data: ndisRate } = await (supabase as any)
        .from("ndis_catalogue")
        .select("base_rate_national, support_item_name")
        .eq("support_item_number", ndisLineItem)
        .is("effective_to", null)
        .maybeSingle();

      if (ndisRate) {
        const nationalRate = parseFloat(ndisRate.base_rate_national) || 0;
        totalRevenue = Math.round(nationalRate * totalHours * 100) / 100;
        revenueBreakdown = {
          ndis_evaluation: {
            line_item: ndisLineItem,
            line_item_name: ndisRate.support_item_name,
            national_rate: nationalRate,
            region_modifier: 1.0,
            effective_rate: nationalRate,
            total_hours: totalHours,
            total_projected_revenue: totalRevenue,
          },
        };
      }
    } catch { /* ignore */ }
  }

  // 9. Margin
  const margin = Math.round((totalRevenue - totalCost) * 100) / 100;
  const marginPct = totalRevenue > 0 ? Math.round((margin / totalRevenue) * 10000) / 100 : 0;

  // 10. Determine penalty type
  let penaltyType: string | null = null;
  if (isHoliday) penaltyType = "public_holiday";
  else if (startTime.getDay() === 0) penaltyType = "sunday";
  else if (startTime.getDay() === 6) penaltyType = "saturday";
  else {
    const hasEvening = segments.some(s => s.type === "evening_loading");
    const hasNight = segments.some(s => s.type === "night_loading");
    if (hasNight) penaltyType = "night";
    else if (hasEvening) penaltyType = "evening";
  }

  const costBreakdown: ShiftCostBreakdown = {
    schads_evaluation: {
      worker_level: schadsLevel,
      employment_type: employmentType,
      base_rate: baseRate,
      casual_loading_applied: employmentType === "casual",
      effective_rate: effectiveRate,
      total_hours: Math.round(totalHours * 100) / 100,
      time_segments: segments,
      allowances: brokenShiftAllowances,
      total_projected_cost: totalCost,
    },
  };

  // 11. Write to shift_financial_ledgers
  const ledgerData = {
    schedule_block_id: scheduleBlockId,
    organization_id: orgId,
    worker_id: workerId,
    participant_id: block.metadata?.participant_id || null,
    ndis_line_item: ndisLineItem || null,
    projected_cost: totalCost,
    projected_revenue: totalRevenue,
    projected_margin: margin,
    cost_breakdown: costBreakdown,
    revenue_breakdown: revenueBreakdown,
    is_overtime: isOvertime,
    is_broken_shift: isBrokenShift,
    is_public_holiday: isHoliday,
    penalty_type: penaltyType,
  };

  await (supabase as any)
    .from("shift_financial_ledgers")
    .upsert(ledgerData, { onConflict: "schedule_block_id" });

  return {
    schedule_block_id: scheduleBlockId,
    projected_cost: totalCost,
    projected_revenue: totalRevenue,
    projected_margin: margin,
    margin_percentage: marginPct,
    cost_breakdown: costBreakdown,
    revenue_breakdown: revenueBreakdown,
    travel_cost: 0,
    travel_revenue: 0,
    is_overtime: isOvertime,
    is_broken_shift: isBrokenShift,
    is_public_holiday: isHoliday,
    penalty_type: penaltyType,
  };
}

/* ── Quick Revenue Estimate (for Smart Match previews) ── */

export async function evaluateShiftRevenue(
  ndisLineItem: string,
  hours: number,
  date?: string,
  mmmClass: number = 1,
): Promise<{ rate: number; total: number; item_name: string | null }> {
  const supabase = await createServerSupabaseClient();

  const { data } = await (supabase as any)
    .from("ndis_catalogue")
    .select("base_rate_national, support_item_name")
    .eq("support_item_number", ndisLineItem)
    .is("effective_to", null)
    .maybeSingle();

  if (!data) return { rate: 0, total: 0, item_name: null };

  const rate = parseFloat(data.base_rate_national) || 0;
  return {
    rate,
    total: Math.round(rate * hours * 100) / 100,
    item_name: data.support_item_name,
  };
}

/* ── Get Financial Ledger for a Block ─────────────────── */

export async function getShiftFinancialLedger(scheduleBlockId: string) {
  const supabase = await createServerSupabaseClient();

  const { data } = await (supabase as any)
    .from("shift_financial_ledgers")
    .select("*")
    .eq("schedule_block_id", scheduleBlockId)
    .maybeSingle();

  if (!data) return null;

  return {
    ...data,
    projected_cost: parseFloat(data.projected_cost) || 0,
    projected_revenue: parseFloat(data.projected_revenue) || 0,
    projected_margin: parseFloat(data.projected_margin) || 0,
    actual_cost: data.actual_cost ? parseFloat(data.actual_cost) : null,
    actual_revenue: data.actual_revenue ? parseFloat(data.actual_revenue) : null,
    travel_cost: parseFloat(data.travel_cost) || 0,
    travel_revenue: parseFloat(data.travel_revenue) || 0,
  };
}

/* ── Time Segmentation Logic ──────────────────────────── */

function calculateTimeSegments(
  start: Date,
  end: Date,
  effectiveRate: number,
  isPublicHoliday: boolean,
): TimeSegment[] {
  const segments: TimeSegment[] = [];
  const dayOfWeek = start.getDay(); // 0=Sun, 6=Sat

  // Public holiday — flat 2.5x for entire shift
  if (isPublicHoliday) {
    const hours = (end.getTime() - start.getTime()) / 3600000;
    segments.push({
      type: "public_holiday",
      hours: Math.round(hours * 100) / 100,
      multiplier: 2.5,
      segment_cost: Math.round(effectiveRate * hours * 2.5 * 100) / 100,
    });
    return segments;
  }

  // Saturday — flat 1.5x
  if (dayOfWeek === 6) {
    const hours = (end.getTime() - start.getTime()) / 3600000;
    segments.push({
      type: "saturday",
      hours: Math.round(hours * 100) / 100,
      multiplier: 1.5,
      segment_cost: Math.round(effectiveRate * hours * 1.5 * 100) / 100,
    });
    return segments;
  }

  // Sunday — flat 2.0x
  if (dayOfWeek === 0) {
    const hours = (end.getTime() - start.getTime()) / 3600000;
    segments.push({
      type: "sunday",
      hours: Math.round(hours * 100) / 100,
      multiplier: 2.0,
      segment_cost: Math.round(effectiveRate * hours * 2.0 * 100) / 100,
    });
    return segments;
  }

  // Weekday — split at penalty thresholds
  // Standard: 06:00 - 20:00 (1.0x)
  // Evening:  20:00 - 00:00 (1.125x)
  // Night:    00:00 - 06:00 (1.15x)

  let cursor = new Date(start);
  while (cursor < end) {
    const hour = cursor.getHours();
    let segEnd: Date;
    let type: TimeSegment["type"];
    let multiplier: number;

    if (hour >= 6 && hour < 20) {
      // Standard time
      type = "standard";
      multiplier = 1.0;
      segEnd = new Date(cursor);
      segEnd.setHours(20, 0, 0, 0);
    } else if (hour >= 20 || hour === 0) {
      // Evening loading (20:00 - midnight)
      type = "evening_loading";
      multiplier = 1.125;
      segEnd = new Date(cursor);
      if (hour >= 20) {
        segEnd.setDate(segEnd.getDate() + 1);
        segEnd.setHours(0, 0, 0, 0);
      } else {
        segEnd.setHours(0, 0, 0, 0);
      }
    } else {
      // Night loading (00:01 - 06:00)
      type = "night_loading";
      multiplier = 1.15;
      segEnd = new Date(cursor);
      segEnd.setHours(6, 0, 0, 0);
    }

    // Clamp to shift end
    if (segEnd > end) segEnd = new Date(end);
    if (segEnd <= cursor) break;

    const hours = (segEnd.getTime() - cursor.getTime()) / 3600000;
    if (hours > 0) {
      segments.push({
        type,
        hours: Math.round(hours * 100) / 100,
        multiplier,
        segment_cost: Math.round(effectiveRate * hours * multiplier * 100) / 100,
      });
    }

    cursor = segEnd;
  }

  return segments;
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

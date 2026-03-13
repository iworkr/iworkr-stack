/**
 * process-timesheet-math — Award Interpretation Engine
 * ═══════════════════════════════════════════════════════════════════════════════
 * Takes a raw time entry and fractures it into payroll categories based on
 * the organization's industry_type (care → SCHADS, trades → relevant award).
 *
 * Input: { time_entry_id, organization_id }
 * Output: Updates time_entries.award_interpretation with the payroll payload
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Award Constants ──────────────────────────────────────────────────────────

const SCHADS_RULES = {
  ordinary_hours_weekly: 38,
  overtime_threshold_daily: 7.6,
  overtime_1_5_max_hours: 2,
  evening_start: 20,  // 8 PM
  night_start: 0,     // midnight
  night_end: 6,       // 6 AM
  saturday_multiplier: 1.5,
  sunday_multiplier: 2.0,
  public_holiday_multiplier: 2.5,
  evening_loading: 0.125, // 12.5% loading
  night_loading: 0.15,    // 15% loading
  broken_shift_allowance: 18.41,
};

const TRADES_RULES = {
  ordinary_hours_weekly: 38,
  overtime_threshold_daily: 8,
  overtime_1_5_max_hours: 2,
  saturday_first_2h_multiplier: 1.5,
  saturday_after_2h_multiplier: 2.0,
  sunday_multiplier: 2.0,
  public_holiday_multiplier: 2.5,
  tool_allowance: 19.50,
};

// ── Types ────────────────────────────────────────────────────────────────────

interface PayrollCategory {
  code: string;
  hours: number;
  rate_multiplier: number;
  description: string;
}

interface Allowance {
  code: string;
  units: number;
  flat_rate: number;
  description: string;
}

interface AwardInterpretation {
  categories: PayrollCategory[];
  allowances: Allowance[];
  total_hours: number;
  total_cost_multiplied_hours: number;
  engine_version: string;
  processed_at: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getHourOfDay(timestamp: string): number {
  return new Date(timestamp).getHours();
}

function getDayOfWeek(timestamp: string): number {
  return new Date(timestamp).getDay(); // 0=Sun, 6=Sat
}

function hoursBetween(start: string, end: string): number {
  return Math.round(((new Date(end).getTime() - new Date(start).getTime()) / 3600000) * 100) / 100;
}

// ── SCHADS Award Interpretation ──────────────────────────────────────────────

function interpretSCHADS(
  clockIn: string,
  clockOut: string,
  breakMinutes: number,
  isPublicHoliday: boolean,
  weeklyHoursSoFar: number,
): AwardInterpretation {
  const rawHours = hoursBetween(clockIn, clockOut);
  const netHours = Math.max(0, rawHours - breakMinutes / 60);
  const dayOfWeek = getDayOfWeek(clockIn);
  const categories: PayrollCategory[] = [];
  const allowances: Allowance[] = [];

  if (isPublicHoliday) {
    categories.push({
      code: "PH_250",
      hours: netHours,
      rate_multiplier: SCHADS_RULES.public_holiday_multiplier,
      description: "Public Holiday (250%)",
    });
  } else if (dayOfWeek === 0) {
    categories.push({
      code: "SUN_200",
      hours: netHours,
      rate_multiplier: SCHADS_RULES.sunday_multiplier,
      description: "Sunday (200%)",
    });
  } else if (dayOfWeek === 6) {
    categories.push({
      code: "SAT_150",
      hours: netHours,
      rate_multiplier: SCHADS_RULES.saturday_multiplier,
      description: "Saturday (150%)",
    });
  } else {
    // Weekday — split by time-of-day loadings and overtime
    const clockInHour = getHourOfDay(clockIn);
    const clockOutHour = getHourOfDay(clockOut);

    let ordinaryHours = Math.min(netHours, SCHADS_RULES.overtime_threshold_daily);
    let overtimeHours = Math.max(0, netHours - SCHADS_RULES.overtime_threshold_daily);

    // Check weekly overtime threshold
    if (weeklyHoursSoFar + ordinaryHours > SCHADS_RULES.ordinary_hours_weekly) {
      const weeklyOT = (weeklyHoursSoFar + ordinaryHours) - SCHADS_RULES.ordinary_hours_weekly;
      ordinaryHours = Math.max(0, ordinaryHours - weeklyOT);
      overtimeHours += weeklyOT;
    }

    // Evening loading (after 8pm)
    const eveningHours = clockOutHour >= SCHADS_RULES.evening_start || clockInHour >= SCHADS_RULES.evening_start
      ? Math.min(ordinaryHours, 2) : 0;
    const standardHours = ordinaryHours - eveningHours;

    if (standardHours > 0) {
      categories.push({
        code: "BASE_ORD",
        hours: Math.round(standardHours * 100) / 100,
        rate_multiplier: 1.0,
        description: "Ordinary Hours",
      });
    }

    if (eveningHours > 0) {
      categories.push({
        code: "EVE_LOAD",
        hours: Math.round(eveningHours * 100) / 100,
        rate_multiplier: 1.0 + SCHADS_RULES.evening_loading,
        description: "Evening Loading (112.5%)",
      });
    }

    if (overtimeHours > 0) {
      const ot15 = Math.min(overtimeHours, SCHADS_RULES.overtime_1_5_max_hours);
      const ot20 = Math.max(0, overtimeHours - SCHADS_RULES.overtime_1_5_max_hours);

      if (ot15 > 0) {
        categories.push({
          code: "OVERTIME_1.5",
          hours: Math.round(ot15 * 100) / 100,
          rate_multiplier: 1.5,
          description: "Overtime (150%)",
        });
      }
      if (ot20 > 0) {
        categories.push({
          code: "OVERTIME_2.0",
          hours: Math.round(ot20 * 100) / 100,
          rate_multiplier: 2.0,
          description: "Overtime (200%)",
        });
      }
    }
  }

  const totalCostMultiplied = categories.reduce(
    (sum, c) => sum + c.hours * c.rate_multiplier,
    0,
  );

  return {
    categories,
    allowances,
    total_hours: Math.round(netHours * 100) / 100,
    total_cost_multiplied_hours: Math.round(totalCostMultiplied * 100) / 100,
    engine_version: "schads-v1.0",
    processed_at: new Date().toISOString(),
  };
}

// ── Trades Award Interpretation ──────────────────────────────────────────────

function interpretTrades(
  clockIn: string,
  clockOut: string,
  breakMinutes: number,
  isPublicHoliday: boolean,
  weeklyHoursSoFar: number,
): AwardInterpretation {
  const rawHours = hoursBetween(clockIn, clockOut);
  const netHours = Math.max(0, rawHours - breakMinutes / 60);
  const dayOfWeek = getDayOfWeek(clockIn);
  const categories: PayrollCategory[] = [];
  const allowances: Allowance[] = [];

  if (isPublicHoliday) {
    categories.push({
      code: "PH_250",
      hours: netHours,
      rate_multiplier: TRADES_RULES.public_holiday_multiplier,
      description: "Public Holiday (250%)",
    });
  } else if (dayOfWeek === 0) {
    categories.push({
      code: "SUN_200",
      hours: netHours,
      rate_multiplier: TRADES_RULES.sunday_multiplier,
      description: "Sunday (200%)",
    });
  } else if (dayOfWeek === 6) {
    const first2 = Math.min(netHours, 2);
    const after2 = Math.max(0, netHours - 2);
    categories.push({
      code: "SAT_150",
      hours: first2,
      rate_multiplier: TRADES_RULES.saturday_first_2h_multiplier,
      description: "Saturday first 2h (150%)",
    });
    if (after2 > 0) {
      categories.push({
        code: "SAT_200",
        hours: after2,
        rate_multiplier: TRADES_RULES.saturday_after_2h_multiplier,
        description: "Saturday after 2h (200%)",
      });
    }
  } else {
    let ordinaryHours = Math.min(netHours, TRADES_RULES.overtime_threshold_daily);
    let overtimeHours = Math.max(0, netHours - TRADES_RULES.overtime_threshold_daily);

    if (weeklyHoursSoFar + ordinaryHours > TRADES_RULES.ordinary_hours_weekly) {
      const weeklyOT = (weeklyHoursSoFar + ordinaryHours) - TRADES_RULES.ordinary_hours_weekly;
      ordinaryHours = Math.max(0, ordinaryHours - weeklyOT);
      overtimeHours += weeklyOT;
    }

    if (ordinaryHours > 0) {
      categories.push({
        code: "BASE_ORD",
        hours: Math.round(ordinaryHours * 100) / 100,
        rate_multiplier: 1.0,
        description: "Ordinary Hours",
      });
    }

    if (overtimeHours > 0) {
      const ot15 = Math.min(overtimeHours, TRADES_RULES.overtime_1_5_max_hours);
      const ot20 = Math.max(0, overtimeHours - TRADES_RULES.overtime_1_5_max_hours);

      if (ot15 > 0) {
        categories.push({
          code: "OVERTIME_1.5",
          hours: Math.round(ot15 * 100) / 100,
          rate_multiplier: 1.5,
          description: "Overtime (150%)",
        });
      }
      if (ot20 > 0) {
        categories.push({
          code: "OVERTIME_2.0",
          hours: Math.round(ot20 * 100) / 100,
          rate_multiplier: 2.0,
          description: "Overtime (200%)",
        });
      }
    }

    // Tool allowance for trades
    allowances.push({
      code: "TOOL_ALLOWANCE",
      units: 1,
      flat_rate: TRADES_RULES.tool_allowance,
      description: "Daily tool allowance",
    });
  }

  const totalCostMultiplied = categories.reduce(
    (sum, c) => sum + c.hours * c.rate_multiplier,
    0,
  );

  return {
    categories,
    allowances,
    total_hours: Math.round(netHours * 100) / 100,
    total_cost_multiplied_hours: Math.round(totalCostMultiplied * 100) / 100,
    engine_version: "trades-v1.0",
    processed_at: new Date().toISOString(),
  };
}

// ── Main Handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { time_entry_id, organization_id } = await req.json();

    if (!time_entry_id || !organization_id) {
      return new Response(
        JSON.stringify({ error: "time_entry_id and organization_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Get the time entry
    const { data: entry, error: entryErr } = await supabase
      .from("time_entries")
      .select("*")
      .eq("id", time_entry_id)
      .single();

    if (entryErr || !entry) {
      return new Response(
        JSON.stringify({ error: "Time entry not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!entry.clock_out) {
      return new Response(
        JSON.stringify({ error: "Cannot interpret: shift still active (no clock_out)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2. Get the org industry type
    const { data: org } = await supabase
      .from("organizations")
      .select("industry_type")
      .eq("id", organization_id)
      .single();

    const industryType = org?.industry_type || "trades";

    // 3. Check if the clock-in date is a public holiday
    const clockInDate = entry.clock_in.split("T")[0];
    const { data: holidays } = await supabase
      .from("public_holidays")
      .select("id")
      .eq("organization_id", organization_id)
      .eq("date", clockInDate)
      .limit(1);

    const isPublicHoliday = (holidays || []).length > 0;

    // 4. Get weekly hours so far (for cumulative overtime)
    const entryDate = new Date(entry.clock_in);
    const dayOfWeek = entryDate.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekStart = new Date(entryDate);
    weekStart.setDate(weekStart.getDate() + mondayOffset);
    weekStart.setHours(0, 0, 0, 0);

    const { data: weekEntries } = await supabase
      .from("time_entries")
      .select("total_hours")
      .eq("organization_id", organization_id)
      .eq("worker_id", entry.worker_id)
      .gte("clock_in", weekStart.toISOString())
      .lt("clock_in", entry.clock_in)
      .not("id", "eq", time_entry_id);

    const weeklyHoursSoFar = (weekEntries || []).reduce(
      (sum: number, e: { total_hours: number | null }) => sum + (e.total_hours || 0),
      0,
    );

    // 5. Run the appropriate award engine
    const interpretation = industryType === "care"
      ? interpretSCHADS(entry.clock_in, entry.clock_out, entry.break_minutes || 0, isPublicHoliday, weeklyHoursSoFar)
      : interpretTrades(entry.clock_in, entry.clock_out, entry.break_minutes || 0, isPublicHoliday, weeklyHoursSoFar);

    // 6. Write interpretation back to the time entry
    const { error: updateErr } = await supabase
      .from("time_entries")
      .update({ award_interpretation: interpretation })
      .eq("id", time_entry_id);

    if (updateErr) {
      return new Response(
        JSON.stringify({ error: updateErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ success: true, interpretation }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

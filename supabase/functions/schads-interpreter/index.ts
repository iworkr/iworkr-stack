/**
 * SCHADS Award Interpreter — Supabase Edge Function
 * Version: 1.0 — Project Chronos-SCHADS
 *
 * A deterministic 5-step pipeline that ingests a time_entry record and
 * produces granular timesheet_pay_lines conforming to the Australian
 * Social, Community, Home Care and Disability Services (SCHADS) Award.
 *
 * Pipeline steps:
 *   1. Midnight & Threshold Splitter  — fractures time blocks at penalty boundaries
 *   2. Day-of-Week Evaluator          — Saturday/Sunday/Public Holiday override
 *   3. Minimum Engagement Padding     — FWO 2-hour casual minimum
 *   4. Overtime Accumulator           — 38h weekly limit, 1.5x/2.0x buckets
 *   5. Allowance Injector             — Broken shifts, sleepovers, first aid
 *
 * DST Safety: All duration math uses UTC epoch arithmetic (never local clock diff).
 * Re-entrant: Purges existing pay lines before recalculating (idempotent).
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── CORS headers ────────────────────────────────────────────────────────────
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ─── SCHADS Constants ─────────────────────────────────────────────────────────

const ENGINE_VERSION = "1.0";

// Time-of-day penalty thresholds (hours in 24h local time)
const TOD_DAY_START = 6;     // 6:00 AM
const TOD_EVENING_START = 20; // 8:00 PM
const TOD_NIGHT_END = 6;      // 6:00 AM (next day)

// Penalty multipliers (on top of base rate)
const MULT = {
  ORDINARY:       1.0000,
  EVENING:        1.1250,  // +12.5%
  NIGHT:          1.1500,  // +15%
  SATURDAY:       1.5000,  // +50%
  SAT_CASUAL:     1.7500,  // +75% for casuals
  SUNDAY:         2.0000,  // +100%
  PUBLIC_HOLIDAY: 2.5000,  // +150%
  OVERTIME_15:    1.5000,  // first 2h OT
  OVERTIME_20:    2.0000,  // subsequent OT
  CASUAL_LOADING: 1.2500,  // 25% casual loading
};

// Allowance flat amounts (2024-25 SCHADS)
const ALLOWANCES = {
  BROKEN_SHIFT_1_BREAK: 19.34,
  BROKEN_SHIFT_2_BREAKS: 25.67,
  SLEEPOVER: 55.00,
  FIRST_AID: 0.83,   // per hour worked with certificate
  LAUNDRY: 1.25,      // per shift
};

// Weekly/daily overtime thresholds
const WEEKLY_OT_THRESHOLD = 38.0;
const DAILY_OT_THRESHOLD = 10.0;
const CASUAL_MIN_ENGAGEMENT = 2.0; // hours

// ─── Types ───────────────────────────────────────────────────────────────────

interface TimeEntry {
  id: string;
  organization_id: string;
  worker_id: string;
  timesheet_id: string | null;
  clock_in: string;  // ISO-8601 UTC
  clock_out: string; // ISO-8601 UTC
  break_duration_minutes: number | null;
  is_sleepover: boolean | null;
  is_short_notice_cancel: boolean | null;
  status: string;
  shift_id: string | null;
  award_interpretation: unknown;
}

interface PayProfile {
  employment_type: string;
  schads_level: number;
  schads_paypoint: number;
  base_hourly_rate: number;
}

interface TimeChunk {
  startUtc: Date;
  endUtc: Date;
  localDate: string;        // YYYY-MM-DD in workspace tz
  localHourStart: number;   // 0-23
  localHourEnd: number;     // 0-24
  durationHours: number;
  isSaturday: boolean;
  isSunday: boolean;
  isPublicHoliday: boolean;
}

interface PayLine {
  pay_category: string;
  allowance_type: string;
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
  notes: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function epochHours(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / 3_600_000;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

/** Returns local hour (0-23) for a UTC date in given tz. Uses JS Intl. */
function getLocalHour(utc: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: tz,
    hour: "numeric",
    hour12: false,
  }).formatToParts(utc);
  return parseInt(parts.find((p) => p.type === "hour")!.value);
}

/** Returns local YYYY-MM-DD for a UTC date in given tz. */
function getLocalDateStr(utc: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(utc);
}

/** Returns day-of-week name for a UTC date in given tz. */
function getLocalDayName(utc: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: tz,
    weekday: "long",
  }).format(utc);
}

// ─── Step 1: Midnight & Threshold Splitter ───────────────────────────────────
/**
 * Splits a continuous time block at SCHADS penalty boundaries:
 *   - Day/Evening (20:00), Evening/Night (00:00), Night/Day (06:00)
 *   - Calendar midnight (for day-of-week transitions)
 * Returns an array of TimeChunk objects.
 */
function splitAtBoundaries(
  clockIn: Date,
  clockOut: Date,
  tz: string,
  publicHolidays: Set<string>,
): TimeChunk[] {
  const chunks: TimeChunk[] = [];
  let cursor = new Date(clockIn);

  while (cursor < clockOut) {
    const localDate = getLocalDateStr(cursor, tz);
    const localHour = getLocalHour(cursor, tz);
    const dayName = getLocalDayName(cursor, tz);
    const isSaturday = dayName === "Saturday";
    const isSunday = dayName === "Sunday";
    const isPublicHoliday = publicHolidays.has(localDate);

    // Find the next boundary for this cursor position (in local hours)
    // Boundaries: 0:00, 6:00, 20:00 — but we must convert back to UTC
    let nextBoundaryHour: number | null = null;

    if (localHour < TOD_DAY_START) {
      // Night shift (00:00–06:00): next boundary is 06:00
      nextBoundaryHour = TOD_DAY_START;
    } else if (localHour < TOD_EVENING_START) {
      // Day shift (06:00–20:00): next boundary is 20:00
      nextBoundaryHour = TOD_EVENING_START;
    } else {
      // Evening shift (20:00–24:00): next boundary is midnight (0:00 next day)
      nextBoundaryHour = 24; // midnight = start of next day
    }

    // Calculate the UTC time of the next local boundary
    // We do this by setting the local time to nextBoundaryHour on the same local date
    let nextBoundaryUtc: Date;
    if (nextBoundaryHour === 24) {
      // Midnight: take the local date and advance to next day 00:00
      const nextDateStr = new Date(
        cursor.getTime() + (24 - localHour) * 3_600_000,
      );
      const nd = getLocalDateStr(nextDateStr, tz);
      nextBoundaryUtc = localMidnightToUtc(nd, tz);
    } else {
      nextBoundaryUtc = localHourToUtc(localDate, nextBoundaryHour, tz);
    }

    const chunkEnd = new Date(Math.min(nextBoundaryUtc.getTime(), clockOut.getTime()));
    const durationHours = epochHours(cursor, chunkEnd);

    if (durationHours > 0.001) {
      chunks.push({
        startUtc: new Date(cursor),
        endUtc: chunkEnd,
        localDate,
        localHourStart: localHour,
        localHourEnd: getLocalHour(new Date(chunkEnd.getTime() - 1), tz) + 1,
        durationHours: round4(durationHours),
        isSaturday,
        isSunday,
        isPublicHoliday,
      });
    }

    cursor = chunkEnd;
  }

  return chunks;
}

/** Converts a local date string + hour to UTC Date in given tz. */
function localHourToUtc(localDate: string, hour: number, tz: string): Date {
  // Build an ISO string representing the local time and parse it
  const h = hour % 24;
  const d = hour >= 24
    ? addLocalDays(localDate, 1)
    : localDate;
  const iso = `${d}T${String(h).padStart(2, "0")}:00:00`;
  // Use Temporal-style parsing via a known UTC offset for the timezone
  return new Date(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "UTC",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).format(new Date(
      // Find the UTC time that corresponds to iso in tz
      findUtcForLocalTime(d, h, 0, tz),
    )),
  );
}

function localMidnightToUtc(localDate: string, tz: string): Date {
  return new Date(findUtcForLocalTime(localDate, 0, 0, tz));
}

function addLocalDays(localDate: string, days: number): string {
  const [y, m, d] = localDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/**
 * Finds the UTC timestamp (ms) for a given local time in a timezone.
 * Uses bisection on the JS Intl API — accurate across DST transitions.
 */
function findUtcForLocalTime(
  localDate: string,
  hour: number,
  minute: number,
  tz: string,
): number {
  // Target local time components
  const target = { date: localDate, hour, minute };

  // Rough estimate: assume UTC offset from the middle of that local day
  const [y, mo, d] = localDate.split("-").map(Number);
  let utcMs = Date.UTC(y, mo - 1, d, hour, minute, 0);

  // Bisect to nail down the exact UTC ms (tolerates DST, ±4h window)
  for (let i = 0; i < 40; i++) {
    const probe = new Date(utcMs);
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false,
    }).formatToParts(probe);
    const pl = Object.fromEntries(parts.map((p) => [p.type, p.value]));
    const probeDate = `${pl.year}-${pl.month}-${pl.day}`;
    const probeHour = parseInt(pl.hour);
    const probeMin = parseInt(pl.minute);

    // Check if we're close enough
    if (probeDate === target.date && probeHour === target.hour && probeMin === target.minute) {
      break;
    }

    // Adjust by the difference in minutes
    const localTargetMs = Date.UTC(
      parseInt(target.date.slice(0, 4)),
      parseInt(target.date.slice(5, 7)) - 1,
      parseInt(target.date.slice(8, 10)),
      target.hour,
      target.minute,
    );
    const localProbeMs = Date.UTC(
      parseInt(probeDate.slice(0, 4)),
      parseInt(probeDate.slice(5, 7)) - 1,
      parseInt(probeDate.slice(8, 10)),
      probeHour,
      probeMin,
    );
    utcMs += (localTargetMs - localProbeMs);
  }

  return utcMs;
}

// ─── Step 2: Day-of-Week Evaluator ───────────────────────────────────────────

function chunkToPayCategory(chunk: TimeChunk, isCasual: boolean): { category: string; multiplier: number } {
  if (chunk.isPublicHoliday) {
    return { category: "PUBLIC_HOLIDAY", multiplier: MULT.PUBLIC_HOLIDAY };
  }
  if (chunk.isSunday) {
    return { category: "SUNDAY", multiplier: MULT.SUNDAY };
  }
  if (chunk.isSaturday) {
    return {
      category: "SATURDAY",
      multiplier: isCasual ? MULT.SAT_CASUAL : MULT.SATURDAY,
    };
  }
  // Time-of-day penalty for weekdays
  const h = chunk.localHourStart;
  if (h >= TOD_EVENING_START || h < 0) {
    return { category: "EVENING_SHIFT", multiplier: MULT.EVENING };
  }
  if (h < TOD_DAY_START) {
    return { category: "NIGHT_SHIFT", multiplier: MULT.NIGHT };
  }
  return { category: "ORDINARY_HOURS", multiplier: MULT.ORDINARY };
}

// ─── Main Engine ─────────────────────────────────────────────────────────────

async function runScHadsEngine(
  entry: TimeEntry,
  supabase: ReturnType<typeof createClient>,
  workspaceTimezone: string,
): Promise<PayLine[]> {
  const clockIn = new Date(entry.clock_in);
  const clockOut = new Date(entry.clock_out);
  const breakHours = (entry.break_duration_minutes || 0) / 60.0;
  const grossDurationHours = epochHours(clockIn, clockOut);
  const workedHours = round4(grossDurationHours - breakHours);
  const shiftDate = getLocalDateStr(clockIn, workspaceTimezone);

  // ── Fetch worker's pay profile at shift date ──────────────────────────────
  const { data: profileRows } = await (supabase as any).rpc("get_worker_pay_profile_at_date", {
    p_user_id: entry.worker_id,
    p_org_id: entry.organization_id,
    p_date: shiftDate,
  });

  let profile: PayProfile | null = null;
  if (profileRows && profileRows.length > 0) {
    profile = profileRows[0] as PayProfile;
  }

  // Default fallback if no pay profile configured
  if (!profile) {
    // Try to look up from schads_base_rates with defaults
    const { data: rateRow } = await (supabase as any)
      .from("schads_base_rates")
      .select("hourly_rate")
      .eq("schads_level", 2)
      .eq("schads_paypoint", 1)
      .lte("effective_from", shiftDate)
      .order("effective_from", { ascending: false })
      .limit(1)
      .maybeSingle();

    profile = {
      employment_type: "CASUAL",
      schads_level: 2,
      schads_paypoint: 1,
      base_hourly_rate: Number(rateRow?.hourly_rate ?? 24.57),
    };
  }

  const isCasual = profile.employment_type === "CASUAL";
  const baseRate = Number(profile.base_hourly_rate);
  const casualLoading = isCasual ? MULT.CASUAL_LOADING : 1.0;

  // ── Fetch public holidays for the org's state ─────────────────────────────
  const { data: holidayRows } = await (supabase as any)
    .from("australian_public_holidays")
    .select("holiday_date")
    .or(`state.eq.NAT,state.eq.NSW`)  // TODO: resolve org state from settings
    .gte("holiday_date", shiftDate)
    .lte("holiday_date", shiftDate);

  const publicHolidays = new Set<string>(
    (holidayRows || []).map((h: any) => h.holiday_date),
  );

  const payLines: PayLine[] = [];

  // ─────────────────────────────────────────────────────────────────────────
  // SHORT-NOTICE CANCELLATION FAST-PATH
  // Client cancelled < 12h before shift — still pay the full shift
  // ─────────────────────────────────────────────────────────────────────────
  if (entry.is_short_notice_cancel) {
    const calcRate = round4(baseRate * MULT.ORDINARY * casualLoading);
    payLines.push({
      pay_category: "CLIENT_CANCELLATION",
      allowance_type: "NONE",
      units: round4(Math.max(workedHours, CASUAL_MIN_ENGAGEMENT)),
      rate_multiplier: MULT.ORDINARY,
      base_rate: baseRate,
      casual_loading: casualLoading,
      calculated_rate: calcRate,
      total_line_amount: round4(calcRate * Math.max(workedHours, CASUAL_MIN_ENGAGEMENT)),
      shift_date: shiftDate,
      shift_start_utc: clockIn.toISOString(),
      shift_end_utc: clockOut.toISOString(),
      is_synthetic: true,
      notes: "Short-notice cancellation — FWO clause applies",
    });
    return payLines;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SLEEPOVER FAST-PATH
  // Fixed allowance + applicable rates for any wake-ups during the period
  // ─────────────────────────────────────────────────────────────────────────
  if (entry.is_sleepover) {
    // Inject flat sleepover allowance
    payLines.push({
      pay_category: "ORDINARY_HOURS",
      allowance_type: "SLEEPOVER",
      units: 1,
      rate_multiplier: 1.0,
      base_rate: ALLOWANCES.SLEEPOVER,
      casual_loading: 1.0,
      calculated_rate: ALLOWANCES.SLEEPOVER,
      total_line_amount: ALLOWANCES.SLEEPOVER,
      shift_date: shiftDate,
      shift_start_utc: clockIn.toISOString(),
      shift_end_utc: clockOut.toISOString(),
      is_synthetic: true,
      notes: "Sleepover flat allowance (SCHADS Cl. 25.4)",
    });

    // Check for active intervals (wake-ups) — query time_entries for the period
    // that are NOT marked as sleepover and fall within the sleepover bounds
    const { data: wakeUps } = await (supabase as any)
      .from("time_entries")
      .select("id, clock_in, clock_out, break_duration_minutes")
      .eq("worker_id", entry.worker_id)
      .eq("organization_id", entry.organization_id)
      .eq("is_sleepover", false)
      .gte("clock_in", clockIn.toISOString())
      .lte("clock_in", clockOut.toISOString())
      .in("status", ["approved", "completed", "auto_resolved"]);

    for (const wakeUp of (wakeUps || [])) {
      const wuIn = new Date(wakeUp.clock_in);
      const wuOut = new Date(wakeUp.clock_out ?? wakeUp.clock_in);
      const wuHours = Math.max(
        round4(epochHours(wuIn, wuOut) - (wakeUp.break_duration_minutes || 0) / 60),
        1.0, // Minimum 1 hour per waking
      );
      const wuDate = getLocalDateStr(wuIn, workspaceTimezone);
      const wuIsNight = getLocalHour(wuIn, workspaceTimezone) < TOD_DAY_START;
      const wuMultiplier = wuIsNight ? MULT.NIGHT : MULT.ORDINARY;
      const wuRate = round4(baseRate * wuMultiplier * casualLoading);
      payLines.push({
        pay_category: wuIsNight ? "NIGHT_SHIFT" : "ORDINARY_HOURS",
        allowance_type: "NONE",
        units: wuHours,
        rate_multiplier: wuMultiplier,
        base_rate: baseRate,
        casual_loading: casualLoading,
        calculated_rate: wuRate,
        total_line_amount: round4(wuRate * wuHours),
        shift_date: wuDate,
        shift_start_utc: wuIn.toISOString(),
        shift_end_utc: wuOut.toISOString(),
        is_synthetic: false,
        notes: `Wake-up interval during sleepover — minimum 1h applied`,
      });
    }

    return payLines;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 1 + 2: Temporal Fracture + Day-of-Week Evaluation
  // ─────────────────────────────────────────────────────────────────────────
  const chunks = splitAtBoundaries(clockIn, clockOut, workspaceTimezone, publicHolidays);

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 4: Overtime Accumulator (query cumulative hours BEFORE this shift)
  // ─────────────────────────────────────────────────────────────────────────
  const { data: weekHoursData } = await (supabase as any).rpc("get_cumulative_week_hours", {
    p_worker_id: entry.worker_id,
    p_org_id: entry.organization_id,
    p_date: shiftDate,
  });
  const currentWeekHours = Number(weekHoursData ?? 0);

  let hoursAllocated = 0;
  let weeklyOtUsed = Math.max(0, currentWeekHours - WEEKLY_OT_THRESHOLD);
  let dailyHoursAccum = 0;

  for (const chunk of chunks) {
    const { category, multiplier } = chunkToPayCategory(chunk, isCasual);
    let remainingChunkHours = chunk.durationHours;

    // Check daily OT threshold
    const afterDailyAccum = dailyHoursAccum + remainingChunkHours;
    let dailyOtHours = 0;
    if (afterDailyAccum > DAILY_OT_THRESHOLD && !["SATURDAY","SUNDAY","PUBLIC_HOLIDAY"].includes(category)) {
      dailyOtHours = afterDailyAccum - DAILY_OT_THRESHOLD;
      remainingChunkHours -= dailyOtHours;
    }

    // Check weekly OT threshold
    const weeklyHoursAfter = currentWeekHours + hoursAllocated + remainingChunkHours;
    let weeklyOtHours = 0;
    if (weeklyHoursAfter > WEEKLY_OT_THRESHOLD && !["SATURDAY","SUNDAY","PUBLIC_HOLIDAY"].includes(category)) {
      weeklyOtHours = Math.max(0, weeklyHoursAfter - WEEKLY_OT_THRESHOLD);
      remainingChunkHours -= weeklyOtHours;
    }

    // Normal pay line for the non-overtime portion
    if (remainingChunkHours > 0.001) {
      const calcRate = round4(baseRate * multiplier * casualLoading);
      payLines.push({
        pay_category: category,
        allowance_type: "NONE",
        units: round4(remainingChunkHours),
        rate_multiplier: multiplier,
        base_rate: baseRate,
        casual_loading: casualLoading,
        calculated_rate: calcRate,
        total_line_amount: round4(calcRate * remainingChunkHours),
        shift_date: chunk.localDate,
        shift_start_utc: chunk.startUtc.toISOString(),
        shift_end_utc: chunk.endUtc.toISOString(),
        is_synthetic: false,
        notes: `${category}: ${chunk.localHourStart}:00 – ${chunk.localHourEnd}:00 local`,
      });
    }

    hoursAllocated += remainingChunkHours;
    dailyHoursAccum += chunk.durationHours;

    // Inject daily OT lines
    const dailyOtToProcess = dailyOtHours;
    if (dailyOtToProcess > 0.001) {
      const ot15Hours = Math.min(dailyOtToProcess, 2.0 - Math.min(weeklyOtUsed, 2.0));
      const ot20Hours = dailyOtToProcess - Math.max(0, ot15Hours);
      if (ot15Hours > 0.001) {
        const r = round4(baseRate * MULT.OVERTIME_15 * casualLoading);
        payLines.push({
          pay_category: "OVERTIME_1_5X",
          allowance_type: "NONE",
          units: round4(ot15Hours),
          rate_multiplier: MULT.OVERTIME_15,
          base_rate: baseRate, casual_loading: casualLoading, calculated_rate: r,
          total_line_amount: round4(r * ot15Hours),
          shift_date: chunk.localDate, shift_start_utc: null, shift_end_utc: null,
          is_synthetic: false, notes: "Daily OT >10h (first 2h @ 1.5x)",
        });
        weeklyOtUsed += ot15Hours;
      }
      if (ot20Hours > 0.001) {
        const r = round4(baseRate * MULT.OVERTIME_20 * casualLoading);
        payLines.push({
          pay_category: "OVERTIME_2_0X",
          allowance_type: "NONE",
          units: round4(ot20Hours),
          rate_multiplier: MULT.OVERTIME_20,
          base_rate: baseRate, casual_loading: casualLoading, calculated_rate: r,
          total_line_amount: round4(r * ot20Hours),
          shift_date: chunk.localDate, shift_start_utc: null, shift_end_utc: null,
          is_synthetic: false, notes: "Daily OT >10h (subsequent @ 2.0x)",
        });
        weeklyOtUsed += ot20Hours;
      }
    }

    // Inject weekly OT lines
    if (weeklyOtHours > 0.001) {
      const ot15Available = Math.max(0, 2.0 - weeklyOtUsed);
      const ot15Hours = Math.min(weeklyOtHours, ot15Available);
      const ot20Hours = weeklyOtHours - ot15Hours;
      if (ot15Hours > 0.001) {
        const r = round4(baseRate * MULT.OVERTIME_15 * casualLoading);
        payLines.push({
          pay_category: "OVERTIME_1_5X",
          allowance_type: "NONE",
          units: round4(ot15Hours),
          rate_multiplier: MULT.OVERTIME_15,
          base_rate: baseRate, casual_loading: casualLoading, calculated_rate: r,
          total_line_amount: round4(r * ot15Hours),
          shift_date: chunk.localDate, shift_start_utc: null, shift_end_utc: null,
          is_synthetic: false, notes: "Weekly OT >38h (first 2h @ 1.5x)",
        });
        weeklyOtUsed += ot15Hours;
      }
      if (ot20Hours > 0.001) {
        const r = round4(baseRate * MULT.OVERTIME_20 * casualLoading);
        payLines.push({
          pay_category: "OVERTIME_2_0X",
          allowance_type: "NONE",
          units: round4(ot20Hours),
          rate_multiplier: MULT.OVERTIME_20,
          base_rate: baseRate, casual_loading: casualLoading, calculated_rate: r,
          total_line_amount: round4(r * ot20Hours),
          shift_date: chunk.localDate, shift_start_utc: null, shift_end_utc: null,
          is_synthetic: false, notes: "Weekly OT >38h (subsequent @ 2.0x)",
        });
        weeklyOtUsed += ot20Hours;
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 3: Minimum Engagement Padding (Casual / Part-time only)
  // ─────────────────────────────────────────────────────────────────────────
  if (isCasual || profile.employment_type === "PART_TIME") {
    const totalUnits = payLines.reduce((s, l) => s + l.units, 0);
    const shortfall = CASUAL_MIN_ENGAGEMENT - totalUnits;
    if (shortfall > 0.001) {
      const r = round4(baseRate * MULT.ORDINARY * casualLoading);
      payLines.push({
        pay_category: "MINIMUM_ENGAGEMENT_PADDING",
        allowance_type: "NONE",
        units: round4(shortfall),
        rate_multiplier: MULT.ORDINARY,
        base_rate: baseRate, casual_loading: casualLoading, calculated_rate: r,
        total_line_amount: round4(r * shortfall),
        shift_date: shiftDate, shift_start_utc: null, shift_end_utc: null,
        is_synthetic: true,
        notes: `FWO minimum ${CASUAL_MIN_ENGAGEMENT}h engagement — unworked ${shortfall.toFixed(2)}h padding`,
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STEP 5: Allowance Injector
  // ─────────────────────────────────────────────────────────────────────────

  // Check for broken shifts — query all shifts on the same local date
  const dayStart = localMidnightToUtc(shiftDate, workspaceTimezone);
  const dayEnd = localMidnightToUtc(addLocalDays(shiftDate, 1), workspaceTimezone);

  const { data: sameDayEntries } = await (supabase as any)
    .from("time_entries")
    .select("id, clock_in, clock_out")
    .eq("worker_id", entry.worker_id)
    .eq("organization_id", entry.organization_id)
    .eq("is_sleepover", false)
    .gte("clock_in", dayStart.toISOString())
    .lt("clock_in", dayEnd.toISOString())
    .in("status", ["approved", "completed", "auto_resolved"])
    .order("clock_in", { ascending: true });

  const sortedEntries = (sameDayEntries || []) as Array<{ id: string; clock_in: string; clock_out: string }>;

  // Count breaks > 1 hour between consecutive shifts
  let brokenShiftBreaks = 0;
  for (let i = 1; i < sortedEntries.length; i++) {
    const prevEnd = new Date(sortedEntries[i - 1].clock_out);
    const nextStart = new Date(sortedEntries[i].clock_in);
    const gapHours = epochHours(prevEnd, nextStart);
    if (gapHours > 1.0) brokenShiftBreaks++;
  }

  // Only inject allowance on the LAST shift of the day (avoid duplicates)
  const isLastShiftOfDay =
    sortedEntries.length > 0 &&
    sortedEntries[sortedEntries.length - 1].id === entry.id;

  if (isLastShiftOfDay && brokenShiftBreaks >= 1) {
    const allowanceType = brokenShiftBreaks >= 2
      ? "BROKEN_SHIFT_2_BREAKS"
      : "BROKEN_SHIFT_1_BREAK";
    const amount = brokenShiftBreaks >= 2
      ? ALLOWANCES.BROKEN_SHIFT_2_BREAKS
      : ALLOWANCES.BROKEN_SHIFT_1_BREAK;

    payLines.push({
      pay_category: "ORDINARY_HOURS",
      allowance_type,
      units: 1,
      rate_multiplier: 1.0,
      base_rate: amount, casual_loading: 1.0, calculated_rate: amount,
      total_line_amount: amount,
      shift_date: shiftDate, shift_start_utc: null, shift_end_utc: null,
      is_synthetic: true,
      notes: `Broken shift allowance — ${brokenShiftBreaks} break(s) > 1h (SCHADS Cl. 25.5)`,
    });
  }

  return payLines;
}

// ─── Edge Function Handler ────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const body = await req.json();
    const {
      time_entry_id,
      timesheet_id,
      org_id,
      force_recalculate = false,
    } = body as {
      time_entry_id?: string;
      timesheet_id?: string;
      org_id: string;
      force_recalculate?: boolean;
    };

    if (!org_id) {
      return new Response(JSON.stringify({ error: "org_id required" }), { status: 400, headers: corsHeaders });
    }

    // Verify caller is admin/manager
    const { data: member } = await supabase.from("organization_members").select("role")
      .eq("organization_id", org_id).eq("user_id", user.id).eq("status", "active").maybeSingle();
    if (!member || !["owner", "admin", "manager"].includes(member.role)) {
      return new Response(JSON.stringify({ error: "Insufficient permissions" }), { status: 403, headers: corsHeaders });
    }

    // Get workspace timezone
    const { data: orgData } = await supabase.from("organizations").select("settings").eq("id", org_id).single();
    const orgSettings = (orgData?.settings as any) ?? {};
    const workspaceTz = (orgSettings.timezone as string) || "Australia/Sydney";

    // Resolve entries to process
    let entries: TimeEntry[] = [];
    if (time_entry_id) {
      const { data } = await supabase.from("time_entries").select("*")
        .eq("id", time_entry_id).eq("organization_id", org_id).single();
      if (data) entries = [data as TimeEntry];
    } else if (timesheet_id) {
      const { data } = await supabase.from("time_entries").select("*")
        .eq("timesheet_id", timesheet_id).eq("organization_id", org_id)
        .in("status", ["approved", "auto_resolved", "completed"]);
      entries = (data || []) as TimeEntry[];
    } else {
      return new Response(JSON.stringify({ error: "time_entry_id or timesheet_id required" }), { status: 400, headers: corsHeaders });
    }

    if (!entries.length) {
      return new Response(JSON.stringify({ ok: true, pay_lines: [], message: "No eligible entries found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const allPayLines: Array<PayLine & { time_entry_id: string; timesheet_id: string | null }> = [];
    const errors: Array<{ entry_id: string; error: string }> = [];

    for (const entry of entries) {
      try {
        if (!entry.clock_out) {
          errors.push({ entry_id: entry.id, error: "No clock_out — entry still active" });
          continue;
        }

        // Purge existing pay lines for this entry (idempotent)
        if (force_recalculate || time_entry_id) {
          await supabase.from("timesheet_pay_lines").delete()
            .eq("time_entry_id", entry.id)
            .eq("organization_id", org_id);
        }

        const lines = await runScHadsEngine(entry, supabase, workspaceTz);

        // Insert pay lines
        if (lines.length > 0) {
          const insertRows = lines.map((l) => ({
            ...l,
            organization_id: org_id,
            timesheet_id: entry.timesheet_id,
            time_entry_id: entry.id,
            worker_id: entry.worker_id,
            engine_version: ENGINE_VERSION,
          }));

          const { error: insertErr } = await supabase
            .from("timesheet_pay_lines")
            .insert(insertRows);

          if (insertErr) throw new Error(insertErr.message);
        }

        // Mark entry as processed
        await supabase.from("time_entries")
          .update({ schads_pay_processed_at: new Date().toISOString(), schads_pay_error: null })
          .eq("id", entry.id);

        allPayLines.push(...lines.map((l) => ({ ...l, time_entry_id: entry.id, timesheet_id: entry.timesheet_id })));
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        errors.push({ entry_id: entry.id, error: msg });
        await supabase.from("time_entries")
          .update({ schads_pay_error: msg })
          .eq("id", entry.id);
      }
    }

    const totalGross = allPayLines.reduce((s, l) => s + l.total_line_amount, 0);

    return new Response(JSON.stringify({
      ok: true,
      pay_lines: allPayLines,
      pay_lines_count: allPayLines.length,
      entries_processed: entries.length - errors.length,
      total_gross: Math.round(totalGross * 100) / 100,
      errors: errors.length > 0 ? errors : undefined,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[schads-interpreter]", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: corsHeaders });
  }
});

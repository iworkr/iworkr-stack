// Edge Function: payroll-evaluator
// Chronos-EBA — Dynamic AST-based payroll evaluation engine
// Parses JSONB condition/action trees to fracture shifts and calculate pay

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Types ────────────────────────────────────────────────────
interface ConditionNode {
  type: string;
  start?: string;
  end?: string;
  values?: string[];
  operator?: string;
  value?: number | string | boolean;
}

interface ConditionsAST {
  operator: "AND" | "OR";
  conditions: ConditionNode[];
}

interface ActionsAST {
  action_type: "APPLY_MULTIPLIER" | "ADD_FIXED_ALLOWANCE" | "RECLASSIFY_TIME";
  value: number;
  pay_category_label: string;
}

interface EbaRule {
  id: string;
  name: string;
  category: string;
  priority_weight: number;
  stacking_behavior: string;
  conditions_ast: ConditionsAST;
  actions_ast: ActionsAST;
}

interface TimeBlock {
  start: Date;
  end: Date;
  hours: number;
  applicable_rules: EbaRule[];
  final_multiplier: number;
  pay_category: string;
  base_rate: number;
  calculated_rate: number;
  total: number;
}

interface DebugEntry {
  rule: string;
  block: string;
  result: string;
  detail?: string;
}

// ── Condition Evaluator ──────────────────────────────────────
function evaluateCondition(
  condition: ConditionNode,
  blockStart: Date,
  blockEnd: Date,
  context: {
    employment_type?: string;
    weekly_hours_worked?: number;
    is_public_holiday?: boolean;
    shift_duration_hours?: number;
  }
): boolean {
  switch (condition.type) {
    case "time_range": {
      if (!condition.start || !condition.end) return false;
      const [sh, sm] = condition.start.split(":").map(Number);
      const [eh, em] = condition.end.split(":").map(Number);
      const blockHour = blockStart.getHours() + blockStart.getMinutes() / 60;

      // Handle overnight ranges (e.g., 20:00 to 06:00)
      const startDecimal = sh + sm / 60;
      const endDecimal = eh + em / 60;

      if (startDecimal <= endDecimal) {
        // Same-day range
        return blockHour >= startDecimal && blockHour < endDecimal;
      } else {
        // Overnight range
        return blockHour >= startDecimal || blockHour < endDecimal;
      }
    }

    case "day_of_week": {
      if (!condition.values?.length) return false;
      const days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
      const blockDay = days[blockStart.getDay()];
      return condition.values.includes(blockDay);
    }

    case "public_holiday":
      return context.is_public_holiday === true;

    case "employment_type": {
      if (!context.employment_type) return false;
      if (condition.values?.length) {
        return condition.values.includes(context.employment_type.toUpperCase());
      }
      return context.employment_type.toUpperCase() === String(condition.value).toUpperCase();
    }

    case "shift_duration": {
      const dur = context.shift_duration_hours ?? 0;
      const val = Number(condition.value ?? 0);
      const op = condition.operator ?? "greater_than";
      if (op === "greater_than" || op === ">") return dur > val;
      if (op === "less_than" || op === "<") return dur < val;
      if (op === "equals" || op === "=") return dur === val;
      return dur > val;
    }

    case "weekly_hours": {
      const wh = context.weekly_hours_worked ?? 0;
      const val = Number(condition.value ?? 38);
      const op = condition.operator ?? "greater_than";
      if (op === "greater_than" || op === ">") return wh > val;
      if (op === "less_than" || op === "<") return wh < val;
      return wh > val;
    }

    default:
      return false;
  }
}

function evaluateConditionsAST(
  ast: ConditionsAST,
  blockStart: Date,
  blockEnd: Date,
  context: Record<string, any>
): boolean {
  if (!ast.conditions?.length) return true; // No conditions = always true

  const results = ast.conditions.map((c) =>
    evaluateCondition(c, blockStart, blockEnd, context)
  );

  if (ast.operator === "OR") return results.some(Boolean);
  return results.every(Boolean); // AND is default
}

// ── Temporal Fracture Engine ─────────────────────────────────
function fractureShift(
  shiftStart: Date,
  shiftEnd: Date,
  rules: EbaRule[],
  baseRate: number,
  context: Record<string, any>
): { payLines: TimeBlock[]; debugLog: DebugEntry[] } {
  const debugLog: DebugEntry[] = [];

  // Create hourly blocks for precise fracture
  const blocks: { start: Date; end: Date }[] = [];
  let cursor = new Date(shiftStart);

  while (cursor < shiftEnd) {
    const blockEnd = new Date(cursor);
    blockEnd.setHours(blockEnd.getHours() + 1);
    if (blockEnd > shiftEnd) {
      blocks.push({ start: new Date(cursor), end: new Date(shiftEnd) });
    } else {
      blocks.push({ start: new Date(cursor), end: blockEnd });
    }
    cursor = blockEnd;
  }

  // Evaluate each block against all rules
  const evaluatedBlocks: TimeBlock[] = blocks.map((block) => {
    const hours = (block.end.getTime() - block.start.getTime()) / (1000 * 60 * 60);
    const matchedRules: EbaRule[] = [];

    for (const rule of rules) {
      const match = evaluateConditionsAST(
        rule.conditions_ast,
        block.start,
        block.end,
        context
      );

      const blockLabel = `${block.start.toISOString().substring(11, 16)}-${block.end.toISOString().substring(11, 16)}`;

      if (match) {
        matchedRules.push(rule);
        debugLog.push({
          rule: rule.name,
          block: blockLabel,
          result: "MATCHED",
          detail: `Priority: ${rule.priority_weight}, Action: ${rule.actions_ast.action_type} ${rule.actions_ast.value}`,
        });
      } else {
        debugLog.push({
          rule: rule.name,
          block: blockLabel,
          result: "SKIPPED",
        });
      }
    }

    // Resolve conflicts using stacking behavior
    let finalMultiplier = 1.0;
    let payCategory = "ORDINARY";
    let fixedAllowance = 0;

    if (matchedRules.length > 0) {
      // Sort by priority weight (highest first)
      matchedRules.sort((a, b) => b.priority_weight - a.priority_weight);
      const topRule = matchedRules[0];

      // Determine multipliers
      const multiplierRules = matchedRules.filter(
        (r) => r.actions_ast.action_type === "APPLY_MULTIPLIER"
      );
      const allowanceRules = matchedRules.filter(
        (r) => r.actions_ast.action_type === "ADD_FIXED_ALLOWANCE"
      );

      if (multiplierRules.length > 0) {
        const stacking = topRule.stacking_behavior || "HIGHEST_WINS";

        if (stacking === "HIGHEST_WINS") {
          finalMultiplier = Math.max(...multiplierRules.map((r) => r.actions_ast.value));
          const winningRule = multiplierRules.find(
            (r) => r.actions_ast.value === finalMultiplier
          )!;
          payCategory = winningRule.actions_ast.pay_category_label;

          // Log conflict resolution
          if (multiplierRules.length > 1) {
            const losingRules = multiplierRules.filter((r) => r !== winningRule);
            for (const loser of losingRules) {
              debugLog.push({
                rule: loser.name,
                block: `${block.start.toISOString().substring(11, 16)}`,
                result: "OVERRIDDEN",
                detail: `Rule '${loser.name}' (${loser.actions_ast.value}x, Weight ${loser.priority_weight}) was overridden by '${winningRule.name}' (${winningRule.actions_ast.value}x, Weight ${winningRule.priority_weight}) due to HIGHEST_WINS`,
              });
            }
          }
        } else if (stacking === "ADDITIVE") {
          // Final = base * (1 + (m1-1) + (m2-1) + ...)
          const additiveSum = multiplierRules.reduce(
            (sum, r) => sum + (r.actions_ast.value - 1),
            0
          );
          finalMultiplier = 1 + additiveSum;
          payCategory = topRule.actions_ast.pay_category_label;
        } else if (stacking === "COMPOUND") {
          finalMultiplier = multiplierRules.reduce(
            (product, r) => product * r.actions_ast.value,
            1
          );
          payCategory = topRule.actions_ast.pay_category_label;
        }
      }

      // Handle fixed allowances (always additive)
      for (const ar of allowanceRules) {
        fixedAllowance += ar.actions_ast.value;
      }
    }

    const calculatedRate = baseRate * finalMultiplier;

    return {
      start: block.start,
      end: block.end,
      hours,
      applicable_rules: matchedRules,
      final_multiplier: finalMultiplier,
      pay_category: payCategory,
      base_rate: baseRate,
      calculated_rate: calculatedRate,
      total: Math.round((calculatedRate * hours + fixedAllowance) * 100) / 100,
    };
  });

  // Merge consecutive blocks with same pay_category and multiplier
  const mergedLines: TimeBlock[] = [];
  for (const block of evaluatedBlocks) {
    const last = mergedLines[mergedLines.length - 1];
    if (
      last &&
      last.pay_category === block.pay_category &&
      last.final_multiplier === block.final_multiplier &&
      last.end.getTime() === block.start.getTime()
    ) {
      last.end = block.end;
      last.hours += block.hours;
      last.total = Math.round(last.calculated_rate * last.hours * 100) / 100;
    } else {
      mergedLines.push({ ...block });
    }
  }

  return { payLines: mergedLines, debugLog };
}

// ── Main Handler ─────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      mode,
      agreement_id,
      organization_id,
      employment_type,
      base_rate,
      shift_start,
      shift_end,
      weekly_hours_worked,
      is_public_holiday,
      eval_date,
    } = body;

    if (!agreement_id || !organization_id) {
      return new Response(
        JSON.stringify({ error: "agreement_id and organization_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Fetch rules for this agreement (respecting effective dates)
    const { data: rulesData } = await supabase.rpc("get_eba_rules_for_evaluation", {
      p_agreement_id: agreement_id,
      p_eval_date: eval_date || new Date().toISOString().split("T")[0],
    });

    const rules: EbaRule[] = rulesData || [];

    if (rules.length === 0) {
      return new Response(
        JSON.stringify({
          pay_lines: [],
          debug_log: [{ rule: "SYSTEM", block: "ALL", result: "NO_RULES", detail: "No active rules found for this agreement" }],
          total_cost: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse shift times
    const shiftStart = new Date(shift_start);
    const shiftEnd = new Date(shift_end);
    const shiftDuration = (shiftEnd.getTime() - shiftStart.getTime()) / (1000 * 60 * 60);

    // Context for condition evaluation
    const context = {
      employment_type: employment_type || "FULL_TIME",
      weekly_hours_worked: weekly_hours_worked ?? 0,
      is_public_holiday: is_public_holiday ?? false,
      shift_duration_hours: shiftDuration,
    };

    // Run the fracture engine
    const { payLines, debugLog } = fractureShift(
      shiftStart,
      shiftEnd,
      rules,
      Number(base_rate) || 30,
      context
    );

    // Format pay lines for output
    const formattedLines = payLines.map((line) => ({
      start: line.start.toISOString(),
      end: line.end.toISOString(),
      hours: Math.round(line.hours * 100) / 100,
      pay_category: line.pay_category,
      base_rate: line.base_rate,
      multiplier: line.final_multiplier,
      calculated_rate: Math.round(line.calculated_rate * 100) / 100,
      total: line.total,
      rules_applied: line.applicable_rules.map((r) => r.name),
    }));

    const totalCost = formattedLines.reduce((sum, l) => sum + l.total, 0);

    // If mode is 'production', write to timesheet_pay_lines
    // If mode is 'simulate', just return the result (sandbox safety)
    if (mode === "production" && body.timesheet_id && body.worker_id) {
      const insertRows = formattedLines.map((line) => ({
        organization_id,
        timesheet_id: body.timesheet_id,
        worker_id: body.worker_id,
        pay_category: line.pay_category,
        units: line.hours,
        rate_multiplier: line.multiplier,
        base_rate: line.base_rate,
        calculated_rate: line.calculated_rate,
        total_line_amount: line.total,
        shift_date: shiftStart.toISOString().split("T")[0],
        shift_start_utc: line.start,
        shift_end_utc: line.end,
        engine_version: "chronos-eba-1.0",
        notes: `EBA Rule: ${line.rules_applied.join(", ")}`,
      }));

      await supabase.from("timesheet_pay_lines").insert(insertRows);
    }

    return new Response(
      JSON.stringify({
        pay_lines: formattedLines,
        debug_log: debugLog,
        total_cost: Math.round(totalCost * 100) / 100,
        rules_evaluated: rules.length,
        mode: mode || "simulate",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

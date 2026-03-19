"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

// ─── Types ────────────────────────────────────────────────────────────────────

export type EbaAgreementStatus = "DRAFT" | "TESTING" | "ACTIVE" | "ARCHIVED";
export type EbaRuleCategory =
  | "PENALTY_RATE"
  | "ALLOWANCE_FIXED"
  | "OVERTIME_TRIGGER"
  | "MINIMUM_ENGAGEMENT"
  | "TIME_RECLASSIFICATION"
  | "BROKEN_SHIFT";
export type EbaStackingBehavior = "HIGHEST_WINS" | "COMPOUND" | "ADDITIVE";

export interface PayrollAgreement {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  base_rate_matrix: Record<string, unknown>;
  status: EbaAgreementStatus;
  effective_from: string | null;
  effective_to: string | null;
  version: number;
  parent_agreement_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  rule_count?: number;
}

export interface PayrollRule {
  id: string;
  agreement_id: string;
  organization_id: string;
  name: string;
  description: string | null;
  category: EbaRuleCategory;
  priority_weight: number;
  stacking_behavior: EbaStackingBehavior;
  is_active: boolean;
  effective_from: string | null;
  effective_to: string | null;
  created_at: string;
  updated_at: string;
  rule_logic?: RuleLogic | null;
}

export interface ConditionsAST {
  operator: "AND" | "OR";
  conditions: ConditionNode[];
}

export interface ConditionNode {
  type: "time_range" | "day_of_week" | "shift_duration" | "weekly_hours" | "public_holiday" | "employment_type";
  start?: string;
  end?: string;
  values?: string[];
  value?: number | boolean | string;
  operator?: "is" | "is_between" | "greater_than" | "in";
}

export interface ActionsAST {
  action_type: "APPLY_MULTIPLIER" | "ADD_FIXED_ALLOWANCE" | "RECLASSIFY_TIME";
  value: number;
  pay_category_label: string;
}

export interface RuleLogic {
  id: string;
  rule_id: string;
  conditions_ast: ConditionsAST;
  actions_ast: ActionsAST;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface SimulationInput {
  employment_type: string;
  base_rate: number;
  shift_start: string;
  shift_end: string;
  weekly_hours_worked: number;
  is_public_holiday: boolean;
}

export interface SimulationPayLine {
  time_block: string;
  category: string;
  hours: number;
  rate: number;
  amount: number;
}

export interface SimulationResult {
  pay_lines: SimulationPayLine[];
  debug_log: string[];
  total_cost: number;
}

export interface EbaDashboardStats {
  total_agreements: number;
  draft: number;
  testing: number;
  active: number;
  archived: number;
  total_rules: number;
  simulations_run: number;
}

// ─── Server Actions ───────────────────────────────────────────────────────────

export async function createAgreement(
  orgId: string,
  data: { name: string; description?: string; effective_from?: string; effective_to?: string }
): Promise<{ agreement: PayrollAgreement | null; error: string | null }> {
  const supabase = await createServerSupabaseClient();
  const { data: agreement, error } = await (supabase as any)
    .from("payroll_agreements")
    .insert({
      organization_id: orgId,
      name: data.name,
      description: data.description || null,
      effective_from: data.effective_from || null,
      effective_to: data.effective_to || null,
      status: "DRAFT",
    })
    .select("*")
    .single();

  if (error) return { agreement: null, error: error.message };
  return { agreement: agreement as PayrollAgreement, error: null };
}

export async function getAgreements(
  orgId: string
): Promise<{ agreements: PayrollAgreement[]; error: string | null }> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await (supabase as any)
    .from("payroll_agreements")
    .select("*, payroll_rules(count)")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });

  if (error) return { agreements: [], error: error.message };

  const agreements = (data || []).map((a: Record<string, unknown>) => ({
    ...a,
    rule_count: Array.isArray(a.payroll_rules) ? (a.payroll_rules[0] as { count: number })?.count ?? 0 : 0,
  })) as PayrollAgreement[];

  return { agreements, error: null };
}

export async function getAgreementDetail(
  agreementId: string
): Promise<{ agreement: PayrollAgreement | null; error: string | null }> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await (supabase as any)
    .from("payroll_agreements")
    .select("*, payroll_rules(count)")
    .eq("id", agreementId)
    .single();

  if (error) return { agreement: null, error: error.message };
  const agreement = {
    ...data,
    rule_count: Array.isArray(data.payroll_rules) ? (data.payroll_rules[0] as { count: number })?.count ?? 0 : 0,
  } as PayrollAgreement;
  return { agreement, error: null };
}

export async function updateAgreement(
  agreementId: string,
  data: Partial<Pick<PayrollAgreement, "name" | "description" | "effective_from" | "effective_to">>
): Promise<{ agreement: PayrollAgreement | null; error: string | null }> {
  const supabase = await createServerSupabaseClient();
  const { data: agreement, error } = await (supabase as any)
    .from("payroll_agreements")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", agreementId)
    .select("*")
    .single();

  if (error) return { agreement: null, error: error.message };
  return { agreement: agreement as PayrollAgreement, error: null };
}

export async function activateAgreement(
  agreementId: string
): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createServerSupabaseClient();
  const { error } = await (supabase as any)
    .from("payroll_agreements")
    .update({ status: "ACTIVE", updated_at: new Date().toISOString() })
    .eq("id", agreementId);

  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}

export async function archiveAgreement(
  agreementId: string
): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createServerSupabaseClient();
  const { error } = await (supabase as any)
    .from("payroll_agreements")
    .update({ status: "ARCHIVED", updated_at: new Date().toISOString() })
    .eq("id", agreementId);

  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}

export async function createRule(
  orgId: string,
  agreementId: string,
  data: {
    name: string;
    description?: string;
    category: EbaRuleCategory;
    priority_weight: number;
    stacking_behavior: EbaStackingBehavior;
    conditions_ast: ConditionsAST;
    actions_ast: ActionsAST;
  }
): Promise<{ rule: PayrollRule | null; error: string | null }> {
  const supabase = await createServerSupabaseClient();

  const { data: rule, error: ruleError } = await (supabase as any)
    .from("payroll_rules")
    .insert({
      agreement_id: agreementId,
      organization_id: orgId,
      name: data.name,
      description: data.description || null,
      category: data.category,
      priority_weight: data.priority_weight,
      stacking_behavior: data.stacking_behavior,
    })
    .select("*")
    .single();

  if (ruleError || !rule) return { rule: null, error: ruleError?.message ?? "Failed to create rule" };

  const { error: logicError } = await (supabase as any)
    .from("rule_logic")
    .insert({
      rule_id: (rule as PayrollRule).id,
      conditions_ast: data.conditions_ast as unknown as Record<string, unknown>,
      actions_ast: data.actions_ast as unknown as Record<string, unknown>,
    });

  if (logicError) return { rule: null, error: logicError.message };

  return { rule: rule as PayrollRule, error: null };
}

export async function updateRule(
  ruleId: string,
  data: {
    name?: string;
    description?: string;
    category?: EbaRuleCategory;
    priority_weight?: number;
    stacking_behavior?: EbaStackingBehavior;
    is_active?: boolean;
    conditions_ast?: ConditionsAST;
    actions_ast?: ActionsAST;
  }
): Promise<{ rule: PayrollRule | null; error: string | null }> {
  const supabase = await createServerSupabaseClient();

  const ruleUpdate: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.name !== undefined) ruleUpdate.name = data.name;
  if (data.description !== undefined) ruleUpdate.description = data.description;
  if (data.category !== undefined) ruleUpdate.category = data.category;
  if (data.priority_weight !== undefined) ruleUpdate.priority_weight = data.priority_weight;
  if (data.stacking_behavior !== undefined) ruleUpdate.stacking_behavior = data.stacking_behavior;
  if (data.is_active !== undefined) ruleUpdate.is_active = data.is_active;

  const { data: rule, error: ruleError } = await (supabase as any)
    .from("payroll_rules")
    .update(ruleUpdate)
    .eq("id", ruleId)
    .select("*")
    .single();

  if (ruleError) return { rule: null, error: ruleError.message };

  if (data.conditions_ast || data.actions_ast) {
    const logicUpdate: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.conditions_ast) logicUpdate.conditions_ast = data.conditions_ast;
    if (data.actions_ast) logicUpdate.actions_ast = data.actions_ast;

    const { error: logicError } = await (supabase as any)
      .from("rule_logic")
      .update(logicUpdate)
      .eq("rule_id", ruleId);

    if (logicError) return { rule: null, error: logicError.message };
  }

  return { rule: rule as PayrollRule, error: null };
}

export async function deleteRule(
  ruleId: string
): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createServerSupabaseClient();
  const { error } = await (supabase as any)
    .from("payroll_rules")
    .delete()
    .eq("id", ruleId);

  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}

export async function getRulesForAgreement(
  agreementId: string
): Promise<{ rules: PayrollRule[]; error: string | null }> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await (supabase as any)
    .from("payroll_rules")
    .select("*, rule_logic(*)")
    .eq("agreement_id", agreementId)
    .order("priority_weight", { ascending: false });

  if (error) return { rules: [], error: error.message };

  const rules = (data || []).map((r: Record<string, unknown>) => ({
    ...r,
    rule_logic: Array.isArray(r.rule_logic) ? r.rule_logic[0] ?? null : r.rule_logic ?? null,
  })) as PayrollRule[];

  return { rules, error: null };
}

export async function simulatePayroll(
  orgId: string,
  agreementId: string,
  input: SimulationInput
): Promise<{ result: SimulationResult | null; error: string | null }> {
  const supabase = await createServerSupabaseClient();

  // Get active rules for this agreement, sorted by priority
  const { data: rulesData, error: rulesError } = await (supabase as any)
    .rpc("get_eba_rules_for_evaluation", { p_agreement_id: agreementId });

  if (rulesError) return { result: null, error: rulesError.message };

  const rules = (rulesData as unknown as Array<{
    id: string;
    name: string;
    category: string;
    priority_weight: number;
    stacking_behavior: string;
    conditions_ast: ConditionsAST;
    actions_ast: ActionsAST;
  }>) || [];

  // Client-side simulation engine
  const debugLog: string[] = [];
  const payLines: SimulationPayLine[] = [];
  const shiftStart = new Date(input.shift_start);
  const shiftEnd = new Date(input.shift_end);
  const shiftDurationHours = (shiftEnd.getTime() - shiftStart.getTime()) / (1000 * 60 * 60);
  const dayOfWeek = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][shiftStart.getDay()];

  debugLog.push(`▸ Shift: ${input.shift_start} → ${input.shift_end} (${shiftDurationHours.toFixed(2)}h)`);
  debugLog.push(`▸ Day: ${dayOfWeek} | Base Rate: $${input.base_rate} | Employment: ${input.employment_type}`);
  debugLog.push(`▸ Weekly Hours: ${input.weekly_hours_worked} | Public Holiday: ${input.is_public_holiday}`);
  debugLog.push(`▸ Evaluating ${rules.length} active rule(s)…`);
  debugLog.push("");

  let appliedMultipliers: { name: string; value: number; category: string; stacking: string }[] = [];

  for (const rule of rules) {
    debugLog.push(`── Rule: "${rule.name}" (priority ${rule.priority_weight}) ──`);
    const conditions = rule.conditions_ast?.conditions || [];
    const logicOp = rule.conditions_ast?.operator || "AND";
    let allMatch = logicOp === "AND";

    for (const cond of conditions) {
      let matches = false;
      switch (cond.type) {
        case "time_range": {
          const startHour = parseInt((cond.start || "00:00").split(":")[0]);
          const endHour = parseInt((cond.end || "23:59").split(":")[0]);
          const shiftHour = shiftStart.getHours();
          if (startHour > endHour) {
            matches = shiftHour >= startHour || shiftHour < endHour;
          } else {
            matches = shiftHour >= startHour && shiftHour < endHour;
          }
          debugLog.push(`   ⟐ time_range [${cond.start}–${cond.end}]: shift hour ${shiftHour} → ${matches ? "✓" : "✗"}`);
          break;
        }
        case "day_of_week": {
          matches = (cond.values || []).includes(dayOfWeek);
          debugLog.push(`   ⟐ day_of_week [${(cond.values || []).join(",")}]: ${dayOfWeek} → ${matches ? "✓" : "✗"}`);
          break;
        }
        case "shift_duration": {
          matches = shiftDurationHours > (typeof cond.value === "number" ? cond.value : 0);
          debugLog.push(`   ⟐ shift_duration > ${cond.value}h: ${shiftDurationHours.toFixed(2)}h → ${matches ? "✓" : "✗"}`);
          break;
        }
        case "weekly_hours": {
          matches = input.weekly_hours_worked > (typeof cond.value === "number" ? cond.value : 0);
          debugLog.push(`   ⟐ weekly_hours > ${cond.value}: ${input.weekly_hours_worked} → ${matches ? "✓" : "✗"}`);
          break;
        }
        case "public_holiday": {
          matches = input.is_public_holiday === (cond.value === true || cond.value === "true");
          debugLog.push(`   ⟐ public_holiday = ${cond.value}: ${input.is_public_holiday} → ${matches ? "✓" : "✗"}`);
          break;
        }
        case "employment_type": {
          matches = input.employment_type === cond.value;
          debugLog.push(`   ⟐ employment_type = ${cond.value}: ${input.employment_type} → ${matches ? "✓" : "✗"}`);
          break;
        }
      }

      if (logicOp === "AND") {
        allMatch = allMatch && matches;
      } else {
        allMatch = allMatch || matches;
      }
    }

    if (conditions.length === 0) allMatch = true;

    if (allMatch) {
      debugLog.push(`   ✓ MATCH → applying ${rule.actions_ast.action_type}: ${rule.actions_ast.value}`);
      if (rule.actions_ast.action_type === "APPLY_MULTIPLIER") {
        appliedMultipliers.push({
          name: rule.name,
          value: rule.actions_ast.value,
          category: rule.actions_ast.pay_category_label,
          stacking: rule.stacking_behavior,
        });
      } else if (rule.actions_ast.action_type === "ADD_FIXED_ALLOWANCE") {
        payLines.push({
          time_block: "Full Shift",
          category: rule.actions_ast.pay_category_label,
          hours: 0,
          rate: rule.actions_ast.value,
          amount: rule.actions_ast.value,
        });
      }
    } else {
      debugLog.push(`   ✗ NO MATCH — skipping`);
    }
    debugLog.push("");
  }

  // Apply multipliers based on stacking behavior
  if (appliedMultipliers.length === 0) {
    payLines.push({
      time_block: `${shiftStart.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}–${shiftEnd.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}`,
      category: "ORDINARY",
      hours: shiftDurationHours,
      rate: input.base_rate,
      amount: shiftDurationHours * input.base_rate,
    });
  } else {
    // Group by stacking behavior
    const highestWins = appliedMultipliers.filter((m) => m.stacking === "HIGHEST_WINS");
    const compound = appliedMultipliers.filter((m) => m.stacking === "COMPOUND");
    const additive = appliedMultipliers.filter((m) => m.stacking === "ADDITIVE");

    let effectiveRate = input.base_rate;
    let effectiveMultiplier = 1;

    if (highestWins.length > 0) {
      const best = highestWins.reduce((a, b) => (a.value > b.value ? a : b));
      effectiveMultiplier = best.value;
      debugLog.push(`▸ Highest-wins: ${best.name} @ ${best.value}x`);
    }

    for (const c of compound) {
      effectiveMultiplier *= c.value;
      debugLog.push(`▸ Compound: ${c.name} × ${c.value} → cumulative ${effectiveMultiplier.toFixed(4)}x`);
    }

    for (const a of additive) {
      effectiveMultiplier += a.value - 1;
      debugLog.push(`▸ Additive: ${a.name} + ${(a.value - 1).toFixed(2)} → cumulative ${effectiveMultiplier.toFixed(4)}x`);
    }

    effectiveRate = input.base_rate * effectiveMultiplier;
    const category = appliedMultipliers[0]?.category || "CALCULATED";

    payLines.push({
      time_block: `${shiftStart.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}–${shiftEnd.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}`,
      category,
      hours: shiftDurationHours,
      rate: effectiveRate,
      amount: shiftDurationHours * effectiveRate,
    });

    debugLog.push(`▸ Effective rate: $${effectiveRate.toFixed(4)} (${effectiveMultiplier.toFixed(4)}x base)`);
  }

  const totalCost = payLines.reduce((s, l) => s + l.amount, 0);
  debugLog.push("");
  debugLog.push(`═══ TOTAL COST: $${totalCost.toFixed(2)} ═══`);

  // Log to DB
  await (supabase as any).from("eba_simulation_log").insert({
    organization_id: orgId,
    agreement_id: agreementId,
    input_params: input as unknown as Record<string, unknown>,
    output_pay_lines: payLines as unknown as Record<string, unknown>[],
    debug_log: debugLog,
    total_cost: totalCost,
  });

  return { result: { pay_lines: payLines, debug_log: debugLog, total_cost: totalCost }, error: null };
}

export async function getEbaDashboardStats(
  orgId: string
): Promise<{ stats: EbaDashboardStats | null; error: string | null }> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await (supabase as any).rpc("get_eba_dashboard_stats", { p_org_id: orgId });

  if (error) return { stats: null, error: error.message };
  return { stats: data as unknown as EbaDashboardStats, error: null };
}

/**
 * iWorkr Automation Engine
 *
 * Processes automation events by:
 * 1. Finding all active flows that match the event trigger
 * 2. Executing each flow's block pipeline (trigger → delay → condition → action)
 * 3. Logging execution results
 *
 * Runs server-side only (uses service role key for cross-user operations).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@supabase/supabase-js";
import type { AutomationEvent } from "./events";
import { executeAction, type ActionResult } from "./executors";

/* ── Supabase Admin Client ────────────────────────────── */

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

/* ── Types ────────────────────────────────────────────── */

interface FlowBlock {
  id: string;
  type: "trigger" | "delay" | "action" | "condition";
  label: string;
  config: Record<string, unknown>;
}

interface AutomationFlow {
  id: string;
  organization_id: string;
  name: string;
  status: string;
  trigger_config: {
    event?: string;
    condition?: string;
    schedule?: string;
    [key: string]: unknown;
  };
  blocks: FlowBlock[];
  run_count: number;
}

interface ExecutionContext {
  event: AutomationEvent;
  flow: AutomationFlow;
  variables: Record<string, unknown>;
  logs: string[];
  startedAt: number;
}

/* ── Engine ───────────────────────────────────────────── */

/**
 * Process an automation event: find matching flows and execute them.
 */
export async function processEvent(event: AutomationEvent): Promise<{
  flowsMatched: number;
  flowsExecuted: number;
  errors: string[];
}> {
  const supabase = getAdminClient();
  const errors: string[] = [];
  let flowsExecuted = 0;

  // 1. Find all active flows for this organization that match the event
  const { data: flows, error: fetchError } = await supabase
    .from("automation_flows")
    .select("*")
    .eq("organization_id", event.organization_id)
    .eq("status", "active");

  if (fetchError) {
    return { flowsMatched: 0, flowsExecuted: 0, errors: [fetchError.message] };
  }

  // 2. Filter flows whose trigger matches this event
  const matchingFlows = (flows || []).filter((flow: AutomationFlow) =>
    matchesTrigger(flow, event)
  );

  // 3. Execute each matching flow
  for (const flow of matchingFlows) {
    try {
      const result = await executeFlow(flow as AutomationFlow, event, supabase);
      flowsExecuted++;

      if (result.error) {
        errors.push(`Flow "${flow.name}": ${result.error}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`Flow "${flow.name}": ${message}`);

      // Log the failed execution
      await logExecution(supabase, flow.id, event, "failed", message, null);
    }
  }

  return {
    flowsMatched: matchingFlows.length,
    flowsExecuted,
    errors,
  };
}

/* ── Trigger Matching ─────────────────────────────────── */

function matchesTrigger(flow: AutomationFlow, event: AutomationEvent): boolean {
  const trigger = flow.trigger_config;
  if (!trigger?.event) return false;

  // Direct event type match
  if (trigger.event !== event.type) return false;

  // Optional condition matching (e.g., "status=done")
  if (trigger.condition) {
    const condStr = trigger.condition as string;
    const parts = condStr.split("=");
    if (parts.length === 2) {
      const [key, expectedValue] = parts;
      const actualValue = getNestedValue(event.payload, key.trim());
      if (String(actualValue) !== expectedValue.trim()) return false;
    }
  }

  return true;
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split(".");
  let current: unknown = obj;
  for (const key of keys) {
    if (current === null || current === undefined) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

/* ── Flow Execution ───────────────────────────────────── */

async function executeFlow(
  flow: AutomationFlow,
  event: AutomationEvent,
  supabase: any
): Promise<{ success: boolean; error?: string }> {
  const startTime = Date.now();

  const ctx: ExecutionContext = {
    event,
    flow,
    variables: {
      ...event.payload,
      event_type: event.type,
      entity_id: event.entity_id,
      entity_type: event.entity_type,
      organization_id: event.organization_id,
      user_id: event.user_id,
      timestamp: event.timestamp,
    },
    logs: [],
    startedAt: startTime,
  };

  // Get blocks in order (skip the trigger block since we've already matched)
  const actionBlocks = (flow.blocks || []).filter(
    (b: FlowBlock) => b.type !== "trigger"
  );

  let error: string | null = null;

  for (const block of actionBlocks) {
    try {
      const shouldContinue = await executeBlock(block, ctx, supabase);
      if (!shouldContinue) {
        ctx.logs.push(`Block "${block.label}" — condition not met, stopping`);
        break;
      }
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      ctx.logs.push(`Block "${block.label}" — ERROR: ${error}`);
      break;
    }
  }

  const duration = Date.now() - startTime;

  // Log the execution
  await logExecution(
    supabase,
    flow.id,
    event,
    error ? "failed" : "success",
    error,
    { logs: ctx.logs, duration }
  );

  // Update flow run count
  await supabase
    .from("automation_flows")
    .update({
      run_count: flow.run_count + 1,
      last_run: new Date().toISOString(),
    })
    .eq("id", flow.id);

  return { success: !error, error: error || undefined };
}

/* ── Block Execution ──────────────────────────────────── */

async function executeBlock(
  block: FlowBlock,
  ctx: ExecutionContext,
  supabase: any
): Promise<boolean> {
  switch (block.type) {
    case "delay":
      return executeDelayBlock(block, ctx, supabase);

    case "condition":
      return evaluateCondition(block, ctx);

    case "action":
      return executeActionBlock(block, ctx, supabase);

    default:
      ctx.logs.push(`Unknown block type: ${block.type}`);
      return true;
  }
}

/* ── Delay Block ──────────────────────────────────────── */

async function executeDelayBlock(
  block: FlowBlock,
  ctx: ExecutionContext,
  supabase: any
): Promise<boolean> {
  const delayMinutes = Number(block.config?.delay_minutes || 0);
  const delayHours = Number(block.config?.delay_hours || 0);
  const delayDays = Number(block.config?.delay_days || 0);
  const totalMinutes = delayMinutes + delayHours * 60 + delayDays * 1440;

  if (totalMinutes <= 0) {
    ctx.logs.push(`Delay block "${block.label}" — no delay configured, continuing`);
    return true;
  }

  // For short delays (< 5 min), wait inline
  if (totalMinutes < 5) {
    ctx.logs.push(`Delay block "${block.label}" — waiting ${totalMinutes} minutes`);
    await new Promise((resolve) => setTimeout(resolve, totalMinutes * 60 * 1000));
    return true;
  }

  // For longer delays, schedule a deferred execution
  const executeAt = new Date(Date.now() + totalMinutes * 60 * 1000);

  await supabase.from("automation_logs").insert({
    flow_id: ctx.flow.id,
    organization_id: ctx.event.organization_id,
    status: "scheduled",
    trigger_data: {
      original_event: ctx.event,
      deferred_block_index: ctx.flow.blocks.indexOf(block),
      execute_at: executeAt.toISOString(),
    },
    started_at: new Date().toISOString(),
  });

  ctx.logs.push(
    `Delay block "${block.label}" — scheduled for ${executeAt.toISOString()} (${totalMinutes} min)`
  );

  // Stop current execution chain; deferred execution will pick up remaining blocks
  return false;
}

/* ── Condition Block ──────────────────────────────────── */

function evaluateCondition(block: FlowBlock, ctx: ExecutionContext): boolean {
  const config = block.config;
  const field = String(config?.field || "");
  const operator = String(config?.operator || "equals");
  const expectedValue = config?.value;

  const actualValue = getNestedValue(ctx.variables as Record<string, unknown>, field);

  let result = false;

  switch (operator) {
    case "equals":
    case "eq":
      result = String(actualValue) === String(expectedValue);
      break;
    case "not_equals":
    case "neq":
      result = String(actualValue) !== String(expectedValue);
      break;
    case "contains":
      result = String(actualValue).includes(String(expectedValue));
      break;
    case "greater_than":
    case "gt":
      result = Number(actualValue) > Number(expectedValue);
      break;
    case "less_than":
    case "lt":
      result = Number(actualValue) < Number(expectedValue);
      break;
    case "exists":
      result = actualValue !== null && actualValue !== undefined;
      break;
    case "not_exists":
      result = actualValue === null || actualValue === undefined;
      break;
    default:
      result = true;
  }

  ctx.logs.push(
    `Condition "${block.label}" — ${field} ${operator} ${expectedValue} → ${result ? "PASS" : "FAIL"}`
  );

  return result;
}

/* ── Action Block ─────────────────────────────────────── */

async function executeActionBlock(
  block: FlowBlock,
  ctx: ExecutionContext,
  supabase: any
): Promise<boolean> {
  const actionType = String(block.config?.action || "");

  ctx.logs.push(`Action "${block.label}" — executing: ${actionType}`);

  const result: ActionResult = await executeAction(actionType, block.config, ctx, supabase);

  if (!result.success) {
    throw new Error(result.error || `Action "${actionType}" failed`);
  }

  // Merge any output variables for downstream blocks
  if (result.output) {
    Object.assign(ctx.variables, result.output);
  }

  ctx.logs.push(`Action "${block.label}" — completed successfully`);
  return true;
}

/* ── Execution Logging ────────────────────────────────── */

async function logExecution(
  supabase: any,
  flowId: string,
  event: AutomationEvent,
  status: "success" | "failed" | "scheduled",
  error: string | null,
  result: Record<string, unknown> | null
) {
  await supabase.from("automation_logs").insert({
    flow_id: flowId,
    organization_id: event.organization_id,
    status,
    trigger_data: {
      event_type: event.type,
      entity_type: event.entity_type,
      entity_id: event.entity_id,
    },
    result: result || {},
    error,
    started_at: event.timestamp,
    completed_at: new Date().toISOString(),
  });
}

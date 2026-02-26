/**
 * ═══════════════════════════════════════════════════════════
 * Project Automata — Automation Worker (Edge Function)
 * ═══════════════════════════════════════════════════════════
 *
 * The core execution engine for iWorkr automations.
 *
 * Architecture:
 *   1. Claims a queue item using Postgres SKIP LOCKED (no races)
 *   2. Checks the circuit breaker (rate limit per workspace)
 *   3. Claims idempotency via automation_runs UNIQUE constraint
 *   4. Evaluates JSON Logic conditions against hydrated payload
 *   5. Executes action blocks (email, SMS, webhook, etc.)
 *   6. Supports X-Dry-Run mode for sandbox testing
 *
 * Invoked by: pg_cron (every 1 min) or direct POST for testing.
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* ── CORS ──────────────────────────────────────────────── */

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_URL") || "http://localhost:3000",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-dry-run",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/* ── JSON Logic Engine (Lightweight) ──────────────────── */

type JsonLogicRule = Record<string, unknown>;

function applyJsonLogic(rule: JsonLogicRule | boolean | null, data: Record<string, unknown>): unknown {
  if (rule === null || rule === undefined) return true; // No conditions = always pass
  if (typeof rule === "boolean") return rule;
  if (typeof rule !== "object" || Array.isArray(rule)) return rule;

  const operator = Object.keys(rule)[0];
  const args = rule[operator];

  switch (operator) {
    case "and": {
      const conditions = args as JsonLogicRule[];
      return conditions.every((c) => !!applyJsonLogic(c, data));
    }
    case "or": {
      const conditions = args as JsonLogicRule[];
      return conditions.some((c) => !!applyJsonLogic(c, data));
    }
    case "!":
    case "not":
      return !applyJsonLogic(args as JsonLogicRule, data);
    case "var": {
      const path = args as string;
      return getNestedValue(data, path);
    }
    case "==":
    case "===": {
      const [a, b] = (args as unknown[]).map((v) => resolveValue(v, data));
      return String(a) === String(b);
    }
    case "!=":
    case "!==": {
      const [a, b] = (args as unknown[]).map((v) => resolveValue(v, data));
      return String(a) !== String(b);
    }
    case ">": {
      const [a, b] = (args as unknown[]).map((v) => resolveValue(v, data));
      return Number(a) > Number(b);
    }
    case ">=": {
      const [a, b] = (args as unknown[]).map((v) => resolveValue(v, data));
      return Number(a) >= Number(b);
    }
    case "<": {
      const [a, b] = (args as unknown[]).map((v) => resolveValue(v, data));
      return Number(a) < Number(b);
    }
    case "<=": {
      const [a, b] = (args as unknown[]).map((v) => resolveValue(v, data));
      return Number(a) <= Number(b);
    }
    case "in": {
      const [needle, haystack] = (args as unknown[]).map((v) => resolveValue(v, data));
      if (typeof haystack === "string") return (haystack as string).includes(String(needle));
      if (Array.isArray(haystack)) return (haystack as unknown[]).includes(needle);
      return false;
    }
    case "if": {
      const ifArgs = args as unknown[];
      for (let i = 0; i < ifArgs.length - 1; i += 2) {
        if (!!applyJsonLogic(ifArgs[i] as JsonLogicRule, data)) {
          return applyJsonLogic(ifArgs[i + 1] as JsonLogicRule, data);
        }
      }
      if (ifArgs.length % 2 === 1) {
        return applyJsonLogic(ifArgs[ifArgs.length - 1] as JsonLogicRule, data);
      }
      return null;
    }
    default:
      console.warn(`[Automata] Unknown JSON Logic operator: ${operator}`);
      return true;
  }
}

function resolveValue(v: unknown, data: Record<string, unknown>): unknown {
  if (v !== null && typeof v === "object" && !Array.isArray(v)) {
    return applyJsonLogic(v as JsonLogicRule, data);
  }
  return v;
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

/* ── Handlebars Variable Interpolation ────────────────── */

function interpolate(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_match, path) => {
    const value = getNestedValue(data, path.trim());
    return value !== null && value !== undefined ? String(value) : "";
  });
}

/* ── Trace Builder ────────────────────────────────────── */

interface TraceStep {
  step: string;
  status: "passed" | "failed" | "simulated" | "skipped" | "error";
  description?: string;
  evaluation?: string;
  data?: unknown;
  duration_ms?: number;
}

/* ── Action Executors ─────────────────────────────────── */

async function executeAction(
  block: Record<string, unknown>,
  context: Record<string, unknown>,
  orgId: string,
  adminClient: ReturnType<typeof createClient>,
  isDryRun: boolean
): Promise<{ success: boolean; output?: unknown; error?: string; simulated?: boolean }> {
  const config = (block.config || {}) as Record<string, unknown>;
  const actionType = (config.action || block.type) as string;

  switch (actionType) {
    case "send_email": {
      const to = interpolate(String(config.to || "{{trigger.client_email}}"), context);
      const subject = interpolate(String(config.subject || "iWorkr Notification"), context);
      const html = interpolate(String(config.html || config.body || config.template || ""), context);

      if (!to) return { success: false, error: "No recipient email" };

      if (isDryRun) {
        return {
          success: true,
          simulated: true,
          output: { would_send_to: to, subject, body_preview: html.slice(0, 200) },
        };
      }

      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      if (!resendApiKey) return { success: false, error: "RESEND_API_KEY not configured" };

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: Deno.env.get("RESEND_FROM_EMAIL") || "iWorkr <noreply@iworkrapp.com>",
          to: [to],
          subject,
          html,
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        return { success: false, error: `Email send failed: ${err}` };
      }
      return { success: true, output: { emailed: to } };
    }

    case "send_sms": {
      const phone = interpolate(String(config.phone || config.to || "{{trigger.client_phone}}"), context);
      const body = interpolate(String(config.body || config.template || ""), context);

      if (!phone) return { success: false, error: "No phone number" };

      if (isDryRun) {
        return {
          success: true,
          simulated: true,
          output: { would_sms_to: phone, body_preview: body.slice(0, 160) },
        };
      }

      // TODO: Wire to Twilio/SMS provider
      return { success: false, error: "SMS provider not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN environment variables." };
    }

    case "send_notification":
    case "create_notification": {
      const userId = interpolate(String(config.user_id || "{{trigger.user_id}}"), context);
      const title = interpolate(String(config.title || "Automation notification"), context);
      const body = interpolate(String(config.body || ""), context);

      if (!userId) return { success: false, error: "No user_id for notification" };

      if (isDryRun) {
        return { success: true, simulated: true, output: { would_notify: userId, title } };
      }

      await adminClient.from("notifications").insert({
        organization_id: orgId,
        user_id: userId,
        type: "system",
        title,
        body,
        metadata: { source: "automation" },
      });
      return { success: true, output: { notified: userId } };
    }

    case "update_job_status": {
      const jobId = interpolate(String(config.job_id || "{{trigger.entity_id}}"), context);
      const newStatus = String(config.status || "");

      if (!jobId || !newStatus) return { success: false, error: "job_id and status required" };

      if (isDryRun) {
        return { success: true, simulated: true, output: { would_update: jobId, to_status: newStatus } };
      }

      const { error } = await adminClient
        .from("jobs")
        .update({ status: newStatus })
        .eq("id", jobId)
        .eq("organization_id", orgId);

      if (error) return { success: false, error: error.message };
      return { success: true, output: { job_id: jobId, new_status: newStatus } };
    }

    case "create_job": {
      const title = interpolate(String(config.title || "Auto-created job"), context);

      if (isDryRun) {
        return { success: true, simulated: true, output: { would_create_job: title } };
      }

      const { data: job, error } = await adminClient
        .from("jobs")
        .insert({
          organization_id: orgId,
          display_id: `JOB-AUTO-${Date.now()}`,
          title,
          status: String(config.initial_status || "todo"),
          priority: String(config.priority || "medium"),
          metadata: { source: "automation" },
        })
        .select("id")
        .single();

      if (error) return { success: false, error: error.message };
      return { success: true, output: { job_id: job.id } };
    }

    case "webhook": {
      const url = String(config.url || "");
      if (!url) return { success: false, error: "No webhook URL" };

      if (isDryRun) {
        return { success: true, simulated: true, output: { would_post_to: url } };
      }

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organization_id: orgId, context }),
      });

      return {
        success: res.ok,
        output: { status: res.status },
        error: res.ok ? undefined : `Webhook returned ${res.status}`,
      };
    }

    default:
      return { success: false, error: `Unknown action type: ${actionType}` };
  }
}

/* ── Main Worker ──────────────────────────────────────── */

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const authHeader = req.headers.get("Authorization");
    const isDryRun = req.headers.get("X-Dry-Run") === "true";

    // Auth check
    const isServiceRole = authHeader === `Bearer ${serviceRoleKey}`;
    if (!isServiceRole) {
      const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader! } },
      });
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // ── Dry Run Mode: Direct payload testing ────────────
    if (isDryRun) {
      const body = await req.json();
      const { flow_id, mock_payload } = body;

      if (!flow_id) {
        return new Response(JSON.stringify({ error: "flow_id required for dry run" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: flow, error: flowErr } = await adminClient
        .from("automation_flows")
        .select("*")
        .eq("id", flow_id)
        .single();

      if (flowErr || !flow) {
        return new Response(JSON.stringify({ error: "Flow not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const trace: TraceStep[] = [];
      const blocks = (flow.blocks || []) as Record<string, unknown>[];
      const context: Record<string, unknown> = {
        trigger: mock_payload || {},
        workspace: { id: flow.organization_id },
      };

      // Step 1: Trigger
      trace.push({
        step: "trigger",
        status: "passed",
        description: `Trigger matched: ${(flow.trigger_config as Record<string, unknown>)?.event || "manual"}`,
        data: mock_payload,
      });

      // Step 2: Evaluate JSON Logic conditions
      if (flow.conditions) {
        const condStart = Date.now();
        const condResult = applyJsonLogic(flow.conditions as JsonLogicRule, context);
        trace.push({
          step: "conditions",
          status: condResult ? "passed" : "failed",
          evaluation: JSON.stringify(flow.conditions),
          description: condResult
            ? "All conditions evaluated to true"
            : "Conditions evaluated to false — automation would abort",
          duration_ms: Date.now() - condStart,
        });
        if (!condResult) {
          return new Response(
            JSON.stringify({ status: "conditions_failed", trace }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // Step 3: Execute action blocks in dry-run mode
      const actionBlocks = blocks.filter((b) => b.type !== "trigger");
      for (let i = 0; i < actionBlocks.length; i++) {
        const block = actionBlocks[i];
        const blockStart = Date.now();

        if (block.type === "delay") {
          const config = (block.config || {}) as Record<string, string>;
          trace.push({
            step: `delay_${i}`,
            status: "simulated",
            description: `Would wait ${config.duration || config.delay_minutes || "?"} before continuing`,
            duration_ms: Date.now() - blockStart,
          });
          continue;
        }

        if (block.type === "condition") {
          const config = (block.config || {}) as Record<string, string>;
          const field = config.field || "";
          const op = config.operator || "equals";
          const expected = config.value || "";
          const actual = getNestedValue(context, field);
          const passed = evaluateSimpleCondition(actual, op, expected);
          trace.push({
            step: `condition_${i}`,
            status: passed ? "passed" : "failed",
            evaluation: `${field} ${op} ${expected} → actual: ${JSON.stringify(actual)} → ${passed}`,
            duration_ms: Date.now() - blockStart,
          });
          if (!passed) break;
          continue;
        }

        // Action blocks
        const result = await executeAction(block, context, flow.organization_id, adminClient, true);
        trace.push({
          step: `action_${i}`,
          status: result.simulated ? "simulated" : result.success ? "passed" : "error",
          description: result.simulated
            ? `Would execute: ${JSON.stringify(result.output)}`
            : result.error || "Executed",
          data: result.output,
          duration_ms: Date.now() - blockStart,
        });
      }

      return new Response(
        JSON.stringify({ status: "success", trace, duration_ms: Date.now() - startTime }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Production Mode: SKIP LOCKED Queue Processing ───
    const batchSize = 10;
    let totalProcessed = 0;
    let totalSucceeded = 0;
    let totalFailed = 0;
    let totalSkipped = 0;

    for (let batch = 0; batch < batchSize; batch++) {
      // 1. Claim next queue item via SKIP LOCKED
      const { data: claimResult, error: claimErr } = await adminClient.rpc("claim_queue_item");
      if (claimErr) {
        console.error("[Automata] Claim error:", claimErr.message);
        break;
      }

      if (!claimResult?.claimed) break; // Queue exhausted

      const queueItem = claimResult.queue_item;
      const flow = claimResult.flow;
      const workspaceId = queueItem.organization_id;

      // 2. Circuit Breaker — rate limit per workspace
      const { data: circuitData } = await adminClient.rpc("check_circuit_breaker", {
        p_workspace_id: workspaceId,
      });

      if (circuitData?.tripped) {
        console.warn(`[Automata] Circuit breaker tripped for workspace ${workspaceId}`);
        await adminClient.rpc("complete_queue_item", {
          p_queue_id: queueItem.id,
          p_status: "pending", // Re-queue — don't lose the item
          p_error: `Circuit breaker: ${circuitData.executions_in_window} executions in last minute (limit: ${circuitData.limit})`,
        });
        // Push execute_at back by 2 minutes
        await adminClient
          .from("automation_queue")
          .update({ execute_at: new Date(Date.now() + 120_000).toISOString() })
          .eq("id", queueItem.id);
        totalSkipped++;
        continue;
      }

      // 3. Check flow is still active
      if (flow.status !== "active") {
        await adminClient.rpc("complete_queue_item", {
          p_queue_id: queueItem.id,
          p_status: "completed",
          p_error: "Flow is no longer active",
        });
        totalSkipped++;
        continue;
      }

      // 4. Idempotency — claim execution rights
      const triggerEventId = queueItem.trigger_event_id || `queue_${queueItem.id}`;
      const { data: claimed } = await adminClient.rpc("try_claim_execution", {
        p_automation_id: flow.id,
        p_trigger_event_id: triggerEventId,
        p_workspace_id: workspaceId,
      });

      if (!claimed) {
        console.log(`[Automata] Duplicate execution blocked: ${flow.id} / ${triggerEventId}`);
        await adminClient.rpc("complete_queue_item", {
          p_queue_id: queueItem.id,
          p_status: "completed",
          p_error: "Idempotency: already executed",
        });
        totalSkipped++;
        continue;
      }

      // 5. Execute the automation
      const execStart = Date.now();
      const trace: TraceStep[] = [];
      const blocks = (flow.blocks || []) as Record<string, unknown>[];
      const startIndex = queueItem.block_index || 0;
      const eventData = queueItem.event_data || {};
      const context: Record<string, unknown> = {
        trigger: eventData,
        workspace: { id: workspaceId },
        ...(queueItem.context_payload || {}),
      };

      let succeeded = true;
      let lastError: string | undefined;

      // 5a. Evaluate JSON Logic conditions (if starting from index 0)
      if (startIndex === 0 && flow.conditions) {
        const condResult = applyJsonLogic(flow.conditions as JsonLogicRule, context);
        trace.push({
          step: "conditions",
          status: condResult ? "passed" : "failed",
          evaluation: JSON.stringify(flow.conditions),
        });
        if (!condResult) {
          succeeded = true; // Not an error — conditions just didn't match
          await adminClient.rpc("complete_queue_item", {
            p_queue_id: queueItem.id,
            p_status: "completed",
          });
          // Update idempotency record
          await adminClient
            .from("automation_runs")
            .update({ execution_status: "skipped", trace })
            .eq("automation_id", flow.id)
            .eq("trigger_event_id", triggerEventId);
          totalSkipped++;
          continue;
        }
      }

      // 5b. Execute blocks
      const actionBlocks = blocks.filter((b) => (b as Record<string, unknown>).type !== "trigger");
      for (let i = startIndex; i < actionBlocks.length; i++) {
        const block = actionBlocks[i] as Record<string, unknown>;

        // Delay — schedule deferred execution
        if (block.type === "delay") {
          const config = (block.config || {}) as Record<string, string>;
          const delayMins = Number(config.delay_minutes || 0);
          const delayHrs = Number(config.delay_hours || 0);
          const delayDays = Number(config.delay_days || 0);
          const totalMins = delayMins + delayHrs * 60 + delayDays * 1440;
          const duration = config.duration || "";
          // Parse duration string (e.g., "2h", "7d", "30m")
          const parsedMins = parseDuration(duration) || totalMins;

          if (parsedMins > 0) {
            await adminClient.rpc("enqueue_automation", {
              p_workspace_id: workspaceId,
              p_flow_id: flow.id,
              p_trigger_event_id: `${triggerEventId}_delay_${i}`,
              p_event_data: eventData,
              p_context_payload: context,
              p_execute_after: new Date(Date.now() + parsedMins * 60_000).toISOString(),
              p_block_index: i + 1,
            });
            trace.push({ step: `delay_${i}`, status: "passed", description: `Deferred ${parsedMins}m` });
            break; // Stop processing; deferred job will resume
          }
          continue;
        }

        // Inline condition block (legacy support)
        if (block.type === "condition") {
          const config = (block.config || {}) as Record<string, string>;
          const actual = getNestedValue(context, config.field || "");
          const passed = evaluateSimpleCondition(actual, config.operator || "equals", config.value || "");
          trace.push({
            step: `condition_${i}`,
            status: passed ? "passed" : "failed",
            evaluation: `${config.field} ${config.operator} ${config.value} → ${passed}`,
          });
          if (!passed) break;
          continue;
        }

        // Action block
        const actionStart = Date.now();
        try {
          const result = await executeAction(block, context, workspaceId, adminClient, false);
          trace.push({
            step: `action_${i}`,
            status: result.success ? "passed" : "error",
            description: result.success ? `Executed: ${JSON.stringify(result.output)}` : result.error,
            duration_ms: Date.now() - actionStart,
          });

          if (!result.success) {
            succeeded = false;
            lastError = result.error;
            break;
          }

          // Merge output into context for downstream blocks
          if (result.output && typeof result.output === "object") {
            Object.assign(context, result.output);
          }
        } catch (err) {
          const msg = (err as Error).message;
          trace.push({ step: `action_${i}`, status: "error", description: msg });
          succeeded = false;
          lastError = msg;
          break;
        }
      }

      const execTime = Date.now() - execStart;

      // 6. Finalize
      if (succeeded) {
        await adminClient.rpc("complete_queue_item", {
          p_queue_id: queueItem.id,
          p_status: "completed",
        });
        totalSucceeded++;
      } else {
        const { data: retryResult } = await adminClient.rpc("retry_or_dead_letter", {
          p_queue_id: queueItem.id,
          p_error: lastError,
        });
        if (retryResult === "dead_letter") totalFailed++;
        else totalFailed++;
      }

      // 7. Update idempotency record with trace
      await adminClient
        .from("automation_runs")
        .update({
          execution_status: succeeded ? "success" : "failed",
          execution_time_ms: execTime,
          error_details: lastError || null,
          trace,
        })
        .eq("automation_id", flow.id)
        .eq("trigger_event_id", triggerEventId);

      // 8. Log execution
      await adminClient.from("automation_logs").insert({
        flow_id: flow.id,
        organization_id: workspaceId,
        status: succeeded ? "success" : "failed",
        trigger_data: eventData,
        result: { blocks_executed: trace },
        error: lastError,
        execution_time_ms: execTime,
        trace,
        completed_at: new Date().toISOString(),
      });

      // 9. Bump flow run count
      await adminClient
        .from("automation_flows")
        .update({ run_count: (flow.run_count || 0) + 1, last_run: new Date().toISOString() })
        .eq("id", flow.id);

      totalProcessed++;
    }

    console.log(
      `[Automata] Batch: processed=${totalProcessed} ok=${totalSucceeded} fail=${totalFailed} skip=${totalSkipped}`
    );

    return new Response(
      JSON.stringify({
        success: true,
        processed: totalProcessed,
        succeeded: totalSucceeded,
        failed: totalFailed,
        skipped: totalSkipped,
        duration_ms: Date.now() - startTime,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[Automata] Worker error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/* ── Helpers ──────────────────────────────────────────── */

function parseDuration(str: string): number {
  if (!str) return 0;
  const match = str.match(/^(\d+)(m|h|d)$/i);
  if (!match) return 0;
  const val = Number(match[1]);
  switch (match[2].toLowerCase()) {
    case "m": return val;
    case "h": return val * 60;
    case "d": return val * 1440;
    default: return 0;
  }
}

function evaluateSimpleCondition(actual: unknown, operator: string, expected: string): boolean {
  switch (operator) {
    case "equals":
    case "eq":
    case "==":
      return String(actual) === String(expected);
    case "not_equals":
    case "neq":
    case "!=":
      return String(actual) !== String(expected);
    case "contains":
      return String(actual).includes(expected);
    case "greater_than":
    case "gt":
    case ">":
      return Number(actual) > Number(expected);
    case "less_than":
    case "lt":
    case "<":
      return Number(actual) < Number(expected);
    case "exists":
      return actual !== null && actual !== undefined && actual !== "";
    case "not_exists":
      return actual === null || actual === undefined || actual === "";
    default:
      return true;
  }
}

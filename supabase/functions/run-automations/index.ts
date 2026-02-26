import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_URL") || "http://localhost:3000",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** Execute a single automation block action */
async function executeBlock(
  adminClient: ReturnType<typeof createClient>,
  block: Record<string, unknown>,
  eventData: Record<string, unknown>,
  orgId: string
): Promise<{ success: boolean; output?: unknown; error?: string }> {
  const blockType = block.type as string;

  try {
    switch (blockType) {
      case "send_notification": {
        const userId = (block.user_id as string) || (eventData.user_id as string);
        const title = (block.title as string) || "Automation notification";
        const body = (block.body as string) || "";

        if (!userId) return { success: false, error: "No user_id for notification" };

        await adminClient.from("notifications").insert({
          organization_id: orgId,
          user_id: userId,
          type: "system",
          title,
          body,
          metadata: { source: "automation", event_data: eventData },
        });

        return { success: true, output: { notified: userId } };
      }

      case "update_job_status": {
        const jobId = (block.job_id as string) || (eventData.job_id as string);
        const newStatus = block.status as string;

        if (!jobId || !newStatus) {
          return { success: false, error: "job_id and status required" };
        }

        const { error } = await adminClient
          .from("jobs")
          .update({ status: newStatus })
          .eq("id", jobId)
          .eq("organization_id", orgId);

        if (error) return { success: false, error: error.message };
        return { success: true, output: { job_id: jobId, new_status: newStatus } };
      }

      case "send_email": {
        const resendApiKey = Deno.env.get("RESEND_API_KEY");
        if (!resendApiKey) return { success: false, error: "RESEND_API_KEY not configured" };

        const to = (block.to as string) || (eventData.email as string);
        const subject = (block.subject as string) || "iWorkr Notification";
        const html = (block.html as string) || (block.body as string) || "";

        if (!to) return { success: false, error: "No recipient email" };

        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
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

      case "create_job": {
        const title = (block.title as string) || (eventData.title as string) || "Auto-created job";

        const { data: job, error } = await adminClient
          .from("jobs")
          .insert({
            organization_id: orgId,
            display_id: `JOB-AUTO-${Date.now()}`,
            title,
            status: (block.initial_status as string) || "todo",
            priority: (block.priority as string) || "medium",
            assignee_id: block.assignee_id as string || undefined,
            client_id: block.client_id as string || undefined,
            metadata: { source: "automation", event_data: eventData },
          })
          .select("id")
          .single();

        if (error) return { success: false, error: error.message };
        return { success: true, output: { job_id: job.id } };
      }

      case "webhook": {
        const url = block.url as string;
        if (!url) return { success: false, error: "No webhook URL" };

        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            organization_id: orgId,
            event_data: eventData,
            block_config: block,
          }),
        });

        return {
          success: res.ok,
          output: { status: res.status },
          error: res.ok ? undefined : `Webhook returned ${res.status}`,
        };
      }

      case "delay": {
        // Delay blocks should have been scheduled into automation_queue
        // If we hit one during processing, it means it was already waited for
        return { success: true, output: { delayed: true } };
      }

      default:
        return { success: false, error: `Unknown block type: ${blockType}` };
    }
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate the request — invoked by pg_cron (every 15 min) or admin
    const authHeader = req.headers.get("Authorization");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const isServiceRole = authHeader === `Bearer ${serviceRoleKey}`;

    if (!isServiceRole) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader! } } }
      );
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      serviceRoleKey
    );

    const now = new Date().toISOString();
    let queueProcessed = 0;
    let queueSucceeded = 0;
    let queueFailed = 0;

    // ── 1. Process pending items from the automation_queue ────────
    const { data: pendingItems, error: queueError } = await adminClient
      .from("automation_queue")
      .select("*, automation_flows(id, name, organization_id, blocks, status)")
      .eq("status", "pending")
      .lte("execute_at", now)
      .order("execute_at", { ascending: true })
      .limit(100);

    if (queueError) throw queueError;

    for (const item of pendingItems || []) {
      queueProcessed++;

      // Mark as processing
      await adminClient
        .from("automation_queue")
        .update({ status: "processing", attempts: item.attempts + 1 })
        .eq("id", item.id);

      const flow = item.automation_flows as {
        id: string;
        name: string;
        organization_id: string;
        blocks: Record<string, unknown>[];
        status: string;
      } | null;

      if (!flow || flow.status !== "active") {
        await adminClient
          .from("automation_queue")
          .update({ status: "completed", completed_at: now, error: "Flow is no longer active" })
          .eq("id", item.id);
        continue;
      }

      const blocks = flow.blocks || [];
      const startIndex = item.block_index || 0;
      let allSucceeded = true;
      let lastError: string | undefined;
      const results: unknown[] = [];

      // Execute blocks starting from the deferred block_index
      for (let i = startIndex; i < blocks.length; i++) {
        const block = blocks[i] as Record<string, unknown>;

        // If we hit another delay block, schedule it for future execution
        if (block.type === "delay") {
          const delayMinutes = (block.delay_minutes as number) || 60;
          const executeAt = new Date(Date.now() + delayMinutes * 60 * 1000).toISOString();

          await adminClient.from("automation_queue").insert({
            organization_id: flow.organization_id,
            flow_id: flow.id,
            event_data: item.event_data,
            block_index: i + 1,
            execute_at: executeAt,
            status: "pending",
          });

          results.push({ block_index: i, type: "delay", scheduled_at: executeAt });
          break; // Stop processing further blocks until the delay expires
        }

        const result = await executeBlock(adminClient, block, item.event_data, flow.organization_id);
        results.push({ block_index: i, ...result });

        if (!result.success) {
          allSucceeded = false;
          lastError = result.error;
          break;
        }
      }

      // Update queue item status
      if (allSucceeded) {
        await adminClient
          .from("automation_queue")
          .update({ status: "completed", completed_at: now })
          .eq("id", item.id);
        queueSucceeded++;
      } else {
        const shouldRetry = item.attempts + 1 < (item.max_attempts || 3);
        await adminClient
          .from("automation_queue")
          .update({
            status: shouldRetry ? "pending" : "failed",
            error: lastError,
            // If retrying, push execute_at back by 5 minutes * attempt count
            ...(shouldRetry
              ? { execute_at: new Date(Date.now() + (item.attempts + 1) * 5 * 60 * 1000).toISOString() }
              : { completed_at: now }),
          })
          .eq("id", item.id);
        queueFailed++;
      }

      // Log execution
      await adminClient.from("automation_logs").insert({
        flow_id: flow.id,
        organization_id: flow.organization_id,
        status: allSucceeded ? "completed" : "failed",
        trigger_data: item.event_data,
        result: { blocks_executed: results },
        error: lastError,
        completed_at: now,
      });
    }

    // ── 2. Run scheduled-trigger flows (cron-style triggers) ─────
    let scheduledRuns = 0;

    const { data: cronFlows } = await adminClient
      .from("automation_flows")
      .select("id, organization_id, name, trigger_config, blocks")
      .eq("status", "active")
      .not("trigger_config->schedule", "is", null);

    for (const flow of cronFlows || []) {
      const triggerConfig = flow.trigger_config as { schedule?: string; last_run_check?: string };
      if (!triggerConfig.schedule) continue;

      // Simple schedule matching: check if enough time has elapsed since last_run
      // The trigger_config.schedule can be: "daily", "hourly", "every_15m", "weekly"
      const { data: lastLog } = await adminClient
        .from("automation_logs")
        .select("started_at")
        .eq("flow_id", flow.id)
        .eq("status", "completed")
        .order("started_at", { ascending: false })
        .limit(1)
        .single();

      const lastRunAt = lastLog?.started_at ? new Date(lastLog.started_at).getTime() : 0;
      const elapsed = Date.now() - lastRunAt;

      const intervals: Record<string, number> = {
        every_15m: 15 * 60 * 1000,
        hourly: 60 * 60 * 1000,
        daily: 24 * 60 * 60 * 1000,
        weekly: 7 * 24 * 60 * 60 * 1000,
      };

      const requiredInterval = intervals[triggerConfig.schedule] || intervals.daily;

      if (elapsed < requiredInterval) continue;

      // Execute flow blocks
      const blocks = (flow.blocks || []) as Record<string, unknown>[];
      const eventData = { trigger: "schedule", schedule: triggerConfig.schedule };
      const results: unknown[] = [];
      let flowSucceeded = true;
      let flowError: string | undefined;

      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];

        if (block.type === "delay") {
          const delayMinutes = (block.delay_minutes as number) || 60;
          await adminClient.from("automation_queue").insert({
            organization_id: flow.organization_id,
            flow_id: flow.id,
            event_data: eventData,
            block_index: i + 1,
            execute_at: new Date(Date.now() + delayMinutes * 60 * 1000).toISOString(),
            status: "pending",
          });
          results.push({ block_index: i, type: "delay", deferred: true });
          break;
        }

        const result = await executeBlock(adminClient, block, eventData, flow.organization_id);
        results.push({ block_index: i, ...result });

        if (!result.success) {
          flowSucceeded = false;
          flowError = result.error;
          break;
        }
      }

      // Log the run
      await adminClient.from("automation_logs").insert({
        flow_id: flow.id,
        organization_id: flow.organization_id,
        status: flowSucceeded ? "completed" : "failed",
        trigger_data: eventData,
        result: { blocks_executed: results },
        error: flowError,
        completed_at: now,
      });

      // Update flow run count and last_run
      await adminClient
        .from("automation_flows")
        .update({ run_count: (((flow as Record<string, unknown>).run_count as number) || 0) + 1, last_run: now })
        .eq("id", flow.id);

      scheduledRuns++;
    }

    // Audit the cron run
    await adminClient.from("audit_log").insert({
      action: "cron.run_automations",
      entity_type: "system",
      new_data: {
        queue_processed: queueProcessed,
        queue_succeeded: queueSucceeded,
        queue_failed: queueFailed,
        scheduled_runs: scheduledRuns,
      },
    });

    console.log(
      `Automations: queue=${queueProcessed} (ok=${queueSucceeded}, fail=${queueFailed}), scheduled=${scheduledRuns}`
    );

    return new Response(
      JSON.stringify({
        success: true,
        queue_processed: queueProcessed,
        queue_succeeded: queueSucceeded,
        queue_failed: queueFailed,
        scheduled_runs: scheduledRuns,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Run automations error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

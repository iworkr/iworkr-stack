/**
 * @route GET /api/automation/cron
 * @status COMPLETE
 * @auth WEBHOOK — Cron secret or rate-limited public access
 * @description Periodic cron job for deferred actions, overdue invoices, and reminders
 * @lastAudit 2026-03-22
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { dispatchAndWait, Events } from "@/lib/automation";
import { rateLimit, getIdentifier, RateLimits } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

/**
 * GET /api/automation/cron
 *
 * Periodic job that:
 * 1. Processes the deferred action queue (delayed actions)
 * 2. Checks for overdue invoices
 * 3. Checks for upcoming schedule reminders
 *
 * Should be called by a cron service (e.g., Vercel Cron) every 5-15 minutes.
 */
export async function GET(request: NextRequest) {
  // Rate limit
  const rl = await rateLimit(`cron:${getIdentifier(request)}`, RateLimits.cron);
  if (!rl.success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const results = {
    queue_processed: 0,
    overdue_invoices: 0,
    schedule_reminders: 0,
    errors: [] as string[],
  };

  // ── 1. Process deferred action queue ──────────────────
  try {
    const { data: pendingItems } = await supabase
      .from("automation_queue")
      .select("*")
      .eq("status", "pending")
      .lte("execute_at", new Date().toISOString())
      .order("execute_at", { ascending: true })
      .limit(20);

    const queueItems = pendingItems || [];
    if (queueItems.length > 0) {
      const idsByNextAttempts = new Map<number, string[]>();
      for (const item of queueItems) {
        const nextAttempts = item.attempts + 1;
        const list = idsByNextAttempts.get(nextAttempts) ?? [];
        list.push(item.id);
        idsByNextAttempts.set(nextAttempts, list);
      }
      for (const [nextAttempts, ids] of idsByNextAttempts) {
        await supabase
          .from("automation_queue")
          .update({ status: "processing", attempts: nextAttempts })
          .in("id", ids);
      }

      const completedIds: string[] = [];
      for (const item of queueItems) {
        try {
          const event = item.event_data;
          await dispatchAndWait(event);
          completedIds.push(item.id);
          results.queue_processed++;
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          const newStatus = item.attempts + 1 >= item.max_attempts ? "failed" : "pending";

          await supabase
            .from("automation_queue")
            .update({ status: newStatus, error: errorMsg })
            .eq("id", item.id);

          results.errors.push(`Queue item ${item.id}: ${errorMsg}`);
        }
      }

      if (completedIds.length > 0) {
        await supabase
          .from("automation_queue")
          .update({ status: "completed", completed_at: new Date().toISOString() })
          .in("id", completedIds);
      }
    }
  } catch (err) {
    results.errors.push(`Queue processing: ${err instanceof Error ? err.message : String(err)}`);
  }

  // ── 2. Check overdue invoices ─────────────────────────
  try {
    const { data: overdueInvoices } = await supabase
      .from("invoices")
      .select("id, organization_id, display_id, client_id, client_name, client_email, total, due_date")
      .eq("status", "sent")
      .lt("due_date", new Date().toISOString().split("T")[0])
      .is("deleted_at", null);

    const overdueList = overdueInvoices || [];
    if (overdueList.length > 0) {
      await supabase
        .from("invoices")
        .update({ status: "overdue" })
        .in(
          "id",
          overdueList.map((inv) => inv.id)
        );

      for (const invoice of overdueList) {
        await dispatchAndWait(
          Events.invoiceOverdue(invoice.organization_id, invoice.id, {
            display_id: invoice.display_id,
            client_id: invoice.client_id,
            client_name: invoice.client_name,
            client_email: invoice.client_email,
            total: invoice.total,
            due_date: invoice.due_date,
          })
        );

        results.overdue_invoices++;
      }
    }
  } catch (err) {
    results.errors.push(`Overdue check: ${err instanceof Error ? err.message : String(err)}`);
  }

  // ── 3. Check upcoming schedule reminders ──────────────
  try {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const now = new Date().toISOString();

    const { data: upcomingBlocks } = await supabase
      .from("schedule_blocks")
      .select("id, organization_id, technician_id, title, client_name, location, start_time")
      .eq("status", "scheduled")
      .gte("start_time", now)
      .lte("start_time", tomorrow);

    const blocks = upcomingBlocks || [];
    if (blocks.length > 0) {
      const blockIds = new Set(blocks.map((b) => b.id));
      const orgIds = [...new Set(blocks.map((b) => b.organization_id))];
      const { data: reminderLogs } = await supabase
        .from("automation_logs")
        .select("trigger_data")
        .in("organization_id", orgIds)
        .contains("trigger_data", { event_type: "schedule.reminder" });

      const remindedBlockIds = new Set<string>();
      for (const log of reminderLogs || []) {
        const td = log.trigger_data as { entity_id?: string; event_type?: string } | null;
        if (
          td?.event_type === "schedule.reminder" &&
          typeof td.entity_id === "string" &&
          blockIds.has(td.entity_id)
        ) {
          remindedBlockIds.add(td.entity_id);
        }
      }

      for (const block of blocks) {
        if (remindedBlockIds.has(block.id)) continue;

        const event = {
          id: `cron_sched_${block.id}`,
          type: "schedule.reminder" as const,
          category: "schedule" as const,
          organization_id: block.organization_id,
          user_id: block.technician_id,
          entity_type: "schedule_block",
          entity_id: block.id,
          payload: {
            title: block.title,
            client_name: block.client_name,
            location: block.location,
            start_time: block.start_time,
          },
          timestamp: new Date().toISOString(),
        };

        await dispatchAndWait(event);
        results.schedule_reminders++;
      }
    }
  } catch (err) {
    results.errors.push(`Schedule reminders: ${err instanceof Error ? err.message : String(err)}`);
  }

  logger.info("Cron completed", "cron", {
    queue_processed: results.queue_processed,
    overdue_invoices: results.overdue_invoices,
    schedule_reminders: results.schedule_reminders,
    errors: results.errors.length,
  });

  return NextResponse.json({
    success: true,
    processed_at: new Date().toISOString(),
    ...results,
  });
}

/**
 * POST /api/automation/cron
 *
 * Handles specific cron jobs dispatched by pg_cron.
 * Body: { "job": "invoice-overdue-watchdog" | "daily-digest-emails" | ... }
 */
export async function POST(request: NextRequest) {
  // Verify auth
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { job?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { job } = body;
  if (!job) {
    return NextResponse.json({ error: "Missing 'job' field" }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  // Route to the appropriate Edge Function or inline handler
  const edgeFunctionMap: Record<string, string> = {
    "daily-digest-emails": "trigger-daily-emails",
    "asset-service-reminders": "asset-service-reminder",
    "sync-polar-subscriptions": "sync-polar-status",
    "run-scheduled-automations": "run-automations",
    "process-mail-queue": "process-mail",
    "chronos-weekly-aggregation": "aggregate-coordination-billing",
  };

  // Jobs that can be handled by invoking the GET handler
  if (job === "invoice-overdue-watchdog") {
    // Re-use the GET handler logic for overdue invoice processing
    const response = await GET(request);
    return response;
  }

  if (job === "stale-job-cleanup") {
    // Clean up soft-deleted jobs older than 30 days
    const supabase = createClient(supabaseUrl, serviceKey);
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("jobs")
      .delete({ count: "exact" })
      .not("deleted_at", "is", null)
      .lt("deleted_at", cutoff);

    logger.info("Stale job cleanup", "cron", { deleted: count });
    return NextResponse.json({ success: true, job, deleted: count });
  }

  // Dispatch to Edge Function
  const functionName = edgeFunctionMap[job];
  if (functionName) {
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ triggered_by: "pg_cron", job }),
      });

      const data = await res.json();
      logger.info(`Cron job ${job} dispatched`, "cron", { status: res.status });
      return NextResponse.json({ success: res.ok, job, ...data });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`Cron job ${job} failed: ${msg}`, "cron");
      return NextResponse.json({ error: msg, job }, { status: 500 });
    }
  }

  return NextResponse.json({ error: `Unknown job: ${job}` }, { status: 400 });
}

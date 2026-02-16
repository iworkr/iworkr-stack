/**
 * iWorkr Automation Action Executors
 *
 * Each executor handles a specific action type within an automation flow.
 * All executors receive context and return a standardized result.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

/* ── Types ────────────────────────────────────────────── */

export interface ActionResult {
  success: boolean;
  error?: string;
  output?: Record<string, unknown>;
}

interface ActionContext {
  event: {
    type: string;
    organization_id: string;
    user_id?: string;
    entity_id?: string;
    entity_type?: string;
    payload: Record<string, unknown>;
    timestamp: string;
  };
  flow: { id: string; name: string; organization_id: string };
  variables: Record<string, unknown>;
  logs: string[];
}

type SupabaseAdmin = any;

/* ── Action Router ────────────────────────────────────── */

export async function executeAction(
  actionType: string,
  config: Record<string, unknown>,
  ctx: ActionContext,
  supabase: SupabaseAdmin
): Promise<ActionResult> {
  switch (actionType) {
    case "send_email":
      return sendEmailAction(config, ctx, supabase);

    case "send_notification":
    case "create_notification":
      return createNotificationAction(config, ctx, supabase);

    case "create_invoice":
      return createInvoiceAction(config, ctx, supabase);

    case "send_invoice":
      return sendInvoiceAction(config, ctx, supabase);

    case "update_job_status":
      return updateJobStatusAction(config, ctx, supabase);

    case "assign_job":
      return assignJobAction(config, ctx, supabase);

    case "create_task":
      return createTaskAction(config, ctx, supabase);

    case "send_webhook":
      return sendWebhookAction(config, ctx);

    case "log_audit":
      return logAuditAction(config, ctx, supabase);

    case "update_inventory":
      return updateInventoryAction(config, ctx, supabase);

    case "send_sms":
      return sendSmsAction(config, ctx);

    default:
      return {
        success: false,
        error: `Unknown action type: ${actionType}`,
      };
  }
}

/* ── Email Action ─────────────────────────────────────── */

async function sendEmailAction(
  config: Record<string, unknown>,
  ctx: ActionContext,
  supabase: SupabaseAdmin
): Promise<ActionResult> {
  try {
    const template = String(config.template || "generic");
    const toField = String(config.to || "");
    let recipientEmail = toField;

    // Resolve recipient from context
    if (!recipientEmail || recipientEmail === "{{client_email}}") {
      recipientEmail = String(ctx.variables.client_email || ctx.variables.email || "");
    }
    if (recipientEmail === "{{assignee_email}}") {
      const assigneeId = ctx.variables.assignee_id as string;
      if (assigneeId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("email")
          .eq("id", assigneeId)
          .single();
        recipientEmail = profile?.email || "";
      }
    }

    if (!recipientEmail) {
      return { success: false, error: "No recipient email address" };
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return { success: false, error: "RESEND_API_KEY not configured" };
    }

    const subject = interpolate(String(config.subject || `Notification from iWorkr`), ctx.variables);
    const body = interpolate(String(config.body || "You have a new notification."), ctx.variables);

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `iWorkr <${process.env.ADMIN_EMAIL || "noreply@iworkrapp.com"}>`,
        to: [recipientEmail],
        subject,
        html: buildEmailHtml(subject, body),
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return { success: false, error: `Email send failed: ${err}` };
    }

    return { success: true, output: { email_sent_to: recipientEmail } };
  } catch (err) {
    return { success: false, error: `Email error: ${err instanceof Error ? err.message : String(err)}` };
  }
}

/* ── Notification Action ──────────────────────────────── */

async function createNotificationAction(
  config: Record<string, unknown>,
  ctx: ActionContext,
  supabase: SupabaseAdmin
): Promise<ActionResult> {
  try {
    const recipientId = String(config.user_id || ctx.variables.assignee_id || ctx.variables.user_id || "");
    const title = interpolate(String(config.title || "Automation Notification"), ctx.variables);
    const body = interpolate(String(config.body || config.message || ""), ctx.variables);
    const severity = String(config.severity || "system");

    // If no specific recipient, notify all org admins
    if (!recipientId) {
      const { data: admins } = await supabase
        .from("organization_members")
        .select("user_id")
        .eq("organization_id", ctx.event.organization_id)
        .in("role", ["owner", "admin"])
        .eq("status", "active");

      for (const admin of admins || []) {
        await supabase.from("notifications").insert({
          organization_id: ctx.event.organization_id,
          user_id: admin.user_id,
          type: severity === "warning" ? "system" : "system",
          title,
          body,
          sender_name: `Automation: ${ctx.flow.name}`,
          context: `Flow: ${ctx.flow.name}`,
          related_job_id: ctx.event.entity_type === "job" ? ctx.event.entity_id : null,
          related_client_id: ctx.event.entity_type === "client" ? ctx.event.entity_id : null,
        });
      }

      return { success: true, output: { notified_count: admins?.length || 0 } };
    }

    await supabase.from("notifications").insert({
      organization_id: ctx.event.organization_id,
      user_id: recipientId,
      type: "system",
      title,
      body,
      sender_name: `Automation: ${ctx.flow.name}`,
      context: `Flow: ${ctx.flow.name}`,
      related_job_id: ctx.event.entity_type === "job" ? ctx.event.entity_id : null,
      related_client_id: ctx.event.entity_type === "client" ? ctx.event.entity_id : null,
    });

    return { success: true, output: { notified_user: recipientId } };
  } catch (err) {
    return { success: false, error: `Notification error: ${err instanceof Error ? err.message : String(err)}` };
  }
}

/* ── Create Invoice Action ────────────────────────────── */

async function createInvoiceAction(
  config: Record<string, unknown>,
  ctx: ActionContext,
  supabase: SupabaseAdmin
): Promise<ActionResult> {
  try {
    const jobId = ctx.event.entity_id;
    if (!jobId) {
      return { success: false, error: "No job ID in event context" };
    }

    // Fetch job details
    const { data: job } = await supabase
      .from("jobs")
      .select("*, clients!client_id(name, email, address)")
      .eq("id", jobId)
      .single();

    if (!job) {
      return { success: false, error: "Job not found" };
    }

    // Generate display ID
    const { data: maxInv } = await supabase
      .from("invoices")
      .select("display_id")
      .eq("organization_id", ctx.event.organization_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    const lastNum = maxInv?.display_id ? parseInt(maxInv.display_id.replace("INV-", "")) : 1250;
    const displayId = `INV-${lastNum + 1}`;

    const revenue = Number(job.revenue || 0);
    const tax = revenue * 0.1; // 10% GST

    const { data: invoice, error: invErr } = await supabase
      .from("invoices")
      .insert({
        organization_id: ctx.event.organization_id,
        display_id: displayId,
        client_id: job.client_id,
        job_id: jobId,
        client_name: job.clients?.name || "",
        client_email: job.clients?.email || "",
        client_address: job.clients?.address || "",
        status: "draft",
        issue_date: new Date().toISOString().split("T")[0],
        due_date: new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0],
        subtotal: revenue,
        tax,
        total: revenue + tax,
      })
      .select()
      .single();

    if (invErr) return { success: false, error: invErr.message };

    // Add line item from job
    await supabase.from("invoice_line_items").insert({
      invoice_id: invoice.id,
      description: job.title,
      quantity: 1,
      unit_price: revenue,
    });

    // Add created event
    await supabase.from("invoice_events").insert({
      invoice_id: invoice.id,
      type: "created",
      text: `Invoice auto-created by automation: ${ctx.flow.name}`,
    });

    return { success: true, output: { invoice_id: invoice.id, display_id: displayId } };
  } catch (err) {
    return { success: false, error: `Invoice creation error: ${err instanceof Error ? err.message : String(err)}` };
  }
}

/* ── Send Invoice Action ──────────────────────────────── */

async function sendInvoiceAction(
  config: Record<string, unknown>,
  ctx: ActionContext,
  supabase: SupabaseAdmin
): Promise<ActionResult> {
  try {
    const invoiceId = String(config.invoice_id || ctx.variables.invoice_id || "");
    if (!invoiceId) {
      return { success: false, error: "No invoice ID" };
    }

    // Update invoice status to sent
    await supabase
      .from("invoices")
      .update({ status: "sent" })
      .eq("id", invoiceId);

    // Add sent event
    await supabase.from("invoice_events").insert({
      invoice_id: invoiceId,
      type: "sent",
      text: `Invoice auto-sent by automation: ${ctx.flow.name}`,
    });

    return { success: true };
  } catch (err) {
    return { success: false, error: `Send invoice error: ${err instanceof Error ? err.message : String(err)}` };
  }
}

/* ── Update Job Status Action ─────────────────────────── */

async function updateJobStatusAction(
  config: Record<string, unknown>,
  ctx: ActionContext,
  supabase: SupabaseAdmin
): Promise<ActionResult> {
  try {
    const jobId = String(config.job_id || ctx.event.entity_id || "");
    const newStatus = String(config.status || "");

    if (!jobId || !newStatus) {
      return { success: false, error: "Missing job_id or status" };
    }

    await supabase
      .from("jobs")
      .update({ status: newStatus })
      .eq("id", jobId);

    await supabase.from("job_activity").insert({
      job_id: jobId,
      type: "status_change",
      text: `Status changed to ${newStatus} by automation: ${ctx.flow.name}`,
      user_name: "Automation",
    });

    return { success: true };
  } catch (err) {
    return { success: false, error: `Job status error: ${err instanceof Error ? err.message : String(err)}` };
  }
}

/* ── Assign Job Action ────────────────────────────────── */

async function assignJobAction(
  config: Record<string, unknown>,
  ctx: ActionContext,
  supabase: SupabaseAdmin
): Promise<ActionResult> {
  try {
    const jobId = String(config.job_id || ctx.event.entity_id || "");
    const assigneeId = String(config.assignee_id || "");

    if (!jobId) return { success: false, error: "Missing job_id" };

    await supabase
      .from("jobs")
      .update({ assignee_id: assigneeId || null })
      .eq("id", jobId);

    return { success: true };
  } catch (err) {
    return { success: false, error: `Assign job error: ${err instanceof Error ? err.message : String(err)}` };
  }
}

/* ── Create Task (Subtask) Action ─────────────────────── */

async function createTaskAction(
  config: Record<string, unknown>,
  ctx: ActionContext,
  supabase: SupabaseAdmin
): Promise<ActionResult> {
  try {
    const jobId = String(config.job_id || ctx.event.entity_id || "");
    const title = interpolate(String(config.title || "Auto-created task"), ctx.variables);

    if (!jobId) return { success: false, error: "Missing job_id" };

    await supabase.from("job_subtasks").insert({
      job_id: jobId,
      title,
      completed: false,
    });

    return { success: true };
  } catch (err) {
    return { success: false, error: `Create task error: ${err instanceof Error ? err.message : String(err)}` };
  }
}

/* ── Send Webhook Action ──────────────────────────────── */

async function sendWebhookAction(
  config: Record<string, unknown>,
  ctx: ActionContext
): Promise<ActionResult> {
  try {
    const url = String(config.url || "");
    if (!url) return { success: false, error: "Missing webhook URL" };

    const method = String(config.method || "POST").toUpperCase();
    const headers = (config.headers as Record<string, string>) || {};

    const body = {
      event: ctx.event.type,
      entity_type: ctx.event.entity_type,
      entity_id: ctx.event.entity_id,
      organization_id: ctx.event.organization_id,
      payload: ctx.event.payload,
      flow_name: ctx.flow.name,
      timestamp: ctx.event.timestamp,
    };

    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-iWorkr-Flow": ctx.flow.id,
        ...headers,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Webhook returned ${response.status}: ${await response.text()}`,
      };
    }

    return { success: true, output: { webhook_status: response.status } };
  } catch (err) {
    return { success: false, error: `Webhook error: ${err instanceof Error ? err.message : String(err)}` };
  }
}

/* ── Audit Log Action ─────────────────────────────────── */

async function logAuditAction(
  config: Record<string, unknown>,
  ctx: ActionContext,
  supabase: SupabaseAdmin
): Promise<ActionResult> {
  try {
    await supabase.from("audit_log").insert({
      organization_id: ctx.event.organization_id,
      user_id: ctx.event.user_id || null,
      action: interpolate(String(config.action || ctx.event.type), ctx.variables),
      entity_type: ctx.event.entity_type || null,
      entity_id: ctx.event.entity_id || null,
      new_data: { event: ctx.event.type, flow: ctx.flow.name, ...ctx.event.payload },
    });

    return { success: true };
  } catch (err) {
    return { success: false, error: `Audit log error: ${err instanceof Error ? err.message : String(err)}` };
  }
}

/* ── Update Inventory Action ──────────────────────────── */

async function updateInventoryAction(
  config: Record<string, unknown>,
  ctx: ActionContext,
  supabase: SupabaseAdmin
): Promise<ActionResult> {
  try {
    const itemId = String(config.item_id || ctx.event.entity_id || "");
    const quantityChange = Number(config.quantity_change || 0);

    if (!itemId) return { success: false, error: "Missing item_id" };

    const { data: item } = await supabase
      .from("inventory_items")
      .select("quantity, min_quantity")
      .eq("id", itemId)
      .single();

    if (!item) return { success: false, error: "Item not found" };

    const newQty = (item.quantity || 0) + quantityChange;
    const stockLevel = newQty <= 0 ? "critical" : newQty < (item.min_quantity || 5) ? "low" : "ok";

    await supabase
      .from("inventory_items")
      .update({ quantity: newQty, stock_level: stockLevel })
      .eq("id", itemId);

    return { success: true, output: { new_quantity: newQty, stock_level: stockLevel } };
  } catch (err) {
    return { success: false, error: `Inventory error: ${err instanceof Error ? err.message : String(err)}` };
  }
}

/* ── SMS Action (placeholder) ─────────────────────────── */

async function sendSmsAction(
  config: Record<string, unknown>,
  ctx: ActionContext
): Promise<ActionResult> {
  // SMS integration placeholder — would use Twilio, MessageBird, etc.
  const to = String(config.to || ctx.variables.phone || "");
  const message = interpolate(String(config.message || ""), ctx.variables);

  if (!to) return { success: false, error: "No phone number" };

  // Log that SMS would be sent (no provider configured yet)
  console.log(`[SMS] Would send to ${to}: ${message}`);

  return {
    success: true,
    output: { sms_to: to, sms_status: "simulated" },
  };
}

/* ── Utility: Template Interpolation ──────────────────── */

function interpolate(template: string, variables: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_, key) => {
    const value = getNestedValue(variables, key);
    return value !== undefined ? String(value) : `{{${key}}}`;
  });
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

/* ── Email HTML Builder ───────────────────────────────── */

function buildEmailHtml(subject: string, body: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#050505;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:40px 24px">
<div style="text-align:center;margin-bottom:32px">
<div style="display:inline-block;width:36px;height:36px;background:white;border-radius:8px;line-height:36px;font-weight:700;font-size:16px;color:#050505">iW</div>
</div>
<div style="background:#0a0a0a;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:32px">
<h2 style="color:#fff;margin:0 0 16px;font-size:18px;font-weight:600">${subject}</h2>
<p style="color:rgba(255,255,255,0.6);margin:0;font-size:14px;line-height:1.6">${body.replace(/\n/g, "<br>")}</p>
</div>
<div style="text-align:center;margin-top:24px">
<p style="color:rgba(255,255,255,0.3);font-size:12px;margin:0">Sent automatically by iWorkr</p>
</div>
</div>
</body>
</html>`;
}

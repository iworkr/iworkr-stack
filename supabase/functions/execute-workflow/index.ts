import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function serviceClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

function userClient(authHeader: string) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
}

async function verifyOrgMembership(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  orgId: string,
) {
  const { data: member } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", orgId)
    .eq("user_id", userId)
    .single();
  return member;
}

// ── Action handlers ─────────────────────────────────────────────

async function completeJob(
  svc: ReturnType<typeof createClient>,
  userId: string,
  body: Record<string, unknown>,
) {
  const jobId = body.job_id as string;
  if (!jobId) return jsonResponse({ error: "Missing job_id" }, 400);

  const { data: job, error: jobErr } = await svc
    .from("jobs")
    .select("id, organization_id, status, auto_invoice, customer_id")
    .eq("id", jobId)
    .single();

  if (jobErr || !job) return jsonResponse({ error: "Job not found" }, 404);
  if (job.status === "done") return jsonResponse({ error: "Job already completed" }, 400);

  const { data: sessions } = await svc
    .from("job_timer_sessions")
    .select("started_at, ended_at")
    .eq("job_id", jobId)
    .not("ended_at", "is", null);

  let billableMinutes = 0;
  if (sessions) {
    for (const s of sessions) {
      const start = new Date(s.started_at).getTime();
      const end = new Date(s.ended_at).getTime();
      billableMinutes += (end - start) / 60_000;
    }
  }
  billableMinutes = Math.round(billableMinutes * 100) / 100;

  const now = new Date().toISOString();

  await svc
    .from("jobs")
    .update({ status: "done", completed_at: now, updated_at: now })
    .eq("id", jobId);

  await svc.from("job_activity").insert({
    id: crypto.randomUUID(),
    job_id: jobId,
    user_id: userId,
    action: "completed",
    metadata: { billable_minutes: billableMinutes },
    created_at: now,
  });

  let invoiceId: string | null = null;

  if (job.auto_invoice && job.customer_id) {
    const invoiceRow = {
      id: crypto.randomUUID(),
      organization_id: job.organization_id,
      job_id: jobId,
      customer_id: job.customer_id,
      status: "draft",
      billable_minutes: billableMinutes,
      created_at: now,
      updated_at: now,
    };
    const { data: inv } = await svc
      .from("invoices")
      .insert(invoiceRow)
      .select("id")
      .single();
    invoiceId = inv?.id ?? null;
  }

  return jsonResponse({
    success: true,
    data: { job_id: jobId, billable_minutes: billableMinutes, invoice_id: invoiceId },
  });
}

async function assignJob(
  svc: ReturnType<typeof createClient>,
  userId: string,
  body: Record<string, unknown>,
) {
  const jobId = body.job_id as string;
  const assigneeId = body.assignee_id as string;
  if (!jobId || !assigneeId)
    return jsonResponse({ error: "Missing job_id or assignee_id" }, 400);

  const { data: job, error: jobErr } = await svc
    .from("jobs")
    .select("id, organization_id, status")
    .eq("id", jobId)
    .single();

  if (jobErr || !job) return jsonResponse({ error: "Job not found" }, 404);

  const now = new Date().toISOString();
  const updates: Record<string, unknown> = {
    assignee_id: assigneeId,
    updated_at: now,
  };
  if (job.status === "unassigned") updates.status = "assigned";
  if (body.scheduled_at) updates.scheduled_at = body.scheduled_at;

  await svc.from("jobs").update(updates).eq("id", jobId);

  await svc.from("job_activity").insert({
    id: crypto.randomUUID(),
    job_id: jobId,
    user_id: userId,
    action: "assigned",
    metadata: { assignee_id: assigneeId },
    created_at: now,
  });

  await svc.from("notifications").insert({
    id: crypto.randomUUID(),
    user_id: assigneeId,
    organization_id: job.organization_id,
    type: "job_assigned",
    title: "New job assigned",
    body: `You have been assigned to job ${jobId}`,
    metadata: { job_id: jobId, assigned_by: userId },
    read: false,
    created_at: now,
  });

  return jsonResponse({
    success: true,
    data: { job_id: jobId, assignee_id: assigneeId },
  });
}

async function cancelJob(
  svc: ReturnType<typeof createClient>,
  userId: string,
  body: Record<string, unknown>,
) {
  const jobId = body.job_id as string;
  if (!jobId) return jsonResponse({ error: "Missing job_id" }, 400);

  const { data: job, error: jobErr } = await svc
    .from("jobs")
    .select("id, organization_id, status")
    .eq("id", jobId)
    .single();

  if (jobErr || !job) return jsonResponse({ error: "Job not found" }, 404);
  if (job.status === "cancelled")
    return jsonResponse({ error: "Job already cancelled" }, 400);

  const now = new Date().toISOString();
  const reason = (body.reason as string) ?? null;

  await svc
    .from("jobs")
    .update({ status: "cancelled", updated_at: now })
    .eq("id", jobId);

  await svc.from("job_activity").insert({
    id: crypto.randomUUID(),
    job_id: jobId,
    user_id: userId,
    action: "cancelled",
    metadata: { reason },
    created_at: now,
  });

  return jsonResponse({
    success: true,
    data: { job_id: jobId, reason },
  });
}

async function sendInvoice(
  svc: ReturnType<typeof createClient>,
  _userId: string,
  body: Record<string, unknown>,
) {
  const invoiceId = body.invoice_id as string;
  if (!invoiceId) return jsonResponse({ error: "Missing invoice_id" }, 400);

  const { data: invoice, error: invErr } = await svc
    .from("invoices")
    .select("id, organization_id, status")
    .eq("id", invoiceId)
    .single();

  if (invErr || !invoice)
    return jsonResponse({ error: "Invoice not found" }, 404);

  if (invoice.status !== "draft")
    return jsonResponse({ error: `Invoice is '${invoice.status}', expected 'draft'` }, 400);

  const now = new Date().toISOString();

  await svc
    .from("invoices")
    .update({ status: "sent", issue_date: now, updated_at: now })
    .eq("id", invoiceId);

  return jsonResponse({
    success: true,
    data: { invoice_id: invoiceId, status: "sent", issue_date: now },
  });
}

// ── Router ──────────────────────────────────────────────────────

type ActionHandler = (
  svc: ReturnType<typeof createClient>,
  userId: string,
  body: Record<string, unknown>,
) => Promise<Response>;

const ACTIONS: Record<string, ActionHandler> = {
  COMPLETE_JOB: completeJob,
  ASSIGN_JOB: assignJob,
  CANCEL_JOB: cancelJob,
  SEND_INVOICE: sendInvoice,
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Missing authorization" }, 401);

    const supabase = userClient(authHeader);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

    const body = (await req.json()) as Record<string, unknown>;
    const action = body.action as string;

    const handler = ACTIONS[action];
    if (!handler)
      return jsonResponse({ error: `Unknown action: ${action}` }, 400);

    // Resolve the org that owns the target entity via a lightweight pre-check.
    // Each handler fetches the full entity; here we just need the org_id the
    // caller claims (or we derive it from the entity inside the handler).
    const orgId = body.org_id as string | undefined;

    // If the caller supplies org_id, verify membership up front.
    // Otherwise the handler is responsible for verifying via the entity's org.
    if (orgId) {
      const member = await verifyOrgMembership(supabase, user.id, orgId);
      if (!member)
        return jsonResponse({ error: "Not a member of this organization" }, 403);
    }

    const svc = serviceClient();

    // When org_id wasn't supplied, derive it from the entity and verify.
    if (!orgId) {
      const entityOrgId = await resolveOrgFromBody(svc, action, body);
      if (!entityOrgId) return jsonResponse({ error: "Entity not found" }, 404);

      const member = await verifyOrgMembership(supabase, user.id, entityOrgId);
      if (!member)
        return jsonResponse({ error: "Not a member of this organization" }, 403);
    }

    return await handler(svc, user.id, body);
  } catch (err) {
    console.error("execute-workflow error:", err);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});

async function resolveOrgFromBody(
  svc: ReturnType<typeof createClient>,
  action: string,
  body: Record<string, unknown>,
): Promise<string | null> {
  if (action === "SEND_INVOICE") {
    const { data } = await svc
      .from("invoices")
      .select("organization_id")
      .eq("id", body.invoice_id as string)
      .single();
    return data?.organization_id ?? null;
  }
  // Job-based actions
  const jobId = body.job_id as string;
  if (!jobId) return null;
  const { data } = await svc
    .from("jobs")
    .select("organization_id")
    .eq("id", jobId)
    .single();
  return data?.organization_id ?? null;
}

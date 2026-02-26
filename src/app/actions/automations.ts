"use server";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";
import { Events, dispatch, dispatchAndWait } from "@/lib/automation";
import { z } from "zod";
import { validate, createFlowSchema } from "@/lib/validation";

/* ── Schemas ──────────────────────────────────────── */

const UpdateFlowSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  category: z.enum(["marketing", "billing", "operations"]).optional(),
  status: z.string().max(50).optional(),
  trigger_config: z.record(z.string(), z.unknown()).optional(),
  blocks: z.array(z.object({
    id: z.string(),
    type: z.enum(["trigger", "delay", "action", "condition"]),
    label: z.string(),
    config: z.record(z.string(), z.unknown()),
  })).optional(),
});

/* ── Types ─────────────────────────────────────────── */

export interface AutomationStats {
  total_runs_24h: number;
  success_rate: number;
  active_flows: number;
  paused_flows: number;
  hourly: Array<{ hour: string; runs: number; successes: number; failures: number }>;
}

/* ── Get all flows for an org ─────────────────────────── */

export async function getAutomationFlows(orgId: string) {
  try {
    const supabase = await createServerSupabaseClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { data: membership } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", orgId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership) return { data: null, error: "Unauthorized" };

    const { data, error } = await supabase
      .from("automation_flows")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/* ── Get a single flow ────────────────────────────────── */

export async function getAutomationFlow(flowId: string) {
  try {
    const supabase = await createServerSupabaseClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { data, error } = await supabase
      .from("automation_flows")
      .select("*")
      .eq("id", flowId)
      .single();

    if (error) return { data: null, error: error.message };

    const { data: membership } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", data.organization_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership) return { data: null, error: "Unauthorized" };

    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/* ── Create a new flow ────────────────────────────────── */

export async function createAutomationFlow(params: {
  organization_id: string;
  name: string;
  description?: string;
  category?: string;
  trigger_config?: Record<string, unknown>;
  blocks?: any[];
}) {
  try {
    // Validate input
    const validated = validate(createFlowSchema, params);
    if (validated.error) return { data: null, error: validated.error };

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { data: membership } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", params.organization_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership) return { data: null, error: "Unauthorized" };

    const { data, error } = await supabase
      .from("automation_flows")
      .insert({
        organization_id: params.organization_id,
        name: params.name,
        description: params.description || null,
        category: params.category || "operations",
        status: "draft",
        trigger_config: params.trigger_config || {},
        blocks: params.blocks || [],
        created_by: user?.id,
      })
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    revalidatePath("/dashboard/automations");
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/* ── Update a flow ────────────────────────────────────── */

export async function updateAutomationFlow(
  flowId: string,
  updates: {
    name?: string;
    description?: string;
    category?: string;
    status?: string;
    trigger_config?: Record<string, unknown>;
    blocks?: any[];
  }
) {
  try {
    // Validate input
    const validated = validate(UpdateFlowSchema, updates);
    if (validated.error) return { data: null, error: validated.error };

    const supabase = await createServerSupabaseClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { data: flow } = await supabase
      .from("automation_flows")
      .select("organization_id")
      .eq("id", flowId)
      .maybeSingle();
    if (!flow) return { data: null, error: "Flow not found" };

    const { data: membership } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", flow.organization_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership) return { data: null, error: "Unauthorized" };

    const { data, error } = await supabase
      .from("automation_flows")
      .update(updates)
      .eq("id", flowId)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    revalidatePath("/dashboard/automations");
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/* ── Toggle flow status ───────────────────────────────── */

export async function toggleFlowStatus(flowId: string) {
  try {
    const supabase = await createServerSupabaseClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { data: flow, error: fetchError } = await supabase
      .from("automation_flows")
      .select("status, organization_id")
      .eq("id", flowId)
      .single();

    if (fetchError) return { data: null, error: fetchError.message };

    const { data: membership } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", flow.organization_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership) return { data: null, error: "Unauthorized" };

    const newStatus = flow.status === "active" ? "paused" : "active";

    const { data, error } = await supabase
      .from("automation_flows")
      .update({ status: newStatus })
      .eq("id", flowId)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    revalidatePath("/dashboard/automations");
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/* ── Delete (archive) a flow ──────────────────────────── */

export async function archiveAutomationFlow(flowId: string) {
  try {
    const supabase = await createServerSupabaseClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { data: flow } = await supabase
      .from("automation_flows")
      .select("organization_id")
      .eq("id", flowId)
      .maybeSingle();
    if (!flow) return { data: null, error: "Flow not found" };

    const { data: membership } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", flow.organization_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership) return { data: null, error: "Unauthorized" };

    const { data, error } = await supabase
      .from("automation_flows")
      .update({ status: "archived" })
      .eq("id", flowId)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    revalidatePath("/dashboard/automations");
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/* ── Duplicate a flow ─────────────────────────────────── */

export async function duplicateAutomationFlow(flowId: string) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { data: original, error: fetchError } = await supabase
      .from("automation_flows")
      .select("*")
      .eq("id", flowId)
      .single();

    if (fetchError) return { data: null, error: fetchError.message };

    const { data: membership } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", original.organization_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership) return { data: null, error: "Unauthorized" };

    const { data, error } = await supabase
      .from("automation_flows")
      .insert({
        organization_id: original.organization_id,
        name: `${original.name} (Copy)`,
        description: original.description,
        category: original.category,
        status: "draft",
        trigger_config: original.trigger_config,
        blocks: original.blocks,
        created_by: user?.id,
      })
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    revalidatePath("/dashboard/automations");
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/* ── Master pause/resume all flows ────────────────────── */

export async function setAllFlowsStatus(orgId: string, pause: boolean) {
  try {
    const supabase = await createServerSupabaseClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { data: membership } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", orgId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership) return { data: null, error: "Unauthorized" };

    const targetStatus = pause ? "paused" : "active";

    const { error } = await supabase
      .from("automation_flows")
      .update({ status: targetStatus })
      .eq("organization_id", orgId)
      .in("status", pause ? ["active"] : ["paused"]);

    if (error) return { data: null, error: error.message };
    revalidatePath("/dashboard/automations");
    return { data: { success: true }, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/* ── Get execution logs ───────────────────────────────── */

export async function getAutomationLogs(orgId: string, limit = 50) {
  try {
    const supabase = await createServerSupabaseClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { data: membership } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", orgId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership) return { data: null, error: "Unauthorized" };

    const { data, error } = await supabase
      .from("automation_logs")
      .select(
        `
        *,
        automation_flows:flow_id (name, category)
      `
      )
      .eq("organization_id", orgId)
      .order("started_at", { ascending: false })
      .limit(limit);

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/* ── Get automation stats (sparkline) ─────────────────── */

export async function getAutomationStats(
  orgId: string,
  flowId?: string
): Promise<{ data: AutomationStats | null; error: string | null }> {
  try {
    const supabase = await createServerSupabaseClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { data: membership } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", orgId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership) return { data: null, error: "Unauthorized" };

    const { data, error } = await supabase.rpc("get_automation_stats", {
      p_org_id: orgId,
      p_flow_id: flowId || null,
    });

    if (error) {
      logger.error("getAutomationStats RPC error", error.message);
      return { data: null, error: error.message };
    }

    return { data, error: null };
  } catch (err: any) {
    logger.error("getAutomationStats exception", err.message);
    return { data: null, error: err.message };
  }
}

/* ── RPC-backed toggle flow status ────────────────────── */

export async function toggleFlowStatusRpc(flowId: string) {
  try {
    const supabase = await createServerSupabaseClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { data: flow } = await supabase
      .from("automation_flows")
      .select("organization_id")
      .eq("id", flowId)
      .maybeSingle();
    if (!flow) return { data: null, error: "Flow not found" };

    const { data: membership } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", flow.organization_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership) return { data: null, error: "Unauthorized" };

    const { data, error } = await supabase.rpc("toggle_flow_status", {
      p_flow_id: flowId,
    });

    if (error) {
      logger.error("toggleFlowStatusRpc error", error.message);
      return { data: null, error: error.message };
    }
    if (data?.error) return { data: null, error: data.error };

    revalidatePath("/dashboard/automations");
    return { data, error: null };
  } catch (err: any) {
    logger.error("toggleFlowStatusRpc exception", err.message);
    return { data: null, error: err.message };
  }
}

/* ── RPC-backed master pause/resume ───────────────────── */

export async function setAllFlowsStatusRpc(orgId: string, pause: boolean) {
  try {
    const supabase = await createServerSupabaseClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { data: membership } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", orgId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership) return { data: null, error: "Unauthorized" };

    const { data, error } = await supabase.rpc("set_all_flows_status", {
      p_org_id: orgId,
      p_pause: pause,
    });

    if (error) {
      logger.error("setAllFlowsStatusRpc error", error.message);
      return { data: null, error: error.message };
    }
    if (data?.error) return { data: null, error: data.error };

    revalidatePath("/dashboard/automations");
    return { data, error: null };
  } catch (err: any) {
    logger.error("setAllFlowsStatusRpc exception", err.message);
    return { data: null, error: err.message };
  }
}

/* ── Test a flow (manual trigger — legacy) ────────────── */

export async function testAutomationFlow(flowId: string) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { data: flow, error: fetchError } = await supabase
      .from("automation_flows")
      .select("*")
      .eq("id", flowId)
      .single();

    if (fetchError) return { data: null, error: fetchError.message };

    const { data: membership } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", flow.organization_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership) return { data: null, error: "Unauthorized" };

    // Create a test event based on the flow's trigger
    const eventType = flow.trigger_config?.event || "system.webhook_received";

    const testEvent = {
      id: `test_${Date.now()}`,
      type: eventType,
      category: eventType.split(".")[0] as any,
      organization_id: flow.organization_id,
      user_id: user?.id,
      entity_type: "test",
      entity_id: flowId,
      payload: {
        test: true,
        flow_id: flowId,
        new_status: flow.trigger_config?.condition?.split("=")?.[1] || "done",
        old_status: "in_progress",
        title: "Test Job",
        client_email: user?.email,
        name: "Test Client",
      },
      timestamp: new Date().toISOString(),
    };

    const result = await dispatchAndWait(testEvent);

    revalidatePath("/dashboard/automations");
    return {
      data: {
        ...result,
        test: true,
      },
      error: result.errors.length > 0 ? result.errors.join("; ") : null,
    };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/* ══════════════════════════════════════════════════════════
   Project Automata — New Actions
   ══════════════════════════════════════════════════════════ */

/* ── Publish Flow (bumps version, sets live) ──────────── */

export async function publishAutomationFlow(flowId: string) {
  try {
    const supabase = await createServerSupabaseClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { data: flow } = await supabase
      .from("automation_flows")
      .select("organization_id")
      .eq("id", flowId)
      .maybeSingle();
    if (!flow) return { data: null, error: "Flow not found" };

    const { data: membership } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", flow.organization_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership) return { data: null, error: "Unauthorized" };

    const { data, error } = await supabase.rpc("publish_automation_flow", {
      p_flow_id: flowId,
    });

    if (error) {
      logger.error("publishAutomationFlow RPC error", error.message);
      return { data: null, error: error.message };
    }
    if (data?.error) return { data: null, error: data.error };

    revalidatePath("/dashboard/automations");
    return { data, error: null };
  } catch (err: any) {
    logger.error("publishAutomationFlow exception", err.message);
    return { data: null, error: err.message };
  }
}

/* ── Update flow conditions (JSON Logic AST) ──────────── */

export async function updateFlowConditions(
  flowId: string,
  conditions: Record<string, unknown> | null
) {
  try {
    const supabase = await createServerSupabaseClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { data: flow } = await supabase
      .from("automation_flows")
      .select("organization_id")
      .eq("id", flowId)
      .maybeSingle();
    if (!flow) return { data: null, error: "Flow not found" };

    const { data: membership } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", flow.organization_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership) return { data: null, error: "Unauthorized" };

    const { data, error } = await supabase
      .from("automation_flows")
      .update({ conditions })
      .eq("id", flowId)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/* ── Dry Run Test (via automation-worker Edge Function) ── */

export async function dryRunAutomationFlow(flowId: string) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    // Fetch the flow to get trigger config
    const { data: flow, error: fetchErr } = await supabase
      .from("automation_flows")
      .select("*")
      .eq("id", flowId)
      .single();

    if (fetchErr) return { data: null, error: fetchErr.message };

    const { data: membership } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", flow.organization_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership) return { data: null, error: "Unauthorized" };

    // Build a realistic mock payload based on the trigger
    const triggerEvent = flow.trigger_config?.event || "system.webhook_received";
    const entityType = flow.trigger_config?.entity || triggerEvent.split(".")[0];

    // Attempt to fetch a recent real record for realistic test data
    let mockPayload: Record<string, unknown> = {
      event_type: triggerEvent,
      entity_type: entityType,
      test: true,
      timestamp: new Date().toISOString(),
      user_id: user?.id,
      user_email: user?.email,
    };

    if (entityType === "job") {
      const { data: recentJob } = await supabase
        .from("jobs")
        .select("id, title, status, priority, client_id, assignee_id, organization_id, display_id, clients(name, email, phone)")
        .eq("organization_id", flow.organization_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (recentJob) {
        mockPayload = {
          ...mockPayload,
          entity_id: recentJob.id,
          new_record: recentJob,
          old_record: { ...recentJob, status: "in_progress" },
          client_name: (recentJob as any).clients?.name,
          client_email: (recentJob as any).clients?.email,
          client_phone: (recentJob as any).clients?.phone,
          job_title: recentJob.title,
          job_status: recentJob.status,
        };
      }
    } else if (entityType === "invoice") {
      const { data: recentInvoice } = await supabase
        .from("invoices")
        .select("id, invoice_number, total, status, client_id, organization_id, clients(name, email)")
        .eq("organization_id", flow.organization_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (recentInvoice) {
        mockPayload = {
          ...mockPayload,
          entity_id: recentInvoice.id,
          new_record: recentInvoice,
          invoice_number: recentInvoice.invoice_number,
          invoice_total: recentInvoice.total,
          client_name: (recentInvoice as any).clients?.name,
          client_email: (recentInvoice as any).clients?.email,
        };
      }
    }

    // Call the automation-worker with X-Dry-Run header
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return { data: null, error: "Supabase not configured" };
    }

    const workerUrl = `${supabaseUrl}/functions/v1/automation-worker`;
    const res = await fetch(workerUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        "X-Dry-Run": "true",
      },
      body: JSON.stringify({
        flow_id: flowId,
        mock_payload: mockPayload,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return { data: null, error: `Worker error: ${errText}` };
    }

    const result = await res.json();
    return { data: result, error: null };
  } catch (err: any) {
    logger.error("dryRunAutomationFlow exception", err.message);
    return { data: null, error: err.message };
  }
}

/* ── Get execution runs (idempotency ledger) ──────────── */

export async function getAutomationRuns(orgId: string, flowId?: string, limit = 50) {
  try {
    const supabase = await createServerSupabaseClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { data: membership } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", orgId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership) return { data: null, error: "Unauthorized" };

    let query = supabase
      .from("automation_runs")
      .select("*, automation_flows:automation_id (name, category)")
      .eq("workspace_id", orgId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (flowId) {
      query = query.eq("automation_id", flowId);
    }

    const { data, error } = await query;
    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/* ── Get a single run with full trace ─────────────────── */

export async function getAutomationRunTrace(runId: string) {
  try {
    const supabase = await createServerSupabaseClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { data, error } = await supabase
      .from("automation_runs")
      .select("*, automation_flows:automation_id (name, blocks, conditions)")
      .eq("id", runId)
      .single();

    if (error) return { data: null, error: error.message };

    const { data: membership } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", data.workspace_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership) return { data: null, error: "Unauthorized" };

    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

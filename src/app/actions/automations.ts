"use server";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";
import { Events, dispatch, dispatchAndWait } from "@/lib/automation";

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
    const supabase = (await createServerSupabaseClient()) as any;

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
    const supabase = (await createServerSupabaseClient()) as any;

    const { data, error } = await supabase
      .from("automation_flows")
      .select("*")
      .eq("id", flowId)
      .single();

    if (error) return { data: null, error: error.message };
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
    const supabase = (await createServerSupabaseClient()) as any;
    const {
      data: { user },
    } = await supabase.auth.getUser();

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
    const supabase = (await createServerSupabaseClient()) as any;

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
    const supabase = (await createServerSupabaseClient()) as any;

    const { data: flow, error: fetchError } = await supabase
      .from("automation_flows")
      .select("status")
      .eq("id", flowId)
      .single();

    if (fetchError) return { data: null, error: fetchError.message };

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
    const supabase = (await createServerSupabaseClient()) as any;

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
    const supabase = (await createServerSupabaseClient()) as any;
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: original, error: fetchError } = await supabase
      .from("automation_flows")
      .select("*")
      .eq("id", flowId)
      .single();

    if (fetchError) return { data: null, error: fetchError.message };

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
    const supabase = (await createServerSupabaseClient()) as any;

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
    const supabase = (await createServerSupabaseClient()) as any;

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
    const supabase = (await createServerSupabaseClient()) as any;

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
    const supabase = (await createServerSupabaseClient()) as any;

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
    const supabase = (await createServerSupabaseClient()) as any;

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

/* ── Test a flow (manual trigger) ─────────────────────── */

export async function testAutomationFlow(flowId: string) {
  try {
    const supabase = (await createServerSupabaseClient()) as any;
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: flow, error: fetchError } = await supabase
      .from("automation_flows")
      .select("*")
      .eq("id", flowId)
      .single();

    if (fetchError) return { data: null, error: fetchError.message };

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

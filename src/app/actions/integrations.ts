"use server";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";
import { z } from "zod";

/* ── Schemas ──────────────────────────────────────── */

const CreateIntegrationSchema = z.object({
  organization_id: z.string().uuid(),
  provider: z.string().min(1, "Provider is required").max(100),
  config: z.record(z.string(), z.unknown()).optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
});

const UpdateIntegrationSettingsSchema = z.record(z.string(), z.unknown());

/* ── Types ─────────────────────────────────────────── */

export interface IntegrationsOverview {
  total_integrations: number;
  connected: number;
  error_count: number;
  disconnected: number;
  last_sync: string | null;
}

/* ── Read ──────────────────────────────────────────── */

export async function getIntegrations(orgId: string) {
  try {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase
      .from("integrations")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: true });

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function getIntegrationsOverview(
  orgId: string
): Promise<{ data: IntegrationsOverview | null; error: string | null }> {
  try {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase.rpc("get_integrations_overview", {
      p_org_id: orgId,
    });

    if (error) {
      logger.error("getIntegrationsOverview RPC error", error.message);
      return { data: null, error: error.message };
    }

    return { data, error: null };
  } catch (err: any) {
    logger.error("getIntegrationsOverview exception", err.message);
    return { data: null, error: err.message };
  }
}

/* ── Connect / Disconnect ──────────────────────────── */

export async function connectIntegration(
  integrationId: string,
  connectionId?: string
) {
  try {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase.rpc("toggle_integration_status", {
      p_integration_id: integrationId,
      p_connect: true,
      p_connection_id: connectionId || null,
    });

    if (error) {
      logger.error("connectIntegration RPC error", error.message);
      return { data: null, error: error.message };
    }
    if (data?.error) return { data: null, error: data.error };

    revalidatePath("/dashboard/integrations");
    return { data, error: null };
  } catch (err: any) {
    logger.error("connectIntegration exception", err.message);
    return { data: null, error: err.message };
  }
}

export async function disconnectIntegration(integrationId: string) {
  try {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase.rpc("toggle_integration_status", {
      p_integration_id: integrationId,
      p_connect: false,
    });

    if (error) {
      logger.error("disconnectIntegration RPC error", error.message);
      return { data: null, error: error.message };
    }
    if (data?.error) return { data: null, error: data.error };

    revalidatePath("/dashboard/integrations");
    return { data, error: null };
  } catch (err: any) {
    logger.error("disconnectIntegration exception", err.message);
    return { data: null, error: err.message };
  }
}

/* ── Settings ──────────────────────────────────────── */

export async function updateIntegrationSettings(
  integrationId: string,
  settings: any
) {
  try {
    // Validate input
    const parsed = UpdateIntegrationSettingsSchema.safeParse(settings);
    if (!parsed.success) {
      return { data: null, error: parsed.error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join("; ") };
    }

    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase.rpc("update_integration_settings", {
      p_integration_id: integrationId,
      p_settings: settings,
    });

    if (error) {
      logger.error("updateIntegrationSettings RPC error", error.message);
      return { data: null, error: error.message };
    }
    if (data?.error) return { data: null, error: data.error };

    revalidatePath("/dashboard/integrations");
    return { data, error: null };
  } catch (err: any) {
    logger.error("updateIntegrationSettings exception", err.message);
    return { data: null, error: err.message };
  }
}

/* ── Create integration record ─────────────────────── */

export async function createIntegration(params: {
  organization_id: string;
  provider: string;
  config?: any;
  settings?: any;
}) {
  try {
    // Validate input
    const parsed = CreateIntegrationSchema.safeParse(params);
    if (!parsed.success) {
      return { data: null, error: parsed.error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join("; ") };
    }

    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase
      .from("integrations")
      .insert({
        ...params,
        status: "disconnected",
      })
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    revalidatePath("/dashboard/integrations");
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/* ── Sync Now ──────────────────────────────────────── */

export async function syncIntegration(integrationId: string) {
  try {
    const supabase = await createServerSupabaseClient();

    // Mark as syncing
    await supabase
      .from("integrations")
      .update({ status: "syncing" })
      .eq("id", integrationId);

    // In a real implementation, this would trigger an Edge Function
    // For now, mark as connected with updated sync time
    const { error } = await supabase
      .from("integrations")
      .update({
        status: "connected",
        last_sync: new Date().toISOString(),
      })
      .eq("id", integrationId);

    if (error) return { data: null, error: error.message };
    revalidatePath("/dashboard/integrations");
    return { data: { success: true }, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

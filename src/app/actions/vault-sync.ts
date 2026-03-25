/**
 * @module Vault-Sync Server Actions
 * @status COMPLETE
 * @description Project Vault-Sync: Server actions for monitoring the offline-first
 *   mobile sync engine. Fetch sync health metrics, device logs, and failed syncs.
 * @lastAudit 2026-03-24
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

/* ── Types ────────────────────────────────────────────── */

export interface SyncHealth {
  total_syncs_24h: number;
  unique_devices_24h: number;
  total_mutations_24h: number;
  failed_mutations_24h: number;
  last_sync: string | null;
}

export interface SyncDeviceLog {
  id: string;
  device_id: string;
  user_id: string;
  mutation_count: number;
  success_count: number;
  failed_count: number;
  sync_duration_ms: number | null;
  error_summary: string | null;
  synced_at: string;
  user_name?: string;
}

/* ── Helpers ──────────────────────────────────────────── */

async function getSupabase() {
  return (await createServerSupabaseClient()) as any;
}

/* ── Sync Health ──────────────────────────────────────── */

export async function fetchSyncHealth(orgId: string): Promise<SyncHealth> {
  try {
    const supabase = await getSupabase();
    const { data, error } = await supabase.rpc("get_sync_health", {
      p_organization_id: orgId,
    });

    if (error) {
      console.error("[vault-sync] fetchSyncHealth:", error);
      return {
        total_syncs_24h: 0,
        unique_devices_24h: 0,
        total_mutations_24h: 0,
        failed_mutations_24h: 0,
        last_sync: null,
      };
    }

    return data as SyncHealth;
  } catch {
    return {
      total_syncs_24h: 0,
      unique_devices_24h: 0,
      total_mutations_24h: 0,
      failed_mutations_24h: 0,
      last_sync: null,
    };
  }
}

/* ── Device Logs ──────────────────────────────────────── */

export async function fetchSyncLogs(
  orgId: string,
  options?: { limit?: number; offset?: number },
): Promise<{ data: SyncDeviceLog[]; total: number }> {
  try {
    const supabase = await getSupabase();

    // Get org member user IDs
    const { data: members } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", orgId)
      .eq("status", "active");

    if (!members || members.length === 0) return { data: [], total: 0 };

    const userIds = members.map((m: any) => m.user_id);
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    const { data, error, count } = await supabase
      .from("sync_device_logs")
      .select("*, profiles(full_name)", { count: "exact" })
      .in("user_id", userIds)
      .order("synced_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("[vault-sync] fetchSyncLogs:", error);
      return { data: [], total: 0 };
    }

    const logs = (data || []).map((row: any) => ({
      ...row,
      user_name: row.profiles?.full_name || null,
    }));

    return { data: logs, total: count || 0 };
  } catch {
    return { data: [], total: 0 };
  }
}

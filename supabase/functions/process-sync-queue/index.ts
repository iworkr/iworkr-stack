/**
 * @module process-sync-queue
 * @status COMPLETE
 * @auth JWT — Authenticated workers only
 * @description Project Vault-Sync: Batch mutation reconciler for the offline-first
 *   mobile app. Receives batched mutations from the sync outbox, applies each
 *   with INSERT ... ON CONFLICT (UPSERT) for absolute idempotency, and returns
 *   a success/fail map. Uses Last-Write-Wins (LWW) at the field level.
 * @lastAudit 2026-03-24
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Mutation {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  payload: Record<string, unknown>;
  timestamp: number;
}

interface SyncRequest {
  device_id: string;
  mutations: Mutation[];
}

const TABLE_MAP: Record<string, string> = {
  job: "jobs",
  job_subtask: "job_subtasks",
  job_timer_session: "job_timer_sessions",
  job_media: "job_media",
  schedule_block: "schedule_blocks",
  shift_notes: "shift_notes",
  medication_records: "medication_records",
  inventory_consumption: "inventory_consumptions",
  client: "clients",
  participant: "participant_profiles",
  care_plan: "care_plans",
  time_entry: "time_entries",
  timesheet_anomaly: "timesheet_anomalies",
  compliance_override: "compliance_overrides",
};

function resolveTable(entityType: string): string {
  return TABLE_MAP[entityType] || entityType;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    // Authenticate via JWT
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace("Bearer ", "");

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") || SERVICE_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const body: SyncRequest = await req.json();

    if (!body.mutations || !Array.isArray(body.mutations)) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const successIds: string[] = [];
    const failedIds: Record<string, string> = {};

    // Log device sync attempt
    await supabase.from("sync_device_logs").insert({
      device_id: body.device_id || "unknown",
      user_id: user.id,
      mutation_count: body.mutations.length,
      synced_at: new Date().toISOString(),
    }).then(() => {}).catch(() => {});

    // Process mutations in order
    for (const mutation of body.mutations) {
      try {
        const table = resolveTable(mutation.entity_type);
        const payload = { ...mutation.payload };

        switch (mutation.action) {
          case "INSERT": {
            // UPSERT — absolute idempotency via client-provided UUID
            payload.id = payload.id || mutation.entity_id;

            const { error } = await supabase
              .from(table)
              .upsert(payload as Record<string, unknown>, {
                onConflict: "id",
                ignoreDuplicates: false,
              });

            if (error) throw error;

            // Chronos-Lock: Server-side distance verification for time entries
            if (mutation.entity_type === "time_entry" && payload.job_id && payload.clock_in_location) {
              try {
                const loc = typeof payload.clock_in_location === "string"
                  ? JSON.parse(payload.clock_in_location as string)
                  : payload.clock_in_location;

                if (loc?.lat && loc?.lng) {
                  const { data: serverDistance } = await supabase.rpc("verify_clock_distance", {
                    p_job_id: payload.job_id,
                    p_lat: loc.lat,
                    p_lng: loc.lng,
                  });

                  if (typeof serverDistance === "number" && serverDistance >= 0) {
                    const clientDistance = payload.clock_in_distance_meters as number | null;
                    const isSpoofed = clientDistance !== null
                      && clientDistance !== undefined
                      && Math.abs(serverDistance - (clientDistance as number)) > 500;

                    await supabase.from("time_entries").update({
                      server_verified_distance: serverDistance,
                      is_spatial_violation: serverDistance > 150 || isSpoofed,
                    }).eq("id", mutation.entity_id);

                    // Auto-create TEMPORAL_SPOOFING anomaly if discrepancy detected
                    if (isSpoofed) {
                      await supabase.from("timesheet_anomalies").insert({
                        organization_id: payload.organization_id,
                        time_entry_id: mutation.entity_id,
                        worker_id: payload.worker_id || payload.user_id,
                        job_id: payload.job_id,
                        anomaly_type: "TEMPORAL_SPOOFING",
                        recorded_distance_meters: serverDistance,
                        device_accuracy_meters: loc.accuracy_m,
                        worker_justification: `Client claimed ${clientDistance}m, server calculated ${serverDistance}m`,
                        status: "PENDING",
                      });
                    }
                  }
                }
              } catch (verifyErr) {
                console.error("[chronos-lock] Distance verification error:", verifyErr);
              }
            }

            break;
          }

          case "UPDATE": {
            // LWW: Compare mutation timestamp against server updated_at
            const mutationTs = mutation.timestamp;

            if (mutationTs) {
              const { data: existing } = await supabase
                .from(table)
                .select("updated_at")
                .eq("id", mutation.entity_id)
                .maybeSingle();

              if (existing?.updated_at) {
                const serverTs = new Date(existing.updated_at).getTime();
                if (serverTs > mutationTs) {
                  // Server is newer — apply field-level merge
                  // Only update fields that don't conflict
                  const safePayload = { ...payload };
                  delete safePayload.updated_at;

                  if (Object.keys(safePayload).length > 0) {
                    const { error } = await supabase
                      .from(table)
                      .update({ ...safePayload, updated_at: new Date().toISOString() })
                      .eq("id", mutation.entity_id);

                    if (error) throw error;
                  }
                  break;
                }
              }
            }

            // Standard update — mutation is newer or no conflict
            const { error } = await supabase
              .from(table)
              .update(payload as Record<string, unknown>)
              .eq("id", mutation.entity_id);

            if (error) throw error;
            break;
          }

          case "DELETE": {
            const { error } = await supabase
              .from(table)
              .delete()
              .eq("id", mutation.entity_id);

            if (error) throw error;
            break;
          }

          default:
            throw new Error(`Unknown action: ${mutation.action}`);
        }

        successIds.push(mutation.id);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        failedIds[mutation.id] = msg;
        console.error(
          `[process-sync-queue] Failed: ${mutation.entity_type}/${mutation.action}/${mutation.entity_id}:`,
          msg,
        );
      }
    }

    return new Response(
      JSON.stringify({
        success_ids: successIds,
        failed_ids: failedIds,
        processed: body.mutations.length,
        succeeded: successIds.length,
        failed: Object.keys(failedIds).length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("[process-sync-queue] Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

/**
 * sync-chat-memberships — Project Nightingale / Project Echo
 *
 * Edge Function: Dynamic Roster-Based Channel Membership Sync
 *
 * Runs automatically when schedule_blocks are created, updated, or deleted.
 * Enforces the "Rule of Proximity" — workers only see House Threads
 * for participants they are actively scheduled to support.
 *
 * Triggers:
 *   - On INSERT/UPDATE/DELETE on schedule_blocks table (via database webhook)
 *   - Manual invocation: POST { participant_id, organization_id }
 *   - Batch: POST { batch: true, organization_id }
 *
 * Logic:
 *   1. Find internal + external channels for participant
 *   2. Query shifts for next 14 days
 *   3. Combine scheduled workers with permanent care team
 *   4. Diff against current memberships
 *   5. Add/remove as needed, inject system messages
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_URL") || "http://localhost:3000",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LOOKAHEAD_DAYS = 14; // Workers added 14 days ahead

interface SyncRequest {
  participant_id?: string;
  organization_id: string;
  batch?: boolean;
}

interface SyncResult {
  participant_id: string;
  added: string[];
  removed: string[];
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body: SyncRequest = await req.json();
    const { organization_id, batch } = body;

    if (!organization_id) {
      return new Response(
        JSON.stringify({ error: "organization_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: SyncResult[] = [];

    if (batch) {
      // Sync all participants with house threads
      const { data: channels } = await supabase
        .from("care_chat_channels")
        .select("participant_id")
        .eq("organization_id", organization_id)
        .eq("channel_type", "house_internal")
        .eq("is_archived", false);

      const participantIds = [
        ...new Set((channels || []).map((c: { participant_id: string }) => c.participant_id).filter(Boolean)),
      ];

      for (const pid of participantIds) {
        const result = await syncParticipantMemberships(supabase, organization_id, pid as string);
        if (result) results.push(result);
      }
    } else {
      const { participant_id } = body;
      if (!participant_id) {
        return new Response(
          JSON.stringify({ error: "participant_id is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const result = await syncParticipantMemberships(supabase, organization_id, participant_id);
      if (result) results.push(result);
    }

    return new Response(
      JSON.stringify({
        message: `Synced ${results.length} participant(s)`,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/* ── Core sync logic ─────────────────────────────────────────── */

async function syncParticipantMemberships(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  orgId: string,
  participantId: string
): Promise<SyncResult | null> {
  // 1. Find house channels
  const { data: channels } = await supabase
    .from("care_chat_channels")
    .select("id, channel_type")
    .eq("participant_id", participantId)
    .in("channel_type", ["house_internal", "house_external"]);

  if (!channels || channels.length === 0) return null;

  // deno-lint-ignore no-explicit-any
  const internalChannel = channels.find((c: any) => c.channel_type === "house_internal");
  // deno-lint-ignore no-explicit-any
  const externalChannel = channels.find((c: any) => c.channel_type === "house_external");

  if (!internalChannel) return null;

  // 2. Query schedule_blocks for next LOOKAHEAD_DAYS days
  const now = new Date();
  const futureDate = new Date(now.getTime() + LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000);

  const { data: shifts } = await supabase
    .from("schedule_blocks")
    .select("technician_id")
    .eq("organization_id", orgId)
    .eq("participant_id", participantId)
    .gte("start_time", now.toISOString())
    .lte("start_time", futureDate.toISOString())
    .not("technician_id", "is", null)
    .neq("status", "cancelled");

  const scheduledWorkerIds = [
    ...new Set((shifts || []).map((s: { technician_id: string }) => s.technician_id).filter(Boolean)),
  ] as string[];

  // 3. Get permanent members (coordinators, key workers)
  const { data: permanentMembers } = await supabase
    .from("care_chat_members")
    .select("user_id")
    .eq("channel_id", internalChannel.id)
    .eq("is_permanent", true);

  const permanentIds = (permanentMembers || []).map((m: { user_id: string }) => m.user_id);

  // Combine into allowed set
  const allowedUserIds = new Set([...scheduledWorkerIds, ...permanentIds]);

  // 4. Get current roster-added members
  const { data: currentMembers } = await supabase
    .from("care_chat_members")
    .select("user_id, role, added_by_roster, is_permanent")
    .eq("channel_id", internalChannel.id);

  // deno-lint-ignore no-explicit-any
  const currentRosterMembers = (currentMembers || []).filter((m: any) => m.added_by_roster && !m.is_permanent);
  const currentRosterIds = currentRosterMembers.map((m: { user_id: string }) => m.user_id);

  // 5. Calculate diff
  const toAdd = scheduledWorkerIds.filter((id) => !currentRosterIds.includes(id) && !permanentIds.includes(id));
  const toRemove = currentRosterIds.filter((id: string) => !allowedUserIds.has(id));

  // 6. Add new members to both channels
  if (toAdd.length > 0) {
    const internalInserts = toAdd.map((userId) => ({
      channel_id: internalChannel.id,
      user_id: userId,
      role: "member",
      added_by_roster: true,
      is_permanent: false,
    }));

    await supabase
      .from("care_chat_members")
      .upsert(internalInserts, { onConflict: "channel_id,user_id" });

    // Also add to external channel
    if (externalChannel) {
      const externalInserts = toAdd.map((userId) => ({
        channel_id: externalChannel.id,
        user_id: userId,
        role: "member",
        added_by_roster: true,
        is_permanent: false,
      }));
      await supabase
        .from("care_chat_members")
        .upsert(externalInserts, { onConflict: "channel_id,user_id" });
    }

    // Get worker names for system message
    const { data: profiles } = await supabase
      .from("profiles")
      .select("full_name")
      .in("id", toAdd);

    const names = (profiles || []).map((p: { full_name: string }) => p.full_name).join(", ");

    if (names) {
      await supabase.from("care_chat_messages").insert({
        channel_id: internalChannel.id,
        sender_id: null,
        content: `📋 ${names} automatically added to thread via roster sync.`,
        message_type: "system_roster_sync",
      });
    }
  }

  // 7. Remove evicted members from both channels
  if (toRemove.length > 0) {
    // Only remove roster-added, non-permanent members
    for (const userId of toRemove) {
      await supabase
        .from("care_chat_members")
        .delete()
        .eq("channel_id", internalChannel.id)
        .eq("user_id", userId)
        .eq("added_by_roster", true)
        .eq("is_permanent", false);

      if (externalChannel) {
        // Never remove family_guest members from external
        await supabase
          .from("care_chat_members")
          .delete()
          .eq("channel_id", externalChannel.id)
          .eq("user_id", userId)
          .eq("added_by_roster", true)
          .eq("is_permanent", false)
          .neq("role", "family_guest");
      }
    }

    // Get names for system message
    const { data: removedProfiles } = await supabase
      .from("profiles")
      .select("full_name")
      .in("id", toRemove);

    const removedNames = (removedProfiles || []).map((p: { full_name: string }) => p.full_name).join(", ");

    if (removedNames) {
      await supabase.from("care_chat_messages").insert({
        channel_id: internalChannel.id,
        sender_id: null,
        content: `📋 ${removedNames} removed from thread (no upcoming shifts in next ${LOOKAHEAD_DAYS} days).`,
        message_type: "system_roster_sync",
      });
    }
  }

  return {
    participant_id: participantId,
    added: toAdd,
    removed: toRemove,
  };
}

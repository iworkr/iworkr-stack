/**
 * provision-house-threads — Project Nightingale / Project Echo
 *
 * Edge Function: Automatically provisions internal + external House Thread
 * channels when a new participant_profile is created via the Intake Wizard.
 *
 * Triggered:
 *   - On INSERT to participant_profiles (via database webhook)
 *   - Manual invocation for batch provisioning of existing participants
 *
 * POST body: { participant_id, organization_id, participant_name }
 *            OR { batch: true, organization_id } to provision all missing
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ProvisionRequest {
  participant_id?: string;
  organization_id: string;
  participant_name?: string;
  batch?: boolean;
}

interface ProvisionResult {
  participant_id: string;
  internal_channel_id: string;
  external_channel_id: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body: ProvisionRequest = await req.json();
    const { organization_id, batch } = body;

    if (!organization_id) {
      return new Response(
        JSON.stringify({ error: "organization_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: ProvisionResult[] = [];

    if (batch) {
      // ── Batch mode: provision all participants missing house threads ──
      const { data: participants } = await supabase
        .from("participant_profiles")
        .select("id, client_id")
        .eq("organization_id", organization_id);

      if (!participants || participants.length === 0) {
        return new Response(
          JSON.stringify({ message: "No participants found", results: [] }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      for (const p of participants) {
        // Check if already provisioned
        const { data: existing } = await supabase
          .from("care_chat_channels")
          .select("id")
          .eq("participant_id", p.id)
          .eq("channel_type", "house_internal")
          .maybeSingle();

        if (existing) continue; // Skip already provisioned

        // Get participant name from clients table
        const { data: client } = await supabase
          .from("clients")
          .select("name")
          .eq("id", p.client_id)
          .maybeSingle();

        const name = client?.name || "Unknown Participant";
        const result = await provisionThreads(supabase, organization_id, p.id, name);
        if (result) results.push(result);
      }
    } else {
      // ── Single participant mode ──
      const { participant_id, participant_name } = body;

      if (!participant_id) {
        return new Response(
          JSON.stringify({ error: "participant_id is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if already provisioned
      const { data: existing } = await supabase
        .from("care_chat_channels")
        .select("id")
        .eq("participant_id", participant_id)
        .eq("channel_type", "house_internal")
        .maybeSingle();

      if (existing) {
        return new Response(
          JSON.stringify({
            message: "House threads already exist for this participant",
            results: [],
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let name = participant_name;
      if (!name) {
        // Look up from participant_profiles -> clients
        const { data: profile } = await supabase
          .from("participant_profiles")
          .select("client_id")
          .eq("id", participant_id)
          .maybeSingle();

        if (profile?.client_id) {
          const { data: client } = await supabase
            .from("clients")
            .select("name")
            .eq("id", profile.client_id)
            .maybeSingle();
          name = client?.name || "Participant";
        } else {
          name = "Participant";
        }
      }

      const result = await provisionThreads(supabase, organization_id, participant_id, name);
      if (result) results.push(result);
    }

    return new Response(
      JSON.stringify({
        message: `Provisioned ${results.length} participant hub(s)`,
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

/* ── Core provisioning logic ─────────────────────────────────── */

async function provisionThreads(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  orgId: string,
  participantId: string,
  participantName: string
): Promise<ProvisionResult | null> {
  const groupName = `${participantName} — Care Hub`;

  // Create Internal Channel
  const { data: internal, error: err1 } = await supabase
    .from("care_chat_channels")
    .insert({
      organization_id: orgId,
      participant_id: participantId,
      channel_type: "house_internal",
      name: `${participantName} — Internal Care`,
      parent_group_name: groupName,
    })
    .select("id")
    .single();

  if (err1) {
    console.error(`Failed to create internal channel for ${participantId}:`, err1);
    return null;
  }

  // Create External Channel
  const { data: external, error: err2 } = await supabase
    .from("care_chat_channels")
    .insert({
      organization_id: orgId,
      participant_id: participantId,
      channel_type: "house_external",
      name: `${participantName} — Family & Participant`,
      parent_group_name: groupName,
    })
    .select("id")
    .single();

  if (err2) {
    console.error(`Failed to create external channel for ${participantId}:`, err2);
    return null;
  }

  // Inject welcome system messages
  await supabase.from("care_chat_messages").insert([
    {
      channel_id: internal.id,
      sender_id: null,
      content: `🔒 Internal care thread created for ${participantName}. Only authorised care staff can see this thread. Shift handovers and clinical notes will appear here.`,
      message_type: "system_roster_sync",
    },
    {
      channel_id: external.id,
      sender_id: null,
      content: `👋 Welcome to ${participantName}'s care communication hub. Family members and the care team can communicate here safely.`,
      message_type: "system_roster_sync",
    },
  ]);

  return {
    participant_id: participantId,
    internal_channel_id: internal.id,
    external_channel_id: external.id,
  };
}

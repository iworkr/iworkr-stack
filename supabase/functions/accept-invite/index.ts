import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_URL") || "http://localhost:3000",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token } = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ error: "Invite token is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the authenticated user
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service_role to look up and modify invite
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find the pending invite
    const { data: invite, error: inviteError } = await adminClient
      .from("organization_invites")
      .select("*, organizations(id, name, slug)")
      .eq("token", token)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .single();

    if (inviteError || !invite) {
      return new Response(
        JSON.stringify({ error: "Invite not found, expired, or already used" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Add user to org
    const { error: memberError } = await adminClient
      .from("organization_members")
      .insert({
        organization_id: invite.organization_id,
        user_id: user.id,
        role: invite.role,
        status: "active",
        invited_by: invite.invited_by,
      });

    if (memberError) {
      if (memberError.code === "23505") {
        return new Response(
          JSON.stringify({ error: "You are already a member of this organization" }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw memberError;
    }

    // Mark invite as accepted
    await adminClient
      .from("organization_invites")
      .update({ status: "accepted" })
      .eq("id", invite.id);

    // Mark onboarding as completed
    await adminClient
      .from("profiles")
      .update({ onboarding_completed: true })
      .eq("id", user.id);

    // Log to audit
    await adminClient.from("audit_log").insert({
      organization_id: invite.organization_id,
      user_id: user.id,
      action: "member.joined",
      entity_type: "organization_member",
      entity_id: user.id,
      new_data: { role: invite.role, via: "invite" },
    });

    const org = invite.organizations as { id: string; name: string; slug: string };

    return new Response(
      JSON.stringify({
        success: true,
        organization_id: invite.organization_id,
        organization_name: org?.name,
        organization_slug: org?.slug,
        role: invite.role,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

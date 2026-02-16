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
    const { organization_id, email, role } = await req.json();

    if (!organization_id || !email) {
      return new Response(
        JSON.stringify({ error: "organization_id and email are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create authenticated client to verify the caller
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

    // Verify caller is admin+ in the org
    const { data: member } = await supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", organization_id)
      .eq("user_id", user.id)
      .single();

    if (!member || !["owner", "admin", "manager"].includes(member.role)) {
      return new Response(
        JSON.stringify({ error: "Insufficient permissions" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service_role to bypass RLS for inserts
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check if already a member
    const { data: existingMember } = await adminClient
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", organization_id)
      .eq("user_id", (
        await adminClient.from("profiles").select("id").eq("email", email).single()
      ).data?.id || "00000000-0000-0000-0000-000000000000")
      .single();

    if (existingMember) {
      return new Response(
        JSON.stringify({ error: "User is already a member of this organization" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Upsert invite (handles re-invites for same email)
    const { data: invite, error: inviteError } = await adminClient
      .from("organization_invites")
      .upsert(
        {
          organization_id,
          email,
          role: role || "technician",
          status: "pending",
          invited_by: user.id,
          token: crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, ""),
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        },
        { onConflict: "organization_id,email" }
      )
      .select()
      .single();

    if (inviteError) {
      return new Response(
        JSON.stringify({ error: inviteError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log to audit
    await adminClient.from("audit_log").insert({
      organization_id,
      user_id: user.id,
      action: "member.invited",
      entity_type: "organization_invite",
      entity_id: invite.id,
      new_data: { email, role: role || "technician" },
    });

    // TODO: Send email via Resend when RESEND_API_KEY is configured
    // const resendApiKey = Deno.env.get("RESEND_API_KEY");
    // if (resendApiKey) { ... }

    return new Response(
      JSON.stringify({
        success: true,
        invite_id: invite.id,
        expires_at: invite.expires_at,
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

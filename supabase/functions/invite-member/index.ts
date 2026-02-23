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

    // Send invite email via Resend
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const appUrl = Deno.env.get("APP_URL") || "http://localhost:3000";

    if (resendApiKey) {
      const { data: org } = await adminClient
        .from("organizations")
        .select("name")
        .eq("id", organization_id)
        .single();

      const { data: inviter } = await adminClient
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();

      const orgName = org?.name || "your team";
      const inviterName = inviter?.full_name || "A team member";
      const acceptUrl = `${appUrl}/accept-invite?token=${invite.token}`;

      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: Deno.env.get("RESEND_FROM_EMAIL") || "iWorkr <noreply@iworkrapp.com>",
            to: [email],
            subject: `${inviterName} invited you to join ${orgName} on iWorkr`,
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
                <h2 style="color: #111; font-size: 20px; margin-bottom: 8px;">You're invited</h2>
                <p style="color: #555; font-size: 15px; line-height: 1.6;">
                  ${inviterName} has invited you to join <strong>${orgName}</strong> on iWorkr as a <strong>${role || "technician"}</strong>.
                </p>
                <a href="${acceptUrl}" style="display: inline-block; margin-top: 24px; padding: 12px 28px; background: #10B981; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
                  Accept Invitation
                </a>
                <p style="color: #999; font-size: 12px; margin-top: 32px;">
                  This invitation expires in 7 days. If you didn't expect this email, you can safely ignore it.
                </p>
              </div>
            `,
          }),
        });
      } catch {
        // Email send failure is non-fatal — invite is still created
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        invite_id: invite.id,
        expires_at: invite.expires_at,
        email_sent: !!resendApiKey,
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

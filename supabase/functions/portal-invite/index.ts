import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface InvitePayload {
  workspace_id: string;
  email: string;
  full_name: string;
  phone?: string;
  entity_type?: string;
  entity_id?: string;
  grant_type?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const payload: InvitePayload = await req.json();
    const { workspace_id, email, full_name, phone, entity_type, entity_id, grant_type } = payload;

    if (!workspace_id || !email || !full_name) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: workspace_id, email, full_name" }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // Verify caller is admin of the workspace
    const { data: membership } = await supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", workspace_id)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    if (!membership || !["owner", "admin", "manager"].includes(membership.role)) {
      return new Response(
        JSON.stringify({ error: "Not authorised to manage this workspace's portal" }),
        { status: 403, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // Get workspace info for the invite email
    const { data: org } = await admin
      .from("organizations")
      .select("name, slug, portal_app_name, portal_logo_url, logo_url")
      .eq("id", workspace_id)
      .single();

    const orgName = org?.portal_app_name || org?.name || "iWorkr";
    const orgLogo = org?.portal_logo_url || org?.logo_url;

    // Create the portal invite via RPC
    const { data: inviteResult, error: inviteError } = await supabase.rpc("create_portal_invite", {
      p_workspace_id: workspace_id,
      p_email: email,
      p_full_name: full_name,
      p_phone: phone || null,
      p_entity_type: entity_type || "client",
      p_entity_id: entity_id || null,
      p_grant_type: grant_type || "TRADES_CUSTOMER",
    });

    if (inviteError) {
      return new Response(
        JSON.stringify({ error: inviteError.message }),
        { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    if (!inviteResult?.ok) {
      return new Response(
        JSON.stringify({ error: inviteResult?.error || "Failed to create invite" }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const magicToken = inviteResult.magic_token;
    const portalBaseUrl = Deno.env.get("PORTAL_BASE_URL") || "https://iworkrapp.com";
    const magicLink = `${portalBaseUrl}/portal/magic/${magicToken}`;

    // Send invite email via Resend
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (resendApiKey) {
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: `${orgName} <noreply@iworkrapp.com>`,
            to: [email],
            subject: `You've been invited to the ${orgName} Client Portal`,
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 40px 20px;">
                ${orgLogo ? `<img src="${orgLogo}" alt="${orgName}" style="height: 40px; margin-bottom: 24px;" />` : ""}
                <h2 style="color: #1a1a1a; font-size: 20px; margin-bottom: 8px;">Welcome to the ${orgName} Portal</h2>
                <p style="color: #666; font-size: 14px; line-height: 1.6;">
                  Hi ${full_name},<br><br>
                  You've been invited to access the ${orgName} client portal where you can view your quotes, invoices, and service history.
                </p>
                <a href="${magicLink}" style="display: inline-block; background-color: #10B981; color: #000; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; margin: 24px 0;">
                  Access Your Portal
                </a>
                <p style="color: #999; font-size: 12px; margin-top: 24px;">
                  This link expires in 7 days. If you didn't expect this invitation, you can safely ignore this email.
                </p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
                <p style="color: #bbb; font-size: 10px;">Powered by iWorkr · Secure Client Portal</p>
              </div>
            `,
          }),
        });
      } catch (emailErr) {
        console.error("[portal-invite] Email send failed:", emailErr);
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        magic_link: magicLink,
        portal_user_id: inviteResult.portal_user_id,
        grant_id: inviteResult.grant_id,
      }),
      { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[portal-invite] Error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
});

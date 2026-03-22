/**
 * @module update-member-role
 * @status COMPLETE
 * @auth SECURED — Validates JWT and checks owner/admin role
 * @description Updates a team member's role in organization_members and syncs to auth.users.raw_app_meta_data for JWT claims
 * @dependencies Supabase
 * @lastAudit 2026-03-22
 */
// ============================================================
// update-member-role — Aegis Role Change + Force JWT Refresh
// When an owner/admin changes a member's role, this function:
// 1. Updates organization_members.role
// 2. Syncs the new role into auth.users.raw_app_meta_data
// 3. The next token refresh picks up the new claims
// ============================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  Deno.env.get("APP_URL") || "https://iworkrapp.com",
  "http://localhost:3000",
];

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(req) });
  }

  try {
    const { target_user_id, organization_id, new_role } = await req.json();

    if (!target_user_id || !organization_id || !new_role) {
      return new Response(
        JSON.stringify({ error: "Missing target_user_id, organization_id, or new_role" }),
        { status: 400, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    // Validate role
    const validRoles = ['owner', 'admin', 'manager', 'office_admin', 'senior_tech', 'technician', 'apprentice', 'subcontractor'];
    if (!validRoles.includes(new_role)) {
      return new Response(
        JSON.stringify({ error: `Invalid role: ${new_role}` }),
        { status: 400, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Verify the caller is an admin/owner of this org
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !caller) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    // Check caller's role in this org
    const { data: callerMembership } = await supabase
      .from("organization_members")
      .select("role")
      .eq("user_id", caller.id)
      .eq("organization_id", organization_id)
      .eq("status", "active")
      .maybeSingle();

    if (!callerMembership || !['owner', 'admin'].includes(callerMembership.role)) {
      return new Response(
        JSON.stringify({ error: "Only owners and admins can change roles" }),
        { status: 403, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    // Prevent non-owners from creating owners
    if (new_role === 'owner' && callerMembership.role !== 'owner') {
      return new Response(
        JSON.stringify({ error: "Only owners can promote to owner" }),
        { status: 403, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    // 2. Update the role in organization_members
    const { error: updateError } = await supabase
      .from("organization_members")
      .update({ role: new_role })
      .eq("user_id", target_user_id)
      .eq("organization_id", organization_id);

    if (updateError) {
      return new Response(
        JSON.stringify({ error: "Failed to update role", detail: updateError.message }),
        { status: 500, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    // 3. Force JWT refresh by updating the user's app_metadata
    // This triggers the custom_access_token_hook on next token refresh
    const { error: metaError } = await supabase.auth.admin.updateUserById(
      target_user_id,
      {
        app_metadata: {
          role: new_role,
          org_id: organization_id,
          force_refresh: Date.now(),
        },
      },
    );

    if (metaError) {
      console.error("Failed to update user metadata:", metaError);
      // Non-fatal — the role is already updated in the DB
      // The auth hook will pick it up on next natural token refresh
    }

    // 4. Create an audit notification
    await supabase.from("notifications").insert({
      organization_id,
      user_id: target_user_id,
      type: "system",
      title: "Role Changed",
      body: `Your role has been updated to ${new_role.replace('_', ' ')}.`,
      sender_id: caller.id,
      priority: "high",
      action_url: "/settings/profile",
    });

    return new Response(
      JSON.stringify({
        success: true,
        target_user_id,
        new_role,
        jwt_refreshed: !metaError,
      }),
      { status: 200, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
    );
  }
});

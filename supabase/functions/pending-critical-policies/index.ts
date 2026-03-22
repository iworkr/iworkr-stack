/**
 * @module pending-critical-policies
 * @status COMPLETE
 * @auth SECURED — Authorization header + auth.getUser() verified
 * @description Returns pending critical policies that a user must acknowledge via RPC
 * @dependencies Supabase (RPC: pending_critical_policies_for_user)
 * @lastAudit 2026-03-22
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const client = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } },
    );

    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data, error } = await client.rpc("pending_critical_policies_for_user", {
      p_user_id: user.id,
    });
    if (error) throw new Error(error.message);

    return new Response(
      JSON.stringify({
        has_pending_critical: (data || []).length > 0,
        policies: data || [],
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});


/**
 * @module convoy-daily-health-check
 * @status COMPLETE
 * @auth SECURED — Auth guard via supabase.auth.getUser()
 * @description Daily fleet compliance check: grounds vehicles with expired compliance documents via Postgres RPC, sends push notifications
 * @dependencies Supabase (Auth, DB, RPCs, Edge Functions)
 * @lastAudit 2026-03-22
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── Aegis Auth Gate ──────────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing authorization" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } }
  );
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await admin.rpc("convoy_ground_expired_vehicles");
    if (error) throw new Error(error.message);
    const groundedTotal = Number(data || 0);

    if (groundedTotal > 0) {
      await admin.functions.invoke("send-push", {
        body: {
          record: {
            title: "Convoy compliance grounding executed",
            body: `${groundedTotal} fleet vehicle(s) moved out of service for expired compliance documents.`,
            type: "fleet_compliance",
          },
        },
      });
    }

    return new Response(JSON.stringify({ success: true, grounded_total: groundedTotal }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

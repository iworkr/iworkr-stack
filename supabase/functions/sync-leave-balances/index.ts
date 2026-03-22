/**
 * @module sync-leave-balances
 * @status COMPLETE
 * @auth UNSECURED — No auth guard; uses service-role key internally
 * @description Upserts leave balance cache (annual/sick hours) for a worker, with optional Xero/QBO OAuth pull planned
 * @dependencies Supabase
 * @lastAudit 2026-03-22
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { organization_id, worker_id, annual_leave_hours, sick_leave_hours } = await req.json();
    if (!organization_id || !worker_id) {
      return new Response(JSON.stringify({ error: "organization_id and worker_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // NOTE: Xero/QBO OAuth pull can replace this payload later.
    const resolvedAnnual = typeof annual_leave_hours === "number" ? annual_leave_hours : 0;
    const resolvedSick = typeof sick_leave_hours === "number" ? sick_leave_hours : 0;

    const { data, error } = await supabase
      .from("leave_balances_cache")
      .upsert({
        organization_id,
        worker_id,
        annual_leave_hours: resolvedAnnual,
        sick_leave_hours: resolvedSick,
        external_source: "xero",
        external_payload: {
          mode: "edge_function_sync",
          synced_at: new Date().toISOString(),
        },
        last_synced_at: new Date().toISOString(),
      }, { onConflict: "worker_id" })
      .select("*")
      .single();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, balance: data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});


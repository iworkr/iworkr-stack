/**
 * @module submit-leave-request
 * @status COMPLETE
 * @auth SECURED — Hyperion-Vanguard S-03 Aegis Auth Gate
 * @description Submits a leave request for a worker with date range, type, and optional medical certificate
 * @dependencies Supabase
 * @lastAudit 2026-03-22
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // ── Hyperion-Vanguard S-03: Aegis Auth Gate ──────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Missing authorization" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const supabaseAuth = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user: authUser }, error: authError } = await supabaseAuth.auth.getUser();
  if (authError || !authUser) {
    return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const {
      organization_id,
      worker_id,
      leave_type,
      start_date,
      end_date,
      reason,
      is_full_day = true,
      source = "mobile",
      medical_cert_url = null,
    } = await req.json();

    if (!organization_id || !worker_id || !leave_type || !start_date || !end_date) {
      return new Response(JSON.stringify({ error: "organization_id, worker_id, leave_type, start_date, end_date are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const start = new Date(start_date);
    const end = new Date(end_date);
    const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1);
    const isEmergency = source === "emergency_sick";

    const { data, error } = await supabase
      .from("leave_requests")
      .insert({
        organization_id,
        worker_id,
        user_id: worker_id,
        leave_type,
        start_date,
        end_date,
        start_at: new Date(`${start_date}T00:00:00.000Z`).toISOString(),
        end_at: new Date(`${end_date}T23:59:59.999Z`).toISOString(),
        is_full_day,
        days,
        reason: reason ?? null,
        medical_cert_url,
        source,
        emergency_reported: isEmergency,
        status: isEmergency ? "approved" : "pending",
        approved_by: isEmergency ? worker_id : null,
        approved_at: isEmergency ? new Date().toISOString() : null,
      })
      .select("*")
      .single();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, leave_request: data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});


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

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const body = await req.json();
    const defectId = String(body.defect_id || "");
    if (!defectId) {
      return new Response(JSON.stringify({ error: "defect_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: defect, error: defectErr } = await admin
      .from("vehicle_defects")
      .select("id, organization_id, vehicle_id, booking_id, severity, description")
      .eq("id", defectId)
      .single();
    if (defectErr || !defect) throw new Error(defectErr?.message || "Defect not found");

    if (defect.severity === "critical_grounded" || defect.severity === "major") {
      await admin
        .from("fleet_vehicles")
        .update({ status: "out_of_service_defect", updated_at: new Date().toISOString() })
        .eq("id", defect.vehicle_id);

      await admin
        .from("vehicle_bookings")
        .update({ status: "cancelled", metadata: { triage_queue: "drop_and_cover", reason: "convoy_defect" } })
        .eq("vehicle_id", defect.vehicle_id)
        .in("status", ["scheduled"])
        .gt("booked_start", new Date().toISOString());
    }

    await admin.functions.invoke("send-push", {
      body: {
        record: {
          title: "Urgent fleet escalation",
          body: `Vehicle defect escalated: ${defect.description}`,
          type: "fleet_defect",
        },
      },
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

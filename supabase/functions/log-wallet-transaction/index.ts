import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_URL") || "http://localhost:3000",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } },
    );
    const { data: userCtx } = await authClient.auth.getUser();
    if (!userCtx.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    const walletId = body.wallet_id as string | undefined;
    const shiftId = body.shift_id as string | undefined;
    const entryType = body.entry_type as string | undefined;
    const amount = Number(body.amount ?? 0);
    const category = (body.category as string | undefined) || null;
    const description = (body.description as string | undefined) || null;
    const receiptImageUrl = (body.receipt_image_url as string | undefined) || null;
    const noReceiptJustification = (body.no_receipt_justification as string | undefined) || null;
    const linkedIncidentId = (body.linked_incident_id as string | undefined) || null;

    if (!walletId || !shiftId || !entryType || !Number.isFinite(amount)) {
      return new Response(JSON.stringify({ error: "wallet_id, shift_id, entry_type and amount are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data, error } = await admin.rpc("log_wallet_transaction", {
      p_wallet_id: walletId,
      p_shift_id: shiftId,
      p_entry_type: entryType,
      p_amount: amount,
      p_category: category,
      p_description: description,
      p_receipt_image_url: receiptImageUrl,
      p_no_receipt_justification: noReceiptJustification,
      p_linked_incident_id: linkedIncidentId,
      p_worker_id: userCtx.user.id,
    });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, result: data }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});


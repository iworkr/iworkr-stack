/**
 * @module trust-engine
 * @status COMPLETE
 * @auth UNSECURED — No auth guard; uses service-role key internally
 * @description Upserts network identity hashes for clients and recalculates the iWorkr Trust Grade via PG function
 * @dependencies Supabase
 * @lastAudit 2026-03-22
 */
// trust-engine Edge Function
// Upserts a network identity hash when a new client is added to any workspace.
// Recalculates the iWorkr Trust Grade using the calculate_trust_grade() PG function.
// Called by: invoice payment webhooks, manual client creation triggers.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function sha256Hex(text: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(text.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json();
    const { action, clientId, email, phone, address } = body;

    if (!email && !phone && !address) {
      return new Response(JSON.stringify({ error: "At least one identifier required" }), {
        status: 400, headers: corsHeaders,
      });
    }

    // Build hashes
    const emailHash = email ? await sha256Hex(email) : null;
    const phoneHash = phone ? await sha256Hex(phone.replace(/\D/g, "")) : null;
    const addressHash = address ? await sha256Hex(address) : null;

    // Look up existing identity (try email first, then phone)
    let existingIdentity = null;
    if (emailHash) {
      const { data } = await supabase
        .from("network_identities")
        .select("*")
        .eq("email_hash", emailHash)
        .maybeSingle();
      existingIdentity = data;
    }
    if (!existingIdentity && phoneHash) {
      const { data } = await supabase
        .from("network_identities")
        .select("*")
        .eq("phone_hash", phoneHash)
        .maybeSingle();
      existingIdentity = data;
    }

    if (action === "lookup") {
      // Just return the existing identity for UI badge rendering
      return new Response(JSON.stringify({ identity: existingIdentity }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "upsert" || action === "update_score") {
      let identityId: string;

      if (existingIdentity) {
        // Update workspace count and timestamps
        const { data: updated } = await supabase
          .from("network_identities")
          .update({
            workspace_count: existingIdentity.workspace_count + (action === "upsert" ? 1 : 0),
            last_updated_at: new Date().toISOString(),
            ...(body.invoicesPaid !== undefined ? {
              total_invoices_issued: (existingIdentity.total_invoices_issued || 0) + (body.invoicesIssued || 0),
              total_invoices_paid: (existingIdentity.total_invoices_paid || 0) + (body.invoicesPaid || 0),
              total_invoices_overdue: Math.max(0, (existingIdentity.total_invoices_overdue || 0) + (body.invoicesOverdueDelta || 0)),
              total_chargebacks_filed: (existingIdentity.total_chargebacks_filed || 0) + (body.chargebacks || 0),
              total_collections: (existingIdentity.total_collections || 0) + (body.collections || 0),
              total_outstanding_aud: Math.max(0, (existingIdentity.total_outstanding_aud || 0) + (body.outstandingDelta || 0)),
            } : {}),
          })
          .eq("id", existingIdentity.id)
          .select()
          .single();
        identityId = existingIdentity.id;

        // Recalculate trust grade
        const identity = updated || existingIdentity;
        const { data: gradeResult } = await supabase.rpc("calculate_trust_grade", {
          p_invoices_issued: identity.total_invoices_issued,
          p_invoices_paid: identity.total_invoices_paid,
          p_invoices_overdue: identity.total_invoices_overdue,
          p_chargebacks: identity.total_chargebacks_filed,
          p_days_overdue_avg: identity.total_days_overdue_avg,
          p_total_collections: identity.total_collections,
          p_outstanding: identity.total_outstanding_aud,
        });

        if (gradeResult?.[0]) {
          await supabase
            .from("network_identities")
            .update({
              trust_grade: gradeResult[0].grade,
              trust_score: gradeResult[0].score,
            })
            .eq("id", identityId);
        }
      } else {
        // Create new identity record
        const { data: newIdentity } = await supabase
          .from("network_identities")
          .insert({
            email_hash: emailHash,
            phone_hash: phoneHash,
            address_hash: addressHash,
            workspace_count: 1,
          })
          .select()
          .single();
        identityId = newIdentity?.id;
      }

      // Link to client record if clientId provided
      if (clientId && identityId) {
        await supabase
          .from("clients")
          .update({ network_identity_id: identityId })
          .eq("id", clientId);
      }

      const { data: finalIdentity } = await supabase
        .from("network_identities")
        .select("*")
        .eq("id", identityId)
        .single();

      return new Response(JSON.stringify({ ok: true, identity: finalIdentity }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: corsHeaders,
    });
  } catch (error) {
    console.error("[trust-engine]", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: corsHeaders,
    });
  }
});

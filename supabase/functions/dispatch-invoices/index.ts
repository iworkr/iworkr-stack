/**
 * @module dispatch-invoices
 * @status COMPLETE
 * @auth SECURED — Auth guard via supabase.auth.getUser() + owner/admin role check
 * @description Dispatches NDIS invoices: plan_managed (email PDF), self_managed (Stripe payment link + email), ndia_managed (PRODA queue). Idempotent.
 * @dependencies Resend (email), Stripe (payment links), Supabase (Auth, DB)
 * @lastAudit 2026-03-22
 */
// dispatch-invoices Edge Function
// Handles single and bulk invoice dispatch:
//   - plan_managed: email PDF to plan manager via Resend
//   - self_managed: generate Stripe payment link, email to participant
//   - ndia_managed: queue for PRODA export (status update only)
//
// Idempotent: marks dispatch_attempted_at before sending, checks status first.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@3";
import { MockResend, isTestEnv } from "../_shared/mockClients.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const resend = isTestEnv ? MockResend : new Resend(Deno.env.get("RESEND_API_KEY")!);

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const body = await req.json();
    // invoiceIds: string[] — supports single or bulk
    const { invoiceIds, orgId } = body as { invoiceIds: string[]; orgId: string };

    if (!invoiceIds?.length || !orgId) {
      return new Response(JSON.stringify({ error: "invoiceIds and orgId required" }), { status: 400, headers: corsHeaders });
    }

    // Verify caller is owner/admin
    const { data: member } = await supabase.from("organization_members").select("role")
      .eq("organization_id", orgId).eq("user_id", user.id).eq("status", "active").maybeSingle();
    if (!member || !["owner", "admin"].includes(member.role)) {
      return new Response(JSON.stringify({ error: "Insufficient permissions" }), { status: 403, headers: corsHeaders });
    }

    // Get org for ABN, sender email etc.
    const { data: org } = await supabase.from("organizations").select("id, name, settings").eq("id", orgId).single();
    const orgSettings = (org?.settings as Record<string, unknown>) ?? {};
    const senderEmail = (orgSettings.reply_email as string) || Deno.env.get("ADMIN_EMAIL") || "invoices@iworkrapp.com";
    const orgAbn = (orgSettings.abn as string) || "";
    const orgNdisReg = (orgSettings.ndis_registration_number as string) || "";
    const appUrl = Deno.env.get("APP_URL") || "https://www.iworkrapp.com";

    const results: Array<{ invoiceId: string; status: string; error?: string }> = [];

    for (const invoiceId of invoiceIds) {
      try {
        // Fetch invoice with line items + participant profile
        const { data: invoice } = await supabase
          .from("invoices")
          .select(`
            *,
            invoice_line_items(*),
            clients!invoices_participant_id_fkey(id, first_name, last_name, email),
            participant_profiles!inner(ndis_number, management_type, plan_manager_id, full_name)
          `)
          .eq("id", invoiceId)
          .eq("organization_id", orgId)
          .single();

        if (!invoice) { results.push({ invoiceId, status: "error", error: "Invoice not found" }); continue; }
        if (invoice.status !== "draft") { results.push({ invoiceId, status: "skipped", error: "Invoice not in draft status" }); continue; }

        // Mark as dispatch_attempted_at (prevents double dispatch on retry)
        await supabase.from("invoices").update({ dispatch_attempted_at: new Date().toISOString() }).eq("id", invoiceId);

        const fundingType = invoice.funding_type || "plan_managed";
        const participant = invoice.clients as any;
        const profile = (invoice.participant_profiles as any)?.[0] || invoice.participant_profiles as any;
        const participantName = profile?.full_name || [participant?.first_name, participant?.last_name].filter(Boolean).join(" ") || invoice.client_name;
        const ndisNumber = profile?.ndis_number || invoice.ndis_participant_number || "NDIS-XXXX-XXXX-XXXX";

        if (fundingType === "ndia_managed") {
          // Just queue for PRODA export
          await supabase.from("invoices").update({
            status: "sent",
            proda_export_status: "queued",
            updated_at: new Date().toISOString(),
          }).eq("id", invoiceId);
          results.push({ invoiceId, status: "queued_proda" });
          continue;
        }

        // Build line items HTML for the email
        const lineItems = (invoice.invoice_line_items as any[]) || [];
        const lineItemsHtml = lineItems.map((li: any) => `
          <tr>
            <td style="padding:8px 12px;font-family:monospace;font-size:11px;color:#666;border-bottom:1px solid #eee">${li.shift_date || ""}</td>
            <td style="padding:8px 12px;font-family:monospace;font-size:11px;color:#333;border-bottom:1px solid #eee">${li.ndis_support_item_number || li.description || ""}</td>
            <td style="padding:8px 12px;font-family:monospace;font-size:11px;color:#333;border-bottom:1px solid #eee">${li.description || ""}</td>
            <td style="padding:8px 12px;font-family:monospace;font-size:11px;text-align:right;border-bottom:1px solid #eee">${Number(li.hours || li.quantity || 0).toFixed(2)}h</td>
            <td style="padding:8px 12px;font-family:monospace;font-size:11px;text-align:right;border-bottom:1px solid #eee">$${Number(li.rate || li.unit_price || 0).toFixed(4)}/h</td>
            <td style="padding:8px 12px;font-family:monospace;font-size:11px;text-align:right;font-weight:bold;border-bottom:1px solid #eee">$${Number(li.line_total || (li.quantity * li.unit_price) || 0).toFixed(2)}</td>
          </tr>`).join("");

        const totalAUD = Number(invoice.total || 0).toFixed(2);

        // For self-managed: generate Stripe payment link
        let stripePayLink = "";
        if (fundingType === "self_managed" && invoice.total > 0) {
          const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
          if (stripeKey) {
            try {
              // Get connected account
              const { data: orgFull } = await supabase.from("organizations").select("stripe_account_id, settings").eq("id", orgId).single();
              const orgS = (orgFull?.settings as any) ?? {};
              const stripeAccountId = orgFull?.stripe_account_id || orgS.stripe_account_id;

              const stripeRes = await fetch("https://api.stripe.com/v1/payment_links", {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${stripeKey}`,
                  "Content-Type": "application/x-www-form-urlencoded",
                  ...(stripeAccountId ? { "Stripe-Account": stripeAccountId } : {}),
                },
                body: new URLSearchParams({
                  "line_items[0][price_data][currency]": "aud",
                  "line_items[0][price_data][product_data][name]": `Invoice ${invoice.display_id} — ${participantName}`,
                  "line_items[0][price_data][unit_amount]": String(Math.round(invoice.total * 100)),
                  "line_items[0][quantity]": "1",
                  "metadata[invoice_id]": invoiceId,
                  "metadata[organization_id]": orgId,
                }).toString(),
              });
              const stripeData = await stripeRes.json();
              stripePayLink = stripeData.url || "";
            } catch { /* non-fatal */ }
          }
        }

        // Build recipient email
        const recipientEmail = fundingType === "plan_managed"
          ? (invoice.plan_manager_email || "invoices@planmanager.com.au")
          : (participant?.email || invoice.client_email || "");

        if (!recipientEmail) {
          await supabase.from("invoices").update({ dispatch_error: "No recipient email found" }).eq("id", invoiceId);
          results.push({ invoiceId, status: "error", error: "No recipient email" });
          continue;
        }

        const subject = fundingType === "plan_managed"
          ? `NDIS Invoice ${invoice.display_id} — ${participantName} — ${org?.name}`
          : `Invoice ${invoice.display_id} from ${org?.name}`;

        const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body{font-family:Arial,sans-serif;background:#f9f9f9;color:#333;margin:0;padding:20px}
  .card{background:#fff;border-radius:8px;padding:32px;max-width:700px;margin:0 auto;box-shadow:0 2px 8px rgba(0,0,0,0.08)}
  h2{color:#111;font-size:20px;margin:0 0 4px}
  .meta{font-size:13px;color:#666;margin:0 0 24px}
  table{width:100%;border-collapse:collapse;margin:16px 0}
  th{background:#f5f5f5;padding:8px 12px;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#999;text-align:left}
  .total-row td{padding:12px;font-weight:bold;border-top:2px solid #eee;font-size:15px}
  .info-block{background:#f9f9f9;border-radius:6px;padding:12px 16px;font-size:12px;color:#555;margin:16px 0}
  .pay-btn{display:inline-block;background:#10B981;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:14px;margin-top:16px}
  .footer{font-size:11px;color:#aaa;margin-top:24px;border-top:1px solid #eee;padding-top:16px}
</style></head>
<body>
<div class="card">
  <h2>${subject}</h2>
  <p class="meta">Invoice Date: ${invoice.issue_date || new Date().toISOString().slice(0,10)} &nbsp;|&nbsp; Due: ${invoice.due_date || ""}</p>

  <div class="info-block">
    <strong>Provider:</strong> ${org?.name} &nbsp;|&nbsp; ABN: ${orgAbn} &nbsp;|&nbsp; NDIS Reg: ${orgNdisReg}<br>
    <strong>Participant:</strong> ${participantName} &nbsp;|&nbsp; NDIS #: ${ndisNumber}<br>
    <strong>Funding Type:</strong> ${fundingType.replace(/_/g, " ").toUpperCase()}
  </div>

  <table>
    <thead><tr>
      <th>Date</th><th>Support Item #</th><th>Description</th><th>Hours</th><th>Rate</th><th>Total</th>
    </tr></thead>
    <tbody>${lineItemsHtml}</tbody>
    <tfoot><tr class="total-row">
      <td colspan="5" style="text-align:right;padding:12px">TOTAL DUE (AUD)</td>
      <td style="font-family:monospace;font-size:16px;color:#10B981">$${totalAUD}</td>
    </tr></tfoot>
  </table>

  ${stripePayLink ? `<a href="${stripePayLink}" class="pay-btn">Pay Now via Stripe — $${totalAUD}</a>` : ""}

  <p style="font-size:12px;color:#666;margin-top:16px">
    Please use the invoice number <strong>${invoice.display_id}</strong> as your payment reference.
    Questions? Contact us at ${senderEmail}.
  </p>

  <div class="footer">
    This invoice was generated and dispatched by iWorkr. 
    ${orgAbn ? `ABN: ${orgAbn}` : ""} ${orgNdisReg ? `| NDIS Registration: ${orgNdisReg}` : ""}
  </div>
</div>
</body>
</html>`;

        // Send email via Resend
        const emailResult = await resend.emails.send({
          from: `${org?.name || "iWorkr"} <${senderEmail}>`,
          to: [recipientEmail],
          subject,
          html: emailHtml,
        });

        if (emailResult.error) {
          await supabase.from("invoices").update({ dispatch_error: emailResult.error.message }).eq("id", invoiceId);
          results.push({ invoiceId, status: "error", error: emailResult.error.message });
          continue;
        }

        // Mark as sent
        await supabase.from("invoices").update({
          status: "sent",
          payment_link: stripePayLink || invoice.payment_link,
          dispatch_error: null,
          updated_at: new Date().toISOString(),
        }).eq("id", invoiceId);

        results.push({ invoiceId, status: "sent" });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        await supabase.from("invoices").update({ dispatch_error: msg }).eq("id", invoiceId);
        results.push({ invoiceId, status: "error", error: msg });
      }
    }

    const successCount = results.filter((r) => r.status === "sent" || r.status === "queued_proda").length;
    return new Response(JSON.stringify({ ok: true, results, successCount, totalRequested: invoiceIds.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[dispatch-invoices]", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: corsHeaders });
  }
});

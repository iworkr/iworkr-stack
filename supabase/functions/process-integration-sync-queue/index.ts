/**
 * @module process-integration-sync-queue
 * @status COMPLETE
 * @auth UNSECURED — No user auth; uses service_role key internally (invoked by cron/trigger)
 * @description Processes pending integration sync queue jobs (e.g. Xero invoice refresh) with retry logic and exponential backoff
 * @dependencies Xero API, Supabase
 * @lastAudit 2026-03-22
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isTestEnv } from "../_shared/mockClients.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function delay(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeInvoiceStatus(status: string | undefined) {
  const value = (status || "").toUpperCase();
  if (value === "PAID") return "paid";
  if (value === "VOIDED") return "void";
  if (value === "DELETED") return "cancelled";
  if (value === "AUTHORISED" || value === "SUBMITTED") return "sent";
  if (value === "DRAFT") return "draft";
  return "pending";
}

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data: jobs, error } = await supabase
    .from("integration_sync_queue")
    .select("*")
    .eq("status", "pending")
    .lte("next_attempt_at", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(isTestEnv ? 1 : 50);

  if (error) {
    console.error("[process-integration-sync-queue] load error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  let processed = 0;
  let failed = 0;

  for (const job of jobs || []) {
    await supabase
      .from("integration_sync_queue")
      .update({
        status: "processing",
        attempt_count: Number(job.attempt_count || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id)
      .eq("status", "pending");

    try {
      if (job.provider === "xero" && job.operation === "refresh_invoice") {
        const payload = job.payload || {};
        const tenantId = payload.tenant_id || payload.tenantId;
        const resourceId = payload.resource_id || payload.resourceId;

        if (!tenantId || !resourceId) {
          throw new Error("Missing tenant_id/resource_id in xero refresh job payload");
        }

        const { data: tenantSecret, error: tenantSecretError } = await supabase.rpc("get_tenant_integration_secret", {
          p_integration_type: "xero",
          p_xero_tenant_id: tenantId,
        });
        if (tenantSecretError) throw new Error(tenantSecretError.message);
        const secretRow = Array.isArray(tenantSecret) ? tenantSecret[0] : tenantSecret;
        if (!secretRow?.access_token) {
          throw new Error(`No tenant integration secret found for tenant ${tenantId}`);
        }

        const invoiceBody = isTestEnv
          ? { Invoices: [{ Status: "PAID", FullyPaidOnDate: new Date().toISOString() }] }
          : await (async () => {
            const invoiceRes = await fetch(
              `https://api.xero.com/api.xro/2.0/Invoices/${resourceId}`,
              {
                headers: {
                  Authorization: `Bearer ${secretRow.access_token}`,
                  "Xero-Tenant-Id": tenantId,
                  Accept: "application/json",
                },
              },
            );
            if (!invoiceRes.ok) {
              throw new Error(`Xero API error (${invoiceRes.status}) while loading invoice ${resourceId}`);
            }
            return await invoiceRes.json();
          })();
        const invoice = Array.isArray(invoiceBody?.Invoices) ? invoiceBody.Invoices[0] : null;
        if (!invoice) {
          throw new Error(`Xero invoice ${resourceId} not found`);
        }

        const { data: mapping } = await supabase
          .from("external_mappings")
          .select("internal_record_id")
          .eq("integration_id", job.integration_id)
          .eq("internal_table", "invoices")
          .eq("external_id", resourceId)
          .maybeSingle();
        if (mapping?.internal_record_id) {
          await supabase
            .from("invoices")
            .update({
              status: normalizeInvoiceStatus(invoice.Status),
              paid_date: invoice.FullyPaidOnDate || null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", mapping.internal_record_id);
        }
      }

      // Respect external provider limits with short pacing between calls.
      await delay(120);

      await supabase
        .from("integration_sync_queue")
        .update({
          status: "done",
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      await supabase.from("integration_sync_log").insert({
        organization_id: job.organization_id,
        integration_id: job.integration_id,
        direction: "outbound",
        entity_type: job.operation,
        status: "success",
        metadata: { queue_job_id: job.id, provider: job.provider },
      });

      processed += 1;
    } catch (err) {
      const message = (err as Error).message || "Queue processing failed";
      const attempts = Number(job.attempt_count || 0) + 1;
      const shouldRetry = attempts < Number(job.max_attempts || 5);
      const nextAttemptAt = new Date(Date.now() + Math.min(2 ** attempts * 15000, 15 * 60 * 1000)).toISOString();

      await supabase
        .from("integration_sync_queue")
        .update({
          status: shouldRetry ? "pending" : "failed",
          last_error: message,
          next_attempt_at: nextAttemptAt,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      await supabase.from("integration_sync_log").insert({
        organization_id: job.organization_id,
        integration_id: job.integration_id,
        direction: "outbound",
        entity_type: job.operation,
        status: shouldRetry ? "pending" : "error",
        error_message: message,
        metadata: {
          queue_job_id: job.id,
          attempt_count: attempts,
          max_attempts: job.max_attempts,
          next_attempt_at: nextAttemptAt,
        },
      });

      failed += 1;
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      processed,
      failed,
      remaining: Math.max((jobs || []).length - processed - failed, 0),
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});


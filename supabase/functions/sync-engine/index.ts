// ============================================================
// Edge Function: sync-engine
// Project Synapse-Prod — Production Sync Queue Worker
// Handles: Rate limiting (Xero 60/min, QBO 500/min), exponential
// backoff, advisory lock token rotation, batched execution,
// dead letter queue management, health metrics tracking.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isTestEnv } from "../_shared/mockClients.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ── Rate limits per provider (requests per minute) ────────────
const RATE_LIMITS: Record<string, number> = {
  xero: 60,
  XERO: 60,
  qbo: 500,
  QBO: 500,
};

// ── Provider API base URLs ────────────────────────────────────
const API_BASES: Record<string, string> = {
  xero: "https://api.xero.com/api.xro/2.0",
  XERO: "https://api.xero.com/api.xro/2.0",
  qbo: "https://quickbooks.api.intuit.com/v3/company",
  QBO: "https://quickbooks.api.intuit.com/v3/company",
};

const TOKEN_URLS: Record<string, string> = {
  xero: "https://identity.xero.com/connect/token",
  XERO: "https://identity.xero.com/connect/token",
  qbo: "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
  QBO: "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
};

// ── Get valid token using advisory lock RPC ───────────────────
async function getValidToken(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string,
  provider: string
): Promise<{ accessToken: string; tenantId: string; connectionId: string | null }> {
  if (isTestEnv) {
    return {
      accessToken: "test_access_token",
      tenantId: "test_tenant",
      connectionId: null,
    };
  }
  const providerUpper = provider.toUpperCase();

  // Call advisory lock RPC
  const { data: tokenResult, error: rpcError } = await supabase.rpc(
    "get_valid_integration_token",
    { p_workspace_id: workspaceId, p_provider: providerUpper }
  );

  if (rpcError) throw new Error(`Token RPC error: ${rpcError.message}`);

  const result =
    typeof tokenResult === "string" ? JSON.parse(tokenResult) : tokenResult;

  if (result.error) throw new Error(result.error);

  // Token is valid
  if (!result.needs_refresh) {
    return {
      accessToken: result.access_token,
      tenantId: result.external_tenant_id,
      connectionId: result.connection_id,
    };
  }

  // Another thread is refreshing — wait and retry
  if (result.locked_by_other) {
    await new Promise((r) => setTimeout(r, 1500));
    return getValidToken(supabase, workspaceId, provider);
  }

  // We need to refresh
  const clientId =
    providerUpper === "XERO"
      ? Deno.env.get("XERO_CLIENT_ID")!
      : Deno.env.get("QBO_CLIENT_ID")!;
  const clientSecret =
    providerUpper === "XERO"
      ? Deno.env.get("XERO_CLIENT_SECRET")!
      : Deno.env.get("QBO_CLIENT_SECRET")!;
  const tokenUrl = TOKEN_URLS[providerUpper] || TOKEN_URLS.xero;

  const creds = btoa(`${clientId}:${clientSecret}`);

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${creds}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: result.refresh_token,
    }),
  });

  if (!res.ok) {
    await supabase
      .from("integration_tokens")
      .update({
        refresh_failure_count: (result.refresh_failure_count || 0) + 1,
        token_refresh_lock_until: null,
      })
      .eq("workspace_id", workspaceId)
      .eq("provider", providerUpper);
    throw new Error(`Token refresh failed: HTTP ${res.status}`);
  }

  const refreshed = await res.json();

  // Update token via RPC (releases advisory lock)
  await supabase.rpc("update_integration_token", {
    p_workspace_id: workspaceId,
    p_provider: providerUpper,
    p_access_token: refreshed.access_token,
    p_refresh_token: refreshed.refresh_token || result.refresh_token,
    p_expires_in_seconds: refreshed.expires_in || 1800,
  });

  // Track token refresh in metrics
  await supabase.from("integration_health_metrics").upsert(
    {
      organization_id: workspaceId,
      provider: provider.toLowerCase(),
      metric_date: new Date().toISOString().split("T")[0],
      token_refreshes: 1,
    },
    { onConflict: "organization_id,provider,metric_date" }
  );

  return {
    accessToken: refreshed.access_token,
    tenantId: result.external_tenant_id,
    connectionId: result.connection_id,
  };
}

// ── Execute a single API call ─────────────────────────────────
async function executeApiCall(
  supabase: ReturnType<typeof createClient>,
  job: any,
  accessToken: string,
  tenantId: string
): Promise<{ status: number; body: any; retryAfter?: number }> {
  if (isTestEnv) {
    return {
      status: 200,
      body: { Id: "ext_test_123", status: "ok" },
    };
  }
  const provider = (job.provider || "xero").toLowerCase();
  const endpoint = job.endpoint || job.operation || "";
  const method = (job.method || "POST").toUpperCase();
  const payload = job.payload || {};

  const apiBase = API_BASES[provider] || API_BASES.xero;

  // Build URL
  let url = endpoint.startsWith("http") ? endpoint : `${apiBase}/${endpoint}`;

  // For QBO, inject realm ID
  if (provider === "qbo" && tenantId) {
    url = url.replace("{realmId}", tenantId);
  }

  // Build headers
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  // Xero requires tenant ID header
  if (provider === "xero" && tenantId) {
    headers["xero-tenant-id"] = tenantId;
  }

  // Inject tracking categories into payload if configured
  if (job.tracking_category_id && job.tracking_option_id && payload.LineItems) {
    for (const line of payload.LineItems) {
      line.Tracking = line.Tracking || [];
      line.Tracking.push({
        TrackingCategoryID: job.tracking_category_id,
        TrackingOptionID: job.tracking_option_id,
      });
    }
  }

  // Execute the request
  const fetchOptions: RequestInit = {
    method,
    headers,
  };

  if (method !== "GET" && method !== "HEAD") {
    fetchOptions.body = JSON.stringify(payload);
  }

  const response = await fetch(url, fetchOptions);
  const responseBody = await response.json().catch(() => ({}));

  // Check for rate limiting
  if (response.status === 429) {
    const retryAfterHeader = response.headers.get("Retry-After");
    const retryAfter = retryAfterHeader
      ? parseInt(retryAfterHeader, 10)
      : 60; // Default 60s

    return { status: 429, body: responseBody, retryAfter };
  }

  return { status: response.status, body: responseBody };
}

// ── Calculate exponential backoff ─────────────────────────────
function calculateBackoff(attemptCount: number): number {
  // Exponential: 15s, 30s, 60s, 120s, 240s, max 15min
  const base = 15;
  const delay = Math.min(base * Math.pow(2, attemptCount), 15 * 60);
  // Add jitter (±20%)
  const jitter = delay * (0.8 + Math.random() * 0.4);
  return Math.round(jitter);
}

// ── Main Handler ──────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  const startTime = Date.now();

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // ── Phase 1: Fetch eligible queue items ─────────────────────
  // Group by provider and respect rate limits
  const { data: jobs, error } = await supabase
    .from("integration_sync_queue")
    .select("*")
    .in("status", ["queued", "pending", "QUEUED"])
    .lte("next_attempt_at", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(100);

  if (error) {
    console.error("[sync-engine] Queue fetch error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const queueJobs = isTestEnv ? (jobs || []).slice(0, 1) : (jobs || []);

  if (!queueJobs || queueJobs.length === 0) {
    return new Response(
      JSON.stringify({ ok: true, message: "No items in queue", processed: 0 }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  // ── Phase 2: Group by workspace+provider and enforce rate limits ─
  const grouped: Record<string, any[]> = {};
  for (const job of queueJobs) {
    const key = `${job.organization_id}__${(job.provider || "xero").toLowerCase()}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(job);
  }

  let totalProcessed = 0;
  let totalFailed = 0;
  let totalRateLimited = 0;
  const results: any[] = [];

  for (const [groupKey, groupJobs] of Object.entries(grouped)) {
    const [workspaceId, provider] = groupKey.split("__");
    const rateLimit = RATE_LIMITS[provider] || 60;

    // Slice to respect rate limit
    const batch = groupJobs.slice(0, rateLimit);

    // ── Phase 3: Get valid token (with advisory lock) ─────────
    let accessToken: string;
    let tenantId: string;

    try {
      const tokenResult = await getValidToken(supabase, workspaceId, provider);
      accessToken = tokenResult.accessToken;
      tenantId = tokenResult.tenantId;
    } catch (tokenErr: any) {
      // Token failure — mark all jobs in this group as failed
      console.error(
        `[sync-engine] Token failure for ${groupKey}:`,
        tokenErr.message
      );

      for (const job of batch) {
        const attempts = (job.attempt_count || 0) + 1;
        const shouldRetry = attempts < (job.max_attempts || 5);

        await supabase
          .from("integration_sync_queue")
          .update({
            status: shouldRetry ? "queued" : "FAILED_PERMANENTLY",
            last_error: `Token error: ${tokenErr.message}`,
            attempt_count: attempts,
            next_attempt_at: shouldRetry
              ? new Date(
                  Date.now() + calculateBackoff(attempts) * 1000
                ).toISOString()
              : null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.id);

        totalFailed++;
      }

      continue;
    }

    // ── Phase 4: Execute batch with rate limit awareness ──────
    let rateLimitHit = false;

    for (const job of batch) {
      if (rateLimitHit) {
        // Rate limited — defer remaining jobs
        const retryAt = new Date(Date.now() + 60_000).toISOString();
        await supabase
          .from("integration_sync_queue")
          .update({
            rate_limited_until: retryAt,
            next_attempt_at: retryAt,
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.id);
        totalRateLimited++;
        continue;
      }

      // Mark as processing
      await supabase
        .from("integration_sync_queue")
        .update({
          status: "processing",
          processing_started_at: new Date().toISOString(),
          attempt_count: (job.attempt_count || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      try {
        const { status, body, retryAfter } = await executeApiCall(
          supabase,
          job,
          accessToken,
          tenantId
        );

        if (status === 429) {
          // Rate limited — apply Retry-After header
          rateLimitHit = true;
          const retryAt = new Date(
            Date.now() + (retryAfter || 60) * 1000
          ).toISOString();

          await supabase
            .from("integration_sync_queue")
            .update({
              status: "queued",
              last_error: `Rate limited (429). Retry-After: ${retryAfter}s`,
              rate_limited_until: retryAt,
              next_attempt_at: retryAt,
              response_status: 429,
              response_body: body,
              updated_at: new Date().toISOString(),
            })
            .eq("id", job.id);

          // Track rate limit hit
          await supabase.from("integration_health_metrics").upsert(
            {
              organization_id: workspaceId,
              provider: provider,
              metric_date: new Date().toISOString().split("T")[0],
              rate_limit_hits: 1,
            },
            { onConflict: "organization_id,provider,metric_date" }
          );

          totalRateLimited++;
          continue;
        }

        if (status >= 200 && status < 300) {
          // Success
          await supabase
            .from("integration_sync_queue")
            .update({
              status: "completed",
              response_status: status,
              response_body: body,
              completed_at: new Date().toISOString(),
              last_error: null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", job.id);

          // Log success
          await supabase.from("integration_sync_log").insert({
            organization_id: workspaceId,
            direction: "outbound",
            entity_type: job.operation || job.endpoint || "sync",
            entity_id: job.idempotency_key,
            provider_entity_id: body?.Id || body?.Invoices?.[0]?.InvoiceID,
            status: "success",
            metadata: {
              queue_job_id: job.id,
              provider,
              response_status: status,
            },
          });

          // Update health metrics
          await supabase.from("integration_health_metrics").upsert(
            {
              organization_id: workspaceId,
              provider: provider,
              metric_date: new Date().toISOString().split("T")[0],
              items_synced: 1,
            },
            { onConflict: "organization_id,provider,metric_date" }
          );

          totalProcessed++;
          results.push({
            id: job.id,
            status: "completed",
            response_status: status,
          });
        } else {
          // API error
          const attempts = (job.attempt_count || 0) + 1;
          const shouldRetry = attempts < (job.max_attempts || 5);
          const backoffSeconds = calculateBackoff(attempts);

          await supabase
            .from("integration_sync_queue")
            .update({
              status: shouldRetry ? "queued" : "FAILED_PERMANENTLY",
              last_error: `API error ${status}: ${JSON.stringify(body).slice(0, 500)}`,
              response_status: status,
              response_body: body,
              next_attempt_at: shouldRetry
                ? new Date(
                    Date.now() + backoffSeconds * 1000
                  ).toISOString()
                : null,
              completed_at: shouldRetry ? null : new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", job.id);

          // Log failure
          await supabase.from("integration_sync_log").insert({
            organization_id: workspaceId,
            direction: "outbound",
            entity_type: job.operation || job.endpoint || "sync",
            entity_id: job.idempotency_key,
            status: shouldRetry ? "retrying" : "error",
            error_message: `HTTP ${status}`,
            metadata: {
              queue_job_id: job.id,
              attempt_count: attempts,
              backoff_seconds: backoffSeconds,
              response_body: body,
            },
          });

          if (!shouldRetry) {
            await supabase.from("integration_health_metrics").upsert(
              {
                organization_id: workspaceId,
                provider: provider,
                metric_date: new Date().toISOString().split("T")[0],
                items_failed: 1,
              },
              { onConflict: "organization_id,provider,metric_date" }
            );
          }

          totalFailed++;
          results.push({
            id: job.id,
            status: shouldRetry ? "retrying" : "FAILED_PERMANENTLY",
            response_status: status,
            next_retry_in: shouldRetry ? `${backoffSeconds}s` : null,
          });
        }

        // Small delay between requests to stay under rate limit
        await new Promise((r) =>
          setTimeout(r, Math.ceil(60000 / rateLimit) + 50)
        );
      } catch (execErr: any) {
        // Network error or unexpected failure
        const attempts = (job.attempt_count || 0) + 1;
        const shouldRetry = attempts < (job.max_attempts || 5);
        const backoffSeconds = calculateBackoff(attempts);

        await supabase
          .from("integration_sync_queue")
          .update({
            status: shouldRetry ? "queued" : "FAILED_PERMANENTLY",
            last_error: execErr.message,
            next_attempt_at: shouldRetry
              ? new Date(
                  Date.now() + backoffSeconds * 1000
                ).toISOString()
              : null,
            completed_at: shouldRetry ? null : new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.id);

        totalFailed++;
      }
    }
  }

  const elapsed = Date.now() - startTime;

  return new Response(
    JSON.stringify({
      ok: true,
      processed: totalProcessed,
      failed: totalFailed,
      rate_limited: totalRateLimited,
      total_jobs: queueJobs.length,
      elapsed_ms: elapsed,
      results,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});

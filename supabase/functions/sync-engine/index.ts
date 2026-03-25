/**
 * @module sync-engine
 * @status COMPLETE
 * @auth UNSECURED — Invoked by pg_cron or internal triggers; no JWT guard
 * @description Production sync queue worker with entity transformation pipelines
 *   (Contact, Invoice, Payment, Timesheet), rate limiting, exponential backoff,
 *   advisory lock token rotation, dead letter queue, connection health monitoring.
 * @dependencies Supabase, Xero API, QuickBooks Online API
 * @lastAudit 2026-03-24
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const RATE_LIMITS: Record<string, number> = {
  xero: 60, XERO: 60,
  qbo: 500, QBO: 500,
};

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

// ── Token management with advisory lock ───────────────────
async function getValidToken(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string,
  provider: string
): Promise<{ accessToken: string; tenantId: string; connectionId: string | null }> {
  const providerUpper = provider.toUpperCase();

  const { data: tokenResult, error: rpcError } = await supabase.rpc(
    "get_valid_integration_token",
    { p_workspace_id: workspaceId, p_provider: providerUpper }
  );

  if (rpcError) throw new Error(`Token RPC error: ${rpcError.message}`);

  const result =
    typeof tokenResult === "string" ? JSON.parse(tokenResult) : tokenResult;

  if (result.error) throw new Error(result.error);

  if (!result.needs_refresh) {
    return {
      accessToken: result.access_token,
      tenantId: result.external_tenant_id,
      connectionId: result.connection_id,
    };
  }

  if (result.locked_by_other) {
    await new Promise((r) => setTimeout(r, 1500));
    return getValidToken(supabase, workspaceId, provider);
  }

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
    const failCount = (result.refresh_failure_count || 0) + 1;
    await supabase
      .from("integration_tokens")
      .update({
        refresh_failure_count: failCount,
        token_refresh_lock_until: null,
      })
      .eq("workspace_id", workspaceId)
      .eq("provider", providerUpper);

    if (failCount >= 5) {
      await supabase.rpc("mark_integration_disconnected", {
        p_workspace_id: workspaceId,
        p_provider: providerUpper,
        p_reason: `Token refresh failed ${failCount} times. HTTP ${res.status}`,
      });
    }

    throw new Error(`Token refresh failed: HTTP ${res.status}`);
  }

  const refreshed = await res.json();

  await supabase.rpc("update_integration_token", {
    p_workspace_id: workspaceId,
    p_provider: providerUpper,
    p_access_token: refreshed.access_token,
    p_refresh_token: refreshed.refresh_token || result.refresh_token,
    p_expires_in_seconds: refreshed.expires_in || 1800,
  });

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

// ── Entity Transformer: Convert iWorkr payload → Xero API format ──

interface TransformResult {
  endpoint: string;
  method: string;
  payload: Record<string, unknown>;
  dependsOnContact?: boolean;
}

async function transformEntity(
  supabase: ReturnType<typeof createClient>,
  job: Record<string, unknown>,
  workspaceId: string,
  provider: string,
  tenantId: string,
  accessToken: string
): Promise<TransformResult> {
  const entityType = (job.entity_type as string) || "";
  const action = (job.action as string) || (job.operation as string) || "CREATE";
  const snapshot = (job.payload_snapshot as Record<string, unknown>) ||
    (job.payload as Record<string, unknown>) || {};

  switch (entityType.toUpperCase()) {
    case "CONTACT":
      return transformContact(snapshot, action);

    case "INVOICE":
      return await transformInvoice(
        supabase, snapshot, action, workspaceId, provider, tenantId, accessToken
      );

    case "PAYMENT":
      return await transformPayment(
        supabase, snapshot, workspaceId, provider
      );

    case "TIMESHEET":
      return await transformTimesheet(
        supabase, snapshot, workspaceId, provider
      );

    default:
      return {
        endpoint: job.endpoint as string || job.operation as string || "",
        method: (job.method as string) || "POST",
        payload: snapshot,
      };
  }
}

function transformContact(
  snapshot: Record<string, unknown>,
  action: string
): TransformResult {
  const xeroContact: Record<string, unknown> = {
    Name: snapshot.name || snapshot.business_name || snapshot.full_name || "Unknown",
    FirstName: snapshot.first_name || "",
    LastName: snapshot.last_name || "",
    EmailAddress: snapshot.email || "",
  };

  if (snapshot.phone) {
    xeroContact.Phones = [
      { PhoneType: "DEFAULT", PhoneNumber: snapshot.phone as string },
    ];
  }

  if (snapshot.address_line_1 || snapshot.street) {
    xeroContact.Addresses = [
      {
        AddressType: "STREET",
        AddressLine1: snapshot.address_line_1 || snapshot.street || "",
        City: snapshot.city || snapshot.suburb || "",
        Region: snapshot.state || "",
        PostalCode: snapshot.postcode || snapshot.postal_code || "",
        Country: snapshot.country || "AU",
      },
    ];
  }

  if (snapshot.abn) {
    xeroContact.TaxNumber = snapshot.abn;
  }

  const isUpdate = action === "UPDATE" && snapshot.external_id;

  return {
    endpoint: isUpdate
      ? `Contacts/${snapshot.external_id}`
      : "Contacts",
    method: isUpdate ? "POST" : "POST",
    payload: { Contacts: [xeroContact] },
  };
}

async function transformInvoice(
  supabase: ReturnType<typeof createClient>,
  snapshot: Record<string, unknown>,
  action: string,
  workspaceId: string,
  provider: string,
  tenantId: string,
  accessToken: string
): Promise<TransformResult> {
  const clientId = snapshot.client_id as string;

  let contactId = snapshot.external_contact_id as string | undefined;

  if (!contactId && clientId) {
    const { data: mapping } = await supabase
      .from("integration_entity_map")
      .select("external_id")
      .eq("workspace_id", workspaceId)
      .eq("provider", provider.toUpperCase())
      .eq("entity_type", "CONTACT")
      .eq("iworkr_id", clientId)
      .maybeSingle();

    if (mapping) {
      contactId = mapping.external_id;
    } else {
      const { data: client } = await supabase
        .from("clients")
        .select("id, first_name, last_name, business_name, email, phone, address_line_1, city, state, postcode")
        .eq("id", clientId)
        .maybeSingle();

      if (client) {
        const contactPayload = transformContact(client as Record<string, unknown>, "CREATE");
        const apiBase = API_BASES[provider.toLowerCase()] || API_BASES.xero;

        const contactRes = await fetch(`${apiBase}/${contactPayload.endpoint}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "xero-tenant-id": tenantId,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(contactPayload.payload),
        });

        if (contactRes.ok) {
          const contactData = await contactRes.json();
          const xeroContactId =
            contactData?.Contacts?.[0]?.ContactID;
          if (xeroContactId) {
            contactId = xeroContactId;
            await supabase.rpc("upsert_entity_mapping", {
              p_workspace_id: workspaceId,
              p_provider: provider.toUpperCase(),
              p_entity_type: "CONTACT",
              p_iworkr_id: clientId,
              p_external_id: xeroContactId,
              p_external_number: contactData?.Contacts?.[0]?.ContactNumber || null,
            });
          }
        }
      }
    }
  }

  const { data: accountCodes } = await supabase
    .from("integration_account_codes")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("provider", provider.toUpperCase())
    .eq("iworkr_code_type", "REVENUE")
    .eq("is_active", true);

  const defaultAccountCode =
    accountCodes?.[0]?.external_code || "200";
  const defaultTaxType =
    accountCodes?.[0]?.external_tax_type || "OUTPUT";

  const lineItems = ((snapshot.line_items || snapshot.items || []) as Record<string, unknown>[]).map(
    (item) => {
      const isNDIS = !!(item.ndis_category || item.is_ndis || snapshot.is_ndis);

      const matchedCode = accountCodes?.find(
        (ac: Record<string, unknown>) => ac.iworkr_code_key === item.service_type || ac.iworkr_code_key === item.category
      );

      return {
        Description: item.description || item.name || "Service",
        Quantity: item.quantity || item.qty || 1,
        UnitAmount: item.unit_price || item.rate || item.amount || 0,
        AccountCode: matchedCode?.external_code || defaultAccountCode,
        TaxType: isNDIS ? "EXEMPTOUTPUT" : (matchedCode?.external_tax_type || defaultTaxType),
        ...(item.discount_percent ? { DiscountRate: item.discount_percent } : {}),
      };
    }
  );

  if (lineItems.length === 0) {
    lineItems.push({
      Description: snapshot.description as string || "Professional Services",
      Quantity: 1,
      UnitAmount: snapshot.total || snapshot.amount || 0,
      AccountCode: defaultAccountCode,
      TaxType: (snapshot.is_ndis as boolean) ? "EXEMPTOUTPUT" : defaultTaxType,
    });
  }

  const xeroInvoice: Record<string, unknown> = {
    Type: "ACCREC",
    Contact: contactId ? { ContactID: contactId } : undefined,
    InvoiceNumber: snapshot.invoice_number || snapshot.display_id || "",
    Reference: snapshot.reference || snapshot.job_number || "",
    Date: snapshot.issue_date || snapshot.created_at
      ? new Date(snapshot.issue_date as string || snapshot.created_at as string).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0],
    DueDate: snapshot.due_date
      ? new Date(snapshot.due_date as string).toISOString().split("T")[0]
      : undefined,
    Status: action === "VOID" ? "VOIDED" : "AUTHORISED",
    LineAmountTypes: "Exclusive",
    LineItems: lineItems,
  };

  const isUpdate = action === "UPDATE" && snapshot.external_id;

  return {
    endpoint: isUpdate
      ? `Invoices/${snapshot.external_id}`
      : "Invoices",
    method: "POST",
    payload: { Invoices: [xeroInvoice] },
    dependsOnContact: !contactId,
  };
}

async function transformPayment(
  supabase: ReturnType<typeof createClient>,
  snapshot: Record<string, unknown>,
  workspaceId: string,
  provider: string
): Promise<TransformResult> {
  let xeroInvoiceId = snapshot.external_invoice_id as string | undefined;

  if (!xeroInvoiceId && snapshot.invoice_id) {
    const { data: mapping } = await supabase
      .from("integration_entity_map")
      .select("external_id")
      .eq("workspace_id", workspaceId)
      .eq("provider", provider.toUpperCase())
      .eq("entity_type", "INVOICE")
      .eq("iworkr_id", snapshot.invoice_id as string)
      .maybeSingle();

    xeroInvoiceId = mapping?.external_id;
  }

  if (!xeroInvoiceId) {
    const { data: invoice } = await supabase
      .from("invoices")
      .select("external_id")
      .eq("id", snapshot.invoice_id as string)
      .maybeSingle();

    xeroInvoiceId = invoice?.external_id || undefined;
  }

  if (!xeroInvoiceId) {
    throw new Error(`Cannot apply payment: no Xero InvoiceID found for iWorkr invoice ${snapshot.invoice_id}`);
  }

  const { data: stripeCodes } = await supabase
    .from("integration_account_codes")
    .select("external_code")
    .eq("workspace_id", workspaceId)
    .eq("provider", provider.toUpperCase())
    .eq("iworkr_code_type", "PAYMENT_ACCOUNT")
    .eq("iworkr_code_key", "STRIPE_CLEARING")
    .maybeSingle();

  const xeroPayment: Record<string, unknown> = {
    Invoice: { InvoiceID: xeroInvoiceId },
    Account: {
      Code: stripeCodes?.external_code || snapshot.payment_account_code || "090",
    },
    Date: snapshot.paid_date || snapshot.payment_date
      ? new Date(snapshot.paid_date as string || snapshot.payment_date as string).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0],
    Amount: snapshot.amount || snapshot.total || 0,
    Reference: snapshot.stripe_payment_id || snapshot.reference || "Stripe Payment",
  };

  return {
    endpoint: "Payments",
    method: "PUT",
    payload: xeroPayment,
  };
}

async function transformTimesheet(
  supabase: ReturnType<typeof createClient>,
  snapshot: Record<string, unknown>,
  workspaceId: string,
  provider: string
): Promise<TransformResult> {
  const workerId = snapshot.worker_id as string;

  let xeroEmployeeId = snapshot.xero_employee_id as string | undefined;

  if (!xeroEmployeeId && workerId) {
    const { data: mapping } = await supabase
      .from("integration_entity_map")
      .select("external_id")
      .eq("workspace_id", workspaceId)
      .eq("provider", provider.toUpperCase())
      .eq("entity_type", "EMPLOYEE")
      .eq("iworkr_id", workerId)
      .maybeSingle();

    xeroEmployeeId = mapping?.external_id;
  }

  if (!xeroEmployeeId) {
    throw new Error(`No Xero EmployeeID mapped for worker ${workerId}`);
  }

  const { data: earningsMap } = await supabase
    .from("integration_account_codes")
    .select("iworkr_code_key, external_code, external_name")
    .eq("workspace_id", workspaceId)
    .eq("provider", provider.toUpperCase())
    .eq("iworkr_code_type", "EARNINGS_RATE")
    .eq("is_active", true);

  const earningsLookup: Record<string, string> = {};
  for (const rate of earningsMap || []) {
    earningsLookup[rate.iworkr_code_key] = rate.external_code;
  }

  const payLines = (snapshot.pay_lines || []) as Array<Record<string, unknown>>;
  const periodStart = snapshot.period_start as string;
  const periodEnd = snapshot.period_end as string;

  const start = new Date(periodStart);
  const end = new Date(periodEnd);
  const dayCount = Math.ceil(
    (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
  ) + 1;

  const earningsAccum: Record<string, number[]> = {};

  for (const line of payLines) {
    const category = line.pay_category as string;
    const earningsRateId = earningsLookup[category];
    if (!earningsRateId) continue;

    if (!earningsAccum[earningsRateId]) {
      earningsAccum[earningsRateId] = new Array(dayCount).fill(0);
    }

    const shiftDate = new Date(line.shift_date as string);
    const dayIndex = Math.floor(
      (shiftDate.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (dayIndex >= 0 && dayIndex < dayCount) {
      earningsAccum[earningsRateId][dayIndex] += Number(line.units || line.hours || 0);
    }
  }

  const timesheetLines = Object.entries(earningsAccum)
    .filter(([, units]) => units.some((u) => u > 0))
    .map(([earningsRateId, units]) => ({
      EarningsRateID: earningsRateId,
      NumberOfUnits: units.map((u) => Math.round(u * 100) / 100),
    }));

  if (timesheetLines.length === 0) {
    throw new Error("No mappable earnings lines — check payroll mapping configuration");
  }

  const xeroTimesheet: Record<string, unknown> = {
    EmployeeID: xeroEmployeeId,
    StartDate: new Date(periodStart).toISOString().split("T")[0],
    EndDate: new Date(periodEnd).toISOString().split("T")[0],
    Status: "Draft",
    TimesheetLines: timesheetLines,
  };

  return {
    endpoint: "Timesheets",
    method: "POST",
    payload: xeroTimesheet,
  };
}

// ── Execute API call ──────────────────────────────────────
async function executeApiCall(
  job: Record<string, unknown>,
  accessToken: string,
  tenantId: string,
  transform: TransformResult
): Promise<{ status: number; body: Record<string, unknown>; retryAfter?: number }> {
  const provider = ((job.provider as string) || "xero").toLowerCase();
  const apiBase = API_BASES[provider] || API_BASES.xero;

  let url = transform.endpoint.startsWith("http")
    ? transform.endpoint
    : `${apiBase}/${transform.endpoint}`;

  if (provider === "qbo" && tenantId) {
    url = url.replace("{realmId}", tenantId);
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  if (provider === "xero" && tenantId) {
    headers["xero-tenant-id"] = tenantId;
  }

  const fetchOptions: RequestInit = {
    method: transform.method,
    headers,
  };

  if (transform.method !== "GET" && transform.method !== "HEAD") {
    fetchOptions.body = JSON.stringify(transform.payload);
  }

  const response = await fetch(url, fetchOptions);
  const responseBody = await response.json().catch(() => ({}));

  if (response.status === 429) {
    const retryAfterHeader = response.headers.get("Retry-After");
    const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : 60;
    return { status: 429, body: responseBody as Record<string, unknown>, retryAfter };
  }

  return { status: response.status, body: responseBody as Record<string, unknown> };
}

// ── Exponential backoff calculation ───────────────────────
function calculateBackoff(attemptCount: number): number {
  const base = 300;
  const delay = Math.min(base * Math.pow(2, attemptCount), 15 * 60);
  const jitter = delay * (0.8 + Math.random() * 0.4);
  return Math.round(jitter);
}

// ── Extract external ID from API response ─────────────────
function extractExternalId(
  body: Record<string, unknown>,
  entityType: string
): string | null {
  switch (entityType?.toUpperCase()) {
    case "CONTACT":
      return (body as any)?.Contacts?.[0]?.ContactID ?? null;
    case "INVOICE":
      return (body as any)?.Invoices?.[0]?.InvoiceID ?? null;
    case "PAYMENT":
      return (body as any)?.Payments?.[0]?.PaymentID ?? null;
    case "TIMESHEET":
      return (body as any)?.Timesheets?.[0]?.TimesheetID ?? null;
    default:
      return (body as any)?.Id ?? null;
  }
}

// ── Main Handler ──────────────────────────────────────────
Deno.serve(async (_req: Request) => {
  const startTime = Date.now();

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

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

  const queueJobs = jobs || [];

  if (queueJobs.length === 0) {
    return new Response(
      JSON.stringify({ ok: true, message: "No items in queue", processed: 0 }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  const grouped: Record<string, Record<string, unknown>[]> = {};
  for (const job of queueJobs) {
    const key = `${job.organization_id}__${((job.provider as string) || "xero").toLowerCase()}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(job as Record<string, unknown>);
  }

  let totalProcessed = 0;
  let totalFailed = 0;
  let totalRateLimited = 0;
  const results: Record<string, unknown>[] = [];

  for (const [groupKey, groupJobs] of Object.entries(grouped)) {
    const [workspaceId, provider] = groupKey.split("__");
    const rateLimit = RATE_LIMITS[provider] || 60;
    const batch = groupJobs.slice(0, rateLimit);

    let accessToken: string;
    let tenantId: string;

    try {
      const tokenResult = await getValidToken(supabase, workspaceId, provider);
      accessToken = tokenResult.accessToken;
      tenantId = tokenResult.tenantId;
    } catch (tokenErr: unknown) {
      const errMsg = tokenErr instanceof Error ? tokenErr.message : String(tokenErr);
      console.error(`[sync-engine] Token failure for ${groupKey}:`, errMsg);

      if (errMsg.includes("401") || errMsg.includes("403") || errMsg.includes("revoked")) {
        await supabase.rpc("mark_integration_disconnected", {
          p_workspace_id: workspaceId,
          p_provider: provider.toUpperCase(),
          p_reason: errMsg,
        });
      }

      for (const job of batch) {
        const attempts = ((job.attempt_count as number) || 0) + 1;
        const shouldRetry = attempts < ((job.max_attempts as number) || 5);

        await supabase
          .from("integration_sync_queue")
          .update({
            status: shouldRetry ? "queued" : "FAILED_PERMANENTLY",
            last_error: `Token error: ${errMsg}`,
            error_log: `Token error: ${errMsg}`,
            attempt_count: attempts,
            next_attempt_at: shouldRetry
              ? new Date(Date.now() + calculateBackoff(attempts) * 1000).toISOString()
              : null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.id);

        totalFailed++;
      }
      continue;
    }

    let rateLimitHit = false;

    for (const job of batch) {
      if (rateLimitHit) {
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

      await supabase
        .from("integration_sync_queue")
        .update({
          status: "processing",
          processing_started_at: new Date().toISOString(),
          attempt_count: ((job.attempt_count as number) || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      try {
        const transform = await transformEntity(
          supabase, job, workspaceId, provider, tenantId, accessToken
        );

        const { status, body, retryAfter } = await executeApiCall(
          job, accessToken, tenantId, transform
        );

        if (status === 429) {
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

          totalRateLimited++;
          continue;
        }

        if (status === 401 || status === 403) {
          await supabase.rpc("mark_integration_disconnected", {
            p_workspace_id: workspaceId,
            p_provider: provider.toUpperCase(),
            p_reason: `Xero returned HTTP ${status} — token may be revoked`,
          });

          await supabase
            .from("integration_sync_queue")
            .update({
              status: "FAILED_PERMANENTLY",
              last_error: `Auth failure (${status}): connection disconnected`,
              error_log: JSON.stringify(body).slice(0, 1000),
              response_status: status,
              response_body: body,
              completed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", job.id);

          totalFailed++;
          rateLimitHit = true;
          continue;
        }

        if (status >= 200 && status < 300) {
          const entityType = (job.entity_type as string) || "";
          const entityId = job.entity_id as string;
          const externalId = extractExternalId(body, entityType);

          if (externalId && entityId && entityType) {
            await supabase.rpc("upsert_entity_mapping", {
              p_workspace_id: workspaceId,
              p_provider: provider.toUpperCase(),
              p_entity_type: entityType.toUpperCase(),
              p_iworkr_id: entityId,
              p_external_id: externalId,
            });

            if (entityType.toUpperCase() === "INVOICE") {
              await supabase
                .from("invoices")
                .update({
                  external_id: externalId,
                  external_provider: provider.toUpperCase(),
                  sync_status: "SUCCESS",
                  sync_error: null,
                  synced_at: new Date().toISOString(),
                })
                .eq("id", entityId);
            }
          }

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

          await supabase.from("integration_sync_log").insert({
            organization_id: workspaceId,
            direction: "outbound",
            entity_type: entityType || (job.operation as string) || "sync",
            entity_id: job.idempotency_key as string,
            provider_entity_id: externalId,
            status: "success",
            metadata: {
              queue_job_id: job.id,
              provider,
              response_status: status,
              entity_type: entityType,
            },
          });

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
          results.push({ id: job.id, status: "completed", response_status: status });
        } else {
          const attempts = ((job.attempt_count as number) || 0) + 1;
          const shouldRetry = attempts < ((job.max_attempts as number) || 5);
          const backoffSeconds = calculateBackoff(attempts);

          await supabase
            .from("integration_sync_queue")
            .update({
              status: shouldRetry ? "queued" : "FAILED_PERMANENTLY",
              last_error: `API error ${status}: ${JSON.stringify(body).slice(0, 500)}`,
              error_log: JSON.stringify(body).slice(0, 2000),
              response_status: status,
              response_body: body,
              next_attempt_at: shouldRetry
                ? new Date(Date.now() + backoffSeconds * 1000).toISOString()
                : null,
              completed_at: shouldRetry ? null : new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", job.id);

          await supabase.from("integration_sync_log").insert({
            organization_id: workspaceId,
            direction: "outbound",
            entity_type: (job.entity_type as string) || (job.operation as string) || "sync",
            entity_id: job.idempotency_key as string,
            status: shouldRetry ? "retrying" : "error",
            error_message: `HTTP ${status}`,
            metadata: {
              queue_job_id: job.id,
              attempt_count: attempts,
              backoff_seconds: backoffSeconds,
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

        await new Promise((r) =>
          setTimeout(r, Math.ceil(60000 / rateLimit) + 50)
        );
      } catch (execErr: unknown) {
        const errMsg = execErr instanceof Error ? execErr.message : String(execErr);
        const attempts = ((job.attempt_count as number) || 0) + 1;
        const shouldRetry = attempts < ((job.max_attempts as number) || 5);
        const backoffSeconds = calculateBackoff(attempts);

        await supabase
          .from("integration_sync_queue")
          .update({
            status: shouldRetry ? "queued" : "FAILED_PERMANENTLY",
            last_error: errMsg,
            error_log: errMsg,
            next_attempt_at: shouldRetry
              ? new Date(Date.now() + backoffSeconds * 1000).toISOString()
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

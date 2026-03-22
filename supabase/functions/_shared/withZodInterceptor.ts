import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";

type ValidationMode = "ENFORCE" | "DRY_RUN";

export interface InterceptorContext {
  rawBody: string;
  contentType: string;
  provider: string | null;
}

interface WithZodOptions {
  providerHint?: string;
  bypassMethods?: string[];
}

const JSON_HEADERS = {
  "Content-Type": "application/problem+json",
};

const KNOWN_PROVIDER_HEADERS: Record<string, string> = {
  "stripe-signature": "stripe",
  "x-xero-signature": "xero",
  "x-resend-signature": "resend",
  "x-twilio-signature": "twilio",
  "twilio-signature": "twilio",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getValidationMode(): ValidationMode {
  const mode = (Deno.env.get("ZOD_INTERCEPTOR_MODE") ?? "ENFORCE").toUpperCase();
  return mode === "DRY_RUN" ? "DRY_RUN" : "ENFORCE";
}

function problemJson(
  status: number,
  title: string,
  detail: string,
  issues?: Array<{ path: string; message: string; code: string }>,
  meta?: Record<string, unknown>
) {
  return new Response(
    JSON.stringify({
      type: "https://iworkr.app/errors/validation-failed",
      title,
      status,
      detail,
      issues,
      ...meta,
    }),
    { status, headers: JSON_HEADERS }
  );
}

async function parsePayload(req: Request): Promise<{ payload: unknown; rawBody: string; contentType: string }> {
  const contentType = (req.headers.get("content-type") || "").toLowerCase();
  const rawBody = await req.text();

  if (!rawBody.trim()) {
    return { payload: {}, rawBody, contentType };
  }

  if (contentType.includes("application/x-www-form-urlencoded")) {
    return {
      payload: Object.fromEntries(new URLSearchParams(rawBody).entries()),
      rawBody,
      contentType,
    };
  }

  if (contentType.includes("application/json") || contentType.includes("application/ld+json")) {
    try {
      return { payload: JSON.parse(rawBody), rawBody, contentType };
    } catch {
      throw new Error("MALFORMED_JSON");
    }
  }

  throw new Error("UNSUPPORTED_CONTENT_TYPE");
}

function detectProvider(req: Request, payload: unknown, hint?: string): string | null {
  if (hint) return hint.toLowerCase();

  const explicit = req.headers.get("x-iworkr-provider");
  if (explicit) return explicit.toLowerCase();

  const payloadObj = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  if (typeof payloadObj.provider === "string") return payloadObj.provider.toLowerCase();

  for (const [header, provider] of Object.entries(KNOWN_PROVIDER_HEADERS)) {
    if (req.headers.get(header)) return provider;
  }

  return null;
}

function resolveWorkspaceId(req: Request, payload: unknown): string | null {
  const fromHeader = req.headers.get("x-iworkr-org-id");
  if (fromHeader && UUID_RE.test(fromHeader)) return fromHeader;

  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    const candidates = [obj.organization_id, obj.org_id, obj.workspace_id];
    for (const value of candidates) {
      if (typeof value === "string" && UUID_RE.test(value)) return value;
    }
  }

  return null;
}

async function routeValidationFailure(
  req: Request,
  payload: unknown,
  issues: z.ZodIssue[],
  provider: string | null
) {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRole) return;

  const admin = createClient(url, serviceRole, { auth: { persistSession: false } });
  const workspaceId = resolveWorkspaceId(req, payload);

  const telemetryRow = {
    workspace_id: workspaceId,
    event_category: "VALIDATION_FAILURE",
    severity: "WARN",
    url_path: new URL(req.url).pathname,
    payload: {
      provider,
      issues: issues.map((issue) => ({
        path: issue.path.join("."),
        code: issue.code,
        message: issue.message,
      })),
      request_headers: Object.fromEntries(req.headers.entries()),
      raw_payload: payload,
    },
  };

  const dlqInsert = async () => {
    if (!workspaceId || !provider) return;

    // Preferred route: legacy integration_sync_log (explicitly requested).
    const { data: integration } = await admin
      .from("integrations")
      .select("id")
      .eq("organization_id", workspaceId)
      .eq("provider", provider)
      .limit(1)
      .maybeSingle();

    if (integration?.id) {
      await admin.from("integration_sync_log").insert({
        organization_id: workspaceId,
        integration_id: integration.id,
        direction: "inbound",
        entity_type: "webhook",
        status: "error",
        error_message: "FAILED_VALIDATION",
        metadata: {
          provider,
          validation_status: "FAILED_VALIDATION",
          issues,
          raw_payload: payload,
        },
      });
      return;
    }
  };

  await Promise.allSettled([
    admin.from("system_telemetry").insert(telemetryRow),
    dlqInsert(),
  ]);
}

export function withZodInterceptor<T extends z.ZodTypeAny>(
  schema: T,
  handler: (req: Request, validatedData: z.infer<T>, ctx: InterceptorContext) => Promise<Response>,
  options: WithZodOptions = {}
) {
  return async (req: Request): Promise<Response> => {
    const bypassMethods = options.bypassMethods ?? ["OPTIONS"];
    if (bypassMethods.includes(req.method.toUpperCase())) {
      return handler(req, {} as z.infer<T>, { rawBody: "", contentType: "", provider: options.providerHint ?? null });
    }

    let payload: unknown = {};
    let rawBody = "";
    let contentType = "";

    try {
      const parsed = await parsePayload(req);
      payload = parsed.payload;
      rawBody = parsed.rawBody;
      contentType = parsed.contentType;
    } catch (error) {
      const code = (error as Error).message;
      if (code === "UNSUPPORTED_CONTENT_TYPE") {
        return problemJson(
          415,
          "Unsupported Media Type",
          "Supported content-types: application/json, application/x-www-form-urlencoded"
        );
      }
      return problemJson(400, "Malformed Request Body", "Request body cannot be parsed.");
    }

    const parsed = schema.safeParse(payload);
    const provider = detectProvider(req, payload, options.providerHint);
    const ctx: InterceptorContext = { rawBody, contentType, provider };

    if (!parsed.success) {
      void routeValidationFailure(req, payload, parsed.error.issues, provider);

      const issues = parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
        code: issue.code,
      }));

      if (getValidationMode() === "DRY_RUN") {
        return handler(req, payload as z.infer<T>, ctx);
      }

      return problemJson(
        400,
        "Payload Validation Failed",
        "The provided payload did not match the required schema.",
        issues
      );
    }

    return handler(req, parsed.data, ctx);
  };
}


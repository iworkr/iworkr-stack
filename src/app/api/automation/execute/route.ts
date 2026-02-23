import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { dispatchAndWait, type AutomationEvent } from "@/lib/automation";
import { rateLimit, getIdentifier, RateLimits } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

/**
 * POST /api/automation/execute
 *
 * Process an automation event. Can be called:
 * 1. Internally by database triggers (via pg_notify / webhook)
 * 2. Externally via API (requires service key auth)
 * 3. By cron jobs for scheduled triggers
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limit
    const rl = rateLimit(`automation:${getIdentifier(request)}`, RateLimits.api);
    if (!rl.success) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(Math.ceil((rl.reset - Date.now()) / 1000)) } }
      );
    }

    // Verify authorization — require service role key or internal secret
    const authHeader = request.headers.get("authorization");
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const automationSecret = process.env.AUTOMATION_SECRET || serviceKey;

    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;

    const isSecretValid =
      bearerToken &&
      automationSecret &&
      bearerToken.length === automationSecret.length &&
      timingSafeEqual(Buffer.from(bearerToken), Buffer.from(automationSecret));

    if (!isSecretValid) {
      // Also allow requests from same origin (internal calls)
      const origin = request.headers.get("origin") || "";
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
      if (!origin || !appUrl || !origin.includes(new URL(appUrl).hostname)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const body = await request.json();

    // Validate event shape
    if (!body.type || !body.organization_id) {
      return NextResponse.json(
        { error: "Missing required fields: type, organization_id" },
        { status: 400 }
      );
    }

    const event: AutomationEvent = {
      id: body.id || `api_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: body.type,
      category: body.category || body.type.split(".")[0],
      organization_id: body.organization_id,
      user_id: body.user_id,
      entity_type: body.entity_type,
      entity_id: body.entity_id,
      payload: body.payload || {},
      metadata: body.metadata,
      timestamp: body.timestamp || new Date().toISOString(),
    };

    const result = await dispatchAndWait(event);

    return NextResponse.json({
      success: true,
      flows_matched: result.flowsMatched,
      flows_executed: result.flowsExecuted,
      errors: result.errors,
    });
  } catch (error) {
    logger.error("Automation API error", "automation", error instanceof Error ? error : undefined);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}

/**
 * @route GET /api/integrations/callback
 * @status COMPLETE
 * @auth PUBLIC — OAuth callback with HMAC state verification
 * @description Handles OAuth callback for third-party integration connections
 * @lastAudit 2026-03-22
 */
import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { exchangeOAuthCode } from "@/app/actions/integration-oauth";
import { getAppUrl } from "@/lib/app-url";

const APP_URL = getAppUrl();

function verifyStateSignature(state: string): { integrationId?: string; provider?: string } | null {
  try {
    const decoded = JSON.parse(Buffer.from(state, "base64url").toString());
    const { integrationId, provider, sig } = decoded;
    if (!integrationId || !provider) return null;

    const secret = process.env.OAUTH_STATE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (secret && sig) {
      const payload = `${integrationId}:${provider}`;
      const expected = createHmac("sha256", secret).update(payload).digest("hex");
      if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
        return null;
      }
    }

    return { integrationId, provider };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // QuickBooks sends realmId (Company ID) as a query param
  const realmId = searchParams.get("realmId");

  if (error) {
    return NextResponse.redirect(
      `${APP_URL}/dashboard/integrations?connection=error&message=${encodeURIComponent(error)}`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${APP_URL}/dashboard/integrations?connection=error&message=Missing+authorization+code`
    );
  }

  try {
    const stateData = verifyStateSignature(state);
    if (!stateData || !stateData.integrationId || !stateData.provider) {
      return NextResponse.redirect(
        `${APP_URL}/dashboard/integrations?connection=error&message=Invalid+or+tampered+state+parameter`
      );
    }
    const { integrationId, provider } = stateData;

    // Pass provider-specific extra params (QBO realmId, GHL locationId, etc.)
    const extraParams: Record<string, string> = {};
    if (realmId) extraParams.realmId = realmId;

    const result = await exchangeOAuthCode(code, provider, integrationId, extraParams);

    if (result.error) {
      return NextResponse.redirect(
        `${APP_URL}/dashboard/integrations?connection=error&provider=${provider}&message=${encodeURIComponent(result.error)}`
      );
    }

    return NextResponse.redirect(
      `${APP_URL}/dashboard/integrations?connection=success&provider=${provider}&id=${integrationId}`
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.redirect(
      `${APP_URL}/dashboard/integrations?connection=error&message=${encodeURIComponent(message)}`
    );
  }
}

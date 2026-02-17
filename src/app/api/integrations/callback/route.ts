import { NextRequest, NextResponse } from "next/server";
import { exchangeOAuthCode } from "@/app/actions/integration-oauth";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://iworkr-stack.vercel.app";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

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
    const stateData = JSON.parse(Buffer.from(state, "base64url").toString());
    const { integrationId, provider } = stateData;

    if (!integrationId || !provider) {
      return NextResponse.redirect(
        `${APP_URL}/dashboard/integrations?connection=error&message=Invalid+state+parameter`
      );
    }

    const result = await exchangeOAuthCode(code, provider, integrationId);

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

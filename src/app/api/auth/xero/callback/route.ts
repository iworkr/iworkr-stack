// /api/auth/xero/callback — exchanges code for tokens + stores in vault
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const XERO_TOKEN_URL = "https://identity.xero.com/connect/token";
const XERO_CONNECTIONS_URL = "https://api.xero.com/connections";
const CLIENT_ID = process.env.XERO_CLIENT_ID!;
const CLIENT_SECRET = process.env.XERO_CLIENT_SECRET!;
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/xero/callback`;

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state"); // workspace_id encoded in state
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings/integrations?error=${error ?? "no_code"}`
    );
  }

  try {
    // Exchange code for tokens
    const creds = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
    const tokenRes = await fetch(XERO_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${creds}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
      }),
    });

    if (!tokenRes.ok) {
      throw new Error(`Token exchange failed: ${tokenRes.status}`);
    }

    const tokens = await tokenRes.json();
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // Fetch connected Xero organisations (tenants)
    const connectionsRes = await fetch(XERO_CONNECTIONS_URL, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    let tenantId = "";
    let orgName = "";
    if (connectionsRes.ok) {
      const connections = await connectionsRes.json();
      const firstOrg = connections?.[0];
      tenantId = firstOrg?.tenantId ?? "";
      orgName = firstOrg?.tenantName ?? "";
    }

    // Get workspace from state or session
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    let workspaceId = state ?? null;
    if (!workspaceId) {
      const { data: membership } = await (supabase as any)
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      workspaceId = membership?.organization_id;
    }
    if (!workspaceId) throw new Error("No workspace found");

    // Store tokens
    await (supabase as any).rpc("upsert_integration_token", {
      p_workspace_id: workspaceId,
      p_provider: "XERO",
      p_access_token: tokens.access_token,
      p_refresh_token: tokens.refresh_token,
      p_external_tenant_id: tenantId,
      p_external_org_name: orgName,
      p_expires_at: expiresAt,
      p_scopes: tokens.scope ?? null,
    });

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings/integrations?connected=xero&org=${encodeURIComponent(orgName)}`
    );
  } catch (err: any) {
    console.error("Xero OAuth callback error:", err);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings/integrations?error=${encodeURIComponent(err.message)}`
    );
  }
}

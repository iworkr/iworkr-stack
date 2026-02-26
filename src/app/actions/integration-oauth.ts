"use server";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

/* ── Schemas ──────────────────────────────────────────── */

const ExchangeOAuthCodeSchema = z.object({
  code: z.string().min(1, "OAuth code is required").max(5000),
  provider: z.string().min(1).max(50),
  integrationId: z.string().uuid(),
});

const ConnectWithApiKeySchema = z.object({
  integrationId: z.string().uuid(),
  apiKey: z.string().min(1, "API key is required").max(1000),
  extraConfig: z.record(z.string(), z.unknown()).optional(),
});

const UpdateProviderSettingsSchema = z.record(z.string(), z.unknown());

/* ── OAuth Provider Config ────────────────────────────── */

const PROVIDERS: Record<string, {
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
  clientIdEnv: string;
  clientSecretEnv: string;
}> = {
  xero: {
    authUrl: "https://login.xero.com/identity/connect/authorize",
    tokenUrl: "https://identity.xero.com/connect/token",
    scopes: ["openid", "profile", "email", "accounting.transactions", "accounting.contacts", "accounting.settings.read", "offline_access"],
    clientIdEnv: "XERO_CLIENT_ID",
    clientSecretEnv: "XERO_CLIENT_SECRET",
  },
  quickbooks: {
    authUrl: "https://appcenter.intuit.com/connect/oauth2",
    tokenUrl: "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
    scopes: ["com.intuit.quickbooks.accounting", "openid", "profile", "email"],
    clientIdEnv: "QUICKBOOKS_CLIENT_ID",
    clientSecretEnv: "QUICKBOOKS_CLIENT_SECRET",
  },
  gmail: {
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: ["https://www.googleapis.com/auth/gmail.send", "https://www.googleapis.com/auth/gmail.readonly", "https://www.googleapis.com/auth/userinfo.email"],
    clientIdEnv: "GOOGLE_CLIENT_ID",
    clientSecretEnv: "GOOGLE_CLIENT_SECRET",
  },
  outlook: {
    authUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    scopes: ["Mail.Send", "Mail.Read", "User.Read", "offline_access"],
    clientIdEnv: "MICROSOFT_CLIENT_ID",
    clientSecretEnv: "MICROSOFT_CLIENT_SECRET",
  },
  google_calendar: {
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: ["https://www.googleapis.com/auth/calendar.events", "https://www.googleapis.com/auth/userinfo.email"],
    clientIdEnv: "GOOGLE_CLIENT_ID",
    clientSecretEnv: "GOOGLE_CLIENT_SECRET",
  },
  outlook_calendar: {
    authUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    scopes: ["Calendars.ReadWrite", "User.Read", "offline_access"],
    clientIdEnv: "MICROSOFT_CLIENT_ID",
    clientSecretEnv: "MICROSOFT_CLIENT_SECRET",
  },
  google_drive: {
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: ["https://www.googleapis.com/auth/drive.file", "https://www.googleapis.com/auth/userinfo.email"],
    clientIdEnv: "GOOGLE_CLIENT_ID",
    clientSecretEnv: "GOOGLE_CLIENT_SECRET",
  },
  slack: {
    authUrl: "https://slack.com/oauth/v2/authorize",
    tokenUrl: "https://slack.com/api/oauth.v2.access",
    scopes: ["chat:write", "channels:read", "incoming-webhook"],
    clientIdEnv: "SLACK_CLIENT_ID",
    clientSecretEnv: "SLACK_CLIENT_SECRET",
  },
};

if (!process.env.NEXT_PUBLIC_APP_URL) console.warn("[integration-oauth] NEXT_PUBLIC_APP_URL is not set");
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/* ── Generate OAuth URL ───────────────────────────────── */

export async function getOAuthUrl(integrationId: string, provider: string): Promise<{ url: string | null; error?: string }> {
  const config = PROVIDERS[provider];
  if (!config) {
    // For API key providers (Twilio, GHL, Google Maps), no OAuth needed
    return { url: null, error: `${provider} uses API key authentication, not OAuth` };
  }

  const clientId = process.env[config.clientIdEnv];
  if (!clientId) {
    return { url: null, error: `OAuth not configured for ${provider}. Missing ${config.clientIdEnv}.` };
  }

  const state = Buffer.from(JSON.stringify({ integrationId, provider })).toString("base64url");
  const redirectUri = `${APP_URL}/api/integrations/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: config.scopes.join(" "),
    state,
    access_type: "offline",
    prompt: "consent",
  });

  return { url: `${config.authUrl}?${params.toString()}` };
}

/* ── Exchange Code for Tokens ─────────────────────────── */

export async function exchangeOAuthCode(code: string, provider: string, integrationId: string): Promise<{ error?: string }> {
  // Validate input
  const parsed = ExchangeOAuthCodeSchema.safeParse({ code, provider, integrationId });
  if (!parsed.success) {
    return { error: parsed.error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join("; ") };
  }

  const config = PROVIDERS[provider];
  if (!config) return { error: "Unknown provider" };

  const clientId = process.env[config.clientIdEnv];
  const clientSecret = process.env[config.clientSecretEnv];
  if (!clientId || !clientSecret) return { error: "OAuth not configured" };

  const redirectUri = `${APP_URL}/api/integrations/callback`;

  try {
    // Verify the caller owns this integration
    const supabaseAuth = await createServerSupabaseClient();
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const { data: integration } = await supabaseAuth
      .from("integrations")
      .select("organization_id")
      .eq("id", integrationId)
      .maybeSingle();
    if (!integration) return { error: "Integration not found" };

    const { data: membership } = await supabaseAuth
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", integration.organization_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership) return { error: "Unauthorized" };
    const tokenRes = await fetch(config.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    const tokens = await tokenRes.json();

    if (tokens.error) {
      return { error: tokens.error_description || tokens.error };
    }

    const supabase = await createServerSupabaseClient();
    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null;

    // Fetch user info for connected_as/email
    let connectedEmail = "";
    let connectedAs = "";

    if (provider.startsWith("google") || provider === "gmail") {
      try {
        const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        const user = await userRes.json();
        connectedEmail = user.email || "";
        connectedAs = user.email || "";
      } catch { /* non-critical */ }
    } else if (provider === "xero") {
      connectedAs = "Xero Organization";
      // Xero tenant ID would be fetched from /connections endpoint
    } else if (provider === "quickbooks") {
      connectedAs = "QuickBooks Company";
    }

    await supabase
      .from("integrations")
      .update({
        status: "connected",
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || null,
        token_expires_at: expiresAt,
        connected_as: connectedAs,
        connected_email: connectedEmail,
        scopes: config.scopes,
        last_sync: new Date().toISOString(),
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", integrationId);

    revalidatePath("/dashboard/integrations");
    return {};
  } catch (err: any) {
    return { error: err.message || "Token exchange failed" };
  }
}

/* ── Refresh Token ────────────────────────────────────── */

export async function refreshIntegrationToken(integrationId: string): Promise<{ error?: string }> {
  const supabase = await createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data: int } = await supabase
    .from("integrations")
    .select("provider, refresh_token, organization_id")
    .eq("id", integrationId)
    .maybeSingle();

  if (!int?.refresh_token) return { error: "No refresh token" };

  const { data: membership } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", int.organization_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return { error: "Unauthorized" };

  const config = PROVIDERS[int.provider];
  if (!config) return { error: "Unknown provider" };

  const clientId = process.env[config.clientIdEnv];
  const clientSecret = process.env[config.clientSecretEnv];
  if (!clientId || !clientSecret) return { error: "OAuth not configured" };

  try {
    const tokenRes = await fetch(config.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: int.refresh_token,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    const tokens = await tokenRes.json();
    if (tokens.error) {
      await supabase
        .from("integrations")
        .update({ status: "error", error_message: "Token refresh failed. Re-authenticate required." })
        .eq("id", integrationId);
      return { error: tokens.error_description || "Refresh failed" };
    }

    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null;

    await supabase
      .from("integrations")
      .update({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || int.refresh_token,
        token_expires_at: expiresAt,
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", integrationId);

    return {};
  } catch (err: any) {
    return { error: err.message };
  }
}

/* ── Connect via API Key (Twilio, GHL, Google Maps) ──── */

export async function connectWithApiKey(
  integrationId: string,
  apiKey: string,
  extraConfig?: Record<string, any>
): Promise<{ error?: string }> {
  // Validate input
  const parsed = ConnectWithApiKeySchema.safeParse({ integrationId, apiKey, extraConfig });
  if (!parsed.success) {
    return { error: parsed.error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join("; ") };
  }

  const supabase = await createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data: integration } = await supabase
    .from("integrations")
    .select("organization_id")
    .eq("id", integrationId)
    .maybeSingle();
  if (!integration) return { error: "Integration not found" };

  const { data: membership } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", integration.organization_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return { error: "Unauthorized" };

  await supabase
    .from("integrations")
    .update({
      status: "connected",
      access_token: apiKey,
      connected_as: extraConfig?.connectedAs || "API Key",
      settings: extraConfig?.settings,
      last_sync: new Date().toISOString(),
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", integrationId);

  revalidatePath("/dashboard/integrations");
  return {};
}

/* ── Update Integration Settings ──────────────────────── */

export async function updateProviderSettings(
  integrationId: string,
  settings: Record<string, any>
): Promise<{ error?: string }> {
  // Validate input
  const parsed = UpdateProviderSettingsSchema.safeParse(settings);
  if (!parsed.success) {
    return { error: parsed.error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join("; ") };
  }

  const supabase = await createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  // Merge with existing settings
  const { data: current } = await supabase
    .from("integrations")
    .select("settings, organization_id")
    .eq("id", integrationId)
    .maybeSingle();
  if (!current) return { error: "Integration not found" };

  const { data: membership } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", current.organization_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return { error: "Unauthorized" };

  const merged = { ...(current?.settings || {}), ...settings };

  const { error } = await supabase
    .from("integrations")
    .update({ settings: merged, updated_at: new Date().toISOString() })
    .eq("id", integrationId);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/integrations");
  return {};
}

/* ── Disconnect ───────────────────────────────────────── */

export async function disconnectProvider(integrationId: string): Promise<{ error?: string }> {
  const supabase = await createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data: integration } = await supabase
    .from("integrations")
    .select("organization_id")
    .eq("id", integrationId)
    .maybeSingle();
  if (!integration) return { error: "Integration not found" };

  const { data: membership } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", integration.organization_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return { error: "Unauthorized" };

  const { error } = await supabase
    .from("integrations")
    .update({
      status: "disconnected",
      access_token: null,
      refresh_token: null,
      token_expires_at: null,
      connected_as: null,
      connected_email: null,
      error_message: null,
      last_sync: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", integrationId);

  if (error) return { error: error.message };
  revalidatePath("/dashboard/integrations");
  return {};
}

/* ── Get Sync Log ─────────────────────────────────────── */

export async function getSyncLog(integrationId: string, limit = 20): Promise<{ data: any[]; error?: string }> {
  const supabase = await createServerSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: [], error: "Unauthorized" };

  const { data: integration } = await supabase
    .from("integrations")
    .select("organization_id")
    .eq("id", integrationId)
    .maybeSingle();
  if (!integration) return { data: [], error: "Integration not found" };

  const { data: membership } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", integration.organization_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return { data: [], error: "Unauthorized" };

  const { data, error } = await supabase
    .from("integration_sync_log")
    .select("*")
    .eq("integration_id", integrationId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return { data: [], error: error.message };
  return { data: data || [] };
}

/* ── Log Sync Event ───────────────────────────────────── */

export async function logSyncEvent(params: {
  integration_id: string;
  organization_id: string;
  direction: "push" | "pull" | "bidirectional";
  entity_type: string;
  entity_id?: string;
  provider_entity_id?: string;
  status: "success" | "error" | "skipped";
  error_message?: string;
  metadata?: Record<string, any>;
}): Promise<void> {
  const supabase = await createServerSupabaseClient();
  await supabase.from("integration_sync_log").insert(params);
}

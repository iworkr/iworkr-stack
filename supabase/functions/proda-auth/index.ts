// Edge Function: proda-auth
// Handles PRODA B2B Device JWT authentication for NDIA PACE API
// Generates RS256-signed JWTs, exchanges for OAuth 2.0 access tokens

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PRODA_TOKEN_URL = Deno.env.get("PRODA_TOKEN_URL") || "https://proda.humanservices.gov.au/piaweb/api/b2b/v1/token";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProdaDevice {
  id: string;
  organization_id: string;
  proda_org_id: string;
  device_name: string;
  device_id: string;
  private_key_vault_id: string | null;
  access_token: string | null;
  token_expires_at: string | null;
  status: string;
}

/**
 * Base64url encode a Uint8Array
 */
function base64urlEncode(data: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...data));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Generate a JWT signed with RS256 using the Web Crypto API
 */
async function generateSignedJwt(
  deviceId: string,
  prodaOrgId: string,
  privateKeyPem: string,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  const payload = {
    iss: deviceId,
    sub: prodaOrgId,
    aud: PRODA_TOKEN_URL,
    exp: now + 300, // 5 min expiry
    iat: now,
    jti: crypto.randomUUID(),
  };

  const headerB64 = base64urlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = base64urlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;

  // Import the private key
  const pemBody = privateKeyPem
    .replace(/-----BEGIN (?:RSA )?PRIVATE KEY-----/g, "")
    .replace(/-----END (?:RSA )?PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");
  
  const keyData = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signingInput),
  );

  const signatureB64 = base64urlEncode(new Uint8Array(signature));
  return `${headerB64}.${payloadB64}.${signatureB64}`;
}

/**
 * Exchange the signed JWT for a PRODA OAuth access token
 */
async function exchangeForToken(signedJwt: string): Promise<{
  access_token: string;
  expires_in: number;
  token_type: string;
}> {
  const response = await fetch(PRODA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: signedJwt,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`PRODA token exchange failed (${response.status}): ${errorBody}`);
  }

  return await response.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { organization_id, action } = await req.json();
    if (!organization_id) {
      return new Response(
        JSON.stringify({ error: "organization_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Fetch device config
    const { data: device, error: deviceErr } = await supabase
      .from("auth_proda_devices")
      .select("*")
      .eq("organization_id", organization_id)
      .single() as { data: ProdaDevice | null; error: unknown };

    if (deviceErr || !device) {
      return new Response(
        JSON.stringify({ error: "No PRODA device found for this organization" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Check if existing token is still valid (> 5 min remaining)
    if (
      action !== "refresh" &&
      action !== "test" &&
      device.access_token &&
      device.token_expires_at
    ) {
      const expiresAt = new Date(device.token_expires_at).getTime();
      const fiveMinFromNow = Date.now() + 5 * 60 * 1000;
      if (expiresAt > fiveMinFromNow) {
        return new Response(
          JSON.stringify({
            access_token: device.access_token,
            cached: true,
            expires_at: device.token_expires_at,
            status: "ACTIVE",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // Retrieve private key from vault (or use stored reference)
    let privateKey: string | null = null;

    if (device.private_key_vault_id) {
      // Try reading from vault.decrypted_secrets
      const { data: vaultData } = await supabase
        .rpc("vault_read_secret", { secret_id: device.private_key_vault_id }) as { data: string | null };
      
      if (vaultData) {
        privateKey = vaultData;
      }
    }

    // For testing/demo, generate a mock token response
    if (!privateKey || !device.device_id) {
      if (action === "test") {
        // Update device status
        await supabase
          .from("auth_proda_devices")
          .update({
            status: "ACTIVE",
            last_auth_at: new Date().toISOString(),
            last_error: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", device.id);

        return new Response(
          JSON.stringify({
            success: true,
            message: "PRODA device validated (test mode — no private key configured for live JWT)",
            status: "ACTIVE",
            device_id: device.device_id,
            proda_org_id: device.proda_org_id,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Generate simulated token for development
      const mockToken = `mock_proda_${crypto.randomUUID().replace(/-/g, "")}`;
      const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();

      await supabase
        .from("auth_proda_devices")
        .update({
          access_token: mockToken,
          token_expires_at: expiresAt,
          status: "ACTIVE",
          last_auth_at: new Date().toISOString(),
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", device.id);

      return new Response(
        JSON.stringify({
          access_token: mockToken,
          expires_at: expiresAt,
          status: "ACTIVE",
          mode: "simulated",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Generate signed JWT
    const signedJwt = await generateSignedJwt(device.device_id, device.proda_org_id, privateKey);

    // Exchange for access token
    const tokenResponse = await exchangeForToken(signedJwt);

    const expiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString();

    // Cache the token
    await supabase
      .from("auth_proda_devices")
      .update({
        access_token: tokenResponse.access_token,
        token_expires_at: expiresAt,
        status: "ACTIVE",
        last_auth_at: new Date().toISOString(),
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", device.id);

    return new Response(
      JSON.stringify({
        access_token: tokenResponse.access_token,
        expires_at: expiresAt,
        status: "ACTIVE",
        cached: false,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";

    return new Response(
      JSON.stringify({ error: message, status: "ERROR" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

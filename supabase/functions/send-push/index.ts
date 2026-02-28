import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  Deno.env.get("APP_URL") || "https://iworkrapp.com",
  "http://localhost:3000",
];

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(req) });
  }

  try {
    const { record } = await req.json();

    if (!record?.user_id || !record?.title) {
      return new Response(JSON.stringify({ error: "Missing notification data" }), {
        status: 400,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: profile } = await supabase
      .from("profiles")
      .select("fcm_token, push_enabled")
      .eq("id", record.user_id)
      .maybeSingle();

    if (!profile?.fcm_token || profile.push_enabled === false) {
      return new Response(JSON.stringify({ skipped: true, reason: "No FCM token or push disabled" }), {
        status: 200,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // FCM v1 HTTP API requires a service account JSON for OAuth2 access tokens.
    // Falls back to legacy API if only FCM_SERVER_KEY is set.
    const fcmServiceAccount = Deno.env.get("FCM_SERVICE_ACCOUNT_JSON");
    const fcmKey = Deno.env.get("FCM_SERVER_KEY");

    if (!fcmServiceAccount && !fcmKey) {
      return new Response(JSON.stringify({ error: "FCM not configured. Set FCM_SERVICE_ACCOUNT_JSON (v1) or FCM_SERVER_KEY (legacy)." }), {
        status: 500,
        headers: { ...corsHeaders(req), "Content-Type": "application/json" },
      });
    }

    let fcmResult: Record<string, unknown>;

    if (fcmServiceAccount) {
      // ── FCM v1 HTTP API ─────────────────────────────────
      const sa = JSON.parse(fcmServiceAccount);
      const projectId = sa.project_id;

      // Build JWT for Google OAuth2
      const header = { alg: "RS256", typ: "JWT" };
      const now = Math.floor(Date.now() / 1000);
      const claim = {
        iss: sa.client_email,
        scope: "https://www.googleapis.com/auth/firebase.messaging",
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600,
      };

      const enc = new TextEncoder();
      const b64url = (data: Uint8Array) =>
        btoa(String.fromCharCode(...data))
          .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      const headerB64 = b64url(enc.encode(JSON.stringify(header)));
      const claimB64 = b64url(enc.encode(JSON.stringify(claim)));
      const sigInput = `${headerB64}.${claimB64}`;

      // Import RSA private key
      const pemBody = sa.private_key
        .replace(/-----BEGIN PRIVATE KEY-----/, "")
        .replace(/-----END PRIVATE KEY-----/, "")
        .replace(/\n/g, "");
      const binaryKey = Uint8Array.from(atob(pemBody), (c: string) => c.charCodeAt(0));
      const cryptoKey = await crypto.subtle.importKey(
        "pkcs8", binaryKey, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]
      );
      const signature = new Uint8Array(
        await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, enc.encode(sigInput))
      );
      const jwt = `${sigInput}.${b64url(signature)}`;

      // Exchange JWT for access token
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
      });
      const tokenData = await tokenRes.json();
      const accessToken = tokenData.access_token;

      // Send via FCM v1 API
      const v1Payload = {
        message: {
          token: profile.fcm_token,
          notification: {
            title: record.title,
            body: record.body || "",
          },
          data: {
            type: record.type || "general",
            action_link: record.action_link || "",
            related_job_id: record.related_job_id || "",
            notification_id: record.id || "",
          },
          android: { priority: "HIGH", notification: { sound: "default" } },
          apns: { payload: { aps: { sound: "default", badge: 1 } } },
        },
      };

      const fcmResponse = await fetch(
        `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(v1Payload),
        },
      );
      fcmResult = await fcmResponse.json();
    } else {
      // ── FCM Legacy API (fallback) ───────────────────────
      const legacyPayload = {
        to: profile.fcm_token,
        notification: {
          title: record.title,
          body: record.body || "",
          sound: "default",
          badge: "1",
        },
        data: {
          type: record.type || "general",
          action_link: record.action_link || "",
          related_job_id: record.related_job_id || "",
          notification_id: record.id || "",
        },
        priority: "high",
      };

      const fcmResponse = await fetch("https://fcm.googleapis.com/fcm/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `key=${fcmKey}`,
        },
        body: JSON.stringify(legacyPayload),
      });
      fcmResult = await fcmResponse.json();
    }

    if (record.id) {
      await supabase
        .from("notifications")
        .update({
          metadata: {
            ...(record.metadata || {}),
            fcm_sent: true,
            fcm_message_id: fcmResult.message_id || null,
          },
        })
        .eq("id", record.id);
    }

    return new Response(JSON.stringify({ success: true, fcm_result: fcmResult }), {
      status: 200,
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders(req), "Content-Type": "application/json" },
    });
  }
});

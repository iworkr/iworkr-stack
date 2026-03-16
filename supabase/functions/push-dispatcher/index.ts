// ============================================================
// push-dispatcher — Project Pulse central push notification brain
// Triggered by DB webhook on INSERT to `notifications` table.
// Replaces the simpler `send-push` function with preference-aware,
// multi-device, throttled, shift-aware push delivery.
// ============================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Types ────────────────────────────────────────────────────

interface NotificationRecord {
  id: string;
  organization_id: string;
  user_id: string;
  type: string;
  title: string;
  body?: string;
  sender_id?: string;
  sender_name?: string;
  context?: string;
  related_job_id?: string;
  related_client_id?: string;
  related_entity_type?: string;
  related_entity_id?: string;
  action_link?: string;
  metadata?: Record<string, unknown>;
  priority?: string;
  created_at?: string;
}

interface UserDevice {
  id: string;
  user_id: string;
  fcm_token: string;
  device_type: string;
  is_active: boolean;
}

interface NotificationPreferences {
  push_enabled: boolean;
  mute_chat_mentions: boolean;
  mute_shift_reminders: boolean;
  mute_announcements: boolean;
  dnd_enabled: boolean;
  dnd_start: string | null; // HH:MM or time string
  dnd_end: string | null;
  quiet_hours_respect_shifts: boolean;
}

interface FcmSendResult {
  token: string;
  success: boolean;
  message_id?: string;
  error?: string;
}

// ── CORS ─────────────────────────────────────────────────────

const ALLOWED_ORIGINS = [
  Deno.env.get("APP_URL") || "https://iworkrapp.com",
  "http://localhost:3000",
];

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  req: Request,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

// ── FCM v1 OAuth2 JWT ────────────────────────────────────────

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

async function getFcmAccessToken(
  serviceAccountJson: string,
): Promise<{ accessToken: string; projectId: string }> {
  const sa = JSON.parse(serviceAccountJson);
  const projectId: string = sa.project_id;

  // Reuse cached token if still valid (with 5-minute buffer)
  const now = Math.floor(Date.now() / 1000);
  if (cachedAccessToken && cachedAccessToken.expiresAt > now + 300) {
    return { accessToken: cachedAccessToken.token, projectId };
  }

  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const enc = new TextEncoder();
  const b64url = (data: Uint8Array): string =>
    btoa(String.fromCharCode(...data))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

  const headerB64 = b64url(enc.encode(JSON.stringify(header)));
  const claimB64 = b64url(enc.encode(JSON.stringify(claim)));
  const sigInput = `${headerB64}.${claimB64}`;

  // Import RSA private key
  const pemBody = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\n/g, "");
  const binaryKey = Uint8Array.from(atob(pemBody), (c: string) =>
    c.charCodeAt(0),
  );
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      cryptoKey,
      enc.encode(sigInput),
    ),
  );
  const jwt = `${sigInput}.${b64url(signature)}`;

  // Exchange JWT for access token
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  const tokenData = await tokenRes.json();

  if (!tokenData.access_token) {
    throw new Error(
      `OAuth2 token exchange failed: ${JSON.stringify(tokenData)}`,
    );
  }

  cachedAccessToken = {
    token: tokenData.access_token,
    expiresAt: now + (tokenData.expires_in || 3600),
  };

  return { accessToken: tokenData.access_token, projectId };
}

// ── Preference checks ────────────────────────────────────────

function shouldSkipForPreferences(
  prefs: NotificationPreferences,
  record: NotificationRecord,
): string | null {
  // Global push kill-switch
  if (prefs.push_enabled === false) {
    return "push_disabled";
  }

  const type = record.type;

  // Chat mention mute
  if (
    (type === "chat_mention" || type === "mention") &&
    prefs.mute_chat_mentions
  ) {
    return "muted_chat_mentions";
  }

  // Shift reminder mute
  if (
    (type === "nudge_clock_in" || type === "nudge_clock_out") &&
    prefs.mute_shift_reminders
  ) {
    return "muted_shift_reminders";
  }

  // Announcement mute
  if (type === "announcement" && prefs.mute_announcements) {
    return "muted_announcements";
  }

  return null;
}

function isWithinDndWindow(
  prefs: NotificationPreferences,
): boolean {
  if (!prefs.dnd_enabled || !prefs.dnd_start || !prefs.dnd_end) {
    return false;
  }

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [startH, startM] = prefs.dnd_start.split(":").map(Number);
  const [endH, endM] = prefs.dnd_end.split(":").map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  // Handle overnight DND (e.g. 22:00 → 07:00)
  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  } else {
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }
}

async function isUserOnShift(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const now = new Date().toISOString();
  // Check if user has any active or upcoming (within 30 min) shift
  const thirtyMinFromNow = new Date(
    Date.now() + 30 * 60 * 1000,
  ).toISOString();

  const { data: shifts } = await supabase
    .from("schedule_blocks")
    .select("id")
    .eq("technician_id", userId)
    .in("status", ["scheduled", "in_progress", "en_route"])
    .lte("start_time", thirtyMinFromNow)
    .gte("end_time", now)
    .limit(1);

  return (shifts?.length ?? 0) > 0;
}

// ── Throttle check ───────────────────────────────────────────

async function isThrottled(
  supabase: SupabaseClient,
  userId: string,
  notificationType: string,
): Promise<boolean> {
  const thirtySecondsAgo = new Date(Date.now() - 30_000).toISOString();

  const { data: recentPush } = await supabase
    .from("notification_push_log")
    .select("id")
    .eq("user_id", userId)
    .eq("notification_type", notificationType)
    .gte("last_push_at", thirtySecondsAgo)
    .limit(1);

  return (recentPush?.length ?? 0) > 0;
}

async function logPush(
  supabase: SupabaseClient,
  userId: string,
  notificationType: string,
  _notificationId: string,
  _deviceCount: number,
): Promise<void> {
  await supabase.from("notification_push_log").upsert(
    {
      user_id: userId,
      notification_type: notificationType,
      last_push_at: new Date().toISOString(),
      push_count: 1,
    },
    { onConflict: "user_id,notification_type" },
  );
}

// ── FCM v1 send to a single device ──────────────────────────

function buildThreadId(type: string): string {
  // Group iOS notifications by logical thread
  const threadMap: Record<string, string> = {
    mention: "chat",
    chat_mention: "chat",
    job_assigned: "jobs",
    quote_approved: "jobs",
    invoice_paid: "finance",
    schedule_conflict: "schedule",
    nudge_clock_in: "shifts",
    nudge_clock_out: "shifts",
    announcement: "announcements",
    review: "reviews",
    form_signed: "forms",
    team_invite: "team",
    system: "system",
  };
  return threadMap[type] || "general";
}

async function sendFcmToDevice(
  accessToken: string,
  projectId: string,
  device: UserDevice,
  record: NotificationRecord,
): Promise<FcmSendResult> {
  const threadId = buildThreadId(record.type);

  const payload = {
    message: {
      token: device.fcm_token,
      notification: {
        title: record.title,
        body: record.body || "",
      },
      data: {
        notification_id: record.id || "",
        type: record.type || "general",
        action_url: record.action_link || "",
        click_action: "FLUTTER_NOTIFICATION_CLICK",
        related_job_id: record.related_job_id || "",
        related_entity_type: record.related_entity_type || "",
        related_entity_id: record.related_entity_id || "",
        organization_id: record.organization_id || "",
      },
      android: {
        priority: "HIGH" as const,
        notification: {
          sound: "default",
          channel_id: `iworkr_${threadId}`,
        },
      },
      apns: {
        payload: {
          aps: {
            sound: "default",
            badge: 1,
            "thread-id": `iworkr-${threadId}`,
          },
        },
      },
    },
  };

  try {
    const res = await fetch(
      `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      },
    );

    const result = await res.json();

    if (!res.ok) {
      const errorCode =
        result?.error?.details?.[0]?.errorCode ||
        result?.error?.status ||
        "UNKNOWN";
      return {
        token: device.fcm_token,
        success: false,
        error: errorCode,
      };
    }

    return {
      token: device.fcm_token,
      success: true,
      message_id: result.name, // FCM v1 returns message name as ID
    };
  } catch (err) {
    return {
      token: device.fcm_token,
      success: false,
      error: (err as Error).message,
    };
  }
}

// ── Main handler ─────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(req) });
  }

  try {
    const body = await req.json();
    const record: NotificationRecord | undefined = body.record;

    // ── Validate payload ──────────────────────────────────
    if (!record?.user_id || !record?.title || !record?.id) {
      return jsonResponse(
        { error: "Missing required notification data (user_id, title, id)" },
        400,
        req,
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const userId = record.user_id;
    const notificationType = record.type || "general";
    const isEmergency = record.priority === "emergency_override";

    // Helper to update notification metadata with skip reason
    const markSkipped = async (reason: string) => {
      await supabase
        .from("notifications")
        .update({
          metadata: {
            ...(record.metadata || {}),
            fcm_sent: false,
            push_skipped_reason: reason,
          },
        })
        .eq("id", record.id);
    };

    // ── 1) Fetch active device tokens ─────────────────────
    const { data: devices, error: devicesError } = await supabase
      .from("user_devices")
      .select("id, user_id, fcm_token, device_type, is_active")
      .eq("user_id", userId)
      .eq("is_active", true);

    if (devicesError) {
      console.error("Error fetching devices:", devicesError.message);
      await markSkipped("device_query_error");
      return jsonResponse(
        { error: "Failed to query user devices", detail: devicesError.message },
        500,
        req,
      );
    }

    if (!devices || devices.length === 0) {
      await markSkipped("no_active_devices");
      return jsonResponse(
        { skipped: true, reason: "No active device tokens" },
        200,
        req,
      );
    }

    // ── 2) Check user notification preferences ────────────
    const { data: prefsRow } = await supabase
      .from("user_notification_preferences")
      .select(
        "push_enabled, mute_chat_mentions, mute_shift_reminders, mute_announcements, dnd_enabled, dnd_start, dnd_end, quiet_hours_respect_shifts",
      )
      .eq("user_id", userId)
      .maybeSingle();

    // Default preferences if no row exists (push enabled, nothing muted)
    const prefs: NotificationPreferences = {
      push_enabled: prefsRow?.push_enabled ?? true,
      mute_chat_mentions: prefsRow?.mute_chat_mentions ?? false,
      mute_shift_reminders: prefsRow?.mute_shift_reminders ?? false,
      mute_announcements: prefsRow?.mute_announcements ?? false,
      dnd_enabled: prefsRow?.dnd_enabled ?? false,
      dnd_start: prefsRow?.dnd_start ?? null,
      dnd_end: prefsRow?.dnd_end ?? null,
      quiet_hours_respect_shifts:
        prefsRow?.quiet_hours_respect_shifts ?? false,
    };

    // Check basic preference mutes
    const prefSkipReason = shouldSkipForPreferences(prefs, record);
    if (prefSkipReason) {
      await markSkipped(prefSkipReason);
      return jsonResponse(
        { skipped: true, reason: prefSkipReason },
        200,
        req,
      );
    }

    // Check DND window (emergency overrides DND)
    if (!isEmergency && isWithinDndWindow(prefs)) {
      await markSkipped("dnd_active");
      return jsonResponse(
        { skipped: true, reason: "dnd_active" },
        200,
        req,
      );
    }

    // Check shift-aware quiet hours
    if (
      !isEmergency &&
      prefs.quiet_hours_respect_shifts &&
      prefs.dnd_enabled
    ) {
      const onShift = await isUserOnShift(supabase, userId);
      if (!onShift) {
        await markSkipped("off_duty_quiet_hours");
        return jsonResponse(
          { skipped: true, reason: "off_duty_quiet_hours" },
          200,
          req,
        );
      }
    }

    // ── 3) Throttle / debounce ────────────────────────────
    const throttled = await isThrottled(supabase, userId, notificationType);
    if (throttled) {
      await markSkipped("throttled_30s");
      return jsonResponse(
        { skipped: true, reason: "throttled_30s" },
        200,
        req,
      );
    }

    // ── 4) Get FCM credentials ────────────────────────────
    const fcmServiceAccountJson = Deno.env.get("FCM_SERVICE_ACCOUNT_JSON");
    if (!fcmServiceAccountJson) {
      await markSkipped("fcm_not_configured");
      return jsonResponse(
        {
          error:
            "FCM not configured. Set FCM_SERVICE_ACCOUNT_JSON environment variable.",
        },
        500,
        req,
      );
    }

    const { accessToken, projectId } =
      await getFcmAccessToken(fcmServiceAccountJson);

    // ── 5) Send FCM to all active devices ─────────────────
    const results: FcmSendResult[] = await Promise.allSettled(
      devices.map((device: UserDevice) =>
        sendFcmToDevice(accessToken, projectId, device, record),
      ),
    ).then((settled) =>
      settled.map((s) =>
        s.status === "fulfilled"
          ? s.value
          : { token: "unknown", success: false, error: (s.reason as Error).message },
      ),
    );

    // ── 6) Handle stale tokens ────────────────────────────
    const staleTokenIds: string[] = [];
    for (const result of results) {
      if (
        !result.success &&
        (result.error === "NOT_FOUND" ||
          result.error === "UNREGISTERED" ||
          result.error?.includes("registration-token-not-registered"))
      ) {
        const staleDevice = devices.find(
          (d: UserDevice) => d.fcm_token === result.token,
        );
        if (staleDevice) {
          staleTokenIds.push(staleDevice.id);
        }
      }
    }

    if (staleTokenIds.length > 0) {
      await supabase
        .from("user_devices")
        .update({ is_active: false })
        .in("id", staleTokenIds);
      console.log(
        `Deactivated ${staleTokenIds.length} stale device(s) for user ${userId}`,
      );
    }

    // ── 7) Log the push for throttle tracking ─────────────
    const successCount = results.filter((r) => r.success).length;
    if (successCount > 0) {
      await logPush(
        supabase,
        userId,
        notificationType,
        record.id,
        successCount,
      );
    }

    // ── 8) Update notification metadata ───────────────────
    const messageIds = results
      .filter((r) => r.success && r.message_id)
      .map((r) => r.message_id);

    await supabase
      .from("notifications")
      .update({
        metadata: {
          ...(record.metadata || {}),
          fcm_sent: successCount > 0,
          fcm_message_ids: messageIds,
          fcm_devices_targeted: devices.length,
          fcm_devices_succeeded: successCount,
          fcm_devices_failed: devices.length - successCount,
          fcm_stale_tokens_removed: staleTokenIds.length,
          push_dispatched_at: new Date().toISOString(),
        },
      })
      .eq("id", record.id);

    return jsonResponse(
      {
        success: true,
        devices_targeted: devices.length,
        devices_succeeded: successCount,
        devices_failed: devices.length - successCount,
        stale_tokens_removed: staleTokenIds.length,
        message_ids: messageIds,
      },
      200,
      req,
    );
  } catch (err) {
    console.error("push-dispatcher fatal error:", err);
    return jsonResponse({ error: (err as Error).message }, 500, req);
  }
});

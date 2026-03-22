import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Google Calendar Push Notification webhook.
 *
 * Google sends a POST with headers (not body) containing:
 *   X-Goog-Channel-ID   — our channel UUID
 *   X-Goog-Resource-ID  — Google's resource identifier
 *   X-Goog-Resource-State — "sync" (initial) or "exists" (change)
 *
 * The payload does NOT contain the event data. We must use the
 * stored access token to fetch the incremental sync via syncToken.
 */
export async function POST(req: NextRequest) {
  const channelId = req.headers.get("x-goog-channel-id");
  const resourceState = req.headers.get("x-goog-resource-state");
  const channelToken = req.headers.get("x-goog-channel-token");

  if (!channelId) {
    return NextResponse.json({ error: "Missing channel ID" }, { status: 400 });
  }

  // ── Aegis: Verify channel token matches what we registered ──
  // Google sends back the token we provided during channel creation.
  // This prevents spoofed notifications from arbitrary sources.
  if (channelToken) {
    const expectedToken = process.env.GOOGLE_WEBHOOK_CHANNEL_TOKEN;
    if (expectedToken && channelToken !== expectedToken) {
      console.warn("[Google Cal] Channel token mismatch — rejecting");
      return NextResponse.json({ error: "Invalid channel token" }, { status: 401 });
    }
  }

  // Initial sync notification — just acknowledge
  if (resourceState === "sync") {
    return NextResponse.json({ ok: true });
  }

  try {
    // Look up the channel to find the integration
    const { data: channel } = await supabaseAdmin
      .from("google_calendar_channels")
      .select("*, integrations:integration_id(id, access_token, refresh_token, token_expires_at, organization_id)")
      .eq("channel_id", channelId)
      .maybeSingle();

    if (!channel) {
      return NextResponse.json({ error: "Unknown channel" }, { status: 404 });
    }

    const integration = channel.integrations as Record<string, unknown> | null;
    if (!integration?.access_token) {
      return NextResponse.json({ error: "No token" }, { status: 401 });
    }

    // Decrypt access token
    const { decrypt } = await import("@/lib/encryption");
    let accessToken = decrypt(integration.access_token as string);

    // Check token expiry — refresh if needed
    const expiresAt = integration.token_expires_at
      ? new Date(integration.token_expires_at as string)
      : null;
    if (expiresAt && expiresAt < new Date()) {
      const refreshed = await refreshGoogleToken(
        integration.id as string,
        decrypt(integration.refresh_token as string)
      );
      if (refreshed) accessToken = refreshed;
    }

    // Fetch incremental changes using syncToken
    const calendarId = channel.calendar_id || "primary";
    const syncToken = channel.sync_token;

    const params = new URLSearchParams();
    if (syncToken) {
      params.set("syncToken", syncToken);
    } else {
      // First sync: only get future events
      params.set("timeMin", new Date().toISOString());
      params.set("singleEvents", "true");
    }

    const eventsRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!eventsRes.ok) {
      if (eventsRes.status === 410) {
        // syncToken expired — clear it so next notification does a full sync
        await supabaseAdmin
          .from("google_calendar_channels")
          .update({ sync_token: null, updated_at: new Date().toISOString() })
          .eq("id", channel.id);
      }
      return NextResponse.json({ error: "Calendar API error" }, { status: 502 });
    }

    const eventsData = await eventsRes.json();

    // Store the new syncToken for next incremental fetch
    if (eventsData.nextSyncToken) {
      await supabaseAdmin
        .from("google_calendar_channels")
        .update({
          sync_token: eventsData.nextSyncToken,
          updated_at: new Date().toISOString(),
        })
        .eq("id", channel.id);
    }

    // Process each changed event — upsert into schedule_blocks
    const orgId = integration.organization_id as string;
    const items = (eventsData.items || []) as Record<string, unknown>[];

    for (const event of items) {
      if (event.status === "cancelled") {
        // Delete the corresponding schedule block
        await supabaseAdmin
          .from("schedule_blocks")
          .update({ status: "cancelled", updated_at: new Date().toISOString() })
          .eq("organization_id", orgId)
          .eq("external_id", `gcal:${event.id}`);
        continue;
      }

      const start = (event.start as Record<string, string>)?.dateTime ?? (event.start as Record<string, string>)?.date;
      const end = (event.end as Record<string, string>)?.dateTime ?? (event.end as Record<string, string>)?.date;
      if (!start || !end) continue;

      await supabaseAdmin
        .from("schedule_blocks")
        .upsert(
          {
            organization_id: orgId,
            external_id: `gcal:${event.id}`,
            title: (event.summary as string) ?? "Google Calendar Event",
            start_time: start,
            end_time: end,
            location: (event.location as string) ?? null,
            notes: (event.description as string) ?? null,
            status: "scheduled",
            source: "google_calendar",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "organization_id,external_id" }
        );
    }

    return NextResponse.json({ processed: items.length });
  } catch (err) {
    console.error("Google Calendar webhook error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

async function refreshGoogleToken(integrationId: string, refreshToken: string): Promise<string | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret || !refreshToken) return null;

  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    const data = await res.json();
    if (data.access_token) {
      const { encrypt } = await import("@/lib/encryption");
      const expiresAt = new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString();

      await supabaseAdmin
        .from("integrations")
        .update({
          access_token: encrypt(data.access_token),
          token_expires_at: expiresAt,
          last_refresh_at: new Date().toISOString(),
          refresh_failure_count: 0,
          updated_at: new Date().toISOString(),
        } as Record<string, unknown>)
        .eq("id", integrationId);

      return data.access_token;
    }
  } catch {
    // Refresh failed — will be retried on next webhook
  }
  return null;
}

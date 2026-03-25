/**
 * @module intake-router
 * @status COMPLETE
 * @auth UNSECURED — Public-facing, unauthenticated endpoint for widget submissions
 * @description Project Gateway-Intake: Autonomous lead routing engine.
 *   Validates origin, rate limits, deduplicates CRM, geocodes address,
 *   assigns territory via PostGIS, and dispatches alerts via Hermes-Matrix.
 * @dependencies Mapbox Geocoding, Upstash Redis, PostGIS, Hermes-Matrix
 * @lastAudit 2026-03-24
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MAPBOX_TOKEN = Deno.env.get("MAPBOX_ACCESS_TOKEN") || Deno.env.get("MAPBOX_SECRET_KEY") || "";
const UPSTASH_URL = Deno.env.get("UPSTASH_REDIS_REST_URL") || "";
const UPSTASH_TOKEN = Deno.env.get("UPSTASH_REDIS_REST_TOKEN") || "";

// ─── Rate Limiting (Upstash Redis) ───────────────────────────────────────────

const inMemoryStore = new Map<string, { count: number; resetAt: number }>();

async function checkRateLimit(ip: string, limit = 5, windowSec = 3600): Promise<boolean> {
  if (UPSTASH_URL && UPSTASH_TOKEN) {
    try {
      const key = `gw:${ip}`;
      const windowMs = windowSec * 1000;
      const pipeline = [["INCR", key], ["PTTL", key]];
      const res = await fetch(`${UPSTASH_URL}/pipeline`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${UPSTASH_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(pipeline),
      });
      const results = (await res.json()) as Array<{ result: number }>;
      const count = results[0].result;
      const ttl = results[1].result;

      if (count === 1 || ttl < 0) {
        await fetch(`${UPSTASH_URL}/PEXPIRE/${encodeURIComponent(key)}/${windowMs}`, {
          method: "GET",
          headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
        });
      }
      return count <= limit;
    } catch {
      return true; // Fail open
    }
  }

  // In-memory fallback
  const now = Date.now();
  const key = `gw:${ip}`;
  let entry = inMemoryStore.get(key);
  if (!entry || entry.resetAt < now) {
    entry = { count: 0, resetAt: now + windowSec * 1000 };
    inMemoryStore.set(key, entry);
  }
  entry.count++;
  return entry.count <= limit;
}

// ─── Mapbox Geocoding ────────────────────────────────────────────────────────

interface GeoResult {
  lng: number;
  lat: number;
}

async function geocodeAddress(address: string): Promise<GeoResult | null> {
  if (!MAPBOX_TOKEN || !address.trim()) return null;

  try {
    const encoded = encodeURIComponent(address.trim());
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?access_token=${MAPBOX_TOKEN}&country=au&limit=1`
    );
    if (!res.ok) return null;

    const data = await res.json();
    const coords = data.features?.[0]?.center;
    if (!coords || coords.length < 2) return null;

    return { lng: coords[0], lat: coords[1] };
  } catch {
    return null;
  }
}

// ─── Hermes-Matrix Dispatch ──────────────────────────────────────────────────

async function fireDispatchEvent(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string,
  eventType: string,
  recipientPhone: string | null,
  recipientEmail: string | null,
  templateVars: Record<string, string>,
) {
  try {
    // Check if there's a dispatch rule configured
    const { data: rule } = await supabase.rpc("check_dispatch_rule", {
      p_workspace_id: workspaceId,
      p_event_type: eventType,
    });

    if (!rule?.found) return;

    // SMS for urgent leads
    if (rule.enable_sms && recipientPhone) {
      const smsBody = (rule.sms_template || "New {{urgency}} lead from {{name}} at {{address}}")
        .replace(/\{\{(\w+)\}\}/g, (_: string, key: string) => templateVars[key] || `{{${key}}}`);

      await supabase.rpc("log_dispatch_event", {
        p_workspace_id: workspaceId,
        p_event_type: eventType,
        p_channel: "sms",
        p_to_address: recipientPhone,
        p_subject: null,
        p_body_preview: smsBody.slice(0, 500),
        p_client_id: null,
        p_job_id: null,
        p_worker_id: null,
        p_status: "queued",
      });
    }

    // Email auto-responder to lead
    if (rule.enable_email && recipientEmail) {
      await supabase.rpc("log_dispatch_event", {
        p_workspace_id: workspaceId,
        p_event_type: eventType,
        p_channel: "email",
        p_to_address: recipientEmail,
        p_subject: `We received your request`,
        p_body_preview: `Hi ${templateVars.name}, we have received your request and will be in touch shortly.`,
        p_client_id: null,
        p_job_id: null,
        p_worker_id: null,
        p_status: "sent",
      });
    }
  } catch (err) {
    console.error("[intake-router] Dispatch failed (non-fatal):", err);
  }
}

// ─── Realtime Broadcast ──────────────────────────────────────────────────────

async function broadcastNewLead(
  workspaceId: string,
  leadId: string,
  firstName: string,
  urgency: string,
) {
  try {
    await fetch(`${SUPABASE_URL}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SERVICE_KEY}`,
        apikey: SERVICE_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channel: `leads:${workspaceId}`,
        type: "broadcast",
        event: "new_lead",
        payload: { lead_id: leadId, first_name: firstName, urgency },
      }),
    });
  } catch {
    // Best effort
  }
}

// ─── Main Handler ────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const corsHeaders: Record<string, string> = {
    "Access-Control-Allow-Headers": "content-type, x-widget-token",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  // Preflight
  if (req.method === "OPTIONS") {
    const origin = req.headers.get("origin") || "";
    corsHeaders["Access-Control-Allow-Origin"] = origin;
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const body = await req.json();
    const origin = req.headers.get("origin") || "";
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
               req.headers.get("x-real-ip") || "unknown";

    const widgetId: string = body.widget_id;
    const embedToken: string = body.embed_token;

    if (!widgetId && !embedToken) {
      return new Response(JSON.stringify({ error: "Missing widget identifier" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Step 1: Fetch Widget Config & Validate Origin ───────────────────
    let widgetQuery = supabase
      .from("intake_widgets")
      .select("id, organization_id, allowed_domains, config_jsonb, sector, is_active");

    if (embedToken) {
      widgetQuery = widgetQuery.eq("embed_token", embedToken);
    } else {
      widgetQuery = widgetQuery.eq("id", widgetId);
    }

    const { data: widget, error: widgetError } = await widgetQuery.maybeSingle();

    if (widgetError || !widget || !widget.is_active) {
      return new Response(JSON.stringify({ error: "Widget not found or inactive" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // CORS domain whitelisting
    const allowedDomains: string[] = widget.allowed_domains || [];
    const originHost = origin.replace(/^https?:\/\//, "").replace(/:\d+$/, "");
    const domainAllowed = allowedDomains.length === 0 ||
      allowedDomains.some((d: string) => originHost === d || originHost.endsWith(`.${d}`));

    if (!domainAllowed) {
      corsHeaders["Access-Control-Allow-Origin"] = "null";
      return new Response(JSON.stringify({ error: "Domain not authorized" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    corsHeaders["Access-Control-Allow-Origin"] = origin;

    // ─── Step 2: Rate Limiting ───────────────────────────────────────────
    const allowed = await checkRateLimit(ip, 5, 3600);
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Step 3: Honeypot Check ──────────────────────────────────────────
    if (body.website && String(body.website).trim()) {
      // Bot detected — silently accept but discard
      return new Response(JSON.stringify({ success: true, lead_id: "00000000-0000-0000-0000-000000000000" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Step 4: Validate Required Fields ────────────────────────────────
    const firstName = String(body.first_name || "").trim();
    const lastName = String(body.last_name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const phone = String(body.phone || "").trim();
    const addressString = String(body.address || "").trim();
    const urgency = (["LOW", "STANDARD", "URGENT", "EMERGENCY"].includes(body.urgency))
      ? body.urgency : "STANDARD";

    if (!firstName || !lastName) {
      return new Response(JSON.stringify({ error: "Name is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!email && !phone) {
      return new Response(JSON.stringify({ error: "Email or phone is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Step 5: CRM Deduplication ───────────────────────────────────────
    let clientId: string | null = null;

    if (email || phone) {
      const conditions: string[] = [];
      if (email) conditions.push(`email.ilike.${email}`);
      if (phone) conditions.push(`phone.eq.${phone}`);

      const { data: existingClient } = await supabase
        .from("clients")
        .select("id")
        .eq("organization_id", widget.organization_id)
        .or(conditions.join(","))
        .limit(1)
        .maybeSingle();

      if (existingClient) {
        clientId = existingClient.id;
      }
    }

    // If no existing client, create one
    if (!clientId) {
      const { data: newClient } = await supabase
        .from("clients")
        .insert({
          organization_id: widget.organization_id,
          name: `${firstName} ${lastName}`,
          email: email || null,
          phone: phone || null,
          address: addressString || null,
          status: "lead",
          lead_source: "widget",
          pipeline_status: "new_lead",
          type: "residential",
        })
        .select("id")
        .single();

      clientId = newClient?.id || null;
    }

    // ─── Step 6: Geocoding & Territory Assignment ────────────────────────
    let locationPoint: string | null = null;
    let territoryId: string | null = null;
    let geoLat: number | null = null;
    let geoLng: number | null = null;

    if (addressString) {
      const geo = await geocodeAddress(addressString);
      if (geo) {
        geoLng = geo.lng;
        geoLat = geo.lat;
        locationPoint = `SRID=4326;POINT(${geo.lng} ${geo.lat})`;

        // Update client with coordinates if we created them
        if (clientId) {
          await supabase
            .from("clients")
            .update({ address: addressString, address_lat: geo.lat, address_lng: geo.lng })
            .eq("id", clientId);
        }

        // Territory matching via PostGIS RPC
        const { data: matchedTerritory } = await supabase.rpc("match_territory_zone", {
          p_organization_id: widget.organization_id,
          p_lng: geo.lng,
          p_lat: geo.lat,
        });

        if (matchedTerritory) {
          territoryId = matchedTerritory;
        }
      }
    }

    // ─── Step 7: Insert Lead ─────────────────────────────────────────────
    const capturedData = body.captured_data || body.custom_fields || {};
    const mediaUrls = Array.isArray(body.media_urls) ? body.media_urls : [];

    const leadInsert: Record<string, unknown> = {
      organization_id: widget.organization_id,
      widget_id: widget.id,
      client_id: clientId,
      territory_id: territoryId,
      status: "NEW",
      urgency,
      first_name: firstName,
      last_name: lastName,
      email: email || null,
      phone: phone || null,
      address_string: addressString || null,
      captured_data: capturedData,
      media_urls: mediaUrls,
      source_domain: originHost || null,
      source_ip: ip,
    };

    if (locationPoint) {
      leadInsert.location = locationPoint;
    }

    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .insert(leadInsert)
      .select("id")
      .single();

    if (leadError) {
      console.error("[intake-router] Lead insert failed:", leadError);
      return new Response(JSON.stringify({ error: "Failed to save lead" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Step 8: Increment Widget Counter ────────────────────────────────
    await supabase.rpc("increment_widget_submissions", { p_widget_id: widget.id });

    // ─── Step 9: Realtime Broadcast ──────────────────────────────────────
    broadcastNewLead(widget.organization_id, lead.id, firstName, urgency);

    // ─── Step 10: Hermes-Matrix Dispatch ─────────────────────────────────
    const dispatchEventType = urgency === "EMERGENCY"
      ? "URGENT_LEAD_RECEIVED"
      : "NEW_LEAD_RECEIVED";

    // Fetch territory dispatcher phone for emergency SMS
    let dispatcherPhone: string | null = null;
    if (territoryId && urgency === "EMERGENCY") {
      const { data: territory } = await supabase
        .from("territory_zones")
        .select("assigned_user_id, profiles!territory_zones_assigned_user_id_fkey(phone)")
        .eq("id", territoryId)
        .maybeSingle();

      dispatcherPhone = (territory as any)?.profiles?.phone || null;
    }

    fireDispatchEvent(supabase, widget.organization_id, dispatchEventType, dispatcherPhone, email, {
      name: `${firstName} ${lastName}`,
      urgency,
      address: addressString || "No address",
      phone: phone || "N/A",
      email: email || "N/A",
    });

    return new Response(
      JSON.stringify({
        success: true,
        lead_id: lead.id,
        client_id: clientId,
        territory_id: territoryId,
        is_returning_client: !!clientId && clientId !== null,
        geocoded: !!geoLat,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[intake-router] Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});

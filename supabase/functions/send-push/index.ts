import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { record } = await req.json();

    if (!record?.user_id || !record?.title) {
      return new Response(JSON.stringify({ error: "Missing notification data" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fcmKey = Deno.env.get("FCM_SERVER_KEY");
    if (!fcmKey) {
      return new Response(JSON.stringify({ error: "FCM_SERVER_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fcmPayload = {
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
      body: JSON.stringify(fcmPayload),
    });

    const fcmResult = await fcmResponse.json();

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
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function isCritical(errorType: string, errorMessage: string): boolean {
  const signature = `${errorType} ${errorMessage}`.toUpperCase();
  return signature.includes("PGRST");
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const record = body?.record ?? {};

    const errorType = String(record.error_type ?? "");
    const errorMessage = String(record.error_message ?? "");
    const critical = isCritical(errorType, errorMessage);

    // Best-effort external notification hook.
    // If TELEMETRY_ALERT_WEBHOOK_URL is absent, we still return success.
    const webhookUrl = Deno.env.get("TELEMETRY_ALERT_WEBHOOK_URL");
    if (critical && webhookUrl) {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: "iWorkr mobile critical telemetry event detected",
          severity: "critical",
          source: "process-telemetry-alert",
          event: {
            id: record.id,
            organization_id: record.organization_id,
            worker_id: record.worker_id,
            error_type: errorType,
            error_message: errorMessage,
            app_version: record.app_version,
            created_at: record.created_at,
          },
        }),
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        critical,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: (error as Error).message,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});


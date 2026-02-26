import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const APP_URL = Deno.env.get("APP_URL") || "https://app.iworkrapp.com";
const FROM_ADDRESS = "iWorkr <noreply@iworkrapp.com>";
const MAX_RETRIES = 5;
const BATCH_SIZE = 20;

const ALLOWED_ORIGINS = [
  Deno.env.get("APP_URL") || "https://iworkrapp.com",
  "http://localhost:3000",
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

// ── Helpers ──────────────────────────────────────────────────────

function jsonResponse(req: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
  });
}

function serviceClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

function parseTemplate(
  template: string,
  vars: Record<string, unknown>,
): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, path) => {
    const keys = path.trim().split(".");
    let val: unknown = vars;
    for (const k of keys) {
      if (val && typeof val === "object")
        val = (val as Record<string, unknown>)[k];
      else return "";
    }
    return String(val ?? "");
  });
}

function getLuminance(hex: string): number {
  const rgb =
    hex
      .replace("#", "")
      .match(/.{2}/g)
      ?.map((x) => parseInt(x, 16) / 255) || [0, 0, 0];
  const [r, g, b] = rgb.map((c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4),
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function getCtaForEvent(
  eventType: string,
  payload: Record<string, unknown>,
  appUrl: string,
): { url: string; label: string } | null {
  switch (eventType) {
    case "job_assigned":
    case "job_rescheduled":
    case "job_reminder_24h":
    case "job_reminder_1h":
      return {
        url: `${appUrl}/dashboard/jobs/${payload.job_id}`,
        label: "View Job Details →",
      };
    case "invite_user":
      return {
        url: String(payload.invite_url || `${appUrl}/accept-invite`),
        label: "Accept Invitation →",
      };
    case "daily_fleet_digest":
      return { url: `${appUrl}/dashboard`, label: "Open Dashboard →" };
    case "compliance_warning_swms":
      return {
        url: `${appUrl}/dashboard/jobs/${payload.job_id}`,
        label: "Review Job →",
      };
    default:
      return null;
  }
}

// ── Default Templates ────────────────────────────────────────────

const DEFAULT_TEMPLATES: Record<string, { subject: string; body: string }> = {
  job_assigned: {
    subject: "New Job Assigned: {{job.title}}",
    body: "Hey {{tech.name}}, you've been assigned a new job.\n\nJob: {{job.title}}\nClient: {{client.name}}\nAddress: {{client.address}}\nDate: {{job.date}}\n\nOpen the app to view full details.",
  },
  job_cancelled: {
    subject: "CANCELLED: {{job.title}}",
    body: "Hey {{tech.name}}, the following job has been cancelled:\n\n{{job.title}}\n\nPlease do not travel to the site.",
  },
  job_rescheduled: {
    subject: "Schedule Update: {{job.title}}",
    body: "Hey {{tech.name}}, your job has been rescheduled.\n\nJob: {{job.title}}\nNew Date: {{job.date}}\n\nPlease update your schedule accordingly.",
  },
  job_reminder_24h: {
    subject: "Reminder: Job tomorrow — {{job.title}}",
    body: "Hey {{tech.name}}, you have a job scheduled for tomorrow.\n\nJob: {{job.title}}\nLocation: {{job.location}}\nDate: {{job.date}}\n\nPlease ensure you have reviewed the necessary tools and assets required.",
  },
  job_reminder_1h: {
    subject: "Departure Alert: {{job.title}} — today",
    body: "Hey {{tech.name}}, your job at {{job.location}} is today.\n\nTap below to open navigation and update your status.",
  },
  invite_user: {
    subject: "You've been invited to join {{workspace.name}}",
    body: "You've been invited to join {{workspace.name}} on iWorkr.\n\nRole: {{invite.role}}\n\nClick the button below to accept.",
  },
  daily_fleet_digest: {
    subject: "Daily Operations Brief: {{date}}",
    body: "Good morning. Here's your daily operations summary for {{workspace.name}}.",
  },
  compliance_warning_swms: {
    subject: "⚠️ COMPLIANCE: Job {{job.id}} started without SWMS",
    body: "Technician {{tech.name}} has started Job {{job.id}} without a signed Safe Work Method Statement. Please review immediately.",
  },
};

// ── HTML Email Builder ───────────────────────────────────────────

function buildEmailHtml(params: {
  body: string;
  brandColor: string;
  logoUrl: string | null;
  workspaceName: string;
  ctaUrl?: string;
  ctaLabel?: string;
}): string {
  const textColor =
    getLuminance(params.brandColor) > 0.5 ? "#000000" : "#FFFFFF";
  const escapedBody = params.body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");

  const logoBlock = params.logoUrl
    ? `<img src="${params.logoUrl}" alt="${params.workspaceName}" style="height:36px;max-width:180px;object-fit:contain;" />`
    : `<span style="font-size:18px;font-weight:700;color:#FAFAFA;letter-spacing:-0.025em;">${params.workspaceName}</span>`;

  const ctaBlock =
    params.ctaUrl && params.ctaLabel
      ? `
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px auto 0;">
        <tr>
          <td style="border-radius:10px;background:${params.brandColor};">
            <a href="${params.ctaUrl}" target="_blank" style="display:inline-block;padding:14px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;font-weight:600;color:${textColor};text-decoration:none;letter-spacing:0.01em;">
              ${params.ctaLabel}
            </a>
          </td>
        </tr>
      </table>`
      : "";

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="dark" />
  <meta name="supported-color-schemes" content="dark" />
  <title>${params.workspaceName}</title>
  <!--[if mso]><xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
  <style>
    :root { color-scheme: dark; }
    body, table, td { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }
    body { margin: 0; padding: 0; width: 100%; background-color: #000000; -webkit-text-size-adjust: 100%; }
    img { border: 0; display: block; }
    a { color: ${params.brandColor}; }
    @media (prefers-color-scheme: dark) {
      body { background-color: #000000 !important; }
      .card { background-color: #09090b !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#000000;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#000000;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="520" style="max-width:520px;width:100%;">

          <!-- Logo / Workspace Header -->
          <tr>
            <td align="center" style="padding:0 0 24px;">
              ${logoBlock}
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td class="card" style="background-color:#09090b;border-radius:16px;border:1px solid #27272a;padding:36px 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="color:#E4E4E7;font-size:15px;line-height:1.7;">
                    ${escapedBody}
                  </td>
                </tr>
                <tr>
                  <td>
                    ${ctaBlock}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:28px 0 0;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-bottom:8px;">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="width:16px;height:2px;background:${params.brandColor};border-radius:1px;"></td>
                        <td style="width:6px;"></td>
                        <td style="width:6px;height:2px;background:#3F3F46;border-radius:1px;"></td>
                        <td style="width:6px;"></td>
                        <td style="width:6px;height:2px;background:#3F3F46;border-radius:1px;"></td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="color:#52525B;font-size:12px;text-align:center;line-height:1.5;">
                    Powered by <a href="https://iworkrapp.com" target="_blank" style="color:#71717A;text-decoration:none;font-weight:500;">iWorkr</a>
                  </td>
                </tr>
                <tr>
                  <td style="color:#3F3F46;font-size:11px;text-align:center;padding-top:6px;">
                    Sent on behalf of ${params.workspaceName}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ── Main Handler ─────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  if (req.method !== "POST") {
    return jsonResponse(req, { error: "Method not allowed" }, 405);
  }

  const supabase = serviceClient();
  const stats = { processed: 0, sent: 0, failed: 0 };

  try {
    // 1. Fetch pending items
    const { data: queue, error: fetchErr } = await supabase
      .from("mail_queue")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchErr) throw fetchErr;
    if (!queue || queue.length === 0) {
      return jsonResponse(req, { ...stats, message: "No pending mail" });
    }

    const queueIds = queue.map((item: Record<string, unknown>) => item.id);

    // 2. Lock the batch
    await supabase
      .from("mail_queue")
      .update({ status: "processing" })
      .in("id", queueIds);

    // 3. Process each item
    for (const item of queue) {
      stats.processed++;

      try {
        const payload = (item.payload as Record<string, unknown>) ?? {};
        const recipientEmail = item.recipient_email as string;
        const eventType = item.event_type as string;
        const orgId = item.organization_id as string;

        // 5a. Check for bounced recipient
        const { data: profile } = await supabase
          .from("profiles")
          .select("email_bounced")
          .eq("email", recipientEmail)
          .maybeSingle();

        if (profile?.email_bounced) {
          await supabase
            .from("mail_queue")
            .update({ status: "failed_fatal", error_message: "Recipient email bounced", processed_at: new Date().toISOString() })
            .eq("id", item.id);
          stats.failed++;
          continue;
        }

        // 5b. Fetch workspace brand data
        let workspaceName = "iWorkr";
        let brandColor = "#10B981";
        let logoUrl: string | null = null;

        if (orgId) {
          const { data: org } = await supabase
            .from("organizations")
            .select("name, logo_url, settings")
            .eq("id", orgId)
            .single();

          if (org) {
            workspaceName = org.name || workspaceName;
            logoUrl = org.logo_url || null;
          }

          const { data: brandKit } = await supabase
            .from("brand_kits")
            .select("primary_color, accent_color, logo_url")
            .eq("organization_id", orgId)
            .eq("is_active", true)
            .maybeSingle();

          if (brandKit) {
            brandColor = brandKit.primary_color || brandColor;
            if (brandKit.logo_url) logoUrl = brandKit.logo_url;
          }
        }

        // 5c. Check for custom template
        let subjectTemplate: string | undefined;
        let bodyTemplate: string | undefined;

        if (orgId) {
          const { data: customTemplate } = await supabase
            .from("workspace_email_templates")
            .select("subject_line, body_html, is_active")
            .eq("event_type", eventType)
            .eq("organization_id", orgId)
            .maybeSingle();

          if (customTemplate?.is_active === false) {
            await supabase.from("mail_queue").delete().eq("id", item.id);
            continue;
          }

          if (customTemplate) {
            subjectTemplate = customTemplate.subject_line;
            bodyTemplate = customTemplate.body_html;
          }
        }

        // 5d. Fall back to defaults
        const defaults = DEFAULT_TEMPLATES[eventType];
        if (!subjectTemplate) {
          subjectTemplate = defaults?.subject ?? eventType;
        }
        if (!bodyTemplate) {
          bodyTemplate = defaults?.body ?? "";
        }

        // 5e. Parse handlebars variables
        const templateVars: Record<string, unknown> = {
          ...payload,
          workspace: { name: workspaceName },
        };

        const subject = parseTemplate(subjectTemplate, templateVars);
        const bodyText = parseTemplate(bodyTemplate, templateVars);

        // 5f. Build HTML & get CTA
        const cta = getCtaForEvent(eventType, payload, APP_URL);

        const html = buildEmailHtml({
          body: bodyText,
          brandColor,
          logoUrl,
          workspaceName,
          ctaUrl: cta?.url,
          ctaLabel: cta?.label,
        });

        const emailLogId = crypto.randomUUID();

        const resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: FROM_ADDRESS,
            to: [recipientEmail],
            subject,
            html,
            tags: [
              { name: "email_log_id", value: emailLogId },
              { name: "event", value: eventType },
            ],
          }),
        });

        if (!resendRes.ok) {
          const errBody = await resendRes.text();
          throw new Error(`Resend ${resendRes.status}: ${errBody}`);
        }

        const resendData = (await resendRes.json()) as Record<string, unknown>;

        await supabase.from("mail_queue").delete().eq("id", item.id);

        await supabase.from("email_logs").insert({
          id: emailLogId,
          organization_id: orgId || null,
          recipient_email: recipientEmail,
          event_type: eventType,
          subject,
          status: "sent",
          resend_id: (resendData.id as string) || null,
          job_id: (payload.job_id as string) || null,
          metadata: {},
          sent_at: new Date().toISOString(),
        });

        stats.sent++;
      } catch (sendErr) {
        console.error(`Failed to send mail_queue item ${item.id}:`, sendErr);

        const retryCount = ((item.retry_count as number) || 0) + 1;
        const newStatus = retryCount > MAX_RETRIES ? "failed_fatal" : "pending";

        await supabase
          .from("mail_queue")
          .update({
            status: newStatus,
            retry_count: retryCount,
            error_message: String(sendErr),
            processed_at: new Date().toISOString(),
          })
          .eq("id", item.id);

        stats.failed++;
      }
    }

    console.log(
      `process-mail complete: ${stats.processed} processed, ${stats.sent} sent, ${stats.failed} failed`,
    );

    return jsonResponse(req, stats);
  } catch (err) {
    console.error("process-mail fatal error:", err);
    return jsonResponse(req, { error: (err as Error).message, ...stats }, 500);
  }
});

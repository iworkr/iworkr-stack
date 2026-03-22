/**
 * @module inbound-email-webhook
 * @status COMPLETE
 * @auth UNSECURED — Webhook endpoint, no auth header required (SendGrid calls this)
 * @description Handles SendGrid Inbound Parse webhooks: parses email, thread-matches, logs communication, stores attachments
 * @dependencies Supabase (RPC: log_communication, Storage: email-attachments), SendGrid
 * @lastAudit 2026-03-22
 */

// ============================================================================
// Inbound Email Webhook — Edge Function
// ============================================================================
// Handles SendGrid Inbound Parse webhooks for incoming emails. Parses the
// email, extracts job context from the address, performs thread matching,
// logs the communication, stores email thread data, and handles attachments.
// ============================================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── Config ──────────────────────────────────────────────────────────────
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ─── Parse form-urlencoded body ──────────────────────────────────────────
function parseFormBody(body: string): Record<string, string> {
  const params: Record<string, string> = {};
  const pairs = body.split("&");
  for (const pair of pairs) {
    const [key, ...valueParts] = pair.split("=");
    if (key) {
      params[decodeURIComponent(key)] = decodeURIComponent(
        valueParts.join("=").replace(/\+/g, " ")
      );
    }
  }
  return params;
}

// ─── Parse multipart form data ───────────────────────────────────────────
function parseMultipartFormData(
  body: Uint8Array,
  boundary: string
): Record<string, string> {
  const decoder = new TextDecoder();
  const text = decoder.decode(body);
  const params: Record<string, string> = {};

  const parts = text.split(`--${boundary}`);
  for (const part of parts) {
    if (part.trim() === "" || part.trim() === "--") continue;

    const headerEnd = part.indexOf("\r\n\r\n");
    if (headerEnd === -1) continue;

    const headers = part.substring(0, headerEnd);
    const content = part.substring(headerEnd + 4).replace(/\r\n$/, "");

    // Extract field name from Content-Disposition
    const nameMatch = headers.match(/name="([^"]+)"/);
    if (nameMatch) {
      params[nameMatch[1]] = content;
    }
  }

  return params;
}

// ─── Extract email address from "Name <email>" format ────────────────────
function extractEmail(raw: string): string {
  const match = raw.match(/<([^>]+)>/);
  return match ? match[1].toLowerCase() : raw.trim().toLowerCase();
}

// ─── Extract sender name from "Name <email>" format ──────────────────────
function extractSenderName(raw: string): string {
  const match = raw.match(/^(.+?)\s*</);
  if (match) {
    return match[1].replace(/^["']|["']$/g, "").trim();
  }
  return extractEmail(raw);
}

// ─── Extract job ID from inbound address ─────────────────────────────────
// Matches: job-{uuid}@inbound.iworkr.app or job-{uuid}@*.iworkr.app
function extractJobIdFromAddress(toAddress: string): string | null {
  const email = extractEmail(toAddress);
  const match = email.match(
    /^job-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})@/i
  );
  return match ? match[1] : null;
}

// ─── Extract email headers ───────────────────────────────────────────────
function extractHeader(
  headersStr: string,
  headerName: string
): string | null {
  // Match multi-line header values (continued lines start with whitespace)
  const regex = new RegExp(
    `^${headerName}:\\s*(.+(?:\\n\\s+.+)*)`,
    "im"
  );
  const match = headersStr.match(regex);
  if (match) {
    return match[1].replace(/\n\s+/g, " ").trim();
  }
  return null;
}

// ─── Strip email signatures and quoted replies ───────────────────────────
function stripQuotedContent(text: string): string {
  if (!text) return "";

  let cleaned = text;

  // Remove Gmail-style quoted replies
  cleaned = cleaned.replace(/<div class="gmail_quote">[\s\S]*$/i, "");

  // Remove standard reply headers: "On Mon, Jan 1, 2024, Person wrote:"
  cleaned = cleaned.replace(/On .+ wrote:[\s\S]*$/m, "");

  // Remove Outlook-style separators
  cleaned = cleaned.replace(
    /_{10,}[\s\S]*$/m,
    ""
  );
  cleaned = cleaned.replace(
    /-{3,}\s*Original Message\s*-{3,}[\s\S]*$/i,
    ""
  );

  // Remove blockquotes (HTML)
  cleaned = cleaned.replace(/<blockquote[\s\S]*?<\/blockquote>/gi, "");

  // Remove lines starting with > (plain-text quoting)
  cleaned = cleaned
    .split("\n")
    .filter((line) => !line.startsWith(">"))
    .join("\n");

  // Remove common email signatures
  cleaned = cleaned.replace(/^--\s*\n[\s\S]*$/m, ""); // "-- \n" signature delimiter
  cleaned = cleaned.replace(
    /Sent from my (iPhone|iPad|Android|Samsung|Galaxy|Pixel|mobile)[\s\S]*$/i,
    ""
  );
  cleaned = cleaned.replace(
    /Get Outlook for (iOS|Android)[\s\S]*$/i,
    ""
  );

  return cleaned.trim();
}

// ─── Strip HTML for plain-text preview ───────────────────────────────────
function stripHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Main Handler ────────────────────────────────────────────────────────
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const contentType = req.headers.get("content-type") || "";

    // ── Parse the request body ───────────────────────────────
    let fields: Record<string, string>;

    if (contentType.includes("multipart/form-data")) {
      const boundaryMatch = contentType.match(/boundary=(.+)/);
      const boundary = boundaryMatch
        ? boundaryMatch[1].replace(/;.*$/, "").trim()
        : "";

      if (!boundary) {
        console.error("[inbound-email-webhook] No boundary in multipart");
        return new Response(
          JSON.stringify({ error: "Invalid multipart boundary" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const bodyBytes = new Uint8Array(await req.arrayBuffer());
      fields = parseMultipartFormData(bodyBytes, boundary);
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      const bodyText = await req.text();
      fields = parseFormBody(bodyText);
    } else {
      // Try JSON as fallback
      try {
        const json = await req.json();
        fields = json as Record<string, string>;
      } catch {
        console.error(
          `[inbound-email-webhook] Unsupported content-type: ${contentType}`
        );
        return new Response(
          JSON.stringify({ error: "Unsupported content type" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // ── Extract email fields ─────────────────────────────────
    const fromRaw = fields.from || fields.From || "";
    const toRaw = fields.to || fields.To || "";
    const subject = fields.subject || fields.Subject || "(No subject)";
    const textBody = fields.text || fields.Text || "";
    const htmlBody = fields.html || fields.Html || "";
    const headersStr = fields.headers || fields.Headers || "";
    const envelopeRaw = fields.envelope || fields.Envelope || "";
    const attachmentsCount = parseInt(fields.attachments || "0", 10);

    const senderEmail = extractEmail(fromRaw);
    const senderName = extractSenderName(fromRaw);

    console.log(
      `[inbound-email-webhook] From=${senderEmail} To=${toRaw} Subject="${subject}" Attachments=${attachmentsCount}`
    );

    if (!senderEmail) {
      console.error("[inbound-email-webhook] Missing sender email");
      return new Response(JSON.stringify({ error: "Missing sender" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Parse envelope for recipient list ────────────────────
    let recipientEmails: string[] = [];
    try {
      if (envelopeRaw) {
        const envelope = JSON.parse(envelopeRaw);
        recipientEmails = (envelope.to || []).map((e: string) =>
          e.toLowerCase()
        );
      }
    } catch {
      // Fallback: parse To header directly
      recipientEmails = toRaw
        .split(",")
        .map((addr: string) => extractEmail(addr.trim()))
        .filter(Boolean);
    }

    if (recipientEmails.length === 0) {
      recipientEmails = [extractEmail(toRaw)];
    }

    // ── Extract Message-ID and In-Reply-To from headers ──────
    const messageId = extractHeader(headersStr, "Message-ID") ||
      extractHeader(headersStr, "Message-Id") ||
      null;
    const inReplyTo = extractHeader(headersStr, "In-Reply-To") || null;
    const referencesHeader = extractHeader(headersStr, "References") || null;

    console.log(
      `[inbound-email-webhook] Message-ID=${messageId} In-Reply-To=${inReplyTo}`
    );

    // ── Initialize Supabase client ───────────────────────────
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // ── 1. Extract job_id from address ───────────────────────
    let jobId: string | null = null;
    for (const addr of recipientEmails) {
      const extracted = extractJobIdFromAddress(addr);
      if (extracted) {
        jobId = extracted;
        break;
      }
    }

    // ── 2. Thread matching via In-Reply-To ───────────────────
    let existingThreadLogId: string | null = null;
    let existingThreadJobId: string | null = null;

    if (!jobId && inReplyTo) {
      const { data: existingThread } = await supabase
        .from("email_threads")
        .select("log_id, communication_logs!inner(job_id, workspace_id)")
        .eq("message_id", inReplyTo)
        .maybeSingle();

      if (existingThread) {
        existingThreadLogId = existingThread.log_id;
        const commLog = existingThread.communication_logs as any;
        existingThreadJobId = commLog?.job_id || null;
        jobId = existingThreadJobId;

        console.log(
          `[inbound-email-webhook] Thread matched via In-Reply-To: log=${existingThreadLogId} job=${jobId}`
        );
      }
    }

    // ── 3. Look up sender as client ──────────────────────────
    let clientId: string | null = null;
    let workspaceId: string | null = null;

    const { data: clientRecord } = await supabase
      .from("clients")
      .select("id, organization_id")
      .eq("email", senderEmail)
      .maybeSingle();

    if (clientRecord) {
      clientId = clientRecord.id;
      workspaceId = clientRecord.organization_id;
      console.log(
        `[inbound-email-webhook] Client found: ${clientId} workspace=${workspaceId}`
      );
    }

    // ── 4. Resolve workspace_id from job if needed ───────────
    if (!workspaceId && jobId) {
      const { data: jobRecord } = await supabase
        .from("jobs")
        .select("organization_id, client_id")
        .eq("id", jobId)
        .maybeSingle();

      if (jobRecord) {
        workspaceId = jobRecord.organization_id;
        // Also link client if not found by email
        if (!clientId && jobRecord.client_id) {
          clientId = jobRecord.client_id;
        }
      }
    }

    // ── 5. Fallback workspace from existing thread ───────────
    if (!workspaceId && existingThreadLogId) {
      const { data: logRecord } = await supabase
        .from("communication_logs")
        .select("workspace_id")
        .eq("id", existingThreadLogId)
        .single();

      if (logRecord) {
        workspaceId = logRecord.workspace_id;
      }
    }

    if (!workspaceId) {
      console.warn(
        `[inbound-email-webhook] Could not resolve workspace for email from ${senderEmail}`
      );
      // Still return 200 so SendGrid doesn't retry
      return new Response(
        JSON.stringify({
          received: true,
          warning: "No workspace matched — email archived but not linked",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ── 6. Clean email body ──────────────────────────────────
    const cleanedText = textBody
      ? stripQuotedContent(textBody)
      : stripQuotedContent(stripHtml(htmlBody));

    const bodyPreview = cleanedText.slice(0, 200) || subject;

    // ── 7. Log communication ─────────────────────────────────
    const { data: logResult, error: logErr } = await supabase.rpc(
      "log_communication",
      {
        p_workspace_id: workspaceId,
        p_direction: "inbound",
        p_channel: "email",
        p_status: "delivered",
        p_from_address: senderEmail,
        p_to_address: recipientEmails[0] || toRaw,
        p_subject: subject,
        p_body_preview: bodyPreview,
        p_client_id: clientId,
        p_job_id: jobId,
        p_metadata: {
          message_id: messageId,
          in_reply_to: inReplyTo,
          has_attachments: attachmentsCount > 0,
          sender_name: senderName,
        },
      }
    );

    if (logErr) {
      console.error("[inbound-email-webhook] Log communication error:", logErr);
      return new Response(
        JSON.stringify({ error: "Failed to log communication" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const logId = logResult?.log_id;
    console.log(`[inbound-email-webhook] Communication logged: ${logId}`);

    // ── 8. Handle attachments ────────────────────────────────
    const attachmentUrls: string[] = [];

    if (attachmentsCount > 0 && logId) {
      for (let i = 1; i <= attachmentsCount; i++) {
        const attachmentField = fields[`attachment${i}`];
        const attachmentInfoField = fields[`attachment-info`];

        if (!attachmentField) continue;

        try {
          // Parse attachment info for filename
          let fileName = `attachment_${i}`;
          let contentType = "application/octet-stream";

          if (attachmentInfoField) {
            try {
              const info = JSON.parse(attachmentInfoField);
              const attachKey = Object.keys(info)[i - 1] || "";
              if (info[attachKey]) {
                fileName = info[attachKey].filename || fileName;
                contentType = info[attachKey]["content-type"] || contentType;
              }
            } catch {
              // Ignore parse errors for attachment info
            }
          }

          // Upload to Supabase Storage
          const storagePath = `${workspaceId}/${logId}/${fileName}`;
          const encoder = new TextEncoder();
          const fileBytes = encoder.encode(attachmentField);

          const { data: uploadData, error: uploadErr } = await supabase.storage
            .from("email-attachments")
            .upload(storagePath, fileBytes, {
              contentType,
              upsert: true,
            });

          if (uploadErr) {
            console.error(
              `[inbound-email-webhook] Attachment upload error (${fileName}):`,
              uploadErr
            );
            continue;
          }

          // Get public URL
          const { data: urlData } = supabase.storage
            .from("email-attachments")
            .getPublicUrl(storagePath);

          if (urlData?.publicUrl) {
            attachmentUrls.push(urlData.publicUrl);
            console.log(
              `[inbound-email-webhook] Attachment uploaded: ${fileName}`
            );
          }
        } catch (attachErr) {
          console.error(
            `[inbound-email-webhook] Attachment processing error:`,
            attachErr
          );
        }
      }
    }

    // ── 9. Insert email thread record ────────────────────────
    if (logId) {
      const { error: threadErr } = await supabase
        .from("email_threads")
        .insert({
          log_id: logId,
          message_id: messageId,
          in_reply_to: inReplyTo,
          references_header: referencesHeader,
          subject,
          body_text: cleanedText,
          body_html: htmlBody || null,
          has_attachments: attachmentUrls.length > 0,
          attachment_urls: attachmentUrls,
          sender_name: senderName,
          sender_email: senderEmail,
          recipient_emails: recipientEmails,
        });

      if (threadErr) {
        console.error(
          "[inbound-email-webhook] Email thread insert error:",
          threadErr
        );
      } else {
        console.log(
          `[inbound-email-webhook] Email thread created for log ${logId}`
        );
      }
    }

    // ── 10. Success response ─────────────────────────────────
    console.log(
      `[inbound-email-webhook] Processed email from ${senderEmail}: log=${logId} job=${jobId} client=${clientId} attachments=${attachmentUrls.length}`
    );

    return new Response(
      JSON.stringify({
        received: true,
        log_id: logId,
        client_id: clientId,
        job_id: jobId,
        is_linked: !!(clientId || jobId),
        attachments_stored: attachmentUrls.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    console.error("[inbound-email-webhook] Unhandled error:", err);
    // Return 200 so SendGrid doesn't keep retrying
    return new Response(
      JSON.stringify({
        received: true,
        error: err instanceof Error ? err.message : "Unknown error",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

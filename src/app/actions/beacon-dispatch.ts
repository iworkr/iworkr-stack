"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

// ─── Types ──────────────────────────────────────────────────────────────
interface EnqueueResult {
  queued: boolean;
  queue_id?: string;
  reason?: string;
}

interface DispatchResult {
  sent: number;
  skipped: number;
  errors: string[];
}

interface ShiftInfo {
  id: string;
  start_time: string;
  end_time: string;
  location_name?: string;
  role?: string;
}

interface RosterMember {
  user_id: string;
  full_name: string;
  phone?: string;
  email?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────

/**
 * Get the workspace timezone or fall back to UTC.
 */
async function getWorkspaceTimezone(orgId: string): Promise<string> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data } = await (supabase as any)
      .from("organizations")
      .select("timezone")
      .eq("id", orgId)
      .maybeSingle();
    return data?.timezone || "UTC";
  } catch {
    return "UTC";
  }
}

/**
 * Format a shift time for SMS display.
 * Output: "Mon 17 Mar, 9:00 AM – 5:00 PM"
 */
function formatShiftTime(
  startIso: string,
  endIso: string,
  timezone: string
): string {
  try {
    const opts: Intl.DateTimeFormatOptions = {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: timezone,
    };
    const timeOnly: Intl.DateTimeFormatOptions = {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: timezone,
    };

    const start = new Date(startIso);
    const end = new Date(endIso);

    const startStr = new Intl.DateTimeFormat("en-AU", opts).format(start);
    const endStr = new Intl.DateTimeFormat("en-AU", timeOnly).format(end);

    return `${startStr} – ${endStr}`;
  } catch {
    return `${startIso} – ${endIso}`;
  }
}

/**
 * Mask sensitive data for care sector SMS payloads.
 * Strips participant names, addresses, and clinical references.
 */
function maskCareData(body: string): string {
  // Remove anything that looks like a participant/client name after "for"
  let masked = body.replace(
    /\bfor\s+[A-Z][a-z]+\s+[A-Z][a-z]+/g,
    "for [Participant]"
  );
  // Remove street addresses
  masked = masked.replace(
    /\d+\s+[A-Z][a-zA-Z\s]+(?:St|Street|Rd|Road|Ave|Avenue|Blvd|Cr|Cres|Dr|Drive|Ln|Lane|Pl|Place|Way|Ct|Court)\b/gi,
    "[Address Redacted]"
  );
  // Remove Medicare/NDIS numbers
  masked = masked.replace(/\b\d{3}\s?\d{5}\s?\d{1}\b/g, "[ID Redacted]");
  // Remove any reference number patterns
  masked = masked.replace(
    /\b(NDIS|ndis|Medicare|medicare)\s*#?\s*\d+/gi,
    "[ID Redacted]"
  );
  return masked;
}

/**
 * Check if the organization is in a care sector.
 */
async function isCareOrg(orgId: string): Promise<boolean> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data } = await (supabase as any)
      .from("organizations")
      .select("industry")
      .eq("id", orgId)
      .maybeSingle();
    const careIndustries = [
      "aged_care",
      "disability",
      "ndis",
      "home_care",
      "community_care",
      "healthcare",
    ];
    return data?.industry
      ? careIndustries.includes(data.industry.toLowerCase())
      : false;
  } catch {
    return false;
  }
}

/**
 * Enqueue a message for a single user across specified channels.
 */
async function enqueueForUser(
  orgId: string,
  userId: string,
  channels: ("sms" | "email" | "push")[],
  eventType: string,
  subject: string,
  body: string,
  priority: number = 2,
  metadata: Record<string, unknown> = {}
): Promise<{ sent: number; skipped: number; errors: string[] }> {
  const supabase = await createServerSupabaseClient();
  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const channel of channels) {
    try {
      const { data, error } = await (supabase as any).rpc("enqueue_outbound", {
        p_org_id: orgId,
        p_user_id: userId,
        p_channel: channel,
        p_event_type: eventType,
        p_subject: subject,
        p_body: body,
        p_priority: priority,
        p_metadata: metadata,
      });

      if (error) {
        errors.push(`${channel}/${userId}: ${error.message}`);
        skipped++;
        continue;
      }

      const result = data as unknown as EnqueueResult;
      if (result?.queued) {
        sent++;
      } else {
        skipped++;
      }
    } catch (err: any) {
      errors.push(`${channel}/${userId}: ${err.message}`);
      skipped++;
    }
  }

  return { sent, skipped, errors };
}

/**
 * Get active members of an organization.
 */
async function getOrgMembers(orgId: string): Promise<RosterMember[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await (supabase as any)
    .from("organization_members")
    .select(
      `
      user_id,
      profiles!inner (
        full_name,
        phone,
        email
      )
    `
    )
    .eq("organization_id", orgId)
    .eq("status", "active");

  if (error || !data) return [];

  return data.map((m: any) => ({
    user_id: m.user_id,
    full_name: m.profiles?.full_name || "Team Member",
    phone: m.profiles?.phone,
    email: m.profiles?.email,
  }));
}

// ─── Dispatch: Roster Published ─────────────────────────────────────────

export async function dispatchRosterPublished(
  orgId: string,
  rosterPeriod: string,
  publishedBy: string
): Promise<DispatchResult> {
  const result: DispatchResult = { sent: 0, skipped: 0, errors: [] };

  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ...result, errors: ["Unauthorized"] };

    const [members, tz, careOrg] = await Promise.all([
      getOrgMembers(orgId),
      getWorkspaceTimezone(orgId),
      isCareOrg(orgId),
    ]);

    const subject = `New Roster Published — ${rosterPeriod}`;
    let smsBody = `[iWorkr] New roster for ${rosterPeriod} is ready. Check your shifts in the app.`;
    const emailBody = `Hi {{name}},\n\nA new roster has been published for ${rosterPeriod} by ${publishedBy}.\n\nPlease review your upcoming shifts in the iWorkr app or web dashboard.\n\nIf you have any concerns about your assigned shifts, contact your manager.`;

    if (careOrg) {
      smsBody = maskCareData(smsBody);
    }

    for (const member of members) {
      const personalEmail = emailBody.replace("{{name}}", member.full_name);

      const r = await enqueueForUser(
        orgId,
        member.user_id,
        ["sms", "email", "push"],
        "roster_published",
        subject,
        member.phone ? smsBody : personalEmail,
        2,
        {
          roster_period: rosterPeriod,
          published_by: publishedBy,
          timezone: tz,
        }
      );

      result.sent += r.sent;
      result.skipped += r.skipped;
      result.errors.push(...r.errors);
    }

    return result;
  } catch (err: any) {
    return { ...result, errors: [err.message] };
  }
}

// ─── Dispatch: Shift Modified ───────────────────────────────────────────

export async function dispatchShiftModified(
  orgId: string,
  shiftInfo: ShiftInfo,
  affectedUserIds: string[],
  isUrgent: boolean,
  modifiedBy: string
): Promise<DispatchResult> {
  const result: DispatchResult = { sent: 0, skipped: 0, errors: [] };

  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ...result, errors: ["Unauthorized"] };

    const [tz, careOrg] = await Promise.all([
      getWorkspaceTimezone(orgId),
      isCareOrg(orgId),
    ]);

    const timeStr = formatShiftTime(shiftInfo.start_time, shiftInfo.end_time, tz);
    const urgencyLabel = isUrgent ? "URGENT" : "Update";
    const priority = isUrgent ? 1 : 2;
    const eventType = isUrgent ? "shift_modified_urgent" : "shift_modified_standard";

    const subject = `${urgencyLabel}: Shift Change — ${timeStr}`;
    let smsBody = `[iWorkr] ${urgencyLabel}: Your shift has changed. ${timeStr}${shiftInfo.location_name ? ` at ${shiftInfo.location_name}` : ""}. Open app for details.`;
    const emailBody = `Hi {{name}},\n\nYour shift has been modified by ${modifiedBy}.\n\n**Updated Details:**\n- Time: ${timeStr}\n${shiftInfo.location_name ? `- Location: ${shiftInfo.location_name}\n` : ""}${shiftInfo.role ? `- Role: ${shiftInfo.role}\n` : ""}\n\nPlease review the changes in the iWorkr app. If this doesn't work for you, contact your manager immediately.`;

    if (careOrg) {
      smsBody = maskCareData(smsBody);
    }

    // Truncate SMS to 160 chars
    if (smsBody.length > 160) {
      smsBody = smsBody.substring(0, 157) + "...";
    }

    for (const userId of affectedUserIds) {
      // Fetch user name for email personalization
      const { data: profile } = await (supabase as any)
        .from("profiles")
        .select("full_name")
        .eq("id", userId)
        .maybeSingle();

      const name = profile?.full_name || "Team Member";
      const personalEmail = emailBody.replace("{{name}}", name);

      const channels: ("sms" | "email" | "push")[] = ["push"];
      if (isUrgent) {
        channels.unshift("sms", "email");
      } else {
        channels.push("email");
      }

      const r = await enqueueForUser(
        orgId,
        userId,
        channels,
        eventType,
        subject,
        channels[0] === "sms" ? smsBody : personalEmail,
        priority,
        {
          shift_id: shiftInfo.id,
          start_time: shiftInfo.start_time,
          end_time: shiftInfo.end_time,
          location: shiftInfo.location_name,
          modified_by: modifiedBy,
          is_urgent: isUrgent,
          timezone: tz,
        }
      );

      result.sent += r.sent;
      result.skipped += r.skipped;
      result.errors.push(...r.errors);
    }

    return result;
  } catch (err: any) {
    return { ...result, errors: [err.message] };
  }
}

// ─── Dispatch: Announcement ─────────────────────────────────────────────

export async function dispatchAnnouncement(
  orgId: string,
  title: string,
  message: string,
  sendSms: boolean,
  sentBy: string
): Promise<DispatchResult> {
  const result: DispatchResult = { sent: 0, skipped: 0, errors: [] };

  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ...result, errors: ["Unauthorized"] };

    const [members, careOrg] = await Promise.all([
      getOrgMembers(orgId),
      isCareOrg(orgId),
    ]);

    const subject = `Announcement: ${title}`;
    let smsBody = `[iWorkr] ${title}: ${message}`;
    const emailBody = `Hi {{name}},\n\n**${title}**\n\n${message}\n\n— ${sentBy}`;

    if (careOrg) {
      smsBody = maskCareData(smsBody);
    }

    // Truncate SMS to 160 chars
    if (smsBody.length > 160) {
      smsBody = smsBody.substring(0, 157) + "...";
    }

    for (const member of members) {
      const personalEmail = emailBody.replace("{{name}}", member.full_name);
      const channels: ("sms" | "email" | "push")[] = sendSms
        ? ["sms", "email", "push"]
        : ["email", "push"];

      const r = await enqueueForUser(
        orgId,
        member.user_id,
        channels,
        "announcement",
        subject,
        channels[0] === "sms" ? smsBody : personalEmail,
        2,
        {
          title,
          sent_by: sentBy,
        }
      );

      result.sent += r.sent;
      result.skipped += r.skipped;
      result.errors.push(...r.errors);
    }

    return result;
  } catch (err: any) {
    return { ...result, errors: [err.message] };
  }
}

// ─── Dispatch: Payslip Ready ────────────────────────────────────────────

export async function dispatchPayslipReady(
  orgId: string,
  userId: string,
  payPeriod: string,
  payslipId: string
): Promise<DispatchResult> {
  const result: DispatchResult = { sent: 0, skipped: 0, errors: [] };

  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ...result, errors: ["Unauthorized"] };

    // Fetch user profile for personalization
    const { data: profile } = await (supabase as any)
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .maybeSingle();

    const name = profile?.full_name || "Team Member";

    const subject = `Payslip Ready — ${payPeriod}`;
    const emailBody = `Hi ${name},\n\nYour payslip for ${payPeriod} is now available.\n\nYou can view and download it from the iWorkr app or web dashboard under Pay → Payslips.\n\nIf you have questions about your pay, please contact your manager or payroll team.`;

    // Payslips are NEVER sent via SMS (locked off by design)
    // Only email + push
    const r = await enqueueForUser(
      orgId,
      userId,
      ["email", "push"],
      "payslip_ready",
      subject,
      emailBody,
      3, // Low priority — not time-sensitive
      {
        pay_period: payPeriod,
        payslip_id: payslipId,
      }
    );

    result.sent += r.sent;
    result.skipped += r.skipped;
    result.errors.push(...r.errors);

    return result;
  } catch (err: any) {
    return { ...result, errors: [err.message] };
  }
}

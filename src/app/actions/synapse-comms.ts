/**
 * @module SynapseComms Server Actions
 * @status COMPLETE
 * @description Unified communications engine — inbox, screen pop, VoIP, email threads, call logging, lead conversion, and billable time
 * @exports fetchUnifiedInboxAction, screenPopLookupAction, createCallRecordAction, convertLeadAction, logCommunicationAction
 * @lastAudit 2026-03-22
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

/**
 * Project Synapse-Comms — Unified Communications Engine
 *
 * Server actions for:
 *  1. Unified Inbox: Feed, stats, read/star/link operations
 *  2. Screen Pop: Real-time caller lookup for VoIP ring events
 *  3. Phone Numbers: Workspace phone number management
 *  4. VoIP & Email: Call records, email threads, voice token generation
 *  5. Communication Logging: Inbound/outbound log capture via RPC
 *  6. Job Timeline: Full communication history per job
 *  7. Lead Conversion: Create client + job from unknown caller
 *  8. Billable Time: Convert call duration to timesheet entry
 */

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

/* ── Service Client ────────────────────────────────────────────────────── */

function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/* ── Types ──────────────────────────────────────────────────────────────── */

export type CommDirection = "inbound" | "outbound";

export type CommChannel = "voice_call" | "email" | "sms" | "portal_message";

export type CommStatus =
  | "missed"
  | "completed"
  | "voicemail"
  | "delivered"
  | "bounced"
  | "in_progress"
  | "ringing"
  | "failed";

export type PhoneRoutingStrategy =
  | "ring_all"
  | "round_robin"
  | "sequential"
  | "ivr_menu";

export interface WorkspacePhoneNumber {
  id: string;
  workspace_id: string;
  twilio_sid: string | null;
  phone_number: string;
  friendly_name: string | null;
  routing_strategy: PhoneRoutingStrategy;
  is_active: boolean;
  capabilities: Record<string, any> | null;
  assigned_worker_ids: string[];
  metadata: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}

export interface CommunicationLog {
  id: string;
  workspace_id: string;
  client_id: string | null;
  job_id: string | null;
  worker_id: string | null;
  participant_id: string | null;
  direction: CommDirection;
  channel: CommChannel;
  status: CommStatus;
  from_address: string | null;
  to_address: string | null;
  subject: string | null;
  body_preview: string | null;
  is_read: boolean;
  is_linked: boolean;
  is_starred: boolean;
  duration_seconds: number | null;
  recording_url: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
  updated_at: string;
  // Joined / enriched fields
  client_name?: string | null;
  job_display_id?: string | null;
  job_title?: string | null;
  ai_transcript?: string | null;
  email_body?: string | null;
  has_attachments?: boolean;
}

export interface VoipCallRecord {
  id: string;
  log_id: string;
  twilio_call_sid: string | null;
  from_number: string | null;
  to_number: string | null;
  duration_seconds: number | null;
  recording_url: string | null;
  recording_duration: number | null;
  ai_transcript: string | null;
  transcript_status: string | null;
  call_quality_score: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmailThread {
  id: string;
  log_id: string;
  message_id: string | null;
  in_reply_to: string | null;
  references_header: string | null;
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  has_attachments: boolean;
  attachment_urls: string[];
  sender_name: string | null;
  sender_email: string | null;
  recipient_emails: string[];
  created_at: string;
  updated_at: string;
}

export interface InboxStats {
  total: number;
  unread: number;
  calls: number;
  emails: number;
  sms: number;
  missed_calls: number;
  voicemails: number;
  unlinked: number;
  today: number;
}

export interface ScreenPopData {
  found: boolean;
  client_id: string | null;
  client_name: string | null;
  client_email: string | null;
  client_phone: string | null;
  client_address: string | null;
  client_status: string | null;
  active_jobs: Array<{
    id: string;
    display_id: string;
    title: string;
    status: string;
    scheduled_start: string | null;
  }>;
  outstanding_balance: number;
  recent_comms: Array<{
    id: string;
    channel: CommChannel;
    direction: CommDirection;
    status: CommStatus;
    subject: string | null;
    body_preview: string | null;
    created_at: string;
  }>;
}

/* ── Inbox Feed ────────────────────────────────────────────────────────── */

/**
 * Fetch the unified inbox feed via the get_inbox_feed RPC.
 */
export async function getInboxFeed(
  orgId: string,
  options?: {
    channel?: CommChannel;
    unreadOnly?: boolean;
    unlinkedOnly?: boolean;
    limit?: number;
    offset?: number;
  }
): Promise<{ data: CommunicationLog[] | null; error: string | null }> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { data, error } = await (supabase as any).rpc("get_inbox_feed", {
      p_workspace_id: orgId,
      p_channel: options?.channel ?? null,
      p_unread_only: options?.unreadOnly ?? false,
      p_unlinked_only: options?.unlinkedOnly ?? false,
      p_limit: options?.limit ?? 50,
      p_offset: options?.offset ?? 0,
    });

    if (error) return { data: null, error: error.message };
    return { data: data ?? [], error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/* ── Inbox Stats ───────────────────────────────────────────────────────── */

/**
 * Fetch inbox stat counters via the get_inbox_stats RPC.
 */
export async function getInboxStats(
  orgId: string
): Promise<{ data: InboxStats | null; error: string | null }> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { data, error } = await (supabase as any).rpc("get_inbox_stats", {
      p_workspace_id: orgId,
    });

    if (error) return { data: null, error: error.message };
    return { data: data as InboxStats, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/* ── Screen Pop ────────────────────────────────────────────────────────── */

/**
 * Real-time caller lookup — returns client info, active jobs,
 * outstanding balance, and recent communications for the given phone number.
 */
export async function getScreenPopData(
  orgId: string,
  phoneNumber: string
): Promise<{ data: ScreenPopData | null; error: string | null }> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { data, error } = await (supabase as any).rpc(
      "screen_pop_lookup",
      {
        p_workspace_id: orgId,
        p_phone_number: phoneNumber,
      }
    );

    if (error) return { data: null, error: error.message };
    return { data: data as ScreenPopData, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/* ── Mark As Read ──────────────────────────────────────────────────────── */

/**
 * Mark a communication log entry as read.
 */
export async function markAsRead(
  logId: string
): Promise<{ data: { success: boolean } | null; error: string | null }> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { error } = await (supabase as any)
      .from("communication_logs")
      .update({ is_read: true, updated_at: new Date().toISOString() })
      .eq("id", logId);

    if (error) return { data: null, error: error.message };
    return { data: { success: true }, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/* ── Mark As Starred ───────────────────────────────────────────────────── */

/**
 * Toggle the starred flag on a communication log entry.
 */
export async function markAsStarred(
  logId: string,
  starred: boolean
): Promise<{ data: { success: boolean } | null; error: string | null }> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { error } = await (supabase as any)
      .from("communication_logs")
      .update({ is_starred: starred, updated_at: new Date().toISOString() })
      .eq("id", logId);

    if (error) return { data: null, error: error.message };
    return { data: { success: true }, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/* ── Link to Job ───────────────────────────────────────────────────────── */

/**
 * Link a communication log entry to a job via the link_communication_to_job RPC.
 */
export async function linkToJob(
  logId: string,
  jobId: string
): Promise<{ data: { success: boolean } | null; error: string | null }> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { data, error } = await (supabase as any).rpc(
      "link_communication_to_job",
      {
        p_log_id: logId,
        p_job_id: jobId,
      }
    );

    if (error) return { data: null, error: error.message };

    revalidatePath("/dashboard/comms");
    revalidatePath(`/dashboard/jobs/${jobId}`);
    return { data: { success: true }, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/* ── Phone Numbers ─────────────────────────────────────────────────────── */

/**
 * Get all workspace phone numbers for an organization.
 */
export async function getPhoneNumbers(
  orgId: string
): Promise<{ data: WorkspacePhoneNumber[] | null; error: string | null }> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { data, error } = await (supabase as any)
      .from("workspace_phone_numbers")
      .select("*")
      .eq("workspace_id", orgId)
      .order("created_at", { ascending: false });

    if (error) return { data: null, error: error.message };
    return { data: data ?? [], error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/**
 * Add a new phone number to the workspace.
 */
export async function addPhoneNumber(
  orgId: string,
  data: {
    phone_number: string;
    friendly_name?: string;
    twilio_sid?: string;
    routing_strategy?: PhoneRoutingStrategy;
    capabilities?: Record<string, any>;
    assigned_worker_ids?: string[];
  }
): Promise<{ data: WorkspacePhoneNumber | null; error: string | null }> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { data: inserted, error } = await (supabase as any)
      .from("workspace_phone_numbers")
      .insert({
        workspace_id: orgId,
        phone_number: data.phone_number,
        friendly_name: data.friendly_name ?? null,
        twilio_sid: data.twilio_sid ?? null,
        routing_strategy: data.routing_strategy ?? "ring_all",
        is_active: true,
        capabilities: data.capabilities ?? { voice: true, sms: true },
        assigned_worker_ids: data.assigned_worker_ids ?? [],
        metadata: {},
      })
      .select("*")
      .single();

    if (error) return { data: null, error: error.message };

    revalidatePath("/dashboard/comms");
    revalidatePath("/dashboard/settings/comms");
    return { data: inserted, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/* ── VoIP Call Record ──────────────────────────────────────────────────── */

/**
 * Fetch the VoIP call record for a given communication log entry.
 */
export async function getVoipRecord(
  logId: string
): Promise<{ data: VoipCallRecord | null; error: string | null }> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { data, error } = await (supabase as any)
      .from("voip_call_records")
      .select("*")
      .eq("log_id", logId)
      .maybeSingle();

    if (error) return { data: null, error: error.message };
    return { data: data ?? null, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/* ── Email Thread ──────────────────────────────────────────────────────── */

/**
 * Fetch the email thread record for a given communication log entry.
 */
export async function getEmailThread(
  logId: string
): Promise<{ data: EmailThread | null; error: string | null }> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { data, error } = await (supabase as any)
      .from("email_threads")
      .select("*")
      .eq("log_id", logId)
      .maybeSingle();

    if (error) return { data: null, error: error.message };
    return { data: data ?? null, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/* ── Log Communication ─────────────────────────────────────────────────── */

/**
 * Log a communication event via the log_communication RPC.
 */
export async function logCommunication(
  orgId: string,
  data: {
    direction: CommDirection;
    channel: CommChannel;
    status: CommStatus;
    from_address: string;
    to_address: string;
    subject?: string;
    body_preview?: string;
    client_id?: string;
    job_id?: string;
    worker_id?: string;
    duration_seconds?: number;
    metadata?: Record<string, any>;
  }
): Promise<{ data: CommunicationLog | null; error: string | null }> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { data: result, error } = await (supabase as any).rpc(
      "log_communication",
      {
        p_workspace_id: orgId,
        p_direction: data.direction,
        p_channel: data.channel,
        p_status: data.status,
        p_from_address: data.from_address,
        p_to_address: data.to_address,
        p_subject: data.subject ?? null,
        p_body_preview: data.body_preview ?? null,
        p_client_id: data.client_id ?? null,
        p_job_id: data.job_id ?? null,
        p_worker_id: data.worker_id ?? user.id,
        p_duration_seconds: data.duration_seconds ?? null,
        p_metadata: data.metadata ?? null,
      }
    );

    if (error) return { data: null, error: error.message };

    revalidatePath("/dashboard/comms");
    if (data.job_id) {
      revalidatePath(`/dashboard/jobs/${data.job_id}`);
    }
    return { data: result as CommunicationLog, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/* ── Send Email Reply ──────────────────────────────────────────────────── */

/**
 * Send an email reply — creates an outbound communication log + email_threads record.
 * The actual email delivery is handled by a downstream edge function / webhook.
 */
export async function sendEmailReply(
  orgId: string,
  data: {
    logId: string;
    toEmail: string;
    subject: string;
    bodyHtml: string;
    bodyText: string;
    inReplyTo?: string;
    referencesHeader?: string;
  }
): Promise<{ data: { log_id: string; thread_id: string } | null; error: string | null }> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    // Fetch the original log to get context (client_id, job_id, workspace)
    const { data: originalLog, error: logErr } = await (supabase as any)
      .from("communication_logs")
      .select("client_id, job_id, from_address, to_address")
      .eq("id", data.logId)
      .single();

    if (logErr) return { data: null, error: logErr.message };

    // Get the user's email for the from_address
    const fromAddress = user.email ?? originalLog.to_address ?? "noreply@iworkr.com";

    // Create the outbound communication log
    const { data: newLog, error: commErr } = await (supabase as any)
      .from("communication_logs")
      .insert({
        workspace_id: orgId,
        client_id: originalLog.client_id,
        job_id: originalLog.job_id,
        worker_id: user.id,
        direction: "outbound" as CommDirection,
        channel: "email" as CommChannel,
        status: "delivered" as CommStatus,
        from_address: fromAddress,
        to_address: data.toEmail,
        subject: data.subject,
        body_preview: data.bodyText.substring(0, 255),
        is_read: true,
        is_linked: !!originalLog.job_id,
        is_starred: false,
        metadata: { reply_to_log_id: data.logId },
      })
      .select("id")
      .single();

    if (commErr) return { data: null, error: commErr.message };

    // Create the email thread record
    const { data: thread, error: threadErr } = await (supabase as any)
      .from("email_threads")
      .insert({
        log_id: newLog.id,
        message_id: null, // Will be populated by the email delivery service
        in_reply_to: data.inReplyTo ?? null,
        references_header: data.referencesHeader ?? null,
        subject: data.subject,
        body_text: data.bodyText,
        body_html: data.bodyHtml,
        has_attachments: false,
        attachment_urls: [],
        sender_name: user.user_metadata?.full_name ?? user.email ?? "Unknown",
        sender_email: fromAddress,
        recipient_emails: [data.toEmail],
      })
      .select("id")
      .single();

    if (threadErr) return { data: null, error: threadErr.message };

    revalidatePath("/dashboard/comms");
    if (originalLog.job_id) {
      revalidatePath(`/dashboard/jobs/${originalLog.job_id}`);
    }

    return {
      data: { log_id: newLog.id, thread_id: thread.id },
      error: null,
    };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/* ── Job Timeline ──────────────────────────────────────────────────────── */

/**
 * Get all communication logs for a specific job, ordered chronologically.
 */
export async function getJobTimeline(
  jobId: string
): Promise<{ data: CommunicationLog[] | null; error: string | null }> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { data, error } = await (supabase as any)
      .from("communication_logs")
      .select("*")
      .eq("job_id", jobId)
      .order("created_at", { ascending: true });

    if (error) return { data: null, error: error.message };
    return { data: data ?? [], error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/* ── Generate Voice Token ──────────────────────────────────────────────── */

/**
 * Returns a placeholder response for Twilio voice token generation.
 * The actual Twilio Device token is generated by the `twilio-voice-token`
 * edge function — this action validates auth and returns the endpoint info.
 */
export async function generateVoiceToken(
  orgId: string
): Promise<{
  data: {
    endpoint: string;
    identity: string;
    workspace_id: string;
  } | null;
  error: string | null;
}> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const endpoint = `${supabaseUrl}/functions/v1/twilio-voice-token`;

    return {
      data: {
        endpoint,
        identity: user.id,
        workspace_id: orgId,
      },
      error: null,
    };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/* ── Convert to Billable Time ──────────────────────────────────────────── */

/**
 * Creates a timesheet entry from a call's duration.
 * Uses the service client to insert into time_entries since the
 * timesheet system may use admin-level access.
 */
export async function convertToBillableTime(
  logId: string,
  participantId?: string
): Promise<{
  data: { time_entry_id: string; duration_minutes: number } | null;
  error: string | null;
}> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    // Fetch the communication log to get duration and context
    const { data: log, error: logErr } = await (supabase as any)
      .from("communication_logs")
      .select("*")
      .eq("id", logId)
      .single();

    if (logErr) return { data: null, error: logErr.message };
    if (!log) return { data: null, error: "Communication log not found" };
    if (!log.duration_seconds || log.duration_seconds <= 0) {
      return { data: null, error: "No duration recorded for this communication" };
    }

    const durationMinutes = Math.ceil(log.duration_seconds / 60);
    const now = new Date().toISOString();

    // Calculate clock_in / clock_out from the log's created_at
    const clockIn = log.created_at;
    const clockOut = new Date(
      new Date(log.created_at).getTime() + log.duration_seconds * 1000
    ).toISOString();

    // Use service client for admin-level insert into time_entries
    const serviceClient = createServiceClient();

    const { data: entry, error: entryErr } = await (serviceClient as any)
      .from("time_entries")
      .insert({
        organization_id: log.workspace_id,
        worker_id: log.worker_id ?? user.id,
        clock_in: clockIn,
        clock_out: clockOut,
        total_hours: parseFloat((log.duration_seconds / 3600).toFixed(4)),
        break_minutes: 0,
        travel_minutes: 0,
        travel_km: 0,
        status: "completed",
        is_manual_entry: true,
        is_auto_clock_out: false,
        variance_minutes: 0,
        exception_resolved: true,
        shift_id: log.job_id ?? null,
        notes: `Auto-generated from ${log.channel} (${log.direction}) — Log ID: ${logId}`,
        metadata: {
          source: "synapse_comms",
          communication_log_id: logId,
          participant_id: participantId ?? null,
          channel: log.channel,
          direction: log.direction,
        },
      })
      .select("id")
      .single();

    if (entryErr) return { data: null, error: entryErr.message };

    revalidatePath("/dashboard/timesheets");
    revalidatePath("/dashboard/comms");

    return {
      data: {
        time_entry_id: entry.id,
        duration_minutes: durationMinutes,
      },
      error: null,
    };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/* ── Create Lead from Call ─────────────────────────────────────────────── */

/**
 * Creates a new client (lead status) and an initial job from an unknown caller.
 * Useful for the screen pop "New Lead" action when no existing client is matched.
 */
export async function createLeadFromCall(
  orgId: string,
  data: {
    phone: string;
    callerName?: string;
    address?: string;
  }
): Promise<{
  data: { client_id: string; job_id: string } | null;
  error: string | null;
}> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const clientName = data.callerName || `Caller ${data.phone}`;

    // Create the client with lead status
    const { data: client, error: clientErr } = await (supabase as any)
      .from("clients")
      .insert({
        organization_id: orgId,
        name: clientName,
        phone: data.phone,
        status: "lead",
        type: "residential",
        address: data.address ?? null,
        tags: ["phone-lead"],
        notes: `Lead created from inbound call on ${new Date().toLocaleDateString()}`,
        metadata: {
          source: "synapse_comms_screen_pop",
          original_phone: data.phone,
          created_by: user.id,
        },
      })
      .select("id")
      .single();

    if (clientErr) return { data: null, error: clientErr.message };

    // Create an initial job for the lead
    const { data: job, error: jobErr } = await (supabase as any)
      .from("jobs")
      .insert({
        organization_id: orgId,
        client_id: client.id,
        title: `Inbound inquiry — ${clientName}`,
        status: "pending",
        priority: "normal",
        description: `Lead created from inbound phone call.\nCaller: ${clientName}\nPhone: ${data.phone}${data.address ? `\nAddress: ${data.address}` : ""}`,
        metadata: {
          source: "synapse_comms",
          lead_phone: data.phone,
        },
      })
      .select("id")
      .single();

    if (jobErr) return { data: null, error: jobErr.message };

    revalidatePath("/dashboard/clients");
    revalidatePath("/dashboard/jobs");
    revalidatePath("/dashboard/comms");

    return {
      data: { client_id: client.id, job_id: job.id },
      error: null,
    };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

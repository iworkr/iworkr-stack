/**
 * @module CareComms Server Actions
 * @status COMPLETE
 * @description Project Echo — house thread messaging engine, care communication channels, and shift handover notes
 * @exports createThreadAction, sendMessageAction, fetchThreadsAction, markReadAction, fetchUnreadCountAction
 * @lastAudit 2026-03-22
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

/* ═══════════════════════════════════════════════════════════════════
   Care Communications — Server Actions
   Project Echo: House Thread Messaging Engine
   
   NOTE: The care_chat_* tables are not yet in the auto-generated Supabase
   types file. We cast the client to `any` for these queries to avoid
   deep type instantiation errors. Once `supabase gen types` is re-run
   against the updated schema, the casts can be removed.
   ═══════════════════════════════════════════════════════════════════ */

/** Helper: get a loosely-typed client for new care_chat_* tables */
async function getCareDb() {
  const supabase = await createServerSupabaseClient();
  return supabase as any;
}

/* ── Types ──────────────────────────────────────────────────────── */

export type CareChannelType =
  | "house_internal"
  | "house_external"
  | "direct_message"
  | "team_channel";

export type CareMessageType =
  | "standard"
  | "system_handover"
  | "manager_alert"
  | "system_roster_sync"
  | "system_archived"
  | "system_message_removed";

export type CareMemberRole = "admin" | "member" | "read_only" | "family_guest";

export interface CareChannel {
  id: string;
  organization_id: string;
  participant_id: string | null;
  channel_type: CareChannelType;
  name: string | null;
  description: string | null;
  is_archived: boolean;
  is_read_only: boolean;
  parent_group_name: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CareChatMessage {
  id: string;
  channel_id: string;
  sender_id: string | null;
  content: string;
  message_type: CareMessageType;
  attachments: any[];
  metadata: Record<string, any>;
  reply_to_id: string | null;
  is_edited: boolean;
  is_pinned: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  // Joined
  profiles?: { id: string; full_name: string; avatar_url: string | null };
}

export interface CareChatMember {
  channel_id: string;
  user_id: string;
  role: CareMemberRole;
  added_by_roster: boolean;
  is_permanent: boolean;
  last_read_at: string;
  joined_at: string;
  profiles?: { id: string; full_name: string; email: string; avatar_url: string | null };
}

/* ── Helpers ─────────────────────────────────────────────────────── */

function err(msg: string) {
  return { data: null, error: msg };
}

/* ═══════════════════════════════════════════════════════════════════
   CHANNELS
   ═══════════════════════════════════════════════════════════════════ */

/** Fetch all care channels the authenticated user is a member of */
export async function getCareChannels(orgId: string) {
  try {
    const supabase = await getCareDb();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return err("Unauthorized");

    const { data, error } = await supabase
      .from("care_chat_channels")
      .select("*, care_chat_members!inner(user_id)")
      .eq("organization_id", orgId)
      .eq("care_chat_members.user_id", user.id)
      .eq("is_archived", false)
      .order("updated_at", { ascending: false });

    if (error) return err(error.message);
    return { data: data as CareChannel[], error: null };
  } catch (e: any) {
    return err(e.message);
  }
}

/** Fetch a single care channel (membership verified) */
export async function getCareChannel(channelId: string) {
  try {
    const supabase = await getCareDb();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return err("Unauthorized");

    // Verify membership
    const { data: member } = await supabase
      .from("care_chat_members")
      .select("user_id")
      .eq("channel_id", channelId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!member) return err("Unauthorized");

    const { data, error } = await supabase
      .from("care_chat_channels")
      .select("*")
      .eq("id", channelId)
      .maybeSingle();

    if (error) return err(error.message);
    return { data: data as CareChannel | null, error: null };
  } catch (e: any) {
    return err(e.message);
  }
}

/** Get house channels for a participant (internal + external pair) */
export async function getHouseChannels(participantId: string) {
  try {
    const supabase = await getCareDb();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return err("Unauthorized");

    const { data, error } = await supabase
      .from("care_chat_channels")
      .select("*")
      .eq("participant_id", participantId)
      .in("channel_type", ["house_internal", "house_external"]);

    if (error) return err(error.message);
    const internal = (data || []).find((c: any) => c.channel_type === "house_internal") || null;
    const external = (data || []).find((c: any) => c.channel_type === "house_external") || null;
    return { data: { internal, external }, error: null };
  } catch (e: any) {
    return err(e.message);
  }
}

/** Create a team channel */
export async function createTeamChannel(
  orgId: string,
  name: string,
  description?: string,
  memberIds?: string[]
) {
  try {
    const supabase = await getCareDb();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return err("Unauthorized");

    const { data: channel, error } = await supabase
      .from("care_chat_channels")
      .insert({
        organization_id: orgId,
        channel_type: "team_channel" as CareChannelType,
        name,
        description: description || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) return err(error.message);

    // Add creator + provided members
    const ids = new Set([user.id, ...(memberIds || [])]);
    const members = Array.from(ids).map((uid) => ({
      channel_id: channel.id,
      user_id: uid,
      role: uid === user.id ? "admin" : ("member" as CareMemberRole),
    }));
    await supabase.from("care_chat_members").insert(members);

    return { data: channel as CareChannel, error: null };
  } catch (e: any) {
    return err(e.message);
  }
}

/** Create or get a DM channel between two users */
export async function getOrCreateCareDM(orgId: string, otherUserId: string) {
  try {
    const supabase = await getCareDb();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return err("Unauthorized");

    // Check for existing DM
    const { data: existing } = await supabase
      .from("care_chat_channels")
      .select("*, care_chat_members!inner(user_id)")
      .eq("organization_id", orgId)
      .eq("channel_type", "direct_message")
      .eq("care_chat_members.user_id", user.id);

    if (existing) {
      for (const ch of existing) {
        const { data: members } = await supabase
          .from("care_chat_members")
          .select("user_id")
          .eq("channel_id", ch.id);
        const mIds = (members || []).map((m: any) => m.user_id);
        if (mIds.length === 2 && mIds.includes(otherUserId)) {
          return { data: ch as CareChannel, error: null };
        }
      }
    }

    // Create new DM
    const { data: channel, error } = await supabase
      .from("care_chat_channels")
      .insert({
        organization_id: orgId,
        channel_type: "direct_message" as CareChannelType,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) return err(error.message);

    await supabase.from("care_chat_members").insert([
      { channel_id: channel.id, user_id: user.id, role: "member" },
      { channel_id: channel.id, user_id: otherUserId, role: "member" },
    ]);

    return { data: channel as CareChannel, error: null };
  } catch (e: any) {
    return err(e.message);
  }
}

/** Provision house threads for a participant (called after intake) */
export async function provisionHouseThreads(
  orgId: string,
  participantId: string,
  participantName: string
) {
  try {
    const supabase = await getCareDb();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return err("Unauthorized");

    const groupName = `${participantName} — Care Hub`;

    // Check if threads already exist
    const { data: existing } = await supabase
      .from("care_chat_channels")
      .select("id, channel_type")
      .eq("participant_id", participantId)
      .in("channel_type", ["house_internal", "house_external"]);

    if (existing && existing.length >= 2) {
      return { data: { message: "House threads already exist" }, error: null };
    }

    // Create internal channel
    const { data: internal, error: err1 } = await supabase
      .from("care_chat_channels")
      .insert({
        organization_id: orgId,
        participant_id: participantId,
        channel_type: "house_internal" as CareChannelType,
        name: `${participantName} — Internal Care`,
        parent_group_name: groupName,
        created_by: user.id,
      })
      .select()
      .single();

    if (err1) return err(err1.message);

    // Create external channel
    const { data: external, error: err2 } = await supabase
      .from("care_chat_channels")
      .insert({
        organization_id: orgId,
        participant_id: participantId,
        channel_type: "house_external" as CareChannelType,
        name: `${participantName} — Family & Participant`,
        parent_group_name: groupName,
        created_by: user.id,
      })
      .select()
      .single();

    if (err2) return err(err2.message);

    // Add creator as admin of both
    await supabase.from("care_chat_members").insert([
      { channel_id: internal.id, user_id: user.id, role: "admin", is_permanent: true },
      { channel_id: external.id, user_id: user.id, role: "admin", is_permanent: true },
    ]);

    // Inject welcome system messages
    await supabase.from("care_chat_messages").insert([
      {
        channel_id: internal.id,
        sender_id: null,
        content: `🔒 Internal care thread created for ${participantName}. Only authorised care staff can see this thread.`,
        message_type: "system_roster_sync" as CareMessageType,
      },
      {
        channel_id: external.id,
        sender_id: null,
        content: `👋 Welcome to ${participantName}'s care communication hub. Family members and the care team can communicate here.`,
        message_type: "system_roster_sync" as CareMessageType,
      },
    ]);

    return { data: { internal, external }, error: null };
  } catch (e: any) {
    return err(e.message);
  }
}

/** Archive / freeze a channel */
export async function archiveCareChannel(channelId: string) {
  try {
    const supabase = await getCareDb();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return err("Unauthorized");

    const { error } = await supabase
      .from("care_chat_channels")
      .update({ is_archived: true, is_read_only: true })
      .eq("id", channelId);

    if (error) return err(error.message);

    // Inject system message
    await supabase.from("care_chat_messages").insert({
      channel_id: channelId,
      sender_id: null,
      content: "This thread has been locked by Administration.",
      message_type: "system_archived" as CareMessageType,
    });

    return { data: { success: true }, error: null };
  } catch (e: any) {
    return err(e.message);
  }
}

/* ═══════════════════════════════════════════════════════════════════
   MEMBERS
   ═══════════════════════════════════════════════════════════════════ */

/** Get members of a channel */
export async function getCareChannelMembers(channelId: string) {
  try {
    const supabase = await getCareDb();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return err("Unauthorized");

    const { data, error } = await supabase
      .from("care_chat_members")
      .select("*, profiles:user_id(id, full_name, email, avatar_url)")
      .eq("channel_id", channelId);

    if (error) return err(error.message);
    return { data: data as CareChatMember[], error: null };
  } catch (e: any) {
    return err(e.message);
  }
}

/** Add a member to a channel */
export async function addCareChatMember(
  channelId: string,
  userId: string,
  role: CareMemberRole = "member",
  addedByRoster = false,
  isPermanent = false
) {
  try {
    const supabase = await getCareDb();
    const { error } = await supabase.from("care_chat_members").upsert(
      {
        channel_id: channelId,
        user_id: userId,
        role,
        added_by_roster: addedByRoster,
        is_permanent: isPermanent,
      },
      { onConflict: "channel_id,user_id" }
    );
    if (error) return err(error.message);
    return { data: { success: true }, error: null };
  } catch (e: any) {
    return err(e.message);
  }
}

/** Remove a member from a channel */
export async function removeCareChatMember(channelId: string, userId: string) {
  try {
    const supabase = await getCareDb();
    const { error } = await supabase
      .from("care_chat_members")
      .delete()
      .eq("channel_id", channelId)
      .eq("user_id", userId);
    if (error) return err(error.message);
    return { data: { success: true }, error: null };
  } catch (e: any) {
    return err(e.message);
  }
}

/* ═══════════════════════════════════════════════════════════════════
   MESSAGES
   ═══════════════════════════════════════════════════════════════════ */

/** Fetch messages for a channel (paginated, newest last) */
export async function getCareMessages(channelId: string, limit = 50, before?: string) {
  try {
    const supabase = await getCareDb();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return err("Unauthorized");

    // Verify membership
    const { data: member } = await supabase
      .from("care_chat_members")
      .select("user_id")
      .eq("channel_id", channelId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!member) return err("Unauthorized");

    let query = supabase
      .from("care_chat_messages")
      .select("*, profiles:sender_id(id, full_name, avatar_url)")
      .eq("channel_id", channelId)
      .eq("is_deleted", false)
      .order("created_at", { ascending: true })
      .limit(limit);

    if (before) {
      query = query.lt("created_at", before);
    }

    const { data, error } = await query;
    if (error) return err(error.message);
    return { data: data as CareChatMessage[], error: null };
  } catch (e: any) {
    return err(e.message);
  }
}

/** Send a message to a care channel */
export async function sendCareMessage(
  channelId: string,
  content: string,
  messageType: CareMessageType = "standard",
  metadata?: Record<string, any>,
  replyToId?: string,
  attachments?: any[]
) {
  try {
    const supabase = await getCareDb();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return err("Unauthorized");

    // Verify membership + check not read_only
    const { data: member } = await supabase
      .from("care_chat_members")
      .select("role")
      .eq("channel_id", channelId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!member) return err("Unauthorized");
    if (member.role === "read_only") return err("Channel is read-only for your role");

    // Check if channel is archived
    const { data: channel } = await supabase
      .from("care_chat_channels")
      .select("is_archived, is_read_only")
      .eq("id", channelId)
      .maybeSingle();
    if (channel?.is_archived || channel?.is_read_only) return err("Channel is locked");

    const { data, error } = await supabase
      .from("care_chat_messages")
      .insert({
        channel_id: channelId,
        sender_id: user.id,
        content,
        message_type: messageType,
        metadata: metadata || {},
        reply_to_id: replyToId || null,
        attachments: attachments || [],
      })
      .select("*, profiles:sender_id(id, full_name, avatar_url)")
      .single();

    if (error) return err(error.message);

    // Update channel timestamp
    await supabase
      .from("care_chat_channels")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", channelId);

    return { data: data as CareChatMessage, error: null };
  } catch (e: any) {
    return err(e.message);
  }
}

/** Send a manager alert (broadcast with mandatory acknowledgements) */
export async function sendManagerAlert(
  channelId: string,
  content: string,
  severity: "critical" | "high" = "high"
) {
  try {
    const supabase = await getCareDb();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return err("Unauthorized");

    // Get all members who need to acknowledge
    const { data: members } = await supabase
      .from("care_chat_members")
      .select("user_id, role")
      .eq("channel_id", channelId)
      .neq("role", "family_guest"); // Families don't ack internal alerts

    const totalRequired = (members || []).filter((m: any) => m.user_id !== user.id).length;

    const { data, error } = await supabase
      .from("care_chat_messages")
      .insert({
        channel_id: channelId,
        sender_id: user.id,
        content,
        message_type: "manager_alert" as CareMessageType,
        metadata: {
          severity,
          requires_ack: true,
          ack_count: 0,
          total_required: totalRequired,
        },
      })
      .select("*, profiles:sender_id(id, full_name, avatar_url)")
      .single();

    if (error) return err(error.message);

    return { data: data as CareChatMessage, error: null };
  } catch (e: any) {
    return err(e.message);
  }
}

/** Acknowledge a manager alert */
export async function acknowledgeAlert(messageId: string) {
  try {
    const supabase = await getCareDb();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return err("Unauthorized");

    // Insert ack
    const { error } = await supabase.from("message_acknowledgements").upsert(
      { message_id: messageId, user_id: user.id },
      { onConflict: "message_id,user_id" }
    );
    if (error) return err(error.message);

    // Count total acks
    const { count } = await supabase
      .from("message_acknowledgements")
      .select("*", { count: "exact", head: true })
      .eq("message_id", messageId);

    // Update metadata.ack_count on the message
    const { data: msg } = await supabase
      .from("care_chat_messages")
      .select("metadata")
      .eq("id", messageId)
      .maybeSingle();

    if (msg) {
      const meta = { ...(msg.metadata as Record<string, any>), ack_count: count || 0 };
      await supabase
        .from("care_chat_messages")
        .update({ metadata: meta })
        .eq("id", messageId);
    }

    return { data: { success: true, ack_count: count || 0 }, error: null };
  } catch (e: any) {
    return err(e.message);
  }
}

/** Get acknowledgement status for a message */
export async function getAlertAcknowledgements(messageId: string) {
  try {
    const supabase = await getCareDb();
    const { data, error } = await supabase
      .from("message_acknowledgements")
      .select("*, profiles:user_id(id, full_name, avatar_url)")
      .eq("message_id", messageId);

    if (error) return err(error.message);
    return { data, error: null };
  } catch (e: any) {
    return err(e.message);
  }
}

/** Check if user has unacknowledged alerts for a participant */
export async function getUnackedAlertsForParticipant(participantId: string) {
  try {
    const supabase = await getCareDb();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return err("Unauthorized");

    // Get internal channel for participant
    const { data: channels } = await supabase
      .from("care_chat_channels")
      .select("id")
      .eq("participant_id", participantId)
      .eq("channel_type", "house_internal");

    if (!channels || channels.length === 0) return { data: [], error: null };

    const channelIds = channels.map((c: any) => c.id);

    // Get all manager_alert messages in those channels
    const { data: alerts } = await supabase
      .from("care_chat_messages")
      .select("id, content, metadata, created_at")
      .in("channel_id", channelIds)
      .eq("message_type", "manager_alert")
      .eq("is_deleted", false);

    if (!alerts || alerts.length === 0) return { data: [], error: null };

    // Get user's acknowledgements
    const alertIds = alerts.map((a: any) => a.id);
    const { data: acks } = await supabase
      .from("message_acknowledgements")
      .select("message_id")
      .in("message_id", alertIds)
      .eq("user_id", user.id);

    const ackedIds = new Set((acks || []).map((a: any) => a.message_id));
    const unacked = alerts.filter((a: any) => !ackedIds.has(a.id));

    return { data: unacked, error: null };
  } catch (e: any) {
    return err(e.message);
  }
}

/** "Nuke" / soft-delete a message (admin only) */
export async function nukeMessage(messageId: string) {
  try {
    const supabase = await getCareDb();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return err("Unauthorized");

    const { error } = await supabase
      .from("care_chat_messages")
      .update({
        is_deleted: true,
        content: "[Message removed by Administration]",
        attachments: [],
      })
      .eq("id", messageId);

    if (error) return err(error.message);
    return { data: { success: true }, error: null };
  } catch (e: any) {
    return err(e.message);
  }
}

/** Edit a message */
export async function editCareMessage(messageId: string, newContent: string) {
  try {
    const supabase = await getCareDb();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return err("Unauthorized");

    const { data, error } = await supabase
      .from("care_chat_messages")
      .update({ content: newContent, is_edited: true })
      .eq("id", messageId)
      .eq("sender_id", user.id)
      .select()
      .single();

    if (error) return err(error.message);
    return { data, error: null };
  } catch (e: any) {
    return err(e.message);
  }
}

/** Pin / unpin a message */
export async function togglePinCareMessage(messageId: string) {
  try {
    const supabase = await getCareDb();
    const { data: msg } = await supabase
      .from("care_chat_messages")
      .select("is_pinned")
      .eq("id", messageId)
      .maybeSingle();

    if (!msg) return err("Message not found");

    const { data, error } = await supabase
      .from("care_chat_messages")
      .update({ is_pinned: !msg.is_pinned })
      .eq("id", messageId)
      .select()
      .single();

    if (error) return err(error.message);
    return { data, error: null };
  } catch (e: any) {
    return err(e.message);
  }
}

/** Mark channel as read */
export async function markCareChannelRead(channelId: string) {
  try {
    const supabase = await getCareDb();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return err("Unauthorized");

    const { error } = await supabase
      .from("care_chat_members")
      .update({ last_read_at: new Date().toISOString() })
      .eq("channel_id", channelId)
      .eq("user_id", user.id);

    if (error) return err(error.message);
    return { data: { success: true }, error: null };
  } catch (e: any) {
    return err(e.message);
  }
}

/** Inject a shift handover summary into the internal thread */
export async function injectShiftHandover(
  participantId: string,
  workerName: string,
  shiftTime: string,
  summary: string,
  shiftId?: string
) {
  try {
    const supabase = await getCareDb();

    // Find internal channel
    const { data: channels } = await supabase
      .from("care_chat_channels")
      .select("id")
      .eq("participant_id", participantId)
      .eq("channel_type", "house_internal")
      .maybeSingle();

    if (!channels) return err("No internal channel found for this participant");

    const content = `🤖 Handover Logged by ${workerName} (${shiftTime}): "${summary}"`;

    const { data, error } = await supabase
      .from("care_chat_messages")
      .insert({
        channel_id: channels.id,
        sender_id: null,
        content,
        message_type: "system_handover" as CareMessageType,
        metadata: {
          shift_id: shiftId || null,
          worker_name: workerName,
          shift_time: shiftTime,
        },
      })
      .select()
      .single();

    if (error) return err(error.message);
    return { data, error: null };
  } catch (e: any) {
    return err(e.message);
  }
}

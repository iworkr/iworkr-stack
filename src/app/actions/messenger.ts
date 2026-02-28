/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Database } from "@/lib/supabase/types";
import { z } from "zod";

type ChannelType = Database["public"]["Enums"]["channel_type"];
type MessageType = Database["public"]["Enums"]["message_type"];

/* ── Schemas ──────────────────────────────────────────── */

const CreateChannelSchema = z.object({
  type: z.string().min(1).max(50),
  name: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
  context_id: z.string().uuid().optional(),
  context_type: z.string().max(50).optional(),
  member_ids: z.array(z.string().uuid()).optional(),
});

const SendMessageSchema = z.object({
  channelId: z.string().uuid(),
  content: z.string().min(1, "Message cannot be empty").max(10000),
  type: z.string().max(50).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  replyToId: z.string().uuid().optional(),
});

const EditMessageSchema = z.object({
  content: z.string().min(1, "Message cannot be empty").max(10000),
});

/* ── Channels ──────────────────────────────────────────── */

export async function getChannels(orgId: string) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { data, error } = await supabase
      .from("channels")
      .select("*, channel_members!inner(user_id)")
      .eq("organization_id", orgId)
      .eq("channel_members.user_id", user.id)
      .eq("is_archived", false)
      .order("last_message_at", { ascending: false, nullsFirst: false });

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function getChannel(channelId: string) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    // Verify channel membership
    const { data: member } = await supabase
      .from("channel_members")
      .select("user_id")
      .eq("channel_id", channelId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!member) return { data: null, error: "Unauthorized" };

    const { data, error } = await supabase
      .from("channels")
      .select("*")
      .eq("id", channelId)
      .maybeSingle();

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function createChannel(orgId: string, params: {
  type: string;
  name?: string;
  description?: string;
  context_id?: string;
  context_type?: string;
  member_ids?: string[];
}) {
  try {
    // Validate input
    const parsed = CreateChannelSchema.safeParse(params);
    if (!parsed.success) {
      return { data: null, error: parsed.error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join("; ") };
    }

    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { data: channel, error } = await supabase
      .from("channels")
      .insert({
        organization_id: orgId,
        type: params.type as ChannelType,
        name: params.name || null,
        description: params.description || null,
        context_id: params.context_id || null,
        context_type: params.context_type || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) return { data: null, error: error.message };

    // Add creator as member
    const memberIds = new Set([user.id, ...(params.member_ids || [])]);
    const members = Array.from(memberIds).map(uid => ({
      channel_id: channel.id,
      user_id: uid,
      role: uid === user.id ? "admin" : "member",
    }));

    await supabase.from("channel_members").insert(members);

    return { data: channel, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function getOrCreateDM(orgId: string, otherUserId: string) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    // Check if DM already exists between these two users
    const { data: existing } = await supabase
      .from("channels")
      .select("*, channel_members!inner(user_id)")
      .eq("organization_id", orgId)
      .eq("type", "dm")
      .eq("channel_members.user_id", user.id);

    if (existing) {
      for (const ch of existing) {
        const { data: members } = await supabase
          .from("channel_members")
          .select("user_id")
          .eq("channel_id", ch.id);
        const memberIds = (members || []).map((m: any) => m.user_id);
        if (memberIds.length === 2 && memberIds.includes(otherUserId)) {
          return { data: ch, error: null };
        }
      }
    }

    // Create new DM
    return createChannel(orgId, { type: "dm", member_ids: [otherUserId] });
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function getOrCreateJobChannel(orgId: string, jobId: string, jobTitle: string) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    // Check if job channel exists
    const { data: existing } = await supabase
      .from("channels")
      .select("*")
      .eq("organization_id", orgId)
      .eq("type", "job_context")
      .eq("context_id", jobId)
      .maybeSingle();

    if (existing) return { data: existing, error: null };

    // Create job channel and add all org members
    const { data: channel, error } = await supabase
      .from("channels")
      .insert({
        organization_id: orgId,
        type: "job_context",
        name: jobTitle,
        context_id: jobId,
        context_type: "job",
        created_by: user.id,
      })
      .select()
      .single();

    if (error) return { data: null, error: error.message };

    // Add all active org members
    const { data: members } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", orgId)
      .eq("status", "active");

    if (members?.length) {
      await supabase.from("channel_members").insert(
        members.map((m: any) => ({ channel_id: channel.id, user_id: m.user_id }))
      );
    }

    return { data: channel, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function getChannelMembers(channelId: string) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { data, error } = await supabase
      .from("channel_members")
      .select("*, profiles(id, full_name, email, avatar_url)")
      .eq("channel_id", channelId);

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/* ── Messages ──────────────────────────────────────────── */

export async function getMessages(channelId: string, limit = 50, before?: string) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    // Verify channel membership
    const { data: member } = await supabase
      .from("channel_members")
      .select("user_id")
      .eq("channel_id", channelId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!member) return { data: null, error: "Unauthorized" };

    let query = supabase
      .from("messages")
      .select("*, profiles:sender_id(id, full_name, avatar_url)")
      .eq("channel_id", channelId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (before) {
      query = query.lt("created_at", before);
    }

    const { data, error } = await query;

    if (error) return { data: null, error: error.message };
    return { data: (data || []).reverse(), error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function sendMessage(channelId: string, content: string, type = "text", metadata?: any, replyToId?: string) {
  try {
    // Validate input
    const parsed = SendMessageSchema.safeParse({ channelId, content, type, metadata, replyToId });
    if (!parsed.success) {
      return { data: null, error: parsed.error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join("; ") };
    }

    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { data, error } = await supabase
      .from("messages")
      .insert({
        channel_id: channelId,
        sender_id: user.id,
        content,
        type: type as MessageType,
        metadata: metadata || {},
        reply_to_id: replyToId || null,
      })
      .select("*, profiles:sender_id(id, full_name, avatar_url)")
      .single();

    if (error) return { data: null, error: error.message };

    // Mark channel as read for sender
    await supabase
      .from("channel_members")
      .update({ last_read_at: new Date().toISOString() })
      .eq("channel_id", channelId)
      .eq("user_id", user.id);

    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function editMessage(messageId: string, content: string) {
  try {
    // Validate input
    const parsed = EditMessageSchema.safeParse({ content });
    if (!parsed.success) {
      return { data: null, error: parsed.error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join("; ") };
    }

    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { data, error } = await supabase
      .from("messages")
      .update({ content, edited_at: new Date().toISOString() })
      .eq("id", messageId)
      .eq("sender_id", user.id)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function deleteMessage(messageId: string) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { error } = await supabase
      .from("messages")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", messageId)
      .eq("sender_id", user.id);

    if (error) return { data: null, error: error.message };
    return { data: true, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function toggleReaction(messageId: string, emoji: string) {
  // Validate emoji: max 32 chars, only emoji/alphanumeric characters
  if (!emoji || emoji.length > 32) return { data: null, error: "Invalid emoji" };
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    // Get current reactions
    const { data: msg, error: fetchErr } = await supabase
      .from("messages")
      .select("reactions")
      .eq("id", messageId)
      .maybeSingle();

    if (fetchErr) return { data: null, error: fetchErr.message };
    if (!msg) return { data: null, error: "Message not found" };

    const reactions = (msg.reactions || {}) as Record<string, string[]>;
    const users: string[] = reactions[emoji] || [];

    if (users.includes(user.id)) {
      reactions[emoji] = users.filter((u: string) => u !== user.id);
      if (reactions[emoji].length === 0) delete reactions[emoji];
    } else {
      reactions[emoji] = [...users, user.id];
    }

    const { data, error } = await supabase
      .from("messages")
      .update({ reactions: reactions as unknown as Database["public"]["Tables"]["messages"]["Update"]["reactions"] })
      .eq("id", messageId)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

export async function markChannelRead(channelId: string) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: null };

    await supabase
      .from("channel_members")
      .update({ last_read_at: new Date().toISOString() })
      .eq("channel_id", channelId)
      .eq("user_id", user.id);

    return { error: null };
  } catch (err: any) {
    return { error: err.message };
  }
}

/* ── Mentions ──────────────────────────────────────────── */

export interface MentionItem {
  messageId: string;
  content: string;
  channelId: string;
  channelName: string;
  channelType: string;
  senderName: string;
  senderAvatarUrl: string | null;
  senderId: string;
  timestamp: string;
}

export async function getMentions(orgId: string, userId: string) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    // Verify caller matches authenticated user
    if (user.id !== userId) return { data: null, error: "Unauthorized" };

    // Verify org membership
    const { data: membership } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", orgId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership) return { data: null, error: "Not a member of this organization" };

    // Get all channels the user is a member of in this org
    const { data: userChannels, error: chErr } = await supabase
      .from("channels")
      .select("id, name, type, channel_members!inner(user_id)")
      .eq("organization_id", orgId)
      .eq("channel_members.user_id", user.id)
      .eq("is_archived", false);

    if (chErr) return { data: null, error: chErr.message };
    if (!userChannels || userChannels.length === 0) return { data: [], error: null };

    const channelIds = userChannels.map((ch: any) => ch.id);
    const channelMap = new Map<string, { name: string; type: string }>();
    for (const ch of userChannels) {
      channelMap.set(ch.id, { name: (ch as any).name || "Unknown", type: (ch as any).type });
    }

    // Search for messages containing @userId or @all
    const { data: messages, error: msgErr } = await supabase
      .from("messages")
      .select("id, content, channel_id, sender_id, created_at, profiles:sender_id(id, full_name, avatar_url)")
      .in("channel_id", channelIds)
      .is("deleted_at", null)
      .or(`content.ilike.%@${userId}%,content.ilike.%@all%`)
      .order("created_at", { ascending: false })
      .limit(50);

    if (msgErr) return { data: null, error: msgErr.message };

    const mentions: MentionItem[] = (messages || []).map((msg: any) => {
      const ch = channelMap.get(msg.channel_id);
      return {
        messageId: msg.id,
        content: msg.content,
        channelId: msg.channel_id,
        channelName: ch?.name || "Unknown",
        channelType: ch?.type || "group",
        senderName: msg.profiles?.full_name || "Unknown",
        senderAvatarUrl: msg.profiles?.avatar_url || null,
        senderId: msg.sender_id,
        timestamp: msg.created_at,
      };
    });

    return { data: mentions, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/* ── Polls ─────────────────────────────────────────────── */

export async function votePoll(messageId: string, optionIndex: number) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: "Unauthorized" };

    const { data: msg, error: fetchErr } = await supabase
      .from("messages")
      .select("metadata")
      .eq("id", messageId)
      .maybeSingle();

    if (fetchErr) return { data: null, error: fetchErr.message };
    if (!msg) return { data: null, error: "Message not found" };

    const meta = (msg.metadata || {}) as Record<string, any>;
    const votes: Record<string, string[]> = meta.votes || {};

    // Remove user from all options first
    for (const key of Object.keys(votes)) {
      votes[key] = (votes[key] || []).filter((uid: any) => uid !== user.id);
    }

    // Add to selected option
    const optKey = String(optionIndex);
    votes[optKey] = [...(votes[optKey] || []), user.id];

    const { data, error } = await supabase
      .from("messages")
      .update({ metadata: { ...meta, votes } as unknown as Database["public"]["Tables"]["messages"]["Update"]["metadata"] })
      .eq("id", messageId)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

/* ── Broadcast ────────────────────────────────────────── */

export async function broadcastMessage(orgId: string, message: string, senderId: string) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.id !== senderId) return { error: "Unauthorized" };

    const { data: existing } = await supabase
      .from("channels").select("id")
      .eq("organization_id", orgId).eq("type", "broadcast")
      .eq("name", "Team Broadcast").maybeSingle();

    let channelId = existing?.id;
    if (!channelId) {
      const { data: created, error: createErr } = await supabase
        .from("channels")
        .insert({ organization_id: orgId, type: "broadcast", name: "Team Broadcast", created_by: senderId })
        .select("id").single();
      if (createErr) return { error: createErr.message };
      channelId = created.id;
    }

    const { error: msgErr } = await supabase.from("messages").insert({
      channel_id: channelId, sender_id: senderId, content: message,
      type: "text", metadata: { broadcast: true },
    });
    if (msgErr) return { error: msgErr.message };

    await supabase.from("channels")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", channelId);

    return { success: true };
  } catch (err: any) {
    return { error: err.message || "Broadcast failed" };
  }
}

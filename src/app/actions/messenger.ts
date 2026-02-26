/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { z } from "zod";

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
        type: params.type,
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
        type,
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

    const reactions = msg.reactions || {};
    const users: string[] = reactions[emoji] || [];

    if (users.includes(user.id)) {
      reactions[emoji] = users.filter((u: string) => u !== user.id);
      if (reactions[emoji].length === 0) delete reactions[emoji];
    } else {
      reactions[emoji] = [...users, user.id];
    }

    const { data, error } = await supabase
      .from("messages")
      .update({ reactions })
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

    const meta = msg.metadata || {};
    const votes: Record<string, number[]> = meta.votes || {};

    // Remove user from all options first
    for (const key of Object.keys(votes)) {
      votes[key] = (votes[key] || []).filter((uid: any) => uid !== user.id);
    }

    // Add to selected option
    const optKey = String(optionIndex);
    votes[optKey] = [...(votes[optKey] || []), user.id];

    const { data, error } = await supabase
      .from("messages")
      .update({ metadata: { ...meta, votes } })
      .eq("id", messageId)
      .select()
      .single();

    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err.message };
  }
}

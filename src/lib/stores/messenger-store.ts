/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from "zustand";
import {
  getChannels,
  getMessages,
  sendMessage as sendMessageServer,
  toggleReaction as toggleReactionServer,
  markChannelRead as markChannelReadServer,
  votePoll as votePollServer,
  createChannel as createChannelServer,
  getOrCreateDM,
  getChannelMembers,
} from "@/app/actions/messenger";

/* ── Types ───────────────────────────────────────────────── */

export interface Channel {
  id: string;
  organization_id: string;
  type: "dm" | "group" | "job_context" | "broadcast";
  name: string | null;
  description: string | null;
  context_id: string | null;
  context_type: string | null;
  created_by: string | null;
  is_archived: boolean;
  metadata: any;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  channel_id: string;
  sender_id: string;
  content: string;
  type: "text" | "image" | "file" | "voice" | "location" | "poll" | "system";
  metadata: any;
  reactions: Record<string, string[]>;
  reply_to_id: string | null;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
  profiles?: { id: string; full_name: string; avatar_url: string | null };
  status?: "sending" | "sent" | "error";
}

export interface ChannelMember {
  channel_id: string;
  user_id: string;
  role: string;
  muted: boolean;
  last_read_at: string;
  joined_at: string;
  profiles?: { id: string; full_name: string; email: string; avatar_url: string | null };
}

type MessengerView = "triage" | "chat";

interface MessengerState {
  // Data
  channels: Channel[];
  messages: Record<string, Message[]>;
  members: Record<string, ChannelMember[]>;
  activeChannelId: string | null;
  activeView: MessengerView;

  // Loading
  channelsLoaded: boolean;
  messagesLoading: boolean;
  sendingMessage: boolean;

  // Actions
  loadChannels: (orgId: string) => Promise<void>;
  loadMessages: (channelId: string) => Promise<void>;
  loadMembers: (channelId: string) => Promise<void>;
  setActiveChannel: (channelId: string | null) => void;
  setActiveView: (view: MessengerView) => void;

  // Message actions
  sendMessage: (channelId: string, content: string, userId: string, userProfile: any, type?: string, metadata?: any, replyToId?: string) => Promise<void>;
  addRealtimeMessage: (message: Message) => void;
  toggleReaction: (messageId: string, emoji: string) => Promise<void>;
  markRead: (channelId: string) => Promise<void>;
  votePoll: (messageId: string, optionIndex: number) => Promise<void>;

  // Channel actions
  createGroupChannel: (orgId: string, name: string, memberIds: string[]) => Promise<Channel | null>;
  openDM: (orgId: string, otherUserId: string) => Promise<Channel | null>;
}

export const useMessengerStore = create<MessengerState>()((set, get) => ({
  channels: [],
  messages: {},
  members: {},
  activeChannelId: null,
  activeView: "chat",
  channelsLoaded: false,
  messagesLoading: false,
  sendingMessage: false,

  loadChannels: async (orgId: string) => {
    if (get().channelsLoaded) return;
    try {
      const result = await getChannels(orgId);
      set({ channels: result.data ?? [], channelsLoaded: true });
    } catch {
      set({ channelsLoaded: true });
    }
  },

  loadMessages: async (channelId: string) => {
    const existing = get().messages[channelId];
    if (existing?.length) return; // Already loaded

    set({ messagesLoading: true });
    const result = await getMessages(channelId);
    if (result.data) {
      set((s) => ({
        messages: { ...s.messages, [channelId]: result.data },
        messagesLoading: false,
      }));
    } else {
      set({ messagesLoading: false });
    }
  },

  loadMembers: async (channelId: string) => {
    const result = await getChannelMembers(channelId);
    if (result.data) {
      set((s) => ({
        members: { ...s.members, [channelId]: result.data },
      }));
    }
  },

  setActiveChannel: (channelId: string | null) => {
    set({ activeChannelId: channelId });
    if (channelId) {
      get().loadMessages(channelId);
      get().markRead(channelId);
    }
  },

  setActiveView: (view: MessengerView) => set({ activeView: view }),

  sendMessage: async (channelId, content, userId, userProfile, type = "text", metadata, replyToId) => {
    const tempId = crypto.randomUUID();
    const tempMessage: Message = {
      id: tempId,
      channel_id: channelId,
      sender_id: userId,
      content,
      type: type as Message["type"],
      metadata: metadata || {},
      reactions: {},
      reply_to_id: replyToId || null,
      edited_at: null,
      deleted_at: null,
      created_at: new Date().toISOString(),
      profiles: userProfile,
      status: "sending",
    };

    // Optimistic: add immediately
    set((s) => ({
      messages: {
        ...s.messages,
        [channelId]: [...(s.messages[channelId] || []), tempMessage],
      },
      sendingMessage: true,
    }));

    const result = await sendMessageServer(channelId, content, type, metadata, replyToId);

    if (result.data) {
      set((s) => ({
        messages: {
          ...s.messages,
          [channelId]: (s.messages[channelId] || []).map((m) =>
            m.id === tempId ? { ...result.data, status: "sent" } : m
          ),
        },
        sendingMessage: false,
      }));
    } else {
      set((s) => ({
        messages: {
          ...s.messages,
          [channelId]: (s.messages[channelId] || []).map((m) =>
            m.id === tempId ? { ...m, status: "error" } : m
          ),
        },
        sendingMessage: false,
      }));
    }
  },

  addRealtimeMessage: (message: Message) => {
    const channelId = message.channel_id;
    set((s) => {
      const existing = s.messages[channelId] || [];
      // Avoid duplicates
      if (existing.some((m) => m.id === message.id)) return s;
      return {
        messages: { ...s.messages, [channelId]: [...existing, message] },
      };
    });
  },

  toggleReaction: async (messageId: string, emoji: string) => {
    const result = await toggleReactionServer(messageId, emoji);
    if (result.data) {
      set((s) => {
        const updated: Record<string, Message[]> = {};
        for (const [chId, msgs] of Object.entries(s.messages)) {
          updated[chId] = msgs.map((m) =>
            m.id === messageId ? { ...m, reactions: result.data.reactions } : m
          );
        }
        return { messages: updated };
      });
    }
  },

  markRead: async (channelId: string) => {
    await markChannelReadServer(channelId);
  },

  votePoll: async (messageId: string, optionIndex: number) => {
    const result = await votePollServer(messageId, optionIndex);
    if (result.data) {
      set((s) => {
        const updated: Record<string, Message[]> = {};
        for (const [chId, msgs] of Object.entries(s.messages)) {
          updated[chId] = msgs.map((m) =>
            m.id === messageId ? { ...m, metadata: result.data.metadata } : m
          );
        }
        return { messages: updated };
      });
    }
  },

  createGroupChannel: async (orgId: string, name: string, memberIds: string[]) => {
    const result = await createChannelServer(orgId, { type: "group", name, member_ids: memberIds });
    if (result.data) {
      set((s) => ({ channels: [result.data, ...s.channels] }));
      return result.data;
    }
    return null;
  },

  openDM: async (orgId: string, otherUserId: string) => {
    const result = await getOrCreateDM(orgId, otherUserId);
    if (result.data) {
      set((s) => {
        const exists = s.channels.some((c) => c.id === result.data.id);
        return {
          channels: exists ? s.channels : [result.data, ...s.channels],
          activeChannelId: result.data.id,
        };
      });
      return result.data;
    }
    return null;
  },
}));

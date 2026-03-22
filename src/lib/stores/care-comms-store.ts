/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from "zustand";
import {
  getCareChannels,
  getCareMessages,
  sendCareMessage as sendCareMessageServer,
  markCareChannelRead as markReadServer,
  getCareChannelMembers,
  acknowledgeAlert as ackAlertServer,
  type CareChannel,
  type CareChatMessage,
  type CareChatMember,
  type CareMessageType,
} from "@/app/actions/care-comms";

/* ═══════════════════════════════════════════════════════════════════
   Care Comms Zustand Store — Project Echo
   Manages House Threads, DMs, Team Channels, and Realtime state
   ═══════════════════════════════════════════════════════════════════ */

export type CareCommsView = "triage" | "participants" | "direct" | "channels";

/* ── Re-exports for convenience ─────────────────────────────────── */
export type { CareChannel, CareChatMessage, CareChatMember };

/* ── Participant Hub (groups internal + external channels) ──────── */
export interface ParticipantHub {
  participantId: string;
  groupName: string;
  internalChannel: CareChannel | null;
  externalChannel: CareChannel | null;
}

interface CareCommsState {
  // Data
  channels: CareChannel[];
  messages: Record<string, CareChatMessage[]>; // channelId -> messages
  members: Record<string, CareChatMember[]>;
  participantHubs: ParticipantHub[];

  // UI state
  activeChannelId: string | null;
  activeView: CareCommsView;
  expandedHubId: string | null; // Which participant hub is expanded

  // Loading
  channelsLoaded: boolean;
  messagesLoading: boolean;
  sendingMessage: boolean;

  // Actions
  loadChannels: (orgId: string) => Promise<void>;
  loadMessages: (channelId: string) => Promise<void>;
  loadMembers: (channelId: string) => Promise<void>;
  setActiveChannel: (channelId: string | null) => void;
  setActiveView: (view: CareCommsView) => void;
  setExpandedHub: (participantId: string | null) => void;

  // Message actions
  sendMessage: (
    channelId: string,
    content: string,
    userId: string,
    userProfile: any,
    type?: CareMessageType,
    metadata?: any,
    replyToId?: string
  ) => Promise<void>;
  addRealtimeMessage: (message: CareChatMessage) => void;
  removeRealtimeMessage: (messageId: string) => void;
  acknowledgeAlert: (messageId: string) => Promise<void>;
  markRead: (channelId: string) => Promise<void>;

  // Reset
  reset: () => void;
}

/* ── Helpers ─────────────────────────────────────────────────────── */

function buildParticipantHubs(channels: CareChannel[]): ParticipantHub[] {
  const hubMap = new Map<string, ParticipantHub>();

  for (const ch of channels) {
    if (!ch.participant_id) continue;
    if (ch.channel_type !== "house_internal" && ch.channel_type !== "house_external") continue;

    if (!hubMap.has(ch.participant_id)) {
      hubMap.set(ch.participant_id, {
        participantId: ch.participant_id,
        groupName: ch.parent_group_name || "Participant Hub",
        internalChannel: null,
        externalChannel: null,
      });
    }

    const hub = hubMap.get(ch.participant_id)!;
    if (ch.channel_type === "house_internal") hub.internalChannel = ch;
    else if (ch.channel_type === "house_external") hub.externalChannel = ch;
  }

  return Array.from(hubMap.values());
}

/* ── Store ───────────────────────────────────────────────────────── */

export const useCareCommsStore = create<CareCommsState>()((set, get) => ({
  channels: [],
  messages: {},
  members: {},
  participantHubs: [],
  activeChannelId: null,
  activeView: "participants",
  expandedHubId: null,
  channelsLoaded: false,
  messagesLoading: false,
  sendingMessage: false,

  loadChannels: async (orgId: string) => {
    if (get().channelsLoaded) return;
    try {
      const result = await getCareChannels(orgId);
      const channels = (result.data ?? []) as CareChannel[];
      const hubs = buildParticipantHubs(channels);
      set({ channels, participantHubs: hubs, channelsLoaded: true });
    } catch {
      set({ channelsLoaded: true });
    }
  },

  loadMessages: async (channelId: string) => {
    const existing = get().messages[channelId];
    if (existing?.length) return;

    set({ messagesLoading: true });
    const result = await getCareMessages(channelId);
    if (result.data) {
      set((s) => ({
        messages: { ...s.messages, [channelId]: result.data as CareChatMessage[] },
        messagesLoading: false,
      }));
    } else {
      set({ messagesLoading: false });
    }
  },

  loadMembers: async (channelId: string) => {
    const result = await getCareChannelMembers(channelId);
    if (result.data) {
      set((s) => ({
        members: { ...s.members, [channelId]: result.data as CareChatMember[] },
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

  setActiveView: (view: CareCommsView) => set({ activeView: view }),

  setExpandedHub: (participantId: string | null) => set({ expandedHubId: participantId }),

  sendMessage: async (channelId, content, userId, userProfile, type = "standard", metadata, replyToId) => {
    const tempId = crypto.randomUUID();
    const tempMessage: CareChatMessage = {
      id: tempId,
      channel_id: channelId,
      sender_id: userId,
      content,
      message_type: type,
      attachments: [],
      metadata: metadata || {},
      reply_to_id: replyToId || null,
      is_edited: false,
      is_pinned: false,
      is_deleted: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      profiles: userProfile,
    };

    // Optimistic insert
    set((s) => ({
      messages: {
        ...s.messages,
        [channelId]: [...(s.messages[channelId] || []), tempMessage],
      },
      sendingMessage: true,
    }));

    const result = await sendCareMessageServer(channelId, content, type, metadata, replyToId);

    if (result.data) {
      set((s) => ({
        messages: {
          ...s.messages,
          [channelId]: (s.messages[channelId] || []).map((m) =>
            m.id === tempId ? (result.data as CareChatMessage) : m
          ),
        },
        sendingMessage: false,
      }));
    } else {
      // Mark as error — keep in UI with dimmed state
      set((s) => ({
        messages: {
          ...s.messages,
          [channelId]: (s.messages[channelId] || []).map((m) =>
            m.id === tempId ? { ...m, metadata: { ...m.metadata, _sendError: true } } : m
          ),
        },
        sendingMessage: false,
      }));
    }
  },

  addRealtimeMessage: (message: CareChatMessage) => {
    const channelId = message.channel_id;
    set((s) => {
      const existing = s.messages[channelId] || [];
      if (existing.some((m) => m.id === message.id)) return s;
      return {
        messages: { ...s.messages, [channelId]: [...existing, message] },
      };
    });
  },

  removeRealtimeMessage: (messageId: string) => {
    set((s) => {
      const updated: Record<string, CareChatMessage[]> = {};
      for (const [chId, msgs] of Object.entries(s.messages)) {
        updated[chId] = msgs.map((m) =>
          m.id === messageId
            ? { ...m, is_deleted: true, content: "[Message removed by Administration]" }
            : m
        );
      }
      return { messages: updated };
    });
  },

  acknowledgeAlert: async (messageId: string) => {
    const result = await ackAlertServer(messageId);
    if (result.data) {
      // Update ack_count in local message metadata
      set((s) => {
        const updated: Record<string, CareChatMessage[]> = {};
        for (const [chId, msgs] of Object.entries(s.messages)) {
          updated[chId] = msgs.map((m) =>
            m.id === messageId
              ? { ...m, metadata: { ...m.metadata, ack_count: result.data!.ack_count } }
              : m
          );
        }
        return { messages: updated };
      });
    }
  },

  markRead: async (channelId: string) => {
    await markReadServer(channelId);
  },

  reset: () => {
    set({
      channels: [],
      messages: {},
      members: {},
      participantHubs: [],
      activeChannelId: null,
      activeView: "participants",
      expandedHubId: null,
      channelsLoaded: false,
      messagesLoading: false,
      sendingMessage: false,
    });
  },
}));

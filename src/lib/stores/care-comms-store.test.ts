/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";

/* ═══════════════════════════════════════════════════════════════════
   Care Comms Zustand Store — Unit Tests
   Uses actual Zustand store (no mocking zustand itself).
   Server action dependencies are mocked.
   ═══════════════════════════════════════════════════════════════════ */

/* ── Mock server actions ─────────────────────────────────────────── */

const mockGetCareChannels = vi.fn().mockResolvedValue({ data: [] });
const mockGetCareMessages = vi.fn().mockResolvedValue({ data: [] });
const mockSendCareMessage = vi.fn().mockResolvedValue({ data: null });
const mockMarkCareChannelRead = vi.fn().mockResolvedValue({ data: null });
const mockGetCareChannelMembers = vi.fn().mockResolvedValue({ data: [] });
const mockAcknowledgeAlert = vi.fn().mockResolvedValue({ data: null });

vi.mock("@/app/actions/care-comms", () => ({
  getCareChannels: (...args: any[]) => mockGetCareChannels(...args),
  getCareMessages: (...args: any[]) => mockGetCareMessages(...args),
  sendCareMessage: (...args: any[]) => mockSendCareMessage(...args),
  markCareChannelRead: (...args: any[]) => mockMarkCareChannelRead(...args),
  getCareChannelMembers: (...args: any[]) => mockGetCareChannelMembers(...args),
  acknowledgeAlert: (...args: any[]) => mockAcknowledgeAlert(...args),
}));

import { useCareCommsStore, type CareCommsView, type ParticipantHub } from "./care-comms-store";
import type { CareChannel, CareChatMessage, CareChatMember } from "@/app/actions/care-comms";

/* ── Helpers ─────────────────────────────────────────────────────── */

/** Only the data portion — actions are defined by the store creator and
 *  survive a partial `setState` call. We use `setState(dataDefaults)` (without
 *  the `replace` flag) so the action functions stay intact. */
const dataDefaults = {
  channels: [] as CareChannel[],
  messages: {} as Record<string, CareChatMessage[]>,
  members: {} as Record<string, CareChatMember[]>,
  participantHubs: [] as ParticipantHub[],
  activeChannelId: null as string | null,
  activeView: "participants" as CareCommsView,
  expandedHubId: null as string | null,
  channelsLoaded: false,
  messagesLoading: false,
  sendingMessage: false,
};

function makeChannel(overrides: Partial<CareChannel> = {}): CareChannel {
  return {
    id: "ch-1",
    organization_id: "org-1",
    participant_id: null,
    channel_type: "team_channel",
    name: "General",
    description: null,
    is_archived: false,
    is_read_only: false,
    parent_group_name: null,
    created_by: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeMessage(overrides: Partial<CareChatMessage> = {}): CareChatMessage {
  return {
    id: "msg-1",
    channel_id: "ch-1",
    sender_id: "user-1",
    content: "Hello world",
    message_type: "standard",
    attachments: [],
    metadata: {},
    reply_to_id: null,
    is_edited: false,
    is_pinned: false,
    is_deleted: false,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

/* ── Reset state between tests ───────────────────────────────────── */

beforeEach(() => {
  vi.clearAllMocks();
  useCareCommsStore.setState(dataDefaults);
});

/* ═══════════════════════════════════════════════════════════════════
   Initial State
   ═══════════════════════════════════════════════════════════════════ */

describe("initial state", () => {
  it("has empty channels array", () => {
    expect(useCareCommsStore.getState().channels).toEqual([]);
  });

  it("has empty messages record", () => {
    expect(useCareCommsStore.getState().messages).toEqual({});
  });

  it("has empty members record", () => {
    expect(useCareCommsStore.getState().members).toEqual({});
  });

  it("has empty participantHubs array", () => {
    expect(useCareCommsStore.getState().participantHubs).toEqual([]);
  });

  it("has null activeChannelId", () => {
    expect(useCareCommsStore.getState().activeChannelId).toBeNull();
  });

  it('has "participants" as default activeView', () => {
    expect(useCareCommsStore.getState().activeView).toBe("participants");
  });

  it("has null expandedHubId", () => {
    expect(useCareCommsStore.getState().expandedHubId).toBeNull();
  });

  it("has channelsLoaded as false", () => {
    expect(useCareCommsStore.getState().channelsLoaded).toBe(false);
  });

  it("has messagesLoading as false", () => {
    expect(useCareCommsStore.getState().messagesLoading).toBe(false);
  });

  it("has sendingMessage as false", () => {
    expect(useCareCommsStore.getState().sendingMessage).toBe(false);
  });
});

/* ═══════════════════════════════════════════════════════════════════
   setActiveChannel
   ═══════════════════════════════════════════════════════════════════ */

describe("setActiveChannel", () => {
  it("sets the active channel ID", () => {
    useCareCommsStore.getState().setActiveChannel("ch-1");
    expect(useCareCommsStore.getState().activeChannelId).toBe("ch-1");
  });

  it("sets active channel to null", () => {
    useCareCommsStore.getState().setActiveChannel("ch-1");
    useCareCommsStore.getState().setActiveChannel(null);
    expect(useCareCommsStore.getState().activeChannelId).toBeNull();
  });

  it("triggers loadMessages when channel is set (non-null)", () => {
    mockGetCareMessages.mockResolvedValueOnce({ data: [] });
    useCareCommsStore.getState().setActiveChannel("ch-1");
    expect(mockGetCareMessages).toHaveBeenCalledWith("ch-1");
  });

  it("triggers markRead when channel is set (non-null)", () => {
    useCareCommsStore.getState().setActiveChannel("ch-1");
    expect(mockMarkCareChannelRead).toHaveBeenCalledWith("ch-1");
  });

  it("does NOT trigger loadMessages when channel is set to null", () => {
    useCareCommsStore.getState().setActiveChannel(null);
    expect(mockGetCareMessages).not.toHaveBeenCalled();
  });
});

/* ═══════════════════════════════════════════════════════════════════
   setActiveView
   ═══════════════════════════════════════════════════════════════════ */

describe("setActiveView", () => {
  it("sets the view to triage", () => {
    useCareCommsStore.getState().setActiveView("triage");
    expect(useCareCommsStore.getState().activeView).toBe("triage");
  });

  it("sets the view to direct", () => {
    useCareCommsStore.getState().setActiveView("direct");
    expect(useCareCommsStore.getState().activeView).toBe("direct");
  });

  it("sets the view to channels", () => {
    useCareCommsStore.getState().setActiveView("channels");
    expect(useCareCommsStore.getState().activeView).toBe("channels");
  });

  it("sets the view back to participants", () => {
    useCareCommsStore.getState().setActiveView("triage");
    useCareCommsStore.getState().setActiveView("participants");
    expect(useCareCommsStore.getState().activeView).toBe("participants");
  });
});

/* ═══════════════════════════════════════════════════════════════════
   setExpandedHub
   ═══════════════════════════════════════════════════════════════════ */

describe("setExpandedHub", () => {
  it("sets the expanded hub ID", () => {
    useCareCommsStore.getState().setExpandedHub("participant-1");
    expect(useCareCommsStore.getState().expandedHubId).toBe("participant-1");
  });

  it("clears the expanded hub ID when set to null", () => {
    useCareCommsStore.getState().setExpandedHub("participant-1");
    useCareCommsStore.getState().setExpandedHub(null);
    expect(useCareCommsStore.getState().expandedHubId).toBeNull();
  });
});

/* ═══════════════════════════════════════════════════════════════════
   addRealtimeMessage
   ═══════════════════════════════════════════════════════════════════ */

describe("addRealtimeMessage", () => {
  it("adds a message to the correct channel", () => {
    const msg = makeMessage({ id: "msg-rt-1", channel_id: "ch-1" });
    useCareCommsStore.getState().addRealtimeMessage(msg);

    const msgs = useCareCommsStore.getState().messages["ch-1"];
    expect(msgs).toHaveLength(1);
    expect(msgs[0].id).toBe("msg-rt-1");
  });

  it("does not duplicate a message with the same ID", () => {
    const msg = makeMessage({ id: "msg-rt-1", channel_id: "ch-1" });
    useCareCommsStore.getState().addRealtimeMessage(msg);
    useCareCommsStore.getState().addRealtimeMessage(msg);

    expect(useCareCommsStore.getState().messages["ch-1"]).toHaveLength(1);
  });

  it("appends messages to existing channel messages", () => {
    const msg1 = makeMessage({ id: "msg-1", channel_id: "ch-1" });
    const msg2 = makeMessage({ id: "msg-2", channel_id: "ch-1", content: "Second" });

    useCareCommsStore.getState().addRealtimeMessage(msg1);
    useCareCommsStore.getState().addRealtimeMessage(msg2);

    expect(useCareCommsStore.getState().messages["ch-1"]).toHaveLength(2);
  });

  it("keeps messages in separate channels", () => {
    const msg1 = makeMessage({ id: "msg-1", channel_id: "ch-1" });
    const msg2 = makeMessage({ id: "msg-2", channel_id: "ch-2" });

    useCareCommsStore.getState().addRealtimeMessage(msg1);
    useCareCommsStore.getState().addRealtimeMessage(msg2);

    expect(useCareCommsStore.getState().messages["ch-1"]).toHaveLength(1);
    expect(useCareCommsStore.getState().messages["ch-2"]).toHaveLength(1);
  });
});

/* ═══════════════════════════════════════════════════════════════════
   removeRealtimeMessage
   ═══════════════════════════════════════════════════════════════════ */

describe("removeRealtimeMessage", () => {
  it("marks a message as deleted", () => {
    const msg = makeMessage({ id: "msg-1", channel_id: "ch-1" });
    useCareCommsStore.setState({ messages: { "ch-1": [msg] } });

    useCareCommsStore.getState().removeRealtimeMessage("msg-1");

    const updated = useCareCommsStore.getState().messages["ch-1"][0];
    expect(updated.is_deleted).toBe(true);
  });

  it("replaces content with removal notice", () => {
    const msg = makeMessage({ id: "msg-1", channel_id: "ch-1", content: "Secret" });
    useCareCommsStore.setState({ messages: { "ch-1": [msg] } });

    useCareCommsStore.getState().removeRealtimeMessage("msg-1");

    const updated = useCareCommsStore.getState().messages["ch-1"][0];
    expect(updated.content).toBe("[Message removed by Administration]");
  });

  it("does not affect other messages in the same channel", () => {
    const msg1 = makeMessage({ id: "msg-1", channel_id: "ch-1", content: "Keep" });
    const msg2 = makeMessage({ id: "msg-2", channel_id: "ch-1", content: "Remove" });
    useCareCommsStore.setState({ messages: { "ch-1": [msg1, msg2] } });

    useCareCommsStore.getState().removeRealtimeMessage("msg-2");

    expect(useCareCommsStore.getState().messages["ch-1"][0].content).toBe("Keep");
    expect(useCareCommsStore.getState().messages["ch-1"][0].is_deleted).toBe(false);
  });

  it("does not affect messages in other channels", () => {
    const msg1 = makeMessage({ id: "msg-1", channel_id: "ch-1" });
    const msg2 = makeMessage({ id: "msg-2", channel_id: "ch-2" });
    useCareCommsStore.setState({ messages: { "ch-1": [msg1], "ch-2": [msg2] } });

    useCareCommsStore.getState().removeRealtimeMessage("msg-1");

    expect(useCareCommsStore.getState().messages["ch-2"][0].is_deleted).toBe(false);
  });
});

/* ═══════════════════════════════════════════════════════════════════
   loadChannels
   ═══════════════════════════════════════════════════════════════════ */

describe("loadChannels", () => {
  it("calls getCareChannels with the org ID", async () => {
    mockGetCareChannels.mockResolvedValueOnce({ data: [] });
    await useCareCommsStore.getState().loadChannels("org-1");
    expect(mockGetCareChannels).toHaveBeenCalledWith("org-1");
  });

  it("sets channelsLoaded to true after loading", async () => {
    mockGetCareChannels.mockResolvedValueOnce({ data: [] });
    await useCareCommsStore.getState().loadChannels("org-1");
    expect(useCareCommsStore.getState().channelsLoaded).toBe(true);
  });

  it("populates channels from server response", async () => {
    const ch = makeChannel({ id: "ch-1", name: "General" });
    mockGetCareChannels.mockResolvedValueOnce({ data: [ch] });
    await useCareCommsStore.getState().loadChannels("org-1");
    expect(useCareCommsStore.getState().channels).toHaveLength(1);
    expect(useCareCommsStore.getState().channels[0].name).toBe("General");
  });

  it("does not reload if channelsLoaded is already true", async () => {
    useCareCommsStore.setState({ channelsLoaded: true });
    await useCareCommsStore.getState().loadChannels("org-1");
    expect(mockGetCareChannels).not.toHaveBeenCalled();
  });

  it("builds participant hubs from house_internal and house_external channels", async () => {
    const internal = makeChannel({
      id: "ch-int",
      participant_id: "p-1",
      channel_type: "house_internal",
      parent_group_name: "John Doe Hub",
    });
    const external = makeChannel({
      id: "ch-ext",
      participant_id: "p-1",
      channel_type: "house_external",
      parent_group_name: "John Doe Hub",
    });
    mockGetCareChannels.mockResolvedValueOnce({ data: [internal, external] });
    await useCareCommsStore.getState().loadChannels("org-1");

    const hubs = useCareCommsStore.getState().participantHubs;
    expect(hubs).toHaveLength(1);
    expect(hubs[0].participantId).toBe("p-1");
    expect(hubs[0].internalChannel?.id).toBe("ch-int");
    expect(hubs[0].externalChannel?.id).toBe("ch-ext");
  });

  it("sets channelsLoaded true even when server call fails", async () => {
    mockGetCareChannels.mockRejectedValueOnce(new Error("Network error"));
    await useCareCommsStore.getState().loadChannels("org-1");
    expect(useCareCommsStore.getState().channelsLoaded).toBe(true);
  });
});

/* ═══════════════════════════════════════════════════════════════════
   loadMessages
   ═══════════════════════════════════════════════════════════════════ */

describe("loadMessages", () => {
  it("calls getCareMessages with the channel ID", async () => {
    mockGetCareMessages.mockResolvedValueOnce({ data: [] });
    await useCareCommsStore.getState().loadMessages("ch-1");
    expect(mockGetCareMessages).toHaveBeenCalledWith("ch-1");
  });

  it("skips loading if messages already exist for channel", async () => {
    const msg = makeMessage({ channel_id: "ch-1" });
    useCareCommsStore.setState({ messages: { "ch-1": [msg] } });

    await useCareCommsStore.getState().loadMessages("ch-1");
    expect(mockGetCareMessages).not.toHaveBeenCalled();
  });

  it("sets messagesLoading to false after loading completes", async () => {
    mockGetCareMessages.mockResolvedValueOnce({ data: [] });
    await useCareCommsStore.getState().loadMessages("ch-1");
    expect(useCareCommsStore.getState().messagesLoading).toBe(false);
  });
});

/* ═══════════════════════════════════════════════════════════════════
   loadMembers
   ═══════════════════════════════════════════════════════════════════ */

describe("loadMembers", () => {
  it("calls getCareChannelMembers with the channel ID", async () => {
    mockGetCareChannelMembers.mockResolvedValueOnce({ data: [] });
    await useCareCommsStore.getState().loadMembers("ch-1");
    expect(mockGetCareChannelMembers).toHaveBeenCalledWith("ch-1");
  });

  it("stores member data keyed by channel ID", async () => {
    const member: CareChatMember = {
      channel_id: "ch-1",
      user_id: "user-1",
      role: "admin",
      added_by_roster: false,
      is_permanent: true,
      last_read_at: "2026-01-01T00:00:00Z",
      joined_at: "2026-01-01T00:00:00Z",
    };
    mockGetCareChannelMembers.mockResolvedValueOnce({ data: [member] });
    await useCareCommsStore.getState().loadMembers("ch-1");

    const members = useCareCommsStore.getState().members["ch-1"];
    expect(members).toHaveLength(1);
    expect(members[0].user_id).toBe("user-1");
  });
});

/* ═══════════════════════════════════════════════════════════════════
   sendMessage (optimistic update)
   ═══════════════════════════════════════════════════════════════════ */

describe("sendMessage", () => {
  it("adds an optimistic message immediately", async () => {
    mockSendCareMessage.mockResolvedValueOnce({ data: null });

    const sendPromise = useCareCommsStore.getState().sendMessage(
      "ch-1",
      "Hello",
      "user-1",
      { id: "user-1", full_name: "Test User", avatar_url: null }
    );

    // Optimistic message should appear instantly
    const msgs = useCareCommsStore.getState().messages["ch-1"];
    expect(msgs).toBeDefined();
    expect(msgs.length).toBeGreaterThanOrEqual(1);
    expect(msgs[0].content).toBe("Hello");

    await sendPromise;
  });

  it("sets sendingMessage to true during send", async () => {
    let resolveSend: (v: any) => void;
    const sendPromise = new Promise((resolve) => { resolveSend = resolve; });
    mockSendCareMessage.mockReturnValueOnce(sendPromise);

    const promise = useCareCommsStore.getState().sendMessage(
      "ch-1",
      "Hello",
      "user-1",
      { id: "user-1", full_name: "Test User", avatar_url: null }
    );

    expect(useCareCommsStore.getState().sendingMessage).toBe(true);

    resolveSend!({ data: null });
    await promise;
  });

  it("sets sendingMessage to false after send completes", async () => {
    mockSendCareMessage.mockResolvedValueOnce({ data: null });

    await useCareCommsStore.getState().sendMessage(
      "ch-1",
      "Hello",
      "user-1",
      { id: "user-1", full_name: "Test User", avatar_url: null }
    );

    expect(useCareCommsStore.getState().sendingMessage).toBe(false);
  });

  it("replaces optimistic message with server response on success", async () => {
    const serverMsg = makeMessage({ id: "server-msg-1", content: "Hello" });
    mockSendCareMessage.mockResolvedValueOnce({ data: serverMsg });

    await useCareCommsStore.getState().sendMessage(
      "ch-1",
      "Hello",
      "user-1",
      { id: "user-1", full_name: "Test User", avatar_url: null }
    );

    const msgs = useCareCommsStore.getState().messages["ch-1"];
    expect(msgs).toHaveLength(1);
    expect(msgs[0].id).toBe("server-msg-1");
  });

  it("marks message with _sendError metadata on failure", async () => {
    mockSendCareMessage.mockResolvedValueOnce({ data: null, error: "Failed" });

    await useCareCommsStore.getState().sendMessage(
      "ch-1",
      "Hello",
      "user-1",
      { id: "user-1", full_name: "Test User", avatar_url: null }
    );

    const msgs = useCareCommsStore.getState().messages["ch-1"];
    expect(msgs).toHaveLength(1);
    expect(msgs[0].metadata._sendError).toBe(true);
  });
});

/* ═══════════════════════════════════════════════════════════════════
   acknowledgeAlert
   ═══════════════════════════════════════════════════════════════════ */

describe("acknowledgeAlert", () => {
  it("calls the server action with the message ID", async () => {
    mockAcknowledgeAlert.mockResolvedValueOnce({ data: { ack_count: 1 } });
    const msg = makeMessage({ id: "msg-alert-1", channel_id: "ch-1" });
    useCareCommsStore.setState({ messages: { "ch-1": [msg] } });

    await useCareCommsStore.getState().acknowledgeAlert("msg-alert-1");
    expect(mockAcknowledgeAlert).toHaveBeenCalledWith("msg-alert-1");
  });

  it("updates ack_count in message metadata on success", async () => {
    mockAcknowledgeAlert.mockResolvedValueOnce({ data: { ack_count: 3 } });
    const msg = makeMessage({ id: "msg-alert-1", channel_id: "ch-1" });
    useCareCommsStore.setState({ messages: { "ch-1": [msg] } });

    await useCareCommsStore.getState().acknowledgeAlert("msg-alert-1");

    const updated = useCareCommsStore.getState().messages["ch-1"][0];
    expect(updated.metadata.ack_count).toBe(3);
  });
});

/* ═══════════════════════════════════════════════════════════════════
   markRead
   ═══════════════════════════════════════════════════════════════════ */

describe("markRead", () => {
  it("calls the server action with the channel ID", async () => {
    await useCareCommsStore.getState().markRead("ch-1");
    expect(mockMarkCareChannelRead).toHaveBeenCalledWith("ch-1");
  });
});

/* ═══════════════════════════════════════════════════════════════════
   Store reset between tests (meta-test)
   ═══════════════════════════════════════════════════════════════════ */

describe("store isolation", () => {
  it("state is clean at the start of each test", () => {
    const state = useCareCommsStore.getState();
    expect(state.channels).toEqual([]);
    expect(state.messages).toEqual({});
    expect(state.activeChannelId).toBeNull();
    expect(state.channelsLoaded).toBe(false);
  });

  it("mutations in one test do not leak to the next", () => {
    useCareCommsStore.getState().setActiveView("triage");
    expect(useCareCommsStore.getState().activeView).toBe("triage");
    // Next test will verify reset
  });

  it("confirms state was reset from previous test", () => {
    expect(useCareCommsStore.getState().activeView).toBe("participants");
  });
});

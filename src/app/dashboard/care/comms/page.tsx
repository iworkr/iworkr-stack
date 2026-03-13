"use client";

/* ═══════════════════════════════════════════════════════════════════
   Care Communications — "House Thread" Messaging Engine
   Project Echo · 3-Pane Obsidian Layout
   
   Pane 1: Global sidebar (handled by shell)
   Pane 2: Routing Ledger (320px) — TRIAGE / HOUSE THREADS / DMs / CHANNELS
   Pane 3: Active Signal — Chat interface
   ═══════════════════════════════════════════════════════════════════ */

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Plus,
  Hash,
  Lock,
  Globe,
  Users,
  MessageCircle,
  Bell,
  AlertTriangle,
  Shield,
  Send,
  Paperclip,
  Pin,
  Trash2,
  ChevronDown,
  ChevronRight,
  Radio,
  Megaphone,
  Check,
  CheckCheck,
  Clock,
  X,
} from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { LottieIcon } from "@/components/dashboard/lottie-icon";
import { radarScanAnimation } from "@/components/dashboard/lottie-data-relay";

/* ═══════════════════════════════════════════════════════════════════
   TYPES & MOCK DATA
   ═══════════════════════════════════════════════════════════════════ */

type ChannelType = "house_internal" | "house_external" | "direct_message" | "team_channel";
type MessageType = "standard" | "system_handover" | "manager_alert" | "system_roster_sync" | "system_message_removed";

interface MockChannel {
  id: string;
  channel_type: ChannelType;
  participant_id: string | null;
  name: string;
  parent_group_name: string | null;
  is_archived: boolean;
  is_read_only: boolean;
  unread_count: number;
  last_message?: string;
  last_message_at?: string;
}

interface MockMessage {
  id: string;
  channel_id: string;
  sender_id: string | null;
  sender_name: string;
  sender_avatar: string | null;
  content: string;
  message_type: MessageType;
  metadata: Record<string, unknown>;
  is_pinned: boolean;
  is_deleted: boolean;
  created_at: string;
}

interface ParticipantHub {
  participantId: string;
  participantName: string;
  groupName: string;
  internalChannel: MockChannel;
  externalChannel: MockChannel;
}

/* ── Mock data generation ─────────────────────────────────────── */

const MOCK_PARTICIPANTS: ParticipantHub[] = [
  {
    participantId: "p1",
    participantName: "John Smith",
    groupName: "The Smith House",
    internalChannel: {
      id: "ch-p1-int",
      channel_type: "house_internal",
      participant_id: "p1",
      name: "John Smith — Internal Care",
      parent_group_name: "The Smith House",
      is_archived: false,
      is_read_only: false,
      unread_count: 3,
      last_message: "Handover: morning meds administered, John in good spirits.",
      last_message_at: "2026-03-12T14:30:00Z",
    },
    externalChannel: {
      id: "ch-p1-ext",
      channel_type: "house_external",
      participant_id: "p1",
      name: "John Smith — Family",
      parent_group_name: "The Smith House",
      is_archived: false,
      is_read_only: false,
      unread_count: 1,
      last_message: "Hi team, John's wheelchair is at repair today.",
      last_message_at: "2026-03-12T09:15:00Z",
    },
  },
  {
    participantId: "p2",
    participantName: "Sarah Williams",
    groupName: "Williams Residence",
    internalChannel: {
      id: "ch-p2-int",
      channel_type: "house_internal",
      participant_id: "p2",
      name: "Sarah Williams — Internal Care",
      parent_group_name: "Williams Residence",
      is_archived: false,
      is_read_only: false,
      unread_count: 0,
      last_message: "Night shift completed. Sarah slept well.",
      last_message_at: "2026-03-12T07:00:00Z",
    },
    externalChannel: {
      id: "ch-p2-ext",
      channel_type: "house_external",
      participant_id: "p2",
      name: "Sarah Williams — Family",
      parent_group_name: "Williams Residence",
      is_archived: false,
      is_read_only: false,
      unread_count: 0,
      last_message: "Thank you for the update!",
      last_message_at: "2026-03-11T16:45:00Z",
    },
  },
  {
    participantId: "p3",
    participantName: "Michael Chen",
    groupName: "Chen SIL House",
    internalChannel: {
      id: "ch-p3-int",
      channel_type: "house_internal",
      participant_id: "p3",
      name: "Michael Chen — Internal Care",
      parent_group_name: "Chen SIL House",
      is_archived: false,
      is_read_only: false,
      unread_count: 5,
      last_message: "⚠️ ALERT: New choking risk — all food must be pureed.",
      last_message_at: "2026-03-12T16:00:00Z",
    },
    externalChannel: {
      id: "ch-p3-ext",
      channel_type: "house_external",
      participant_id: "p3",
      name: "Michael Chen — Family",
      parent_group_name: "Chen SIL House",
      is_archived: false,
      is_read_only: false,
      unread_count: 2,
      last_message: "Michael enjoyed the park outing today.",
      last_message_at: "2026-03-12T15:30:00Z",
    },
  },
  {
    participantId: "p4",
    participantName: "Emma Davies",
    groupName: "Davies Supported Living",
    internalChannel: {
      id: "ch-p4-int",
      channel_type: "house_internal",
      participant_id: "p4",
      name: "Emma Davies — Internal Care",
      parent_group_name: "Davies Supported Living",
      is_archived: false,
      is_read_only: false,
      unread_count: 1,
      last_message: "Emma completed her physio exercises.",
      last_message_at: "2026-03-12T11:20:00Z",
    },
    externalChannel: {
      id: "ch-p4-ext",
      channel_type: "house_external",
      participant_id: "p4",
      name: "Emma Davies — Family",
      parent_group_name: "Davies Supported Living",
      is_archived: false,
      is_read_only: false,
      unread_count: 0,
      last_message: "Will pick up Emma at 3pm Saturday.",
      last_message_at: "2026-03-11T20:00:00Z",
    },
  },
];

const MOCK_DMS: MockChannel[] = [
  {
    id: "dm-1", channel_type: "direct_message", participant_id: null,
    name: "Jane Smith", parent_group_name: null,
    is_archived: false, is_read_only: false, unread_count: 2,
    last_message: "Can you cover my Thursday shift?",
    last_message_at: "2026-03-12T13:40:00Z",
  },
  {
    id: "dm-2", channel_type: "direct_message", participant_id: null,
    name: "Dr. Rebecca Lane", parent_group_name: null,
    is_archived: false, is_read_only: false, unread_count: 0,
    last_message: "Blood test results came back normal.",
    last_message_at: "2026-03-11T10:00:00Z",
  },
];

const MOCK_TEAM_CHANNELS: MockChannel[] = [
  {
    id: "tc-1", channel_type: "team_channel", participant_id: null,
    name: "general-announcements", parent_group_name: null,
    is_archived: false, is_read_only: false, unread_count: 1,
    last_message: "Staff meeting this Friday at 2pm.",
    last_message_at: "2026-03-12T08:00:00Z",
  },
  {
    id: "tc-2", channel_type: "team_channel", participant_id: null,
    name: "weekend-staff", parent_group_name: null,
    is_archived: false, is_read_only: false, unread_count: 0,
    last_message: "Roster for this weekend is finalised.",
    last_message_at: "2026-03-10T17:00:00Z",
  },
  {
    id: "tc-3", channel_type: "team_channel", participant_id: null,
    name: "maintenance-requests", parent_group_name: null,
    is_archived: false, is_read_only: false, unread_count: 4,
    last_message: "Hot water system in Unit 3 is leaking again.",
    last_message_at: "2026-03-12T12:00:00Z",
  },
];

function generateMockMessages(channelId: string, channelType: ChannelType): MockMessage[] {
  const isInternal = channelType === "house_internal";
  const base: MockMessage[] = [];
  const now = Date.now();

  // System welcome
  base.push({
    id: `${channelId}-sys-welcome`,
    channel_id: channelId,
    sender_id: null,
    sender_name: "System",
    sender_avatar: null,
    content: isInternal
      ? "🔒 Internal care thread created. Only authorised care staff can see this thread."
      : "👋 Welcome to this care communication hub. Family members and the care team can communicate here.",
    message_type: "system_roster_sync",
    metadata: {},
    is_pinned: false,
    is_deleted: false,
    created_at: new Date(now - 7 * 86400000).toISOString(),
  });

  if (isInternal) {
    // Handover
    base.push({
      id: `${channelId}-handover-1`,
      channel_id: channelId,
      sender_id: null,
      sender_name: "System",
      sender_avatar: null,
      content: '🤖 Handover Logged by Jane Smith (07:00-15:00): "Great shift. Administered morning meds on schedule. Note: We are running low on size 4 gloves."',
      message_type: "system_handover",
      metadata: { worker_name: "Jane Smith", shift_time: "07:00-15:00" },
      is_pinned: false,
      is_deleted: false,
      created_at: new Date(now - 6 * 3600000).toISOString(),
    });

    // Roster sync
    base.push({
      id: `${channelId}-roster-1`,
      channel_id: channelId,
      sender_id: null,
      sender_name: "System",
      sender_avatar: null,
      content: "📋 Bob Wilson, Maria Garcia automatically added to thread via roster sync.",
      message_type: "system_roster_sync",
      metadata: {},
      is_pinned: false,
      is_deleted: false,
      created_at: new Date(now - 5 * 3600000).toISOString(),
    });

    // Regular messages
    base.push({
      id: `${channelId}-msg-1`,
      channel_id: channelId,
      sender_id: "u1",
      sender_name: "Bob Wilson",
      sender_avatar: null,
      content: "Just reviewed the handover — noted on the gloves. I'll grab some from the supply room before my shift ends.",
      message_type: "standard",
      metadata: {},
      is_pinned: false,
      is_deleted: false,
      created_at: new Date(now - 4 * 3600000).toISOString(),
    });

    base.push({
      id: `${channelId}-msg-2`,
      channel_id: channelId,
      sender_id: "u2",
      sender_name: "Maria Garcia",
      sender_avatar: null,
      content: "Thanks Bob. Also heads up — physio session tomorrow at 10am. Make sure the transfer sling is set up.",
      message_type: "standard",
      metadata: {},
      is_pinned: false,
      is_deleted: false,
      created_at: new Date(now - 3.5 * 3600000).toISOString(),
    });

    // Manager alert
    if (channelId.includes("p3")) {
      base.push({
        id: `${channelId}-alert-1`,
        channel_id: channelId,
        sender_id: "u-mgr",
        sender_name: "Karen Mitchell (Manager)",
        sender_avatar: null,
        content: "⚠️ CRITICAL UPDATE: Speech pathologist has updated Michael's swallowing assessment. ALL food must now be pureed consistency. Please acknowledge below.",
        message_type: "manager_alert",
        metadata: { severity: "critical", requires_ack: true, ack_count: 2, total_required: 5 },
        is_pinned: true,
        is_deleted: false,
        created_at: new Date(now - 2 * 3600000).toISOString(),
      });
    }
  } else {
    // External thread messages
    base.push({
      id: `${channelId}-ext-1`,
      channel_id: channelId,
      sender_id: "u-family",
      sender_name: "Linda (Mother)",
      sender_avatar: null,
      content: "Hi team, just wanted to let you know we'll be visiting this Saturday afternoon. Is there anything we should bring?",
      message_type: "standard",
      metadata: {},
      is_pinned: false,
      is_deleted: false,
      created_at: new Date(now - 24 * 3600000).toISOString(),
    });

    base.push({
      id: `${channelId}-ext-2`,
      channel_id: channelId,
      sender_id: "u2",
      sender_name: "Maria Garcia",
      sender_avatar: null,
      content: "Hi Linda! That would be lovely. If you could bring some of his favourite music CDs, that would be great. He's been enjoying listening to them during afternoon activities.",
      message_type: "standard",
      metadata: {},
      is_pinned: false,
      is_deleted: false,
      created_at: new Date(now - 20 * 3600000).toISOString(),
    });

    base.push({
      id: `${channelId}-ext-3`,
      channel_id: channelId,
      sender_id: "u-family",
      sender_name: "Linda (Mother)",
      sender_avatar: null,
      content: "Perfect, will do! Thank you for taking such great care of him. 💙",
      message_type: "standard",
      metadata: {},
      is_pinned: false,
      is_deleted: false,
      created_at: new Date(now - 18 * 3600000).toISOString(),
    });
  }

  // DM messages
  if (channelType === "direct_message") {
    return [
      {
        id: `${channelId}-dm-1`, channel_id: channelId,
        sender_id: "u-other", sender_name: channelId === "dm-1" ? "Jane Smith" : "Dr. Rebecca Lane",
        sender_avatar: null,
        content: channelId === "dm-1" ? "Hey, are you available to cover my Thursday afternoon shift?" : "Blood test results came back normal. No further action needed.",
        message_type: "standard", metadata: {}, is_pinned: false, is_deleted: false,
        created_at: new Date(now - 5 * 3600000).toISOString(),
      },
      {
        id: `${channelId}-dm-2`, channel_id: channelId,
        sender_id: "u-self", sender_name: "You",
        sender_avatar: null,
        content: channelId === "dm-1" ? "Let me check my roster and get back to you." : "Great news, thanks for letting me know!",
        message_type: "standard", metadata: {}, is_pinned: false, is_deleted: false,
        created_at: new Date(now - 4.5 * 3600000).toISOString(),
      },
    ];
  }

  // Team channel messages
  if (channelType === "team_channel") {
    return [
      {
        id: `${channelId}-tc-1`, channel_id: channelId,
        sender_id: "u-mgr", sender_name: "Karen Mitchell",
        sender_avatar: null,
        content: channelId === "tc-1" ? "Staff meeting this Friday at 2pm in the training room. Attendance is mandatory." :
          channelId === "tc-2" ? "Weekend roster is finalised. Please check your shifts." :
          "Hot water system in Unit 3 is leaking again. Plumber booked for Thursday.",
        message_type: "standard", metadata: {}, is_pinned: false, is_deleted: false,
        created_at: new Date(now - 8 * 3600000).toISOString(),
      },
    ];
  }

  return base;
}

/* ── Helpers ───────────────────────────────────────────────────── */

function getInitials(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function formatRelTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: true });
}

const AVATAR_GRADIENTS = [
  "from-emerald-600/40 to-emerald-900/40",
  "from-blue-600/40 to-blue-900/40",
  "from-purple-600/40 to-purple-900/40",
  "from-amber-600/40 to-amber-900/40",
  "from-rose-600/40 to-rose-900/40",
  "from-cyan-600/40 to-cyan-900/40",
];

function getGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}

/* ═══════════════════════════════════════════════════════════════════
   COMPONENTS
   ═══════════════════════════════════════════════════════════════════ */

type ViewMode = "triage" | "participants" | "direct" | "channels";

/* ── Routing Ledger (Pane 2) ──────────────────────────────────── */

function RoutingLedger({
  activeView,
  setActiveView,
  activeChannelId,
  setActiveChannel,
  expandedHub,
  setExpandedHub,
  search,
  setSearch,
}: {
  activeView: ViewMode;
  setActiveView: (v: ViewMode) => void;
  activeChannelId: string | null;
  setActiveChannel: (id: string, type: ChannelType) => void;
  expandedHub: string | null;
  setExpandedHub: (id: string | null) => void;
  search: string;
  setSearch: (s: string) => void;
}) {
  const views: { id: ViewMode; label: string; icon: typeof Bell }[] = [
    { id: "triage", label: "Triage", icon: Bell },
    { id: "participants", label: "Participants", icon: Users },
    { id: "direct", label: "Direct", icon: MessageCircle },
    { id: "channels", label: "Channels", icon: Hash },
  ];

  const filteredHubs = useMemo(() => {
    if (!search) return MOCK_PARTICIPANTS;
    const q = search.toLowerCase();
    return MOCK_PARTICIPANTS.filter(
      (h) =>
        h.participantName.toLowerCase().includes(q) ||
        h.groupName.toLowerCase().includes(q)
    );
  }, [search]);

  const filteredDMs = useMemo(() => {
    if (!search) return MOCK_DMS;
    const q = search.toLowerCase();
    return MOCK_DMS.filter((d) => d.name.toLowerCase().includes(q));
  }, [search]);

  const filteredChannels = useMemo(() => {
    if (!search) return MOCK_TEAM_CHANNELS;
    const q = search.toLowerCase();
    return MOCK_TEAM_CHANNELS.filter((c) => c.name.toLowerCase().includes(q));
  }, [search]);

  // Count unread for triage
  const triageCount = useMemo(() => {
    let count = 0;
    MOCK_PARTICIPANTS.forEach((h) => {
      count += h.internalChannel.unread_count + h.externalChannel.unread_count;
    });
    MOCK_DMS.forEach((d) => (count += d.unread_count));
    MOCK_TEAM_CHANNELS.forEach((c) => (count += c.unread_count));
    return count;
  }, []);

  return (
    <div className="flex h-full w-[320px] min-w-[320px] flex-col border-r border-white/[0.04] bg-[#070707]">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <span className="font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">
          CARE COMMS
        </span>
        <button className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-600 transition-colors hover:bg-white/[0.04] hover:text-zinc-400">
          <Plus size={14} />
        </button>
      </div>

      {/* ── Search ── */}
      <div className="relative mx-3 mt-1 mb-2">
        <Search
          size={13}
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-600"
        />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search threads…"
          className="w-full rounded-lg bg-white/[0.03] py-1.5 pl-8 pr-3 text-[12px] text-zinc-300 placeholder:text-zinc-700 outline-none border border-transparent focus:border-emerald-500/30 transition-colors"
        />
      </div>

      {/* ── View tabs ── */}
      <div className="flex gap-0.5 mx-3 mb-2 p-0.5 rounded-lg bg-white/[0.02]">
        {views.map((v) => (
          <button
            key={v.id}
            onClick={() => setActiveView(v.id)}
            className={`relative flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-colors ${
              activeView === v.id
                ? "text-white"
                : "text-zinc-600 hover:text-zinc-400"
            }`}
          >
            {activeView === v.id && (
              <motion.div
                layoutId="ledger-tab"
                className="absolute inset-0 rounded-md bg-white/[0.06]"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1">
              <v.icon size={11} />
              {v.label}
              {v.id === "triage" && triageCount > 0 && (
                <span className="ml-0.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-emerald-500/20 px-1 text-[8px] font-bold text-emerald-400">
                  {triageCount}
                </span>
              )}
            </span>
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <AnimatePresence mode="wait">
          {activeView === "triage" && (
            <motion.div
              key="triage"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="px-1"
            >
              <TriageList
                activeChannelId={activeChannelId}
                setActiveChannel={setActiveChannel}
              />
            </motion.div>
          )}

          {activeView === "participants" && (
            <motion.div
              key="participants"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="px-1"
            >
              {filteredHubs.map((hub) => (
                <ParticipantHubItem
                  key={hub.participantId}
                  hub={hub}
                  isExpanded={expandedHub === hub.participantId}
                  onToggle={() =>
                    setExpandedHub(
                      expandedHub === hub.participantId ? null : hub.participantId
                    )
                  }
                  activeChannelId={activeChannelId}
                  setActiveChannel={setActiveChannel}
                />
              ))}
            </motion.div>
          )}

          {activeView === "direct" && (
            <motion.div
              key="direct"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="px-1"
            >
              {filteredDMs.map((dm) => (
                <ChannelRow
                  key={dm.id}
                  channel={dm}
                  active={activeChannelId === dm.id}
                  onClick={() => setActiveChannel(dm.id, dm.channel_type)}
                />
              ))}
            </motion.div>
          )}

          {activeView === "channels" && (
            <motion.div
              key="channels"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="px-1"
            >
              {filteredChannels.map((ch) => (
                <ChannelRow
                  key={ch.id}
                  channel={ch}
                  active={activeChannelId === ch.id}
                  onClick={() => setActiveChannel(ch.id, ch.channel_type)}
                  showHash
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ── Triage List ───────────────────────────────────────────────── */

function TriageList({
  activeChannelId,
  setActiveChannel,
}: {
  activeChannelId: string | null;
  setActiveChannel: (id: string, type: ChannelType) => void;
}) {
  // Collect all unread items
  const triageItems = useMemo(() => {
    const items: { channel: MockChannel; hubName?: string; isAlert?: boolean }[] = [];

    MOCK_PARTICIPANTS.forEach((hub) => {
      if (hub.internalChannel.unread_count > 0) {
        items.push({
          channel: hub.internalChannel,
          hubName: hub.participantName,
          isAlert: hub.internalChannel.last_message?.includes("ALERT"),
        });
      }
      if (hub.externalChannel.unread_count > 0) {
        items.push({ channel: hub.externalChannel, hubName: hub.participantName });
      }
    });
    MOCK_DMS.forEach((dm) => {
      if (dm.unread_count > 0) items.push({ channel: dm });
    });
    MOCK_TEAM_CHANNELS.forEach((tc) => {
      if (tc.unread_count > 0) items.push({ channel: tc });
    });

    // Sort: alerts first, then by time
    items.sort((a, b) => {
      if (a.isAlert && !b.isAlert) return -1;
      if (!a.isAlert && b.isAlert) return 1;
      return (
        new Date(b.channel.last_message_at || "").getTime() -
        new Date(a.channel.last_message_at || "").getTime()
      );
    });

    return items;
  }, []);

  if (triageItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Check size={20} className="mb-2 text-emerald-500" />
        <p className="text-[12px] font-medium text-zinc-400">All caught up</p>
        <p className="mt-1 text-[11px] text-zinc-600">No unread messages or alerts</p>
      </div>
    );
  }

  return (
    <div>
      {triageItems.map((item) => (
        <button
          key={item.channel.id}
          onClick={() => setActiveChannel(item.channel.id, item.channel.channel_type)}
          className={`group flex w-full items-start gap-2.5 rounded-lg px-3 py-2.5 text-left transition-colors ${
            activeChannelId === item.channel.id
              ? "bg-white/[0.06]"
              : "hover:bg-white/[0.03]"
          }`}
        >
          {/* Indicator */}
          <div className="mt-1 flex-shrink-0">
            {item.isAlert ? (
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-rose-500/20">
                <AlertTriangle size={13} className="text-rose-400" />
              </div>
            ) : item.channel.channel_type === "house_internal" ? (
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500/15">
                <Lock size={12} className="text-blue-400" />
              </div>
            ) : item.channel.channel_type === "house_external" ? (
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/15">
                <Globe size={12} className="text-emerald-400" />
              </div>
            ) : (
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-800">
                <MessageCircle size={12} className="text-zinc-400" />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-zinc-300 truncate">
                {item.hubName || item.channel.name}
              </span>
              <span className="ml-2 flex-shrink-0 text-[9px] text-zinc-600">
                {item.channel.last_message_at && formatRelTime(item.channel.last_message_at)}
              </span>
            </div>
            <p className="mt-0.5 text-[10px] leading-relaxed text-zinc-600 truncate">
              {item.channel.last_message}
            </p>
            <div className="mt-1 flex items-center gap-1.5">
              {item.channel.channel_type === "house_internal" && (
                <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[8px] font-medium text-blue-400">Internal</span>
              )}
              {item.channel.channel_type === "house_external" && (
                <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[8px] font-medium text-emerald-400">Family</span>
              )}
              {item.channel.unread_count > 0 && (
                <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-emerald-500/20 px-1 text-[8px] font-bold text-emerald-400">
                  {item.channel.unread_count}
                </span>
              )}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

/* ── Participant Hub ──────────────────────────────────────────── */

function ParticipantHubItem({
  hub,
  isExpanded,
  onToggle,
  activeChannelId,
  setActiveChannel,
}: {
  hub: ParticipantHub;
  isExpanded: boolean;
  onToggle: () => void;
  activeChannelId: string | null;
  setActiveChannel: (id: string, type: ChannelType) => void;
}) {
  const totalUnread = hub.internalChannel.unread_count + hub.externalChannel.unread_count;

  return (
    <div className="mb-0.5">
      <button
        onClick={onToggle}
        className={`group flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors ${
          isExpanded ? "bg-white/[0.04]" : "hover:bg-white/[0.02]"
        }`}
      >
        <motion.div
          animate={{ rotate: isExpanded ? 90 : 0 }}
          transition={{ duration: 0.15 }}
        >
          <ChevronRight size={12} className="text-zinc-600" />
        </motion.div>

        <div className={`flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-b ${getGradient(hub.participantName)}`}>
          <span className="text-[8px] font-bold text-white">
            {getInitials(hub.participantName)}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <span className="text-[11px] font-medium text-zinc-300 truncate block">
            {hub.participantName}
          </span>
        </div>

        {totalUnread > 0 && (
          <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-emerald-500/20 px-1 text-[8px] font-bold text-emerald-400">
            {totalUnread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="ml-6 pl-2 border-l border-white/[0.04]">
              {/* Internal */}
              <button
                onClick={() => setActiveChannel(hub.internalChannel.id, "house_internal")}
                className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left transition-colors ${
                  activeChannelId === hub.internalChannel.id
                    ? "bg-blue-500/10 text-blue-300"
                    : "text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-300"
                }`}
              >
                <Lock size={11} className={activeChannelId === hub.internalChannel.id ? "text-blue-400" : "text-blue-500/60"} />
                <span className="text-[11px]">internal-care</span>
                {hub.internalChannel.unread_count > 0 && (
                  <span className="ml-auto flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-blue-500/20 px-1 text-[7px] font-bold text-blue-400">
                    {hub.internalChannel.unread_count}
                  </span>
                )}
              </button>

              {/* External */}
              <button
                onClick={() => setActiveChannel(hub.externalChannel.id, "house_external")}
                className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left transition-colors ${
                  activeChannelId === hub.externalChannel.id
                    ? "bg-emerald-500/10 text-emerald-300"
                    : "text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-300"
                }`}
              >
                <Globe size={11} className={activeChannelId === hub.externalChannel.id ? "text-emerald-400" : "text-emerald-500/60"} />
                <span className="text-[11px]">external-family</span>
                {hub.externalChannel.unread_count > 0 && (
                  <span className="ml-auto flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-emerald-500/20 px-1 text-[7px] font-bold text-emerald-400">
                    {hub.externalChannel.unread_count}
                  </span>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Channel Row (DM / Team Channel) ─────────────────────────── */

function ChannelRow({
  channel,
  active,
  onClick,
  showHash,
}: {
  channel: MockChannel;
  active: boolean;
  onClick: () => void;
  showHash?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`group flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors ${
        active ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"
      }`}
    >
      {showHash ? (
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-white/[0.04]">
          <Hash size={12} className="text-zinc-500" />
        </div>
      ) : (
        <div className={`flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-b ${getGradient(channel.name)}`}>
          <span className="text-[8px] font-bold text-white">
            {getInitials(channel.name)}
          </span>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <span className={`text-[11px] font-medium truncate ${active ? "text-white" : "text-zinc-400"}`}>
            {showHash ? `#${channel.name}` : channel.name}
          </span>
          <span className="ml-2 flex-shrink-0 text-[9px] text-zinc-700">
            {channel.last_message_at && formatRelTime(channel.last_message_at)}
          </span>
        </div>
        <p className="mt-0.5 text-[10px] text-zinc-700 truncate">
          {channel.last_message}
        </p>
      </div>

      {channel.unread_count > 0 && (
        <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-emerald-500/20 px-1 text-[8px] font-bold text-emerald-400">
          {channel.unread_count}
        </span>
      )}
    </button>
  );
}

/* ── Active Signal (Pane 3) — Chat Interface ─────────────────── */

function ActiveSignal({
  channelId,
  channelType,
  channelName,
}: {
  channelId: string;
  channelType: ChannelType;
  channelName: string;
}) {
  const [inputValue, setInputValue] = useState("");
  const [showBroadcastMode, setShowBroadcastMode] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const messages = useMemo(() => generateMockMessages(channelId, channelType), [channelId, channelType]);
  const isInternal = channelType === "house_internal";
  const isExternal = channelType === "house_external";
  const isArchived = false; // Mock

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = useCallback(() => {
    if (!inputValue.trim()) return;
    // In production, this would call the store's sendMessage
    setInputValue("");
    setShowBroadcastMode(false);
  }, [inputValue]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  return (
    <div className="flex h-full flex-1 flex-col bg-[#050505]">
      {/* ── Channel Header ── */}
      <div className="flex items-center justify-between border-b border-white/[0.04] px-5 py-3">
        <div className="flex items-center gap-2.5">
          {isInternal && (
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500/15">
              <Lock size={13} className="text-blue-400" />
            </div>
          )}
          {isExternal && (
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/15">
              <Globe size={13} className="text-emerald-400" />
            </div>
          )}
          {channelType === "direct_message" && (
            <div className={`flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-b ${getGradient(channelName)}`}>
              <span className="text-[9px] font-bold text-white">{getInitials(channelName)}</span>
            </div>
          )}
          {channelType === "team_channel" && (
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-white/[0.04]">
              <Hash size={13} className="text-zinc-400" />
            </div>
          )}

          <div>
            <h3 className="text-[13px] font-semibold text-white">{channelName}</h3>
            <span className="text-[10px] text-zinc-600">
              {isInternal && "Internal care team only"}
              {isExternal && "Family & participant"}
              {channelType === "direct_message" && "Direct message"}
              {channelType === "team_channel" && "Team channel"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-600 transition-colors hover:bg-white/[0.04] hover:text-zinc-400">
            <Pin size={13} />
          </button>
          <button className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-600 transition-colors hover:bg-white/[0.04] hover:text-zinc-400">
            <Users size={13} />
          </button>
        </div>
      </div>

      {/* ── External Warning Banner ── */}
      {isExternal && (
        <div className="flex items-center gap-2 border-b border-emerald-500/10 bg-emerald-500/[0.04] px-5 py-2">
          <Shield size={13} className="flex-shrink-0 text-emerald-500" />
          <span className="text-[10px] font-medium text-emerald-400/80">
            EXTERNAL THREAD: Family and external stakeholders are present.
          </span>
        </div>
      )}

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto px-5 py-4 scrollbar-thin">
        <div className="space-y-0.5">
          {messages.map((msg, i) => {
            const isSystem = !msg.sender_id || msg.message_type !== "standard";
            const isAlert = msg.message_type === "manager_alert";
            const isHandover = msg.message_type === "system_handover";
            const isRosterSync = msg.message_type === "system_roster_sync";
            const prevMsg = i > 0 ? messages[i - 1] : null;
            const sameAuthor = prevMsg?.sender_id === msg.sender_id && prevMsg?.message_type === "standard" && msg.message_type === "standard";
            const timeDiff = prevMsg ? new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime() : Infinity;
            const showHeader = !sameAuthor || timeDiff > 300000; // 5 min gap

            if (isAlert) {
              return (
                <ManagerAlertMessage key={msg.id} message={msg} />
              );
            }

            if (isHandover) {
              return (
                <div key={msg.id} className="my-3 rounded-lg border border-blue-500/10 bg-blue-500/[0.03] px-4 py-3">
                  <p className="text-[11px] leading-relaxed text-blue-300/80">{msg.content}</p>
                  <span className="mt-1.5 block text-[9px] text-blue-500/40">{formatTime(msg.created_at)}</span>
                </div>
              );
            }

            if (isRosterSync) {
              return (
                <div key={msg.id} className="my-2 flex items-center justify-center gap-2">
                  <div className="h-px flex-1 bg-white/[0.03]" />
                  <span className="text-[9px] text-zinc-700">{msg.content}</span>
                  <div className="h-px flex-1 bg-white/[0.03]" />
                </div>
              );
            }

            return (
              <div key={msg.id} className={`group ${showHeader ? "mt-4" : "mt-0.5"}`}>
                {showHeader && (
                  <div className="mb-1 flex items-center gap-2">
                    <div className={`flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-b ${getGradient(msg.sender_name)}`}>
                      <span className="text-[8px] font-bold text-white">
                        {getInitials(msg.sender_name)}
                      </span>
                    </div>
                    <span className="text-[11px] font-semibold text-zinc-300">
                      {msg.sender_name}
                    </span>
                    <span className="text-[9px] text-zinc-700">{formatTime(msg.created_at)}</span>
                    {msg.is_pinned && <Pin size={9} className="text-amber-500/60" />}
                  </div>
                )}
                <div className={`${showHeader ? "ml-9" : "ml-9"} rounded px-0 py-0.5 text-[12px] leading-relaxed text-zinc-400 transition-colors group-hover:text-zinc-300`}>
                  {msg.content}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* ── Input Bar ── */}
      {!isArchived && (
        <div className="border-t border-white/[0.04] px-4 py-3">
          {/* Broadcast toggle for internal channels */}
          {isInternal && showBroadcastMode && (
            <div className="mb-2 flex items-center gap-2 rounded-lg border border-rose-500/20 bg-rose-500/[0.04] px-3 py-2">
              <AlertTriangle size={13} className="flex-shrink-0 text-rose-400" />
              <span className="text-[10px] font-medium text-rose-300">Broadcasting as Manager Alert — workers must acknowledge</span>
              <button
                onClick={() => setShowBroadcastMode(false)}
                className="ml-auto text-zinc-600 hover:text-zinc-400"
              >
                <X size={12} />
              </button>
            </div>
          )}

          <div className="flex items-end gap-2">
            <div className="relative flex-1">
              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  isInternal
                    ? "Message internal care team (Families cannot see this)…"
                    : isExternal
                    ? "Message participant and family…"
                    : `Message ${channelName}…`
                }
                rows={1}
                className="w-full resize-none rounded-lg bg-white/[0.03] px-3 py-2.5 text-[12px] text-zinc-300 placeholder:text-zinc-700 outline-none border border-white/[0.06] focus:border-emerald-500/30 transition-colors"
                style={{ minHeight: "38px", maxHeight: "120px" }}
              />
            </div>

            <div className="flex items-center gap-1">
              <button className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-600 transition-colors hover:bg-white/[0.04] hover:text-zinc-400">
                <Paperclip size={14} />
              </button>
              {isInternal && (
                <button
                  onClick={() => setShowBroadcastMode(!showBroadcastMode)}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                    showBroadcastMode
                      ? "bg-rose-500/15 text-rose-400"
                      : "text-zinc-600 hover:bg-white/[0.04] hover:text-zinc-400"
                  }`}
                  title="Broadcast Alert"
                >
                  <Megaphone size={14} />
                </button>
              )}
              <button
                onClick={handleSend}
                disabled={!inputValue.trim()}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white transition-all hover:bg-emerald-500 disabled:opacity-30 disabled:hover:bg-emerald-600"
              >
                <Send size={13} />
              </button>
            </div>
          </div>

          {/* External thread micro-tooltip */}
          {isExternal && inputValue.length > 50 && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-1.5 flex items-center gap-1.5 text-[9px] text-amber-400/70"
            >
              <AlertTriangle size={10} />
              Double check: Families can see this.
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Manager Alert Message ────────────────────────────────────── */

function ManagerAlertMessage({ message }: { message: MockMessage }) {
  const meta = message.metadata as { severity?: string; requires_ack?: boolean; ack_count?: number; total_required?: number };
  const isCritical = meta.severity === "critical";
  const ackCount = meta.ack_count || 0;
  const totalRequired = meta.total_required || 0;
  const [acknowledged, setAcknowledged] = useState(false);

  return (
    <div className={`my-4 rounded-xl border ${isCritical ? "border-rose-500/30 bg-rose-500/[0.04]" : "border-amber-500/20 bg-amber-500/[0.03]"} px-4 py-3.5`}>
      <div className="flex items-start gap-2.5">
        <div className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${isCritical ? "bg-rose-500/20" : "bg-amber-500/15"}`}>
          <AlertTriangle size={14} className={isCritical ? "text-rose-400" : "text-amber-400"} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${isCritical ? "text-rose-400" : "text-amber-400"}`}>
              {isCritical ? "CRITICAL ALERT" : "MANAGER ALERT"}
            </span>
            <span className="text-[9px] text-zinc-700">{formatTime(message.created_at)}</span>
          </div>
          <p className="mt-1.5 text-[12px] leading-relaxed text-zinc-300">{message.content}</p>

          {/* Ack status */}
          {meta.requires_ack && (
            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <CheckCheck size={12} className={ackCount === totalRequired ? "text-emerald-400" : "text-zinc-600"} />
                  <span className="text-[10px] text-zinc-500">
                    {ackCount}/{totalRequired} acknowledged
                  </span>
                </div>
                {/* Progress bar */}
                <div className="h-1 w-16 rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${totalRequired > 0 ? (ackCount / totalRequired) * 100 : 0}%` }}
                  />
                </div>
              </div>

              {!acknowledged ? (
                <button
                  onClick={() => setAcknowledged(true)}
                  className="flex items-center gap-1.5 rounded-md bg-white/[0.06] px-3 py-1.5 text-[10px] font-medium text-white transition-colors hover:bg-white/[0.1]"
                >
                  <Check size={11} />
                  Acknowledge
                </button>
              ) : (
                <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                  <Check size={11} />
                  Acknowledged
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Empty State ──────────────────────────────────────────────── */

function EmptyState() {
  return (
    <div className="relative flex flex-1 flex-col items-center justify-center text-center bg-[#050505]">
      <div className="pointer-events-none absolute inset-0 bg-noise opacity-[0.015]" />
      <div className="pointer-events-none absolute top-1/2 left-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/[0.015] blur-[100px]" />

      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="mb-6 font-mono text-[9px] font-bold tracking-widest text-zinc-700 uppercase"
      >
        CARE COMMS · STANDBY
      </motion.span>

      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="relative mb-8"
      >
        <LottieIcon
          animationData={radarScanAnimation}
          size={140}
          loop
          autoplay
          className="opacity-60"
        />
        <div className="absolute inset-[-4px] rounded-full border border-white/[0.04]" />
      </motion.div>

      <motion.h3
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="font-display text-[17px] font-semibold tracking-tight text-white"
      >
        Select a Thread
      </motion.h3>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="mt-2 max-w-[280px] text-[12px] leading-relaxed text-zinc-600"
      >
        Choose a participant hub, direct message, or team channel from the sidebar to begin.
      </motion.p>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="mt-5 flex items-center gap-3"
      >
        <div className="flex items-center gap-1.5 rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5">
          <kbd className="font-mono text-[10px] font-medium text-zinc-600">⌘</kbd>
          <kbd className="font-mono text-[10px] font-medium text-zinc-600">K</kbd>
          <span className="ml-1 text-[10px] text-zinc-700">Quick jump</span>
        </div>
      </motion.div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   PAGE COMPONENT
   ═══════════════════════════════════════════════════════════════════ */

export default function CareCommsPage() {
  const [activeView, setActiveView] = useState<ViewMode>("participants");
  const [activeChannelId, setActiveChannelIdState] = useState<string | null>(null);
  const [activeChannelType, setActiveChannelType] = useState<ChannelType | null>(null);
  const [activeChannelName, setActiveChannelName] = useState<string>("");
  const [expandedHub, setExpandedHub] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const setActiveChannel = useCallback(
    (id: string, type: ChannelType) => {
      setActiveChannelIdState(id);
      setActiveChannelType(type);

      // Resolve name
      for (const hub of MOCK_PARTICIPANTS) {
        if (hub.internalChannel.id === id) {
          setActiveChannelName(hub.internalChannel.name);
          setExpandedHub(hub.participantId);
          return;
        }
        if (hub.externalChannel.id === id) {
          setActiveChannelName(hub.externalChannel.name);
          setExpandedHub(hub.participantId);
          return;
        }
      }
      for (const dm of MOCK_DMS) {
        if (dm.id === id) {
          setActiveChannelName(dm.name);
          return;
        }
      }
      for (const tc of MOCK_TEAM_CHANNELS) {
        if (tc.id === id) {
          setActiveChannelName(`#${tc.name}`);
          return;
        }
      }
    },
    []
  );

  return (
    <div className="relative flex h-full overflow-hidden bg-[var(--background)]">
      {/* Stealth noise */}
      <div className="stealth-noise" />

      {/* ── Pane 2: Routing Ledger ── */}
      <RoutingLedger
        activeView={activeView}
        setActiveView={setActiveView}
        activeChannelId={activeChannelId}
        setActiveChannel={setActiveChannel}
        expandedHub={expandedHub}
        setExpandedHub={setExpandedHub}
        search={search}
        setSearch={setSearch}
      />

      {/* ── Pane 3: Active Signal ── */}
      {activeChannelId && activeChannelType ? (
        <ActiveSignal
          channelId={activeChannelId}
          channelType={activeChannelType}
          channelName={activeChannelName}
        />
      ) : (
        <EmptyState />
      )}
    </div>
  );
}

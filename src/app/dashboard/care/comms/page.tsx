/**
 * @page /dashboard/care/comms
 * @status COMPLETE
 * @description Care Communications — 3-pane messaging with triage, house threads, DMs, and channels
 * @dataSource zustand: useCareCommsStore + server-action: care-comms.ts
 * @lastAudit 2026-03-22
 */
"use client";

/* ═══════════════════════════════════════════════════════════════════
   Care Communications — "House Thread" Messaging Engine
   Project Echo · 3-Pane Obsidian Layout
   
   Pane 1: Global sidebar (handled by shell)
   Pane 2: Routing Ledger (320px) — TRIAGE / HOUSE THREADS / DMs / CHANNELS
   Pane 3: Active Signal — Chat interface
   
   All data sourced from care_chat_* tables via useCareCommsStore (Zustand)
   and server actions in care-comms.ts. Zero mock data.
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
  ChevronRight,
  Megaphone,
  Check,
  CheckCheck,
  X,
  Loader2,
} from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { LottieIcon } from "@/components/dashboard/lottie-icon";
import { radarScanAnimation } from "@/components/dashboard/lottie-data-relay";
import {
  useCareCommsStore,
  type CareChannel,
  type CareChatMessage,
  type ParticipantHub,
} from "@/lib/stores/care-comms-store";
import type { CareChannelType, CareMessageType } from "@/app/actions/care-comms";
import { LetterAvatar } from "@/components/ui/letter-avatar";

/* ═══════════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════════ */

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

const AVATAR_COLORS = [
  "#6366F1", "#8B5CF6", "#EC4899", "#EF4444", "#F97316",
  "#22C55E", "#14B8A6", "#06B6D4", "#3B82F6", "#A855F7",
  "#D946EF", "#F43F5E", "#0EA5E9", "#10B981",
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

/** Derive a display name for a channel */
function channelDisplayName(ch: CareChannel): string {
  if (ch.name) return ch.name;
  if (ch.channel_type === "team_channel") return "team-channel";
  if (ch.channel_type === "direct_message") return "Direct Message";
  return "Channel";
}

/* ═══════════════════════════════════════════════════════════════════
   COMPONENTS
   ═══════════════════════════════════════════════════════════════════ */

type ViewMode = "triage" | "participants" | "direct" | "channels";

/* ── Loading Skeleton ─────────────────────────────────────────── */

function ChannelSkeleton() {
  return (
    <div className="space-y-1 px-1">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-2.5 rounded-lg px-3 py-2 animate-pulse">
          <div className="h-6 w-6 rounded-full bg-white/[0.04]" />
          <div className="flex-1 space-y-1.5">
            <div className="h-2.5 w-24 rounded bg-white/[0.04]" />
            <div className="h-2 w-40 rounded bg-white/[0.03]" />
          </div>
        </div>
      ))}
    </div>
  );
}

function MessageSkeleton() {
  return (
    <div className="space-y-4 px-5 py-4 animate-pulse">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="flex items-start gap-2">
          <div className="h-7 w-7 rounded-full bg-white/[0.04]" />
          <div className="flex-1 space-y-1.5">
            <div className="h-2.5 w-20 rounded bg-white/[0.04]" />
            <div className="h-2 w-3/4 rounded bg-white/[0.03]" />
            <div className="h-2 w-1/2 rounded bg-white/[0.03]" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Empty List State ─────────────────────────────────────────── */

function EmptyListState({ message, sub }: { message: string; sub: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center px-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.03] mb-3">
        <MessageCircle size={16} className="text-zinc-700" />
      </div>
      <p className="text-[12px] font-medium text-zinc-500">{message}</p>
      <p className="mt-1 text-[11px] text-zinc-700">{sub}</p>
    </div>
  );
}

/* ── Routing Ledger (Pane 2) ──────────────────────────────────── */

function RoutingLedger({
  activeView,
  setActiveView,
  activeChannelId,
  onSelectChannel,
  expandedHub,
  setExpandedHub,
  search,
  setSearch,
  channels,
  participantHubs,
  channelsLoaded,
}: {
  activeView: ViewMode;
  setActiveView: (v: ViewMode) => void;
  activeChannelId: string | null;
  onSelectChannel: (ch: CareChannel) => void;
  expandedHub: string | null;
  setExpandedHub: (id: string | null) => void;
  search: string;
  setSearch: (s: string) => void;
  channels: CareChannel[];
  participantHubs: ParticipantHub[];
  channelsLoaded: boolean;
}) {
  const views: { id: ViewMode; label: string; icon: typeof Bell }[] = [
    { id: "triage", label: "Triage", icon: Bell },
    { id: "participants", label: "Participants", icon: Users },
    { id: "direct", label: "Direct", icon: MessageCircle },
    { id: "channels", label: "Channels", icon: Hash },
  ];

  // Derive channel sublists
  const dmChannels = useMemo(
    () => channels.filter((c) => c.channel_type === "direct_message"),
    [channels]
  );
  const teamChannels = useMemo(
    () => channels.filter((c) => c.channel_type === "team_channel"),
    [channels]
  );

  // Search-filtered
  const filteredHubs = useMemo(() => {
    if (!search) return participantHubs;
    const q = search.toLowerCase();
    return participantHubs.filter(
      (h) =>
        h.groupName.toLowerCase().includes(q) ||
        h.internalChannel?.name?.toLowerCase().includes(q) ||
        h.externalChannel?.name?.toLowerCase().includes(q)
    );
  }, [search, participantHubs]);

  const filteredDMs = useMemo(() => {
    if (!search) return dmChannels;
    const q = search.toLowerCase();
    return dmChannels.filter((d) => channelDisplayName(d).toLowerCase().includes(q));
  }, [search, dmChannels]);

  const filteredTeamChannels = useMemo(() => {
    if (!search) return teamChannels;
    const q = search.toLowerCase();
    return teamChannels.filter((c) => channelDisplayName(c).toLowerCase().includes(q));
  }, [search, teamChannels]);

  // Triage count — channels with recent updates (proxy for unread)
  const triageCount = useMemo(() => {
    // Count channels updated within the last 24 hours as "active"
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return channels.filter((c) => new Date(c.updated_at).getTime() > cutoff).length;
  }, [channels]);

  return (
    <div className="flex h-full w-[320px] min-w-[320px] flex-col border-r border-white/[0.04] bg-[#070707]">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <span className="font-mono text-[10px] font-bold tracking-widest text-[var(--text-muted)] uppercase">
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
        {!channelsLoaded ? (
          <ChannelSkeleton />
        ) : (
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
                  channels={channels}
                  participantHubs={participantHubs}
                  activeChannelId={activeChannelId}
                  onSelectChannel={onSelectChannel}
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
                {filteredHubs.length === 0 ? (
                  <EmptyListState
                    message="No participant threads"
                    sub="Participant house threads will appear once provisioned."
                  />
                ) : (
                  filteredHubs.map((hub) => (
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
                      onSelectChannel={onSelectChannel}
                    />
                  ))
                )}
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
                {filteredDMs.length === 0 ? (
                  <EmptyListState
                    message="No direct messages"
                    sub="Start a conversation with a team member."
                  />
                ) : (
                  filteredDMs.map((dm) => (
                    <ChannelRow
                      key={dm.id}
                      channel={dm}
                      active={activeChannelId === dm.id}
                      onClick={() => onSelectChannel(dm)}
                    />
                  ))
                )}
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
                {filteredTeamChannels.length === 0 ? (
                  <EmptyListState
                    message="No team channels"
                    sub="Create a channel to start collaborating."
                  />
                ) : (
                  filteredTeamChannels.map((ch) => (
                    <ChannelRow
                      key={ch.id}
                      channel={ch}
                      active={activeChannelId === ch.id}
                      onClick={() => onSelectChannel(ch)}
                      showHash
                    />
                  ))
                )}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

/* ── Triage List ───────────────────────────────────────────────── */

function TriageList({
  channels,
  participantHubs,
  activeChannelId,
  onSelectChannel,
}: {
  channels: CareChannel[];
  participantHubs: ParticipantHub[];
  activeChannelId: string | null;
  onSelectChannel: (ch: CareChannel) => void;
}) {
  // Show most recently updated channels first (proxy for activity/unread)
  const triageItems = useMemo(() => {
    const cutoff = Date.now() - 72 * 60 * 60 * 1000; // last 72 hours
    const recent = channels
      .filter((c) => new Date(c.updated_at).getTime() > cutoff)
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

    return recent.map((ch) => {
      // Try to resolve a participant name
      const hub = participantHubs.find(
        (h) => h.internalChannel?.id === ch.id || h.externalChannel?.id === ch.id
      );
      return { channel: ch, hubName: hub?.groupName };
    });
  }, [channels, participantHubs]);

  if (triageItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Check size={20} className="mb-2 text-emerald-500" />
        <p className="text-[12px] font-medium text-zinc-400">All caught up</p>
        <p className="mt-1 text-[11px] text-zinc-600">No recent activity</p>
      </div>
    );
  }

  return (
    <div>
      {triageItems.map((item) => (
        <button
          key={item.channel.id}
          onClick={() => onSelectChannel(item.channel)}
          className={`group flex w-full items-start gap-2.5 rounded-lg px-3 py-2.5 text-left transition-colors ${
            activeChannelId === item.channel.id
              ? "bg-white/[0.06]"
              : "hover:bg-white/[0.03]"
          }`}
        >
          {/* Indicator */}
          <div className="mt-1 flex-shrink-0">
            {item.channel.channel_type === "house_internal" ? (
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500/15">
                <Lock size={12} className="text-blue-400" />
              </div>
            ) : item.channel.channel_type === "house_external" ? (
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/15">
                <Globe size={12} className="text-emerald-400" />
              </div>
            ) : item.channel.channel_type === "team_channel" ? (
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-white/[0.04]">
                <Hash size={12} className="text-zinc-500" />
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
                {item.hubName || channelDisplayName(item.channel)}
              </span>
              <span className="ml-2 flex-shrink-0 text-[9px] text-zinc-600">
                {formatRelTime(item.channel.updated_at)}
              </span>
            </div>
            <p className="mt-0.5 text-[10px] leading-relaxed text-zinc-600 truncate">
              {channelDisplayName(item.channel)}
            </p>
            <div className="mt-1 flex items-center gap-1.5">
              {item.channel.channel_type === "house_internal" && (
                <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[8px] font-medium text-blue-400">Internal</span>
              )}
              {item.channel.channel_type === "house_external" && (
                <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[8px] font-medium text-emerald-400">Family</span>
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
  onSelectChannel,
}: {
  hub: ParticipantHub;
  isExpanded: boolean;
  onToggle: () => void;
  activeChannelId: string | null;
  onSelectChannel: (ch: CareChannel) => void;
}) {
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

        <LetterAvatar name={hub.groupName} size={24} />

        <div className="min-w-0 flex-1">
          <span className="text-[11px] font-medium text-zinc-300 truncate block">
            {hub.groupName}
          </span>
        </div>
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
              {hub.internalChannel && (
                <button
                  onClick={() => onSelectChannel(hub.internalChannel!)}
                  className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left transition-colors ${
                    activeChannelId === hub.internalChannel.id
                      ? "bg-blue-500/10 text-blue-300"
                      : "text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-300"
                  }`}
                >
                  <Lock size={11} className={activeChannelId === hub.internalChannel.id ? "text-blue-400" : "text-blue-500/60"} />
                  <span className="text-[11px]">internal-care</span>
                </button>
              )}

              {/* External */}
              {hub.externalChannel && (
                <button
                  onClick={() => onSelectChannel(hub.externalChannel!)}
                  className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left transition-colors ${
                    activeChannelId === hub.externalChannel.id
                      ? "bg-emerald-500/10 text-emerald-300"
                      : "text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-300"
                  }`}
                >
                  <Globe size={11} className={activeChannelId === hub.externalChannel.id ? "text-emerald-400" : "text-emerald-500/60"} />
                  <span className="text-[11px]">external-family</span>
                </button>
              )}
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
  channel: CareChannel;
  active: boolean;
  onClick: () => void;
  showHash?: boolean;
}) {
  const name = channelDisplayName(channel);

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
        <LetterAvatar name={name} size={24} />
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <span className={`text-[11px] font-medium truncate ${active ? "text-white" : "text-zinc-400"}`}>
            {showHash ? `#${name}` : name}
          </span>
          <span className="ml-2 flex-shrink-0 text-[9px] text-zinc-700">
            {formatRelTime(channel.updated_at)}
          </span>
        </div>
        {channel.description && (
          <p className="mt-0.5 text-[10px] text-zinc-700 truncate">
            {channel.description}
          </p>
        )}
      </div>
    </button>
  );
}

/* ── Active Signal (Pane 3) — Chat Interface ─────────────────── */

function ActiveSignal({
  channel,
}: {
  channel: CareChannel;
}) {
  const { user, profile } = useAuthStore();
  const {
    messages: allMessages,
    messagesLoading,
    sendingMessage,
    sendMessage,
    acknowledgeAlert,
    loadMessages,
  } = useCareCommsStore();

  const [inputValue, setInputValue] = useState("");
  const [showBroadcastMode, setShowBroadcastMode] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const messages = allMessages[channel.id] || [];
  const isInternal = channel.channel_type === "house_internal";
  const isExternal = channel.channel_type === "house_external";
  const isArchived = channel.is_archived || channel.is_read_only;

  // Load messages on channel change
  useEffect(() => {
    loadMessages(channel.id);
  }, [channel.id, loadMessages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleSend = useCallback(async () => {
    if (!inputValue.trim() || !user || !profile) return;

    const messageType: CareMessageType = showBroadcastMode ? "manager_alert" : "standard";
    const metadata = showBroadcastMode
      ? { severity: "high", requires_ack: true }
      : undefined;

    await sendMessage(
      channel.id,
      inputValue.trim(),
      user.id,
      { id: profile.id, full_name: profile.full_name, avatar_url: profile.avatar_url },
      messageType,
      metadata,
    );

    setInputValue("");
    setShowBroadcastMode(false);
  }, [inputValue, user, profile, showBroadcastMode, sendMessage, channel.id]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const channelName = channelDisplayName(channel);

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
          {channel.channel_type === "direct_message" && (
            <LetterAvatar name={channelName} size={28} />
          )}
          {channel.channel_type === "team_channel" && (
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-white/[0.04]">
              <Hash size={13} className="text-zinc-400" />
            </div>
          )}

          <div>
            <h3 className="text-[13px] font-semibold text-white">{channelName}</h3>
            <span className="text-[10px] text-zinc-600">
              {isInternal && "Internal care team only"}
              {isExternal && "Family & participant"}
              {channel.channel_type === "direct_message" && "Direct message"}
              {channel.channel_type === "team_channel" && "Team channel"}
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

      {/* ── Archived Banner ── */}
      {isArchived && (
        <div className="flex items-center gap-2 border-b border-amber-500/10 bg-amber-500/[0.04] px-5 py-2">
          <Lock size={13} className="flex-shrink-0 text-amber-500" />
          <span className="text-[10px] font-medium text-amber-400/80">
            This thread is archived and read-only.
          </span>
        </div>
      )}

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto px-5 py-4 scrollbar-thin">
        {messagesLoading && messages.length === 0 ? (
          <MessageSkeleton />
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageCircle size={24} className="mb-3 text-zinc-800" />
            <p className="text-[12px] font-medium text-zinc-500">No messages yet</p>
            <p className="mt-1 text-[11px] text-zinc-700">
              Send the first message to start the conversation.
            </p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {messages.map((msg, i) => {
              const isSystem = !msg.sender_id || msg.message_type !== "standard";
              const isAlert = msg.message_type === "manager_alert";
              const isHandover = msg.message_type === "system_handover";
              const isRosterSync = msg.message_type === "system_roster_sync";
              const isSystemArchived = msg.message_type === "system_archived";
              const prevMsg = i > 0 ? messages[i - 1] : null;
              const sameAuthor = prevMsg?.sender_id === msg.sender_id && prevMsg?.message_type === "standard" && msg.message_type === "standard";
              const timeDiff = prevMsg ? new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime() : Infinity;
              const showHeader = !sameAuthor || timeDiff > 300000; // 5 min gap

              const senderName = msg.profiles?.full_name || "System";

              if (isAlert) {
                return (
                  <ManagerAlertMessage
                    key={msg.id}
                    message={msg}
                    onAcknowledge={() => acknowledgeAlert(msg.id)}
                  />
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

              if (isRosterSync || isSystemArchived) {
                return (
                  <div key={msg.id} className="my-2 flex items-center justify-center gap-2">
                    <div className="h-px flex-1 bg-white/[0.03]" />
                    <span className="text-[9px] text-zinc-700">{msg.content}</span>
                    <div className="h-px flex-1 bg-white/[0.03]" />
                  </div>
                );
              }

              if (isSystem) {
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
                      <LetterAvatar name={senderName} src={msg.profiles?.avatar_url} size={28} />
                      <span className="text-[11px] font-semibold text-zinc-300">
                        {senderName}
                      </span>
                      <span className="text-[9px] text-zinc-700">{formatTime(msg.created_at)}</span>
                      {msg.is_pinned && <Pin size={9} className="text-amber-500/60" />}
                      {msg.is_edited && <span className="text-[8px] text-zinc-700">(edited)</span>}
                    </div>
                  )}
                  <div
                    className={`${showHeader ? "ml-9" : "ml-9"} rounded px-0 py-0.5 text-[12px] leading-relaxed transition-colors group-hover:text-zinc-300 ${
                      (msg.metadata as any)?._sendError ? "text-rose-500/60" : "text-zinc-400"
                    }`}
                  >
                    {msg.content}
                    {(msg.metadata as any)?._sendError && (
                      <span className="ml-2 text-[9px] text-rose-500/50">Failed to send</span>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
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
                disabled={!inputValue.trim() || sendingMessage}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white transition-all hover:bg-emerald-500 disabled:opacity-30 disabled:hover:bg-emerald-600"
              >
                {sendingMessage ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
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

function ManagerAlertMessage({
  message,
  onAcknowledge,
}: {
  message: CareChatMessage;
  onAcknowledge: () => void;
}) {
  const meta = message.metadata as { severity?: string; requires_ack?: boolean; ack_count?: number; total_required?: number };
  const isCritical = meta.severity === "critical";
  const ackCount = meta.ack_count || 0;
  const totalRequired = meta.total_required || 0;
  const [acknowledged, setAcknowledged] = useState(false);

  const handleAck = useCallback(() => {
    setAcknowledged(true);
    onAcknowledge();
  }, [onAcknowledge]);

  const senderName = message.profiles?.full_name || "Manager";

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
            <span className="text-[9px] text-zinc-700">— {senderName}</span>
          </div>
          <p className="mt-1.5 text-[12px] leading-relaxed text-zinc-300">{message.content}</p>

          {/* Ack status */}
          {meta.requires_ack && (
            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <CheckCheck size={12} className={ackCount === totalRequired && totalRequired > 0 ? "text-emerald-400" : "text-zinc-600"} />
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
                  onClick={handleAck}
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

/* ── Empty State (no channel selected) ───────────────────────── */

function NoChannelSelected() {
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
  const { currentOrg } = useAuthStore();
  const {
    channels,
    participantHubs,
    channelsLoaded,
    activeChannelId,
    activeView,
    expandedHubId,
    loadChannels,
    setActiveChannel,
    setActiveView,
    setExpandedHub,
  } = useCareCommsStore();

  const [search, setSearch] = useState("");

  // Load channels on mount
  useEffect(() => {
    if (currentOrg?.id) {
      loadChannels(currentOrg.id);
    }
  }, [currentOrg?.id, loadChannels]);

  // Find the active channel object
  const activeChannel = useMemo(
    () => channels.find((c) => c.id === activeChannelId) || null,
    [channels, activeChannelId]
  );

  // When selecting a channel, expand the parent hub if it's a participant channel
  const handleSelectChannel = useCallback(
    (ch: CareChannel) => {
      setActiveChannel(ch.id);

      // Auto-expand the participant hub for this channel
      if (ch.participant_id) {
        setExpandedHub(ch.participant_id);
      }
    },
    [setActiveChannel, setExpandedHub]
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
        onSelectChannel={handleSelectChannel}
        expandedHub={expandedHubId}
        setExpandedHub={setExpandedHub}
        search={search}
        setSearch={setSearch}
        channels={channels}
        participantHubs={participantHubs}
        channelsLoaded={channelsLoaded}
      />

      {/* ── Pane 3: Active Signal ── */}
      {activeChannel ? (
        <ActiveSignal channel={activeChannel} />
      ) : (
        <NoChannelSelected />
      )}
    </div>
  );
}

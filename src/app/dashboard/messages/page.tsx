"use client";

/* ═══════════════════════════════════════════════════════════════
   Project Rosetta — /dashboard/messages
   Fixed-viewport split-pane messaging interface
   Left: InboxList (320px) | Right: ChatCanvas (flex-1)
   ═══════════════════════════════════════════════════════════════ */

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Plus,
  Hash,
  Briefcase,
  Radio,
  MessageCircle,
  X,
} from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import {
  useMessengerStore,
  type Channel,
  type Message,
} from "@/lib/stores/messenger-store";
import { ChatStream } from "@/components/messenger/chat-stream";
import { NewMessageModal } from "@/components/messenger/new-message-modal";
import { createClient } from "@/lib/supabase/client";
import { LottieIcon } from "@/components/dashboard/lottie-icon";
import { radarScanAnimation } from "@/components/dashboard/lottie-data-relay";

/* ── Helpers ──────────────────────────────────────────────── */

function getInitials(name: string): string {
  if (!name) return "??";
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString("en-AU", { month: "short", day: "numeric" });
}

/* ── ConversationTile ────────────────────────────────────── */
// PRD §2.2: Avatar (28×28 rounded-lg), Name, Snippet, Timestamp, Unread dot

interface ConversationTileProps {
  channel: Channel;
  active: boolean;
  unread: boolean;
  onClick: () => void;
  lastMessage?: string;
}

function ConversationTile({
  channel,
  active,
  unread,
  onClick,
  lastMessage,
}: ConversationTileProps) {
  const name = channel.name || "Chat";
  const initials = getInitials(name);
  const isJob = channel.type === "job_context";
  const isDM = channel.type === "dm";

  return (
    <button
      onClick={onClick}
      className={`group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all duration-150 ${
        active ? "bg-white/5" : "hover:bg-white/[0.03]"
      }`}
    >
      {/* Active indicator — emerald left spine */}
      {active && (
        <motion.div
          layoutId="inbox-active-spine"
          className="absolute left-0 top-2 bottom-2 w-[2px] rounded-r bg-emerald-500"
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />
      )}

      {/* Unread dot */}
      {unread && !active && (
        <div className="absolute left-1.5 top-1/2 -translate-y-1/2">
          <div className="h-[6px] w-[6px] rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
        </div>
      )}

      {/* Avatar — 28×28 */}
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-semibold ${
          isJob
            ? "bg-emerald-500/10 text-emerald-400"
            : "bg-zinc-800/80 text-zinc-400"
        }`}
      >
        {isJob ? (
          <Briefcase size={12} strokeWidth={1.5} />
        ) : isDM ? (
          initials
        ) : (
          <Hash size={12} strokeWidth={1.5} />
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span
            className={`truncate text-[13px] font-medium ${
              unread ? "text-white" : "text-zinc-500"
            }`}
          >
            {name}
          </span>
          <span className="shrink-0 font-mono text-[10px] text-zinc-700">
            {formatRelativeTime(channel.last_message_at)}
          </span>
        </div>
        {lastMessage && (
          <p
            className={`mt-0.5 truncate text-[11px] leading-snug ${
              unread ? "text-zinc-400" : "text-zinc-700"
            }`}
          >
            {lastMessage}
          </p>
        )}
      </div>
    </button>
  );
}

/* ── InboxList (Left Pane — 320px) ───────────────────────── */

interface InboxListProps {
  channels: Channel[];
  activeChannelId: string | null;
  onSelectChannel: (channel: Channel) => void;
  onNewMessage: () => void;
  unreadChannels: Set<string>;
  lastMessages: Record<string, string>;
}

function InboxList({
  channels,
  activeChannelId,
  onSelectChannel,
  onNewMessage,
  unreadChannels,
  lastMessages,
}: InboxListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Sort by last_message_at (newest first) and filter by search
  const filteredChannels = useMemo(() => {
    const sorted = [...channels].sort((a, b) => {
      const aTime = a.last_message_at
        ? new Date(a.last_message_at).getTime()
        : 0;
      const bTime = b.last_message_at
        ? new Date(b.last_message_at).getTime()
        : 0;
      return bTime - aTime;
    });
    if (!searchQuery.trim()) return sorted;
    const q = searchQuery.toLowerCase();
    return sorted.filter((c) => (c.name || "").toLowerCase().includes(q));
  }, [channels, searchQuery]);

  return (
    <aside className="flex h-full w-[320px] shrink-0 flex-col border-r border-white/[0.04] bg-[#0A0A0A]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.04] px-4 py-3">
        <h2 className="text-[14px] font-semibold tracking-tight text-white">
          Messages
        </h2>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onNewMessage}
          className="rounded-md p-1.5 text-zinc-500 transition-colors duration-150 hover:bg-white/5 hover:text-white"
          title="New message (⌘N)"
        >
          <Plus size={14} strokeWidth={1.5} />
        </motion.button>
      </div>

      {/* Stealth search */}
      <div className="px-3 py-2">
        <div
          className={`relative flex items-center gap-2 rounded-lg px-2.5 py-1.5 transition-all duration-200 ${
            searchFocused ? "bg-white/[0.03]" : ""
          }`}
        >
          {/* Focus spine */}
          <motion.div
            className="absolute left-0 top-1 bottom-1 w-[2px] rounded-r bg-white"
            initial={false}
            animate={{
              opacity: searchFocused ? 1 : 0,
              scaleY: searchFocused ? 1 : 0,
            }}
            transition={{ duration: 0.15 }}
          />
          <Search
            size={13}
            className={`shrink-0 transition-colors duration-150 ${
              searchFocused ? "text-white" : "text-zinc-600"
            }`}
          />
          <input
            ref={searchRef}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="Search conversations…"
            className="flex-1 bg-transparent text-[12px] text-zinc-300 outline-none placeholder:text-zinc-600"
          />
          {searchQuery ? (
            <button
              onClick={() => setSearchQuery("")}
              className="text-zinc-600 hover:text-zinc-400"
            >
              <X size={12} />
            </button>
          ) : (
            !searchFocused && (
              <kbd className="flex items-center gap-0.5 rounded border border-white/[0.06] bg-white/[0.02] px-1 py-0.5 text-[9px] font-medium text-zinc-700">
                <span className="text-[10px]">⌘</span>K
              </kbd>
            )
          )}
        </div>
      </div>

      {/* Channel list */}
      <nav className="flex-1 overflow-y-auto px-2 py-1 scrollbar-none">
        {filteredChannels.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center">
            <MessageCircle size={24} className="mb-2 text-zinc-800" />
            <p className="text-[12px] text-zinc-600">
              {searchQuery
                ? "No matching conversations"
                : "No conversations yet"}
            </p>
            <button
              onClick={onNewMessage}
              className="mt-3 text-[11px] text-emerald-500 transition-colors hover:text-emerald-400"
            >
              Start a conversation
            </button>
          </div>
        ) : (
          filteredChannels.map((channel) => (
            <ConversationTile
              key={channel.id}
              channel={channel}
              active={activeChannelId === channel.id}
              unread={unreadChannels.has(channel.id)}
              onClick={() => onSelectChannel(channel)}
              lastMessage={lastMessages[channel.id]}
            />
          ))
        )}
      </nav>
    </aside>
  );
}

/* ── Empty State (No Chat Selected) ──────────────────────── */

function EmptyStateRadar() {
  return (
    <div className="relative flex flex-1 flex-col items-center justify-center text-center">
      <div className="pointer-events-none absolute inset-0 bg-noise opacity-[0.015]" />
      <div className="pointer-events-none absolute top-1/2 left-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/[0.03] blur-[80px]" />

      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="relative mb-8"
      >
        <LottieIcon
          animationData={radarScanAnimation}
          size={160}
          loop
          autoplay
          className="opacity-70"
        />
        <div className="absolute inset-0 rounded-full border border-emerald-500/[0.06] animate-signal-pulse" />
        <div
          className="absolute inset-[-12px] rounded-full border border-emerald-500/[0.03] animate-signal-pulse"
          style={{ animationDelay: "0.8s" }}
        />
      </motion.div>

      <motion.h3
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.5 }}
        className="text-[16px] font-semibold tracking-tight text-white"
      >
        No Signal Detected
      </motion.h3>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="mt-2 max-w-[280px] text-[13px] leading-relaxed text-zinc-500"
      >
        Select a conversation or start a new one
      </motion.p>

      <motion.button
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.85 }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="mt-6 flex items-center gap-2 rounded-xl border border-white/10 bg-transparent px-4 py-2 text-[12px] font-medium text-zinc-400 transition-all duration-200 hover:bg-white/5 hover:text-white"
      >
        <Radio size={13} />
        Start a new conversation
      </motion.button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MessagesPage — Master Split-Pane Orchestrator
   ═══════════════════════════════════════════════════════════════ */

export default function MessagesPage() {
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const currentOrg = useAuthStore((s) => s.currentOrg);

  const channels = useMessengerStore((s) => s.channels);
  const activeChannelId = useMessengerStore((s) => s.activeChannelId);
  const allMessages = useMessengerStore((s) => s.messages);
  const loadChannels = useMessengerStore((s) => s.loadChannels);
  const setActiveChannel = useMessengerStore((s) => s.setActiveChannel);

  const orgId = currentOrg?.id;
  const userId = user?.id;

  const [newMessageOpen, setNewMessageOpen] = useState(false);
  const [unreadChannels, setUnreadChannels] = useState<Set<string>>(new Set());

  /* ── Load channels on mount ──────────────────────────── */
  useEffect(() => {
    if (orgId) loadChannels(orgId);
  }, [orgId, loadChannels]);

  /* ── Realtime: new messages ──────────────────────────── */
  const channelIdsRef = useRef<string[]>([]);
  useEffect(() => {
    channelIdsRef.current = channels.map((c) => c.id);
  }, [channels]);

  useEffect(() => {
    if (!userId || channels.length === 0) return;

    const supabase = createClient();

    const subscription = supabase
      .channel(`messages-page:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          try {
            const newMsg = payload?.new as Record<string, unknown> | undefined;
            if (
              !newMsg ||
              typeof newMsg.channel_id !== "string" ||
              typeof newMsg.sender_id !== "string" ||
              typeof newMsg.id !== "string"
            )
              return;
            if (
              !channelIdsRef.current.includes(newMsg.channel_id) ||
              newMsg.sender_id === userId
            )
              return;

            void supabase
              .from("messages")
              .select("*, profiles:sender_id(id, full_name, avatar_url)")
              .eq("id", newMsg.id)
              .single()
              .then(({ data }) => {
                if (data) {
                  const msg = data as Message;
                  useMessengerStore.getState().addRealtimeMessage(msg);

                  // Mark channel as unread if not the active one
                  const currentActive =
                    useMessengerStore.getState().activeChannelId;
                  if (msg.channel_id !== currentActive) {
                    setUnreadChannels((prev) => {
                      const next = new Set(prev);
                      next.add(msg.channel_id);
                      return next;
                    });
                  }
                }
              });
          } catch {
            // ignore malformed payloads
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, channels.length]);

  /* ── Keyboard: ⌘N new message ────────────────────────── */
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        // Don't fire if inside inputs
        const tag = (e.target as HTMLElement).tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        e.preventDefault();
        setNewMessageOpen(true);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  /* ── Channel selection ───────────────────────────────── */
  const handleSelectChannel = useCallback(
    (channel: Channel) => {
      setActiveChannel(channel.id);
      // Clear unread state for this channel
      setUnreadChannels((prev) => {
        if (!prev.has(channel.id)) return prev;
        const next = new Set(prev);
        next.delete(channel.id);
        return next;
      });
    },
    [setActiveChannel],
  );

  /* ── Last message snippets for tiles ─────────────────── */
  const lastMessages = useMemo(() => {
    const result: Record<string, string> = {};
    for (const [channelId, msgs] of Object.entries(allMessages)) {
      if (msgs.length > 0) {
        const last = msgs[msgs.length - 1];
        const sender = last.profiles?.full_name || "Someone";
        const senderLabel =
          sender === profile?.full_name ? "You" : sender.split(" ")[0];
        const preview =
          last.type === "poll"
            ? "📊 Poll"
            : last.type === "location"
              ? "📍 Location"
              : last.content.length > 60
                ? last.content.slice(0, 60) + "…"
                : last.content;
        result[channelId] = `${senderLabel}: ${preview}`;
      }
    }
    return result;
  }, [allMessages, profile?.full_name]);

  const activeChannel = channels.find((c) => c.id === activeChannelId);
  const userProfile = useMemo(
    () => ({
      id: userId || "",
      full_name: profile?.full_name || "You",
      avatar_url: profile?.avatar_url || null,
    }),
    [userId, profile?.full_name, profile?.avatar_url],
  );

  /* ── Loading state ───────────────────────────────────── */
  if (!userId) {
    return (
      <div className="relative flex h-full items-center justify-center overflow-hidden bg-[#050505]">
        <p className="text-[13px] text-zinc-500">Loading messages…</p>
      </div>
    );
  }

  /* ── Render ──────────────────────────────────────────── */
  return (
    <>
      {/* ══════════════════════════════════════════════════════
          Split-Pane Shell
          • h-full: fills dashboard content area (100vh - topbar)
          • overflow-hidden: hijacks standard dashboard scroll
          • flex: creates horizontal split-pane layout
          ══════════════════════════════════════════════════════ */}
      <div className="relative flex h-full overflow-hidden bg-[#050505]">
        {/* Noise grain */}
        <div className="pointer-events-none absolute inset-0 z-0 bg-noise opacity-[0.012]" />

        {/* ── Left Pane: InboxList (320px fixed) ─────────── */}
        <InboxList
          channels={channels}
          activeChannelId={activeChannelId}
          onSelectChannel={handleSelectChannel}
          onNewMessage={() => orgId && setNewMessageOpen(true)}
          unreadChannels={unreadChannels}
          lastMessages={lastMessages}
        />

        {/* ── Right Pane: ChatCanvas (flex-1) ────────────── */}
        <AnimatePresence mode="wait">
          {activeChannel ? (
            <ChatStream
              key={activeChannel.id}
              channel={activeChannel}
              userId={userId}
              userProfile={userProfile}
            />
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="flex flex-1"
            >
              <EmptyStateRadar />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── New Message Modal ────────────────────────────── */}
      <NewMessageModal
        open={newMessageOpen}
        onClose={() => setNewMessageOpen(false)}
        orgId={orgId || ""}
        currentUserId={userId}
      />
    </>
  );
}

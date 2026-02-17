"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import {
  Hash,
  Users,
  Pin,
  SmilePlus,
  Reply,
  MoreHorizontal,
  Check,
  CheckCheck,
  AlertCircle,
  Briefcase,
} from "lucide-react";
import { useMessengerStore, type Message, type Channel } from "@/lib/stores/messenger-store";
import { MessageInput } from "./message-input";
import { PollMessage } from "./poll-message";

/* ── Time formatting ──────────────────────────────────── */

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function formatDateSeparator(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const today = now.toDateString();
  const yesterday = new Date(now.getTime() - 86400000).toDateString();
  if (d.toDateString() === today) return "Today";
  if (d.toDateString() === yesterday) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function shouldShowDateSeparator(messages: Message[], index: number) {
  if (index === 0) return true;
  const prev = new Date(messages[index - 1].created_at).toDateString();
  const curr = new Date(messages[index].created_at).toDateString();
  return prev !== curr;
}

function shouldGroupWithPrevious(messages: Message[], index: number) {
  if (index === 0) return false;
  const prev = messages[index - 1];
  const curr = messages[index];
  if (prev.sender_id !== curr.sender_id) return false;
  const diff = new Date(curr.created_at).getTime() - new Date(prev.created_at).getTime();
  return diff < 60000; // 1 minute for tighter grouping
}

/* ── Delivery status icon ─────────────────────────────── */
function DeliveryStatus({ status, readAt }: { status?: "sending" | "sent" | "error"; readAt?: string | null }) {
  if (status === "sending") {
    return <span className="text-[10px] text-zinc-700">Sending…</span>;
  }
  if (status === "error") {
    return (
      <span className="flex items-center gap-0.5 text-[10px] text-red-400">
        <AlertCircle size={9} /> Failed
      </span>
    );
  }
  if (readAt) {
    return <CheckCheck size={12} className="text-emerald-500" />;
  }
  return <Check size={11} className="text-zinc-600" />;
}

/* ── Typing indicator (Lottie-style CSS) ──────────────── */
function TypingIndicator() {
  return (
    <div className="flex items-center gap-3 px-2 py-1">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-zinc-800/60 text-[10px] text-zinc-500">
        ...
      </div>
      <div className="flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-[5px] w-[5px] rounded-full bg-emerald-500/60 animate-typing-dot"
            style={{ animationDelay: `${i * 0.2}s` }}
          />
        ))}
      </div>
    </div>
  );
}

/* ── Empty chat state ─────────────────────────────────── */
function EmptyChatState({ channelName, icon }: { channelName: string; icon: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.02]"
      >
        {icon}
      </motion.div>
      <motion.p
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-[14px] font-medium text-zinc-300"
      >
        Welcome to #{channelName}
      </motion.p>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="mt-1 text-[12px] text-zinc-600"
      >
        This is the start of the conversation. Say something!
      </motion.p>
    </div>
  );
}

/* ── Emoji quick-react bar ────────────────────────────── */
const quickReactions = ["👍", "🔥", "✅", "👀", "❤️"];

/* ── Chat Stream ──────────────────────────────────────── */

interface ChatStreamProps {
  channel: Channel;
  userId: string;
  userProfile: { id: string; full_name: string; avatar_url: string | null };
}

export function ChatStream({ channel, userId, userProfile }: ChatStreamProps) {
  const { messages: allMessages, messagesLoading, toggleReaction } = useMessengerStore();
  const messages = allMessages[channel.id] || [];
  const bottomRef = useRef<HTMLDivElement>(null);
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const channelIcon = channel.type === "job_context" ? (
    <Briefcase size={15} strokeWidth={1.5} className="text-zinc-500" />
  ) : (
    <Hash size={15} strokeWidth={1.5} className="text-zinc-500" />
  );

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden bg-[#050505]">
      {/* Subtle noise texture */}
      <div className="pointer-events-none absolute inset-0 bg-noise opacity-[0.015]" />

      {/* Channel header — minimal */}
      <div className="relative z-10 flex items-center justify-between border-b border-white/[0.04] px-5 py-2.5">
        <div className="flex items-center gap-2">
          {channelIcon}
          <h3 className="text-[14px] font-medium text-white">
            {channel.name || "Chat"}
          </h3>
          {channel.description && (
            <span className="text-[12px] text-zinc-600">— {channel.description}</span>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          <button className="rounded-md p-1.5 text-zinc-600 transition-colors duration-150 hover:bg-white/[0.04] hover:text-zinc-400">
            <Pin size={14} strokeWidth={1.5} />
          </button>
          <button className="rounded-md p-1.5 text-zinc-600 transition-colors duration-150 hover:bg-white/[0.04] hover:text-zinc-400">
            <Users size={14} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Messages stream */}
      <div className="relative z-10 flex-1 overflow-y-auto px-5 py-4">
        {messagesLoading ? (
          /* Custom iWorkr Loader — two thin rings */
          <div className="flex flex-col items-center justify-center py-20">
            <div className="relative h-8 w-8">
              <div className="absolute inset-0 rounded-full border border-zinc-700/50 animate-spin" style={{ animationDuration: "1.5s" }} />
              <div className="absolute inset-1 rounded-full border border-zinc-600/30 animate-spin" style={{ animationDuration: "1s", animationDirection: "reverse" }} />
            </div>
          </div>
        ) : messages.length === 0 ? (
          <EmptyChatState channelName={channel.name || "chat"} icon={channelIcon} />
        ) : (
          messages.map((msg, i) => {
            const isSelf = msg.sender_id === userId;
            const grouped = shouldGroupWithPrevious(messages, i);
            const showDate = shouldShowDateSeparator(messages, i);
            const senderName = msg.profiles?.full_name || "Unknown";
            const initials = senderName
              .split(" ")
              .map((w) => w[0])
              .join("")
              .slice(0, 2)
              .toUpperCase();
            const isHovered = hoveredMessageId === msg.id;

            return (
              <div key={msg.id}>
                {/* Date separator */}
                {showDate && (
                  <div className="my-5 flex items-center gap-3">
                    <div className="h-px flex-1 bg-white/[0.04]" />
                    <span className="text-[10px] font-medium text-zinc-600">
                      {formatDateSeparator(msg.created_at)}
                    </span>
                    <div className="h-px flex-1 bg-white/[0.04]" />
                  </div>
                )}

                {/* Message row */}
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className={`group relative flex gap-3 rounded-md px-2 py-0.5 transition-colors duration-150 hover:bg-white/[0.015] ${
                    grouped ? "mt-0" : "mt-3"
                  }`}
                  onMouseEnter={() => setHoveredMessageId(msg.id)}
                  onMouseLeave={() => setHoveredMessageId(null)}
                >
                  {/* Avatar or spacer */}
                  {!grouped ? (
                    <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[10px] font-medium ${
                      isSelf
                        ? "bg-zinc-800/80 text-zinc-400"
                        : "bg-zinc-800/60 text-zinc-500"
                    }`}>
                      {msg.profiles?.avatar_url ? (
                        <img src={msg.profiles.avatar_url} alt="" className="h-8 w-8 rounded-md object-cover" />
                      ) : (
                        initials
                      )}
                    </div>
                  ) : (
                    <div className="w-8 shrink-0" />
                  )}

                  <div className="min-w-0 flex-1">
                    {/* Name + time */}
                    {!grouped && (
                      <div className="mb-0.5 flex items-center gap-2">
                        <span className="text-[13px] font-medium text-white">
                          {isSelf ? "You" : senderName}
                        </span>
                        <span className="text-[10px] text-zinc-600">
                          {formatTime(msg.created_at)}
                        </span>
                        {msg.edited_at && (
                          <span className="text-[10px] text-zinc-700">(edited)</span>
                        )}
                      </div>
                    )}

                    {/* Content — monochrome bubbles */}
                    {msg.type === "poll" ? (
                      <PollMessage message={msg} userId={userId} />
                    ) : isSelf ? (
                      /* Self: Dark zinc card, sharp top-right corner */
                      <div className={`inline-block max-w-[70%] rounded-xl rounded-tr-sm border border-white/[0.06] bg-zinc-800/60 px-3.5 py-2 text-[13px] leading-relaxed text-zinc-100 ${
                        msg.status === "sending" ? "opacity-50" : ""
                      } ${msg.status === "error" ? "border-red-500/30" : ""}`}>
                        <MessageContent content={msg.content} />
                      </div>
                    ) : (
                      /* Other: Transparent, just text on canvas */
                      <div className={`text-[13px] leading-relaxed text-zinc-300 ${
                        msg.status === "sending" ? "opacity-50" : ""
                      }`}>
                        <MessageContent content={msg.content} />
                      </div>
                    )}

                    {/* Delivery status for own messages */}
                    {isSelf && (
                      <div className="mt-0.5 flex items-center gap-1">
                        <DeliveryStatus status={msg.status} readAt={(msg as any).read_at} />
                      </div>
                    )}

                    {/* Reactions */}
                    {Object.keys(msg.reactions || {}).length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {Object.entries(msg.reactions).map(([emoji, users]) => (
                          <button
                            key={emoji}
                            onClick={() => toggleReaction(msg.id, emoji)}
                            className={`flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] transition-colors duration-150 ${
                              (users as string[]).includes(userId)
                                ? "border-emerald-500/20 bg-emerald-500/8 text-zinc-200"
                                : "border-white/[0.06] text-zinc-500 hover:bg-white/[0.03]"
                            }`}
                          >
                            <span>{emoji}</span>
                            <span className="text-[10px]">{(users as string[]).length}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Hover actions toolbar */}
                  <AnimatePresence>
                    {isHovered && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.1 }}
                        className="absolute -top-3 right-2 flex items-center gap-0.5 rounded-md border border-white/[0.06] bg-[#0A0A0A] p-0.5 shadow-xl"
                      >
                        {quickReactions.map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => toggleReaction(msg.id, emoji)}
                            className="rounded px-1 py-0.5 text-[12px] transition-colors hover:bg-white/[0.06]"
                          >
                            {emoji}
                          </button>
                        ))}
                        <div className="mx-0.5 h-3 w-px bg-white/[0.06]" />
                        <button className="rounded p-1 text-zinc-600 transition-colors hover:text-zinc-300">
                          <Reply size={12} />
                        </button>
                        <button className="rounded p-1 text-zinc-600 transition-colors hover:text-zinc-300">
                          <MoreHorizontal size={12} />
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Message input */}
      <MessageInput channelId={channel.id} userId={userId} userProfile={userProfile} />
    </div>
  );
}

/* ── Content renderer (handles @mentions) ─────────────── */

function MessageContent({ content }: { content: string }) {
  const parts = content.split(/(@\w+)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("@") ? (
          <span key={i} className="rounded bg-emerald-500/10 px-0.5 text-emerald-500">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

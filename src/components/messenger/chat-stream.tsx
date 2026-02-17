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
  return diff < 300000; // 5 minutes
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

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const channelIcon = channel.type === "job_context" ? (
    <Briefcase size={15} className="text-zinc-500" />
  ) : (
    <Hash size={15} className="text-zinc-500" />
  );

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Channel header */}
      <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] px-5 py-2.5">
        <div className="flex items-center gap-2">
          {channelIcon}
          <h3 className="text-[14px] font-medium text-zinc-200">
            {channel.name || "Chat"}
          </h3>
          {channel.description && (
            <span className="text-[12px] text-zinc-600">— {channel.description}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button className="rounded-md p-1.5 text-zinc-600 transition-colors hover:bg-[rgba(255,255,255,0.06)] hover:text-zinc-400">
            <Pin size={14} />
          </button>
          <button className="rounded-md p-1.5 text-zinc-600 transition-colors hover:bg-[rgba(255,255,255,0.06)] hover:text-zinc-400">
            <Users size={14} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {messagesLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-700 border-t-[#00E676]" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[rgba(0,230,118,0.08)]">
              {channelIcon}
            </div>
            <p className="text-[14px] font-medium text-zinc-300">
              Welcome to #{channel.name || "chat"}
            </p>
            <p className="mt-1 text-[12px] text-zinc-600">
              This is the start of the conversation. Say something!
            </p>
          </div>
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
                  <div className="my-4 flex items-center gap-3">
                    <div className="h-px flex-1 bg-[rgba(255,255,255,0.06)]" />
                    <span className="text-[10px] font-medium text-zinc-600">
                      {formatDateSeparator(msg.created_at)}
                    </span>
                    <div className="h-px flex-1 bg-[rgba(255,255,255,0.06)]" />
                  </div>
                )}

                {/* Message */}
                <div
                  className={`group relative flex gap-3 rounded-md px-2 py-0.5 transition-colors hover:bg-[rgba(255,255,255,0.02)] ${
                    grouped ? "mt-0" : "mt-3"
                  }`}
                  onMouseEnter={() => setHoveredMessageId(msg.id)}
                  onMouseLeave={() => setHoveredMessageId(null)}
                >
                  {/* Avatar or spacer */}
                  {!grouped ? (
                    <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-medium ${
                      isSelf
                        ? "bg-[rgba(0,230,118,0.12)] text-[#00E676]"
                        : "bg-zinc-800 text-zinc-400"
                    }`}>
                      {msg.profiles?.avatar_url ? (
                        <img src={msg.profiles.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
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
                        <span className={`text-[13px] font-medium ${
                          isSelf ? "text-[#00E676]" : "text-zinc-200"
                        }`}>
                          {isSelf ? "You" : senderName}
                        </span>
                        <span className="text-[10px] text-zinc-700">
                          {formatTime(msg.created_at)}
                        </span>
                        {msg.edited_at && (
                          <span className="text-[10px] text-zinc-700">(edited)</span>
                        )}
                      </div>
                    )}

                    {/* Content */}
                    {msg.type === "poll" ? (
                      <PollMessage message={msg} userId={userId} />
                    ) : (
                      <div className={`text-[13px] leading-relaxed ${
                        isSelf ? "text-zinc-200" : "text-zinc-400"
                      } ${msg.status === "sending" ? "opacity-50" : ""} ${
                        msg.status === "error" ? "text-red-400" : ""
                      }`}>
                        <MessageContent content={msg.content} />
                      </div>
                    )}

                    {/* Status indicator */}
                    {msg.status === "sending" && (
                      <span className="text-[10px] text-zinc-700">Sending…</span>
                    )}
                    {msg.status === "error" && (
                      <span className="flex items-center gap-1 text-[10px] text-red-400">
                        <AlertCircle size={10} /> Failed to send
                      </span>
                    )}

                    {/* Reactions */}
                    {Object.keys(msg.reactions || {}).length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {Object.entries(msg.reactions).map(([emoji, users]) => (
                          <button
                            key={emoji}
                            onClick={() => toggleReaction(msg.id, emoji)}
                            className={`flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] transition-colors ${
                              (users as string[]).includes(userId)
                                ? "border-[#00E676]/30 bg-[rgba(0,230,118,0.08)] text-zinc-200"
                                : "border-[rgba(255,255,255,0.08)] text-zinc-500 hover:bg-[rgba(255,255,255,0.04)]"
                            }`}
                          >
                            <span>{emoji}</span>
                            <span className="text-[10px]">{(users as string[]).length}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Hover actions */}
                  <AnimatePresence>
                    {isHovered && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.1 }}
                        className="absolute -top-3 right-2 flex items-center gap-0.5 rounded-md border border-[rgba(255,255,255,0.08)] bg-[#0a0a0a] p-0.5 shadow-lg"
                      >
                        {quickReactions.map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => toggleReaction(msg.id, emoji)}
                            className="rounded px-1 py-0.5 text-[12px] transition-colors hover:bg-[rgba(255,255,255,0.08)]"
                          >
                            {emoji}
                          </button>
                        ))}
                        <div className="mx-0.5 h-3 w-px bg-[rgba(255,255,255,0.06)]" />
                        <button className="rounded p-1 text-zinc-600 transition-colors hover:text-zinc-300">
                          <Reply size={12} />
                        </button>
                        <button className="rounded p-1 text-zinc-600 transition-colors hover:text-zinc-300">
                          <MoreHorizontal size={12} />
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
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
  // Parse @mentions
  const parts = content.split(/(@\w+)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("@") ? (
          <span key={i} className="rounded bg-[rgba(0,230,118,0.1)] px-0.5 text-[#00E676]">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

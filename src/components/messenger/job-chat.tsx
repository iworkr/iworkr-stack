"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { MessageSquare, Send, Check, CheckCheck } from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { useMessengerStore, type Message } from "@/lib/stores/messenger-store";
import { getOrCreateJobChannel } from "@/app/actions/messenger";
import { createClient } from "@/lib/supabase/client";

interface JobChatProps {
  jobId: string;
  jobTitle: string;
}

export function JobChat({ jobId, jobTitle }: JobChatProps) {
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const currentOrg = useAuthStore((s) => s.currentOrg);
  const allMessages = useMessengerStore((s) => s.messages);
  const loadMessages = useMessengerStore((s) => s.loadMessages);
  const sendMessage = useMessengerStore((s) => s.sendMessage);
  const addRealtimeMessage = useMessengerStore((s) => s.addRealtimeMessage);
  const [channelId, setChannelId] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const orgId = currentOrg?.id;
  const userId = user?.id;
  const messages = channelId ? allMessages[channelId] || [] : [];

  useEffect(() => {
    if (!orgId || !jobId) return;
    setLoading(true);
    getOrCreateJobChannel(orgId, jobId, jobTitle).then((result) => {
      if (result.data) {
        setChannelId(result.data.id);
        loadMessages(result.data.id);
      }
      setLoading(false);
    });
  }, [orgId, jobId, jobTitle, loadMessages]);

  useEffect(() => {
    if (!channelId || !userId) return;
    const supabase = createClient();
    const sub = supabase
      .channel(`job-chat:${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `channel_id=eq.${channelId}`,
        },
        (payload) => {
          const msg = payload.new as any;
          if (msg.sender_id !== userId) {
            supabase
              .from("messages")
              .select("*, profiles:sender_id(id, full_name, avatar_url)")
              .eq("id", msg.id)
              .single()
              .then(({ data }) => {
                if (data) addRealtimeMessage(data as Message);
              });
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
  }, [channelId, userId, addRealtimeMessage]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleSend = useCallback(async () => {
    if (!content.trim() || !channelId || !userId) return;
    const text = content.trim();
    setContent("");
    await sendMessage(channelId, text, userId, {
      id: userId,
      full_name: profile?.full_name || "You",
      avatar_url: profile?.avatar_url || null,
    });
    inputRef.current?.focus();
  }, [content, channelId, userId, profile, sendMessage]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <div className="relative h-6 w-6">
          <div
            className="absolute inset-0 animate-spin rounded-full border border-emerald-500/20"
            style={{ animationDuration: "1.5s" }}
          />
          <div
            className="absolute inset-1 animate-spin rounded-full border border-zinc-600/20"
            style={{
              animationDuration: "1s",
              animationDirection: "reverse",
            }}
          />
        </div>
        <span className="mt-2 text-[11px] text-zinc-600">Loading chat…</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Messages */}
      <div className="scrollbar-none max-h-[300px] overflow-y-auto px-1 py-2">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-center">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.02]">
              <MessageSquare
                size={16}
                strokeWidth={1.5}
                className="text-zinc-600"
              />
            </div>
            <p className="text-[12px] font-medium text-zinc-400">
              No messages yet
            </p>
            <p className="mt-0.5 text-[11px] text-zinc-700">
              Start a conversation about this job
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isSelf = msg.sender_id === userId;
            const name = msg.profiles?.full_name || "Unknown";
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="mb-2.5 flex gap-2"
              >
                <div
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[8px] font-semibold ${
                    isSelf
                      ? "bg-emerald-600/15 text-emerald-400"
                      : "bg-zinc-800/60 text-zinc-500"
                  }`}
                >
                  {name
                    .split(" ")
                    .map((w) => w[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-white">
                      {isSelf ? "You" : name}
                    </span>
                    <span className="font-mono text-[9px] text-zinc-700">
                      {new Date(msg.created_at).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                        hour12: true,
                      })}
                    </span>
                  </div>
                  <p
                    className={`text-[12px] leading-relaxed ${isSelf ? "text-zinc-200" : "text-zinc-400"} ${
                      msg.status === "sending" ? "opacity-50" : ""
                    }`}
                  >
                    {msg.content}
                  </p>
                  {isSelf && msg.status !== "sending" && (
                    <div className="mt-0.5">
                      {(msg as any).read_at ? (
                        <CheckCheck size={10} className="text-emerald-500" />
                      ) : (
                        <Check size={10} className="text-zinc-700" />
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Stealth input — floating glass bar */}
      <div className="mt-2 flex items-center gap-2 rounded-xl border border-white/[0.06] bg-zinc-900/80 px-3 py-2 backdrop-blur-xl transition-all duration-200 focus-within:border-white/[0.1] focus-within:shadow-lg focus-within:shadow-black/20">
        <input
          ref={inputRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Message this job…"
          className="flex-1 bg-transparent text-[12px] text-zinc-200 outline-none placeholder:text-zinc-600"
        />
        <button
          onClick={handleSend}
          disabled={!content.trim()}
          className={`rounded-lg p-1.5 transition-all duration-200 ${
            content.trim()
              ? "bg-emerald-600 text-white shadow-sm shadow-emerald-900/30 hover:bg-emerald-500"
              : "text-zinc-700"
          }`}
        >
          <Send size={12} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}

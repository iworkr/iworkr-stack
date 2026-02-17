"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Send, SmilePlus } from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { useMessengerStore, type Message } from "@/lib/stores/messenger-store";
import { getOrCreateJobChannel } from "@/app/actions/messenger";
import { createClient } from "@/lib/supabase/client";

interface JobChatProps {
  jobId: string;
  jobTitle: string;
}

export function JobChat({ jobId, jobTitle }: JobChatProps) {
  const { user, profile, currentOrg } = useAuthStore();
  const { messages: allMessages, loadMessages, sendMessage, addRealtimeMessage } = useMessengerStore();
  const [channelId, setChannelId] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const orgId = currentOrg?.id;
  const userId = user?.id;
  const messages = channelId ? (allMessages[channelId] || []) : [];

  // Get or create the job channel
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

  // Real-time subscription for this channel
  useEffect(() => {
    if (!channelId || !userId) return;
    const supabase = createClient();
    const sub = supabase
      .channel(`job-chat:${channelId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `channel_id=eq.${channelId}` },
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
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, [channelId, userId, addRealtimeMessage]);

  // Scroll to bottom on new messages
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
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-700 border-t-[#00E676]" />
        <span className="mt-2 text-[11px] text-zinc-600">Loading chat…</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Messages */}
      <div className="max-h-[300px] overflow-y-auto px-1 py-2">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center py-6 text-center">
            <MessageSquare size={16} className="mb-2 text-zinc-700" />
            <p className="text-[11px] text-zinc-600">No messages yet.</p>
            <p className="text-[10px] text-zinc-700">Start a conversation about this job.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isSelf = msg.sender_id === userId;
            const name = msg.profiles?.full_name || "Unknown";
            return (
              <div key={msg.id} className="mb-2 flex gap-2">
                <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[8px] font-medium ${
                  isSelf ? "bg-[rgba(0,230,118,0.12)] text-[#00E676]" : "bg-zinc-800 text-zinc-500"
                }`}>
                  {name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[11px] font-medium ${isSelf ? "text-[#00E676]" : "text-zinc-300"}`}>
                      {isSelf ? "You" : name}
                    </span>
                    <span className="text-[9px] text-zinc-700">
                      {new Date(msg.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}
                    </span>
                  </div>
                  <p className={`text-[12px] leading-relaxed ${isSelf ? "text-zinc-200" : "text-zinc-400"} ${
                    msg.status === "sending" ? "opacity-50" : ""
                  }`}>
                    {msg.content}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="mt-2 flex items-center gap-2 rounded-md border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] px-2 py-1.5">
        <input
          ref={inputRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder="Message this job…"
          className="flex-1 bg-transparent text-[12px] text-zinc-200 outline-none placeholder:text-zinc-700"
        />
        <button
          onClick={handleSend}
          disabled={!content.trim()}
          className={`rounded p-1 transition-colors ${
            content.trim() ? "bg-[#00E676] text-black" : "text-zinc-700"
          }`}
        >
          <Send size={12} />
        </button>
      </div>
    </div>
  );
}

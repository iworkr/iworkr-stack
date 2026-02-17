"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { useAuthStore } from "@/lib/auth-store";
import { useMessengerStore } from "@/lib/stores/messenger-store";
import { MessengerSidebar } from "@/components/messenger/messenger-sidebar";
import { ChatStream } from "@/components/messenger/chat-stream";
import { TriagePanel } from "@/components/messenger/triage-panel";
import { createClient } from "@/lib/supabase/client";
import type { Message } from "@/lib/stores/messenger-store";

/* ── Empty state: Radar sweep animation ───────────────── */
function EmptyStateRadar() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      {/* Subtle noise texture */}
      <div className="pointer-events-none absolute inset-0 bg-noise opacity-[0.02]" />

      <div className="relative mb-6 flex h-24 w-24 items-center justify-center">
        {/* Concentric rings */}
        {[80, 56, 32].map((size, i) => (
          <div
            key={size}
            className="absolute rounded-full border border-white/[0.04]"
            style={{ width: size, height: size }}
          />
        ))}
        {/* Sweep line */}
        <div className="absolute inset-0 animate-radar-sweep">
          <div
            className="absolute top-1/2 left-1/2 origin-left"
            style={{
              width: 40,
              height: 1,
              marginTop: -0.5,
              background: "linear-gradient(90deg, rgba(16,185,129,0.5), transparent)",
            }}
          />
        </div>
        {/* Pulse rings */}
        <div className="absolute h-6 w-6 rounded-full border border-emerald-500/20 animate-signal-pulse" />
        <div className="absolute h-6 w-6 rounded-full border border-emerald-500/10 animate-signal-pulse" style={{ animationDelay: "0.7s" }} />
        {/* Center dot */}
        <div className="relative z-10 h-2 w-2 rounded-full bg-emerald-500/60" />
      </div>

      <motion.p
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-[14px] font-medium text-zinc-400"
      >
        No signal detected
      </motion.p>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-1.5 max-w-[260px] text-[12px] text-zinc-600"
      >
        Start a new transmission by selecting a channel or direct message
      </motion.p>
    </div>
  );
}

export default function InboxPage() {
  const { user, profile, currentOrg } = useAuthStore();
  const {
    channels,
    activeChannelId,
    activeView,
    channelsLoaded,
    loadChannels,
    addRealtimeMessage,
  } = useMessengerStore();

  const orgId = currentOrg?.id;
  const userId = user?.id;

  useEffect(() => {
    if (orgId && !channelsLoaded) {
      loadChannels(orgId);
    }
  }, [orgId, channelsLoaded, loadChannels]);

  useEffect(() => {
    if (!userId || channels.length === 0) return;

    const supabase = createClient();
    const channelIds = channels.map((c) => c.id);

    const subscription = supabase
      .channel(`messenger:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          const newMsg = payload.new as any;
          if (channelIds.includes(newMsg.channel_id) && newMsg.sender_id !== userId) {
            supabase
              .from("messages")
              .select("*, profiles:sender_id(id, full_name, avatar_url)")
              .eq("id", newMsg.id)
              .single()
              .then(({ data }) => {
                if (data) {
                  addRealtimeMessage(data as Message);
                }
              });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [userId, channels, addRealtimeMessage]);

  const activeChannel = channels.find((c) => c.id === activeChannelId);
  const userProfile = {
    id: userId || "",
    full_name: profile?.full_name || "You",
    avatar_url: profile?.avatar_url || null,
  };

  return (
    <div className="relative flex h-full overflow-hidden bg-[#050505]">
      <MessengerSidebar userId={userId || ""} />

      {activeView === "triage" ? (
        <TriagePanel />
      ) : activeChannel ? (
        <ChatStream
          channel={activeChannel}
          userId={userId || ""}
          userProfile={userProfile}
        />
      ) : (
        <EmptyStateRadar />
      )}
    </div>
  );
}

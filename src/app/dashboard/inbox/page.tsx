"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Radio } from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { useMessengerStore } from "@/lib/stores/messenger-store";
import { MessengerSidebar } from "@/components/messenger/messenger-sidebar";
import { ChatStream } from "@/components/messenger/chat-stream";
import { TriagePanel } from "@/components/messenger/triage-panel";
import { createClient } from "@/lib/supabase/client";
import { LottieIcon } from "@/components/dashboard/lottie-icon";
import { radarScanAnimation } from "@/components/dashboard/lottie-data-relay";
import type { Message } from "@/lib/stores/messenger-store";

/* ── Empty state: Holographic Radar ─────────────────────── */
function EmptyStateRadar() {
  return (
    <div className="relative flex flex-1 flex-col items-center justify-center text-center">
      {/* Noise texture */}
      <div className="pointer-events-none absolute inset-0 bg-noise opacity-[0.015]" />

      {/* Ambient glow */}
      <div className="pointer-events-none absolute top-1/2 left-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/[0.03] blur-[80px]" />

      {/* Lottie radar */}
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
        {/* Outer glow ring */}
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
        Select a channel to establish connection
      </motion.p>

      <motion.button
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.85 }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="mt-6 flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-2 text-[12px] font-medium text-zinc-400 transition-all duration-200 hover:border-emerald-500/20 hover:text-emerald-400 hover:shadow-lg hover:shadow-emerald-900/10"
      >
        <Radio size={13} />
        Start a new transmission
      </motion.button>
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
          if (
            channelIds.includes(newMsg.channel_id) &&
            newMsg.sender_id !== userId
          ) {
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
        },
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

      <AnimatePresence mode="wait">
        {activeView === "triage" ? (
          <motion.div
            key="triage"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-1 overflow-hidden"
          >
            <TriagePanel />
          </motion.div>
        ) : activeChannel ? (
          <ChatStream
            key={activeChannel.id}
            channel={activeChannel}
            userId={userId || ""}
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
  );
}

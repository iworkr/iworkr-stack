"use client";

import { useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Radio } from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { useMessengerStore } from "@/lib/stores/messenger-store";
import { MessengerSidebar } from "@/components/messenger/messenger-sidebar";
import { ChatStream } from "@/components/messenger/chat-stream";
import { TriagePanel } from "@/components/messenger/triage-panel";
import { MentionsPanel } from "@/components/messenger/mentions-panel";
import { createClient } from "@/lib/supabase/client";
import { LottieIcon } from "@/components/dashboard/lottie-icon";
import { radarScanAnimation } from "@/components/dashboard/lottie-data-relay";
import type { Message } from "@/lib/stores/messenger-store";

/* ── Empty state: Holographic Radar — PRD Design Revamp: richer + intentional ── */
function EmptyStateRadar() {
  return (
    <div className="relative flex flex-1 flex-col items-center justify-center text-center">
      {/* Noise texture */}
      <div className="pointer-events-none absolute inset-0 bg-noise opacity-[0.015]" />

      {/* Ambient glow — stronger layered */}
      <div className="pointer-events-none absolute top-1/2 left-1/2 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/[0.03] blur-[100px]" />
      <div className="pointer-events-none absolute top-1/2 left-1/2 h-[200px] w-[200px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/[0.05] blur-[60px]" />

      {/* Mono overline */}
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="mb-6 font-mono text-[9px] font-bold tracking-widest text-zinc-700 uppercase"
      >
        COMMS · STANDBY
      </motion.span>

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
        {/* Outer glow rings — triple-layered */}
        <div className="absolute inset-[-4px] rounded-full border border-emerald-500/[0.08] animate-signal-pulse" />
        <div
          className="absolute inset-[-16px] rounded-full border border-emerald-500/[0.04] animate-signal-pulse"
          style={{ animationDelay: "0.6s" }}
        />
        <div
          className="absolute inset-[-28px] rounded-full border border-emerald-500/[0.02] animate-signal-pulse"
          style={{ animationDelay: "1.2s" }}
        />
      </motion.div>

      <motion.h3
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.5 }}
        className="font-display text-[18px] font-semibold tracking-tight text-white"
      >
        No Signal Detected
      </motion.h3>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="mt-2 max-w-[300px] text-[13px] leading-relaxed text-zinc-500"
      >
        Select a channel from the sidebar to establish connection, or start a new transmission.
      </motion.p>

      {/* Keyboard hint */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="mt-4 flex items-center gap-3"
      >
        <div className="flex items-center gap-1.5 rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5">
          <kbd className="font-mono text-[10px] font-medium text-zinc-600">⌘</kbd>
          <kbd className="font-mono text-[10px] font-medium text-zinc-600">K</kbd>
          <span className="ml-1 text-[10px] text-zinc-700">Jump to channel</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5">
          <kbd className="font-mono text-[10px] font-medium text-zinc-600">⌘</kbd>
          <kbd className="font-mono text-[10px] font-medium text-zinc-600">N</kbd>
          <span className="ml-1 text-[10px] text-zinc-700">New message</span>
        </div>
      </motion.div>

      <motion.button
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.0 }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="mt-6 flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.02] px-4 py-2 text-[12px] font-medium text-zinc-400 transition-all duration-200 hover:bg-white/[0.05] hover:text-white hover:border-white/[0.12]"
      >
        <Radio size={13} />
        Start a new transmission
      </motion.button>
    </div>
  );
}

export default function InboxPage() {
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const currentOrg = useAuthStore((s) => s.currentOrg);

  const channels = useMessengerStore((s) => s.channels);
  const activeChannelId = useMessengerStore((s) => s.activeChannelId);
  const activeView = useMessengerStore((s) => s.activeView);

  const orgId = currentOrg?.id;
  const userId = user?.id;

  const channelIdsRef = useRef<string[]>([]);
  useEffect(() => {
    channelIdsRef.current = channels.map((c) => c.id);
  }, [channels]);

  useEffect(() => {
    if (!userId || channels.length === 0) return;

    const supabase = createClient();

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
                if (data) useMessengerStore.getState().addRealtimeMessage(data as Message);
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

  const activeChannel = channels.find((c) => c.id === activeChannelId);
  const userProfile = useMemo(() => ({
    id: userId || "",
    full_name: profile?.full_name || "You",
    avatar_url: profile?.avatar_url || null,
  }), [userId, profile?.full_name, profile?.avatar_url]);

  // Avoid rendering messenger until we have a user (prevents undefined access downstream)
  if (!userId) {
    return (
      <div className="relative flex h-full items-center justify-center overflow-hidden bg-[var(--background)]">
        <p className="text-[13px] text-zinc-500">Loading messages…</p>
      </div>
    );
  }

  return (
    <div className="relative flex h-full overflow-hidden bg-[var(--background)]">
      {/* Noise texture — PRD Design Revamp */}
      <div className="stealth-noise" />

      <MessengerSidebar userId={userId} orgId={currentOrg?.id ?? undefined} />

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
        ) : activeView === "mentions" ? (
          <motion.div
            key="mentions"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-1 overflow-hidden"
          >
            <MentionsPanel />
          </motion.div>
        ) : activeChannel ? (
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
  );
}

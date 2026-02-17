"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/lib/auth-store";
import { useMessengerStore } from "@/lib/stores/messenger-store";
import { MessengerSidebar } from "@/components/messenger/messenger-sidebar";
import { ChatStream } from "@/components/messenger/chat-stream";
import { TriagePanel } from "@/components/messenger/triage-panel";
import { createClient } from "@/lib/supabase/client";
import type { Message } from "@/lib/stores/messenger-store";

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

  // Load channels on mount
  useEffect(() => {
    if (orgId && !channelsLoaded) {
      loadChannels(orgId);
    }
  }, [orgId, channelsLoaded, loadChannels]);

  // Real-time subscription for new messages
  useEffect(() => {
    if (!userId || channels.length === 0) return;

    const supabase = createClient();
    const channelIds = channels.map((c) => c.id);

    // Subscribe to messages for all user's channels
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
          // Only add if it's in one of our channels and not from us
          if (channelIds.includes(newMsg.channel_id) && newMsg.sender_id !== userId) {
            // Fetch full message with profile
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
    <div className="flex h-full overflow-hidden">
      {/* Messenger sidebar */}
      <MessengerSidebar userId={userId || ""} />

      {/* Main content area */}
      {activeView === "triage" ? (
        <TriagePanel />
      ) : activeChannel ? (
        <ChatStream
          channel={activeChannel}
          userId={userId || ""}
          userProfile={userProfile}
        />
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-[rgba(0,230,118,0.08)]">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-[#00E676]">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <p className="text-[15px] font-medium text-zinc-300">
            Select a conversation
          </p>
          <p className="mt-1 max-w-[260px] text-[12px] text-zinc-600">
            Choose a channel or direct message from the sidebar to start chatting
          </p>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

interface UseRealtimeChatParams<TMessage> {
  channelId: string | null;
  onInsert: (message: TMessage) => void;
}

/**
 * Subscribes to realtime inserts for one chat channel.
 * Caller controls message state (store/local) via onInsert callback.
 */
export function useRealtimeChat<TMessage>({ channelId, onInsert }: UseRealtimeChatParams<TMessage>) {
  useEffect(() => {
    if (!channelId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`room:${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `channel_id=eq.${channelId}`,
        },
        (payload) => {
          if (payload.new) {
            onInsert(payload.new as TMessage);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelId, onInsert]);
}

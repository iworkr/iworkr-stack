"use client";

import { useEffect, useRef } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

/**
 * Subscribe to Supabase Realtime changes on a table.
 * Calls `onInsert`, `onUpdate`, or `onDelete` when rows change.
 */
export function useRealtime(
  table: string,
  options: {
    filter?: string;
    onInsert?: (row: any) => void;
    onUpdate?: (row: any) => void;
    onDelete?: (row: any) => void;
    onChange?: () => void;
    enabled?: boolean;
  }
) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (options.enabled === false || !isSupabaseConfigured) return;

    const supabase = createClient();
    const channelName = `realtime-${table}-${Date.now()}`;

    let channelConfig: any = {
      event: "*",
      schema: "public",
      table,
    };
    if (options.filter) {
      channelConfig.filter = options.filter;
    }

    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", channelConfig, (payload: any) => {
        if (payload.eventType === "INSERT" && options.onInsert) {
          options.onInsert(payload.new);
        } else if (payload.eventType === "UPDATE" && options.onUpdate) {
          options.onUpdate(payload.new);
        } else if (payload.eventType === "DELETE" && options.onDelete) {
          options.onDelete(payload.old);
        }
        options.onChange?.();
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, options.filter, options.enabled]);

  return channelRef;
}

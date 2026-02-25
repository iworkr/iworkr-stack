"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type { RealtimeChannel, RealtimePresenceState } from "@supabase/supabase-js";

// ═══════════════════════════════════════════════════════════
// ── Table-Level Realtime (postgres_changes) ──────────────
// ═══════════════════════════════════════════════════════════

/* eslint-disable @typescript-eslint/no-explicit-any */
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

    const channelConfig: any = {
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

// ═══════════════════════════════════════════════════════════
// ── Workspace-Scoped Channel (Presence + Broadcast) ──────
// ═══════════════════════════════════════════════════════════

export interface PresenceMember {
  userId: string;
  status: string;
  lat?: number;
  lng?: number;
  connectedAt?: string;
  [key: string]: unknown;
}

export function useWorkspaceChannel(
  orgId: string | null,
  userId: string | null,
  options?: {
    onPresenceSync?: (members: PresenceMember[]) => void;
    onBroadcast?: (event: string, payload: Record<string, unknown>) => void;
    presenceState?: Record<string, unknown>;
  }
) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [members, setMembers] = useState<PresenceMember[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!orgId || !userId || !isSupabaseConfigured) return;

    const supabase = createClient();
    const channelName = `workspace:${orgId}`;

    const channel = supabase.channel(channelName, {
      config: { presence: { key: userId } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState() as RealtimePresenceState;
        const parsed: PresenceMember[] = [];
        for (const [, presences] of Object.entries(state)) {
          for (const p of presences) {
            const payload = p as Record<string, any>;
            parsed.push({
              userId: payload.user_id ?? "",
              status: payload.status ?? "online",
              lat: payload.lat,
              lng: payload.lng,
              connectedAt: payload.connected_at,
              ...payload,
            });
          }
        }
        setMembers(parsed);
        options?.onPresenceSync?.(parsed);
      })
      .on("broadcast", { event: "*" }, (payload: any) => {
        options?.onBroadcast?.(payload.event, payload.payload);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setConnected(true);
          channel.track({
            user_id: userId,
            status: "online",
            connected_at: new Date().toISOString(),
            ...(options?.presenceState ?? {}),
          });
        }
      });

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
      setConnected(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, userId]);

  const broadcast = useCallback(
    (event: string, payload: Record<string, unknown>) => {
      channelRef.current?.send({
        type: "broadcast",
        event,
        payload: { ...payload, sender_id: userId, timestamp: new Date().toISOString() },
      });
    },
    [userId]
  );

  const updatePresence = useCallback(
    (state: Record<string, unknown>) => {
      channelRef.current?.track({
        user_id: userId,
        ...state,
        updated_at: new Date().toISOString(),
      });
    },
    [userId]
  );

  return { members, connected, broadcast, updatePresence, channel: channelRef };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ═══════════════════════════════════════════════════════════
// ── Auto-Invalidation Hook ───────────────────────────────
// ═══════════════════════════════════════════════════════════
//
// Automatically refetches data when a Realtime change is detected.
// Wraps the table-level useRealtime with a simple callback pattern.

export function useRealtimeInvalidation(
  table: string,
  options: {
    filter?: string;
    enabled?: boolean;
    onInvalidate: () => void;
  }
) {
  return useRealtime(table, {
    filter: options.filter,
    enabled: options.enabled,
    onChange: options.onInvalidate,
  });
}

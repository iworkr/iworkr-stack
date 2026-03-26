/**
 * @component NewMessageModal
 * @status COMPLETE
 * @description Modal for starting a new direct message conversation with team member search
 * @lastAudit 2026-03-22
 */
"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Search, User, Loader2 } from "lucide-react";
import { useState, useRef, useEffect, useMemo } from "react";
import { useMessengerStore } from "@/lib/stores/messenger-store";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToastStore } from "@/components/app/action-toast";

interface MessageableUser {
  id: string;
  full_name: string;
  email: string | null;
  role: string | null;
  avatar_url: string | null;
}

type RpcClient = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message?: string } | null }>;
};

interface NewMessageModalProps {
  open: boolean;
  onClose: () => void;
  orgId: string;
  currentUserId: string;
}

export function NewMessageModal({
  open,
  onClose,
  orgId,
  currentUserId,
}: NewMessageModalProps) {
  const router = useRouter();
  const addChannelLocally = useMessengerStore((s) => s.addChannelLocally);
  const addToast = useToastStore((s) => s.addToast);
  const [messageableUsers, setMessageableUsers] = useState<MessageableUser[]>([]);
  const [query, setQuery] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [isNavigating, setIsNavigating] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !orgId?.trim()) return;

    let mounted = true;
    const supabase = createClient() as unknown as RpcClient;

    const fetchUsers = async () => {
      setLoadingUsers(true);
      try {
        const { data, error } = await supabase.rpc("get_messageable_users", {
          p_workspace_id: orgId,
        });
        if (error) throw error;
        if (!mounted) return;
        setMessageableUsers(
          ((data ?? []) as MessageableUser[]).filter((u) => u.id !== currentUserId),
        );
      } catch {
        if (!mounted) return;
        setMessageableUsers([]);
        addToast("Unable to load messageable users.", undefined, "error");
      } finally {
        if (mounted) setLoadingUsers(false);
      }
    };

    void fetchUsers();
    return () => {
      mounted = false;
    };
  }, [open, orgId, currentUserId, addToast]);

  const filtered = useMemo(() => {
    if (!query.trim()) return messageableUsers;
    const q = query.toLowerCase();
    return messageableUsers.filter(
      (m) =>
        (m.full_name || "").toLowerCase().includes(q) ||
        (m.email || "").toLowerCase().includes(q) ||
        (m.role || "").toLowerCase().includes(q),
    );
  }, [messageableUsers, query]);

  const handleSelectUser = async (targetUserId: string) => {
    if (!orgId?.trim() || isNavigating) return;

    const supabase = createClient() as unknown as RpcClient;
    setIsNavigating(targetUserId);

    try {
      const { data: channelId, error } = await supabase.rpc("get_or_create_direct_message", {
        p_target_user_id: targetUserId,
        p_workspace_id: orgId,
      });
      if (error) throw error;
      if (!channelId) throw new Error("No channel returned");

      addChannelLocally({
        id: String(channelId),
        organization_id: orgId,
        type: "dm",
        name: null,
        description: null,
        context_id: null,
        context_type: null,
        created_by: null,
        is_archived: false,
        metadata: {},
        last_message_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      router.push(`/dashboard/messages/${channelId}`);
      onClose();
    } catch {
      addToast("Failed to start conversation. Please try again.", undefined, "error");
    } finally {
      setIsNavigating(null);
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-white/5 bg-zinc-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
          <h3 className="font-display text-[15px] font-semibold text-white">
            New message
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-white/5 hover:text-white"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Stealth search */}
        <div className="border-b border-white/5 px-4 py-3">
          <div className="flex items-center gap-2 rounded-lg px-2.5 py-2 focus-within:border-b focus-within:border-white/10">
            <Search size={14} className="shrink-0 text-zinc-600" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search team members…"
              className="flex-1 bg-transparent text-[13px] text-zinc-200 outline-none placeholder:text-zinc-600"
            />
          </div>
        </div>

        <div className="max-h-[320px] overflow-y-auto py-2">
          {loadingUsers ? (
            <div className="flex items-center justify-center px-5 py-8 text-zinc-500">
              <Loader2 size={14} className="animate-spin" />
              <span className="ml-2 text-[12px]">Loading team members…</span>
            </div>
          ) : filtered.length === 0 ? (
            <p className="px-5 py-8 text-center text-[12px] text-zinc-500">
              {query.trim() ? "No matching members" : "No messageable members"}
            </p>
          ) : (
            filtered.map((member) => (
              <button
                key={member.id}
                type="button"
                onClick={() => void handleSelectUser(member.id)}
                disabled={!!isNavigating}
                className="flex w-full items-center gap-3 px-5 py-2.5 text-left transition-colors hover:bg-white/5 disabled:opacity-50"
              >
                <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/5 bg-zinc-800 text-[11px] font-semibold text-white">
                  {(member.full_name || "??")
                    .split(" ")
                    .map((w) => w[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-zinc-200">
                    {member.full_name}
                  </p>
                  <p className="truncate text-[11px] text-zinc-500">
                    {member.email || member.role || "Team member"}
                  </p>
                </div>
                {isNavigating === member.id ? (
                  <Loader2 size={14} className="shrink-0 animate-spin text-emerald-400" />
                ) : (
                  <User size={14} className="shrink-0 text-zinc-600" />
                )}
              </button>
            ))
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

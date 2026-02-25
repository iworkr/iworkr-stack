"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Search, User } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useMessengerStore } from "@/lib/stores/messenger-store";
import { useTeamStore } from "@/lib/team-store";

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
  const openDM = useMessengerStore((s) => s.openDM);
  const members = useTeamStore((s) =>
    (s.members ?? []).filter(
      (m) => m.id !== currentUserId && (m.status === "active" || !m.status)
    )
  );
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [open]);

  const filtered = query.trim()
    ? members.filter(
        (m) =>
          m.name.toLowerCase().includes(query.toLowerCase()) ||
          (m.email || "").toLowerCase().includes(query.toLowerCase())
      )
    : members;

  const handleSelect = async (targetUserId: string) => {
    if (!orgId?.trim()) return;
    setLoading(true);
    await openDM(orgId, targetUserId);
    setLoading(false);
    onClose();
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
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-white/5 bg-zinc-950 shadow-2xl"
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
          {filtered.length === 0 ? (
            <p className="px-5 py-8 text-center text-[12px] text-zinc-500">
              {query.trim() ? "No matching members" : "No team members"}
            </p>
          ) : (
            filtered.map((member) => (
              <button
                key={member.id}
                type="button"
                onClick={() => handleSelect(member.id)}
                disabled={loading}
                className="flex w-full items-center gap-3 px-5 py-2.5 text-left transition-colors hover:bg-white/5 disabled:opacity-50"
              >
                <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/5 bg-zinc-800 text-[11px] font-semibold text-white">
                  {member.initials}
                  {member.onlineStatus === "online" && (
                    <span className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-zinc-950 bg-emerald-500" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-zinc-200">
                    {member.name}
                  </p>
                  {member.email && (
                    <p className="truncate text-[11px] text-zinc-500">
                      {member.email}
                    </p>
                  )}
                </div>
                <User size={14} className="shrink-0 text-zinc-600" />
              </button>
            ))
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

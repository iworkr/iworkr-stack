"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import {
  AtSign,
  Hash,
  Briefcase,
  MessageSquare,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { getMentions, type MentionItem } from "@/app/actions/messenger";
import { useAuthStore } from "@/lib/auth-store";
import { useMessengerStore } from "@/lib/stores/messenger-store";

/* ── Helpers ─────────────────────────────────────────────── */

function formatTimestamp(ts: string): string {
  const date = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-AU", { month: "short", day: "numeric" });
}

function channelIcon(type: string) {
  switch (type) {
    case "job_context":
      return <Briefcase size={12} strokeWidth={1.5} className="text-zinc-500" />;
    case "group":
      return <Hash size={12} strokeWidth={1.5} className="text-zinc-500" />;
    default:
      return <MessageSquare size={12} strokeWidth={1.5} className="text-zinc-500" />;
  }
}

function highlightMentions(content: string): React.ReactNode {
  const parts = content.split(/(@\S+)/g);
  return parts.map((part, i) =>
    part.startsWith("@") ? (
      <span key={i} className="font-medium text-emerald-400/80">
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

/* ── Mentions Panel ──────────────────────────────────────── */

export function MentionsPanel() {
  const user = useAuthStore((s) => s.user);
  const currentOrg = useAuthStore((s) => s.currentOrg);
  const setActiveView = useMessengerStore((s) => s.setActiveView);
  const setActiveChannel = useMessengerStore((s) => s.setActiveChannel);

  const [mentions, setMentions] = useState<MentionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const orgId = currentOrg?.id;
  const userId = user?.id;

  async function loadMentions() {
    if (!orgId || !userId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getMentions(orgId, userId);
      if (result.error) {
        setError(result.error);
      } else {
        setMentions(result.data || []);
      }
    } catch {
      setError("Failed to load mentions");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMentions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, userId]);

  function handleMentionClick(mention: MentionItem) {
    setActiveView("chat");
    setActiveChannel(mention.channelId);
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.04] px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
            <AtSign size={16} />
          </div>
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight text-white">
              Mentions
            </h2>
            <p className="text-[11px] text-zinc-500">
              Messages where you were mentioned
            </p>
          </div>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={loadMentions}
          disabled={loading}
          className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-300 disabled:opacity-50"
          title="Refresh mentions"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        </motion.button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-none">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-zinc-600" />
            <p className="mt-3 text-[12px] text-zinc-600">
              Loading mentions...
            </p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-[13px] text-zinc-500">{error}</p>
            <button
              onClick={loadMentions}
              className="mt-3 text-[12px] text-emerald-500 hover:text-emerald-400"
            >
              Try again
            </button>
          </div>
        ) : mentions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-900 text-zinc-700">
              <AtSign size={24} />
            </div>
            <p className="text-[13px] font-medium text-zinc-400">
              No mentions yet
            </p>
            <p className="mt-1 max-w-[240px] text-[11px] text-zinc-600">
              When someone mentions you in a message, it will appear here
            </p>
          </div>
        ) : (
          <div className="p-3">
            <AnimatePresence>
              {mentions.map((mention, idx) => (
                <motion.button
                  key={mention.messageId}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ delay: idx * 0.03, duration: 0.2 }}
                  onClick={() => handleMentionClick(mention)}
                  className="group mb-1 flex w-full flex-col rounded-lg px-3 py-3 text-left transition-all duration-150 hover:bg-white/[0.04]"
                >
                  {/* Top row: channel + timestamp */}
                  <div className="mb-1.5 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      {channelIcon(mention.channelType)}
                      <span className="text-[11px] font-medium text-zinc-500">
                        {mention.channelName}
                      </span>
                    </div>
                    <span className="font-mono text-[10px] text-zinc-700">
                      {formatTimestamp(mention.timestamp)}
                    </span>
                  </div>

                  {/* Sender */}
                  <div className="mb-1 flex items-center gap-2">
                    {mention.senderAvatarUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={mention.senderAvatarUrl}
                        alt=""
                        className="h-4 w-4 rounded-full"
                      />
                    ) : (
                      <div className="flex h-4 w-4 items-center justify-center rounded-full bg-zinc-800 text-[7px] font-bold text-zinc-500">
                        {mention.senderName
                          .split(" ")
                          .map((w) => w[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                    )}
                    <span className="text-[12px] font-medium text-zinc-300">
                      {mention.senderName}
                    </span>
                  </div>

                  {/* Message content */}
                  <p className="line-clamp-2 text-[13px] leading-relaxed text-zinc-400">
                    {highlightMentions(mention.content)}
                  </p>
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}

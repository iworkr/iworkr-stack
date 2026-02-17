"use client";

import { motion } from "framer-motion";
import { Inbox, Check, Clock } from "lucide-react";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useShellStore } from "@/lib/shell-store";
import { useInboxStore } from "@/lib/inbox-store";
import { type InboxItemType } from "@/lib/data";
import { WidgetShell } from "./widget-shell";
import { Shimmer, ShimmerCircle } from "@/components/ui/shimmer";
import type { WidgetSize } from "@/lib/dashboard-store";

function getAvatarGrad(initials: string) {
  const grads = [
    "from-zinc-600 to-zinc-700",
    "from-zinc-500 to-zinc-700",
    "from-zinc-600 to-zinc-800",
    "from-zinc-700 to-zinc-800",
    "from-zinc-500 to-zinc-600",
    "from-zinc-600 to-zinc-700",
  ];
  let hash = 0;
  for (let i = 0; i < initials.length; i++) hash = initials.charCodeAt(i) + ((hash << 5) - hash);
  return grads[Math.abs(hash) % grads.length];
}

/* ── Zen Empty State (CSS Lottie-style) ───────────────── */
function ZenEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="relative mb-4 flex h-14 w-14 items-center justify-center">
        {/* Pulsing ring */}
        <div className="absolute inset-0 rounded-full border border-emerald-500/20 animate-zen-ring" />
        <div className="absolute inset-1 rounded-full border border-emerald-500/10 animate-zen-ring" style={{ animationDelay: "0.6s" }} />
        {/* Center checkmark */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M3.5 8.5L6.5 11.5L12.5 4.5"
              stroke="#10B981"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="animate-checkmark"
            />
          </svg>
        </motion.div>
      </div>
      <motion.p
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="text-[12px] font-medium text-zinc-400"
      >
        Inbox Zero. Nice work.
      </motion.p>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="mt-0.5 text-[10px] text-zinc-600"
      >
        No unread notifications
      </motion.p>
    </div>
  );
}

export function WidgetInbox({ size = "medium" }: { size?: WidgetSize }) {
  const router = useRouter();
  const { items, markAsRead, archive } = useInboxStore();
  const inboxLoaded = useInboxStore((s) => s.loaded);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const unreadItems = useMemo(
    () => items.filter((i) => !i.read && !i.archived && !i.snoozedUntil),
    [items]
  );
  const unreadCount = unreadItems.length;
  const maxItems = size === "small" ? 0 : size === "medium" ? 3 : 8;
  const displayItems = unreadItems.slice(0, maxItems);
  const showActions = size === "large";

  /* ── SMALL: Unread count badge ──────────────────────── */
  if (size === "small") {
    return (
      <WidgetShell delay={0.1}>
        <div
          className="flex h-full cursor-pointer flex-col items-center justify-center p-3"
          onClick={() => router.push("/dashboard/inbox")}
        >
          <div className="relative">
            <Inbox size={16} className="text-zinc-500" />
            {unreadCount > 0 && (
              <span className="absolute -right-2 -top-1.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-emerald-500 px-1 text-[8px] font-bold text-black">
                {unreadCount}
              </span>
            )}
          </div>
          <span className="mt-2 text-[10px] text-zinc-600">
            {unreadCount > 0 ? `${unreadCount} unread` : "All read"}
          </span>
        </div>
      </WidgetShell>
    );
  }

  /* ── MEDIUM / LARGE ─────────────────────────────────── */
  return (
    <WidgetShell
      delay={0.1}
      header={
        <div className="flex items-center gap-2">
          <Inbox size={14} className="text-zinc-500" />
          <span className="text-[13px] font-medium text-zinc-300">Triage</span>
          {unreadCount > 0 && (
            <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-emerald-500/10 px-1 text-[9px] font-medium text-emerald-500">
              {unreadCount}
            </span>
          )}
        </div>
      }
      action={
        <button
          onClick={() => router.push("/dashboard/inbox")}
          className="text-[11px] text-zinc-600 transition-colors hover:text-zinc-300"
        >
          View all
        </button>
      }
    >
      {!inboxLoaded && items.length === 0 ? (
        <div className="divide-y divide-white/[0.03]">
          {Array.from({ length: maxItems || 3 }).map((_, i) => (
            <div key={i} className="flex items-start gap-2.5 px-4 py-2.5">
              <div className="mt-2 h-[5px] w-[5px] shrink-0 rounded-full bg-zinc-800/50" />
              <ShimmerCircle className="mt-0.5 h-6 w-6" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Shimmer className="h-3 w-24" />
                <Shimmer className="h-2 w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : displayItems.length === 0 ? (
        <ZenEmptyState />
      ) : (
        <div className="divide-y divide-white/[0.03]">
          {displayItems.map((item, i) => (
            <motion.button
              key={item.id}
              initial={{ opacity: 0, x: 6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 + i * 0.05, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              onClick={() => { markAsRead(item.id); router.push("/dashboard/inbox"); }}
              onMouseEnter={() => setHoveredId(item.id)}
              onMouseLeave={() => setHoveredId(null)}
              className="group flex w-full items-start gap-2.5 px-4 py-2.5 text-left transition-colors duration-150 hover:bg-white/[0.02]"
            >
              {/* Unread dot — small emerald */}
              <div className="mt-2 h-[5px] w-[5px] shrink-0 rounded-full bg-emerald-500" />
              <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${getAvatarGrad(item.senderInitials)}`}>
                <span className="text-[8px] font-semibold text-zinc-300">{item.senderInitials}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[11px] font-medium text-zinc-300 group-hover:text-zinc-100 transition-colors">
                    {item.sender}
                  </span>
                  <span className="shrink-0 text-[9px] text-zinc-700">{item.time}</span>
                </div>
                <p className="truncate text-[10px] text-zinc-600">{item.body}</p>
                {showActions && item.body && (
                  <p className="mt-0.5 line-clamp-2 text-[9px] leading-relaxed text-zinc-700">{item.body}</p>
                )}
              </div>

              {(showActions || hoveredId === item.id) && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex shrink-0 items-center gap-0.5"
                >
                  <button
                    onClick={(e) => { e.stopPropagation(); archive(item.id); }}
                    className="rounded-md p-1 text-zinc-600 transition-colors hover:bg-white/[0.04] hover:text-emerald-500"
                  >
                    <Check size={11} />
                  </button>
                </motion.div>
              )}
            </motion.button>
          ))}

          {size === "large" && unreadItems.length > maxItems && (
            <div className="px-4 py-2 text-center">
              <button
                onClick={() => router.push("/dashboard/inbox")}
                className="text-[10px] text-zinc-500 transition-colors hover:text-emerald-500"
              >
                +{unreadItems.length - maxItems} more
              </button>
            </div>
          )}
        </div>
      )}
    </WidgetShell>
  );
}

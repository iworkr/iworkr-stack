"use client";

import { motion } from "framer-motion";
import { Inbox, Check, Clock, Sun, Bell, CheckCircle, MessageSquare, Cog, Star } from "lucide-react";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useShellStore } from "@/lib/shell-store";
import { useInboxStore } from "@/lib/inbox-store";
import { type InboxItemType } from "@/lib/data";
import { WidgetShell } from "./widget-shell";
import { Shimmer, ShimmerCircle } from "@/components/ui/shimmer";
import type { WidgetSize } from "@/lib/dashboard-store";

const typeIcons: Record<InboxItemType, typeof Bell> = {
  job_assigned: Bell,
  quote_approved: CheckCircle,
  mention: MessageSquare,
  system: Cog,
  review: Star,
};

function getAvatarGrad(initials: string) {
  const grads = [
    "from-zinc-500 to-zinc-600",
    "from-zinc-400 to-zinc-600",
    "from-zinc-600 to-zinc-700",
    "from-zinc-500 to-zinc-700",
    "from-zinc-400 to-zinc-500",
    "from-zinc-600 to-zinc-800",
  ];
  let hash = 0;
  for (let i = 0; i < initials.length; i++) hash = initials.charCodeAt(i) + ((hash << 5) - hash);
  return grads[Math.abs(hash) % grads.length];
}

export function WidgetInbox({ size = "medium" }: { size?: WidgetSize }) {
  const router = useRouter();
  const { openSlideOver } = useShellStore();
  const { items, markAsRead, archive } = useInboxStore();
  const inboxLoaded = useInboxStore((s) => s.loaded);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const unreadItems = useMemo(
    () => items.filter((i) => !i.read && !i.archived && !i.snoozedUntil),
    [items]
  );
  const unreadCount = unreadItems.length;

  // Control how many items to show based on size
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
              <span className="absolute -right-2 -top-1.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-[#00E676] px-1 text-[8px] font-bold text-black">
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
            <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[rgba(0,230,118,0.12)] px-1 text-[9px] font-medium text-[#00E676]">
              {unreadCount}
            </span>
          )}
        </div>
      }
      action={
        <button
          onClick={() => router.push("/dashboard/inbox")}
          className="text-[11px] text-zinc-500 transition-colors hover:text-zinc-300"
        >
          View all
        </button>
      }
    >
      {!inboxLoaded && items.length === 0 ? (
        <div className="divide-y divide-[rgba(255,255,255,0.04)]">
          {Array.from({ length: maxItems || 3 }).map((_, i) => (
            <div key={i} className="flex items-start gap-2.5 px-4 py-2.5">
              <div className="mt-2 h-[5px] w-[5px] shrink-0 rounded-full bg-zinc-800" />
              <ShimmerCircle className="mt-0.5 h-6 w-6" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Shimmer className="h-3 w-24" />
                <Shimmer className="h-2 w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : displayItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-amber-400/20 bg-gradient-to-br from-amber-400/10 to-orange-500/10"
          >
            <Sun size={18} strokeWidth={1} className="text-amber-400/70" />
          </motion.div>
          <p className="text-[12px] font-medium text-zinc-500">All caught up</p>
          <p className="mt-0.5 text-[10px] text-zinc-700">No unread notifications.</p>
        </div>
      ) : (
        <div className="divide-y divide-[rgba(255,255,255,0.04)]">
          {displayItems.map((item, i) => (
            <motion.button
              key={item.id}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 + i * 0.05, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              onClick={() => { markAsRead(item.id); router.push("/dashboard/inbox"); }}
              onMouseEnter={() => setHoveredId(item.id)}
              onMouseLeave={() => setHoveredId(null)}
              className="group flex w-full items-start gap-2.5 px-4 py-2.5 text-left transition-colors hover:bg-white/[0.02]"
            >
              <div className="mt-2 h-[5px] w-[5px] shrink-0 rounded-full bg-[#00E676]" />
              <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${getAvatarGrad(item.senderInitials)}`}>
                <span className="text-[8px] font-semibold text-white">{item.senderInitials}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[11px] font-medium text-zinc-300 group-hover:text-zinc-100">
                    {item.sender}
                  </span>
                  <span className="shrink-0 text-[9px] text-zinc-700">{item.time}</span>
                </div>
                <p className="truncate text-[10px] text-zinc-600">{item.body}</p>
                {/* Large: show full body preview */}
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
                    className="rounded-md p-1 text-zinc-600 transition-colors hover:bg-zinc-800 hover:text-emerald-400"
                  >
                    <Check size={11} />
                  </button>
                </motion.div>
              )}
            </motion.button>
          ))}

          {/* Large: show remaining count */}
          {size === "large" && unreadItems.length > maxItems && (
            <div className="px-4 py-2 text-center">
              <button
                onClick={() => router.push("/dashboard/inbox")}
                className="text-[10px] text-[#00E676] hover:text-[#00E676]"
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

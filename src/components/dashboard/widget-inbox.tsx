"use client";

import { motion } from "framer-motion";
import { Inbox, Check, Clock, Sun, Bell, CheckCircle, MessageSquare, Cog, Star } from "lucide-react";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useShellStore } from "@/lib/shell-store";
import { useInboxStore } from "@/lib/inbox-store";
import { type InboxItemType } from "@/lib/data";
import { WidgetShell } from "./widget-shell";

const typeIcons: Record<InboxItemType, typeof Bell> = {
  job_assigned: Bell,
  quote_approved: CheckCircle,
  mention: MessageSquare,
  system: Cog,
  review: Star,
};

function getAvatarGrad(initials: string) {
  const grads = [
    "from-blue-500 to-indigo-600",
    "from-violet-500 to-purple-600",
    "from-emerald-500 to-teal-600",
    "from-amber-500 to-orange-600",
    "from-rose-500 to-pink-600",
    "from-cyan-500 to-blue-600",
  ];
  let hash = 0;
  for (let i = 0; i < initials.length; i++) hash = initials.charCodeAt(i) + ((hash << 5) - hash);
  return grads[Math.abs(hash) % grads.length];
}

export function WidgetInbox() {
  const router = useRouter();
  const { openSlideOver } = useShellStore();
  const { items, markAsRead, archive } = useInboxStore();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Get 5 most recent unread items (or all if fewer)
  const unreadItems = useMemo(
    () => items.filter((i) => !i.read && !i.archived && !i.snoozedUntil).slice(0, 5),
    [items]
  );

  const unreadCount = unreadItems.length;

  return (
    <WidgetShell
      delay={0.1}
      header={
        <div className="flex items-center gap-2">
          <Inbox size={14} className="text-zinc-500" />
          <span className="text-[13px] font-medium text-zinc-300">Triage</span>
          {unreadCount > 0 && (
            <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-blue-500/20 px-1 text-[9px] font-medium text-blue-400">
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
      {/* Empty state */}
      {unreadItems.length === 0 ? (
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
          {unreadItems.map((item, i) => (
            <motion.button
              key={item.id}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                delay: 0.15 + i * 0.05,
                duration: 0.3,
                ease: [0.16, 1, 0.3, 1],
              }}
              onClick={() => {
                markAsRead(item.id);
                router.push("/dashboard/inbox");
              }}
              onMouseEnter={() => setHoveredId(item.id)}
              onMouseLeave={() => setHoveredId(null)}
              className="group flex w-full items-start gap-2.5 px-4 py-2.5 text-left transition-colors hover:bg-white/[0.02]"
            >
              {/* Blue dot */}
              <div className="mt-2 h-[5px] w-[5px] shrink-0 rounded-full bg-blue-500" />

              {/* Avatar */}
              <div
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${getAvatarGrad(item.senderInitials)}`}
              >
                <span className="text-[8px] font-semibold text-white">{item.senderInitials}</span>
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[11px] font-medium text-zinc-300 group-hover:text-zinc-100">
                    {item.sender}
                  </span>
                  <span className="shrink-0 text-[9px] text-zinc-700">{item.time}</span>
                </div>
                <p className="truncate text-[10px] text-zinc-600">{item.body}</p>
              </div>

              {/* Quick actions on hover */}
              {hoveredId === item.id && (
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
        </div>
      )}
    </WidgetShell>
  );
}

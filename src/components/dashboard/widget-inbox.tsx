"use client";

import { motion } from "framer-motion";
import { Inbox, Check, ArrowRight } from "lucide-react";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useInboxStore } from "@/lib/inbox-store";
import { WidgetShell } from "./widget-shell";
import { LottieIcon } from "./lottie-icon";
import { successCheckAnimation } from "./lottie-data";
import { Shimmer, ShimmerCircle } from "@/components/ui/shimmer";
import type { WidgetSize } from "@/lib/dashboard-store";

function getAvatarGrad(initials: string) {
  const grads = [
    "from-zinc-600 to-zinc-700",
    "from-zinc-500 to-zinc-700",
    "from-zinc-600 to-zinc-800",
    "from-zinc-700 to-zinc-800",
  ];
  let hash = 0;
  for (let i = 0; i < initials.length; i++) hash = initials.charCodeAt(i) + ((hash << 5) - hash);
  return grads[Math.abs(hash) % grads.length];
}

function ZenEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <LottieIcon
        animationData={successCheckAnimation}
        size={56}
        loop={false}
        autoplay
      />
      <motion.p
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.5 }}
        className="mt-3 text-[13px] font-medium text-zinc-400"
      >
        Inbox Zero. Nice work.
      </motion.p>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9 }}
        className="mt-1 text-[10px] text-zinc-700"
      >
        No unread notifications
      </motion.p>
    </div>
  );
}

export function WidgetInbox({ size = "medium" }: { size?: WidgetSize }) {
  const router = useRouter();
  const items = useInboxStore((s) => s.items);
  const markAsRead = useInboxStore((s) => s.markAsRead);
  const archive = useInboxStore((s) => s.archive);
  const inboxLoaded = useInboxStore((s) => s.loaded);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const unreadItems = useMemo(
    () => items.filter((i) => !i.read && !i.archived && !i.snoozedUntil),
    [items]
  );
  const unreadCount = unreadItems.length;
  const maxItems = size === "small" ? 0 : size === "medium" ? 3 : 8;
  const displayItems = unreadItems.slice(0, maxItems);

  if (size === "small") {
    return (
      <WidgetShell delay={0.15}>
        <div
          className="flex h-full cursor-pointer flex-col items-center justify-center p-4"
          onClick={() => router.push("/dashboard/inbox")}
        >
          <div className="relative">
            <Inbox size={16} className="text-zinc-600" />
            {unreadCount > 0 && (
              <span className="absolute -right-2 -top-1.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-emerald-500 px-1 font-mono text-[8px] font-bold text-black">
                {unreadCount}
              </span>
            )}
          </div>
          <span className="mt-2 text-[10px] text-zinc-600">
            {unreadCount > 0 ? `${unreadCount} unread` : "All clear"}
          </span>
        </div>
      </WidgetShell>
    );
  }

  return (
    <WidgetShell
      delay={0.15}
      header={
        <div className="flex items-center gap-2">
          <Inbox size={14} className="text-zinc-600" />
          <span className="text-[13px] font-medium text-zinc-300">Triage</span>
          {unreadCount > 0 && (
            <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-emerald-500/[0.08] px-1.5 font-mono text-[9px] font-medium text-emerald-400">
              {unreadCount}
            </span>
          )}
        </div>
      }
      action={
        <button
          onClick={() => router.push("/dashboard/inbox")}
          className="flex items-center gap-1 text-[11px] text-zinc-700 transition-colors hover:text-zinc-300"
        >
          View all <ArrowRight size={11} />
        </button>
      }
    >
      {!inboxLoaded && items.length === 0 ? (
        <div className="divide-y divide-white/[0.02]">
          {Array.from({ length: maxItems || 3 }).map((_, i) => (
            <div key={i} className="flex items-start gap-2.5 px-5 py-3">
              <div className="mt-2 h-[5px] w-[5px] shrink-0 rounded-full bg-zinc-800/40" />
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
        <div className="divide-y divide-white/[0.02]">
          {displayItems.map((item, i) => (
            <motion.button
              key={item.id}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + i * 0.06, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              onClick={() => { markAsRead(item.id); router.push("/dashboard/inbox"); }}
              onMouseEnter={() => setHoveredId(item.id)}
              onMouseLeave={() => setHoveredId(null)}
              className="group flex w-full items-start gap-2.5 px-5 py-3 text-left transition-all duration-200 hover:bg-white/[0.015]"
            >
              <div className="mt-2 h-[5px] w-[5px] shrink-0 rounded-full bg-emerald-500" />
              <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${getAvatarGrad(item.senderInitials)}`}>
                <span className="text-[8px] font-semibold text-zinc-300">{item.senderInitials}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[11px] font-medium text-zinc-300 transition-colors group-hover:text-zinc-100">
                    {item.sender}
                  </span>
                  <span className="shrink-0 font-mono text-[9px] text-zinc-800">{item.time}</span>
                </div>
                <p className="truncate text-[10px] text-zinc-600">{item.body}</p>
              </div>

              {hoveredId === item.id && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex shrink-0 items-center"
                >
                  <button
                    onClick={(e) => { e.stopPropagation(); archive(item.id); }}
                    className="rounded-lg p-1.5 text-zinc-700 transition-colors hover:bg-emerald-500/[0.08] hover:text-emerald-400"
                  >
                    <Check size={11} />
                  </button>
                </motion.div>
              )}
            </motion.button>
          ))}

          {unreadItems.length > maxItems && (
            <div className="px-5 py-2.5 text-center">
              <button
                onClick={() => router.push("/dashboard/inbox")}
                className="font-mono text-[10px] text-zinc-700 transition-colors hover:text-emerald-500"
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

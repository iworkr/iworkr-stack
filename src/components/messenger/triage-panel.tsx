"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import {
  Bell,
  CheckCircle,
  MessageSquare,
  Cog,
  Star,
  Archive,
  AlarmClock,
  ExternalLink,
  Check,
  Clock,
  AlertTriangle,
  FileText,
  Package,
  CreditCard,
  Inbox,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { type InboxItem, type InboxItemType } from "@/lib/data";
import { useInboxStore, type InboxTab } from "@/lib/inbox-store";
import { LottieIcon } from "@/components/dashboard/lottie-icon";
import { successCheckAnimation } from "@/components/dashboard/lottie-data";

/* ── Icon / color maps ────────────────────────────────── */

const typeIcons: Record<string, typeof Bell> = {
  job_assigned: Bell,
  quote_approved: CheckCircle,
  mention: MessageSquare,
  system: Cog,
  review: Star,
  invoice_paid: CreditCard,
  invoice_overdue: AlertTriangle,
  schedule_conflict: Clock,
  form_signed: FileText,
  team_invite: Bell,
  stock_low: Package,
};

const typeAccent: Record<string, string> = {
  job_assigned: "border-l-emerald-500/40",
  quote_approved: "border-l-emerald-500/40",
  mention: "border-l-zinc-600/40",
  system: "border-l-amber-500/40",
  review: "border-l-amber-400/40",
  invoice_paid: "border-l-emerald-500/40",
  invoice_overdue: "border-l-red-500/40",
  schedule_conflict: "border-l-amber-500/40",
  form_signed: "border-l-emerald-500/40",
  team_invite: "border-l-emerald-500/40",
};

const tabConfig: { id: InboxTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "snoozed", label: "Snoozed" },
];

/* ── Triage empty state with Lottie ────────────────────── */
function TriageEmptyState({ tab }: { tab: InboxTab }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="mb-5"
      >
        <LottieIcon
          animationData={successCheckAnimation}
          size={56}
          loop={false}
          autoplay
        />
      </motion.div>
      <motion.p
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="text-[15px] font-semibold text-zinc-300"
      >
        {tab === "snoozed" ? "No snoozed items" : "All caught up"}
      </motion.p>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="mt-2 max-w-[260px] text-[12px] leading-relaxed text-zinc-600"
      >
        {tab === "snoozed"
          ? "Snoozed notifications will appear here"
          : "You\u2019ve handled all your notifications"}
      </motion.p>
    </div>
  );
}

export function TriagePanel() {
  const router = useRouter();
  const items = useInboxStore((s) => s.items);
  const tab = useInboxStore((s) => s.activeTab);
  const setTab = useInboxStore((s) => s.setActiveTab);
  const markAsRead = useInboxStore((s) => s.markAsRead);
  const archive = useInboxStore((s) => s.archive);
  const snooze = useInboxStore((s) => s.snooze);
  const selectedId = useInboxStore((s) => s.selectedId);
  const setSelectedId = useInboxStore((s) => s.setSelectedId);

  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const filteredItems = items.filter((item) => {
    if (item.archived) return false;
    if (tab === "unread") return !item.read;
    if (tab === "snoozed") return !!item.snoozedUntil;
    return true;
  });

  function handleAction(item: InboxItem) {
    if (item.jobRef) {
      router.push(`/dashboard/jobs/${item.jobRef}`);
    }
  }

  function getActionLabel(item: InboxItem): string {
    if (item.type === "job_assigned") return "View Job";
    if (item.type === "quote_approved") return "View Quote";
    if (item.type === "mention") return "View Thread";
    if (item.type === "review") return "View Review";
    return "View";
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#050505]">
      {/* Noise texture */}
      <div className="pointer-events-none absolute inset-0 bg-noise opacity-[0.012]" />

      {/* Header — glassmorphism */}
      <div className="relative z-10 flex items-center justify-between border-b border-white/[0.04] bg-black/40 px-5 py-2.5 backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <Inbox size={15} strokeWidth={1.5} className="text-emerald-500/80" />
          <h3 className="text-[14px] font-semibold tracking-tight text-white">
            Triage
          </h3>
          <span className="font-mono text-[11px] text-zinc-700">
            {filteredItems.length}
          </span>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-0.5 rounded-lg border border-white/[0.04] bg-white/[0.02] p-0.5">
          {tabConfig.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`relative rounded-md px-3 py-1 text-[11px] font-medium transition-all duration-150 ${
                tab === t.id
                  ? "text-white"
                  : "text-zinc-600 hover:text-zinc-400"
              }`}
            >
              {tab === t.id && (
                <motion.div
                  layoutId="triage-tab"
                  className="absolute inset-0 rounded-md bg-white/[0.06]"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative z-10">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Feed */}
      <div className="relative z-10 flex-1 overflow-y-auto scrollbar-none">
        {filteredItems.length === 0 ? (
          <TriageEmptyState tab={tab} />
        ) : (
          <AnimatePresence>
            {filteredItems.map((item, idx) => {
              const Icon = typeIcons[item.type] || Bell;
              const borderColor = typeAccent[item.type] || "border-l-zinc-700";
              const isSelected = selectedId === item.id;
              const isHovered = hoveredId === item.id;

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 60 }}
                  transition={{
                    delay: idx * 0.02,
                    duration: 0.25,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className={`relative cursor-pointer border-b border-white/[0.03] border-l-2 px-5 py-3.5 transition-all duration-150 ${borderColor} ${
                    isSelected
                      ? "bg-white/[0.03]"
                      : "hover:bg-white/[0.02]"
                  } ${!item.read ? "" : "opacity-40"}`}
                  onClick={() => setSelectedId(item.id)}
                  onMouseEnter={() => setHoveredId(item.id)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  <div className="flex gap-3">
                    {/* Icon */}
                    <div
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        item.read
                          ? "bg-zinc-800/40"
                          : "bg-emerald-500/8"
                      }`}
                    >
                      <Icon
                        size={14}
                        strokeWidth={1.5}
                        className={
                          item.read
                            ? "text-zinc-600"
                            : "text-emerald-500"
                        }
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[13px] font-semibold ${
                            item.read ? "text-zinc-500" : "text-white"
                          }`}
                        >
                          {item.title}
                        </span>
                        {!item.read && (
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
                        )}
                      </div>
                      <p className="mt-0.5 text-[12px] leading-relaxed text-zinc-600 line-clamp-2">
                        {item.body}
                      </p>
                      <div className="mt-2 flex items-center gap-3">
                        <span className="font-mono text-[10px] text-zinc-700">
                          {item.time}
                        </span>
                        <span className="text-[10px] text-zinc-700">
                          from{" "}
                          <span className="text-zinc-500">{item.sender}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Action buttons on hover */}
                  <AnimatePresence>
                    {isHovered && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.1 }}
                        className="absolute right-4 top-3 flex items-center gap-1"
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAction(item);
                          }}
                          className="flex items-center gap-1 rounded-lg border border-white/[0.06] bg-zinc-900/90 px-2 py-1 text-[10px] font-medium text-zinc-400 backdrop-blur-xl transition-all duration-150 hover:border-emerald-500/20 hover:text-emerald-400"
                        >
                          <ExternalLink size={10} />
                          {getActionLabel(item)}
                        </button>
                        {!item.read && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              markAsRead(item.id);
                            }}
                            className="rounded-lg border border-white/[0.06] bg-zinc-900/90 p-1.5 text-zinc-600 backdrop-blur-xl transition-colors duration-150 hover:text-emerald-500"
                            title="Mark done"
                          >
                            <Check size={12} />
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            archive(item.id);
                          }}
                          className="rounded-lg border border-white/[0.06] bg-zinc-900/90 p-1.5 text-zinc-600 backdrop-blur-xl transition-colors duration-150 hover:text-zinc-200"
                          title="Archive"
                        >
                          <Archive size={12} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const twoHours = new Date(
                              Date.now() + 2 * 60 * 60 * 1000,
                            ).toISOString();
                            snooze(item.id, twoHours);
                          }}
                          className="rounded-lg border border-white/[0.06] bg-zinc-900/90 p-1.5 text-zinc-600 backdrop-blur-xl transition-colors duration-150 hover:text-amber-400"
                          title="Snooze 2 hours"
                        >
                          <AlarmClock size={12} />
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

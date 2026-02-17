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
  job_assigned: "border-l-emerald-500/50",
  quote_approved: "border-l-emerald-500/50",
  mention: "border-l-zinc-600",
  system: "border-l-amber-500/50",
  review: "border-l-amber-400/50",
  invoice_paid: "border-l-emerald-500/50",
  invoice_overdue: "border-l-red-500/50",
  schedule_conflict: "border-l-amber-500/50",
  form_signed: "border-l-emerald-500/50",
  team_invite: "border-l-emerald-500/50",
};

const tabConfig: { id: InboxTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "snoozed", label: "Snoozed" },
];

/* ── Triage empty state with Lottie-style animation ───── */
function TriageEmptyState({ tab }: { tab: InboxTab }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="relative mb-4 flex h-14 w-14 items-center justify-center">
        <div className="absolute inset-0 rounded-full border border-emerald-500/15 animate-zen-ring" />
        <div className="absolute inset-2 rounded-full border border-emerald-500/10 animate-zen-ring" style={{ animationDelay: "0.5s" }} />
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.06] bg-white/[0.02]"
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
        transition={{ delay: 0.4 }}
        className="text-[14px] font-medium text-zinc-400"
      >
        {tab === "snoozed" ? "No snoozed items" : "All caught up"}
      </motion.p>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="mt-1 text-[12px] text-zinc-600"
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
  const {
    items,
    activeTab: tab,
    setActiveTab: setTab,
    markAsRead,
    archive,
    snooze,
    selectedId,
    setSelectedId,
  } = useInboxStore();

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
      {/* Subtle noise */}
      <div className="pointer-events-none absolute inset-0 bg-noise opacity-[0.015]" />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between border-b border-white/[0.04] px-5 py-2.5">
        <div className="flex items-center gap-2">
          <Inbox size={15} strokeWidth={1.5} className="text-zinc-500" />
          <h3 className="text-[14px] font-medium text-white">Triage</h3>
          <span className="text-[11px] text-zinc-600">
            {filteredItems.length} item{filteredItems.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-0.5 rounded-md border border-white/[0.04] bg-white/[0.02] p-0.5">
          {tabConfig.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-all duration-150 ${
                tab === t.id
                  ? "bg-white/[0.06] text-zinc-200"
                  : "text-zinc-600 hover:text-zinc-400"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Feed */}
      <div className="relative z-10 flex-1 overflow-y-auto">
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
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 50 }}
                  transition={{ delay: idx * 0.02, duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className={`relative border-b border-white/[0.03] border-l-2 px-4 py-3 transition-colors duration-150 ${borderColor} ${
                    isSelected
                      ? "bg-white/[0.03]"
                      : "hover:bg-white/[0.015]"
                  } ${!item.read ? "" : "opacity-50"}`}
                  onClick={() => setSelectedId(item.id)}
                  onMouseEnter={() => setHoveredId(item.id)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  <div className="flex gap-3">
                    {/* Icon */}
                    <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
                      item.read ? "bg-zinc-800/40" : "bg-emerald-500/8"
                    }`}>
                      <Icon size={13} strokeWidth={1.5} className={item.read ? "text-zinc-600" : "text-emerald-500"} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-[13px] font-medium ${
                          item.read ? "text-zinc-500" : "text-white"
                        }`}>
                          {item.title}
                        </span>
                        {!item.read && (
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        )}
                      </div>
                      <p className="mt-0.5 text-[12px] leading-relaxed text-zinc-600 line-clamp-2">
                        {item.body}
                      </p>
                      <div className="mt-1.5 flex items-center gap-3">
                        <span className="text-[10px] text-zinc-700">{item.time}</span>
                        <span className="text-[10px] text-zinc-700">from {item.sender}</span>
                      </div>
                    </div>
                  </div>

                  {/* Action buttons on hover */}
                  <AnimatePresence>
                    {isHovered && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute right-3 top-3 flex items-center gap-1"
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAction(item);
                          }}
                          className="flex items-center gap-1 rounded-md border border-white/[0.08] bg-[#0A0A0A] px-2 py-1 text-[10px] text-zinc-400 transition-colors duration-150 hover:border-emerald-500/20 hover:text-emerald-500"
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
                            className="rounded-md border border-white/[0.08] bg-[#0A0A0A] p-1 text-zinc-600 transition-colors duration-150 hover:text-emerald-500"
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
                          className="rounded-md border border-white/[0.08] bg-[#0A0A0A] p-1 text-zinc-600 transition-colors duration-150 hover:text-zinc-300"
                          title="Archive"
                        >
                          <Archive size={12} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const twoHours = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
                            snooze(item.id, twoHours);
                          }}
                          className="rounded-md border border-white/[0.08] bg-[#0A0A0A] p-1 text-zinc-600 transition-colors duration-150 hover:text-amber-400"
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

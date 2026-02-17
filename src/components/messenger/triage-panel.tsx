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
  Sun,
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

const typeColors: Record<string, string> = {
  job_assigned: "border-l-[#00E676]",
  quote_approved: "border-l-[#00E676]",
  mention: "border-l-zinc-500",
  system: "border-l-amber-500",
  review: "border-l-yellow-500",
  invoice_paid: "border-l-[#00E676]",
  invoice_overdue: "border-l-red-500",
  schedule_conflict: "border-l-amber-500",
  form_signed: "border-l-[#00E676]",
  team_invite: "border-l-[#00E676]",
};

const tabConfig: { id: InboxTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "snoozed", label: "Snoozed" },
];

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
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] px-5 py-2.5">
        <div className="flex items-center gap-2">
          <Inbox size={15} className="text-[#00E676]" />
          <h3 className="text-[14px] font-medium text-zinc-200">Triage</h3>
          <span className="text-[11px] text-zinc-600">
            {filteredItems.length} item{filteredItems.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-0.5 rounded-md bg-[rgba(255,255,255,0.03)] p-0.5">
          {tabConfig.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                tab === t.id
                  ? "bg-[rgba(255,255,255,0.08)] text-zinc-200"
                  : "text-zinc-600 hover:text-zinc-400"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto">
        {filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(0,230,118,0.08)]">
              {tab === "snoozed" ? (
                <Sun size={20} className="text-[#00E676]" />
              ) : (
                <Check size={20} className="text-[#00E676]" />
              )}
            </div>
            <p className="text-[14px] font-medium text-zinc-300">
              {tab === "snoozed" ? "No snoozed items" : "All caught up"}
            </p>
            <p className="mt-1 text-[12px] text-zinc-600">
              {tab === "snoozed"
                ? "Snoozed notifications will appear here"
                : "You've handled all your notifications"}
            </p>
          </div>
        ) : (
          <AnimatePresence>
            {filteredItems.map((item, idx) => {
              const Icon = typeIcons[item.type] || Bell;
              const borderColor = typeColors[item.type] || "border-l-zinc-600";
              const isSelected = selectedId === item.id;
              const isHovered = hoveredId === item.id;

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 50 }}
                  transition={{ delay: idx * 0.02 }}
                  className={`relative border-b border-[rgba(255,255,255,0.04)] border-l-2 px-4 py-3 transition-colors ${borderColor} ${
                    isSelected
                      ? "bg-[rgba(255,255,255,0.04)]"
                      : "hover:bg-[rgba(255,255,255,0.02)]"
                  } ${!item.read ? "" : "opacity-60"}`}
                  onClick={() => setSelectedId(item.id)}
                  onMouseEnter={() => setHoveredId(item.id)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  <div className="flex gap-3">
                    {/* Icon */}
                    <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
                      item.read ? "bg-zinc-800/50" : "bg-[rgba(0,230,118,0.08)]"
                    }`}>
                      <Icon size={13} className={item.read ? "text-zinc-600" : "text-[#00E676]"} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-[13px] font-medium ${
                          item.read ? "text-zinc-500" : "text-zinc-200"
                        }`}>
                          {item.title}
                        </span>
                        {!item.read && (
                          <span className="h-1.5 w-1.5 rounded-full bg-[#00E676]" />
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
                          className="flex items-center gap-1 rounded-md border border-[rgba(255,255,255,0.1)] bg-[#0a0a0a] px-2 py-1 text-[10px] text-zinc-300 transition-colors hover:border-[#00E676]/30 hover:text-[#00E676]"
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
                            className="rounded-md border border-[rgba(255,255,255,0.1)] bg-[#0a0a0a] p-1 text-zinc-500 transition-colors hover:text-[#00E676]"
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
                          className="rounded-md border border-[rgba(255,255,255,0.1)] bg-[#0a0a0a] p-1 text-zinc-500 transition-colors hover:text-zinc-300"
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
                          className="rounded-md border border-[rgba(255,255,255,0.1)] bg-[#0a0a0a] p-1 text-zinc-500 transition-colors hover:text-amber-400"
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

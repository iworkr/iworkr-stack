"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Inbox,
  CheckCircle,
  Clock,
  Bell,
  Star,
  AlertTriangle,
  MessageSquare,
  Cog,
  Filter,
  Send,
  ExternalLink,
  AlarmClock,
  Archive,
  MapPin,
  FileText,
  ChevronRight,
  Sun,
  Sparkles,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { type InboxItem, type InboxItemType } from "@/lib/data";
import { useToastStore } from "@/components/app/action-toast";
import { useInboxStore, type InboxTab, type InboxFilter } from "@/lib/inbox-store";
import { useAuthStore } from "@/lib/auth-store";

/* ── Type config ──────────────────────────────────────── */

const typeIcons: Record<InboxItemType, typeof Bell> = {
  job_assigned: Bell,
  quote_approved: CheckCircle,
  mention: MessageSquare,
  system: Cog,
  review: Star,
};

const typeColors: Record<InboxItemType, string> = {
  job_assigned: "text-[#00E676]",
  quote_approved: "text-[#00E676]",
  mention: "text-zinc-400",
  system: "text-amber-400",
  review: "text-yellow-400",
};

const typeBgColors: Record<InboxItemType, string> = {
  job_assigned: "bg-[rgba(0,230,118,0.08)]",
  quote_approved: "bg-[rgba(0,230,118,0.08)]",
  mention: "bg-zinc-500/10",
  system: "bg-amber-500/10",
  review: "bg-yellow-500/10",
};

/* ── Gradient helper ──────────────────────────────────── */

function getAvatarGrad(initials: string) {
  const grads: string[] = [
    "from-zinc-600 to-zinc-700",
    "from-zinc-700 to-zinc-800",
    "from-zinc-500 to-zinc-700",
    "from-zinc-600 to-zinc-800",
    "from-zinc-500 to-zinc-600",
    "from-zinc-700 to-zinc-900",
  ];
  let hash = 0;
  for (let i = 0; i < initials.length; i++) hash = initials.charCodeAt(i) + ((hash << 5) - hash);
  return grads[Math.abs(hash) % grads.length];
}

/* ── Tabs ─────────────────────────────────────────────── */

const tabs: { id: InboxTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "snoozed", label: "Snoozed" },
];

/* ── Snooze options ───────────────────────────────────── */

const snoozeOptions = [
  { label: "Later Today", value: "later_today" },
  { label: "Tomorrow", value: "tomorrow" },
  { label: "Next Week", value: "next_week" },
];

/* ── Preview content helpers ──────────────────────────── */

function getPreviewContent(item: InboxItem) {
  switch (item.type) {
    case "job_assigned":
      return {
        breadcrumb: item.jobRef ? `${item.jobRef} > Assignment` : "Assignment",
        sections: [
          {
            title: "Assignment Details",
            content: item.body,
            icon: Bell,
          },
          ...(item.context
            ? [
                {
                  title: "Job Context",
                  content: `This notification is related to ${item.context}. Review the full job details for site access instructions and client preferences.`,
                  icon: MapPin,
                },
              ]
            : []),
        ],
      };
    case "quote_approved":
      return {
        breadcrumb: item.jobRef ? `${item.jobRef} > Quote Approved` : "Quote Approved",
        sections: [
          {
            title: "Approval Details",
            content: item.body,
            icon: CheckCircle,
          },
          {
            title: "Next Steps",
            content: "A job has been created automatically from the approved quote. Review materials and schedule the work.",
            icon: FileText,
          },
        ],
      };
    case "mention":
      return {
        breadcrumb: item.jobRef ? `${item.jobRef} > Activity` : "Mention",
        sections: [
          {
            title: "Message",
            content: item.body,
            icon: MessageSquare,
          },
        ],
      };
    case "review":
      return {
        breadcrumb: item.context || "Review",
        sections: [
          {
            title: "Client Review",
            content: item.body,
            icon: Star,
          },
        ],
      };
    case "system":
      return {
        breadcrumb: item.context || "System Alert",
        sections: [
          {
            title: "System Notification",
            content: item.body,
            icon: AlertTriangle,
          },
        ],
      };
    default:
      return {
        breadcrumb: "Notification",
        sections: [{ title: "Details", content: item.body, icon: Bell }],
      };
  }
}

/* ══════════════════════════════════════════════════════════
   InboxPage Component
   ══════════════════════════════════════════════════════════ */

export default function InboxPage() {
  const router = useRouter();
  const {
    items,
    selectedId,
    focusedIndex,
    activeTab,
    filter,
    replyText,
    setSelectedId,
    setFocusedIndex,
    setActiveTab,
    setReplyText,
    toggleFilter,
    markAsRead,
    archive,
    unarchive,
    snooze,
    unsnooze,
    moveDown,
    moveUp,
    selectFocused,
    sendReply,
  } = useInboxStore();

  const { addToast } = useToastStore();
  const profile = useAuthStore((s) => s.profile);

  /* ── Compute derived state reactively ────────────── */
  const filteredItems = useMemo(() => {
    let result: InboxItem[];
    switch (activeTab) {
      case "unread":
        result = items.filter((i) => !i.read && !i.archived && !i.snoozedUntil);
        break;
      case "snoozed":
        result = items.filter((i) => !!i.snoozedUntil && !i.archived);
        break;
      default:
        result = items.filter((i) => !i.archived && !i.snoozedUntil);
    }
    if (filter === "mentions") {
      result = result.filter((i) => i.type === "mention");
    }
    return result;
  }, [items, activeTab, filter]);

  const selectedItem = useMemo(
    () => items.find((i) => i.id === selectedId),
    [items, selectedId]
  );

  const unreadCount = useMemo(
    () => items.filter((i) => !i.read && !i.archived && !i.snoozedUntil).length,
    [items]
  );

  const allCleared = items.length > 0 && items.every((i) => i.archived);

  const [showSnoozePopover, setShowSnoozePopover] = useState(false);
  const replyInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  /* ── Auto mark-as-read on selection ──────────────── */
  useEffect(() => {
    if (selectedId) markAsRead(selectedId);
  }, [selectedId, markAsRead]);

  /* ── Keyboard engine ────────────────────────────── */
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const inInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;

      // J/K navigation — works even when not in input
      if (!inInput) {
        if (e.key === "j" || e.key === "J") {
          e.preventDefault();
          moveDown();
          return;
        }
        if (e.key === "k" || e.key === "K") {
          e.preventDefault();
          moveUp();
          return;
        }
        // E or D — Archive
        if (e.key === "e" || e.key === "E" || e.key === "d" || e.key === "D") {
          e.preventDefault();
          if (selectedId) {
            const item = archive(selectedId);
            if (item) {
              addToast(`"${item.title}" archived`, () => unarchive(item));
            }
          }
          return;
        }
        // H — Snooze
        if (e.key === "h" || e.key === "H") {
          e.preventDefault();
          setShowSnoozePopover((prev) => !prev);
          return;
        }
        // Enter — select focused / open full page
        if (e.key === "Enter") {
          e.preventDefault();
          selectFocused();
          return;
        }
      }

      // Escape — close snooze popover
      if (e.key === "Escape") {
        if (showSnoozePopover) {
          setShowSnoozePopover(false);
        }
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [selectedId, showSnoozePopover, moveDown, moveUp, archive, unarchive, selectFocused, addToast]);

  /* ── Scroll focused item into view ──────────────── */
  useEffect(() => {
    if (!listRef.current) return;
    const items = listRef.current.querySelectorAll("[data-inbox-item]");
    const el = items[focusedIndex] as HTMLElement;
    if (el) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [focusedIndex]);

  /* ── Handle snooze ──────────────────────────────── */
  const handleSnooze = useCallback(
    (option: string) => {
      if (!selectedId) return;
      const item = snooze(selectedId, option);
      if (item) {
        const label = snoozeOptions.find((o) => o.value === option)?.label || option;
        addToast(`Snoozed until ${label}`, () => unsnooze(item));
      }
      setShowSnoozePopover(false);
    },
    [selectedId, snooze, unsnooze, addToast]
  );

  /* ── Handle reply ───────────────────────────────── */
  const handleReply = useCallback(() => {
    if (!selectedId || !replyText.trim()) return;
    sendReply(selectedId, replyText);
    addToast("Reply sent");
    setReplyText("");
  }, [selectedId, replyText, sendReply, addToast, setReplyText]);

  /* ── The "Zen" Empty State — only when ALL items cleared ── */
  if (allCleared) {
    return (
      <div className="relative flex h-full flex-col items-center justify-center overflow-hidden">
        {/* Slow gradient mesh background */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.07]">
          <motion.div
            className="absolute -left-1/4 -top-1/4 h-[150%] w-[150%] rounded-full"
            style={{
              background:
                "radial-gradient(ellipse at 30% 50%, rgba(0,230,118,0.15) 0%, transparent 60%), radial-gradient(ellipse at 70% 30%, rgba(0,200,83,0.1) 0%, transparent 50%), radial-gradient(ellipse at 50% 80%, rgba(0,230,118,0.08) 0%, transparent 60%)",
            }}
            animate={{
              rotate: [0, 360],
            }}
            transition={{
              duration: 120,
              repeat: Infinity,
              ease: "linear",
            }}
          />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="relative flex flex-col items-center text-center"
        >
          {/* Zen sun illustration */}
          <motion.div
            className="relative mb-6 flex h-24 w-24 items-center justify-center"
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Outer glow ring */}
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{
                background: "radial-gradient(circle, rgba(250,204,21,0.15) 0%, transparent 70%)",
              }}
              animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            />
            {/* Sun rays */}
            {[...Array(8)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute h-0.5 w-6 rounded-full bg-gradient-to-r from-amber-400/40 to-transparent"
                style={{
                  transform: `rotate(${i * 45}deg)`,
                  transformOrigin: "left center",
                  left: "50%",
                  top: "50%",
                  marginTop: "-1px",
                }}
                initial={{ opacity: 0, scaleX: 0 }}
                animate={{ opacity: [0.3, 0.6, 0.3], scaleX: 1 }}
                transition={{
                  delay: 0.5 + i * 0.08,
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            ))}
            {/* Sun core */}
            <motion.div
              className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full border border-amber-400/20 bg-gradient-to-br from-amber-400/10 to-orange-500/10"
              animate={{ boxShadow: ["0 0 20px rgba(251,191,36,0.1)", "0 0 40px rgba(251,191,36,0.2)", "0 0 20px rgba(251,191,36,0.1)"] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            >
              <Sun size={24} strokeWidth={1} className="text-amber-400/80" />
            </motion.div>
          </motion.div>

          <motion.h2
            className="text-[17px] font-medium tracking-tight text-zinc-200"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            All caught up. Nice work.
          </motion.h2>
          <motion.p
            className="mt-1.5 text-[13px] text-zinc-600"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            Your inbox is clear. Time for a coffee.
          </motion.p>

          {/* Keyboard hint */}
          <motion.div
            className="mt-6 flex items-center gap-3 text-[11px] text-zinc-700"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 font-mono text-[10px]">J</kbd>
              <kbd className="rounded border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 font-mono text-[10px]">K</kbd>
              navigate
            </span>
            <span className="text-zinc-800">|</span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 font-mono text-[10px]">E</kbd>
              archive
            </span>
            <span className="text-zinc-800">|</span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 font-mono text-[10px]">H</kbd>
              snooze
            </span>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  /* ── Preview data ───────────────────────────────── */
  const preview = selectedItem ? getPreviewContent(selectedItem) : null;

  return (
    <div className="flex h-full flex-col md:flex-row">
      {/* ── Left Pane: The Feed ────────────────────────── */}
      <div className="flex w-full shrink-0 flex-col border-b border-[rgba(255,255,255,0.06)] bg-black/20 md:w-[350px] md:border-b-0 md:border-r">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] px-4 py-3">
          <div className="flex items-center gap-2">
            <h1 className="text-[14px] font-semibold text-zinc-200">Inbox</h1>
            {unreadCount > 0 && (
              <motion.span
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[rgba(0,230,118,0.12)] px-1.5 text-[10px] font-medium text-[#00E676]"
              >
                {unreadCount}
              </motion.span>
            )}
          </div>
          <button
            onClick={toggleFilter}
            title={filter === "mentions" ? "Showing mentions only — click for all" : "Filter: Mentions only"}
            className={`rounded-md p-1.5 transition-colors hover:bg-white/5 ${
              filter === "mentions"
                ? "bg-[rgba(0,230,118,0.08)] text-[#00E676]"
                : "text-zinc-600 hover:text-zinc-400"
            }`}
          >
            <Filter size={14} strokeWidth={1.5} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[rgba(255,255,255,0.06)] px-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative px-3 py-2.5 text-[12px] font-medium transition-colors ${
                activeTab === tab.id ? "text-zinc-200" : "text-zinc-600 hover:text-zinc-400"
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <motion.div
                  layoutId="inbox-tab-indicator"
                  className="absolute inset-x-0 -bottom-px h-px bg-[#00E676]"
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
            </button>
          ))}
        </div>

        {/* Notification List */}
        <div ref={listRef} className="flex-1 overflow-y-auto">
          {/* Tab-specific empty state (shown inline in the list) */}
          {filteredItems.length === 0 && !allCleared && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-16 text-center"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)]">
                {activeTab === "snoozed" ? (
                  <AlarmClock size={16} strokeWidth={1} className="text-zinc-600" />
                ) : activeTab === "unread" ? (
                  <CheckCircle size={16} strokeWidth={1} className="text-zinc-600" />
                ) : (
                  <Inbox size={16} strokeWidth={1} className="text-zinc-600" />
                )}
              </div>
              <p className="text-[12px] font-medium text-zinc-500">
                {activeTab === "snoozed"
                  ? "No snoozed items"
                  : activeTab === "unread"
                    ? "All caught up"
                    : "No notifications"}
              </p>
              <p className="mt-0.5 text-[11px] text-zinc-700">
                {activeTab === "snoozed"
                  ? "Snoozed items will appear here."
                  : activeTab === "unread"
                    ? "No unread notifications."
                    : "You're all clear."}
              </p>
            </motion.div>
          )}

          <AnimatePresence mode="popLayout">
            {filteredItems.map((item, i) => {
              const Icon = typeIcons[item.type];
              const isFocused = i === focusedIndex;
              const isActive = item.id === selectedId;

              return (
                <motion.button
                  key={item.id}
                  data-inbox-item
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -100, transition: { duration: 0.2 } }}
                  transition={{ delay: i * 0.02, duration: 0.2 }}
                  onClick={() => {
                    setSelectedId(item.id);
                    setFocusedIndex(i);
                    markAsRead(item.id);
                  }}
                  className={`group relative flex w-full items-start gap-3 px-4 py-3.5 text-left transition-all ${
                    isActive
                      ? "bg-white/[0.05]"
                      : isFocused
                        ? "bg-white/[0.02]"
                        : "hover:bg-white/[0.02]"
                  } ${!item.read ? "" : "opacity-70"}`}
                >
                  {/* Green left border for active */}
                  {isActive && (
                    <motion.div
                      layoutId="inbox-active-indicator"
                      className="absolute bottom-2 left-0 top-2 w-[2px] rounded-full bg-[#00E676]"
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  )}

                  {/* Green dot for unread */}
                  {!item.read && (
                    <div className="absolute left-1.5 top-1/2 -translate-y-1/2">
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="h-[6px] w-[6px] rounded-full bg-[#00E676]"
                      />
                    </div>
                  )}

                  {/* Avatar */}
                  <div
                    className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${getAvatarGrad(item.senderInitials)}`}
                  >
                    {item.senderInitials === "iW" ? (
                      <Sparkles size={12} strokeWidth={1.5} className="text-white" />
                    ) : (
                      <span className="text-[10px] font-semibold text-white">{item.senderInitials}</span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    {/* Top row: sender + time */}
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`truncate text-[12px] ${!item.read ? "font-semibold text-zinc-200" : "font-medium text-zinc-400"}`}
                      >
                        {item.sender}
                      </span>
                      <span className="shrink-0 text-[10px] text-zinc-700">{item.time}</span>
                    </div>

                    {/* Middle row: context */}
                    {item.context && (
                      <p className="mt-0.5 truncate text-[11px] text-zinc-500">{item.context}</p>
                    )}

                    {/* Bottom row: snippet */}
                    <p
                      className={`mt-0.5 line-clamp-2 text-[12px] leading-relaxed ${!item.read ? "text-zinc-400" : "text-zinc-600"}`}
                    >
                      {item.body}
                    </p>

                    {/* Type badge */}
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${typeBgColors[item.type]} ${typeColors[item.type]}`}
                      >
                        <Icon size={8} strokeWidth={2} />
                        {item.type.replace(/_/g, " ")}
                      </span>
                      {item.jobRef && (
                        <span className="rounded bg-white/5 px-1 py-0.5 font-mono text-[9px] text-zinc-600">
                          {item.jobRef}
                        </span>
                      )}
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Keyboard hints */}
        <div className="border-t border-[rgba(255,255,255,0.06)] px-4 py-2">
          <div className="flex items-center justify-center gap-3 text-[10px] text-zinc-700">
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-zinc-800 bg-zinc-900/50 px-1 py-0.5 font-mono text-[9px]">J</kbd>
              <kbd className="rounded border border-zinc-800 bg-zinc-900/50 px-1 py-0.5 font-mono text-[9px]">K</kbd>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-zinc-800 bg-zinc-900/50 px-1 py-0.5 font-mono text-[9px]">E</kbd>
              done
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-zinc-800 bg-zinc-900/50 px-1 py-0.5 font-mono text-[9px]">H</kbd>
              snooze
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-zinc-800 bg-zinc-900/50 px-1 py-0.5 font-mono text-[9px]">↵</kbd>
              open
            </span>
          </div>
        </div>
      </div>

      {/* ── Right Pane: The Preview (hidden on mobile) ── */}
      <div className="hidden flex-1 flex-col overflow-hidden bg-black md:flex">
        <AnimatePresence mode="wait">
          {selectedItem && preview ? (
            <motion.div
              key={selectedItem.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              className="flex flex-1 flex-col overflow-hidden"
            >
              {/* Preview header / breadcrumb */}
              <div className="flex shrink-0 items-center justify-between border-b border-[rgba(255,255,255,0.06)] px-6 py-3">
                <div className="flex items-center gap-1.5 text-[12px] text-zinc-600">
                  {preview.breadcrumb.split(" > ").map((crumb, ci, arr) => (
                    <span key={ci} className="flex items-center gap-1.5">
                      <span className={ci === arr.length - 1 ? "text-zinc-400" : ""}>{crumb}</span>
                      {ci < arr.length - 1 && <ChevronRight size={10} className="text-zinc-700" />}
                    </span>
                  ))}
                </div>
                <button
                  onClick={() => {
                    if (selectedItem?.jobRef) {
                      router.push(`/dashboard/jobs/${selectedItem.jobRef}`);
                    }
                  }}
                  className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] text-zinc-600 transition-colors hover:bg-white/5 hover:text-zinc-400"
                >
                  <ExternalLink size={12} strokeWidth={1.5} />
                  {selectedItem?.jobRef ? "Open Job" : "Open Full Page"}
                </button>
              </div>

              {/* Preview content */}
              <div className="flex-1 overflow-y-auto p-6">
                {/* Item header */}
                <div className="mb-6">
                  <div className="mb-2 flex items-center gap-3">
                    {/* Sender avatar */}
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br ${getAvatarGrad(selectedItem.senderInitials)}`}
                    >
                      {selectedItem.senderInitials === "iW" ? (
                        <Sparkles size={16} strokeWidth={1.5} className="text-white" />
                      ) : (
                        <span className="text-[12px] font-semibold text-white">
                          {selectedItem.senderInitials}
                        </span>
                      )}
                    </div>
                    <div>
                      <h2 className="text-[17px] font-medium tracking-tight text-zinc-100">
                        {selectedItem.title}
                      </h2>
                      <div className="flex items-center gap-2 text-[12px] text-zinc-600">
                        <span>{selectedItem.sender}</span>
                        <span>·</span>
                        <span>{selectedItem.time}</span>
                      </div>
                    </div>
                  </div>

                  {/* Type badge */}
                  <div
                    className={`mt-2 inline-flex items-center gap-1.5 rounded-full border border-[rgba(255,255,255,0.06)] px-2.5 py-1 text-[10px] font-medium ${typeColors[selectedItem.type]}`}
                  >
                    {(() => {
                      const I = typeIcons[selectedItem.type];
                      return <I size={10} />;
                    })()}
                    {selectedItem.type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                  </div>
                </div>

                {/* Content sections */}
                <div className="space-y-4">
                  {preview.sections.map((section, si) => {
                    const SIcon = section.icon;
                    return (
                      <motion.div
                        key={si}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: si * 0.1, duration: 0.2 }}
                        className="rounded-lg border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-4"
                      >
                        <div className="mb-2 flex items-center gap-2 text-[11px] font-medium text-zinc-500">
                          <SIcon size={12} strokeWidth={1.5} />
                          {section.title}
                        </div>
                        <p className="text-[13px] leading-relaxed text-zinc-400">{section.content}</p>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Job ref link */}
                {selectedItem.jobRef && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="mt-4"
                  >
                    <button
                      onClick={() => router.push(`/dashboard/jobs/${selectedItem.jobRef}`)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-3 py-1.5 font-mono text-[11px] text-zinc-500 transition-colors hover:border-[rgba(0,230,118,0.3)] hover:text-[#00E676]"
                    >
                      {selectedItem.jobRef}
                      <ExternalLink size={10} />
                    </button>
                  </motion.div>
                )}

                {/* Action buttons */}
                <div className="relative mt-6 flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (!selectedId) return;
                      const item = archive(selectedId);
                      if (item) addToast(`"${item.title}" archived`, () => unarchive(item));
                    }}
                    disabled={!selectedId}
                    className="flex items-center gap-1.5 rounded-md bg-[#00E676] px-3 py-1.5 text-[12px] font-medium text-black transition-colors hover:bg-[#00C853] disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Archive size={12} />
                    Mark Done
                    <kbd className="ml-1 rounded bg-zinc-200 px-1 py-0.5 font-mono text-[9px] text-zinc-500">
                      E
                    </kbd>
                  </button>

                  {/* Snooze button + popover — always rendered, disabled when no selection */}
                  <div className="relative">
                    <button
                      onClick={() => selectedId && setShowSnoozePopover((v) => !v)}
                      disabled={!selectedId}
                      className="flex items-center gap-1.5 rounded-md border border-[rgba(255,255,255,0.1)] px-3 py-1.5 text-[12px] text-zinc-400 transition-colors hover:bg-white/[0.04] disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <AlarmClock size={12} />
                      Snooze
                      <kbd className="ml-1 rounded border border-[rgba(255,255,255,0.06)] px-1 py-0.5 font-mono text-[9px] text-zinc-600">
                        H
                      </kbd>
                    </button>

                    <AnimatePresence>
                      {showSnoozePopover && selectedId && (
                        <motion.div
                          initial={{ opacity: 0, y: 4, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 4, scale: 0.95 }}
                          transition={{ duration: 0.15 }}
                          className="absolute bottom-full left-0 mb-2 w-44 overflow-hidden rounded-lg border border-[rgba(255,255,255,0.1)] bg-zinc-900 shadow-xl"
                        >
                          {snoozeOptions.map((opt) => (
                            <button
                              key={opt.value}
                              onClick={() => handleSnooze(opt.value)}
                              className="flex w-full items-center gap-2 px-3 py-2 text-[12px] text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-200"
                            >
                              <Clock size={12} strokeWidth={1.5} />
                              {opt.label}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              {/* Quick Reply Bar */}
              <div className="shrink-0 border-t border-[rgba(255,255,255,0.06)] bg-black/40 px-6 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-zinc-600 to-zinc-800">
                    <span className="text-[9px] font-semibold text-white">
                      {profile?.full_name
                        ? profile.full_name.split(/\s+/).map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()
                        : "Me"}
                    </span>
                  </div>
                  <div className="relative flex-1">
                    <input
                      ref={replyInputRef}
                      type="text"
                      placeholder="Quick reply..."
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleReply();
                        }
                      }}
                      className="w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-3 py-2 text-[13px] text-zinc-300 placeholder-zinc-700 outline-none transition-colors focus:border-[rgba(0,230,118,0.4)] focus:bg-[rgba(255,255,255,0.04)]"
                    />
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleReply}
                    disabled={!replyText.trim()}
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#00E676] text-black transition-opacity disabled:opacity-30"
                  >
                    <Send size={14} strokeWidth={1.5} />
                  </motion.button>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="empty-preview"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-1 flex-col items-center justify-center text-center"
            >
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)]">
                <Inbox size={20} strokeWidth={1} className="text-zinc-700" />
              </div>
              <p className="text-[13px] text-zinc-600">Select a notification to preview</p>
              <p className="mt-1 text-[11px] text-zinc-800">
                Use <kbd className="rounded border border-zinc-800 bg-zinc-900 px-1 py-0.5 font-mono text-[9px]">J</kbd>{" "}
                <kbd className="rounded border border-zinc-800 bg-zinc-900 px-1 py-0.5 font-mono text-[9px]">K</kbd> to navigate
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Inbox,
  AtSign,
  Hash,
  Plus,
  Briefcase,
  Search,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useMessengerStore, type Channel } from "@/lib/stores/messenger-store";
import { useInboxStore } from "@/lib/inbox-store";
import { useTeamStore } from "@/lib/team-store";
import { NewMessageModal } from "./new-message-modal";

interface MessengerSidebarProps {
  userId: string;
  orgId?: string | null;
}

export function MessengerSidebar({ userId, orgId }: MessengerSidebarProps) {
  const {
    channels,
    activeChannelId,
    activeView,
    setActiveChannel,
    setActiveView,
  } = useMessengerStore();
  const [newMessageOpen, setNewMessageOpen] = useState(false);
  const unreadInbox = useInboxStore((s) =>
    (s.items ?? []).filter((i) => !i.read && !i.archived).length
  );
  const members = useTeamStore((s) => s.members ?? []);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        e.preventDefault();
        setNewMessageOpen(true);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const groupChannels = channels.filter((c) => c.type === "group");
  const jobChannels = channels.filter((c) => c.type === "job_context");
  const dmChannels = channels.filter((c) => c.type === "dm");

  function handleTriageClick() {
    setActiveView("triage");
    setActiveChannel(null);
  }

  function handleChannelClick(channel: Channel) {
    setActiveView("chat");
    setActiveChannel(channel.id);
  }

  const filterChannels = (list: Channel[]) =>
    searchQuery
      ? list.filter((c) =>
          (c.name || "").toLowerCase().includes(searchQuery.toLowerCase()),
        )
      : list;

  return (
    <aside className="flex h-full w-[280px] shrink-0 flex-col overflow-hidden border-r border-white/[0.04] bg-zinc-950">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-[14px] font-semibold tracking-tight text-white">
          Messages
        </h2>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => orgId && setNewMessageOpen(true)}
          className="rounded-md p-1.5 text-zinc-500 transition-colors duration-150 hover:bg-white/5 hover:text-white"
          title="New message (⌘N)"
        >
          <Plus size={14} strokeWidth={1.5} />
        </motion.button>
      </div>

      {/* Stealth Search */}
      <div className="px-3 pb-2">
        <div
          className={`relative flex items-center gap-2 rounded-lg px-2.5 py-1.5 transition-all duration-200 ${
            searchFocused
              ? "bg-transparent"
              : "bg-transparent"
          }`}
        >
          {/* Spine on focus — monochrome */}
          <motion.div
            className="absolute left-0 top-1 bottom-1 w-[2px] rounded-r bg-white"
            initial={false}
            animate={{
              opacity: searchFocused ? 1 : 0,
              scaleY: searchFocused ? 1 : 0,
            }}
            transition={{ duration: 0.15 }}
          />
          <Search
            size={13}
            className={`shrink-0 transition-colors duration-150 ${
              searchFocused ? "text-white" : "text-zinc-600"
            }`}
          />
          <input
            ref={searchRef}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="Jump to…"
            className="flex-1 bg-transparent text-[12px] text-zinc-300 outline-none placeholder:text-zinc-600"
          />
          {!searchFocused && !searchQuery && (
            <kbd className="flex items-center gap-0.5 rounded border border-white/[0.06] bg-white/[0.02] px-1 py-0.5 text-[9px] font-medium text-zinc-700">
              <span className="text-[10px]">⌘</span>K
            </kbd>
          )}
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-1 scrollbar-none">
        {/* PRD 59: Order — Triage, Job Threads, Direct Messages, Channels */}
        <SectionHeader label="Triage" />
        <div className="mb-3">
          <SidebarItem
            active={activeView === "triage"}
            onClick={handleTriageClick}
            icon={<Inbox size={15} strokeWidth={1.5} />}
            label="Triage"
            badge={unreadInbox > 0 ? unreadInbox : undefined}
            badgeColor="rose"
          />
          <SidebarItem
            active={false}
            onClick={() => {}}
            icon={<AtSign size={15} strokeWidth={1.5} />}
            label="Mentions"
          />
        </div>

        <SectionHeader label="Job Threads" />
        <div className="mb-3">
          {filterChannels(jobChannels).length > 0 ? (
            filterChannels(jobChannels)
              .slice(0, 8)
              .map((ch) => {
                const isUrgent =
                  ch.name?.toLowerCase().includes("urgent") ||
                  ch.name?.toLowerCase().includes("emergency");
                return (
                  <SidebarItem
                    key={ch.id}
                    active={activeChannelId === ch.id && activeView === "chat"}
                    onClick={() => handleChannelClick(ch)}
                    icon={
                      <div className="relative">
                        <Briefcase
                          size={13}
                          strokeWidth={1.5}
                          className={isUrgent ? "text-rose-400" : ""}
                        />
                        {isUrgent && (
                          <motion.div
                            className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-rose-500"
                            animate={{ scale: [1, 1.4, 1] }}
                            transition={{
                              duration: 1.5,
                              repeat: Infinity,
                              ease: "easeInOut",
                            }}
                          />
                        )}
                      </div>
                    }
                    label={ch.name || "Job Thread"}
                  />
                );
              })
          ) : (
            <p className="px-2.5 py-1 text-[11px] text-zinc-700">
              No active job threads
            </p>
          )}
        </div>

        <SectionHeader label="Direct Messages" />
        <div className="mb-3">
          {dmChannels.length > 0
            ? filterChannels(dmChannels).map((ch) => (
                <SidebarItem
                  key={ch.id}
                  active={activeChannelId === ch.id && activeView === "chat"}
                  onClick={() => handleChannelClick(ch)}
                  icon={<DMAvatar name={ch.name || "DM"} online />}
                  label={ch.name || "Direct Message"}
                />
              ))
            : members.slice(0, 5).map((m) => (
                <SidebarItem
                  key={m.id}
                  active={false}
                  onClick={() => {}}
                  icon={
                    <DMAvatar
                      name={m.name || "??"}
                      online={m.onlineStatus === "online"}
                    />
                  }
                  label={m.name || "Team Member"}
                />
              ))}
        </div>

        <SectionHeader label="Channels" />
        <div className="mb-3">
          {filterChannels(groupChannels).map((ch) => (
            <SidebarItem
              key={ch.id}
              active={activeChannelId === ch.id && activeView === "chat"}
              onClick={() => handleChannelClick(ch)}
              icon={<Hash size={14} strokeWidth={1.5} />}
              label={ch.name || "Channel"}
            />
          ))}
          {groupChannels.length === 0 && (
            <p className="px-2.5 py-1 text-[11px] text-zinc-700">
              No channels yet
            </p>
          )}
        </div>
      </nav>

      <NewMessageModal
        open={newMessageOpen}
        onClose={() => setNewMessageOpen(false)}
        orgId={orgId || ""}
        currentUserId={userId}
      />
    </aside>
  );
}

/* ── Section header with hover "+" icon ─────────────────── */
function SectionHeader({ label }: { label: string }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="group mb-1 flex cursor-default items-center justify-between px-2.5"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span className="font-display text-[10px] font-semibold tracking-widest text-zinc-500 uppercase select-none">
        {label}
      </span>
      <AnimatePresence>
        {hovered && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.12 }}
            className="rounded p-0.5 text-zinc-700 transition-colors hover:text-emerald-500"
          >
            <Plus size={12} />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Generic sidebar item ────────────────────────────────── */
interface SidebarItemProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: number;
  badgeColor?: "emerald" | "rose";
}

function SidebarItem({
  active,
  onClick,
  icon,
  label,
  badge,
  badgeColor = "emerald",
}: SidebarItemProps) {
  return (
    <button
      onClick={onClick}
      className={`group relative flex w-full items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13px] transition-all duration-150 ${
        active
          ? "bg-white/5 text-white"
          : "text-zinc-400 hover:bg-white/[0.04] hover:text-white"
      }`}
    >
      {/* Active channel: emerald left spine (PRD 56.0) */}
      {/* PRD 59: Active = 2px Emerald left spine */}
      {active && (
        <motion.div
          layoutId="msg-sidebar-active"
          className="absolute left-0 top-1 bottom-1 w-[2px] rounded-r bg-emerald-500"
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />
      )}

      <span
        className={`shrink-0 transition-colors duration-150 ${
          active ? "text-white" : "text-zinc-600 group-hover:text-zinc-400"
        }`}
      >
        {icon}
      </span>
      <span className="flex-1 truncate text-left font-medium">{label}</span>

      {badge !== undefined && badge > 0 && (
        <span
          className={`flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 font-mono text-[10px] font-semibold ${
            badgeColor === "rose"
              ? "bg-rose-500/15 text-rose-400"
              : "bg-emerald-500/15 text-emerald-500"
          }`}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

/* ── DM Avatar pill ──────────────────────────────────────── */
function DMAvatar({
  name,
  online,
}: {
  name: string;
  online?: boolean;
}) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="relative">
      <div className="flex h-5 w-5 items-center justify-center rounded-md bg-zinc-800/80 text-[8px] font-semibold text-zinc-400">
        {initials}
      </div>
      <div
        className={`absolute -right-0.5 -bottom-0.5 h-[6px] w-[6px] rounded-full border-[1.5px] border-zinc-950 ${
          online ? "bg-emerald-500" : "bg-zinc-700"
        }`}
      />
    </div>
  );
}

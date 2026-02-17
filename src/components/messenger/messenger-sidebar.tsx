"use client";

import { motion } from "framer-motion";
import {
  Inbox,
  AtSign,
  Hash,
  Plus,
  Users,
  Briefcase,
  Search,
  PenSquare,
} from "lucide-react";
import { useState } from "react";
import { useMessengerStore, type Channel } from "@/lib/stores/messenger-store";
import { useInboxStore } from "@/lib/inbox-store";
import { useTeamStore } from "@/lib/team-store";

interface MessengerSidebarProps {
  userId: string;
}

export function MessengerSidebar({ userId }: MessengerSidebarProps) {
  const {
    channels,
    activeChannelId,
    activeView,
    setActiveChannel,
    setActiveView,
  } = useMessengerStore();
  const unreadInbox = useInboxStore((s) => s.items.filter((i) => !i.read && !i.archived).length);
  const members = useTeamStore((s) => s.members);
  const [searchQuery, setSearchQuery] = useState("");

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

  return (
    <aside className="flex h-full w-[260px] shrink-0 flex-col overflow-hidden border-r border-white/[0.05] bg-[#080808]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-[14px] font-medium text-white">Messages</h2>
        <button className="rounded-md p-1.5 text-zinc-600 transition-colors duration-150 hover:bg-white/[0.04] hover:text-zinc-300">
          <PenSquare size={14} strokeWidth={1.5} />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pb-2">
        <div className="flex items-center gap-2 rounded-md border border-white/[0.05] bg-zinc-900/50 px-2.5 py-1.5 transition-colors focus-within:border-emerald-500/30">
          <Search size={13} className="shrink-0 text-zinc-600" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search messages…"
            className="flex-1 bg-transparent text-[12px] text-zinc-300 outline-none placeholder:text-zinc-700"
          />
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-1">
        {/* Triage / System inbox */}
        <div className="mb-2">
          <button
            onClick={handleTriageClick}
            className={`group relative flex w-full items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13px] transition-all duration-150 ${
              activeView === "triage"
                ? "bg-white/[0.04] text-zinc-100"
                : "text-zinc-500 hover:bg-white/[0.02] hover:text-zinc-300"
            }`}
          >
            {activeView === "triage" && (
              <motion.div
                layoutId="msg-sidebar-active"
                className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r bg-emerald-500"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <Inbox size={15} strokeWidth={1.5} className="shrink-0" />
            <span className="flex-1 text-left">Triage</span>
            {unreadInbox > 0 && (
              <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-emerald-500/10 px-1 text-[10px] font-medium text-emerald-500">
                {unreadInbox}
              </span>
            )}
          </button>
          <button
            className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13px] text-zinc-500 transition-colors duration-150 hover:bg-white/[0.02] hover:text-zinc-300"
          >
            <AtSign size={15} strokeWidth={1.5} />
            <span>Mentions</span>
          </button>
        </div>

        {/* Channels */}
        <div className="mb-2">
          <div className="mb-1 flex items-center justify-between px-2.5">
            <span className="text-[10px] font-medium tracking-widest text-zinc-600 uppercase">
              Channels
            </span>
            <button className="rounded p-0.5 text-zinc-700 transition-colors hover:text-zinc-400">
              <Plus size={12} />
            </button>
          </div>
          {groupChannels.map((ch) => (
            <button
              key={ch.id}
              onClick={() => handleChannelClick(ch)}
              className={`group relative flex w-full items-center gap-2 rounded-md px-2.5 py-[6px] text-[13px] transition-all duration-150 ${
                activeChannelId === ch.id
                  ? "bg-white/[0.04] text-zinc-100"
                  : "text-zinc-500 hover:bg-white/[0.02] hover:text-zinc-300"
              }`}
            >
              {activeChannelId === ch.id && activeView === "chat" && (
                <motion.div
                  layoutId="msg-sidebar-active"
                  className="absolute left-0 top-1 bottom-1 w-[2px] rounded-r bg-emerald-500"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <Hash size={14} strokeWidth={1.5} className="shrink-0 text-zinc-600" />
              <span className="truncate">{ch.name}</span>
            </button>
          ))}
        </div>

        {/* Job Threads */}
        {jobChannels.length > 0 && (
          <div className="mb-2">
            <div className="mb-1 px-2.5">
              <span className="text-[10px] font-medium tracking-widest text-zinc-600 uppercase">
                Job Threads
              </span>
            </div>
            {jobChannels.slice(0, 5).map((ch) => (
              <button
                key={ch.id}
                onClick={() => handleChannelClick(ch)}
                className={`group relative flex w-full items-center gap-2 rounded-md px-2.5 py-[6px] text-[13px] transition-all duration-150 ${
                  activeChannelId === ch.id
                    ? "bg-white/[0.04] text-zinc-100"
                    : "text-zinc-500 hover:bg-white/[0.02] hover:text-zinc-300"
                }`}
              >
                {activeChannelId === ch.id && activeView === "chat" && (
                  <motion.div
                    layoutId="msg-sidebar-active"
                    className="absolute left-0 top-1 bottom-1 w-[2px] rounded-r bg-emerald-500"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <Briefcase size={13} strokeWidth={1.5} className="shrink-0 text-zinc-600" />
                <span className="truncate">{ch.name || "Job Thread"}</span>
              </button>
            ))}
          </div>
        )}

        {/* Direct Messages */}
        <div>
          <div className="mb-1 flex items-center justify-between px-2.5">
            <span className="text-[10px] font-medium tracking-widest text-zinc-600 uppercase">
              Direct Messages
            </span>
            <button className="rounded p-0.5 text-zinc-700 transition-colors hover:text-zinc-400">
              <Plus size={12} />
            </button>
          </div>
          {dmChannels.length > 0
            ? dmChannels.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => handleChannelClick(ch)}
                  className={`group relative flex w-full items-center gap-2 rounded-md px-2.5 py-[6px] text-[13px] transition-all duration-150 ${
                    activeChannelId === ch.id
                      ? "bg-white/[0.04] text-zinc-100"
                      : "text-zinc-500 hover:bg-white/[0.02] hover:text-zinc-300"
                  }`}
                >
                  {activeChannelId === ch.id && activeView === "chat" && (
                    <motion.div
                      layoutId="msg-sidebar-active"
                      className="absolute left-0 top-1 bottom-1 w-[2px] rounded-r bg-emerald-500"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                  <div className="relative">
                    <div className="flex h-5 w-5 items-center justify-center rounded-md bg-zinc-800 text-[8px] font-medium text-zinc-500">
                      DM
                    </div>
                    {/* Online ring */}
                    <div className="absolute -right-0.5 -bottom-0.5 h-[6px] w-[6px] rounded-full border-[1.5px] border-[#080808] bg-emerald-500" />
                  </div>
                  <span className="truncate">{ch.name || "Direct Message"}</span>
                </button>
              ))
            : members.slice(0, 5).map((m) => (
                <button
                  key={m.id}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-[6px] text-[13px] text-zinc-500 transition-colors duration-150 hover:bg-white/[0.02] hover:text-zinc-300"
                >
                  <div className="relative">
                    <div className="flex h-5 w-5 items-center justify-center rounded-md bg-zinc-800 text-[8px] font-medium text-zinc-500">
                      {m.name?.split(" ").map((w) => w[0]).join("").slice(0, 2) || "??"}
                    </div>
                    <div className={`absolute -right-0.5 -bottom-0.5 h-[6px] w-[6px] rounded-full border-[1.5px] border-[#080808] ${
                      m.onlineStatus === "online" ? "bg-emerald-500" : "bg-zinc-700 ring-0"
                    }`} />
                  </div>
                  <span className="truncate">{m.name}</span>
                </button>
              ))}
        </div>
      </nav>
    </aside>
  );
}

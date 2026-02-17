"use client";

import { motion } from "framer-motion";
import {
  Inbox,
  AtSign,
  Hash,
  MessageSquare,
  Plus,
  Users,
  Briefcase,
  Search,
} from "lucide-react";
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
    <aside className="flex h-full w-[260px] shrink-0 flex-col overflow-y-auto border-r border-[rgba(255,255,255,0.08)] bg-[#050505]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] px-4 py-3">
        <h2 className="text-[14px] font-semibold text-zinc-200">Messages</h2>
        <button className="rounded-md p-1 text-zinc-600 transition-colors hover:bg-[rgba(255,255,255,0.06)] hover:text-zinc-300">
          <Search size={14} />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-2">
        {/* Triage / System inbox */}
        <div className="mb-3">
          <button
            onClick={handleTriageClick}
            className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-[6px] text-[13px] transition-colors ${
              activeView === "triage"
                ? "bg-[rgba(0,230,118,0.06)] text-[#00E676]"
                : "text-zinc-400 hover:bg-[rgba(255,255,255,0.04)] hover:text-zinc-200"
            }`}
          >
            <Inbox size={15} strokeWidth={1.5} />
            <span className="flex-1 text-left">Triage</span>
            {unreadInbox > 0 && (
              <span className="rounded-full bg-[rgba(0,230,118,0.15)] px-1.5 py-0.5 text-[10px] font-medium text-[#00E676]">
                {unreadInbox}
              </span>
            )}
          </button>
          <button
            className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-[6px] text-[13px] text-zinc-500 transition-colors hover:bg-[rgba(255,255,255,0.04)] hover:text-zinc-300"
          >
            <AtSign size={15} strokeWidth={1.5} />
            <span>Mentions</span>
          </button>
        </div>

        {/* Channels */}
        <div className="mb-3">
          <div className="mb-1 flex items-center justify-between px-2">
            <span className="text-[10px] font-medium tracking-widest text-zinc-600 uppercase">
              Channels
            </span>
            <button className="rounded p-0.5 text-zinc-600 transition-colors hover:text-zinc-400">
              <Plus size={12} />
            </button>
          </div>
          {groupChannels.map((ch) => (
            <button
              key={ch.id}
              onClick={() => handleChannelClick(ch)}
              className={`flex w-full items-center gap-2 rounded-md px-2.5 py-[5px] text-[13px] transition-colors ${
                activeChannelId === ch.id
                  ? "bg-[rgba(255,255,255,0.06)] text-zinc-100"
                  : "text-zinc-500 hover:bg-[rgba(255,255,255,0.03)] hover:text-zinc-300"
              }`}
            >
              <Hash size={14} strokeWidth={1.5} className="shrink-0 text-zinc-600" />
              <span className="truncate">{ch.name}</span>
            </button>
          ))}
        </div>

        {/* Job Threads */}
        {jobChannels.length > 0 && (
          <div className="mb-3">
            <div className="mb-1 px-2">
              <span className="text-[10px] font-medium tracking-widest text-zinc-600 uppercase">
                Job Threads
              </span>
            </div>
            {jobChannels.slice(0, 5).map((ch) => (
              <button
                key={ch.id}
                onClick={() => handleChannelClick(ch)}
                className={`flex w-full items-center gap-2 rounded-md px-2.5 py-[5px] text-[13px] transition-colors ${
                  activeChannelId === ch.id
                    ? "bg-[rgba(255,255,255,0.06)] text-zinc-100"
                    : "text-zinc-500 hover:bg-[rgba(255,255,255,0.03)] hover:text-zinc-300"
                }`}
              >
                <Briefcase size={13} strokeWidth={1.5} className="shrink-0 text-zinc-600" />
                <span className="truncate">{ch.name || "Job Thread"}</span>
              </button>
            ))}
          </div>
        )}

        {/* Direct Messages */}
        <div>
          <div className="mb-1 flex items-center justify-between px-2">
            <span className="text-[10px] font-medium tracking-widest text-zinc-600 uppercase">
              Direct Messages
            </span>
            <button className="rounded p-0.5 text-zinc-600 transition-colors hover:text-zinc-400">
              <Plus size={12} />
            </button>
          </div>
          {dmChannels.length > 0
            ? dmChannels.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => handleChannelClick(ch)}
                  className={`flex w-full items-center gap-2 rounded-md px-2.5 py-[5px] text-[13px] transition-colors ${
                    activeChannelId === ch.id
                      ? "bg-[rgba(255,255,255,0.06)] text-zinc-100"
                      : "text-zinc-500 hover:bg-[rgba(255,255,255,0.03)] hover:text-zinc-300"
                  }`}
                >
                  <div className="relative">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-800 text-[8px] font-medium text-zinc-400">
                      DM
                    </div>
                    <div className="absolute -right-0.5 -bottom-0.5 h-2 w-2 rounded-full border border-[#050505] bg-[#00E676]" />
                  </div>
                  <span className="truncate">{ch.name || "Direct Message"}</span>
                </button>
              ))
            : members.slice(0, 5).map((m) => (
                <button
                  key={m.id}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-[5px] text-[13px] text-zinc-500 transition-colors hover:bg-[rgba(255,255,255,0.03)] hover:text-zinc-300"
                >
                  <div className="relative">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-800 text-[8px] font-medium text-zinc-400">
                      {m.name?.split(" ").map((w) => w[0]).join("").slice(0, 2) || "??"}
                    </div>
                    <div className={`absolute -right-0.5 -bottom-0.5 h-2 w-2 rounded-full border border-[#050505] ${
                      m.onlineStatus === "online" ? "bg-[#00E676]" : "bg-zinc-600"
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

"use client";

import { motion } from "framer-motion";
import {
  Search,
  UserPlus,
  Users,
  Clock,
  ChevronDown,
  MoreVertical,
  Shield,
  Send,
  Ban,
  UserMinus,
  Droplets,
  Zap,
  Flame,
  Wind,
  Waves,
  Home,
  Wrench,
  Hammer,
  Star,
  CheckCircle,
  Filter,
} from "lucide-react";
import { useMemo, useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useTeamStore } from "@/lib/team-store";
import {
  getRoleLabel,
  getRoleColor,
  branches,
  skillDefinitions,
  roleDefinitions,
  type RoleId,
} from "@/lib/team-data";
import { MemberDrawer } from "@/components/team/member-drawer";
import { InviteModal } from "@/components/team/invite-modal";
import { useToastStore } from "@/components/app/action-toast";

/* ── Skill icon map ───────────────────────────────────── */

const skillIconMap: Record<string, typeof Wrench> = {
  Droplets,
  Zap,
  Flame,
  Wind,
  Waves,
  Home,
  Wrench,
  Hammer,
};

/* ── Role pill colors ─────────────────────────────────── */

const roleColorMap: Record<string, string> = {
  red: "bg-red-500/15 text-red-400 border-red-500/20",
  purple: "bg-purple-500/15 text-purple-400 border-purple-500/20",
  blue: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  cyan: "bg-cyan-500/15 text-cyan-400 border-cyan-500/20",
  emerald: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  orange: "bg-orange-500/15 text-orange-400 border-orange-500/20",
  pink: "bg-pink-500/15 text-pink-400 border-pink-500/20",
  zinc: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20",
};

/* ── Online status ────────────────────────────────────── */

const onlineConfig = {
  online: { color: "bg-emerald-500", ring: "ring-emerald-500/30", label: "Online" },
  idle: { color: "bg-amber-500", ring: "ring-amber-500/30", label: "Idle" },
  offline: { color: "bg-zinc-600", ring: "ring-zinc-600/30", label: "Offline" },
};

export default function TeamPage() {
  const {
    members,
    searchQuery,
    filterBranch,
    filterRole,
    filterSkill,
    setSearchQuery,
    setFilterBranch,
    setFilterRole,
    setFilterSkill,
    setSelectedMemberId,
    setInviteModalOpen,
    suspendMember,
    archiveMember,
    resendInvite,
  } = useTeamStore();
  const { addToast } = useToastStore();
  const [contextMenuId, setContextMenuId] = useState<string | null>(null);
  const contextRef = useRef<HTMLDivElement>(null);

  // Close context on outside click
  useEffect(() => {
    if (!contextMenuId) return;
    const handler = (e: MouseEvent) => {
      if (contextRef.current && !contextRef.current.contains(e.target as Node)) {
        setContextMenuId(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [contextMenuId]);

  /* ── Stats ──────────────────────────────────────────── */
  const activeCount = useMemo(
    () => members.filter((m) => m.status === "active").length,
    [members]
  );
  const pendingCount = useMemo(
    () => members.filter((m) => m.status === "pending").length,
    [members]
  );

  /* ── Filtering ──────────────────────────────────────── */
  const filteredMembers = useMemo(() => {
    let items = members.filter((m) => m.status !== "archived");

    if (filterBranch !== "all") {
      items = items.filter((m) => m.branch === filterBranch);
    }
    if (filterRole !== "all") {
      items = items.filter((m) => m.role === filterRole);
    }
    if (filterSkill !== "all") {
      items = items.filter((m) => m.skills.includes(filterSkill));
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q) ||
          getRoleLabel(m.role).toLowerCase().includes(q)
      );
    }

    // Sort: active first, then pending, then by name
    return items.sort((a, b) => {
      if (a.status === "active" && b.status !== "active") return -1;
      if (a.status !== "active" && b.status === "active") return 1;
      return a.name.localeCompare(b.name);
    });
  }, [members, filterBranch, filterRole, filterSkill, searchQuery]);

  return (
    <div className="flex h-full flex-col">
      {/* ── Header ───────────────────────────────────── */}
      <div className="border-b border-[rgba(255,255,255,0.06)] px-4 pb-4 pt-4 md:px-6 md:pt-5">
        {/* Title row */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-[15px] font-medium text-zinc-200">Members</h1>
            <p className="mt-0.5 text-[12px] text-zinc-600">
              Manage your team, roles, and access control.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Stats */}
            <div className="flex items-center gap-4 pr-3">
              <div className="flex items-center gap-1.5">
                <Users size={12} className="text-zinc-500" />
                <span className="text-[11px] text-zinc-500">
                  <span className="font-medium text-zinc-300">{activeCount}</span> Active Seats
                </span>
              </div>
              {pendingCount > 0 && (
                <div className="flex items-center gap-1.5">
                  <Clock size={12} className="text-amber-500" />
                  <span className="text-[11px] text-zinc-500">
                    <span className="font-medium text-amber-400">{pendingCount}</span> Invites Pending
                  </span>
                </div>
              )}
            </div>

            {/* Search */}
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-600" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Find member by name, email, or role..."
                className="h-8 w-64 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] pl-8 pr-3 text-[12px] text-zinc-300 placeholder-zinc-600 outline-none transition-colors focus:border-[rgba(255,255,255,0.2)]"
              />
            </div>

            {/* Roles & Permissions link */}
            <Link
              href="/dashboard/team/roles"
              className="flex h-8 items-center gap-1.5 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-3 text-[12px] text-zinc-400 transition-all hover:border-[rgba(255,255,255,0.15)] hover:text-zinc-200"
            >
              <Shield size={13} strokeWidth={1.5} />
              Roles
            </Link>

            {/* Invite */}
            <button
              onClick={() => setInviteModalOpen(true)}
              className="flex h-8 items-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 px-4 text-[12px] font-semibold text-white shadow-[0_0_20px_-4px_rgba(59,130,246,0.3)] transition-all hover:shadow-[0_0_30px_-4px_rgba(59,130,246,0.4)]"
            >
              <UserPlus size={13} strokeWidth={2} />
              Invite People
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          <Filter size={12} className="text-zinc-600" />
          <span className="text-[10px] uppercase tracking-wider text-zinc-700">Filters</span>
          <div className="ml-1 h-3 w-px bg-[rgba(255,255,255,0.06)]" />

          {/* Branch filter */}
          <select
            value={filterBranch}
            onChange={(e) => setFilterBranch(e.target.value)}
            className="h-7 rounded-md border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-2 text-[11px] text-zinc-400 outline-none"
          >
            <option value="all">All Branches</option>
            {branches.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>

          {/* Role filter */}
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="h-7 rounded-md border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-2 text-[11px] text-zinc-400 outline-none"
          >
            <option value="all">All Roles</option>
            {roleDefinitions.map((r) => (
              <option key={r.id} value={r.id}>{r.label}</option>
            ))}
          </select>

          {/* Skill filter */}
          <select
            value={filterSkill}
            onChange={(e) => setFilterSkill(e.target.value)}
            className="h-7 rounded-md border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-2 text-[11px] text-zinc-400 outline-none"
          >
            <option value="all">All Skills</option>
            {skillDefinitions.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Data Grid ────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto overflow-x-auto">
        <div className="min-w-[700px]">
        {/* Table header */}
        <div className="sticky top-0 z-10 grid grid-cols-12 gap-3 border-b border-[rgba(255,255,255,0.06)] bg-black/80 px-4 py-2.5 text-[10px] font-medium uppercase tracking-wider text-zinc-700 backdrop-blur-sm md:px-6">
          <span className="col-span-4">Member</span>
          <span className="col-span-2">Role</span>
          <span className="col-span-1">Branch</span>
          <span className="col-span-2">Skills</span>
          <span className="col-span-2">Last Active</span>
          <span className="col-span-1"></span>
        </div>

        {/* Rows */}
        {filteredMembers.map((member, i) => {
          const roleColor = getRoleColor(member.role);
          const rolePillClass = roleColorMap[roleColor] || roleColorMap.zinc;
          const online = onlineConfig[member.onlineStatus];
          const isPending = member.status === "pending";
          const isSuspended = member.status === "suspended";

          return (
            <motion.div
              key={member.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02, duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              onClick={() => setSelectedMemberId(member.id)}
              className={`group grid cursor-pointer grid-cols-12 items-center gap-3 border-b border-[rgba(255,255,255,0.03)] px-6 transition-all duration-150 hover:bg-[rgba(255,255,255,0.02)] ${
                isPending ? "opacity-60" : ""
              } ${isSuspended ? "opacity-40" : ""}`}
              style={{ height: 48 }}
            >
              {/* Name + Avatar + Email */}
              <div className="col-span-4 flex items-center gap-3">
                <div className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-zinc-700 to-zinc-800 text-[9px] font-bold text-zinc-400">
                  {member.initials}
                  <div className={`absolute -bottom-px -right-px h-[9px] w-[9px] rounded-full border-[1.5px] border-black ${online.color}`} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-[12px] font-medium text-zinc-200">{member.name}</p>
                    {isPending && (
                      <span className="shrink-0 rounded bg-amber-500/10 px-1.5 py-0.5 text-[8px] font-semibold uppercase text-amber-400">
                        Pending
                      </span>
                    )}
                    {isSuspended && (
                      <span className="shrink-0 rounded bg-red-500/10 px-1.5 py-0.5 text-[8px] font-semibold uppercase text-red-400">
                        Suspended
                      </span>
                    )}
                  </div>
                  <p className="truncate text-[10px] text-zinc-600">{member.email}</p>
                </div>
              </div>

              {/* Role pill */}
              <div className="col-span-2">
                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${rolePillClass}`}>
                  {getRoleLabel(member.role)}
                </span>
              </div>

              {/* Branch */}
              <div className="col-span-1">
                <p className="text-[11px] text-zinc-500">{member.branch.replace(" HQ", "")}</p>
              </div>

              {/* Skills */}
              <div className="col-span-2 flex items-center gap-1">
                {member.skills.slice(0, 4).map((skillId) => {
                  const skill = skillDefinitions.find((s) => s.id === skillId);
                  if (!skill) return null;
                  const Icon = skillIconMap[skill.icon] || Wrench;
                  return (
                    <div
                      key={skillId}
                      className="flex h-5 w-5 items-center justify-center rounded bg-[rgba(255,255,255,0.04)] text-zinc-600"
                      title={skill.label}
                    >
                      <Icon size={10} strokeWidth={1.5} />
                    </div>
                  );
                })}
                {member.skills.length === 0 && (
                  <span className="text-[9px] text-zinc-700">—</span>
                )}
              </div>

              {/* Last Active */}
              <div className="col-span-2">
                <p className="text-[11px] text-zinc-500">{member.lastActive}</p>
              </div>

              {/* Context Menu */}
              <div className="col-span-1 flex justify-end" ref={contextMenuId === member.id ? contextRef : undefined}>
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setContextMenuId(contextMenuId === member.id ? null : member.id);
                    }}
                    className="flex h-6 w-6 items-center justify-center rounded text-zinc-700 opacity-0 transition-all hover:bg-[rgba(255,255,255,0.06)] hover:text-zinc-400 group-hover:opacity-100"
                  >
                    <MoreVertical size={12} />
                  </button>

                  {contextMenuId === member.id && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -4 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      className="absolute right-0 top-8 z-30 w-44 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#161616] py-1 shadow-xl"
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setContextMenuId(null);
                          setSelectedMemberId(member.id);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] text-zinc-400 transition-colors hover:bg-[rgba(255,255,255,0.04)] hover:text-zinc-200"
                      >
                        <Users size={11} /> View Profile
                      </button>
                      {isPending && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            resendInvite(member.id);
                            addToast(`Invite resent to ${member.email}`);
                            setContextMenuId(null);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] text-zinc-400 transition-colors hover:bg-[rgba(255,255,255,0.04)] hover:text-zinc-200"
                        >
                          <Send size={11} /> Resend Invite
                        </button>
                      )}
                      {member.status === "active" && member.role !== "owner" && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            suspendMember(member.id);
                            addToast(`${member.name} suspended`);
                            setContextMenuId(null);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] text-amber-400 transition-colors hover:bg-amber-500/10"
                        >
                          <Ban size={11} /> Suspend
                        </button>
                      )}
                      {member.role !== "owner" && (
                        <>
                          <div className="my-1 h-px bg-[rgba(255,255,255,0.06)]" />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              archiveMember(member.id);
                              addToast(`${member.name} removed`);
                              setContextMenuId(null);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] text-red-400 transition-colors hover:bg-red-500/10"
                          >
                            <UserMinus size={11} /> Remove
                          </button>
                        </>
                      )}
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}

        {filteredMembers.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Users size={24} strokeWidth={0.8} className="mb-2 text-zinc-800" />
            <p className="text-[12px] text-zinc-600">No members found.</p>
            <p className="mt-0.5 text-[10px] text-zinc-700">Try adjusting your search or filters.</p>
          </div>
        )}
        </div>{/* close min-w wrapper */}
      </div>

      {/* ── Overlays ─────────────────────────────────── */}
      <MemberDrawer />
      <InviteModal />
    </div>
  );
}

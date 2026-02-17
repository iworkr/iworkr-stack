"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  UserPlus,
  Users,
  Clock,
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
  Filter,
  Play,
  Eye,
  X,
  ArrowRight,
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
  Droplets, Zap, Flame, Wind, Waves, Home, Wrench, Hammer,
};

/* ── Role badge: Stealth style ────────────────────────── */

const roleBadgeStyles: Record<string, string> = {
  owner: "text-rose-400",
  admin: "text-emerald-400",
  tech: "text-zinc-500",
};

function getRoleBadgeText(roleColor: string): string {
  return roleBadgeStyles[roleColor] || roleBadgeStyles.tech;
}

/* ── Online Status ────────────────────────────────────── */

const onlineConfig = {
  online: { dot: "bg-emerald-500", pulse: true, label: "Online" },
  idle: { dot: "bg-amber-500", pulse: false, label: "Idle" },
  offline: { dot: "border-2 border-zinc-700 bg-transparent", pulse: false, label: "Offline" },
};

/* ── Empty State ──────────────────────────────────────── */

function RosterEmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col items-center justify-center py-20 text-center"
    >
      <div className="relative mb-5 flex h-16 w-16 items-center justify-center">
        <div className="absolute inset-0 rounded-xl border border-white/[0.04] animate-signal-pulse" />
        <div className="absolute inset-2 rounded-lg border border-white/[0.03] animate-signal-pulse" style={{ animationDelay: "0.5s" }} />
        <motion.div
          className="absolute inset-x-2 h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent"
          animate={{ top: ["25%", "75%", "25%"] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="absolute inset-0 animate-orbit" style={{ animationDuration: "6s" }}>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 flex h-2 w-2 items-center justify-center rounded-full bg-emerald-500/30">
            <div className="h-1 w-1 rounded-full bg-emerald-500" />
          </div>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.02]">
          <Users size={16} strokeWidth={1.5} className="text-zinc-600" />
        </div>
      </div>
      <h3 className="text-[14px] font-medium text-zinc-300">No members found</h3>
      <p className="mt-1 max-w-[260px] text-[12px] text-zinc-600">Try adjusting your search or filters.</p>
    </motion.div>
  );
}

/* ── Page ─────────────────────────────────────────────── */

export default function TeamPage() {
  const {
    members,
    searchQuery,
    filterBranch,
    filterRole,
    filterSkill,
    loading,
    setSearchQuery,
    setFilterBranch,
    setFilterRole,
    setFilterSkill,
    setSelectedMemberId,
    setInviteModalOpen,
    suspendMemberServer,
    reactivateMemberServer,
    removeMemberServer,
    resendInvite,
  } = useTeamStore();
  const { addToast } = useToastStore();
  const [contextMenuId, setContextMenuId] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const contextRef = useRef<HTMLDivElement>(null);

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
  const activeCount = useMemo(() => members.filter((m) => m.status === "active").length, [members]);
  const pendingCount = useMemo(() => members.filter((m) => m.status === "pending").length, [members]);

  const hasActiveFilters = filterBranch !== "all" || filterRole !== "all" || filterSkill !== "all";

  /* ── Filtering ──────────────────────────────────────── */
  const filteredMembers = useMemo(() => {
    let items = members.filter((m) => m.status !== "archived");

    if (filterBranch !== "all") items = items.filter((m) => m.branch === filterBranch);
    if (filterRole !== "all") items = items.filter((m) => m.role === filterRole);
    if (filterSkill !== "all") items = items.filter((m) => m.skills.includes(filterSkill));
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q) ||
          getRoleLabel(m.role).toLowerCase().includes(q)
      );
    }

    return items.sort((a, b) => {
      if (a.status === "active" && b.status !== "active") return -1;
      if (a.status !== "active" && b.status === "active") return 1;
      return a.name.localeCompare(b.name);
    });
  }, [members, filterBranch, filterRole, filterSkill, searchQuery]);

  return (
    <div className="flex h-full flex-col bg-[#050505]">
      {/* ── Header ───────────────────────────────────── */}
      <div className="border-b border-white/[0.05]">
        <div className="flex h-14 shrink-0 items-center justify-between px-5">
          <div className="flex items-center gap-3">
            <h1 className="text-[15px] font-medium text-white">Command Roster</h1>
            <span className="rounded-full bg-white/[0.03] px-2 py-0.5 text-[11px] text-zinc-500">
              {activeCount} active
            </span>
            {pendingCount > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-400">
                <Clock size={9} />
                {pendingCount} pending
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Search toggle */}
            <AnimatePresence>
              {showSearch && (
                <motion.div
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 220, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="flex items-center gap-1.5 rounded-md border border-white/[0.06] bg-zinc-900/50 px-2 py-1">
                    <Search size={12} className="shrink-0 text-zinc-600" />
                    <input
                      autoFocus
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onBlur={() => { if (!searchQuery) setShowSearch(false); }}
                      onKeyDown={(e) => { if (e.key === "Escape") { setSearchQuery(""); setShowSearch(false); } }}
                      placeholder="Search roster…"
                      className="w-full bg-transparent text-[12px] text-zinc-300 outline-none placeholder:text-zinc-600"
                    />
                    {searchQuery && (
                      <button onClick={() => setSearchQuery("")} className="text-zinc-600 hover:text-zinc-400">
                        <X size={10} />
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            {!showSearch && (
              <button
                onClick={() => setShowSearch(true)}
                className="rounded-md p-1.5 text-zinc-600 transition-colors duration-150 hover:bg-white/[0.04] hover:text-zinc-400"
              >
                <Search size={14} />
              </button>
            )}

            {/* Filter toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-[11px] transition-all duration-150 ${
                hasActiveFilters
                  ? "border-emerald-500/20 bg-emerald-500/[0.04] text-emerald-400"
                  : "border-white/[0.06] bg-zinc-900/50 text-zinc-500 hover:text-zinc-400"
              }`}
            >
              <Filter size={12} />
              Filters
            </button>

            {/* Roles link */}
            <Link
              href="/dashboard/team/roles"
              className="flex h-7 items-center gap-1.5 rounded-md border border-white/[0.06] bg-zinc-900/50 px-2.5 text-[11px] text-zinc-500 transition-all duration-150 hover:text-zinc-300"
            >
              <Shield size={12} strokeWidth={1.5} />
              Roles
            </Link>

            {/* Invite — Ghost button */}
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => setInviteModalOpen(true)}
              className="flex h-7 items-center gap-1.5 rounded-md border border-white/[0.08] bg-zinc-900 px-3 text-[11px] font-medium text-white transition-all duration-150 hover:border-emerald-500/30 hover:text-emerald-400"
            >
              <UserPlus size={13} strokeWidth={2} />
              Invite
            </motion.button>
          </div>
        </div>

        {/* Filters row (collapsible) */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden border-t border-white/[0.03]"
            >
              <div className="flex items-center gap-2 px-5 py-2">
                <span className="text-[9px] font-medium uppercase tracking-wider text-zinc-700">Filter by</span>
                <div className="ml-1 h-3 w-px bg-white/[0.04]" />
                <select
                  value={filterBranch}
                  onChange={(e) => setFilterBranch(e.target.value)}
                  className="h-6 rounded border border-white/[0.06] bg-transparent px-2 text-[10px] text-zinc-400 outline-none"
                >
                  <option value="all">All Branches</option>
                  {branches.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
                <select
                  value={filterRole}
                  onChange={(e) => setFilterRole(e.target.value)}
                  className="h-6 rounded border border-white/[0.06] bg-transparent px-2 text-[10px] text-zinc-400 outline-none"
                >
                  <option value="all">All Roles</option>
                  {roleDefinitions.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                </select>
                <select
                  value={filterSkill}
                  onChange={(e) => setFilterSkill(e.target.value)}
                  className="h-6 rounded border border-white/[0.06] bg-transparent px-2 text-[10px] text-zinc-400 outline-none"
                >
                  <option value="all">All Skills</option>
                  {skillDefinitions.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
                {hasActiveFilters && (
                  <button
                    onClick={() => { setFilterBranch("all"); setFilterRole("all"); setFilterSkill("all"); }}
                    className="ml-1 text-[10px] text-zinc-600 hover:text-zinc-400"
                  >
                    Clear all
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Command List ─────────────────────────────── */}
      <div className="flex-1 overflow-y-auto overflow-x-auto">
        <div className="min-w-[700px]">
          {/* Table header */}
          <div className="sticky top-0 z-10 flex items-center border-b border-white/[0.04] bg-[#0A0A0A] px-5 py-1.5">
            <div className="w-8" />
            <div className="min-w-0 flex-1 px-2 text-[10px] font-medium tracking-wider text-zinc-600 uppercase">Member</div>
            <div className="w-24 px-2 text-[10px] font-medium tracking-wider text-zinc-600 uppercase">Role</div>
            <div className="w-24 px-2 text-[10px] font-medium tracking-wider text-zinc-600 uppercase">Branch</div>
            <div className="w-28 px-2 text-[10px] font-medium tracking-wider text-zinc-600 uppercase">Skills</div>
            <div className="w-28 px-2 text-[10px] font-medium tracking-wider text-zinc-600 uppercase">Last Active</div>
            <div className="w-8" />
          </div>

          {/* Rows */}
          {filteredMembers.length === 0 ? (
            <RosterEmptyState />
          ) : (
            filteredMembers.map((member, i) => {
              const roleColor = getRoleColor(member.role);
              const roleTextClass = getRoleBadgeText(roleColor);
              const online = onlineConfig[member.onlineStatus];
              const isPending = member.status === "pending";
              const isSuspended = member.status === "suspended";

              return (
                <motion.div
                  key={member.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.02, 0.3), duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  onClick={() => setSelectedMemberId(member.id)}
                  className={`group flex cursor-pointer items-center border-b border-white/[0.03] px-5 transition-colors duration-100 hover:bg-white/[0.02] ${
                    isPending ? "opacity-60" : ""
                  } ${isSuspended ? "opacity-40" : ""}`}
                  style={{ height: 40 }}
                >
                  {/* Online status dot */}
                  <div className="w-8 flex items-center justify-center">
                    {online.pulse ? (
                      <span className="relative flex h-[6px] w-[6px]">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-40" />
                        <span className="relative inline-flex h-[6px] w-[6px] rounded-full bg-emerald-500" />
                      </span>
                    ) : member.onlineStatus === "idle" ? (
                      <span className="inline-flex h-[6px] w-[6px] rounded-full bg-amber-500" />
                    ) : (
                      <span className="inline-flex h-[6px] w-[6px] rounded-full border border-zinc-700" />
                    )}
                  </div>

                  {/* Name + Avatar */}
                  <div className="min-w-0 flex-1 px-2 flex items-center gap-2.5">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-[8px] font-semibold text-zinc-400">
                      {member.initials}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-[12px] font-medium text-white transition-colors">{member.name}</p>
                        {isPending && (
                          <span className="shrink-0 rounded border border-dashed border-amber-500/30 px-1 py-0.5 text-[7px] font-semibold uppercase text-amber-400">
                            Invited
                          </span>
                        )}
                        {isSuspended && (
                          <span className="shrink-0 rounded border border-rose-500/20 px-1 py-0.5 text-[7px] font-semibold uppercase text-rose-400">
                            Suspended
                          </span>
                        )}
                      </div>
                      <p className="truncate text-[10px] text-zinc-600">{member.email}</p>
                    </div>
                  </div>

                  {/* Role — plain monospace text, no pill */}
                  <div className="w-24 px-2">
                    <span className={`font-mono text-[10px] font-medium uppercase tracking-wider ${roleTextClass}`}>
                      {getRoleLabel(member.role)}
                    </span>
                  </div>

                  {/* Branch */}
                  <div className="w-24 px-2">
                    <span className="text-[10px] text-zinc-600">{member.branch.replace(" HQ", "")}</span>
                  </div>

                  {/* Skills */}
                  <div className="w-28 px-2 flex items-center gap-1">
                    {member.skills.slice(0, 4).map((skillId) => {
                      const skill = skillDefinitions.find((s) => s.id === skillId);
                      if (!skill) return null;
                      const Icon = skillIconMap[skill.icon] || Wrench;
                      return (
                        <div
                          key={skillId}
                          className="flex h-4 w-4 items-center justify-center rounded bg-white/[0.03] text-zinc-600"
                          title={skill.label}
                        >
                          <Icon size={9} strokeWidth={1.5} />
                        </div>
                      );
                    })}
                    {member.skills.length === 0 && <span className="text-[9px] text-zinc-700">—</span>}
                  </div>

                  {/* Last Active */}
                  <div className="w-28 px-2">
                    <span className="font-mono text-[10px] text-zinc-600">{member.lastActive}</span>
                  </div>

                  {/* Context Menu */}
                  <div className="w-8 flex justify-end" ref={contextMenuId === member.id ? contextRef : undefined}>
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setContextMenuId(contextMenuId === member.id ? null : member.id);
                        }}
                        className="flex h-5 w-5 items-center justify-center rounded text-zinc-700 opacity-0 transition-all hover:bg-white/[0.04] hover:text-zinc-400 group-hover:opacity-100"
                      >
                        <MoreVertical size={11} />
                      </button>

                      <AnimatePresence>
                        {contextMenuId === member.id && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: -4 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -4 }}
                            className="absolute right-0 top-7 z-30 w-44 rounded-lg border border-white/[0.06] bg-[#0C0C0C] py-1 shadow-xl"
                          >
                            <button
                              onClick={(e) => { e.stopPropagation(); setContextMenuId(null); setSelectedMemberId(member.id); }}
                              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] text-zinc-400 transition-colors hover:bg-white/[0.03] hover:text-zinc-200"
                            >
                              <Eye size={11} /> View Profile
                            </button>
                            {isPending && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  resendInvite(member.id);
                                  addToast(`Invite resent to ${member.email}`);
                                  setContextMenuId(null);
                                }}
                                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] text-zinc-400 transition-colors hover:bg-white/[0.03] hover:text-zinc-200"
                              >
                                <Send size={11} /> Resend Invite
                              </button>
                            )}
                            {member.status === "active" && member.role !== "owner" && (
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  setContextMenuId(null);
                                  const { error } = await suspendMemberServer(member.id);
                                  if (error) addToast(`Failed: ${error}`);
                                  else addToast(`${member.name} suspended`);
                                }}
                                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] text-amber-400 transition-colors hover:bg-amber-500/10"
                              >
                                <Ban size={11} /> Suspend Access
                              </button>
                            )}
                            {member.status === "suspended" && (
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  setContextMenuId(null);
                                  const { error } = await reactivateMemberServer(member.id);
                                  if (error) addToast(`Failed: ${error}`);
                                  else addToast(`${member.name} reactivated`);
                                }}
                                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] text-emerald-400 transition-colors hover:bg-emerald-500/10"
                              >
                                <Play size={11} /> Reactivate
                              </button>
                            )}
                            {member.role !== "owner" && (
                              <>
                                <div className="my-1 h-px bg-white/[0.04]" />
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    setContextMenuId(null);
                                    const { error } = await removeMemberServer(member.id);
                                    if (error) addToast(`Failed: ${error}`);
                                    else addToast(`${member.name} removed`);
                                  }}
                                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] text-rose-400 transition-colors hover:bg-rose-500/10"
                                >
                                  <UserMinus size={11} /> Remove from Team
                                </button>
                              </>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Overlays ─────────────────────────────────── */}
      <MemberDrawer />
      <InviteModal />
    </div>
  );
}

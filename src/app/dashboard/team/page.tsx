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
  ArrowRight,
  Grid3X3,
  List,
  Briefcase,
  Star,
  ChevronRight as ChevronRightIcon,
  MessageSquare,
  Pencil,
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
import { useBillingStore } from "@/lib/billing-store";
import { getPlanByKey } from "@/lib/plans";

/* ── Skill icon map ─────────────────────────────────────── */

const skillIconMap: Record<string, typeof Wrench> = {
  Droplets, Zap, Flame, Wind, Waves, Home, Wrench, Hammer,
};

/* ── Muted Glass Role Badges (PRD 57.0) ─────────────────── */

const roleBadgeConfig: Record<string, { text: string; bg: string; border: string }> = {
  owner: { text: "text-amber-400/90", bg: "bg-amber-500/10", border: "border-amber-500/20" },
  manager: { text: "text-blue-400/90", bg: "bg-blue-500/10", border: "border-blue-500/20" },
  office_admin: { text: "text-purple-400/90", bg: "bg-purple-500/10", border: "border-purple-500/20" },
  senior_tech: { text: "text-zinc-300", bg: "bg-zinc-500/10", border: "border-white/10" },
  technician: { text: "text-zinc-300", bg: "bg-zinc-500/10", border: "border-white/10" },
  apprentice: { text: "text-zinc-300", bg: "bg-zinc-500/10", border: "border-white/10" },
  subcontractor: { text: "text-zinc-300", bg: "bg-zinc-500/10", border: "border-white/10" },
};

function getRoleBadge(roleId: string) {
  return roleBadgeConfig[roleId] || roleBadgeConfig.technician;
}

/* ── Online Status Config ───────────────────────────────── */

const onlineConfig = {
  online: { dot: "bg-emerald-500", pulse: true, label: "Online" },
  idle: { dot: "bg-amber-500", pulse: false, label: "Idle" },
  offline: { dot: "border-2 border-zinc-700 bg-transparent", pulse: false, label: "Offline" },
};

/* ── Empty State ────────────────────────────────────────── */

function RosterEmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="relative flex flex-col items-center justify-center py-20 text-center"
    >
      <div className="pointer-events-none absolute top-1/2 left-1/2 h-[180px] w-[180px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/[0.03] blur-[60px]" />
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="relative mb-5"
      >
        <div className="relative flex h-16 w-16 items-center justify-center">
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
      </motion.div>
      <h3 className="text-[14px] font-medium text-zinc-300">No members found</h3>
      <p className="mt-1 max-w-[260px] text-[12px] text-zinc-600">Try adjusting your search or filters.</p>
    </motion.div>
  );
}

/* ── Page ───────────────────────────────────────────────── */

export default function TeamPage() {
  const {
    members,
    searchQuery,
    filterBranch,
    filterRole,
    filterSkill,
    loading,
    selectedMemberId,
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
  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
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

  /* ── Keyboard ──────────────────────────────────────────── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  /* ── Stats ─────────────────────────────────────────────── */
  const activeCount = useMemo(() => members.filter((m) => m.status === "active").length, [members]);
  const pendingCount = useMemo(() => members.filter((m) => m.status === "pending").length, [members]);
  const onlineCount = useMemo(() => members.filter((m) => m.onlineStatus === "online").length, [members]);
  const onJobCount = useMemo(() => members.filter((m) => m.onlineStatus === "online" && m.recentActivity.some((a) => a.type === "check_in")).length, [members]);

  const hasActiveFilters = filterBranch !== "all" || filterRole !== "all" || filterSkill !== "all";

  /* ── Filtering ─────────────────────────────────────────── */
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

  const drawerOpen = !!selectedMemberId;

  return (
    <div className="flex h-full flex-col bg-[#050505]">
      <motion.div
        className="flex min-h-0 flex-1 flex-col"
        style={{ transformOrigin: "center left" }}
        animate={{ scale: drawerOpen ? 0.98 : 1 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        {/* ── Header ───────────────────────────────────────── */}
        <div className="sticky top-0 z-20 border-b border-white/[0.04] bg-zinc-950/80 backdrop-blur-xl">
        <div className="flex items-center justify-between px-5 py-2.5">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-[12px]">
              <span className="text-zinc-600">Dashboard</span>
              <ChevronRightIcon size={10} className="text-zinc-700" />
              <span className="font-medium text-white">Team</span>
            </div>

            {/* Command bar stats — PRD 57.0 (JetBrains Mono, neutral pills) */}
            <div className="flex items-center gap-3 ml-2">
              <div className="flex items-center gap-1.5 rounded-md border border-white/5 bg-white/5 px-2.5 py-1">
                <Users size={10} className="text-zinc-500" />
                <span className="font-mono text-[11px] text-zinc-400">{activeCount}</span>
                <span className="text-[10px] text-zinc-500">total</span>
              </div>
              <div className="flex items-center gap-1.5 rounded-md border border-white/5 bg-white/5 px-2.5 py-1">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-40" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                </span>
                <span className="font-mono text-[11px] text-zinc-300">{onlineCount}</span>
                <span className="text-[10px] text-zinc-500">online</span>
              </div>
              {pendingCount > 0 && (
                <div className="flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2.5 py-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  <span className="font-mono text-[11px] text-amber-400">{pendingCount}</span>
                  <span className="text-[10px] text-zinc-500">pending</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Stealth Search */}
            <div className="relative flex items-center gap-2">
              <motion.div
                className="absolute left-0 top-1 bottom-1 w-[2px] rounded-r bg-white"
                initial={false}
                animate={{ opacity: searchFocused ? 1 : 0, scaleY: searchFocused ? 1 : 0 }}
                transition={{ duration: 0.15 }}
              />
              <div className="flex items-center gap-2 pl-2">
                <Search size={12} className={`shrink-0 transition-colors duration-150 ${searchFocused ? "text-white" : "text-zinc-600"}`} />
                <input
                  ref={searchRef}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                  placeholder="Search roster..."
                  className="w-36 bg-transparent text-[12px] text-zinc-300 outline-none placeholder:text-zinc-700"
                />
                {!searchFocused && !searchQuery && (
                  <kbd className="flex items-center gap-0.5 rounded border border-white/[0.06] bg-white/[0.02] px-1 py-0.5 text-[9px] font-medium text-zinc-700">
                    <span className="text-[10px]">⌘</span>F
                  </kbd>
                )}
              </div>
            </div>

            {/* Filter */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[11px] transition-all duration-150 ${
                hasActiveFilters
                  ? "bg-emerald-500/[0.06] text-emerald-400"
                  : "text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-300"
              }`}
            >
              <Filter size={12} />
              Filters
            </button>

            {/* View toggle */}
            <div className="flex rounded-lg bg-white/[0.03]">
              <button
                onClick={() => setViewMode("list")}
                className={`rounded-l-lg px-2 py-1 transition-all duration-150 ${
                  viewMode === "list" ? "bg-white/[0.06] text-zinc-200" : "text-zinc-600 hover:text-zinc-400"
                }`}
              >
                <List size={13} />
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={`rounded-r-lg px-2 py-1 transition-all duration-150 ${
                  viewMode === "grid" ? "bg-white/[0.06] text-zinc-200" : "text-zinc-600 hover:text-zinc-400"
                }`}
              >
                <Grid3X3 size={13} />
              </button>
            </div>

            {/* Roles link */}
            <Link
              href="/dashboard/team/roles"
              className="flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[11px] text-zinc-500 transition-all duration-150 hover:bg-white/[0.03] hover:text-zinc-300"
            >
              <Shield size={12} strokeWidth={1.5} />
              Roles
            </Link>

            {/* Invite — PRD 57.0 Stark White primary CTA + Seat Limit Gate */}
            {(() => {
              const { plan, memberCount } = useBillingStore();
              const atLimit = memberCount >= plan.limits.maxUsers;
              if (atLimit) {
                return (
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={() => window.location.href = "/settings/billing"}
                    className="flex h-7 items-center gap-1.5 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 text-[11px] font-medium text-amber-400 transition-all duration-200 hover:bg-amber-500/20"
                  >
                    <UserPlus size={13} strokeWidth={2} />
                    Upgrade to Add Seats
                  </motion.button>
                );
              }
              return (
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setInviteModalOpen(true)}
                  className="flex h-7 items-center gap-1.5 rounded-xl bg-white px-3 text-[11px] font-medium text-black transition-all duration-200 hover:bg-zinc-200"
                >
                  <UserPlus size={13} strokeWidth={2} className="text-black" />
                  Invite
                </motion.button>
              );
            })()}
          </div>
        </div>

        {/* Filters row */}
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
                <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-700">Filter by</span>
                <div className="ml-1 h-3 w-px bg-white/[0.04]" />
                <select
                  value={filterBranch}
                  onChange={(e) => setFilterBranch(e.target.value)}
                  className="h-6 rounded-md border border-white/[0.06] bg-transparent px-2 text-[10px] text-zinc-400 outline-none"
                >
                  <option value="all">All Branches</option>
                  {branches.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
                <select
                  value={filterRole}
                  onChange={(e) => setFilterRole(e.target.value)}
                  className="h-6 rounded-md border border-white/[0.06] bg-transparent px-2 text-[10px] text-zinc-400 outline-none"
                >
                  <option value="all">All Roles</option>
                  {roleDefinitions.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                </select>
                <select
                  value={filterSkill}
                  onChange={(e) => setFilterSkill(e.target.value)}
                  className="h-6 rounded-md border border-white/[0.06] bg-transparent px-2 text-[10px] text-zinc-400 outline-none"
                >
                  <option value="all">All Skills</option>
                  {skillDefinitions.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
                {hasActiveFilters && (
                  <button
                    onClick={() => { setFilterBranch("all"); setFilterRole("all"); setFilterSkill("all"); }}
                    className="ml-1 text-[10px] text-zinc-600 transition-colors hover:text-white"
                  >
                    Clear all
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Content ──────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto scrollbar-none">
        <AnimatePresence mode="wait">
          {viewMode === "list" ? (
            <motion.div
              key="list"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className="min-w-[700px]"
            >
              {/* Table header — PRD 57.0 Inter Display, tracking-widest, text-zinc-500 */}
              <div className="sticky top-0 z-10 flex items-center border-b border-white/5 bg-[#080808] px-5 py-1.5">
                <div className="w-8" />
                <div className="min-w-0 flex-1 px-2 font-display text-[10px] font-semibold tracking-widest text-zinc-500 uppercase">Member</div>
                <div className="w-28 px-2 font-display text-[10px] font-semibold tracking-widest text-zinc-500 uppercase">Role</div>
                <div className="w-24 px-2 font-display text-[10px] font-semibold tracking-widest text-zinc-500 uppercase">Branch</div>
                <div className="w-36 px-2 font-display text-[10px] font-semibold tracking-widest text-zinc-500 uppercase">Skills</div>
                <div className="w-24 px-2 font-display text-[10px] font-semibold tracking-widest text-zinc-500 uppercase">Last Active</div>
                <div className="w-20" />
              </div>

              {filteredMembers.length === 0 ? (
                <RosterEmptyState />
              ) : (
                filteredMembers.map((member, i) => {
                  const roleBadge = getRoleBadge(member.role);
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
                      className={`group flex cursor-pointer items-center border-b border-white/5 px-5 transition-colors duration-100 hover:bg-white/[0.02] ${
                        isPending ? "opacity-60" : ""
                      } ${isSuspended ? "opacity-40" : ""}`}
                      style={{ height: 52 }}
                    >
                      {/* Presence dot */}
                      <div className="w-8 flex items-center justify-center">
                        {online.pulse ? (
                          <span className="relative flex h-2 w-2">
                            <motion.span
                              animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0, 0.6] }}
                              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                              className="absolute inset-0 rounded-full bg-emerald-500"
                            />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                          </span>
                        ) : member.onlineStatus === "idle" ? (
                          <span className="inline-flex h-2 w-2 rounded-full bg-amber-500" />
                        ) : (
                          <span className="inline-flex h-2 w-2 rounded-full border-[1.5px] border-zinc-700" />
                        )}
                      </div>

                      {/* Identity */}
                      <div className="min-w-0 flex-1 px-2 flex items-center gap-3">
                        <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/5 bg-zinc-800 text-[10px] font-semibold text-white">
                          {member.initials}
                          {member.onlineStatus === "online" && (
                            <div className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#050505] bg-emerald-500" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="truncate text-[12px] font-medium text-white">{member.name}</p>
                            {isPending && (
                              <span className="shrink-0 rounded-md border border-dashed border-amber-500/30 bg-amber-500/[0.04] px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-wider text-amber-400">
                                Invited
                              </span>
                            )}
                            {isSuspended && (
                              <span className="shrink-0 rounded-md border border-rose-500/20 bg-rose-500/[0.04] px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-wider text-rose-400">
                                Suspended
                              </span>
                            )}
                          </div>
                          <p className="truncate text-[10px] text-zinc-600">{member.email}</p>
                        </div>
                      </div>

                      {/* Role — Muted glass pill (PRD 57.0) */}
                      <div className="w-28 px-2">
                        <span className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium ${roleBadge.bg} ${roleBadge.border} ${roleBadge.text}`}>
                          {member.role === "owner" && <span className="text-[8px] opacity-90">★</span>}
                          {getRoleLabel(member.role)}
                        </span>
                      </div>

                      {/* Branch */}
                      <div className="w-24 px-2">
                        <span className="rounded-md bg-white/[0.03] px-1.5 py-0.5 text-[10px] text-zinc-500">{member.branch.replace(" HQ", "")}</span>
                      </div>

                      {/* Skills */}
                      <div className="w-36 px-2 flex items-center gap-1">
                        {member.skills.slice(0, 3).map((skillId) => {
                          const skill = skillDefinitions.find((s) => s.id === skillId);
                          if (!skill) return null;
                          const Icon = skillIconMap[skill.icon] || Wrench;
                          return (
                            <div
                              key={skillId}
                              className="flex items-center gap-0.5 rounded-md bg-white/[0.03] px-1.5 py-0.5 text-[8px] font-medium text-zinc-500"
                              title={skill.label}
                            >
                              <Icon size={8} strokeWidth={1.5} />
                              <span className="hidden xl:inline">{skill.label.slice(0, 4)}</span>
                            </div>
                          );
                        })}
                        {member.skills.length > 3 && (
                          <span className="rounded-md bg-white/[0.03] px-1 py-0.5 text-[8px] font-medium text-zinc-600">
                            +{member.skills.length - 3}
                          </span>
                        )}
                        {member.skills.length === 0 && <span className="text-[9px] text-zinc-700">—</span>}
                      </div>

                      {/* Last Active */}
                      <div className="w-24 px-2">
                        <span className={`font-mono text-[10px] ${
                          member.lastActive === "Never" ? "text-zinc-700" :
                          member.onlineStatus === "online" ? "text-zinc-300" :
                          "text-zinc-600"
                        }`}>
                          {member.lastActive}
                        </span>
                      </div>

                      {/* Quick actions */}
                      <div className="w-20 flex items-center justify-end gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100" ref={contextMenuId === member.id ? contextRef : undefined}>
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedMemberId(member.id); }}
                          className="rounded-md p-1 text-zinc-600 transition-colors hover:bg-white/[0.04] hover:text-zinc-300"
                          title="Edit"
                        >
                          <Pencil size={11} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); }}
                          className="rounded-md p-1 text-zinc-600 transition-colors hover:bg-white/[0.04] hover:text-zinc-300"
                          title="Message"
                        >
                          <MessageSquare size={11} />
                        </button>
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setContextMenuId(contextMenuId === member.id ? null : member.id);
                            }}
                            className="rounded-md p-1 text-zinc-600 transition-colors hover:bg-white/[0.04] hover:text-zinc-300"
                          >
                            <MoreVertical size={11} />
                          </button>

                          <AnimatePresence>
                            {contextMenuId === member.id && (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: -4 }}
                                className="absolute right-0 top-7 z-30 w-44 rounded-xl border border-white/[0.06] bg-[#0C0C0C]/95 py-1 shadow-xl backdrop-blur-xl"
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
            </motion.div>
          ) : (
            /* ── GRID VIEW (Culture Cards) ──────────────── */
            <motion.div
              key="grid"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className="p-5"
            >
              {filteredMembers.length === 0 ? (
                <RosterEmptyState />
              ) : (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {filteredMembers.map((member, i) => {
                    const roleBadge = getRoleBadge(member.role);
                    const isPending = member.status === "pending";

                    return (
                      <motion.div
                        key={member.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                        onClick={() => setSelectedMemberId(member.id)}
                        className={`group cursor-pointer overflow-hidden rounded-xl bg-zinc-900/30 transition-all duration-300 hover:bg-zinc-900/40 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.06)] ${isPending ? "opacity-60" : ""}`}
                      >
                        {/* Card body */}
                        <div className="flex flex-col items-center px-4 pb-4 pt-6">
                          {/* Avatar */}
                          <div className="relative mb-3">
                            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/5 bg-zinc-800 text-lg font-semibold text-white">
                              {member.initials}
                            </div>
                            {member.onlineStatus === "online" && (
                              <div className="absolute -right-0.5 bottom-0 h-3.5 w-3.5 rounded-full border-[2.5px] border-[#0A0A0A] bg-emerald-500">
                                <motion.div
                                  animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
                                  transition={{ duration: 2, repeat: Infinity }}
                                  className="absolute inset-0 rounded-full bg-emerald-500"
                                />
                              </div>
                            )}
                            {member.onlineStatus === "idle" && (
                              <div className="absolute -right-0.5 bottom-0 h-3.5 w-3.5 rounded-full border-[2.5px] border-[#0A0A0A] bg-amber-500" />
                            )}
                          </div>

                          {/* Name */}
                          <h3 className="text-[13px] font-medium text-zinc-200 transition-colors group-hover:text-white">{member.name}</h3>

                          {/* Role Badge */}
                          <div className="mt-1.5">
                            <span className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium ${roleBadge.bg} ${roleBadge.border} ${roleBadge.text}`}>
                              {member.role === "owner" && <span className="text-[8px]">★</span>}
                              {getRoleLabel(member.role)}
                            </span>
                          </div>

                          {/* Skills */}
                          <div className="mt-2 flex items-center gap-1">
                            {member.skills.slice(0, 3).map((skillId) => {
                              const skill = skillDefinitions.find((s) => s.id === skillId);
                              if (!skill) return null;
                              const Icon = skillIconMap[skill.icon] || Wrench;
                              return (
                                <div
                                  key={skillId}
                                  className="flex h-5 w-5 items-center justify-center rounded-md bg-white/[0.03] text-zinc-600"
                                  title={skill.label}
                                >
                                  <Icon size={10} strokeWidth={1.5} />
                                </div>
                              );
                            })}
                          </div>

                          {/* Last Active */}
                          <p className={`mt-2 text-[10px] ${
                            member.onlineStatus === "online" ? "text-emerald-500" : "text-zinc-600"
                          }`}>
                            {member.onlineStatus === "online" ? "Online now" : member.lastActive}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      </motion.div>

      {/* ── Overlays ─────────────────────────────────────── */}
      <MemberDrawer />
      <InviteModal />
    </div>
  );
}

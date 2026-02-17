"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  MapPin,
  Star,
  Briefcase,
  Shield,
  Clock,
  Globe,
  CheckCircle,
  AlertTriangle,
  ChevronDown,
  UserMinus,
  RefreshCw,
  Ban,
  Play,
} from "lucide-react";
import { useState } from "react";
import { useTeamStore } from "@/lib/team-store";
import { getRoleLabel, getRoleColor, roleDefinitions, type RoleId } from "@/lib/team-data";
import { useToastStore } from "@/components/app/action-toast";

/* ── Activity icon config ─────────────────────────────── */

const activityIcons = {
  check_in: { icon: MapPin, color: "text-emerald-400", bg: "bg-emerald-500/10" },
  job_complete: { icon: Briefcase, color: "text-[#00E676]", bg: "bg-[rgba(0,230,118,0.08)]" },
  invoice_update: { icon: Star, color: "text-amber-400", bg: "bg-amber-500/10" },
  form_signed: { icon: Shield, color: "text-zinc-400", bg: "bg-zinc-500/10" },
  login: { icon: Globe, color: "text-zinc-400", bg: "bg-zinc-500/10" },
  role_change: { icon: RefreshCw, color: "text-pink-400", bg: "bg-pink-500/10" },
};

/* ── Role color map ───────────────────────────────────── */

const roleColorMap: Record<string, string> = {
  red: "bg-red-500/15 text-red-400 border-red-500/20",
  purple: "bg-[rgba(0,230,118,0.12)] text-[#00E676] border-[rgba(0,230,118,0.2)]",
  blue: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20",
  cyan: "bg-cyan-500/15 text-cyan-400 border-cyan-500/20",
  emerald: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  orange: "bg-orange-500/15 text-orange-400 border-orange-500/20",
  pink: "bg-pink-500/15 text-pink-400 border-pink-500/20",
  zinc: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20",
};

const onlineColors = {
  online: "bg-emerald-500",
  idle: "bg-amber-500",
  offline: "bg-zinc-600",
};

export function MemberDrawer() {
  const { members, selectedMemberId, setSelectedMemberId, updateMemberRoleServer, suspendMemberServer, reactivateMemberServer, removeMemberServer, resendInvite } = useTeamStore();
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const { addToast } = useToastStore();
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);

  const member = selectedMemberId ? members.find((m) => m.id === selectedMemberId) : null;
  const isOpen = !!member;

  const roleColor = member ? getRoleColor(member.role) : "zinc";
  const rolePillClass = roleColorMap[roleColor] || roleColorMap.zinc;

  const handleClose = () => {
    setSelectedMemberId(null);
    setRoleDropdownOpen(false);
    setActionMenuOpen(false);
  };

  return (
    <AnimatePresence>
      {isOpen && member && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: 420 }}
            animate={{ x: 0 }}
            exit={{ x: 420 }}
            transition={{ type: "spring", stiffness: 400, damping: 35 }}
            className="fixed right-0 top-0 z-50 flex h-screen w-[400px] flex-col border-l border-[rgba(255,255,255,0.08)] bg-[#0A0A0A]"
          >
            {/* ── Header with map background ──────────── */}
            <div className="relative h-36 shrink-0 bg-[#080808]">
              {/* GPS map grid background */}
              <div
                className="absolute inset-0 opacity-20"
                style={{
                  backgroundImage: `linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)`,
                  backgroundSize: "24px 24px",
                }}
              />
              {/* GPS pin */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                <motion.div
                  animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className={`absolute inset-0 rounded-full ${onlineColors[member.onlineStatus]}`}
                />
                <div className={`h-3 w-3 rounded-full ${onlineColors[member.onlineStatus]} shadow-[0_0_12px_rgba(16,185,129,0.4)]`} />
              </div>

              {/* Close button */}
              <button
                onClick={handleClose}
                className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-md bg-black/40 text-zinc-400 backdrop-blur-sm transition-colors hover:text-white"
              >
                <X size={14} />
              </button>

              {/* Avatar overlay at bottom */}
              <div className="absolute -bottom-8 left-5">
                <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-[#0A0A0A] bg-gradient-to-br from-zinc-700 to-zinc-800 text-lg font-bold text-zinc-300 shadow-xl">
                  {member.initials}
                  <div className={`absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-[#0A0A0A] ${onlineColors[member.onlineStatus]}`} />
                </div>
              </div>
            </div>

            {/* ── Body ────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto px-5 pt-12 pb-5">
              {/* Name + Email */}
              <div className="mb-4">
                <h2 className="text-[16px] font-semibold text-zinc-100">{member.name}</h2>
                <p className="mt-0.5 text-[12px] text-zinc-500">{member.email}</p>
                <p className="text-[11px] text-zinc-600">{member.phone}</p>
              </div>

              {/* Role + Branch */}
              <div className="mb-5 flex items-center gap-2">
                <div className="relative">
                  <button
                    onClick={() => setRoleDropdownOpen(!roleDropdownOpen)}
                    className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${rolePillClass} transition-colors hover:brightness-110`}
                  >
                    {getRoleLabel(member.role)}
                    <ChevronDown size={10} />
                  </button>

                  {/* Role dropdown */}
                  {roleDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="absolute left-0 top-8 z-20 w-48 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#161616] py-1 shadow-xl"
                    >
                      {roleDefinitions.filter((r) => r.id !== "owner").map((r) => {
                        const rc = roleColorMap[r.color] || roleColorMap.zinc;
                        return (
                          <button
                            key={r.id}
                            onClick={async () => {
                              setRoleDropdownOpen(false);
                              const { error } = await updateMemberRoleServer(member.id, r.id);
                              if (error) addToast(`Failed: ${error}`);
                              else addToast(`${member.name} updated to ${r.label}`);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] text-zinc-400 transition-colors hover:bg-[rgba(255,255,255,0.04)]"
                          >
                            <span className={`inline-block h-2 w-2 rounded-full ${rc.split(" ")[0]}`} />
                            <span>{r.label}</span>
                            {member.role === r.id && <CheckCircle size={10} className="ml-auto text-emerald-400" />}
                          </button>
                        );
                      })}
                    </motion.div>
                  )}
                </div>

                <span className="rounded-full bg-[rgba(255,255,255,0.04)] px-2.5 py-1 text-[10px] text-zinc-500">
                  {member.branch}
                </span>

                {member.status === "pending" && (
                  <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-[10px] font-medium text-amber-400">
                    Pending Invite
                  </span>
                )}
                {member.status === "suspended" && (
                  <span className="rounded-full bg-red-500/10 px-2.5 py-1 text-[10px] font-medium text-red-400">
                    Suspended
                  </span>
                )}
              </div>

              {/* Stats */}
              {member.status === "active" && (
                <div className="mb-5 grid grid-cols-3 gap-3">
                  <div className="rounded-lg border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-3 text-center">
                    <p className="text-[16px] font-semibold text-zinc-200">{member.jobsCompleted}</p>
                    <p className="text-[9px] uppercase tracking-wider text-zinc-600">Jobs Done</p>
                  </div>
                  <div className="rounded-lg border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-3 text-center">
                    <p className="text-[16px] font-semibold text-zinc-200">
                      {member.avgRating > 0 ? member.avgRating.toFixed(1) : "—"}
                    </p>
                    <p className="text-[9px] uppercase tracking-wider text-zinc-600">Avg Rating</p>
                  </div>
                  <div className="rounded-lg border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-3 text-center">
                    <p className="text-[16px] font-semibold text-zinc-200">${member.hourlyRate}</p>
                    <p className="text-[9px] uppercase tracking-wider text-zinc-600">Per Hour</p>
                  </div>
                </div>
              )}

              {/* Security */}
              <div className="mb-5 rounded-lg border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] p-3">
                <h3 className="mb-2 text-[10px] font-medium uppercase tracking-wider text-zinc-600">Security</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-zinc-500">Two-Factor Auth</span>
                    {member.twoFactorEnabled ? (
                      <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                        <CheckCircle size={10} /> Enabled
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] text-amber-400">
                        <AlertTriangle size={10} /> Disabled
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-zinc-500">Last Login IP</span>
                    <span className="font-mono text-[10px] text-zinc-500">{member.lastLoginIp}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-zinc-500">Joined</span>
                    <span className="text-[10px] text-zinc-500">{member.joinedAt}</span>
                  </div>
                </div>
              </div>

              {/* Recent Activity Timeline */}
              {member.recentActivity.length > 0 && (
                <div className="mb-5">
                  <h3 className="mb-3 text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                    Recent Activity
                  </h3>
                  <div className="space-y-0">
                    {member.recentActivity.map((act, i) => {
                      const config = activityIcons[act.type];
                      const Icon = config.icon;
                      return (
                        <motion.div
                          key={act.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.05 }}
                          className="flex gap-3 py-2"
                        >
                          <div className="flex flex-col items-center">
                            <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${config.bg}`}>
                              <Icon size={11} className={config.color} />
                            </div>
                            {i < member.recentActivity.length - 1 && (
                              <div className="mt-1 w-px flex-1 bg-[rgba(255,255,255,0.04)]" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1 pb-1">
                            <p className="text-[11px] leading-tight text-zinc-400">{act.text}</p>
                            <p className="mt-0.5 text-[9px] text-zinc-700">{act.time}</p>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="mt-auto space-y-2">
                {member.status === "pending" && (
                  <button
                    onClick={() => {
                      resendInvite(member.id);
                      addToast(`Invite resent to ${member.email}`);
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-[rgba(255,255,255,0.1)] bg-white/[0.04] py-2 text-[12px] font-medium text-zinc-300 transition-all hover:bg-white/[0.08]"
                  >
                    <RefreshCw size={13} /> Resend Invite
                  </button>
                )}
                {member.status === "active" && member.role !== "owner" && (
                  <button
                    onClick={async () => {
                      setActionLoading("suspend");
                      const { error } = await suspendMemberServer(member.id);
                      setActionLoading(null);
                      if (error) addToast(`Failed: ${error}`);
                      else addToast(`${member.name} has been suspended`);
                    }}
                    disabled={actionLoading === "suspend"}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 py-2 text-[12px] font-medium text-amber-400 transition-all hover:bg-amber-500/10 disabled:opacity-50"
                  >
                    <Ban size={13} /> {actionLoading === "suspend" ? "Suspending…" : "Suspend Access"}
                  </button>
                )}
                {member.status === "suspended" && (
                  <button
                    onClick={async () => {
                      setActionLoading("reactivate");
                      const { error } = await reactivateMemberServer(member.id);
                      setActionLoading(null);
                      if (error) addToast(`Failed: ${error}`);
                      else addToast(`${member.name} has been reactivated`);
                    }}
                    disabled={actionLoading === "reactivate"}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 py-2 text-[12px] font-medium text-emerald-400 transition-all hover:bg-emerald-500/10 disabled:opacity-50"
                  >
                    <Play size={13} /> {actionLoading === "reactivate" ? "Reactivating…" : "Reactivate"}
                  </button>
                )}
                {member.role !== "owner" && member.status !== "archived" && (
                  <button
                    onClick={async () => {
                      setActionLoading("remove");
                      const { error } = await removeMemberServer(member.id);
                      setActionLoading(null);
                      if (error) addToast(`Failed: ${error}`);
                      else {
                        addToast(`${member.name} removed from workspace`);
                        handleClose();
                      }
                    }}
                    disabled={actionLoading === "remove"}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 py-2 text-[12px] font-medium text-red-400 transition-all hover:bg-red-500/10 disabled:opacity-50"
                  >
                    <UserMinus size={13} /> {actionLoading === "remove" ? "Removing…" : "Remove from Workspace"}
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

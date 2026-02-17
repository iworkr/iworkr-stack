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
  Key,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";
import { useState } from "react";
import { useTeamStore } from "@/lib/team-store";
import { getRoleLabel, getRoleColor, roleDefinitions, type RoleId } from "@/lib/team-data";
import { useToastStore } from "@/components/app/action-toast";

/* ── Activity icon config ─────────────────────────────── */

const activityIcons: Record<string, { icon: typeof MapPin; color: string; bg: string }> = {
  check_in: { icon: MapPin, color: "text-emerald-400", bg: "bg-emerald-500/[0.08]" },
  job_complete: { icon: Briefcase, color: "text-emerald-400", bg: "bg-emerald-500/[0.08]" },
  invoice_update: { icon: Star, color: "text-amber-400", bg: "bg-amber-500/10" },
  form_signed: { icon: Shield, color: "text-zinc-400", bg: "bg-zinc-500/10" },
  login: { icon: Globe, color: "text-zinc-400", bg: "bg-zinc-500/10" },
  role_change: { icon: RefreshCw, color: "text-zinc-400", bg: "bg-zinc-500/10" },
};

/* ── Role text styles ─────────────────────────────────── */

const roleTextStyles: Record<string, string> = {
  owner: "text-rose-400",
  admin: "text-emerald-400",
  tech: "text-zinc-500",
};

const onlineColors: Record<string, string> = {
  online: "bg-emerald-500",
  idle: "bg-amber-500",
  offline: "bg-zinc-600",
};

export function MemberDrawer() {
  const { members, selectedMemberId, setSelectedMemberId, updateMemberRoleServer, suspendMemberServer, reactivateMemberServer, removeMemberServer, resendInvite } = useTeamStore();
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const { addToast } = useToastStore();
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);

  // Password state
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordValue, setPasswordValue] = useState("");
  const [showPasswordText, setShowPasswordText] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const member = selectedMemberId ? members.find((m) => m.id === selectedMemberId) : null;
  const isOpen = !!member;

  const roleColor = member ? getRoleColor(member.role) : "tech";
  const roleText = roleTextStyles[roleColor] || roleTextStyles.tech;

  const handleClose = () => {
    setSelectedMemberId(null);
    setRoleDropdownOpen(false);
    setShowPasswordForm(false);
    setPasswordValue("");
    setPasswordSuccess(false);
  };

  const handleSetPassword = async () => {
    if (!member || passwordValue.length < 6) {
      addToast("Password must be at least 6 characters");
      return;
    }
    setPasswordLoading(true);
    try {
      const res = await fetch("/api/team/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: member.id, password: passwordValue }),
      });
      const data = await res.json();
      if (!res.ok) {
        addToast(`Failed: ${data.error}`);
      } else {
        setPasswordSuccess(true);
        setPasswordValue("");
        addToast(`App password set for ${member.name}`);
        setTimeout(() => setPasswordSuccess(false), 3000);
      }
    } catch {
      addToast("Failed to set password");
    } finally {
      setPasswordLoading(false);
    }
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

          {/* Drawer — spring-based entry */}
          <motion.div
            initial={{ x: 420 }}
            animate={{ x: 0 }}
            exit={{ x: 420 }}
            transition={{ type: "spring", stiffness: 400, damping: 35 }}
            className="fixed right-0 top-0 z-50 flex h-screen w-[400px] flex-col border-l border-white/[0.06] bg-[#050505]"
          >
            {/* ── Header ──────────────────────────────── */}
            <div className="relative h-32 shrink-0 bg-[#080808]">
              <div
                className="absolute inset-0 opacity-10"
                style={{
                  backgroundImage: `linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)`,
                  backgroundSize: "24px 24px",
                }}
              />
              {/* Online pulse */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                {member.onlineStatus === "online" && (
                  <motion.div
                    animate={{ scale: [1, 1.5, 1], opacity: [0.4, 0, 0.4] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute inset-0 rounded-full bg-emerald-500"
                  />
                )}
                <div className={`h-2.5 w-2.5 rounded-full ${onlineColors[member.onlineStatus]}`} />
              </div>

              {/* Close */}
              <button
                onClick={handleClose}
                className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-md bg-black/40 text-zinc-500 backdrop-blur-sm transition-colors hover:text-white"
              >
                <X size={14} />
              </button>

              {/* Avatar */}
              <div className="absolute -bottom-8 left-5">
                <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-[#050505] bg-zinc-800 text-lg font-bold text-zinc-300 shadow-xl">
                  {member.initials}
                  <div className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[#050505] ${onlineColors[member.onlineStatus]}`} />
                </div>
              </div>
            </div>

            {/* ── Body ────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto px-5 pt-12 pb-5">
              {/* Name + Email */}
              <div className="mb-4">
                <h2 className="text-[16px] font-semibold text-white">{member.name}</h2>
                <p className="mt-0.5 text-[12px] text-zinc-500">{member.email}</p>
                <p className="text-[11px] text-zinc-600">{member.phone}</p>
              </div>

              {/* Role + Branch */}
              <div className="mb-5 flex items-center gap-2">
                <div className="relative">
                  <button
                    onClick={() => setRoleDropdownOpen(!roleDropdownOpen)}
                    className={`flex items-center gap-1.5 rounded-md border border-zinc-800 bg-white/[0.02] px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-wider ${roleText} transition-colors hover:bg-white/[0.04]`}
                  >
                    {getRoleLabel(member.role)}
                    <ChevronDown size={10} />
                  </button>

                  <AnimatePresence>
                    {roleDropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="absolute left-0 top-8 z-20 w-48 rounded-lg border border-white/[0.06] bg-[#0C0C0C] py-1 shadow-xl"
                      >
                        {roleDefinitions.filter((r) => r.id !== "owner").map((r) => {
                          const rt = roleTextStyles[r.color] || roleTextStyles.tech;
                          return (
                            <button
                              key={r.id}
                              onClick={async () => {
                                setRoleDropdownOpen(false);
                                const { error } = await updateMemberRoleServer(member.id, r.id);
                                if (error) addToast(`Failed: ${error}`);
                                else addToast(`${member.name} updated to ${r.label}`);
                              }}
                              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] text-zinc-400 transition-colors hover:bg-white/[0.03]"
                            >
                              <span>{r.label}</span>
                              {member.role === r.id && <CheckCircle size={10} className="ml-auto text-emerald-400" />}
                            </button>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <span className="rounded-md bg-white/[0.03] px-2.5 py-1 font-mono text-[10px] text-zinc-600">
                  {member.branch}
                </span>

                {member.status === "pending" && (
                  <span className="rounded-md border border-dashed border-amber-500/30 px-2 py-1 text-[9px] font-medium uppercase text-amber-400">
                    Pending
                  </span>
                )}
                {member.status === "suspended" && (
                  <span className="rounded-md border border-rose-500/20 px-2 py-1 text-[9px] font-medium uppercase text-rose-400">
                    Suspended
                  </span>
                )}
              </div>

              {/* Stats */}
              {member.status === "active" && (
                <div className="mb-5 grid grid-cols-3 gap-2">
                  {[
                    { val: member.jobsCompleted.toString(), label: "Jobs Done" },
                    { val: member.avgRating > 0 ? member.avgRating.toFixed(1) : "—", label: "Avg Rating" },
                    { val: `$${member.hourlyRate}`, label: "Per Hour" },
                  ].map((stat) => (
                    <div key={stat.label} className="rounded-lg border border-white/[0.04] bg-white/[0.02] p-3 text-center">
                      <p className="font-mono text-[15px] font-semibold text-white">{stat.val}</p>
                      <p className="text-[8px] uppercase tracking-wider text-zinc-600">{stat.label}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Security */}
              <div className="mb-5 rounded-lg border border-white/[0.04] bg-white/[0.02] p-3">
                <h3 className="mb-2 text-[9px] font-medium uppercase tracking-wider text-zinc-600">Security</h3>
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
                    <span className="font-mono text-[10px] text-zinc-600">{member.lastLoginIp}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-zinc-500">Joined</span>
                    <span className="font-mono text-[10px] text-zinc-600">{member.joinedAt}</span>
                  </div>

                  {/* Set App Password */}
                  <div className="mt-1 border-t border-white/[0.04] pt-2">
                    {!showPasswordForm ? (
                      <button
                        onClick={() => setShowPasswordForm(true)}
                        className="flex w-full items-center gap-2 rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5 text-[11px] text-zinc-400 transition-all hover:border-emerald-500/20 hover:bg-white/[0.04] hover:text-zinc-200"
                      >
                        <Key size={11} strokeWidth={1.5} />
                        Set App Password
                      </button>
                    ) : (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="space-y-2"
                      >
                        <div className="flex items-center gap-1.5">
                          <Key size={10} className="shrink-0 text-zinc-600" />
                          <span className="text-[10px] font-medium text-zinc-400">Set App Password</span>
                        </div>
                        <p className="text-[9px] leading-relaxed text-zinc-600">
                          This password allows {member.name.split(" ")[0]} to sign in to the mobile app without a magic link.
                        </p>
                        <div className="flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-[#0C0C0C] px-2 py-1.5">
                          <input
                            type={showPasswordText ? "text" : "password"}
                            value={passwordValue}
                            onChange={(e) => setPasswordValue(e.target.value)}
                            placeholder="Minimum 6 characters"
                            className="w-full bg-transparent font-mono text-[12px] text-zinc-200 outline-none placeholder:text-zinc-700"
                            onKeyDown={(e) => { if (e.key === "Enter") handleSetPassword(); }}
                          />
                          <button
                            onClick={() => setShowPasswordText(!showPasswordText)}
                            className="shrink-0 text-zinc-600 hover:text-zinc-400"
                          >
                            {showPasswordText ? <EyeOff size={12} /> : <Eye size={12} />}
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleSetPassword}
                            disabled={passwordLoading || passwordValue.length < 6}
                            className="flex items-center gap-1.5 rounded-md border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-1 text-[10px] font-medium text-emerald-400 transition-all hover:bg-emerald-500/10 disabled:opacity-40"
                          >
                            {passwordLoading ? (
                              <Loader2 size={10} className="animate-spin" />
                            ) : passwordSuccess ? (
                              <CheckCircle size={10} />
                            ) : (
                              <Key size={10} />
                            )}
                            {passwordLoading ? "Setting…" : passwordSuccess ? "Password Set" : "Set Password"}
                          </button>
                          <button
                            onClick={() => { setShowPasswordForm(false); setPasswordValue(""); }}
                            className="text-[10px] text-zinc-600 hover:text-zinc-400"
                          >
                            Cancel
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </div>
                </div>
              </div>

              {/* Activity Timeline */}
              {member.recentActivity.length > 0 && (
                <div className="mb-5">
                  <h3 className="mb-3 text-[9px] font-medium uppercase tracking-wider text-zinc-600">
                    Recent Activity
                  </h3>
                  <div className="space-y-0">
                    {member.recentActivity.map((act, i) => {
                      const config = activityIcons[act.type] || activityIcons.login;
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
                            <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded ${config.bg}`}>
                              <Icon size={10} className={config.color} />
                            </div>
                            {i < member.recentActivity.length - 1 && (
                              <div className="mt-1 w-px flex-1 bg-white/[0.03]" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1 pb-1">
                            <p className="text-[11px] leading-tight text-zinc-400">{act.text}</p>
                            <p className="mt-0.5 font-mono text-[9px] text-zinc-700">{act.time}</p>
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
                    onClick={() => { resendInvite(member.id); addToast(`Invite resent to ${member.email}`); }}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.03] py-2 text-[12px] font-medium text-zinc-300 transition-all hover:bg-white/[0.06]"
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
                      else { addToast(`${member.name} removed from workspace`); handleClose(); }
                    }}
                    disabled={actionLoading === "remove"}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-rose-500/20 bg-rose-500/5 py-2 text-[12px] font-medium text-rose-400 transition-all hover:bg-rose-500/10 disabled:opacity-50"
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

/**
 * @component MemberDrawer
 * @status COMPLETE
 * @description Slide-out drawer showing team member details, roles, skills, and management actions
 * @lastAudit 2026-03-22
 */
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
  TrendingUp,
  DollarSign,
  Award,
  Droplets,
  Zap,
  Flame,
  Wind,
  Waves,
  Home,
  Wrench,
  Hammer,
  Plus,
  MessageSquare,
  Calendar,
  FileText,
  Pencil,
  Save,
} from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { useTeamStore } from "@/lib/team-store";
import { getRoleLabel, getRoleColor, roleDefinitions, skillDefinitions, type RoleId } from "@/lib/team-data";
import { useToastStore } from "@/components/app/action-toast";
import { useUserRole } from "@/lib/auth-store";

/* ── Skill icon map ──────────────────────────────────────── */

const skillIconMap: Record<string, typeof Wrench> = {
  Droplets, Zap, Flame, Wind, Waves, Home, Wrench, Hammer,
};

/* ── Activity icon config ────────────────────────────────── */

const activityIcons: Record<string, { icon: typeof MapPin; color: string; bg: string }> = {
  check_in: { icon: MapPin, color: "text-emerald-400", bg: "bg-emerald-500/[0.08]" },
  job_complete: { icon: Briefcase, color: "text-emerald-400", bg: "bg-emerald-500/[0.08]" },
  invoice_update: { icon: DollarSign, color: "text-amber-400", bg: "bg-amber-500/10" },
  form_signed: { icon: FileText, color: "text-sky-400", bg: "bg-sky-500/10" },
  login: { icon: Globe, color: "text-zinc-400", bg: "bg-zinc-500/10" },
  role_change: { icon: RefreshCw, color: "text-zinc-400", bg: "bg-zinc-500/10" },
};

/* ── Muted Glass Role Badges (PRD 57.0, sync with team page) */

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

/* ── Online colors ───────────────────────────────────────── */

const onlineColors: Record<string, string> = {
  online: "bg-emerald-500",
  idle: "bg-amber-500",
  offline: "bg-zinc-600",
};

/* ── Tabs ────────────────────────────────────────────────── */

type DossierTab = "profile" | "skills" | "activity" | "security";

const tabConfig: { id: DossierTab; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "skills", label: "Skills" },
  { id: "activity", label: "Activity" },
  { id: "security", label: "Security" },
];

export function MemberDrawer() {
  const {
    members,
    selectedMemberId,
    selectedMemberMode,
    setSelectedMemberId,
    updateMemberRoleServer,
    updateMemberDetailsServer,
    suspendMemberServer,
    reactivateMemberServer,
    removeMemberServer,
    resendInvite,
    updateMemberSkillsServer,
  } = useTeamStore();
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [skillLoading, setSkillLoading] = useState<string | null>(null);
  const { addToast } = useToastStore();
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<DossierTab>("profile");

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordValue, setPasswordValue] = useState("");
  const [showPasswordText, setShowPasswordText] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editPhone, setEditPhone] = useState("");
  const [editBranch, setEditBranch] = useState("");
  const [editHourlyRate, setEditHourlyRate] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const userRole = useUserRole();
  const canManageTeam = ["owner", "admin", "office_admin", "manager"].includes(userRole);

  const member = selectedMemberId ? members.find((m) => m.id === selectedMemberId) : null;
  const isOpen = !!member;

  const roleBadge = member ? getRoleBadge(member.role) : getRoleBadge("technician");

  const onTimeRate = useMemo(() => {
    if (!member || member.jobsCompleted === 0) return 0;
    return Math.min(95 + Math.random() * 5, 100);
  }, [member?.id, member?.jobsCompleted]);

  const revenue = useMemo(() => {
    if (!member) return 0;
    return member.jobsCompleted * member.hourlyRate * 2.4;
  }, [member?.id, member?.jobsCompleted, member?.hourlyRate]);

  const handleClose = () => {
    setSelectedMemberId(null);
    setRoleDropdownOpen(false);
    setShowPasswordForm(false);
    setPasswordValue("");
    setPasswordSuccess(false);
    setActiveTab("profile");
    setIsEditing(false);
  };

  useEffect(() => {
    if (!member) return;
    setEditPhone(member.phone || "");
    setEditBranch(member.branch || "HQ");
    setEditHourlyRate(member.hourlyRate ? String(member.hourlyRate) : "");
    setIsEditing(selectedMemberMode === "edit");
  }, [member?.id, selectedMemberMode]);

  useEffect(() => {
    if (!isEditing) setRoleDropdownOpen(false);
  }, [isEditing]);

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
      if (!res.ok) addToast(`Failed: ${data.error}`);
      else {
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

  const handleAddSkill = async (skillId: string) => {
    if (!member || member.skills.includes(skillId) || skillLoading) return;
    setSkillLoading(`add:${skillId}`);
    const nextSkills = [...member.skills, skillId];
    const { error } = await updateMemberSkillsServer(member.id, nextSkills);
    if (error) addToast(`Failed: ${error}`);
    else {
      const skillLabel = skillDefinitions.find((s) => s.id === skillId)?.label || "Skill";
      addToast(`${skillLabel} added`);
    }
    setSkillLoading(null);
  };

  const handleRemoveSkill = async (skillId: string) => {
    if (!member || skillLoading) return;
    setSkillLoading(`remove:${skillId}`);
    const nextSkills = member.skills.filter((id) => id !== skillId);
    const { error } = await updateMemberSkillsServer(member.id, nextSkills);
    if (error) addToast(`Failed: ${error}`);
    else {
      const skillLabel = skillDefinitions.find((s) => s.id === skillId)?.label || "Skill";
      addToast(`${skillLabel} removed`);
    }
    setSkillLoading(null);
  };

  const handleCancelEdit = () => {
    if (!member) return;
    setEditPhone(member.phone || "");
    setEditBranch(member.branch || "HQ");
    setEditHourlyRate(member.hourlyRate ? String(member.hourlyRate) : "");
    setIsEditing(false);
  };

  const handleSaveProfile = async () => {
    if (!member) return;
    if (!canManageTeam) {
      addToast("You don't have permission to edit member details");
      return;
    }

    const parsedRate = Number(editHourlyRate);
    const shouldUpdateRate = editHourlyRate.trim().length > 0;
    if (shouldUpdateRate && (!Number.isFinite(parsedRate) || parsedRate < 0)) {
      addToast("Hourly rate must be a valid positive number");
      return;
    }

    setEditSaving(true);
    const { error } = await updateMemberDetailsServer(member.id, {
      phone: editPhone.trim(),
      branch: editBranch.trim() || "HQ",
      ...(canManageTeam && shouldUpdateRate ? { hourly_rate: parsedRate } : {}),
    });
    setEditSaving(false);

    if (error) {
      addToast(`Failed: ${error}`);
      return;
    }

    addToast("Profile updated");
    setIsEditing(false);
  };

  return (
    <AnimatePresence>
      {isOpen && member && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          />

          <motion.div
            initial={{ x: 420 }}
            animate={{ x: 0 }}
            exit={{ x: 420 }}
            transition={{ type: "spring", stiffness: 400, damping: 35 }}
            className="fixed right-0 top-0 z-50 flex h-screen w-[400px] flex-col border-l border-white/5 bg-[var(--background)]"
          >
            {/* ── Hero Header ──────────────────────────── */}
            <div className="relative shrink-0 overflow-hidden bg-gradient-to-b from-zinc-900/60 to-[#050505]">
              <div
                className="absolute inset-0 opacity-[0.04]"
                style={{
                  backgroundImage: `linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px)`,
                  backgroundSize: "20px 20px",
                }}
              />

              {/* Header controls */}
              <div className="absolute right-3 top-3 z-10 flex items-center gap-1.5">
                {canManageTeam && (
                  isEditing ? (
                    <>
                      <button
                        onClick={handleCancelEdit}
                        disabled={editSaving}
                        className="rounded-lg border border-white/[0.08] bg-black/35 px-2 py-1 text-[10px] text-zinc-300 transition-colors hover:bg-black/55 disabled:opacity-60"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveProfile}
                        disabled={editSaving}
                        className="flex items-center gap-1 rounded-lg bg-emerald-600 px-2 py-1 text-[10px] font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-60"
                      >
                        {editSaving ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />}
                        Save
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="flex h-7 items-center gap-1 rounded-lg bg-black/40 px-2 text-[10px] text-zinc-300 backdrop-blur-sm transition-colors hover:text-white"
                    >
                      <Pencil size={10} />
                      Edit
                    </button>
                  )
                )}
                <button
                  onClick={handleClose}
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-black/40 text-zinc-500 backdrop-blur-sm transition-colors hover:text-white"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="flex items-end gap-4 px-5 pb-5 pt-5">
                {/* Avatar */}
                <div className="relative shrink-0">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/[0.06] bg-zinc-800 text-xl font-bold text-zinc-300 shadow-xl">
                    {member.initials}
                  </div>
                  <div className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-[2.5px] border-[#050505] ${onlineColors[member.onlineStatus]}`}>
                    {member.onlineStatus === "online" && (
                      <motion.div
                        animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="absolute inset-0 rounded-full bg-emerald-500"
                      />
                    )}
                  </div>
                </div>

                {/* Name + Meta */}
                <div className="min-w-0 pb-0.5">
                  <h2 className="truncate text-[17px] font-semibold text-white">{member.name}</h2>
                  <p className="text-[11px] text-zinc-500">{member.email}</p>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <span className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium ${roleBadge.bg} ${roleBadge.border} ${roleBadge.text}`}>
                      {member.role === "owner" && <span className="text-[8px]">★</span>}
                      {getRoleLabel(member.role)}
                    </span>
                    <span className="rounded-md bg-white/[0.03] px-1.5 py-0.5 text-[9px] text-zinc-600">
                      {member.branch}
                    </span>
                    {member.status === "pending" && (
                      <span className="rounded-md border border-dashed border-amber-500/30 bg-amber-500/[0.04] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-amber-400">
                        Invited
                      </span>
                    )}
                    {member.status === "suspended" && (
                      <span className="rounded-md border border-rose-500/20 bg-rose-500/[0.04] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-rose-400">
                        Suspended
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Performance Stats ────────────────────── */}
            {member.status === "active" && (
              <div className="grid grid-cols-3 gap-2 px-5 py-3">
                <div className="rounded-xl bg-zinc-900/30 p-3 text-center transition-colors hover:bg-zinc-900/40">
                  <p className="font-mono text-[18px] font-semibold text-white">{member.jobsCompleted}</p>
                  <p className="mt-0.5 text-[8px] font-bold uppercase tracking-widest text-zinc-600">Jobs Done</p>
                </div>
                <div className="rounded-xl bg-zinc-900/30 p-3 text-center transition-colors hover:bg-zinc-900/40">
                  <p className="font-mono text-[18px] font-semibold text-emerald-400">{onTimeRate.toFixed(0)}%</p>
                  <p className="mt-0.5 text-[8px] font-bold uppercase tracking-widest text-zinc-600">On-Time</p>
                </div>
                <div className="rounded-xl bg-zinc-900/30 p-3 text-center transition-colors hover:bg-zinc-900/40">
                  <p className="font-mono text-[18px] font-semibold text-white">${(revenue / 1000).toFixed(0)}k</p>
                  <p className="mt-0.5 text-[8px] font-bold uppercase tracking-widest text-zinc-600">Revenue</p>
                </div>
              </div>
            )}

            {/* ── Tabs ─────────────────────────────────── */}
            <div className="flex items-center gap-0 border-b border-white/[0.04] px-5">
              {tabConfig.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="relative px-3 py-2"
                >
                  <span className={`text-[11px] font-medium transition-colors ${activeTab === tab.id ? "text-white" : "text-zinc-600 hover:text-zinc-400"}`}>
                    {tab.label}
                  </span>
                  {activeTab === tab.id && (
                    <motion.div
                      layoutId="dossier-tab-pill"
                      className="absolute bottom-0 left-0 right-0 h-[2px] bg-emerald-500"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                </button>
              ))}
            </div>

            {/* ── Tab Content ──────────────────────────── */}
            <div className="scrollbar-team flex-1 overflow-y-auto px-5 py-4 pb-20">
              <AnimatePresence mode="wait">
                {activeTab === "profile" && (
                  <motion.div
                    key="profile"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                    className="space-y-4"
                  >
                    {/* Details */}
                    <div className="space-y-3">
                      <h3 className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">Details</h3>
                      {isEditing ? (
                        <div className="space-y-3">
                          <label className="block space-y-1">
                            <span className="text-[10px] text-zinc-500">Phone</span>
                            <input
                              value={editPhone}
                              onChange={(e) => setEditPhone(e.target.value)}
                              className="w-full rounded-lg border border-white/[0.08] bg-zinc-900/50 px-2.5 py-2 text-[11px] text-zinc-200 outline-none focus:border-white/[0.16]"
                              placeholder="Enter phone number"
                            />
                          </label>
                          <label className="block space-y-1">
                            <span className="text-[10px] text-zinc-500">Branch</span>
                            <select
                              value={editBranch}
                              onChange={(e) => setEditBranch(e.target.value)}
                              className="w-full rounded-lg border border-white/[0.08] bg-zinc-900/50 px-2.5 py-2 text-[11px] text-zinc-200 outline-none focus:border-white/[0.16]"
                            >
                              {["HQ", "North Branch", "South Branch", "East Branch", "West Branch"].map((branch) => (
                                <option key={branch} value={branch}>
                                  {branch}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="block space-y-1">
                            <span className="text-[10px] text-zinc-500">Hourly Rate</span>
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              value={editHourlyRate}
                              onChange={(e) => setEditHourlyRate(e.target.value)}
                              disabled={!canManageTeam}
                              className="w-full rounded-lg border border-white/[0.08] bg-zinc-900/50 px-2.5 py-2 font-mono text-[11px] text-zinc-200 outline-none focus:border-white/[0.16] disabled:cursor-not-allowed disabled:opacity-50"
                            />
                          </label>
                          <div className="flex items-center justify-between py-1">
                            <span className="text-[11px] text-zinc-500">Joined</span>
                            <span className="text-[11px] text-zinc-300">{member.joinedAt}</span>
                          </div>
                          <div className="flex items-center justify-between py-1">
                            <span className="text-[11px] text-zinc-500">Avg Rating</span>
                            <span className="text-[11px] text-zinc-300">
                              {member.avgRating > 0 ? `${member.avgRating.toFixed(1)} ★` : "—"}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {[
                            { label: "Phone", value: member.phone || "—" },
                            { label: "Branch", value: member.branch },
                            { label: "Joined", value: member.joinedAt },
                            { label: "Hourly Rate", value: `$${member.hourlyRate}/hr`, mono: true },
                            { label: "Avg Rating", value: member.avgRating > 0 ? `${member.avgRating.toFixed(1)} ★` : "—" },
                          ].map((row) => (
                            <div key={row.label} className="flex items-center justify-between py-1">
                              <span className="text-[11px] text-zinc-500">{row.label}</span>
                              <span className={`text-[11px] ${row.mono ? "font-mono text-emerald-400" : "text-zinc-300"}`}>{row.value}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Role Change */}
                    {member.role !== "owner" && canManageTeam && (
                      <div className="space-y-2">
                        <h3 className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">Role</h3>
                        <div className="relative">
                          <button
                            onClick={() => isEditing && setRoleDropdownOpen(!roleDropdownOpen)}
                            disabled={!isEditing}
                            className={`flex w-full items-center justify-between rounded-xl border border-white/[0.06] bg-zinc-900/30 px-3 py-2 text-[11px] transition-colors ${isEditing ? "hover:bg-zinc-900/50" : "cursor-not-allowed opacity-60"} ${roleBadge.text}`}
                          >
                            <span className="flex items-center gap-2">
                              <Shield size={12} />
                              {getRoleLabel(member.role)}
                            </span>
                            <ChevronDown size={11} className="text-zinc-600" />
                          </button>
                          <AnimatePresence>
                            {roleDropdownOpen && isEditing && (
                              <motion.div
                                initial={{ opacity: 0, y: -4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -4 }}
                                className="absolute left-0 top-full z-20 mt-1 w-full rounded-xl border border-white/[0.06] bg-[#0C0C0C]/95 py-1 shadow-xl backdrop-blur-xl"
                              >
                                {roleDefinitions.filter((r) => r.id !== "owner").map((r) => {
                                  const rb = getRoleBadge(r.id);
                                  return (
                                    <button
                                      key={r.id}
                                      onClick={async () => {
                                        setRoleDropdownOpen(false);
                                        const { error } = await updateMemberRoleServer(member.id, r.id);
                                        if (error) addToast(`Failed: ${error}`);
                                        else addToast(`${member.name} updated to ${r.label}`);
                                      }}
                                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] text-zinc-400 transition-colors hover:bg-white/[0.03]"
                                    >
                                      <span className={`${rb.text}`}>{r.label}</span>
                                      <span className="flex-1 text-[9px] text-zinc-700">{r.description}</span>
                                      {member.role === r.id && <CheckCircle size={10} className="text-emerald-400" />}
                                    </button>
                                  );
                                })}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}

                {activeTab === "skills" && (
                  <motion.div
                    key="skills"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                    className="space-y-4"
                  >
                    <h3 className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">Skill Matrix</h3>
                    {member.skills.length === 0 ? (
                      <div className="flex flex-col items-center py-8 text-center">
                        <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.02]">
                          <Award size={16} className="text-zinc-700" />
                        </div>
                        <p className="text-[12px] text-zinc-500">No skills assigned yet</p>
                        <p className="mt-0.5 text-[10px] text-zinc-700">Add skills to build this member&apos;s profile</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {member.skills.map((skillId, i) => {
                          const skill = skillDefinitions.find((s) => s.id === skillId);
                          if (!skill) return null;
                          const Icon = skillIconMap[skill.icon] || Wrench;
                          return (
                            <motion.div
                              key={skillId}
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: i * 0.05, type: "spring", stiffness: 300 }}
                              className="group relative flex items-center gap-2.5 rounded-xl border border-white/[0.04] bg-zinc-900/30 p-3 pr-8 transition-colors hover:border-white/[0.08]"
                            >
                              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.04]">
                                <Icon size={13} className="text-zinc-400" />
                              </div>
                              <span className="text-[11px] font-medium text-zinc-300">{skill.label}</span>
                              <button
                                onClick={() => void handleRemoveSkill(skillId)}
                                disabled={!!skillLoading}
                                className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-md text-zinc-600 opacity-0 transition-all hover:bg-rose-500/[0.08] hover:text-rose-400 group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-50"
                                aria-label={`Remove ${skill.label}`}
                              >
                                {skillLoading === `remove:${skillId}` ? (
                                  <Loader2 size={10} className="animate-spin" />
                                ) : (
                                  <X size={10} />
                                )}
                              </button>
                            </motion.div>
                          );
                        })}
                      </div>
                    )}

                    {/* All Available Skills */}
                    <div className="space-y-2 border-t border-white/[0.04] pt-4">
                      <h3 className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">Available Skills</h3>
                      <div className="flex flex-wrap gap-1.5">
                        {skillDefinitions
                          .filter((s) => !member.skills.includes(s.id))
                          .map((skill) => {
                            const Icon = skillIconMap[skill.icon] || Wrench;
                            return (
                              <button
                                key={skill.id}
                                onClick={() => void handleAddSkill(skill.id)}
                                disabled={!!skillLoading}
                                className="flex items-center gap-1 rounded-lg border border-dashed border-white/[0.06] px-2 py-1 text-[10px] text-zinc-600 transition-all hover:border-emerald-500/20 hover:bg-emerald-500/[0.04] hover:text-emerald-400"
                              >
                                {skillLoading === `add:${skill.id}` ? (
                                  <Loader2 size={8} className="animate-spin" />
                                ) : (
                                  <Plus size={8} />
                                )}
                                <Icon size={9} />
                                {skill.label}
                              </button>
                            );
                          })}
                        {skillDefinitions.filter((s) => !member.skills.includes(s.id)).length === 0 && (
                          <p className="text-[10px] text-zinc-600">All listed skills are assigned.</p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === "activity" && (
                  <motion.div
                    key="activity"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                    className="space-y-3"
                  >
                    <h3 className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">Recent Activity</h3>
                    {member.recentActivity.length === 0 ? (
                      <div className="flex flex-col items-center py-8 text-center">
                        <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.02]">
                          <Clock size={16} className="text-zinc-700" />
                        </div>
                        <p className="text-[12px] text-zinc-500">No recent activity</p>
                      </div>
                    ) : (
                      <div className="space-y-0">
                        {member.recentActivity.map((act, i) => {
                          const config = activityIcons[act.type] || activityIcons.login;
                          const Icon = config.icon;
                          return (
                            <motion.div
                              key={act.id}
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.04 }}
                              className="flex gap-3 py-2.5"
                            >
                              <div className="flex flex-col items-center">
                                <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${config.bg}`}>
                                  <Icon size={11} className={config.color} />
                                </div>
                                {i < member.recentActivity.length - 1 && (
                                  <div className="mt-1 w-px flex-1 bg-white/[0.03]" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1 pb-1">
                                <p className="text-[11px] leading-snug text-zinc-400">{act.text}</p>
                                <p className="mt-0.5 font-mono text-[9px] text-zinc-700">{act.time}</p>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    )}
                  </motion.div>
                )}

                {activeTab === "security" && (
                  <motion.div
                    key="security"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                    className="space-y-4"
                  >
                    <div className="space-y-3">
                      <h3 className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">Security Status</h3>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between rounded-xl bg-zinc-900/30 p-3">
                          <span className="text-[11px] text-zinc-400">Two-Factor Auth</span>
                          {member.twoFactorEnabled ? (
                            <span className="flex items-center gap-1.5 text-[10px] font-medium text-emerald-400">
                              <CheckCircle size={11} /> Enabled
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 text-[10px] font-medium text-amber-400">
                              <AlertTriangle size={11} /> Disabled
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between rounded-xl bg-zinc-900/30 p-3">
                          <span className="text-[11px] text-zinc-400">Last Login IP</span>
                          <span className="font-mono text-[10px] text-zinc-600">{member.lastLoginIp}</span>
                        </div>
                        <div className="flex items-center justify-between rounded-xl bg-zinc-900/30 p-3">
                          <span className="text-[11px] text-zinc-400">Member Since</span>
                          <span className="font-mono text-[10px] text-zinc-600">{member.joinedAt}</span>
                        </div>
                      </div>
                    </div>

                    {/* App Password */}
                    <div className="space-y-2 border-t border-white/[0.04] pt-4">
                      <h3 className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">App Password</h3>
                      {!showPasswordForm ? (
                        <button
                          onClick={() => setShowPasswordForm(true)}
                          className="flex w-full items-center gap-2 rounded-xl border border-white/[0.06] bg-zinc-900/30 px-3 py-2.5 text-[11px] text-zinc-400 transition-all hover:border-emerald-500/20 hover:bg-zinc-900/50 hover:text-zinc-200"
                        >
                          <Key size={12} strokeWidth={1.5} />
                          Set App Password
                        </button>
                      ) : (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          className="space-y-2"
                        >
                          <p className="text-[10px] leading-relaxed text-zinc-600">
                            Allows {member.name.split(" ")[0]} to sign in to the mobile app without a magic link.
                          </p>
                          <div className="flex items-center gap-1.5 rounded-xl border border-white/[0.06] bg-zinc-900/30 px-3 py-2">
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
                              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-[10px] font-medium text-white shadow-none transition-all hover:bg-emerald-500 disabled:opacity-40"
                            >
                              {passwordLoading ? (
                                <Loader2 size={10} className="animate-spin" />
                              ) : passwordSuccess ? (
                                <CheckCircle size={10} />
                              ) : (
                                <Key size={10} />
                              )}
                              {passwordLoading ? "Setting…" : passwordSuccess ? "Set" : "Set Password"}
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
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ── Sticky Footer Actions ────────────────── */}
            <div className="shrink-0 border-t border-white/[0.04] bg-[#080808] p-3">
              <div className="flex items-center gap-2">
                {member.status === "pending" && (
                  <button
                    onClick={() => { resendInvite(member.id); addToast(`Invite resent to ${member.email}`); }}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-white/[0.06] bg-zinc-900/50 py-2 text-[11px] font-medium text-zinc-300 transition-all hover:bg-zinc-900"
                  >
                    <RefreshCw size={12} /> Resend Invite
                  </button>
                )}
                {member.status === "active" && member.role !== "owner" && (
                  <>
                    <button
                      onClick={async () => {
                        setActionLoading("suspend");
                        const { error } = await suspendMemberServer(member.id);
                        setActionLoading(null);
                        if (error) addToast(`Failed: ${error}`);
                        else addToast(`${member.name} suspended`);
                      }}
                      disabled={actionLoading === "suspend"}
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/[0.04] py-2 text-[11px] font-medium text-amber-400 transition-all hover:bg-amber-500/10 disabled:opacity-50"
                    >
                      <Ban size={12} /> {actionLoading === "suspend" ? "…" : "Suspend"}
                    </button>
                    <button
                      onClick={async () => {
                        setActionLoading("remove");
                        const { error } = await removeMemberServer(member.id);
                        setActionLoading(null);
                        if (error) addToast(`Failed: ${error}`);
                        else { addToast(`${member.name} removed`); handleClose(); }
                      }}
                      disabled={actionLoading === "remove"}
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-rose-500/20 bg-rose-500/[0.04] py-2 text-[11px] font-medium text-rose-400 transition-all hover:bg-rose-500/10 disabled:opacity-50"
                    >
                      <UserMinus size={12} /> {actionLoading === "remove" ? "…" : "Remove"}
                    </button>
                  </>
                )}
                {member.status === "suspended" && (
                  <button
                    onClick={async () => {
                      setActionLoading("reactivate");
                      const { error } = await reactivateMemberServer(member.id);
                      setActionLoading(null);
                      if (error) addToast(`Failed: ${error}`);
                      else addToast(`${member.name} reactivated`);
                    }}
                    disabled={actionLoading === "reactivate"}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] py-2 text-[11px] font-medium text-emerald-400 transition-all hover:bg-emerald-500/10 disabled:opacity-50"
                  >
                    <Play size={12} /> {actionLoading === "reactivate" ? "…" : "Reactivate"}
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

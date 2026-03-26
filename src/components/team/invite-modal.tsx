/**
 * @component InviteModal
 * @status COMPLETE
 * @description Modal for inviting team members via email with role selection and bulk input
 * @lastAudit 2026-03-22
 */
"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  UserPlus,
  Send,
  Check,
  Info,
  Crown,
  Shield,
  Wrench,
  Heart,
  Stethoscope,
  ClipboardList,
  GraduationCap,
  Building2,
  UserCog,
  type LucideIcon,
} from "lucide-react";
import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTeamStore } from "@/lib/team-store";
import { type RoleId } from "@/lib/team-data";
import { useToastStore } from "@/components/app/action-toast";
import { useIndustryLexicon } from "@/lib/industry-lexicon";
import { useAuthStore } from "@/lib/auth-store";
import { getBranches, type Branch } from "@/app/actions/branches";

/* ── Role Card Config ────────────────────────────────────── */

interface RoleCardStyle {
  text: string;
  bg: string;
  border: string;
  icon: LucideIcon;
  label: string;
  description: string;
}

/** Trades-sector role cards */
const tradesRoleCards: Record<string, RoleCardStyle> = {
  admin:         { text: "text-amber-400",  bg: "bg-amber-500/10",  border: "border-amber-500/20",  icon: Crown,    label: "Admin",          description: "Full operational access. Manages settings, team, and integrations." },
  manager:       { text: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20", icon: Shield,    label: "Manager",        description: "Manages operations, team, and finances." },
  office_admin:  { text: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20", icon: Shield,    label: "Office Admin",   description: "Handles scheduling, invoicing, and client communication." },
  senior_tech:   { text: "text-sky-400",    bg: "bg-sky-500/10",    border: "border-sky-500/20",    icon: Wrench,    label: "Senior Tech",    description: "Experienced technician. Can manage their own jobs and mentees." },
  technician:    { text: "text-sky-400",    bg: "bg-sky-500/10",    border: "border-sky-500/20",    icon: Wrench,    label: "Technician",     description: "Field tech. Views assigned jobs, tracks time, fills forms." },
  apprentice:    { text: "text-zinc-400",   bg: "bg-zinc-500/10",   border: "border-zinc-500/20",   icon: Wrench,    label: "Apprentice",     description: "Learning. Supervised access only." },
  subcontractor: { text: "text-zinc-400",   bg: "bg-zinc-500/10",   border: "border-zinc-500/20",   icon: Wrench,    label: "Subcontractor",  description: "External contractor. Limited to assigned jobs only." },
};

/** Care-sector role cards */
const careRoleCards: Record<string, RoleCardStyle> = {
  admin:         { text: "text-amber-400",  bg: "bg-amber-500/10",  border: "border-amber-500/20",  icon: Crown,          label: "Admin",                 description: "Full operational access. Manages rostering, compliance, team, and settings." },
  manager:       { text: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20", icon: Building2,       label: "Service Manager",       description: "Oversees daily operations, rosters, incidents, and participant plans." },
  office_admin:  { text: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20", icon: ClipboardList,   label: "Rostering Coordinator", description: "Manages shift scheduling, PRODA claims, and participant communication." },
  senior_tech:   { text: "text-sky-400",    bg: "bg-sky-500/10",    border: "border-sky-500/20",    icon: Stethoscope,     label: "Senior Support Worker", description: "Experienced carer. Mentors new staff, handles complex support needs." },
  technician:    { text: "text-sky-400",    bg: "bg-sky-500/10",    border: "border-sky-500/20",    icon: Heart,           label: "Support Worker",        description: "Delivers direct care. Logs shift notes, medications, and observations." },
  apprentice:    { text: "text-teal-400",   bg: "bg-teal-500/10",   border: "border-teal-500/20",   icon: GraduationCap,   label: "Trainee",               description: "New to care. Supervised access for training and shadow shifts." },
  subcontractor: { text: "text-zinc-400",   bg: "bg-zinc-500/10",   border: "border-zinc-500/20",   icon: UserCog,         label: "Agency Worker",         description: "External agency staff. Limited to assigned shifts only." },
};

const INVITABLE_ROLES: RoleId[] = ["admin", "manager", "office_admin", "senior_tech", "technician", "apprentice", "subcontractor"];

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function InviteModal() {
  const { inviteModalOpen, setInviteModalOpen, refresh: refreshTeamStore } = useTeamStore();
  const { addToast } = useToastStore();
  const { isCare } = useIndustryLexicon();

  // Get org directly from auth store — the single source of truth
  const currentOrg = useAuthStore((s) => s.currentOrg);
  const orgId = currentOrg?.id ?? null;

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["invite-modal-branches", orgId],
    enabled: Boolean(orgId),
    queryFn: async () => {
      const result = await getBranches(orgId!);
      return result.data || [];
    },
  });

  const roleCards = isCare ? careRoleCards : tradesRoleCards;

  const [emails, setEmails] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [selectedRole, setSelectedRole] = useState<RoleId>("technician");
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!inviteModalOpen) return;
    const frame = requestAnimationFrame(() => {
      setEmails([]);
      setInputValue("");
      setSelectedRole("technician");
      setSelectedBranchId(branches[0]?.id || null);
      setSending(false);
      setSent(false);
    });
    return () => cancelAnimationFrame(frame);
  }, [inviteModalOpen, branches]);

  const addEmail = useCallback(
    (raw: string) => {
      const parts = raw
        .split(/[,;\s]+/)
        .map((e) => e.trim())
        .filter((e) => isValidEmail(e));
      if (parts.length > 0) {
        setEmails((prev) => {
          const next = [...prev];
          parts.forEach((part) => {
            if (!next.includes(part)) next.push(part);
          });
          return next;
        });
      }
    },
    []
  );

  const pendingInput = inputValue.trim();
  const hasPendingValidEmail = isValidEmail(pendingInput) && !emails.includes(pendingInput);
  const hasInvitesReady = emails.length > 0 || hasPendingValidEmail;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === "Enter" || e.key === "," || e.key === " ") && inputValue.trim()) {
      e.preventDefault();
      addEmail(inputValue.trim());
      setInputValue("");
    }
    if (e.key === "Backspace" && !inputValue && emails.length > 0) {
      setEmails((prev) => prev.slice(0, -1));
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    addEmail(e.clipboardData.getData("text"));
    setInputValue("");
  };

  const removeEmail = (email: string) => {
    setEmails((prev) => prev.filter((e) => e !== email));
  };

  const branchNameById = useMemo(
    () => new Map(branches.map((branch) => [branch.id, branch.name])),
    [branches]
  );

  const handleSend = async () => {
    const pendingParts = inputValue
      .split(/[,;\s]+/)
      .map((e) => e.trim())
      .filter((e) => isValidEmail(e));

    const resolvedEmails = [...emails];
    pendingParts.forEach((part) => {
      if (!resolvedEmails.includes(part)) resolvedEmails.push(part);
    });

    if (resolvedEmails.length === 0) return;

    if (pendingParts.length > 0) {
      setEmails(resolvedEmails);
      setInputValue("");
    }

    setSending(true);

    let successCount = 0;
    let lastError: string | null = null;

    // Use fetch() to API route — completely bypasses server action caching.
    // The API route resolves orgId server-side from the authenticated user.
    for (const email of resolvedEmails) {
      try {
        const res = await fetch("/api/team/invite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            role: selectedRole,
            branch: selectedBranchId ? branchNameById.get(selectedBranchId) || undefined : undefined,
            branch_id: selectedBranchId,
            orgId,
          }),
        });
        const data = await res.json();
        if (!res.ok || data.error) {
          lastError = data.error || `HTTP ${res.status}`;
        } else {
          successCount++;
        }
      } catch (err: any) {
        lastError = err.message || "Network error";
      }
    }

    setSending(false);

    if (successCount > 0) {
      setSent(true);
      addToast(`${successCount} invite${successCount > 1 ? "s" : ""} sent successfully`);
      refreshTeamStore();
      setTimeout(() => setInviteModalOpen(false), 1500);
    } else {
      addToast(`Failed to send invites: ${lastError}`);
    }
  };

  const selectedCard = roleCards[selectedRole];

  if (!inviteModalOpen) return null;

  return (
    <AnimatePresence>
      {inviteModalOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setInviteModalOpen(false)}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-[520px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-white/5 bg-zinc-950 shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-4 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10">
                  <UserPlus size={14} className="text-white" />
                </div>
                <div>
                  <h2 className="font-display text-[15px] font-semibold tracking-tight text-white">
                    {isCare ? "Invite to Care Team" : "Invite to Workspace"}
                  </h2>
                  <p className="text-[11px] text-zinc-500">
                    {isCare ? "Add support workers, managers, and coordinators" : "Send summons to join your team"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setInviteModalOpen(false)}
                className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-white/5 hover:text-white"
                aria-label="Close"
              >
                <X size={13} />
              </button>
            </div>

            {/* Content */}
            <div className="px-6 pb-5 space-y-5">
              {/* Email chips */}
              <div>
                <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-widest text-zinc-600">
                  Email Addresses
                </label>
                <div
                  className="flex min-h-[42px] flex-wrap items-center gap-1.5 rounded-xl border border-white/[0.06] bg-zinc-900/50 px-3 py-2 transition-colors focus-within:border-white/20 focus-within:shadow-[0_0_0_1px_rgba(255,255,255,0.05)]"
                  onClick={() => inputRef.current?.focus()}
                >
                  {emails.map((email) => (
                    <motion.span
                      key={email}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                      className="flex items-center gap-1 rounded-lg bg-white/[0.05] px-2 py-0.5 text-[11px] text-zinc-300"
                    >
                      {email}
                      <button
                        onClick={(e) => { e.stopPropagation(); removeEmail(email); }}
                        className="ml-0.5 text-zinc-600 hover:text-zinc-400"
                      >
                        <X size={9} />
                      </button>
                    </motion.span>
                  ))}
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onPaste={handlePaste}
                    onBlur={() => {
                      if (!inputValue.trim()) return;
                      addEmail(inputValue.trim());
                      setInputValue("");
                    }}
                    placeholder={emails.length === 0 ? "name@company.com (comma separated)" : "Add more…"}
                    className="min-w-[120px] flex-1 bg-transparent text-[12px] text-zinc-300 placeholder-zinc-700 outline-none"
                    autoFocus
                  />
                </div>
              </div>

              {/* Role Selection */}
              <div>
                <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-widest text-zinc-600">
                  Role
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {INVITABLE_ROLES.map((roleId) => {
                    const rc = roleCards[roleId];
                    if (!rc) return null;
                    const isActive = selectedRole === roleId;
                    const RcIcon = rc.icon;
                    return (
                      <button
                        key={roleId}
                        onClick={() => setSelectedRole(roleId)}
                        className={`relative flex flex-col items-center gap-1 rounded-xl border p-3 text-center transition-all duration-200 ${
                          isActive
                            ? `${rc.border} ${rc.bg} ${rc.text}`
                            : "border-white/[0.04] bg-zinc-900/20 text-zinc-500 hover:border-white/[0.08] hover:bg-zinc-900/40"
                        }`}
                      >
                        <RcIcon size={14} />
                        <span className="text-[9px] font-medium leading-tight">{rc.label}</span>
                        {isActive && (
                          <motion.div
                            layoutId="invite-role-check"
                            className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-white shadow"
                            transition={{ type: "spring", stiffness: 300 }}
                          >
                            <Check size={8} className="text-black" />
                          </motion.div>
                        )}
                      </button>
                    );
                  })}
                </div>
                {selectedCard && (
                  <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-white/[0.015] px-2 py-1.5">
                    <Info size={10} className="mt-0.5 shrink-0 text-zinc-700" />
                    <p className="text-[10px] leading-relaxed text-zinc-600">
                      {selectedCard.description}
                    </p>
                  </div>
                )}
              </div>

              {/* Branch / Location — single authoritative branch assignment */}
              {branches.length > 0 && (
                <div>
                  <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-widest text-zinc-600">
                    {isCare ? "Service Region" : "Branch"}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {branches.map((branch) => {
                      const isSelected = selectedBranchId === branch.id;
                      return (
                        <button
                          key={branch.id}
                          onClick={() => setSelectedBranchId(branch.id)}
                          className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-[11px] font-medium transition-all ${
                            isSelected
                              ? "border-white/20 bg-white/10 text-white"
                              : "border-white/[0.05] bg-zinc-900/50 text-zinc-500 hover:text-zinc-300"
                          }`}
                        >
                          <div className={`flex h-3.5 w-3.5 items-center justify-center rounded border transition-colors ${
                            isSelected ? "border-white bg-white" : "border-zinc-600 bg-transparent"
                          }`}>
                            {isSelected && <Check size={8} className="text-black" />}
                          </div>
                          {branch.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-4 px-6 py-4">
              <p className="text-[11px] text-zinc-500">
                {hasInvitesReady
                  ? `${emails.length + (hasPendingValidEmail ? 1 : 0)} invite${emails.length + (hasPendingValidEmail ? 1 : 0) > 1 ? "s" : ""} ready`
                  : "Paste or type email addresses"}
              </p>

              <button
                onClick={handleSend}
                disabled={!hasInvitesReady || sending || sent}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-medium transition-all ${
                  sent
                    ? "bg-white text-black"
                    : !hasInvitesReady
                    ? "cursor-not-allowed bg-zinc-800 text-zinc-600"
                    : "bg-white text-black hover:bg-zinc-200"
                } disabled:opacity-50`}
              >
                {sent ? (
                  <><Check size={13} /> Sent!</>
                ) : sending ? (
                  <>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    >
                      <Send size={13} />
                    </motion.div>
                    Sending…
                  </>
                ) : (
                  <><Send size={13} /> {isCare ? "Send Invite" : "Send Summons"}</>
                )}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

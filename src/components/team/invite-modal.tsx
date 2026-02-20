"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  UserPlus,
  Send,
  ChevronDown,
  Check,
  Info,
  Crown,
  Shield,
  Wrench,
} from "lucide-react";
import { useState, useRef, useCallback, useEffect } from "react";
import { useTeamStore } from "@/lib/team-store";
import { roleDefinitions, branches, getRoleLabel, type RoleId } from "@/lib/team-data";
import { useToastStore } from "@/components/app/action-toast";

/* ── Role Card Config ────────────────────────────────────── */

const roleCardConfig: Record<string, { text: string; bg: string; border: string; icon: typeof Shield }> = {
  owner: { text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", icon: Crown },
  manager: { text: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20", icon: Shield },
  office_admin: { text: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20", icon: Shield },
  senior_tech: { text: "text-sky-400", bg: "bg-sky-500/10", border: "border-sky-500/20", icon: Wrench },
  technician: { text: "text-sky-400", bg: "bg-sky-500/10", border: "border-sky-500/20", icon: Wrench },
  apprentice: { text: "text-zinc-400", bg: "bg-zinc-500/10", border: "border-zinc-500/20", icon: Wrench },
  subcontractor: { text: "text-zinc-400", bg: "bg-zinc-500/10", border: "border-zinc-500/20", icon: Wrench },
};

export function InviteModal() {
  const { inviteModalOpen, setInviteModalOpen, inviteMemberServer } = useTeamStore();
  const { addToast } = useToastStore();

  const [emails, setEmails] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [selectedRole, setSelectedRole] = useState<RoleId>("technician");
  const [selectedBranches, setSelectedBranches] = useState<string[]>(["Brisbane HQ"]);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inviteModalOpen) {
      setEmails([]);
      setInputValue("");
      setSelectedRole("technician");
      setSelectedBranches(["Brisbane HQ"]);
      setSending(false);
      setSent(false);
    }
  }, [inviteModalOpen]);

  const addEmail = useCallback(
    (raw: string) => {
      const parts = raw.split(/[,;\s]+/).filter((e) => e.includes("@") && !emails.includes(e));
      if (parts.length > 0) setEmails((prev) => [...prev, ...parts]);
    },
    [emails]
  );

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
    const pasted = e.clipboardData.getData("text");
    addEmail(pasted);
    setInputValue("");
  };

  const removeEmail = (email: string) => {
    setEmails((prev) => prev.filter((e) => e !== email));
  };

  const toggleBranch = (branch: string) => {
    setSelectedBranches((prev) =>
      prev.includes(branch) ? prev.filter((b) => b !== branch) : [...prev, branch]
    );
  };

  const handleSend = async () => {
    if (emails.length === 0) return;
    setSending(true);

    let successCount = 0;
    let lastError: string | null = null;

    for (const email of emails) {
      const { error } = await inviteMemberServer({
        email,
        role: selectedRole,
        branch: selectedBranches[0] || "HQ",
      });
      if (error) lastError = error;
      else successCount++;
    }

    setSending(false);

    if (successCount > 0) {
      setSent(true);
      addToast(`${successCount} invite${successCount > 1 ? "s" : ""} sent successfully`);
      setTimeout(() => setInviteModalOpen(false), 1500);
    } else {
      addToast(`Failed to send invites: ${lastError}`);
    }
  };

  const selectedRoleDef = roleDefinitions.find((r) => r.id === selectedRole);

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
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-[520px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-white/5 bg-zinc-950 shadow-2xl"
          >
            {/* Header — no hr, whitespace separation */}
            <div className="flex items-center justify-between gap-4 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10">
                  <UserPlus size={14} className="text-white" />
                </div>
                <div>
                  <h2 className="font-display text-[15px] font-semibold tracking-tight text-white">Invite to Workspace</h2>
                  <p className="text-[11px] text-zinc-500">Send summons to join your team</p>
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
                    placeholder={emails.length === 0 ? "name@company.com (comma separated)" : "Add more…"}
                    className="min-w-[120px] flex-1 bg-transparent text-[12px] text-zinc-300 placeholder-zinc-700 outline-none"
                    autoFocus
                  />
                </div>
              </div>

              {/* Role Selection — Card Grid */}
              <div>
                <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-widest text-zinc-600">
                  Role
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {roleDefinitions.filter((r) => r.id !== "owner").slice(0, 6).map((r) => {
                    const rc = roleCardConfig[r.id] || roleCardConfig.technician;
                    const isActive = selectedRole === r.id;
                    const RcIcon = rc.icon;
                    return (
                      <button
                        key={r.id}
                        onClick={() => setSelectedRole(r.id)}
                        className={`relative flex flex-col items-center gap-1 rounded-xl border p-3 text-center transition-all duration-200 ${
                          isActive
                            ? `${rc.border} ${rc.bg} ${rc.text}`
                            : "border-white/[0.04] bg-zinc-900/20 text-zinc-500 hover:border-white/[0.08] hover:bg-zinc-900/40"
                        }`}
                      >
                        <RcIcon size={14} />
                        <span className="text-[9px] font-medium">{r.label}</span>
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
                {selectedRoleDef && (
                  <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-white/[0.015] px-2 py-1.5">
                    <Info size={10} className="mt-0.5 shrink-0 text-zinc-700" />
                    <p className="text-[10px] leading-relaxed text-zinc-600">
                      {selectedRoleDef.description}
                    </p>
                  </div>
                )}
              </div>

              {/* Branch */}
              <div>
                <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-widest text-zinc-600">
                  Branch
                </label>
                <div className="flex gap-2">
                  {branches.map((branch) => {
                    const isSelected = selectedBranches.includes(branch);
                    return (
                      <button
                        key={branch}
                        onClick={() => toggleBranch(branch)}
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
                        {branch}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer — Primary: white (PRD 55.0) */}
            <div className="flex items-center justify-between gap-4 px-6 py-4">
              <p className="text-[11px] text-zinc-500">
                {emails.length > 0 ? `${emails.length} invite${emails.length > 1 ? "s" : ""} ready` : "Paste or type email addresses"}
              </p>

              <button
                onClick={handleSend}
                disabled={emails.length === 0 || sending || sent}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-medium transition-all ${
                  sent
                    ? "bg-white text-black"
                    : emails.length === 0
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
                  <><Send size={13} /> Send Summons</>
                )}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

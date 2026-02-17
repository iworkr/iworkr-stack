"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  UserPlus,
  Send,
  ChevronDown,
  Check,
  Info,
} from "lucide-react";
import { useState, useRef, useCallback, useEffect } from "react";
import { useTeamStore } from "@/lib/team-store";
import { roleDefinitions, branches, getRoleLabel, type RoleId } from "@/lib/team-data";
import { useToastStore } from "@/components/app/action-toast";

/* ── Role text styles (Stealth) ──────────────────────── */

const roleTextStyles: Record<string, string> = {
  owner: "text-rose-400",
  admin: "text-emerald-400",
  tech: "text-zinc-400",
};

export function InviteModal() {
  const { inviteModalOpen, setInviteModalOpen, inviteMemberServer } = useTeamStore();
  const { addToast } = useToastStore();

  const [emails, setEmails] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [selectedRole, setSelectedRole] = useState<RoleId>("technician");
  const [selectedBranches, setSelectedBranches] = useState<string[]>(["Brisbane HQ"]);
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
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
      setTimeout(() => {
        setInviteModalOpen(false);
      }, 1500);
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
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setInviteModalOpen(false)}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-[520px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-white/[0.06] bg-[#0A0A0A] shadow-[0_40px_80px_-12px_rgba(0,0,0,0.8)]"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/[0.05] px-5 py-3.5">
              <div className="flex items-center gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.06] bg-white/[0.03]">
                  <UserPlus size={14} className="text-zinc-400" />
                </div>
                <div>
                  <h2 className="text-[13px] font-medium text-white">Invite People</h2>
                  <p className="text-[10px] text-zinc-600">Send invites to join your workspace</p>
                </div>
              </div>
              <button
                onClick={() => setInviteModalOpen(false)}
                className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-600 transition-colors hover:bg-white/[0.04] hover:text-zinc-400"
              >
                <X size={13} />
              </button>
            </div>

            {/* Content */}
            <div className="px-5 py-4 space-y-4">
              {/* Email chips input */}
              <div>
                <label className="mb-1.5 block text-[9px] font-medium uppercase tracking-wider text-zinc-600">
                  Email Addresses
                </label>
                <div
                  className="flex min-h-[40px] flex-wrap items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 transition-colors focus-within:border-emerald-500/20"
                  onClick={() => inputRef.current?.focus()}
                >
                  {emails.map((email) => (
                    <motion.span
                      key={email}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex items-center gap-1 rounded-md bg-white/[0.05] px-2 py-0.5 text-[11px] text-zinc-300"
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

              {/* Role selector */}
              <div>
                <label className="mb-1.5 block text-[9px] font-medium uppercase tracking-wider text-zinc-600">
                  Role
                </label>
                <div className="relative">
                  <button
                    onClick={() => setRoleDropdownOpen(!roleDropdownOpen)}
                    className="flex w-full items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[12px] text-zinc-300 transition-colors hover:border-white/[0.1]"
                  >
                    <span className={`font-mono text-[10px] font-medium uppercase tracking-wider ${roleTextStyles[selectedRoleDef?.color || "tech"]}`}>
                      {getRoleLabel(selectedRole)}
                    </span>
                    <ChevronDown size={12} className="text-zinc-600" />
                  </button>

                  <AnimatePresence>
                    {roleDropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="absolute left-0 top-full z-20 mt-1 w-full rounded-lg border border-white/[0.06] bg-[#0C0C0C] py-1 shadow-xl"
                      >
                        {roleDefinitions.filter((r) => r.id !== "owner").map((r) => (
                          <button
                            key={r.id}
                            onClick={() => { setSelectedRole(r.id); setRoleDropdownOpen(false); }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-white/[0.03]"
                          >
                            <span className={`font-mono text-[9px] font-medium uppercase tracking-wider ${roleTextStyles[r.color] || roleTextStyles.tech}`}>
                              {r.label}
                            </span>
                            <div className="flex-1">
                              <p className="text-[10px] text-zinc-600">{r.description}</p>
                            </div>
                            {selectedRole === r.id && <Check size={11} className="text-emerald-400" />}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {selectedRoleDef && (
                  <div className="mt-1.5 flex items-start gap-1.5 rounded-md bg-white/[0.015] px-2 py-1.5">
                    <Info size={10} className="mt-0.5 shrink-0 text-zinc-700" />
                    <p className="text-[10px] leading-relaxed text-zinc-600">
                      {selectedRoleDef.description}
                    </p>
                  </div>
                )}
              </div>

              {/* Branch */}
              <div>
                <label className="mb-1.5 block text-[9px] font-medium uppercase tracking-wider text-zinc-600">
                  Branch
                </label>
                <div className="flex gap-2">
                  {branches.map((branch) => {
                    const isSelected = selectedBranches.includes(branch);
                    return (
                      <button
                        key={branch}
                        onClick={() => toggleBranch(branch)}
                        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-[11px] font-medium transition-all ${
                          isSelected
                            ? "border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-400"
                            : "border-white/[0.05] bg-white/[0.02] text-zinc-500 hover:text-zinc-300"
                        }`}
                      >
                        <div className={`flex h-3.5 w-3.5 items-center justify-center rounded border transition-colors ${
                          isSelected ? "border-emerald-500 bg-emerald-500" : "border-zinc-700 bg-transparent"
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

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-white/[0.05] px-5 py-3">
              <p className="text-[10px] text-zinc-600">
                {emails.length > 0 ? `${emails.length} invite${emails.length > 1 ? "s" : ""} ready` : "Paste or type email addresses"}
              </p>

              <button
                onClick={handleSend}
                disabled={emails.length === 0 || sending || sent}
                className={`flex items-center gap-2 rounded-md px-4 py-1.5 text-[11px] font-medium transition-all ${
                  sent
                    ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                    : emails.length === 0
                    ? "cursor-not-allowed border border-white/[0.04] bg-zinc-900 text-zinc-600"
                    : "border border-white/[0.08] bg-zinc-900 text-white hover:border-emerald-500/30 hover:text-emerald-400"
                }`}
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
                  <><Send size={13} /> Send Invites</>
                )}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

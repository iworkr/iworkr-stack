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

/* ── Role color map ───────────────────────────────────── */

const roleColorMap: Record<string, string> = {
  red: "bg-red-500/15 text-red-400",
  purple: "bg-purple-500/15 text-purple-400",
  blue: "bg-[rgba(0,230,118,0.1)] text-[#00E676]",
  cyan: "bg-cyan-500/15 text-cyan-400",
  emerald: "bg-emerald-500/15 text-emerald-400",
  orange: "bg-orange-500/15 text-orange-400",
  pink: "bg-pink-500/15 text-pink-400",
  zinc: "bg-zinc-500/15 text-zinc-400",
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
            className="fixed inset-0 z-50 bg-black/85 backdrop-blur-2xl"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-[580px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#121212] shadow-[0_40px_80px_-12px_rgba(0,0,0,0.6)]"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[rgba(0,230,118,0.08)]">
                  <UserPlus size={16} className="text-[#00E676]" />
                </div>
                <div>
                  <h2 className="text-[14px] font-semibold text-zinc-200">Invite People</h2>
                  <p className="text-[11px] text-zinc-600">Add team members to your workspace</p>
                </div>
              </div>
              <button
                onClick={() => setInviteModalOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-600 transition-colors hover:bg-[rgba(255,255,255,0.06)] hover:text-zinc-300"
              >
                <X size={14} />
              </button>
            </div>

            {/* Content */}
            <div className="px-6 py-5 space-y-5">
              {/* Step 1: Email chips */}
              <div>
                <label className="mb-2 block text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                  Email Addresses
                </label>
                <div
                  className="flex min-h-[44px] flex-wrap items-center gap-1.5 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-3 py-2 transition-colors focus-within:border-[rgba(255,255,255,0.2)]"
                  onClick={() => inputRef.current?.focus()}
                >
                  {emails.map((email) => (
                    <motion.span
                      key={email}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex items-center gap-1 rounded-full bg-[rgba(0,230,118,0.08)] px-2.5 py-1 text-[11px] text-[#00E676]"
                    >
                      {email}
                      <button
                        onClick={(e) => { e.stopPropagation(); removeEmail(email); }}
                        className="ml-0.5 text-[rgba(0,230,118,0.6)] hover:text-[#00E676]"
                      >
                        <X size={10} />
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
                    placeholder={emails.length === 0 ? "name@company.com (comma separated)" : "Add more..."}
                    className="min-w-[120px] flex-1 bg-transparent text-[12px] text-zinc-300 placeholder-zinc-600 outline-none"
                    autoFocus
                  />
                </div>
              </div>

              {/* Step 2: Role */}
              <div>
                <label className="mb-2 block text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                  Role
                </label>
                <div className="relative">
                  <button
                    onClick={() => setRoleDropdownOpen(!roleDropdownOpen)}
                    className="flex w-full items-center justify-between rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-3 py-2.5 text-[12px] text-zinc-300 transition-colors hover:border-[rgba(255,255,255,0.15)]"
                  >
                    <span className="flex items-center gap-2">
                      <span className={`inline-flex h-2 w-2 rounded-full ${roleColorMap[selectedRoleDef?.color || "zinc"]?.split(" ")[0]}`} />
                      {getRoleLabel(selectedRole)}
                    </span>
                    <ChevronDown size={13} className="text-zinc-600" />
                  </button>

                  {roleDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="absolute left-0 top-full z-20 mt-1 w-full rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#1A1A1A] py-1 shadow-xl"
                    >
                      {roleDefinitions.filter((r) => r.id !== "owner").map((r) => (
                        <button
                          key={r.id}
                          onClick={() => { setSelectedRole(r.id); setRoleDropdownOpen(false); }}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-[rgba(255,255,255,0.04)]"
                        >
                          <span className={`inline-flex h-2 w-2 rounded-full ${roleColorMap[r.color]?.split(" ")[0]}`} />
                          <div className="flex-1">
                            <p className="text-[12px] text-zinc-300">{r.label}</p>
                            <p className="text-[10px] text-zinc-600">{r.description}</p>
                          </div>
                          {selectedRole === r.id && <Check size={12} className="text-emerald-400" />}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </div>

                {selectedRoleDef && (
                  <div className="mt-2 flex items-start gap-1.5 rounded-md bg-[rgba(255,255,255,0.02)] px-2.5 py-2">
                    <Info size={11} className="mt-0.5 shrink-0 text-zinc-600" />
                    <p className="text-[10px] leading-relaxed text-zinc-600">
                      {selectedRoleDef.description}
                    </p>
                  </div>
                )}
              </div>

              {/* Step 3: Branch */}
              <div>
                <label className="mb-2 block text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                  Branch
                </label>
                <div className="flex gap-2">
                  {branches.map((branch) => {
                    const isSelected = selectedBranches.includes(branch);
                    return (
                      <button
                        key={branch}
                        onClick={() => toggleBranch(branch)}
                        className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-[12px] font-medium transition-all ${
                          isSelected
                            ? "border-[rgba(0,230,118,0.3)] bg-[rgba(0,230,118,0.08)] text-[#00E676]"
                            : "border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] text-zinc-500 hover:border-[rgba(255,255,255,0.12)] hover:text-zinc-300"
                        }`}
                      >
                        <div className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${
                          isSelected ? "border-[#00E676] bg-[#00E676]" : "border-zinc-700 bg-transparent"
                        }`}>
                          {isSelected && <Check size={10} className="text-white" />}
                        </div>
                        {branch}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-[rgba(255,255,255,0.06)] px-6 py-4">
              <p className="text-[11px] text-zinc-600">
                {emails.length > 0 ? `${emails.length} invite${emails.length > 1 ? "s" : ""} ready` : "Paste or type email addresses"}
              </p>

              <button
                onClick={handleSend}
                disabled={emails.length === 0 || sending || sent}
                className={`flex items-center gap-2 rounded-lg px-5 py-2 text-[12px] font-semibold transition-all ${
                  sent
                    ? "bg-emerald-500 text-white"
                    : emails.length === 0
                    ? "cursor-not-allowed bg-zinc-800 text-zinc-600"
                    : "bg-gradient-to-r from-[#00E676] to-[#00C853] text-black shadow-[0_0_20px_-4px_rgba(0,230,118,0.4)] hover:shadow-[0_0_30px_-4px_rgba(0,230,118,0.5)]"
                }`}
              >
                {sent ? (
                  <>
                    <Check size={14} />
                    Sent!
                  </>
                ) : sending ? (
                  <>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    >
                      <Send size={14} />
                    </motion.div>
                    Sending...
                  </>
                ) : (
                  <>
                    <Send size={14} />
                    Send Invites
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

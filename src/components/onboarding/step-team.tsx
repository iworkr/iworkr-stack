"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef, useEffect } from "react";
import { X, Send } from "lucide-react";
import { useOnboardingStore } from "@/lib/onboarding-store";
import { inviteEmailSchema } from "@/lib/validation";

export function StepTeam() {
  const { teamInvites, addTeamInvite, removeTeamInvite, advanceStep } =
    useOnboardingStore();
  const [inputValue, setInputValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function tryAddEmail(raw: string) {
    const email = raw.trim();
    if (!email) return;

    const result = inviteEmailSchema.safeParse(email);
    if (!result.success) {
      setError(result.error.issues[0].message);
      return;
    }

    // Prevent duplicates
    if (teamInvites.some((t) => t.email === email)) {
      setError("Already added");
      return;
    }

    addTeamInvite(email);
    setInputValue("");
    setError(null);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !inputValue.trim()) {
      e.preventDefault();
      advanceStep();
      return;
    }
    if (e.key === "Enter" || e.key === " " || e.key === ",") {
      e.preventDefault();
      tryAddEmail(inputValue);
    }
    if (
      e.key === "Backspace" &&
      !inputValue &&
      teamInvites.length > 0
    ) {
      removeTeamInvite(teamInvites[teamInvites.length - 1].id);
    }
  }

  // Cmd+S to skip
  useEffect(() => {
    function handleGlobalKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        advanceStep();
      }
    }
    window.addEventListener("keydown", handleGlobalKey);
    return () => window.removeEventListener("keydown", handleGlobalKey);
  }, [advanceStep]);

  return (
    <div className="space-y-8">
      {/* Question */}
      <div className="space-y-2">
        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="text-2xl font-medium tracking-tight text-zinc-100 md:text-3xl"
        >
          Who is in the van with you?
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="text-sm text-zinc-500"
        >
          iWorkr runs better when the team is connected. Invite your admins or
          field techs.
        </motion.p>
      </div>

      {/* Email chips + input */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="space-y-4"
      >
        <div
          className="flex min-h-[48px] flex-wrap items-center gap-2 border-b border-[rgba(255,255,255,0.1)] pb-3 transition-colors focus-within:border-white"
          onClick={() => inputRef.current?.focus()}
        >
          <AnimatePresence>
            {teamInvites.map((invite) => (
              <motion.span
                key={invite.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8, width: 0 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.05)] py-1 pr-1.5 pl-3 text-sm text-zinc-300"
              >
                {invite.email}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeTeamInvite(invite.id);
                  }}
                  className="flex h-4 w-4 items-center justify-center rounded-full transition-colors hover:bg-[rgba(255,255,255,0.1)]"
                >
                  <X size={10} className="text-zinc-500" />
                </button>
              </motion.span>
            ))}
          </AnimatePresence>
          <input
            ref={inputRef}
            type="email"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setError(null);
            }}
            onKeyDown={handleKeyDown}
            onBlur={() => {
              if (inputValue.trim()) tryAddEmail(inputValue);
            }}
            placeholder={
              teamInvites.length
                ? "Add another email..."
                : "name@company.com"
            }
            className="min-w-[200px] flex-1 bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-700"
          />
        </div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="text-xs text-red-400/80"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        {/* Live avatars */}
        {teamInvites.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-3"
          >
            <div className="flex -space-x-2">
              {teamInvites.slice(0, 5).map((invite) => (
                <div
                  key={invite.id}
                  className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-black bg-zinc-800 text-[10px] font-medium text-zinc-400"
                  title={invite.email}
                >
                  {invite.email[0].toUpperCase()}
                </div>
              ))}
              {teamInvites.length > 5 && (
                <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-black bg-zinc-800 text-[10px] font-medium text-zinc-400">
                  +{teamInvites.length - 5}
                </div>
              )}
            </div>
            <span className="text-xs text-zinc-600">
              {teamInvites.length} invite{teamInvites.length !== 1 ? "s" : ""}{" "}
              queued
            </span>
          </motion.div>
        )}
      </motion.div>

      {/* Actions */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="flex items-center gap-3"
      >
        <button
          onClick={() => advanceStep()}
          className="flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-black transition-all hover:bg-zinc-200"
        >
          <Send size={14} />
          {teamInvites.length > 0 ? "Send Invites" : "Continue"}
        </button>
        <button
          onClick={() => advanceStep()}
          className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm text-zinc-500 transition-colors hover:text-zinc-300"
        >
          Skip for now
          <kbd className="rounded border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] px-1.5 py-0.5 font-mono text-[9px] text-zinc-600">
            ⌘S
          </kbd>
        </button>
      </motion.div>
    </div>
  );
}

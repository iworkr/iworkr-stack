/**
 * @component ChangeScopeModal
 * @status COMPLETE
 * @description Modal for changing NDIS service scope with branching/versioning controls
 * @lastAudit 2026-03-22
 */
/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { motion, AnimatePresence } from "framer-motion";
import { GitBranch, Repeat, X } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";

/* ── Types ────────────────────────────────────────────── */

interface ChangeScopeModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (scope: "this_only" | "all_future") => void;
  changeDescription: string; // e.g., "Replace Jane Smith with Bob Jones"
}

type Scope = "this_only" | "all_future";

/* ── Constants ────────────────────────────────────────── */

const CARE_BLUE = "#3B82F6";

const ease = [0.16, 1, 0.3, 1] as const;

const SCOPE_OPTIONS: {
  value: Scope;
  label: string;
  subtitle: string;
  icon: typeof GitBranch;
}[] = [
  {
    value: "this_only",
    label: "This shift only",
    subtitle:
      "Leaves the Master Roster intact. Only this specific shift will be modified.",
    icon: GitBranch,
  },
  {
    value: "all_future",
    label: "All future shifts",
    subtitle:
      "Updates the Master Roster template. All future generated shifts from this template will use the new configuration.",
    icon: Repeat,
  },
];

/* ── Main Modal ───────────────────────────────────────── */

export function ChangeScopeModal({
  open,
  onClose,
  onConfirm,
  changeDescription,
}: ChangeScopeModalProps) {
  const [scope, setScope] = useState<Scope>("this_only");
  const modalRef = useRef<HTMLDivElement>(null);

  // Reset state on open
  useEffect(() => {
    if (open) setScope("this_only");
  }, [open]);

  // Escape to close
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  // Focus trap
  useEffect(() => {
    if (!open) return;
    const modal = modalRef.current;
    if (!modal) return;

    function handleTab(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const focusable = modal!.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", handleTab);
    return () => window.removeEventListener("keydown", handleTab);
  }, [open]);

  const handleApply = useCallback(() => {
    onConfirm(scope);
    onClose();
  }, [scope, onConfirm, onClose]);

  if (typeof document === "undefined") return null;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 backdrop-blur-xl bg-black/80"
            onClick={onClose}
            aria-hidden
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              ref={modalRef}
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 4 }}
              transition={{ duration: 0.2, ease }}
              className="flex max-h-[85vh] w-full max-w-md flex-col bg-[#0A0A0A] border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="Apply change scope"
            >
              {/* ── Header ── */}
              <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4">
                <div>
                  <h2 className="font-display text-[17px] font-semibold tracking-tight text-white">
                    Apply Change
                  </h2>
                  <p className="mt-1 text-[12px] text-zinc-500">
                    Choose how this change should be applied
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="shrink-0 rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-white/5 hover:text-white"
                  aria-label="Close"
                >
                  <X size={14} />
                </button>
              </div>

              {/* ── Body ── */}
              <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-5">
                {/* Change description */}
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                  <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 mb-1">
                    Pending Change
                  </p>
                  <p className="text-[13px] text-zinc-300 leading-relaxed">
                    {changeDescription}
                  </p>
                </div>

                {/* Scope options */}
                <div className="space-y-3">
                  {SCOPE_OPTIONS.map((option) => {
                    const isSelected = scope === option.value;
                    const Icon = option.icon;

                    return (
                      <motion.button
                        key={option.value}
                        type="button"
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setScope(option.value)}
                        className={`w-full text-left rounded-xl border p-4 transition-all ${
                          isSelected
                            ? "border-[#3B82F6]/40 bg-[#3B82F6]/[0.06] ring-1 ring-[#3B82F6]/20"
                            : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.03]"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {/* Radio dot */}
                          <div
                            className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                              isSelected
                                ? "border-[#3B82F6]"
                                : "border-zinc-600"
                            }`}
                          >
                            {isSelected && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{
                                  type: "spring",
                                  stiffness: 500,
                                  damping: 25,
                                }}
                                className="h-2 w-2 rounded-full bg-[#3B82F6]"
                              />
                            )}
                          </div>

                          {/* Content */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <Icon
                                size={14}
                                className={
                                  isSelected
                                    ? "text-[#3B82F6]"
                                    : "text-zinc-500"
                                }
                              />
                              <span
                                className={`text-[13px] font-medium ${
                                  isSelected ? "text-white" : "text-zinc-300"
                                }`}
                              >
                                {option.label}
                              </span>
                            </div>
                            <p className="mt-1.5 text-[12px] text-zinc-500 leading-relaxed">
                              {option.subtitle}
                            </p>
                          </div>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>

                {/* Warning for "all_future" */}
                <AnimatePresence>
                  {scope === "all_future" && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.15 }}
                      className="overflow-hidden"
                    >
                      <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3 flex items-start gap-2.5">
                        <span className="text-amber-400 text-[13px] mt-0.5 shrink-0">
                          ⚡
                        </span>
                        <p className="text-[12px] text-amber-200/80 leading-relaxed">
                          This will update the Master Roster template and all
                          future shifts that have not been completed or cancelled.
                          Past shifts remain unchanged.
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* ── Footer ── */}
              <div className="flex items-center justify-end gap-3 border-t border-zinc-800 px-6 py-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-[13px] font-medium text-zinc-400 transition-colors hover:bg-white/5 hover:text-white"
                  style={{ borderRadius: "var(--radius-button)" }}
                >
                  Cancel
                </button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleApply}
                  className="flex items-center gap-2 px-5 py-2.5 text-[13px] font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98]"
                  style={{
                    borderRadius: "var(--radius-button)",
                    backgroundColor: CARE_BLUE,
                  }}
                >
                  Apply
                </motion.button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

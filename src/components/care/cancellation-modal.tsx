"use client";

import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, CheckCircle2, X, Loader2, Ban } from "lucide-react";
import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { cancelShiftWithNDISLogic } from "@/app/actions/roster-templates";

/* ── Types ────────────────────────────────────────────── */

interface CancellationModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (result: {
    cancellation_type: string;
    is_short_notice: boolean;
  }) => void;
  blockId: string;
  orgId: string;
  shiftStart: string; // ISO datetime
  participantName: string;
  workerName: string;
}

/* ── Constants ────────────────────────────────────────── */

const NDIS_SHORT_NOTICE_DAYS = 7;
const CRIMSON_MUTED = "rgba(220, 38, 38, 0.12)";
const CARE_BLUE = "#3B82F6";

const ease = [0.16, 1, 0.3, 1] as const;

/* ── Toggle Switch ────────────────────────────────────── */

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-3 w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-left transition-colors hover:bg-white/[0.04]"
    >
      <div
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
          checked ? "bg-[#DC2626]" : "bg-zinc-700"
        }`}
      >
        <motion.div
          animate={{ x: checked ? 16 : 2 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm"
        />
      </div>
      <span className="text-[13px] text-zinc-300">{label}</span>
    </button>
  );
}

/* ── Main Modal ───────────────────────────────────────── */

export function CancellationModal({
  open,
  onClose,
  onConfirm,
  blockId,
  orgId,
  shiftStart,
  participantName,
  workerName,
}: CancellationModalProps) {
  const [reason, setReason] = useState("");
  const [claimNDIS, setClaimNDIS] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Calculate days until shift
  const daysUntilShift = useMemo(() => {
    return Math.floor(
      (new Date(shiftStart).getTime() - Date.now()) / 86400000
    );
  }, [shiftStart]);

  const isShortNotice = daysUntilShift < NDIS_SHORT_NOTICE_DAYS;

  // Reset state on open/close
  useEffect(() => {
    if (open) {
      setReason("");
      setClaimNDIS(isShortNotice);
      setError(null);
      setLoading(false);
      // Focus the textarea on open
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [open, isShortNotice]);

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

  const handleConfirm = useCallback(async () => {
    if (!reason.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const result = await cancelShiftWithNDISLogic(
        blockId,
        orgId,
        reason.trim(),
        isShortNotice ? claimNDIS : false
      );

      if (!result.success) {
        setError(result.error || "Failed to cancel shift.");
        setLoading(false);
        return;
      }

      onConfirm({
        cancellation_type: result.cancellation_type,
        is_short_notice: result.is_short_notice,
      });
      onClose();
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }, [blockId, orgId, reason, isShortNotice, claimNDIS, onConfirm, onClose]);

  const formattedDate = useMemo(() => {
    return new Intl.DateTimeFormat("en-AU", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(shiftStart));
  }, [shiftStart]);

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
              className="flex max-h-[85vh] w-full max-w-lg flex-col bg-[#0A0A0A] border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label={
                isShortNotice
                  ? "Short notice NDIS cancellation"
                  : "Standard cancellation"
              }
            >
              {/* ── Header ── */}
              <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                      isShortNotice
                        ? "bg-red-500/10 ring-1 ring-red-500/20"
                        : "bg-blue-500/10 ring-1 ring-blue-500/20"
                    }`}
                  >
                    {isShortNotice ? (
                      <AlertTriangle size={18} className="text-red-500" />
                    ) : (
                      <Ban size={18} style={{ color: CARE_BLUE }} />
                    )}
                  </div>
                  <div>
                    <h2 className="font-display text-[17px] font-semibold tracking-tight text-white">
                      Cancel Shift
                    </h2>
                    <p className="text-[12px] text-zinc-500">{formattedDate}</p>
                  </div>
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
                {/* Context */}
                <div className="flex items-center gap-4 px-4 py-3 rounded-lg border border-white/[0.06] bg-white/[0.02]">
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 mb-0.5">
                      Participant
                    </p>
                    <p className="text-[13px] text-zinc-300 truncate">
                      {participantName}
                    </p>
                  </div>
                  <div className="h-8 w-px bg-white/[0.06]" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-mono uppercase tracking-wider text-zinc-500 mb-0.5">
                      Worker
                    </p>
                    <p className="text-[13px] text-zinc-300 truncate">
                      {workerName}
                    </p>
                  </div>
                </div>

                {/* ── Short Notice Warning ── */}
                {isShortNotice ? (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 }}
                    className="rounded-xl border border-red-500/20 p-4"
                    style={{ backgroundColor: CRIMSON_MUTED }}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle
                        size={14}
                        className="text-red-500 shrink-0"
                      />
                      <span className="text-[13px] font-bold tracking-wide text-red-400 uppercase">
                        ⚠ Short Notice Cancellation
                      </span>
                    </div>
                    <p className="text-[13px] text-zinc-300 leading-relaxed mb-4">
                      This shift starts in{" "}
                      <strong className="text-white">
                        {daysUntilShift} day{daysUntilShift !== 1 ? "s" : ""}
                      </strong>
                      . Under NDIS Pricing Arrangements, a Short Notice
                      Cancellation applies.
                    </p>
                    <div className="space-y-2">
                      <div className="flex items-start gap-2">
                        <span className="text-red-400 text-[13px] mt-px">•</span>
                        <span className="text-[13px] text-zinc-300">
                          Worker{" "}
                          <strong className="text-white">
                            WILL still be paid
                          </strong>{" "}
                          for this shift
                        </span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-red-400 text-[13px] mt-px">•</span>
                        <span className="text-[13px] text-zinc-300">
                          NDIS claim{" "}
                          <strong className="text-white">
                            WILL be generated
                          </strong>{" "}
                          (cancellation code)
                        </span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-red-400 text-[13px] mt-px">•</span>
                        <span className="text-[13px] text-zinc-300">
                          Budget will{" "}
                          <strong className="text-white">NOT be released</strong>
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  /* ── Standard Cancellation ── */
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 }}
                    className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4"
                  >
                    <p className="text-[13px] text-zinc-300 leading-relaxed mb-4">
                      This cancellation is more than 7 days before the shift.
                      Standard cancellation rules apply.
                    </p>
                    <div className="space-y-2">
                      <div className="flex items-start gap-2">
                        <span className="text-emerald-400 text-[13px] mt-px">
                          ✓
                        </span>
                        <span className="text-[13px] text-zinc-300">
                          Worker will be unassigned
                        </span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-emerald-400 text-[13px] mt-px">
                          ✓
                        </span>
                        <span className="text-[13px] text-zinc-300">
                          Quarantined budget will be released
                        </span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-emerald-400 text-[13px] mt-px">
                          ✓
                        </span>
                        <span className="text-[13px] text-zinc-300">
                          No NDIS claim will be generated
                        </span>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* ── NDIS Claim Toggle (short notice only) ── */}
                {isShortNotice && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                  >
                    <Toggle
                      checked={claimNDIS}
                      onChange={setClaimNDIS}
                      label="Claim against NDIS?"
                    />
                  </motion.div>
                )}

                {/* ── Cancellation Reason ── */}
                <div>
                  <label className="mb-1.5 block text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                    Cancellation Reason{" "}
                    <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    ref={textareaRef}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                    placeholder="Why is this shift being cancelled?"
                    className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-[13px] text-zinc-300 placeholder:text-zinc-600 outline-none resize-none transition-colors focus:border-zinc-600"
                    style={{ borderRadius: "var(--radius-input)" }}
                  />
                </div>

                {/* ── Error ── */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="rounded-lg border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-[13px] text-red-400"
                  >
                    {error}
                  </motion.div>
                )}
              </div>

              {/* ── Footer ── */}
              <div className="flex items-center justify-between gap-3 border-t border-zinc-800 px-6 py-4">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="px-4 py-2 text-[13px] font-medium text-zinc-400 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-50"
                  style={{ borderRadius: "var(--radius-button)" }}
                >
                  Keep Shift
                </button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleConfirm}
                  disabled={!reason.trim() || loading}
                  className={`flex items-center gap-2 px-5 py-2.5 text-[13px] font-semibold transition-all disabled:opacity-40 disabled:pointer-events-none ${
                    isShortNotice
                      ? "bg-red-600 text-white hover:bg-red-500"
                      : "bg-white text-black hover:bg-zinc-200"
                  }`}
                  style={{ borderRadius: "var(--radius-button)" }}
                >
                  {loading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : isShortNotice ? (
                    <AlertTriangle size={14} />
                  ) : (
                    <CheckCircle2 size={14} />
                  )}
                  {isShortNotice ? "Cancel & Claim NDIS" : "Cancel Shift"}
                </motion.button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

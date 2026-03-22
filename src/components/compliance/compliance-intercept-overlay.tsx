/**
 * @component ComplianceInterceptOverlay
 * @status COMPLETE
 * @description Full-screen compliance intercept overlay with expandable violation details and resolution actions
 * @lastAudit 2026-03-22
 */
"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  X,
  Lock,
  FileText,
  Wrench,
} from "lucide-react";
import type { Violation, ComplianceEvaluation } from "@/lib/schemas/solon-law";
import { overrideViolation } from "@/app/actions/solon-law";
import { useToastStore } from "@/components/app/action-toast";

interface ComplianceInterceptOverlayProps {
  open: boolean;
  evaluation: ComplianceEvaluation | null;
  logId?: string;
  orgId: string;
  complianceMode: "ADVISORY" | "HARD_STOP";
  onClose: () => void;
  onProceed: () => void;
  onEdit: () => void;
}

function SeverityBadge({ severity }: { severity?: string }) {
  const colors: Record<string, string> = {
    CRITICAL: "bg-rose-500/15 text-rose-400 border-rose-500/30",
    HIGH: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    MEDIUM: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
    LOW: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  };
  const s = severity ?? "MEDIUM";
  return (
    <span className={`px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest rounded border ${colors[s] ?? colors.MEDIUM}`}>
      {s}
    </span>
  );
}

function ViolationCard({ v, index }: { v: Violation; index: number }) {
  const [expanded, setExpanded] = useState(true);
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      className="border border-rose-500/20 bg-rose-500/5 rounded-lg overflow-hidden"
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-rose-500/10 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-rose-500/10 rounded">
            <FileText size={14} className="text-rose-400" />
          </div>
          <span className="text-sm font-medium text-white">{v.clause_reference}</span>
          <SeverityBadge severity={v.severity} />
        </div>
        {expanded ? <ChevronUp size={14} className="text-neutral-500" /> : <ChevronDown size={14} className="text-neutral-500" />}
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-neutral-500 mb-1">Violation</p>
                <p className="text-sm text-neutral-300 leading-relaxed">{v.human_explanation}</p>
              </div>
              <div className="flex items-start gap-2 p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-lg">
                <Wrench size={14} className="text-emerald-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-emerald-500 mb-1">Recommended Fix</p>
                  <p className="text-sm text-emerald-300">{v.actionable_fix}</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function ComplianceInterceptOverlay({
  open,
  evaluation,
  logId,
  orgId,
  complianceMode,
  onClose,
  onProceed,
  onEdit,
}: ComplianceInterceptOverlayProps) {
  const [overrideReason, setOverrideReason] = useState("");
  const [showOverride, setShowOverride] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const toast = useToastStore();

  if (!evaluation || evaluation.is_compliant) return null;

  const isHardStop = complianceMode === "HARD_STOP";
  const violations = evaluation.violations ?? [];

  const handleOverride = async () => {
    if (!logId || !overrideReason.trim()) return;
    setSubmitting(true);
    const res = await overrideViolation(orgId, logId, overrideReason.trim());
    setSubmitting(false);
    if (res.error) {
      toast.addToast(res.error, undefined, "error");
    } else {
      toast.addToast("Violation override recorded. Proceeding.");
      onProceed();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
            onClick={isHardStop ? undefined : onClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="w-full max-w-xl bg-[#0A0A0A] border border-rose-500/30 rounded-xl shadow-2xl shadow-rose-500/5 overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-rose-500/20 bg-rose-500/5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-rose-500/15 rounded-lg">
                    <ShieldAlert size={20} className="text-rose-400" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-white">Regulatory Violation Detected</h2>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      {violations.length} violation{violations.length !== 1 ? "s" : ""} found • Mode: {isHardStop ? "Hard Stop" : "Advisory"}
                    </p>
                  </div>
                </div>
                {!isHardStop && (
                  <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors">
                    <X size={16} className="text-neutral-500" />
                  </button>
                )}
              </div>

              {/* Violations */}
              <div className="px-5 py-4 space-y-3 max-h-[400px] overflow-y-auto">
                {violations.map((v, i) => (
                  <ViolationCard key={i} v={v} index={i} />
                ))}
              </div>

              {/* Confidence note */}
              {evaluation.confidence_flag === "LOW" && (
                <div className="mx-5 mb-3 flex items-center gap-2 p-2.5 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                  <AlertTriangle size={14} className="text-amber-400 shrink-0" />
                  <p className="text-xs text-amber-300">Low confidence evaluation — regulatory context may be incomplete. Manual review recommended.</p>
                </div>
              )}

              {/* Override section (Advisory mode only) */}
              {!isHardStop && showOverride && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  className="px-5 pb-3 overflow-hidden"
                >
                  <textarea
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    placeholder="Provide a reason for overriding this compliance warning..."
                    className="w-full h-20 px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-neutral-600 resize-none focus:outline-none focus:border-emerald-500/40"
                  />
                </motion.div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-between px-5 py-4 border-t border-white/5 bg-[#050505]">
                <button
                  onClick={onEdit}
                  className="px-4 py-2 text-sm font-medium text-white bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors"
                >
                  Edit &amp; Fix
                </button>
                <div className="flex gap-2">
                  {isHardStop ? (
                    <div className="flex items-center gap-2 px-4 py-2 text-sm text-neutral-500 bg-white/3 border border-white/5 rounded-lg cursor-not-allowed">
                      <Lock size={14} />
                      <span>Blocked — Fix Required</span>
                    </div>
                  ) : showOverride ? (
                    <button
                      onClick={handleOverride}
                      disabled={submitting || !overrideReason.trim()}
                      className="px-4 py-2 text-sm font-medium text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-lg hover:bg-rose-500/20 transition-colors disabled:opacity-40"
                    >
                      {submitting ? "Recording..." : "Acknowledge Risk & Proceed"}
                    </button>
                  ) : (
                    <button
                      onClick={() => setShowOverride(true)}
                      className="px-4 py-2 text-sm font-medium text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg hover:bg-amber-500/20 transition-colors"
                    >
                      Override AI
                    </button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ── Inline check for use in Save buttons ─────────── */

interface ComplianceBadgeProps {
  result: "COMPLIANT" | "VIOLATION_DETECTED" | "LOW_CONFIDENCE" | "ERROR" | null;
}

export function ComplianceBadge({ result }: ComplianceBadgeProps) {
  if (!result) return null;
  if (result === "COMPLIANT") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
        <ShieldCheck size={12} /> Compliant
      </span>
    );
  }
  if (result === "VIOLATION_DETECTED") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-full animate-pulse">
        <ShieldAlert size={12} /> Violation
      </span>
    );
  }
  if (result === "LOW_CONFIDENCE") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full">
        <AlertTriangle size={12} /> Low Confidence
      </span>
    );
  }
  return null;
}

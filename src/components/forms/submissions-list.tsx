"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Lock,
  Clock,
  AlertCircle,
  FileText,
  MapPin,
  Fingerprint,
  ArrowRight,
  Shield,
  Plus,
  ClipboardCheck,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormSubmission } from "@/lib/forms-data";

/* ── Status Config ────────────────────────────────────── */

const statusConfig = {
  signed: {
    icon: Lock,
    label: "Signed",
    dot: "bg-emerald-500",
    text: "text-zinc-500",
  },
  pending: {
    icon: Clock,
    label: "Pending",
    dot: "bg-amber-500",
    text: "text-zinc-500",
  },
  expired: {
    icon: AlertCircle,
    label: "Expired",
    dot: "bg-rose-500",
    text: "text-rose-400",
  },
};

/* ── Forensic Hex ID ─────────────────────────────────── */

function forensicId(id: string): string {
  const hash = id.replace(/[^a-f0-9]/gi, "").slice(0, 8).padEnd(8, "0");
  return `fx_0x${hash}`;
}

/* ── Empty State ─────────────────────────────────────── */

function SubmissionsEmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col items-center justify-center py-20 text-center"
    >
      <div className="relative mb-5 flex h-16 w-16 items-center justify-center">
        <div className="absolute inset-0 rounded-xl border border-white/[0.04] animate-signal-pulse" />
        <div className="absolute inset-2 rounded-lg border border-white/[0.03] animate-signal-pulse" style={{ animationDelay: "0.5s" }} />
        <motion.div
          className="absolute inset-x-2 h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent"
          animate={{ top: ["25%", "75%", "25%"] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.02]">
          <ClipboardCheck size={16} strokeWidth={1.5} className="text-zinc-600" />
        </div>
      </div>
      <h3 className="text-[14px] font-medium text-zinc-300">No submissions yet</h3>
      <p className="mt-1 max-w-[280px] text-[12px] text-zinc-600">
        Completed forms will appear here with full forensic audit trails.
      </p>
    </motion.div>
  );
}

/* ── Submissions List (Forensic Log) ─────────────────── */

interface SubmissionsListProps {
  submissions: FormSubmission[];
}

export function SubmissionsList({ submissions }: SubmissionsListProps) {
  const router = useRouter();

  if (submissions.length === 0) {
    return <SubmissionsEmptyState />;
  }

  return (
    <div>
      {/* Column headers */}
      <div className="flex items-center border-b border-white/[0.04] bg-[#0A0A0A] px-4 py-1.5 rounded-t-lg">
        <div className="w-6" />
        <div className="w-28 px-2 text-[10px] font-medium tracking-wider text-zinc-600 uppercase">Trace ID</div>
        <div className="min-w-0 flex-1 px-2 text-[10px] font-medium tracking-wider text-zinc-600 uppercase">Form</div>
        <div className="w-28 px-2 text-[10px] font-medium tracking-wider text-zinc-600 uppercase">Submitted By</div>
        <div className="w-28 px-2 text-[10px] font-medium tracking-wider text-zinc-600 uppercase">Reference</div>
        <div className="w-28 px-2 text-[10px] font-medium tracking-wider text-zinc-600 uppercase">Date</div>
        <div className="w-20 px-2 text-[10px] font-medium tracking-wider text-zinc-600 uppercase">Audit</div>
        <div className="w-8" />
      </div>

      {/* Rows */}
      <AnimatePresence>
        {submissions.map((sub, i) => {
          const status = statusConfig[sub.status];

          return (
            <motion.div
              key={sub.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.3), duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              onClick={() => router.push(`/dashboard/forms/submission/${sub.id}`)}
              className="group flex cursor-pointer items-center border-b border-white/[0.03] px-4 transition-colors duration-100 hover:bg-white/[0.02]"
              style={{ height: 42 }}
            >
              {/* Status dot */}
              <div className="w-6">
                <span className={`inline-block h-[6px] w-[6px] rounded-full ${status.dot}`} />
              </div>

              {/* Forensic Trace ID */}
              <div className="w-28 px-2 font-mono text-[10px] text-zinc-600 transition-colors group-hover:text-zinc-400">
                {forensicId(sub.id)}
              </div>

              {/* Form title */}
              <div className="min-w-0 flex-1 px-2">
                <span className="truncate text-[12px] font-medium text-zinc-300 transition-colors group-hover:text-white">
                  {sub.formTitle}
                </span>
              </div>

              {/* Submitted by */}
              <div className="w-28 px-2 flex items-center gap-1.5">
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-[7px] font-semibold text-zinc-400">
                  {sub.submittedByInitials}
                </div>
                <span className="truncate text-[10px] text-zinc-500">{sub.submittedBy.split(" ")[0]}</span>
              </div>

              {/* Job / Client ref */}
              <div className="w-28 px-2">
                {sub.jobRef ? (
                  <span className="font-mono text-[10px] text-zinc-600">{sub.jobRef}</span>
                ) : sub.clientName ? (
                  <span className="truncate text-[10px] text-zinc-600">{sub.clientName}</span>
                ) : (
                  <span className="text-[10px] text-zinc-700">—</span>
                )}
              </div>

              {/* Date */}
              <div className="w-28 px-2 text-[10px] text-zinc-600">{sub.submittedAt}</div>

              {/* Audit indicators */}
              <div className="w-20 px-2 flex items-center gap-1">
                {sub.telemetry ? (
                  <>
                    <div className="flex h-4 w-4 items-center justify-center rounded bg-white/[0.03]" title="GPS Verified">
                      <MapPin size={8} className="text-emerald-500" />
                    </div>
                    <div className="flex h-4 w-4 items-center justify-center rounded bg-white/[0.03]" title="Device Fingerprint">
                      <Fingerprint size={8} className="text-emerald-400" />
                    </div>
                    <div className="flex h-4 w-4 items-center justify-center rounded bg-white/[0.03]" title="SHA-256">
                      <Shield size={8} className="text-zinc-500" />
                    </div>
                  </>
                ) : (
                  <span className="text-[9px] text-zinc-700">Pending</span>
                )}
              </div>

              {/* Arrow */}
              <div className="w-8 text-right">
                <ArrowRight size={11} className="text-zinc-700 opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

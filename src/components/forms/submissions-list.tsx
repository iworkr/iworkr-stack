"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Lock,
  Clock,
  AlertCircle,
  ExternalLink,
  FileText,
  MapPin,
  Fingerprint,
  ChevronRight,
  Download,
  Shield,
  CheckCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormSubmission } from "@/lib/forms-data";

/* ── Status Config ────────────────────────────────────── */

const statusConfig = {
  signed: {
    icon: Lock,
    label: "Signed & Locked",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    dot: "bg-emerald-500",
  },
  pending: {
    icon: Clock,
    label: "Pending",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    dot: "bg-amber-500",
  },
  expired: {
    icon: AlertCircle,
    label: "Expired",
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
    dot: "bg-red-500",
  },
};

/* ── Submissions List ─────────────────────────────────── */

interface SubmissionsListProps {
  submissions: FormSubmission[];
}

export function SubmissionsList({ submissions }: SubmissionsListProps) {
  const router = useRouter();

  if (submissions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <FileText size={28} strokeWidth={0.8} className="mb-3 text-zinc-800" />
        <p className="text-[13px] text-zinc-500">No submissions yet.</p>
        <p className="mt-1 text-[11px] text-zinc-700">
          Completed forms will appear here with full forensic audit trails.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Table header */}
      <div className="grid grid-cols-12 gap-3 px-4 py-2 text-[10px] font-medium uppercase tracking-wider text-zinc-700">
        <span className="col-span-1">Status</span>
        <span className="col-span-3">Form</span>
        <span className="col-span-2">Submitted By</span>
        <span className="col-span-2">Job / Client</span>
        <span className="col-span-2">Date</span>
        <span className="col-span-1">Audit</span>
        <span className="col-span-1"></span>
      </div>

      {/* Rows */}
      <AnimatePresence>
        {submissions.map((sub, i) => {
          const status = statusConfig[sub.status];
          const StatusIcon = status.icon;

          return (
            <motion.div
              key={sub.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              onClick={() => router.push(`/dashboard/forms/submission/${sub.id}`)}
              className="group grid cursor-pointer grid-cols-12 items-center gap-3 rounded-lg border border-transparent px-4 py-3 transition-all duration-200 hover:border-[rgba(255,255,255,0.08)] hover:bg-[rgba(255,255,255,0.02)]"
            >
              {/* Status */}
              <div className="col-span-1 flex items-center">
                <div className={`flex h-6 w-6 items-center justify-center rounded-md ${status.bg}`}>
                  <StatusIcon size={12} className={status.color} />
                </div>
              </div>

              {/* Form title */}
              <div className="col-span-3">
                <p className="truncate text-[12px] font-medium text-zinc-200">
                  {sub.formTitle}
                </p>
                <p className="text-[10px] text-zinc-600">v{sub.formVersion}</p>
              </div>

              {/* Submitted by */}
              <div className="col-span-2 flex items-center gap-2">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-zinc-700 to-zinc-800 text-[8px] font-bold text-zinc-400">
                  {sub.submittedByInitials}
                </div>
                <span className="truncate text-[11px] text-zinc-400">{sub.submittedBy}</span>
              </div>

              {/* Job / Client */}
              <div className="col-span-2">
                {sub.jobRef && (
                  <span className="font-mono text-[10px] text-zinc-500">{sub.jobRef}</span>
                )}
                {sub.clientName && (
                  <p className="truncate text-[10px] text-zinc-600">{sub.clientName}</p>
                )}
                {!sub.jobRef && !sub.clientName && (
                  <span className="text-[10px] text-zinc-700">—</span>
                )}
              </div>

              {/* Date */}
              <div className="col-span-2">
                <p className="text-[11px] text-zinc-400">{sub.submittedAt}</p>
              </div>

              {/* Audit indicators */}
              <div className="col-span-1 flex items-center gap-1">
                {sub.telemetry && (
                  <>
                    <div className="flex h-4 w-4 items-center justify-center rounded bg-[rgba(255,255,255,0.04)]" title="GPS Verified">
                      <MapPin size={8} className="text-emerald-500" />
                    </div>
                    <div className="flex h-4 w-4 items-center justify-center rounded bg-[rgba(255,255,255,0.04)]" title="Device Fingerprint">
                      <Fingerprint size={8} className="text-[#00E676]" />
                    </div>
                    <div className="flex h-4 w-4 items-center justify-center rounded bg-[rgba(255,255,255,0.04)]" title="SHA-256 Hashed">
                      <Shield size={8} className="text-zinc-400" />
                    </div>
                  </>
                )}
                {!sub.telemetry && (
                  <span className="text-[9px] text-zinc-700">Pending</span>
                )}
              </div>

              {/* Action */}
              <div className="col-span-1 flex justify-end">
                <ChevronRight
                  size={14}
                  className="text-zinc-700 transition-colors group-hover:text-zinc-400"
                />
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

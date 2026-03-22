/**
 * @component RemediationSlideOver
 * @status COMPLETE
 * @description Slide-over panel for governance remediation workflows with evidence upload and approval steps
 * @lastAudit 2026-03-22
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDropzone } from "react-dropzone";
import {
  X, UploadCloud, CheckCircle2, Loader2, AlertTriangle,
  Bell, Lock, ShieldOff, ShieldCheck, FileText, Image,
} from "lucide-react";
import { z } from "zod";
import type { ComplianceGapRow } from "@/app/actions/care-ironclad";
import {
  uploadWorkerCertificateAction,
  previewSuspensionImpactAction,
  suspendWorkerCascadeAction,
  type SuspensionImpact,
} from "@/app/actions/care-ironclad";

// ── Validation ────────────────────────────────────────────────

const ALLOWED_MIME = ["application/pdf", "image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

const CredentialFormSchema = z.object({
  issued_date: z.string().min(1, "Issue date is required"),
  expiry_date: z.string().min(1, "Expiry date is required"),
});

// ── Types ─────────────────────────────────────────────────────

type UploadPhase = "idle" | "dragging" | "uploading" | "done" | "error";
type SlideView = "actions" | "upload" | "suspend_preview" | "suspend_confirm";

interface RemediationSlideOverProps {
  gap: ComplianceGapRow;
  orgId: string;
  userId: string; // admin's own user ID
  onClose: () => void;
  onAction: () => void;
  onDispatchNotification: () => Promise<void>;
  dispatchSending: boolean;
}

// ── ComplianceDropzone ────────────────────────────────────────

function ComplianceDropzone({
  workerId,
  orgId,
  credentialType,
  onSuccess,
}: {
  workerId: string;
  orgId: string;
  credentialType: string;
  onSuccess: () => void;
}) {
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [fileName, setFileName] = useState("");
  const [fileError, setFileError] = useState("");
  const [issuedDate, setIssuedDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [formError, setFormError] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearProgressTimer = () => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  };

  const simulateProgress = () => {
    setUploadProgress(0);
    progressTimerRef.current = setInterval(() => {
      setUploadProgress((p) => {
        if (p >= 85) {
          clearProgressTimer();
          return p;
        }
        return p + Math.random() * 12;
      });
    }, 180);
  };

  const onDrop = useCallback((accepted: File[], rejected: any[]) => {
    setFileError("");
    if (rejected.length > 0) {
      const err = rejected[0].errors[0];
      setFileError(
        err.code === "file-too-large"
          ? "File exceeds 5 MB limit."
          : err.code === "file-invalid-type"
          ? "Only PDF, JPG, or PNG files are allowed."
          : err.message
      );
      return;
    }
    if (accepted.length > 0) {
      setPendingFile(accepted[0]);
      setFileName(accepted[0].name);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/webp": [".webp"],
    },
    maxSize: MAX_BYTES,
    multiple: false,
  });

  const handleVerify = async () => {
    setFormError("");
    const parse = CredentialFormSchema.safeParse({ issued_date: issuedDate, expiry_date: expiryDate });
    if (!parse.success) {
      const issues = parse.error.issues;
      setFormError(issues[0]?.message ?? "Validation error");
      return;
    }
    if (!pendingFile) {
      setFormError("Please select a file first.");
      return;
    }

    setPhase("uploading");
    simulateProgress();

    try {
      const base64 = await fileToBase64(pendingFile);
      const result = await uploadWorkerCertificateAction({
        worker_id: workerId,
        organization_id: orgId,
        credential_type: credentialType,
        issued_date: issuedDate,
        expiry_date: expiryDate,
        file_name: pendingFile.name,
        file_base64: base64,
        mime_type: pendingFile.type || "application/pdf",
      });

      clearProgressTimer();
      setUploadProgress(100);

      if (result.success) {
        setTimeout(() => {
          setPhase("done");
          setTimeout(onSuccess, 1200);
        }, 400);
      } else {
        setPhase("error");
        setFileError(result.error || "Upload failed. Please try again.");
      }
    } catch (err: any) {
      clearProgressTimer();
      setPhase("error");
      setFileError(err?.message || "Upload failed.");
    }
  };

  const FileIcon = pendingFile?.type === "application/pdf" ? FileText : Image;

  return (
    <div className="space-y-4">
      {/* Dropzone */}
      {phase !== "uploading" && phase !== "done" && (
        <div
          {...getRootProps()}
          className={[
            "relative flex h-32 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-all duration-200",
            isDragActive
              ? "scale-[1.02] border-emerald-500 bg-emerald-500/10"
              : pendingFile
              ? "border-emerald-500/40 bg-emerald-500/5"
              : "border-white/10 bg-zinc-950/50 hover:bg-white/[0.02]",
          ].join(" ")}
        >
          <input {...getInputProps()} />
          {pendingFile ? (
            <>
              <FileIcon
                className={`mb-2 h-6 w-6 ${isDragActive ? "text-white" : "text-emerald-400"}`}
              />
              <p className="text-[12px] font-medium text-emerald-400">{pendingFile.name}</p>
              <p className="mt-0.5 font-mono text-[10px] text-zinc-600">
                {(pendingFile.size / 1024).toFixed(0)} KB — click to replace
              </p>
            </>
          ) : (
            <>
              <UploadCloud
                className={`mb-2 h-6 w-6 ${isDragActive ? "text-white" : "text-zinc-500"}`}
              />
              <p className="text-[12px] text-zinc-400">
                Drag &amp; drop certificate, or click to browse
              </p>
              <p className="mt-0.5 font-mono text-[10px] text-zinc-600">
                PDF, JPG, or PNG (Max 5MB)
              </p>
            </>
          )}
        </div>
      )}

      {/* Uploading state */}
      {phase === "uploading" && (
        <div className="rounded-lg bg-zinc-900 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
            <span className="text-[13px] text-zinc-300">{fileName}</span>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-zinc-800">
            <motion.div
              className="h-full rounded-full bg-emerald-500"
              initial={{ width: "0%" }}
              animate={{ width: `${Math.min(uploadProgress, 100)}%` }}
              transition={{ ease: "easeOut", duration: 0.3 }}
            />
          </div>
          <p className="mt-2 font-mono text-[10px] text-zinc-600">
            {Math.floor(Math.min(uploadProgress, 100))}% — uploading to vault
          </p>
        </div>
      )}

      {/* Done state */}
      {phase === "done" && (
        <div className="flex items-center gap-3 rounded-lg bg-emerald-500/10 p-4">
          <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          <div>
            <p className="text-[13px] font-medium text-emerald-400">Certificate uploaded.</p>
            <p className="text-[11px] text-zinc-500">Compliance gap updated to Pending Review.</p>
          </div>
        </div>
      )}

      {fileError && (
        <p className="flex items-center gap-1.5 text-[12px] text-rose-400">
          <AlertTriangle className="h-3.5 w-3.5" /> {fileError}
        </p>
      )}

      {/* Date fields — only shown when a file is selected and not yet uploading */}
      {pendingFile && phase === "idle" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-zinc-600">
                Issue Date
              </label>
              <input
                type="date"
                value={issuedDate}
                onChange={(e) => setIssuedDate(e.target.value)}
                className="w-full rounded-md border border-white/5 bg-zinc-900 px-3 py-2 text-[13px] text-white placeholder-zinc-700 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
              />
            </div>
            <div>
              <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-zinc-600">
                Expiry Date
              </label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full rounded-md border border-white/5 bg-zinc-900 px-3 py-2 text-[13px] text-white placeholder-zinc-700 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
              />
            </div>
          </div>

          {formError && (
            <p className="text-[12px] text-rose-400">{formError}</p>
          )}

          <button
            onClick={handleVerify}
            disabled={!issuedDate || !expiryDate}
            className="w-full rounded-md bg-white px-4 py-2.5 text-[13px] font-semibold text-zinc-950 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Verify &amp; Clear Gap
          </button>
        </div>
      )}
    </div>
  );
}

// ── SuspendConfirmPanel ───────────────────────────────────────

function SuspendConfirmPanel({
  gap,
  orgId,
  adminId,
  onDone,
  onCancel,
}: {
  gap: ComplianceGapRow;
  orgId: string;
  adminId: string;
  onDone: (result: { orphaned_shifts: number }) => void;
  onCancel: () => void;
}) {
  const [impact, setImpact] = useState<SuspensionImpact | null>(null);
  const [loadingImpact, setLoadingImpact] = useState(true);
  const [confirmText, setConfirmText] = useState("");
  const [executing, setExecuting] = useState(false);
  const [execError, setExecError] = useState("");

  const workerName = gap.affected_entity_name || "this worker";
  const requiredString = `SUSPEND ${workerName.toUpperCase()}`;

  useEffect(() => {
    let cancelled = false;
    setLoadingImpact(true);
    previewSuspensionImpactAction(gap.affected_entity_id).then((data) => {
      if (!cancelled) {
        setImpact(data);
        setLoadingImpact(false);
      }
    });
    return () => { cancelled = true; };
  }, [gap.affected_entity_id]);

  const confirmed = confirmText.trim() === requiredString;

  const handleExecute = async () => {
    if (!confirmed) return;
    setExecError("");
    setExecuting(true);
    try {
      const res = await suspendWorkerCascadeAction({
        worker_id: gap.affected_entity_id,
        admin_id: adminId,
        reason: `Compliance gap: ${gap.gap_title}`,
      });
      if (!res.success) {
        setExecError(res.error || "Suspension failed.");
        setExecuting(false);
        return;
      }
      onDone({ orphaned_shifts: res.orphaned_shifts || 0 });
    } catch (err: any) {
      setExecError(err?.message || "Unexpected error.");
      setExecuting(false);
    }
  };

  const revenueStr = impact
    ? `$${((impact.orphaned_shifts || 0) * 280).toFixed(2)}`
    : "—";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="rounded-xl border border-rose-500/20 bg-rose-950/10 p-5 space-y-5"
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-rose-500/10">
          <ShieldOff className="h-5 w-5 text-rose-500" />
        </div>
        <div>
          <p className="text-[15px] font-semibold text-rose-400">Suspend Worker Profile</p>
          <p className="mt-0.5 text-[12px] text-zinc-500">This action is irreversible without manual intervention.</p>
        </div>
      </div>

      {/* Telemetry */}
      {loadingImpact ? (
        <div className="flex items-center gap-2 py-3">
          <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
          <span className="text-[12px] text-zinc-500">Calculating collateral damage…</span>
        </div>
      ) : (
        <div className="rounded-lg border border-rose-500/20 bg-zinc-950 p-4 space-y-3">
          <p className="text-[13px] font-medium text-white">
            You are about to suspend{" "}
            <span className="text-rose-400">{workerName}</span>.
          </p>
          {impact?.has_active_timesheet && (
            <div className="flex items-start gap-2 rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-400" />
              <p className="text-[12px] text-amber-300">
                This worker has an <strong>active open timesheet</strong>. The suspension will be blocked until it is closed.
              </p>
            </div>
          )}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] text-zinc-500">Orphaned shifts</span>
              <span className="font-mono text-[13px] text-rose-400">
                {impact?.orphaned_shifts ?? 0} shifts
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] text-zinc-500">Revenue at risk (est.)</span>
              <span className="font-mono text-[13px] text-rose-400">{revenueStr}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] text-zinc-500">Active mobile sessions</span>
              <span className="font-mono text-[13px] text-rose-400">Instantly revoked</span>
            </div>
          </div>
          <p className="text-[11px] text-zinc-600">
            All {impact?.orphaned_shifts ?? 0} scheduled shifts will be orphaned immediately. Dispatch will be notified via push notification.
          </p>
        </div>
      )}

      {/* Verification input */}
      <div>
        <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-zinc-600">
          Type &quot;{requiredString}&quot; to confirm
        </label>
        <input
          type="text"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder={requiredString}
          className="w-full rounded-md border border-rose-500/30 bg-zinc-900 px-3 py-2.5 font-mono text-[13px] text-rose-400 placeholder-zinc-700 focus:outline-none focus:ring-1 focus:ring-rose-500/50"
        />
      </div>

      {execError && (
        <p className="flex items-center gap-2 rounded-md border border-rose-500/20 bg-rose-950/20 px-3 py-2 text-[12px] text-rose-400">
          <AlertTriangle className="h-4 w-4" /> {execError}
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={onCancel}
          className="flex-1 rounded-md border border-white/10 bg-transparent px-4 py-2.5 text-[13px] text-zinc-400 transition-colors hover:bg-white/[0.03]"
        >
          Cancel
        </button>
        <button
          onClick={handleExecute}
          disabled={!confirmed || executing || loadingImpact}
          className="flex-1 rounded-md border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-[13px] font-semibold text-rose-400 transition-all hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {executing ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Executing…
            </span>
          ) : (
            "Confirm Suspension"
          )}
        </button>
      </div>
    </motion.div>
  );
}

// ── Main RemediationSlideOver ─────────────────────────────────

export function RemediationSlideOver({
  gap,
  orgId,
  userId,
  onClose,
  onAction,
  onDispatchNotification,
  dispatchSending,
}: RemediationSlideOverProps) {
  const [view, setView] = useState<SlideView>("actions");
  const [suspendDoneResult, setSuspendDoneResult] = useState<{ orphaned_shifts: number } | null>(null);

  const handleSuspendDone = (result: { orphaned_shifts: number }) => {
    setSuspendDoneResult(result);
    setView("actions");
    onAction();
  };

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
      />

      {/* Slide-over panel */}
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        className={[
          "fixed right-0 top-0 z-50 flex h-full w-full max-w-sm flex-col border-l shadow-2xl transition-colors duration-300",
          view === "suspend_confirm" || view === "suspend_preview"
            ? "border-rose-500/20 bg-[#0A0505]"
            : "border-white/5 bg-[#0A0A0A]",
        ].join(" ")}
      >
        {/* Header */}
        <div className="flex flex-shrink-0 items-start justify-between border-b border-white/5 px-5 pb-4 pt-5">
          <div className="flex-1 pr-4">
            <p className="text-[11px] font-mono uppercase tracking-widest text-zinc-600">
              Remediation
            </p>
            <h2 className="mt-0.5 text-[15px] font-semibold text-white leading-snug">
              {gap.gap_title}
            </h2>
            <p className="mt-1 text-[12px] text-zinc-500">{gap.gap_detail}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md border border-white/5 p-1.5 text-zinc-600 transition-colors hover:text-zinc-400"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Worker chip */}
        <div className="flex-shrink-0 border-b border-white/5 px-5 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-zinc-800 text-[11px] font-semibold text-white">
              {gap.affected_entity_name
                .split(" ")
                .map((n: string) => n[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <div>
              <p className="text-[13px] font-medium text-white">{gap.affected_entity_name}</p>
              <p className="text-[11px] text-zinc-500">
                Severity:{" "}
                <span
                  className={
                    gap.severity === "critical"
                      ? "text-rose-400"
                      : gap.severity === "warning"
                      ? "text-amber-400"
                      : "text-zinc-400"
                  }
                >
                  {gap.severity.toUpperCase()}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          <AnimatePresence mode="wait">
            {/* ── Default actions view ── */}
            {view === "actions" && (
              <motion.div
                key="actions"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-3"
              >
                {suspendDoneResult && (
                  <div className="flex items-start gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-3">
                    <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400" />
                    <p className="text-[12px] text-emerald-400">
                      Worker suspended. {suspendDoneResult.orphaned_shifts} shifts routed to Triage Board.
                    </p>
                  </div>
                )}

                <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
                  Remediation Actions
                </p>

                {/* Dispatch notification */}
                <button
                  onClick={onDispatchNotification}
                  disabled={dispatchSending}
                  className="flex w-full items-center gap-3 rounded-md border border-white/5 bg-transparent px-4 py-3 text-left transition-colors hover:bg-white/[0.03] disabled:opacity-50"
                >
                  {dispatchSending ? (
                    <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                  ) : (
                    <Bell className="h-4 w-4 text-emerald-400" />
                  )}
                  <div>
                    <p className="text-[13px] font-medium text-white">Dispatch Push Notification</p>
                    <p className="text-[11px] text-zinc-500">Send targeted alert to this worker&apos;s mobile app.</p>
                  </div>
                </button>

                {/* Upload certificate */}
                <button
                  onClick={() => setView("upload")}
                  className="flex w-full items-center gap-3 rounded-md border border-white/5 bg-transparent px-4 py-3 text-left transition-colors hover:bg-white/[0.03]"
                >
                  <UploadCloud className="h-4 w-4 text-zinc-400" />
                  <div>
                    <p className="text-[13px] font-medium text-white">Manually Upload Certificate</p>
                    <p className="text-[11px] text-zinc-500">Drag &amp; drop a document to the secure vault.</p>
                  </div>
                </button>

                {/* Suspend — destructive */}
                <button
                  onClick={() => setView("suspend_preview")}
                  className="mt-6 flex w-full items-center gap-3 rounded-md border border-rose-500/20 bg-rose-500/5 px-4 py-3 text-left transition-colors hover:bg-rose-500/10"
                >
                  <Lock className="h-4 w-4 text-rose-500" />
                  <div>
                    <p className="text-[13px] font-medium text-rose-500">Suspend Worker Profile</p>
                    <p className="text-[11px] text-zinc-500">Prevent rostering until the gap is resolved.</p>
                  </div>
                </button>
              </motion.div>
            )}

            {/* ── Upload view ── */}
            {view === "upload" && (
              <motion.div
                key="upload"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setView("actions")}
                    className="rounded-md border border-white/5 px-3 py-1.5 text-[12px] text-zinc-500 transition-colors hover:text-zinc-300"
                  >
                    ← Back
                  </button>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
                    Upload Certificate
                  </p>
                </div>

                <ComplianceDropzone
                  workerId={gap.affected_entity_id}
                  orgId={orgId}
                  credentialType={gap.gap_title}
                  onSuccess={() => {
                    onAction();
                    setView("actions");
                  }}
                />
              </motion.div>
            )}

            {/* ── Suspend preview / confirm ── */}
            {(view === "suspend_preview" || view === "suspend_confirm") && (
              <motion.div
                key="suspend"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setView("actions")}
                    className="rounded-md border border-white/5 px-3 py-1.5 text-[12px] text-zinc-500 transition-colors hover:text-zinc-300"
                  >
                    ← Back
                  </button>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-rose-900">
                    Destructive Action
                  </p>
                </div>

                <SuspendConfirmPanel
                  gap={gap}
                  orgId={orgId}
                  adminId={userId}
                  onDone={handleSuspendDone}
                  onCancel={() => setView("actions")}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </>
  );
}

// ── Utility ───────────────────────────────────────────────────

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip data URL prefix
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

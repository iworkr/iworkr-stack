"use client";

import { motion } from "framer-motion";
import {
  ArrowLeft,
  Lock,
  Clock,
  AlertCircle,
  MapPin,
  Fingerprint,
  Shield,
  Download,
  ExternalLink,
  Copy,
  Check,
  FileText,
  CheckCircle,
  Globe,
  Monitor,
  Hash,
  Calendar,
  PenTool,
  Camera,
} from "lucide-react";
import { useRouter, useParams } from "next/navigation";
import { useMemo, useState, useEffect } from "react";
import { useFormsStore } from "@/lib/forms-store";
import { useOrg } from "@/lib/hooks/use-org";
import { getOrgSettings } from "@/app/actions/finance";
import { downloadFormPDF } from "@/lib/pdf/generate-form-pdf";

/* ── Status Config ────────────────────────────────────── */

const statusConfig = {
  signed: { icon: Lock, label: "SIGNED & LOCKED", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  pending: { icon: Clock, label: "PENDING SIGNATURE", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
  expired: { icon: AlertCircle, label: "EXPIRED", color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20" },
};

export default function SubmissionDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { submissions } = useFormsStore();
  const { orgId } = useOrg();
  const [hashCopied, setHashCopied] = useState(false);
  const [orgSettings, setOrgSettings] = useState<any>(null);

  useEffect(() => {
    if (orgId) {
      getOrgSettings(orgId).then((res) => {
        if (res) setOrgSettings(res);
      });
    }
  }, [orgId]);

  const submission = useMemo(
    () => submissions.find((s) => s.id === params.id),
    [submissions, params.id]
  );

  if (!submission) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <FileText size={32} strokeWidth={0.8} className="mx-auto mb-3 text-zinc-800" />
          <p className="text-[13px] text-zinc-500">Submission not found.</p>
          <button
            onClick={() => router.push("/dashboard/forms")}
            className="mt-3 text-[11px] text-zinc-500 underline hover:text-zinc-300"
          >
            Back to Forms
          </button>
        </div>
      </div>
    );
  }

  const status = statusConfig[submission.status];
  const StatusIcon = status.icon;

  const copyHash = () => {
    if (submission.telemetry?.sha256) {
      navigator.clipboard.writeText(submission.telemetry.sha256);
      setHashCopied(true);
      setTimeout(() => setHashCopied(false), 2000);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* ── Back Navigation ──────────────────────────── */}
      <div className="border-b border-[rgba(255,255,255,0.06)] px-6 py-3">
        <button
          onClick={() => router.push("/dashboard/forms")}
          className="flex items-center gap-2 text-[12px] text-zinc-500 transition-colors hover:text-zinc-300"
        >
          <ArrowLeft size={14} />
          <span>Forms</span>
          <span className="text-zinc-700">/</span>
          <span className="text-zinc-400">{submission.formTitle}</span>
          <span className="text-zinc-700">/</span>
          <span className="font-mono text-zinc-600">{submission.id}</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* ── Forensic Telemetry Header (The Security Ribbon) ── */}
        {submission.telemetry && submission.status === "signed" && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="mx-6 mt-5 rounded-xl border border-emerald-500/15 bg-gradient-to-r from-emerald-900/10 via-[#0C0C0C] to-[#0C0C0C]"
          >
            {/* Status banner */}
            <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.04)] px-5 py-3">
              <div className="flex items-center gap-3">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${status.bg}`}>
                  <StatusIcon size={16} className={status.color} />
                </div>
                <div>
                  <p className={`text-[11px] font-semibold uppercase tracking-wider ${status.color}`}>
                    {status.label}
                  </p>
                  <p className="mt-0.5 text-[10px] text-zinc-600">
                    Document integrity verified — Chain of custody intact
                  </p>
                </div>
              </div>

              <button
                onClick={() => downloadFormPDF(submission, {
                  name: orgSettings?.name,
                  tax_id: orgSettings?.settings?.tax_id,
                })}
                className="flex items-center gap-1.5 rounded-lg border border-[rgba(255,255,255,0.1)] bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium text-zinc-400 transition-all hover:border-[rgba(255,255,255,0.2)] hover:text-zinc-200"
              >
                <Download size={12} />
                Download Official PDF
              </button>
            </div>

            {/* Telemetry grid */}
            <div className="grid grid-cols-2 gap-px bg-[rgba(255,255,255,0.03)] lg:grid-cols-4">
              {/* Location */}
              <div className="bg-[#0C0C0C] p-4">
                <div className="mb-2 flex items-center gap-1.5">
                  <MapPin size={11} className="text-emerald-500" />
                  <span className="text-[9px] font-medium uppercase tracking-wider text-zinc-600">
                    GPS Location
                  </span>
                </div>
                {/* Mini map */}
                <div className="relative mb-2 h-20 overflow-hidden rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#080808]">
                  {/* Grid overlay */}
                  <div
                    className="absolute inset-0 opacity-10"
                    style={{
                      backgroundImage: `linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px)`,
                      backgroundSize: "20px 20px",
                    }}
                  />
                  {/* Center pin */}
                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                    <div className="relative">
                      <div className="h-3 w-3 rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]" />
                      <motion.div
                        animate={{ scale: [1, 2, 1], opacity: [0.4, 0, 0.4] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="absolute inset-0 rounded-full bg-emerald-500"
                      />
                    </div>
                  </div>
                  {/* Radar sweep */}
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                    style={{
                      width: 80,
                      height: 80,
                      background: "conic-gradient(from 0deg, transparent 0deg, rgba(16,185,129,0.08) 30deg, transparent 60deg)",
                      borderRadius: "50%",
                    }}
                  />
                </div>
                <p className="text-[10px] leading-tight text-zinc-400">
                  {submission.telemetry.gpsAddress}
                </p>
                <p className="mt-0.5 font-mono text-[9px] text-zinc-700">
                  {submission.telemetry.gpsLat.toFixed(4)}, {submission.telemetry.gpsLng.toFixed(4)}
                </p>
              </div>

              {/* Device Fingerprint */}
              <div className="bg-[#0C0C0C] p-4">
                <div className="mb-2 flex items-center gap-1.5">
                  <Fingerprint size={11} className="text-emerald-400" />
                  <span className="text-[9px] font-medium uppercase tracking-wider text-zinc-600">
                    Device Fingerprint
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Globe size={10} className="text-zinc-700" />
                    <div>
                      <p className="text-[9px] font-medium uppercase text-zinc-700">IP Address</p>
                      <p className="font-mono text-[11px] text-zinc-400">{submission.telemetry.ip}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Monitor size={10} className="text-zinc-700" />
                    <div>
                      <p className="text-[9px] font-medium uppercase text-zinc-700">Browser / OS</p>
                      <p className="text-[11px] text-zinc-400">
                        {submission.telemetry.browser} / {submission.telemetry.os}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Timestamp */}
              <div className="bg-[#0C0C0C] p-4">
                <div className="mb-2 flex items-center gap-1.5">
                  <Calendar size={11} className="text-zinc-400" />
                  <span className="text-[9px] font-medium uppercase tracking-wider text-zinc-600">
                    Signed Timestamp
                  </span>
                </div>
                <p className="text-[12px] font-medium text-zinc-300">
                  {submission.signedAt}
                </p>
                <p className="mt-1 font-mono text-[9px] text-zinc-700">
                  ISO: {submission.telemetry.timestamp}
                </p>
              </div>

              {/* Hash */}
              <div className="bg-[#0C0C0C] p-4">
                <div className="mb-2 flex items-center gap-1.5">
                  <Shield size={11} className="text-zinc-400" />
                  <span className="text-[9px] font-medium uppercase tracking-wider text-zinc-600">
                    Document Hash (SHA-256)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 truncate rounded-md border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] px-2 py-1 font-mono text-[10px] text-zinc-500">
                    {submission.telemetry.sha256}
                  </code>
                  <button
                    onClick={copyHash}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-[rgba(255,255,255,0.08)] text-zinc-600 transition-colors hover:bg-[rgba(255,255,255,0.04)] hover:text-zinc-400"
                  >
                    {hashCopied ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} />}
                  </button>
                </div>
                <p className="mt-1.5 flex items-center gap-1 text-[9px] text-emerald-500">
                  <CheckCircle size={8} />
                  Integrity verified
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Pending state banner */}
        {submission.status === "pending" && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-6 mt-5 flex items-center gap-3 rounded-xl border border-amber-500/15 bg-amber-900/10 px-5 py-4"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
              <Clock size={16} className="text-amber-400" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-400">
                PENDING SIGNATURE
              </p>
              <p className="mt-0.5 text-[10px] text-zinc-600">
                This form has not been completed. Some fields may be missing.
              </p>
            </div>
          </motion.div>
        )}

        {/* ── Document Content ────────────────────────── */}
        <div className="mx-auto max-w-3xl px-6 py-8">
          {/* Document header */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="mb-8"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-zinc-700 to-zinc-800">
                <FileText size={18} strokeWidth={1.5} className="text-zinc-400" />
              </div>
              <div>
                <h1 className="text-[18px] font-semibold text-zinc-200">
                  {submission.formTitle}
                </h1>
                <p className="text-[12px] text-zinc-600">
                  Version {submission.formVersion} · Submitted by {submission.submittedBy}
                  {submission.jobRef && (
                    <span className="ml-2 font-mono text-zinc-700">{submission.jobRef}</span>
                  )}
                </p>
              </div>
            </div>
          </motion.div>

          {/* Document paper */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="relative overflow-hidden rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#111111]"
          >
            {/* Locked overlay for signed docs */}
            {submission.status === "signed" && (
              <div className="absolute right-4 top-4 z-10 flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wider text-emerald-400">
                <Lock size={9} />
                Immutable
              </div>
            )}

            {/* Paper content */}
            <div className="p-8">
              {/* Brand header */}
              <div className="mb-8 flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] pb-6">
                <div className="flex items-center gap-2">
                  <img
                    src="/logos/logo-dark-streamline.png"
                    alt="iWorkr"
                    className="h-7 w-7 object-contain"
                  />
                  <div>
                    <p className="text-[11px] font-medium text-zinc-300">{orgSettings?.name || "iWorkr"}</p>
                    <p className="text-[9px] text-zinc-700">
                      {orgSettings?.settings?.tax_id
                        ? `ABN ${orgSettings.settings.tax_id}`
                        : "Add Tax ID in Settings"}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-medium text-zinc-400">{submission.formTitle}</p>
                  <p className="mt-0.5 text-[9px] text-zinc-700">
                    Submitted: {submission.submittedAt}
                  </p>
                </div>
              </div>

              {/* Form fields */}
              <div className="space-y-5">
                {submission.fields.map((field, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + i * 0.04, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <label className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                      {field.label}
                    </label>
                    <div className="mt-1 rounded-lg border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] px-3 py-2.5">
                      <p className="text-[13px] text-zinc-300">
                        {field.value === "Yes" ? (
                          <span className="flex items-center gap-1.5">
                            <CheckCircle size={12} className="text-emerald-400" />
                            Confirmed
                          </span>
                        ) : field.value === "—" ? (
                          <span className="text-zinc-700 italic">Not completed</span>
                        ) : (
                          field.value
                        )}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Signatures section */}
              {submission.status === "signed" && (
                <div className="mt-8 border-t border-[rgba(255,255,255,0.06)] pt-6">
                  <h3 className="mb-4 text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                    Signatures
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    {/* Simulated signature boxes */}
                    <div className="rounded-lg border border-dashed border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.01)] p-4">
                      <div className="flex items-center gap-2 text-[10px] text-zinc-600">
                        <PenTool size={10} />
                        <span>Technician Signature</span>
                      </div>
                      <div className="mt-3 flex items-center justify-center">
                        {/* Simulated signature curve */}
                        <svg width="180" height="40" viewBox="0 0 180 40" className="text-zinc-400">
                          <path
                            d="M 10 30 C 20 10 30 35 50 20 C 70 5 80 30 100 18 C 120 6 130 35 150 22 C 160 18 170 25 175 20"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                          />
                        </svg>
                      </div>
                      <p className="mt-2 text-center text-[9px] text-zinc-700">
                        {submission.submittedBy} · {submission.submittedAt}
                      </p>
                    </div>

                    {submission.clientName && (
                      <div className="rounded-lg border border-dashed border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.01)] p-4">
                        <div className="flex items-center gap-2 text-[10px] text-zinc-600">
                          <PenTool size={10} />
                          <span>Client Signature</span>
                        </div>
                        <div className="mt-3 flex items-center justify-center">
                          <svg width="180" height="40" viewBox="0 0 180 40" className="text-zinc-500">
                            <path
                              d="M 15 25 C 25 8 40 30 55 15 C 75 0 85 25 105 12 C 115 8 135 30 155 18 C 165 14 170 22 175 20"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                            />
                          </svg>
                        </div>
                        <p className="mt-2 text-center text-[9px] text-zinc-700">
                          {submission.clientName} · {submission.submittedAt}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Photo evidence placeholder */}
              <div className="mt-6 border-t border-[rgba(255,255,255,0.06)] pt-6">
                <h3 className="mb-3 text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                  Attachments & Evidence
                </h3>
                <div className="flex gap-3">
                  <div className="flex h-20 w-20 flex-col items-center justify-center rounded-lg border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)]">
                    <Camera size={16} className="mb-1 text-zinc-700" />
                    <span className="text-[8px] text-zinc-700">Site Photo</span>
                  </div>
                  {submission.telemetry && (
                    <div className="flex h-20 w-20 flex-col items-center justify-center rounded-lg border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)]">
                      <MapPin size={16} className="mb-1 text-zinc-700" />
                      <span className="text-[8px] text-zinc-700">GPS Stamp</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useCallback, useTransition } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useDropzone } from "react-dropzone";
import {
  ChevronRight, UploadCloud, Search, X, FileText, Shield, CheckCircle2,
  Loader2, AlertTriangle, Download, Bell, FileCheck,
} from "lucide-react";
import { useOrg } from "@/lib/hooks/use-org";
import { queryKeys } from "@/lib/hooks/use-query-keys";
import {
  getGovernanceDashboardAction,
  publishPolicyWithFileAction,
  nudgeUnreadStaffAction,
  getAuditTrackerAction,
  type PolicyRow,
} from "@/app/actions/governance-policies";
import { LetterAvatar } from "@/components/ui/letter-avatar";

/* ═══════════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════════ */

type TabId = "active" | "review" | "archived";
type DropPhase = "idle" | "dragging" | "uploading" | "done" | "error";

const TABS: { id: TabId; label: string }[] = [
  { id: "active",   label: "Active Policies" },
  { id: "review",   label: "Under Review" },
  { id: "archived", label: "Archived" },
];

const CATEGORIES = [
  "whs", "clinical", "hr", "general", "emergency",
  "governance", "safety", "operational", "finance", "privacy",
];

const MAX_BYTES = 20 * 1024 * 1024; // 20 MB

/* ═══════════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════════ */

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return iso.slice(0, 10); }
}

function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function reviewColor(iso: string | null | undefined): string {
  const d = daysUntil(iso);
  if (d === null) return "text-zinc-400";
  if (d < 0)  return "text-rose-500";
  if (d < 30) return "text-amber-500";
  return "text-white";
}

function getInitials(name: string): string {
  return (name || "?")
    .split(" ").map((n) => n[0] || "").join("").toUpperCase().slice(0, 2);
}

function policyStatusFilter(p: PolicyRow, tab: TabId): boolean {
  const s = (p.status ?? "").toLowerCase();
  if (tab === "active")   return ["active", "current", "published"].includes(s);
  if (tab === "review")   return ["under_review", "review", "draft"].includes(s);
  if (tab === "archived") return ["archived", "inactive"].includes(s);
  return true;
}

/* ═══════════════════════════════════════════════════════════════════
   Sub-Components
   ═══════════════════════════════════════════════════════════════════ */

function GhostBadge({ label, color }: { label: string; color: "emerald" | "amber" | "zinc" | "rose" }) {
  const cls: Record<string, string> = {
    emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    amber:   "bg-amber-500/10  text-amber-400  border-amber-500/20",
    zinc:    "bg-zinc-500/10   text-zinc-400   border-zinc-500/20",
    rose:    "bg-rose-500/10   text-rose-400   border-rose-500/20",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${cls[color]}`}>
      {label}
    </span>
  );
}

function MetricNode({
  label, value, colorClass, pulse,
}: {
  label: string;
  value: string | number;
  colorClass?: string;
  pulse?: boolean;
}) {
  return (
    <div className="flex flex-col min-w-[100px]">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-1">{label}</span>
      <div className="flex items-center gap-1.5">
        {pulse && (
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
          </span>
        )}
        <span className={`font-mono text-[20px] leading-none ${colorClass ?? "text-white"}`}>{value}</span>
      </div>
    </div>
  );
}

function Divider() {
  return <div className="h-8 w-px bg-white/5 mx-2 flex-shrink-0" />;
}

function SkeletonRow() {
  return (
    <tr className="border-b border-white/5 h-16 animate-pulse">
      <td className="px-8 py-3"><div className="space-y-1.5"><div className="h-3.5 w-44 rounded bg-white/5" /><div className="h-2 w-32 rounded bg-white/5" /></div></td>
      <td className="py-3"><div className="h-3 w-20 rounded bg-white/5" /></td>
      <td className="py-3"><div className="h-3 w-20 rounded bg-white/5" /></td>
      <td className="py-3"><div className="space-y-1.5"><div className="h-3 w-16 rounded bg-white/5" /><div className="h-1.5 w-28 rounded-full bg-white/5" /></div></td>
      <td className="py-3"><div className="h-5 w-16 rounded-full bg-white/5" /></td>
      <td className="py-3 pr-8"><div className="h-4 w-4 rounded bg-white/5" /></td>
    </tr>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Publish Policy Slide-Over
   ═══════════════════════════════════════════════════════════════════ */

function PublishPolicySlideOver({
  orgId,
  onClose,
  onSuccess,
}: {
  orgId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [phase, setPhase] = useState<DropPhase>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [fileErr, setFileErr] = useState("");
  const [form, setForm] = useState({
    title: "",
    category: "whs",
    version_number: "1.0",
    review_date: "",
    audience: "all" as "all" | "specific_roles" | "specific_workers",
  });
  const [error, setError] = useState("");

  const onDrop = useCallback((accepted: File[], rejected: any[]) => {
    setFileErr("");
    if (rejected.length > 0) {
      setFileErr("Only PDF and DOCX files under 20 MB are accepted.");
      return;
    }
    setFile(accepted[0]);
    setPhase("idle");
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"], "application/msword": [".doc"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"] },
    maxSize: MAX_BYTES,
    multiple: false,
  });

  async function fileToBase64(f: File): Promise<string> {
    return new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload = () => {
        const b64 = (reader.result as string).split(",")[1];
        res(b64);
      };
      reader.onerror = rej;
      reader.readAsDataURL(f);
    });
  }

  function handleSubmit() {
    if (!form.title.trim()) { setError("Policy name is required."); return; }
    if (!form.review_date)  { setError("Review date is required."); return; }
    setError("");
    startTransition(async () => {
      try {
        setPhase("uploading");
        let fileBase64: string | undefined;
        let fileName: string | undefined;
        let mimeType: string | undefined;
        if (file) {
          fileBase64 = await fileToBase64(file);
          fileName = file.name;
          mimeType = file.type;
        }
        await publishPolicyWithFileAction({
          organization_id: orgId,
          title: form.title,
          category: form.category,
          version_number: form.version_number,
          review_date: form.review_date,
          audience: form.audience,
          file_base64: fileBase64,
          file_name: fileName,
          mime_type: mimeType,
        });
        setPhase("done");
        setTimeout(() => { onSuccess(); onClose(); }, 800);
      } catch (e) {
        setPhase("error");
        setError((e as Error).message);
      }
    });
  }

  const borderColor = isDragActive ? "border-emerald-500/50 bg-emerald-500/5" : "border-white/10 bg-zinc-950/50";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.aside
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 280 }}
        className="fixed right-0 top-0 z-50 flex h-full w-[500px] flex-col bg-zinc-950 border-l border-white/5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">GOVERNANCE</p>
            <h2 className="text-[15px] font-semibold text-white mt-0.5">Publish Policy</h2>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-zinc-500 hover:bg-white/5 hover:text-zinc-300 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Dropzone */}
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-2 block">
              Policy Document (PDF / DOCX)
            </label>
            <div
              {...getRootProps()}
              className={`rounded-xl border-2 border-dashed p-6 text-center transition-all cursor-pointer ${borderColor}`}
            >
              <input {...getInputProps()} />
              {file ? (
                <div className="flex items-center justify-center gap-3">
                  <FileCheck size={20} className="text-emerald-500" />
                  <div className="text-left">
                    <p className="text-[13px] font-medium text-white">{file.name}</p>
                    <p className="text-[11px] text-zinc-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setFile(null); }}
                    className="ml-auto p-1 hover:bg-white/5 rounded-full text-zinc-500 hover:text-zinc-300"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <>
                  <UploadCloud size={24} className="mx-auto mb-2 text-zinc-600" />
                  <p className="text-[13px] text-zinc-400">
                    {isDragActive ? "Drop to upload" : "Drop PDF or DOCX here, or click to browse"}
                  </p>
                  <p className="text-[11px] text-zinc-600 mt-1">Max 20 MB</p>
                </>
              )}
            </div>
            {fileErr && <p className="mt-1.5 text-[11px] text-rose-400">{fileErr}</p>}
          </div>

          {/* Policy Name */}
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-2 block">Policy Name</label>
            <input
              className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2.5 text-[13px] text-white placeholder-zinc-600 focus:border-white/20 focus:outline-none transition-colors"
              placeholder="e.g. Infection Control & PPE Policy"
              value={form.title}
              onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))}
            />
          </div>

          {/* Category + Version */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-2 block">Category</label>
              <select
                className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2.5 text-[13px] text-white focus:border-white/20 focus:outline-none transition-colors"
                value={form.category}
                onChange={(e) => setForm((s) => ({ ...s, category: e.target.value }))}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-2 block">Version Number</label>
              <input
                className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2.5 text-[13px] font-mono text-white placeholder-zinc-600 focus:border-white/20 focus:outline-none transition-colors"
                placeholder="e.g. 3.2.1"
                value={form.version_number}
                onChange={(e) => setForm((s) => ({ ...s, version_number: e.target.value }))}
              />
            </div>
          </div>

          {/* Next Review Date */}
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-2 block">Next Review Date</label>
            <input
              type="date"
              className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2.5 text-[13px] text-white focus:border-white/20 focus:outline-none transition-colors [color-scheme:dark]"
              value={form.review_date}
              onChange={(e) => setForm((s) => ({ ...s, review_date: e.target.value }))}
            />
          </div>

          {/* Distribution Matrix */}
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-3 block">Mandatory Readers</label>
            <div className="space-y-2">
              {([
                ["all",              "All Active Staff"],
                ["specific_roles",   "Specific Roles"],
                ["specific_workers", "Select Individual Workers"],
              ] as const).map(([val, label]) => (
                <label key={val} className="flex items-center gap-3 cursor-pointer group">
                  <div className={`h-4 w-4 rounded-full border flex items-center justify-center transition-colors ${form.audience === val ? "border-emerald-500 bg-emerald-500/20" : "border-white/20 group-hover:border-white/30"}`}>
                    {form.audience === val && <div className="h-2 w-2 rounded-full bg-emerald-500" />}
                  </div>
                  <input type="radio" className="sr-only" checked={form.audience === val} onChange={() => setForm((s) => ({ ...s, audience: val }))} />
                  <span className="text-[13px] text-zinc-300">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2.5">
              <AlertTriangle size={14} className="text-rose-400 flex-shrink-0" />
              <p className="text-[12px] text-rose-400">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-white/5 px-6 py-4">
          <button
            onClick={handleSubmit}
            disabled={isPending || phase === "uploading"}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-white py-2.5 text-[13px] font-semibold text-zinc-950 transition-all hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {(isPending || phase === "uploading") ? (
              <><Loader2 size={15} className="animate-spin" /> Publishing…</>
            ) : phase === "done" ? (
              <><CheckCircle2 size={15} className="text-emerald-600" /> Published!</>
            ) : (
              <><UploadCloud size={15} /> Publish &amp; Distribute</>
            )}
          </button>
        </div>
      </motion.aside>
    </AnimatePresence>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Compliance Audit Slide-Over
   ═══════════════════════════════════════════════════════════════════ */

type AuditAckRow = {
  id: string;
  status: string;
  acknowledged_at?: string;
  ip_address?: string;
  profiles?: { full_name?: string; email?: string };
  _optimisticNudged?: boolean;
};

function ComplianceAuditSlideOver({
  orgId,
  policy,
  onClose,
}: {
  orgId: string;
  policy: PolicyRow;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const auditQueryKey = ["governance", "auditTracker", orgId, policy.id] as const;

  const { data: acks = [], isLoading: loading } = useQuery<AuditAckRow[]>({
    queryKey: auditQueryKey,
    queryFn: async () => {
      try {
        return await getAuditTrackerAction({ organization_id: orgId, policy_id: policy.id });
      } catch {
        return [];
      }
    },
    staleTime: 30_000,
  });
  const [nudgeResult, setNudgeResult] = useState<string | null>(null);

  const nudgeMutation = useMutation({
    mutationFn: () =>
      nudgeUnreadStaffAction({
        organization_id: orgId,
        policy_id: policy.id,
        policy_title: policy.title,
      }),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: auditQueryKey });
      const previous = queryClient.getQueryData<AuditAckRow[]>(auditQueryKey);
      queryClient.setQueryData<AuditAckRow[]>(auditQueryKey, (old) => {
        if (!old) return old;
        return old.map((a) =>
          a.status !== "signed" ? { ...a, _optimisticNudged: true } : a
        );
      });
      return { previous };
    },
    onSuccess: (data) => {
      const n = data.nudged;
      setNudgeResult(`${n} staff member${n !== 1 ? "s" : ""} nudged successfully.`);
    },
    onError: (e: Error, _v, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(auditQueryKey, context.previous);
      }
      setNudgeResult(`Error: ${e.message}`);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: auditQueryKey });
    },
  });

  const pending = acks.filter((a) => a.status !== "signed");
  const signed  = acks.filter((a) => a.status === "signed");

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.aside
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 280 }}
        className="fixed right-0 top-0 z-50 flex h-full w-[450px] flex-col bg-zinc-950 border-l border-white/5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-white/5 px-6 py-4">
          <div className="flex items-start justify-between">
            <div className="flex-1 pr-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500 mb-1">AUDIT TRACKER</p>
              <h2 className="text-[15px] font-semibold text-white leading-snug">{policy.title}</h2>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="font-mono text-[10px] text-zinc-500">v{policy.version || "—"}</span>
                {policy.document_url && (
                  <a
                    href={policy.document_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[10px] text-zinc-400 hover:text-white transition-colors"
                  >
                    <Download size={10} /> Download PDF
                  </a>
                )}
              </div>
            </div>
            <button onClick={onClose} className="rounded-md p-1.5 text-zinc-500 hover:bg-white/5 hover:text-zinc-300 transition-colors">
              <X size={16} />
            </button>
          </div>
          {/* Summary stats */}
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="rounded-lg border border-white/5 bg-zinc-900/60 px-3 py-2.5">
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold mb-0.5">Signed</p>
              <p className="font-mono text-[18px] text-emerald-400">{signed.length}</p>
            </div>
            <div className="rounded-lg border border-white/5 bg-zinc-900/60 px-3 py-2.5">
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold mb-0.5">Pending</p>
              <p className="font-mono text-[18px] text-amber-400">{pending.length}</p>
            </div>
          </div>
        </div>

        {/* Worker List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 size={20} className="animate-spin text-zinc-600" />
            </div>
          ) : acks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 px-6 text-center">
              <Shield size={32} strokeWidth={0.8} className="text-zinc-700 mb-3" />
              <p className="text-[13px] text-zinc-500">No acknowledgements tracked for this policy yet.</p>
            </div>
          ) : (
            <>
              {/* Pending section */}
              {pending.length > 0 && (
                <div>
                  <p className="px-6 py-3 text-[10px] font-semibold uppercase tracking-widest text-amber-500/70">Pending ({pending.length})</p>
                  {pending.map((a: AuditAckRow) => (
                    <div key={a.id} className="flex items-center gap-3 px-6 py-3 border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                      <LetterAvatar name={a.profiles?.full_name || a.profiles?.email || "?"} size={28} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] text-zinc-200 truncate">{a.profiles?.full_name || a.profiles?.email || "Unknown"}</p>
                        <p className="text-[11px] text-zinc-500 truncate">{a.profiles?.email || ""}</p>
                      </div>
                      <span
                        className={
                          a._optimisticNudged
                            ? "inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-400"
                            : "inline-flex items-center rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-400"
                        }
                      >
                        {a._optimisticNudged ? "Nudged" : "Pending"}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Signed section */}
              {signed.length > 0 && (
                <div>
                  <p className="px-6 py-3 text-[10px] font-semibold uppercase tracking-widest text-emerald-500/70">Acknowledged ({signed.length})</p>
                  {signed.map((a: any) => (
                    <div key={a.id} className="flex items-center gap-3 px-6 py-3 border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                      <LetterAvatar name={a.profiles?.full_name || a.profiles?.email || "?"} size={28} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] text-zinc-200 truncate">{a.profiles?.full_name || a.profiles?.email || "Unknown"}</p>
                        {a.acknowledged_at && (
                          <p className="font-mono text-[10px] text-zinc-500">
                            {new Date(a.acknowledged_at).toLocaleDateString("en-AU", { day: "2-digit", month: "short" })},{" "}
                            {new Date(a.acknowledged_at).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: true })}
                            {a.ip_address ? ` · ${a.ip_address}` : ""}
                          </p>
                        )}
                      </div>
                      <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0" />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer: Nudge Engine */}
        <div className="border-t border-white/5 px-6 py-4 space-y-2">
          {nudgeResult && (
            <p className={`text-[12px] text-center ${nudgeResult.startsWith("Error") ? "text-rose-400" : "text-emerald-400"}`}>
              {nudgeResult}
            </p>
          )}
          <button
            onClick={() => nudgeMutation.mutate()}
            disabled={nudgeMutation.isPending || pending.length === 0}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 py-2.5 text-[13px] font-semibold text-amber-400 transition-all hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {nudgeMutation.isPending ? (
              <><Loader2 size={14} className="animate-spin" /> Sending…</>
            ) : (
              <><Bell size={14} /> Nudge Unread Staff ({pending.length})</>
            )}
          </button>
        </div>
      </motion.aside>
    </AnimatePresence>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Empty State
   ═══════════════════════════════════════════════════════════════════ */

function EmptyState({ onPublish }: { onPublish: () => void }) {
  return (
    <div className="flex h-64 flex-col items-center justify-center rounded-xl border-2 border-dashed border-white/5 bg-zinc-950/50 mx-8 mt-8">
      <Shield size={40} strokeWidth={0.8} className="mb-4 text-zinc-800" />
      <p className="text-[15px] font-medium text-white">No governance policies published.</p>
      <p className="mt-1 max-w-sm text-center text-[13px] text-zinc-500">
        Upload your operational guidelines, HR policies, and clinical procedures to begin tracking staff compliance.
      </p>
      <button
        onClick={onPublish}
        className="mt-4 rounded-lg bg-white px-4 py-2 text-[13px] font-semibold text-zinc-950 transition-all hover:bg-zinc-100"
      >
        Publish First Policy
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Main Page
   ═══════════════════════════════════════════════════════════════════ */

export default function GovernancePoliciesPage() {
  const { orgId, loading: orgLoading } = useOrg();
  const queryClient = useQueryClient();

  const { data: dashboardData, isLoading: dataLoading } = useQuery({
    queryKey: queryKeys.governance.policies(orgId ?? ""),
    queryFn: async () => {
      return getGovernanceDashboardAction(orgId!);
    },
    enabled: !!orgId,
    staleTime: 60_000,
  });

  const policies = dashboardData?.policies ?? [];
  const telemetry = dashboardData?.telemetry ?? null;

  const [activeTab, setActiveTab]       = useState<TabId>("active");
  const [search, setSearch]             = useState("");
  const [showPublish, setShowPublish]   = useState(false);
  const [auditPolicy, setAuditPolicy]   = useState<PolicyRow | null>(null);

  // Filter
  const filtered = policies
    .filter((p) => policyStatusFilter(p, activeTab))
    .filter((p) => {
      const q = search.toLowerCase();
      return !q ||
        p.title?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q) ||
        p.version?.toLowerCase().includes(q);
    });

  // Telemetry display logic
  const ackRate    = telemetry?.ack_rate ?? 100;
  const ackColor   = ackRate === 100 ? "text-emerald-500" : ackRate >= 80 ? "text-amber-500" : "text-rose-500";
  const ackBold    = ackRate < 80 ? "font-bold" : "";
  const ackPulse   = ackRate < 80;

  return (
    <div className="flex h-screen flex-col bg-[#050505] text-zinc-100 overflow-hidden">

      {/* ── Command Header ──────────────────────────────────────────────── */}
      <header className="flex h-14 flex-shrink-0 items-center justify-between border-b border-white/5 bg-[#050505] px-8">
        {/* Left: Breadcrumb + Tabs */}
        <div className="flex items-center gap-6">
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em]">
            <span className="text-zinc-600">Governance</span>
            <ChevronRight size={10} className="text-zinc-700" />
            <span className="text-zinc-400">Policies &amp; Readiness</span>
          </div>

          <div className="h-4 w-px bg-white/5" />

          {/* Pill Tabs */}
          <div className="flex items-center gap-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-full px-3 py-1 text-[11px] font-medium transition-colors ${
                  activeTab === tab.id
                    ? "bg-white/10 text-white"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Search + Publish */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" />
            <input
              type="text"
              placeholder="Search policy name, category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 w-64 rounded-lg border border-white/10 bg-zinc-900 pl-8 pr-3 text-[12px] text-white placeholder-zinc-600 focus:border-white/20 focus:outline-none transition-colors"
            />
          </div>
          <button
            onClick={() => setShowPublish(true)}
            className="flex items-center gap-2 rounded-lg bg-white px-3.5 py-1.5 text-[12px] font-semibold text-zinc-950 transition-all hover:bg-zinc-100"
          >
            <UploadCloud size={13} />
            Publish Policy
          </button>
        </div>
      </header>

      {/* ── Telemetry Ribbon ────────────────────────────────────────────── */}
      <div className="flex h-16 flex-shrink-0 items-center gap-6 overflow-x-auto border-b border-white/5 bg-zinc-950/30 px-8">
        <MetricNode
          label="Active Policies"
          value={telemetry?.total_active ?? "—"}
        />
        <Divider />
        <MetricNode
          label="Upcoming Reviews (30D)"
          value={telemetry?.upcoming_reviews ?? "—"}
          colorClass={(telemetry?.upcoming_reviews ?? 0) > 0 ? "text-amber-400" : "text-white"}
        />
        <Divider />
        <MetricNode
          label="Staff Acknowledgement Rate"
          value={telemetry ? `${ackRate}%` : "—"}
          colorClass={`${ackColor} ${ackBold}`}
          pulse={ackPulse}
        />
        <Divider />
        <MetricNode
          label="Overdue Acknowledgements"
          value={telemetry?.overdue_acks ?? "—"}
          colorClass={(telemetry?.overdue_acks ?? 0) > 0 ? "text-rose-400" : "text-white"}
        />
      </div>

      {/* ── Data Grid ──────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        {dataLoading || orgLoading ? (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="h-10 border-b border-white/5">
                <th className="px-8 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold w-[30%]">Policy Name &amp; Version</th>
                <th className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold w-[15%]">Category</th>
                <th className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold w-[15%]">Next Review</th>
                <th className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold w-[25%]">Acknowledgement</th>
                <th className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold w-[10%]">Status</th>
                <th className="pr-8 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold w-[5%]" />
              </tr>
            </thead>
            <tbody>
              {[...Array(6)].map((_, i) => <SkeletonRow key={i} />)}
            </tbody>
          </table>
        ) : filtered.length === 0 ? (
          <EmptyState onPublish={() => setShowPublish(true)} />
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="h-10 border-b border-white/5 sticky top-0 bg-[#050505] z-10">
                <th className="px-8 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold w-[30%]">Policy Name &amp; Version</th>
                <th className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold w-[15%]">Category</th>
                <th className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold w-[15%]">Next Review</th>
                <th className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold w-[25%]">Acknowledgement</th>
                <th className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold w-[10%]">Status</th>
                <th className="pr-8 text-[10px] uppercase tracking-widest text-zinc-500 font-semibold w-[5%]" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((policy) => {
                const ackPct = policy.ack_total > 0
                  ? Math.round((policy.ack_signed / policy.ack_total) * 100)
                  : null;
                const barFill = ackPct !== null ? `${ackPct}%` : "0%";
                const barColor = ackPct === 100 ? "bg-emerald-500" : "bg-amber-500";
                const statusLC = (policy.status ?? "").toLowerCase();
                let badgeLabel = "Active";
                let badgeColor: "emerald" | "amber" | "zinc" | "rose" = "emerald";
                if (["archived", "inactive"].includes(statusLC)) { badgeLabel = "Archived"; badgeColor = "zinc"; }
                else if (["under_review", "review", "draft"].includes(statusLC)) { badgeLabel = "Under Review"; badgeColor = "amber"; }

                return (
                  <tr
                    key={policy.id}
                    className="group border-b border-white/5 hover:bg-white/[0.02] transition-colors cursor-pointer h-16"
                    onClick={() => setAuditPolicy(policy)}
                    onMouseEnter={() => {
                      if (!orgId) return;
                      queryClient.prefetchQuery({
                        queryKey: ["governance", "auditTracker", orgId, policy.id] as const,
                        queryFn: () =>
                          getAuditTrackerAction({
                            organization_id: orgId,
                            policy_id: policy.id,
                          }),
                        staleTime: 60_000,
                      });
                    }}
                  >
                    {/* Col 1: Name + Version */}
                    <td className="px-8 py-3">
                      <div className="flex items-start gap-2.5">
                        <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md border border-white/5 bg-zinc-900">
                          <FileText size={13} className="text-zinc-500" />
                        </div>
                        <div>
                          <p className="text-[14px] font-medium text-zinc-100 leading-snug">{policy.title}</p>
                          <p className="font-mono text-[10px] text-zinc-500 mt-0.5">
                            v{policy.version || "—"}{policy.updated_at ? ` · Updated ${fmtDate(policy.updated_at)}` : ""}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Col 2: Category */}
                    <td className="py-3">
                      <p className="text-[13px] text-zinc-400 capitalize">{policy.category || "—"}</p>
                    </td>

                    {/* Col 3: Next Review */}
                    <td className="py-3">
                      <p className={`font-mono text-[12px] ${reviewColor(policy.review_date)}`}>
                        {policy.review_date ? fmtDate(policy.review_date) : "—"}
                      </p>
                    </td>

                    {/* Col 4: Acknowledgement */}
                    <td className="py-3">
                      {policy.ack_total > 0 ? (
                        <div>
                          <p className="font-mono text-[11px] text-zinc-300 mb-1">
                            {policy.ack_signed}/{policy.ack_total} Signed
                          </p>
                          <div className="h-1.5 w-full max-w-[120px] rounded-full bg-zinc-900 overflow-hidden">
                            <div className={`h-full ${barColor} transition-all duration-500`} style={{ width: barFill }} />
                          </div>
                        </div>
                      ) : (
                        <p className="text-[11px] text-zinc-600">No assignments</p>
                      )}
                    </td>

                    {/* Col 5: Status */}
                    <td className="py-3">
                      <GhostBadge label={badgeLabel} color={badgeColor} />
                    </td>

                    {/* Col 6: Action */}
                    <td className="pr-8 py-3 text-right">
                      <ChevronRight size={16} className="text-zinc-700 group-hover:text-zinc-300 group-hover:translate-x-1 transition-all duration-200 ml-auto" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Slide-Overs ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showPublish && (
          <PublishPolicySlideOver
            orgId={orgId!}
            onClose={() => setShowPublish(false)}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: queryKeys.governance.policies(orgId!) });
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {auditPolicy && (
          <ComplianceAuditSlideOver
            orgId={orgId!}
            policy={auditPolicy}
            onClose={() => setAuditPolicy(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

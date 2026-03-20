"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck,
  ShieldAlert,
  Upload,
  BookOpen,
  Trash2,
  Play,
  Loader2,
  Settings2,
  Activity,
  FileText,
  AlertTriangle,
  Eye,
  Lock,
  ToggleLeft,
  ToggleRight,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";
import { useOrg } from "@/lib/hooks/use-org";
import { queryKeys } from "@/lib/hooks/use-query-keys";
import { useToastStore } from "@/components/app/action-toast";
import {
  getFrameworks,
  createFramework,
  updateFrameworkStatus,
  deleteFramework,
  triggerIngestion,
  getComplianceSettings,
  updateComplianceSettings,
  getComplianceStats,
  getComplianceLogs,
} from "@/app/actions/solon-law";

interface Framework {
  id: string;
  title: string;
  version_code: string | null;
  description: string | null;
  sector: string;
  effective_date: string;
  expiry_date: string | null;
  status: string;
  ingestion_status: string | null;
  total_chunks: number;
  source_pdf_url: string | null;
  created_at: string | null;
}

interface Stats {
  compliant: number;
  violations: number;
  overridden: number;
  total_evaluations: number;
  active_frameworks: number;
}

interface LogEntry {
  id: string;
  context_type: string;
  serialized_intent: string;
  result: string;
  confidence_flag: string;
  violations: { clause_reference: string; human_explanation: string }[];
  was_overridden: boolean;
  processing_ms: number;
  created_at: string;
}

interface ComplianceEngineQueryData {
  frameworks: Framework[];
  stats: Stats | null;
  logs: LogEntry[];
  settings: { compliance_mode: string; compliance_enabled: boolean } | null;
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: React.ElementType; color: string }) {
  return (
    <div className="flex items-center gap-3 p-4 bg-[#0A0A0A] border border-white/[0.06] rounded-xl">
      <div className={`p-2 rounded-lg ${color}`}>
        <Icon size={16} />
      </div>
      <div>
        <p className="text-xl font-semibold text-white">{value}</p>
        <p className="text-[11px] text-neutral-500 uppercase tracking-widest">{label}</p>
      </div>
    </div>
  );
}

export default function ComplianceEnginePage() {
  const { orgId } = useOrg();
  const toast = useToastStore();
  const queryClient = useQueryClient();

  const { data: engineData, isLoading: loading } = useQuery<ComplianceEngineQueryData>({
    queryKey: queryKeys.settings.complianceEngine(orgId ?? ""),
    queryFn: async () => {
      const [fwRes, stRes, logRes, settRes] = await Promise.all([
        getFrameworks(orgId!),
        getComplianceStats(orgId!),
        getComplianceLogs(orgId!, { limit: 20 }),
        getComplianceSettings(orgId!),
      ]);
      return {
        frameworks: (fwRes.data ?? []) as unknown as Framework[],
        stats: stRes.data as unknown as Stats | null,
        logs: (logRes.data ?? []) as unknown as LogEntry[],
        settings: settRes.data as unknown as { compliance_mode: string; compliance_enabled: boolean } | null,
      };
    },
    enabled: !!orgId,
    staleTime: 60_000,
  });

  const frameworks = engineData?.frameworks ?? [];
  const stats = engineData?.stats ?? null;
  const logs = engineData?.logs ?? [];
  const settings = engineData?.settings ?? null;

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

  const invalidateEngine = () => {
    if (orgId) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.settings.complianceEngine(orgId) });
    }
  };

  const handleToggleEnabled = async () => {
    if (!orgId || !settings) return;
    const next = !settings.compliance_enabled;
    await updateComplianceSettings(orgId, { compliance_enabled: next });
    invalidateEngine();
    toast.addToast(next ? "Compliance engine enabled" : "Compliance engine disabled");
  };

  const handleToggleMode = async () => {
    if (!orgId || !settings) return;
    const next = settings.compliance_mode === "ADVISORY" ? "HARD_STOP" : "ADVISORY";
    await updateComplianceSettings(orgId, { compliance_mode: next });
    invalidateEngine();
    toast.addToast(`Compliance mode set to ${next === "HARD_STOP" ? "Hard Stop" : "Advisory"}`);
  };

  const handleUploadPdf = async (frameworkId: string) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf,.txt";
    input.onchange = async (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file || !orgId) return;

      setUploading(frameworkId);

      if (file.name.endsWith(".txt")) {
        const text = await file.text();
        const res = await triggerIngestion(orgId, frameworkId, { raw_text: text });
        if (res.error) toast.addToast(res.error, undefined, "error");
        else toast.addToast("Ingestion started — processing text");
      } else {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const path = `${orgId}/${frameworkId}/${file.name}`;
        const { error: upErr } = await supabase.storage.from("compliance-raw").upload(path, file, { upsert: true });
        if (upErr) {
          toast.addToast(upErr.message, undefined, "error");
          setUploading(null);
          return;
        }
        const res = await triggerIngestion(orgId, frameworkId, { storage_path: path });
        if (res.error) toast.addToast(res.error, undefined, "error");
        else toast.addToast("Ingestion started — processing PDF");
      }

      setUploading(null);
      setTimeout(invalidateEngine, 3000);
    };
    input.click();
  };

  const handleDeleteFramework = async (id: string) => {
    if (!orgId) return;
    await deleteFramework(orgId, id);
    invalidateEngine();
    toast.addToast("Framework deleted");
  };

  if (!orgId) return null;

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-neutral-500 animate-spin" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-5xl mx-auto p-6 pb-20 space-y-8"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white flex items-center gap-2">
            <ShieldCheck size={22} className="text-emerald-400" />
            Compliance Engine
          </h1>
          <p className="text-sm text-neutral-500 mt-1">Solon-Law — Semantic Regulatory Enforcement via RAG</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Global toggle */}
          <button
            onClick={handleToggleEnabled}
            className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg border border-white/10 hover:bg-white/5 transition-colors"
          >
            {settings?.compliance_enabled ? (
              <ToggleRight size={18} className="text-emerald-400" />
            ) : (
              <ToggleLeft size={18} className="text-neutral-500" />
            )}
            <span className={settings?.compliance_enabled ? "text-emerald-400" : "text-neutral-500"}>
              {settings?.compliance_enabled ? "Active" : "Disabled"}
            </span>
          </button>

          {/* Mode toggle */}
          <button
            onClick={handleToggleMode}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg border transition-colors ${
              settings?.compliance_mode === "HARD_STOP"
                ? "border-rose-500/30 bg-rose-500/5 text-rose-400 hover:bg-rose-500/10"
                : "border-amber-500/30 bg-amber-500/5 text-amber-400 hover:bg-amber-500/10"
            }`}
          >
            {settings?.compliance_mode === "HARD_STOP" ? <Lock size={14} /> : <Eye size={14} />}
            {settings?.compliance_mode === "HARD_STOP" ? "Hard Stop" : "Advisory"}
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard label="Frameworks" value={stats.active_frameworks} icon={BookOpen} color="bg-blue-500/10 text-blue-400" />
          <StatCard label="Evaluations" value={stats.total_evaluations} icon={Activity} color="bg-neutral-500/10 text-neutral-400" />
          <StatCard label="Compliant" value={stats.compliant} icon={ShieldCheck} color="bg-emerald-500/10 text-emerald-400" />
          <StatCard label="Violations" value={stats.violations} icon={ShieldAlert} color="bg-rose-500/10 text-rose-400" />
          <StatCard label="Overridden" value={stats.overridden} icon={AlertTriangle} color="bg-amber-500/10 text-amber-400" />
        </div>
      )}

      {/* Frameworks */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-white uppercase tracking-widest">Regulatory Frameworks</h2>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/15 transition-colors"
          >
            <BookOpen size={12} />
            Add Framework
          </button>
        </div>

        {frameworks.length === 0 ? (
          <div className="p-12 text-center border border-dashed border-white/10 rounded-xl">
            <BookOpen className="w-8 h-8 text-neutral-600 mx-auto mb-3" />
            <p className="text-sm text-neutral-500">No frameworks uploaded yet</p>
            <p className="text-xs text-neutral-600 mt-1">Add a regulatory framework to enable compliance checking</p>
          </div>
        ) : (
          <div className="space-y-2">
            {frameworks.map((fw) => (
              <FrameworkRow
                key={fw.id}
                fw={fw}
                uploading={uploading === fw.id}
                onUpload={() => handleUploadPdf(fw.id)}
                onActivate={() => updateFrameworkStatus(orgId!, fw.id, "ACTIVE").then(invalidateEngine)}
                onDeprecate={() => updateFrameworkStatus(orgId!, fw.id, "DEPRECATED").then(invalidateEngine)}
                onDelete={() => handleDeleteFramework(fw.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Audit Log */}
      <div>
        <button
          onClick={() => setShowLogs(!showLogs)}
          className="flex items-center gap-2 text-sm font-medium text-white uppercase tracking-widest mb-3"
        >
          <FileText size={14} />
          Compliance Audit Log
          {showLogs ? <ChevronUp size={14} className="text-neutral-500" /> : <ChevronDown size={14} className="text-neutral-500" />}
        </button>
        <AnimatePresence>
          {showLogs && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              {logs.length === 0 ? (
                <p className="text-xs text-neutral-600 py-4">No evaluations recorded yet</p>
              ) : (
                <div className="space-y-1 max-h-[400px] overflow-y-auto">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between px-4 py-2.5 bg-[#0A0A0A] border border-white/[0.04] rounded-lg"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <ResultIcon result={log.result} />
                        <div className="min-w-0">
                          <p className="text-sm text-neutral-300 truncate max-w-md">{log.serialized_intent}</p>
                          <p className="text-[10px] text-neutral-600 mt-0.5">
                            {log.context_type} • {log.processing_ms}ms
                            {log.was_overridden && <span className="text-amber-500 ml-2">OVERRIDDEN</span>}
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] text-neutral-600 shrink-0 ml-4">
                        {log.created_at ? new Date(log.created_at).toLocaleDateString() : ""}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Create Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <CreateFrameworkModal
            orgId={orgId}
            onClose={() => setShowCreateModal(false)}
            onCreated={() => { setShowCreateModal(false); invalidateEngine(); }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ── Framework Row ────────────────────────────────── */

function FrameworkRow({ fw, uploading, onUpload, onActivate, onDeprecate, onDelete }: {
  fw: Framework;
  uploading: boolean;
  onUpload: () => void;
  onActivate: () => void;
  onDeprecate: () => void;
  onDelete: () => void;
}) {
  const statusColors: Record<string, string> = {
    DRAFT: "text-neutral-400 bg-neutral-500/10 border-neutral-500/20",
    ACTIVE: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    DEPRECATED: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  };
  const ingestionColors: Record<string, string> = {
    pending: "text-neutral-500",
    extracting: "text-blue-400 animate-pulse",
    chunking: "text-blue-400 animate-pulse",
    embedding: "text-violet-400 animate-pulse",
    completed: "text-emerald-400",
    failed: "text-rose-400",
  };

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-[#0A0A0A] border border-white/[0.06] rounded-xl hover:border-white/10 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <BookOpen size={16} className="text-neutral-500 shrink-0" />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-white truncate">{fw.title}</p>
            {fw.version_code && (
              <span className="text-[10px] font-mono text-neutral-500 shrink-0">v{fw.version_code}</span>
            )}
            <span className={`px-2 py-0.5 text-[10px] uppercase tracking-widest rounded border ${statusColors[fw.status] ?? statusColors.DRAFT}`}>
              {fw.status}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-[10px] text-neutral-600">
              {fw.effective_date}{fw.expiry_date ? ` → ${fw.expiry_date}` : ""}
            </span>
            <span className={`text-[10px] ${ingestionColors[fw.ingestion_status ?? "pending"]}`}>
              {fw.ingestion_status === "completed" ? `${fw.total_chunks} chunks` : fw.ingestion_status ?? "pending"}
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={onUpload}
          disabled={uploading}
          className="p-1.5 rounded-lg text-neutral-500 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-30"
          title="Upload PDF / Text"
        >
          {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
        </button>
        {fw.status === "DRAFT" && fw.ingestion_status === "completed" && (
          <button
            onClick={onActivate}
            className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-500/10 transition-colors"
            title="Activate"
          >
            <Play size={14} />
          </button>
        )}
        {fw.status === "ACTIVE" && (
          <button
            onClick={onDeprecate}
            className="p-1.5 rounded-lg text-amber-500 hover:bg-amber-500/10 transition-colors"
            title="Deprecate"
          >
            <Settings2 size={14} />
          </button>
        )}
        <button
          onClick={onDelete}
          className="p-1.5 rounded-lg text-neutral-600 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
          title="Delete"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

/* ── Result Icon ──────────────────────────────────── */

function ResultIcon({ result }: { result: string }) {
  if (result === "COMPLIANT") return <ShieldCheck size={14} className="text-emerald-400 shrink-0" />;
  if (result === "VIOLATION_DETECTED") return <ShieldAlert size={14} className="text-rose-400 shrink-0" />;
  if (result === "LOW_CONFIDENCE") return <AlertTriangle size={14} className="text-amber-400 shrink-0" />;
  return <Activity size={14} className="text-neutral-500 shrink-0" />;
}

/* ── Create Modal ─────────────────────────────────── */

function CreateFrameworkModal({ orgId, onClose, onCreated }: {
  orgId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [versionCode, setVersionCode] = useState("");
  const [description, setDescription] = useState("");
  const [sector, setSector] = useState("both");
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split("T")[0]);
  const [saving, setSaving] = useState(false);
  const toast = useToastStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    const res = await createFramework(orgId, {
      title: title.trim(),
      version_code: versionCode || undefined,
      description: description || undefined,
      sector,
      effective_date: effectiveDate,
    });
    setSaving(false);
    if (res.error) {
      toast.addToast(res.error, undefined, "error");
    } else {
      toast.addToast("Framework created — upload a PDF to begin ingestion");
      onCreated();
    }
  };

  const inputClass = "w-full px-3 py-2 text-sm bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-neutral-600 focus:outline-none focus:border-emerald-500/40";

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-md bg-[#0A0A0A] border border-white/10 rounded-xl shadow-2xl"
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
            <h3 className="text-sm font-semibold text-white">Add Regulatory Framework</h3>
            <button type="button" onClick={onClose} className="p-1 hover:bg-white/5 rounded-lg transition-colors">
              <X size={14} className="text-neutral-500" />
            </button>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <label className="text-[10px] uppercase tracking-widest text-neutral-500 mb-1 block">Title *</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., AS/NZS 3000:2018" className={inputClass} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] uppercase tracking-widest text-neutral-500 mb-1 block">Version</label>
                <input value={versionCode} onChange={(e) => setVersionCode(e.target.value)} placeholder="e.g., 2025-2026" className={inputClass} />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-neutral-500 mb-1 block">Sector</label>
                <select value={sector} onChange={(e) => setSector(e.target.value)} className={inputClass}>
                  <option value="both">Both</option>
                  <option value="care">Care</option>
                  <option value="trade">Trade</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-neutral-500 mb-1 block">Effective Date</label>
              <input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-neutral-500 mb-1 block">Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief summary of the regulation" className={`${inputClass} h-20 resize-none`} />
            </div>
          </div>
          <div className="flex justify-end gap-2 px-5 py-3 border-t border-white/[0.06]">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-neutral-400 hover:text-white transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors disabled:opacity-40"
            >
              {saving ? "Creating..." : "Create Framework"}
            </button>
          </div>
        </form>
      </motion.div>
    </>
  );
}

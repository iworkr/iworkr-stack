"use client";

/**
 * @page Intake Dashboard
 * @route /dashboard/intake
 * @description Project Oracle-Intake: AI document extraction command center.
 *   Upload NDIS Plan PDFs, monitor AI extraction progress, review & commit.
 */

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDropzone } from "react-dropzone";
import { useAuthStore } from "@/lib/auth-store";
import {
  uploadIntakeDocument,
  fetchIntakeSessions,
  fetchIntakeStats,
  retryIntakeExtraction,
  type IntakeSession,
  type IntakeStats,
} from "@/app/actions/oracle-intake";
import { createClient } from "@/lib/supabase/client";
import {
  Upload,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  Brain,
  AlertTriangle,
  RefreshCw,
  Eye,
  Loader2,
  Sparkles,
  ChevronRight,
  BarChart3,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";

/* ── Status Badge ─────────────────────────────────────── */

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; icon: React.ReactNode; label: string }> = {
    UPLOADING: { bg: "bg-blue-500/10", text: "text-blue-400", icon: <Upload className="w-3 h-3" />, label: "Uploading" },
    ANALYZING: { bg: "bg-amber-500/10", text: "text-amber-400", icon: <Brain className="w-3 h-3 animate-pulse" />, label: "AI Analyzing" },
    PENDING_REVIEW: { bg: "bg-emerald-500/10", text: "text-emerald-400", icon: <Eye className="w-3 h-3" />, label: "Ready for Review" },
    COMMITTED: { bg: "bg-emerald-500/10", text: "text-emerald-300", icon: <CheckCircle2 className="w-3 h-3" />, label: "Committed" },
    REJECTED: { bg: "bg-red-500/10", text: "text-red-400", icon: <XCircle className="w-3 h-3" />, label: "Rejected" },
    FAILED: { bg: "bg-red-500/10", text: "text-red-400", icon: <AlertTriangle className="w-3 h-3" />, label: "Failed" },
  };

  const c = config[status] || config.FAILED;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      {c.icon}
      {c.label}
    </span>
  );
}

/* ── Confidence Bar ───────────────────────────────────── */

function ConfidenceBar({ score }: { score: number | null }) {
  if (score == null) return <span className="text-xs text-neutral-600">—</span>;

  const color = score >= 80 ? "bg-emerald-500" : score >= 60 ? "bg-amber-500" : "bg-red-500";

  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs text-neutral-400 tabular-nums">{score}%</span>
    </div>
  );
}

/* ── Stats Cards ──────────────────────────────────────── */

function StatsCards({ stats }: { stats: IntakeStats }) {
  const cards = [
    { label: "Pending Review", value: stats.pending_review, icon: Eye, color: "text-emerald-400" },
    { label: "AI Processing", value: stats.analyzing, icon: Brain, color: "text-amber-400" },
    { label: "Committed", value: stats.committed, icon: CheckCircle2, color: "text-emerald-300" },
    { label: "Avg Confidence", value: `${stats.avg_confidence}%`, icon: TrendingUp, color: "text-blue-400" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((card) => (
        <div key={card.label} className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-500 uppercase tracking-wider">{card.label}</span>
            <card.icon className={`w-4 h-4 ${card.color}`} />
          </div>
          <p className="text-2xl font-semibold text-neutral-100 mt-1 tabular-nums">{card.value}</p>
        </div>
      ))}
    </div>
  );
}

/* ── Upload Dropzone ──────────────────────────────────── */

function UploadZone({
  onUpload,
  uploading,
}: {
  onUpload: (file: File) => void;
  uploading: boolean;
}) {
  const onDrop = useCallback(
    (accepted: File[]) => {
      if (accepted.length > 0) onUpload(accepted[0]);
    },
    [onUpload]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
    maxSize: 52428800,
    disabled: uploading,
  });

  return (
    <div
      {...getRootProps()}
      className={`
        relative rounded-xl border-2 border-dashed transition-all cursor-pointer
        ${isDragActive ? "border-emerald-500 bg-emerald-500/5" : "border-neutral-700 hover:border-neutral-500 bg-neutral-900/30"}
        ${uploading ? "opacity-50 pointer-events-none" : ""}
      `}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center justify-center py-10 px-6">
        {uploading ? (
          <>
            <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mb-3" />
            <p className="text-sm text-neutral-300">Uploading & triggering AI extraction...</p>
          </>
        ) : (
          <>
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mb-3">
              <Upload className="w-5 h-5 text-emerald-400" />
            </div>
            <p className="text-sm text-neutral-300 font-medium">
              {isDragActive ? "Drop your NDIS Plan PDF here" : "Drop NDIS Plan PDF or click to browse"}
            </p>
            <p className="text-xs text-neutral-600 mt-1">PDF only, max 50MB</p>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Sessions Table ───────────────────────────────────── */

function SessionsTable({
  sessions,
  onRetry,
}: {
  sessions: IntakeSession[];
  onRetry: (id: string) => void;
}) {
  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 rounded-xl border border-neutral-800 bg-neutral-900/30">
        <Sparkles className="w-10 h-10 text-neutral-700 mb-3" />
        <p className="text-sm text-neutral-500">No intake sessions yet</p>
        <p className="text-xs text-neutral-600 mt-1">Upload an NDIS Plan PDF to get started</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-neutral-800 overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-neutral-800 bg-neutral-900/50">
            <th className="text-left text-xs text-neutral-500 font-medium uppercase tracking-wider px-4 py-3">Document</th>
            <th className="text-left text-xs text-neutral-500 font-medium uppercase tracking-wider px-4 py-3">Status</th>
            <th className="text-left text-xs text-neutral-500 font-medium uppercase tracking-wider px-4 py-3 hidden md:table-cell">Confidence</th>
            <th className="text-left text-xs text-neutral-500 font-medium uppercase tracking-wider px-4 py-3 hidden lg:table-cell">Model</th>
            <th className="text-left text-xs text-neutral-500 font-medium uppercase tracking-wider px-4 py-3 hidden lg:table-cell">Uploaded</th>
            <th className="text-right text-xs text-neutral-500 font-medium uppercase tracking-wider px-4 py-3">Action</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((session) => (
            <motion.tr
              key={session.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="border-b border-neutral-800/50 hover:bg-neutral-800/30 transition-colors"
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-red-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-neutral-200 truncate max-w-[200px]">{session.original_filename}</p>
                    <p className="text-xs text-neutral-600">{session.uploader_name}</p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={session.status} />
              </td>
              <td className="px-4 py-3 hidden md:table-cell">
                <ConfidenceBar score={session.confidence_score} />
              </td>
              <td className="px-4 py-3 hidden lg:table-cell">
                <span className="text-xs text-neutral-500">{session.ai_model_used || "—"}</span>
              </td>
              <td className="px-4 py-3 hidden lg:table-cell">
                <span className="text-xs text-neutral-500">
                  {new Date(session.created_at).toLocaleDateString("en-AU", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                {session.status === "PENDING_REVIEW" && (
                  <Link
                    href={`/dashboard/intake/review/${session.id}`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs font-medium hover:bg-emerald-500/20 transition-colors"
                  >
                    Review <ChevronRight className="w-3 h-3" />
                  </Link>
                )}
                {session.status === "COMMITTED" && (
                  <Link
                    href={`/dashboard/care/participants`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-neutral-800 text-neutral-400 text-xs font-medium hover:bg-neutral-700 transition-colors"
                  >
                    View Participant <ChevronRight className="w-3 h-3" />
                  </Link>
                )}
                {(session.status === "FAILED" || session.status === "REJECTED") && (
                  <button
                    onClick={() => onRetry(session.id)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 text-xs font-medium hover:bg-amber-500/20 transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" /> Retry
                  </button>
                )}
                {(session.status === "ANALYZING" || session.status === "UPLOADING") && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-neutral-500">
                    <Loader2 className="w-3 h-3 animate-spin" /> Processing...
                  </span>
                )}
              </td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Main Page ────────────────────────────────────────── */

export default function IntakeDashboard() {
  const { currentOrg } = useAuthStore();
  const orgId = currentOrg?.id;

  const [sessions, setSessions] = useState<IntakeSession[]>([]);
  const [stats, setStats] = useState<IntakeStats>({
    total: 0, analyzing: 0, pending_review: 0, committed: 0, rejected: 0, failed: 0, avg_confidence: 0,
  });
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");

  const loadData = useCallback(async () => {
    if (!orgId) return;
    const [sessResult, statsResult] = await Promise.all([
      fetchIntakeSessions(orgId, { status: statusFilter }),
      fetchIntakeStats(orgId),
    ]);
    setSessions(sessResult.data);
    setStats(statsResult);
    setLoading(false);
  }, [orgId, statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Realtime subscription for live status updates
  useEffect(() => {
    if (!orgId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`intake-sessions-${orgId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "intake_sessions",
          filter: `organization_id=eq.${orgId}`,
        },
        () => {
          loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId, loadData]);

  const handleUpload = useCallback(
    async (file: File) => {
      if (!orgId) return;
      setUploading(true);
      const formData = new FormData();
      formData.append("file", file);
      const result = await uploadIntakeDocument(orgId, formData);
      if (!result.success) {
        console.error("Upload failed:", result.error);
      }
      setUploading(false);
      loadData();
    },
    [orgId, loadData]
  );

  const handleRetry = useCallback(
    async (sessionId: string) => {
      if (!orgId) return;
      await retryIntakeExtraction(sessionId, orgId);
      loadData();
    },
    [orgId, loadData]
  );

  if (!orgId) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-neutral-500">Select an organization to continue</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-neutral-100 flex items-center gap-2">
            <Brain className="w-5 h-5 text-emerald-400" />
            Oracle Intake
          </h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            AI-powered NDIS plan extraction & onboarding pipeline
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="p-2 rounded-lg border border-neutral-800 hover:bg-neutral-800 text-neutral-400 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <Link
            href="/dashboard/care/participants"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-neutral-800 hover:bg-neutral-800 text-neutral-300 text-sm transition-colors"
          >
            <BarChart3 className="w-4 h-4" />
            Participants
          </Link>
        </div>
      </div>

      {/* Stats */}
      <StatsCards stats={stats} />

      {/* Upload Zone */}
      <UploadZone onUpload={handleUpload} uploading={uploading} />

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 border-b border-neutral-800 pb-0">
        {[
          { value: "all", label: "All" },
          { value: "PENDING_REVIEW", label: "Ready for Review" },
          { value: "ANALYZING", label: "Processing" },
          { value: "COMMITTED", label: "Committed" },
          { value: "FAILED", label: "Failed" },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`px-3 py-2 text-xs font-medium transition-colors border-b-2 -mb-px ${
              statusFilter === tab.value
                ? "text-emerald-400 border-emerald-400"
                : "text-neutral-500 border-transparent hover:text-neutral-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Sessions */}
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center justify-center py-16"
          >
            <Loader2 className="w-6 h-6 text-neutral-600 animate-spin" />
          </motion.div>
        ) : (
          <motion.div
            key="table"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <SessionsTable sessions={sessions} onRetry={handleRetry} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

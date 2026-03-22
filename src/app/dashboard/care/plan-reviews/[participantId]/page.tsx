/**
 * @page /dashboard/care/plan-reviews/[participantId]
 * @status COMPLETE
 * @description Individual participant plan review detail with report generation and AI aggregation
 * @dataSource server-action
 * @lastAudit 2026-03-22
 */
"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo, useState, useTransition } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/hooks/use-query-keys";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Loader2,
  Sparkles,
  RefreshCw,
  FileCheck2,
  Download,
  AlertCircle,
  FileText,
  ChevronDown,
  ArrowRight,
  Clock,
} from "lucide-react";
import { useOrg } from "@/lib/hooks/use-org";
import { useRouter, useParams } from "next/navigation";
import {
  listPlanReviewReportsAction,
  createPlanReviewReportAction,
  startPlanReviewAggregationAction,
  getPlanReviewReportAction,
  updatePlanReviewDraftAction,
  regenerateGoalNarrativeAction,
  finalizePlanReviewAction,
  getFinalPlanReviewDownloadUrlAction,
  setPlanReviewStatusAction,
  listPlanReviewParticipantsAction,
} from "@/app/actions/plan-reviews";
import { LetterAvatar } from "@/components/ui/letter-avatar";

/* ── Types ────────────────────────────────────────────── */

type AggregationStep = {
  label: string;
  status: "pending" | "active" | "done";
};

const AGGREGATION_STEPS: string[] = [
  "Fetching timesheets…",
  "Collating shift notes…",
  "Extracting goal evidence…",
  "Calculating burn rate…",
  "Building narrative…",
];

/* ── Citation Preview ─────────────────────────────────── */

function CitationPreview({
  narrative,
  evidenceByDate,
}: {
  narrative: string;
  evidenceByDate: Record<string, string>;
}) {
  const citations = Array.from(
    new Set((narrative.match(/\[(\d{4}-\d{2}-\d{2})\]/g) || []).map((m) => m.slice(1, -1)))
  );
  if (citations.length === 0) return null;
  return (
    <div className="mt-2 rounded border border-emerald-500/20 bg-emerald-500/5 p-2">
      <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-emerald-300">
        Citation Overlay
      </p>
      <div className="flex flex-wrap gap-1.5">
        {citations.map((date) => (
          <span
            key={date}
            title={evidenceByDate[date] || "No shift-note evidence found for this citation date."}
            className="cursor-help rounded border border-emerald-400/40 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-200"
          >
            {date}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── Error Boundary ───────────────────────────────────── */

class PreviewErrorBoundary extends React.Component<
  { children: React.ReactNode; onRetry: () => void },
  { hasError: boolean; errorMessage: string }
> {
  constructor(props: { children: React.ReactNode; onRetry: () => void }) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, errorMessage: error.message };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full items-center justify-center p-8">
          <div className="max-w-md text-center">
            <AlertCircle className="mx-auto mb-3 h-8 w-8 text-amber-400" />
            <h3 className="text-sm font-semibold text-zinc-200">AI Processing Delay</h3>
            <p className="mt-2 text-xs text-zinc-500">
              The AI encountered a delay processing 365 days of clinical notes.
              Click &ldquo;Retry&rdquo; to run the analysis in smaller chunks.
            </p>
            <p className="mt-1 font-mono text-[10px] text-zinc-700">{this.state.errorMessage}</p>
            <button
              onClick={() => {
                this.setState({ hasError: false, errorMessage: "" });
                this.props.onRetry();
              }}
              className="mt-4 h-8 px-4 rounded-md bg-white text-black text-xs font-semibold hover:bg-zinc-200 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ── PDF Preview Pane ─────────────────────────────────── */

function PdfPreviewPane({ reportId, version }: { reportId: string; version: number }) {
  const [retryKey, setRetryKey] = React.useState(0);
  return (
    <PreviewErrorBoundary onRetry={() => setRetryKey((k) => k + 1)}>
      <iframe
        key={`${reportId}-${version}-${retryKey}`}
        title="Live Plan Review PDF Preview"
        src={`/api/care/plan-reviews/preview?report_id=${reportId}&v=${version}`}
        className="h-full w-full rounded-md border border-white/[0.06] bg-white"
        onError={() => {
          throw new Error("504 Gateway Timeout — Preview render failed");
        }}
      />
    </PreviewErrorBoundary>
  );
}

/* ── Main Workspace Page ──────────────────────────────── */

export default function PlanReviewWorkspacePage() {
  const { orgId } = useOrg();
  const router = useRouter();
  const params = useParams();
  const participantId = params.participantId as string;

  const queryClient = useQueryClient();

  const [reportId, setReportId] = useState("");
  const [report, setReport] = useState<any | null>(null);
  const [snapshot, setSnapshot] = useState<any | null>(null);
  const [draft, setDraft] = useState<any>({});
  const [previewVersion, setPreviewVersion] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);
  const [aggregating, setAggregating] = useState(false);
  const [aggStep, setAggStep] = useState(0);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);

  const activeStatus = report?.status || "draft";
  const isEditable = !["finalized", "archived"].includes(activeStatus);

  // Resolve participant name
  const { data: participantName = "Participant" } = useQuery<string>({
    queryKey: ["care", "planReviewParticipantName", orgId, participantId],
    queryFn: async () => {
      const list = await listPlanReviewParticipantsAction(orgId!);
      const match = list.find((p: any) => p.id === participantId);
      return match?.name ?? "Participant";
    },
    enabled: !!orgId && !!participantId,
  });

  // Load reports for this participant
  const { data: reports = [] } = useQuery<any[]>({
    queryKey: queryKeys.care.planReviewDetail(orgId!, participantId),
    queryFn: async () => {
      const all = await listPlanReviewReportsAction(orgId!);
      return (all || []).filter((r: any) => r.participant_id === participantId);
    },
    enabled: !!orgId && !!participantId,
  });

  // Auto-select first report
  useEffect(() => {
    if (!reportId && reports.length > 0) setReportId(reports[0].id);
  }, [reports, reportId]);

  // Load report detail
  const { data: reportDetailData } = useQuery<{ report: any; snapshot: any }>({
    queryKey: queryKeys.care.planReviewReport(reportId),
    queryFn: () => getPlanReviewReportAction(reportId),
    enabled: !!reportId,
    refetchInterval: reportId && ["aggregating", "draft"].includes(activeStatus) ? 3000 : false,
  });

  // Sync report detail to local state
  useEffect(() => {
    if (reportDetailData) {
      setReport(reportDetailData.report);
      setSnapshot(reportDetailData.snapshot);
      setDraft(reportDetailData.report?.draft_json_payload || {});
      setPreviewVersion((v) => v + 1);
    }
  }, [reportDetailData]);

  // Auto-save draft
  useEffect(() => {
    if (!reportId || !isEditable) return;
    const t = setTimeout(async () => {
      await updatePlanReviewDraftAction({ report_id: reportId, draft_json_payload: draft });
      setPreviewVersion((v) => v + 1);
    }, 600);
    return () => clearTimeout(t);
  }, [draft, reportId, isEditable]);

  const goals = useMemo(() => (Array.isArray(draft?.goals) ? draft.goals : []), [draft]);
  const evidenceByDate = useMemo(() => {
    const rows = Array.isArray(snapshot?.raw_shift_notes_json) ? snapshot.raw_shift_notes_json : [];
    const map: Record<string, string> = {};
    for (const row of rows) {
      const date = String(row?.created_at || "").slice(0, 10);
      if (!date) continue;
      const text = String(row?.outcomes_achieved || row?.context_of_support || row?.summary || "").trim();
      if (!text) continue;
      if (!map[date]) map[date] = text;
    }
    return map;
  }, [snapshot]);

  const handleCreate = async () => {
    if (!orgId || !participantId) return;
    setCreating(true);
    try {
      const created = await createPlanReviewReportAction({
        organization_id: orgId,
        participant_id: participantId,
      });
      setReportId(created.id);
      await queryClient.invalidateQueries({ queryKey: queryKeys.care.planReviewDetail(orgId, participantId) });
    } finally {
      setCreating(false);
    }
  };

  const handleAggregation = async () => {
    if (!reportId) return;
    setAggregating(true);
    setAggStep(0);
    // Simulate multi-step feedback
    const stepInterval = setInterval(() => {
      setAggStep((s) => {
        if (s < AGGREGATION_STEPS.length - 1) return s + 1;
        clearInterval(stepInterval);
        return s;
      });
    }, 1200);
    try {
      await startPlanReviewAggregationAction(reportId);
      await queryClient.invalidateQueries({ queryKey: queryKeys.care.planReviewReport(reportId) });
    } finally {
      clearInterval(stepInterval);
      setAggregating(false);
    }
  };

  const handleFinalize = async () => {
    startTransition(async () => {
      await finalizePlanReviewAction(reportId);
      await queryClient.invalidateQueries({ queryKey: queryKeys.care.planReviewReport(reportId) });
    });
  };

  const handleDownload = async () => {
    const url = await getFinalPlanReviewDownloadUrlAction(reportId);
    if (url) window.open(url, "_blank");
  };

  const handleStatusChange = async (status: "draft" | "pending_manager_review" | "archived") => {
    await setPlanReviewStatusAction({ report_id: reportId, status });
    setStatusDropdownOpen(false);
    await queryClient.invalidateQueries({ queryKey: queryKeys.care.planReviewReport(reportId) });
  };

  const lastSaved = report?.updated_at
    ? `Last saved ${Math.round((Date.now() - new Date(report.updated_at).getTime()) / 60000)}m ago`
    : "";

  return (
    <div className="flex h-full flex-col bg-[#050505]">
      {/* ─── Contextual Header ────────────────────────────── */}
      <div className="flex items-center justify-between h-14 px-8 border-b border-white/5 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => router.push("/dashboard/care/plan-reviews")}
            className="p-1.5 rounded-md hover:bg-white/5 text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <LetterAvatar name={participantName} size={32} />
          <div className="min-w-0">
            <h1 className="text-base font-medium text-white truncate">
              {participantName}&apos;s Plan Review
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
            {activeStatus.replace(/_/g, " ")}
          </span>
          {lastSaved && (
            <>
              <span className="text-zinc-700 text-[10px]">·</span>
              <span className="text-[10px] text-zinc-600">{lastSaved}</span>
            </>
          )}
        </div>
      </div>

      {/* ─── Split Pane ───────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Pane: The Aggregation Engine */}
        <motion.div
          initial={{ x: -10, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
          className="w-[350px] border-r border-white/5 bg-zinc-950/30 flex flex-col h-full overflow-y-auto shrink-0"
        >
          <div className="p-6 space-y-6 flex-1">
            {/* Section 1: Report Selection */}
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-2">
                Report
              </label>
              {reports.length > 0 ? (
                <select
                  value={reportId}
                  onChange={(e) => setReportId(e.target.value)}
                  className="w-full h-9 px-3 bg-zinc-900 border border-white/[0.06] rounded-md text-xs text-zinc-200 outline-none focus:border-zinc-700 transition-colors appearance-none"
                >
                  {reports.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title} ({r.status})
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-xs text-zinc-600">No reports yet.</p>
              )}
              <button
                onClick={handleCreate}
                disabled={creating}
                className="mt-2 w-full h-8 rounded-md bg-white text-black text-xs font-semibold hover:bg-zinc-200 transition-colors active:scale-[0.98] disabled:opacity-40"
              >
                {creating ? "Creating…" : "+ New Plan Review"}
              </button>
            </div>

            {/* Section 2: Data Aggregation */}
            {reportId && (
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-2">
                  Data Aggregation
                </label>
                <button
                  onClick={handleAggregation}
                  disabled={!reportId || aggregating || isPending}
                  className="w-full h-9 px-3 flex items-center justify-between rounded-md border border-white/[0.08] bg-transparent text-xs text-zinc-200 hover:bg-white/5 transition-colors disabled:opacity-40"
                >
                  <span className="flex items-center gap-2">
                    {aggregating ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    Run 365-Day Aggregation
                  </span>
                  <ArrowRight className="w-3 h-3 text-zinc-500" />
                </button>

                {/* Aggregation step feedback */}
                {aggregating && (
                  <div className="mt-3 space-y-1.5">
                    {AGGREGATION_STEPS.map((step, i) => (
                      <div
                        key={step}
                        className={`flex items-center gap-2 text-[11px] transition-colors ${
                          i < aggStep ? "text-emerald-400" : i === aggStep ? "text-white" : "text-zinc-700"
                        }`}
                      >
                        {i < aggStep ? (
                          <div className="w-3 h-3 rounded-full bg-emerald-500/20 flex items-center justify-center">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          </div>
                        ) : i === aggStep ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <div className="w-3 h-3 rounded-full bg-zinc-800" />
                        )}
                        {step}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Section 3: Workflow Status */}
            {reportId && (
              <div>
                <label className="block text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-2">
                  Workflow Status
                </label>
                <div className="relative">
                  <button
                    onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
                    className="w-full h-9 px-3 flex items-center justify-between rounded-md border border-white/[0.08] bg-zinc-900 text-xs text-zinc-200"
                  >
                    <span className="capitalize">{activeStatus.replace(/_/g, " ")}</span>
                    <ChevronDown className="w-3 h-3 text-zinc-500" />
                  </button>
                  {statusDropdownOpen && (
                    <div className="absolute z-10 mt-1 w-full bg-zinc-900 border border-white/[0.08] rounded-md shadow-xl overflow-hidden">
                      {(["draft", "pending_manager_review", "archived"] as const).map((s) => (
                        <button
                          key={s}
                          onClick={() => handleStatusChange(s)}
                          className="w-full px-3 py-2 text-xs text-zinc-300 hover:bg-white/5 text-left capitalize transition-colors"
                        >
                          {s.replace(/_/g, " ")}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Section 4: Draft Editor */}
            {reportId && report && (
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-2">
                    Executive Summary
                  </label>
                  <textarea
                    value={draft?.executive_summary || ""}
                    onChange={(e) => setDraft((d: any) => ({ ...d, executive_summary: e.target.value }))}
                    disabled={!isEditable}
                    rows={5}
                    className="w-full rounded-md border border-white/[0.06] bg-zinc-900/50 p-3 text-xs text-zinc-200 outline-none resize-none placeholder:text-zinc-700 focus:border-zinc-700 transition-colors"
                    placeholder="Write executive summary…"
                  />
                </div>

                {/* Goals */}
                {goals.map((g: any, idx: number) => (
                  <div
                    key={g.goal_id || idx}
                    className="rounded-md border border-white/[0.06] bg-zinc-900/30 p-3"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-zinc-200 truncate">{g.goal_statement}</p>
                        <p className="text-[10px] text-zinc-600 mt-0.5">{g.ndis_goal_category}</p>
                      </div>
                      <button
                        disabled={!isEditable}
                        onClick={async () => {
                          const steer = window.prompt("Steering instructions (optional):", "");
                          await regenerateGoalNarrativeAction({
                            report_id: reportId,
                            goal_id: g.goal_id,
                            steering_instructions: steer || undefined,
                          });
                          await queryClient.invalidateQueries({ queryKey: queryKeys.care.planReviewReport(reportId) });
                        }}
                        className="inline-flex items-center gap-1 rounded border border-white/[0.08] px-2 py-1 text-[10px] text-zinc-400 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-40 shrink-0"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Regen
                      </button>
                    </div>
                    <textarea
                      value={g.summary_narrative || ""}
                      onChange={(e) => {
                        const next = [...goals];
                        next[idx] = { ...g, summary_narrative: e.target.value };
                        setDraft((d: any) => ({ ...d, goals: next }));
                      }}
                      disabled={!isEditable}
                      rows={5}
                      className="w-full rounded-md border border-white/[0.06] bg-black/30 p-2 text-[11px] text-zinc-300 outline-none resize-none"
                    />
                    <CitationPreview narrative={g.summary_narrative || ""} evidenceByDate={evidenceByDate} />
                  </div>
                ))}

                {!!snapshot?.raw_shift_notes_json && (
                  <p className="text-[10px] text-zinc-600">
                    Evidence snapshot sealed:{" "}
                    <span className="font-mono">
                      {Array.isArray(snapshot.raw_shift_notes_json) ? snapshot.raw_shift_notes_json.length : 0}
                    </span>{" "}
                    goal-linked notes
                  </p>
                )}
              </div>
            )}
          </div>
        </motion.div>

        {/* Right Pane: The PDF Canvas */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="flex-1 bg-[#050505] flex flex-col relative"
        >
          {/* Floating Toolbar */}
          {reportId && (
            <div className="absolute top-4 right-4 z-10 flex gap-2 bg-zinc-900/80 backdrop-blur-md p-1.5 rounded-lg border border-white/10">
              <button
                onClick={handleFinalize}
                disabled={!reportId || !isEditable || isPending}
                className="h-7 px-3 rounded-md bg-emerald-500/10 text-emerald-400 text-[11px] font-semibold hover:bg-emerald-500/20 transition-colors disabled:opacity-40"
              >
                {isPending ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="w-3 h-3 animate-spin" /> Generating…
                  </span>
                ) : (
                  "Generate PDF"
                )}
              </button>
              <button
                onClick={handleDownload}
                disabled={!reportId || activeStatus !== "finalized"}
                className="h-7 w-7 flex items-center justify-center rounded-md border border-white/[0.08] text-zinc-400 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-30"
                title="Download Final PDF"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Content */}
          {!reportId ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="flex flex-col items-center justify-center max-w-sm text-center px-8">
                <div className="w-16 h-16 rounded-xl border-2 border-dashed border-white/5 flex items-center justify-center mb-4">
                  <FileText className="w-8 h-8 text-zinc-800" />
                </div>
                <p className="text-sm text-zinc-500 leading-relaxed">
                  Configure your report parameters on the left and run the aggregation to preview the document.
                </p>
                <p className="text-[10px] text-zinc-700 mt-2">
                  Select or create a report to begin.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex-1 p-2">
              <PdfPreviewPane reportId={reportId} version={previewVersion} />
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/hooks/use-query-keys";
import { Loader2, Sparkles, RefreshCw, FileCheck2, Download, AlertCircle } from "lucide-react";
import { useOrg } from "@/lib/hooks/use-org";
import {
  listPlanReviewParticipantsAction,
  listPlanReviewReportsAction,
  createPlanReviewReportAction,
  startPlanReviewAggregationAction,
  getPlanReviewReportAction,
  updatePlanReviewDraftAction,
  regenerateGoalNarrativeAction,
  finalizePlanReviewAction,
  getFinalPlanReviewDownloadUrlAction,
  setPlanReviewStatusAction,
} from "@/app/actions/plan-reviews";

type ParticipantOption = { id: string; name: string };

export default function PlanReviewsBuildPage() {
  const { orgId } = useOrg();
  const queryClient = useQueryClient();
  const [selectedParticipant, setSelectedParticipant] = useState("");
  const [reportId, setReportId] = useState("");
  const [report, setReport] = useState<any | null>(null);
  const [snapshot, setSnapshot] = useState<any | null>(null);
  const [draft, setDraft] = useState<any>({});
  const [previewVersion, setPreviewVersion] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);

  const activeStatus = report?.status || "draft";
  const isEditable = !["finalized", "archived"].includes(activeStatus);

  interface BuildBaseData {
    participants: ParticipantOption[];
    reports: any[];
  }

  const { data: baseData } = useQuery<BuildBaseData>({
    queryKey: queryKeys.care.planReviewBuild(orgId!),
    queryFn: async () => {
      const [p, r] = await Promise.all([
        listPlanReviewParticipantsAction(orgId!),
        listPlanReviewReportsAction(orgId!),
      ]);
      return { participants: p, reports: r };
    },
    enabled: !!orgId,
  });

  const participants = baseData?.participants ?? [];
  const reports = baseData?.reports ?? [];

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

  useEffect(() => {
    if (!reportId || !isEditable) return;
    const t = setTimeout(async () => {
      await updatePlanReviewDraftAction({
        report_id: reportId,
        draft_json_payload: draft,
      });
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
    if (!orgId || !selectedParticipant) return;
    setCreating(true);
    try {
      const created = await createPlanReviewReportAction({
        organization_id: orgId,
        participant_id: selectedParticipant,
      });
      setReportId(created.id);
      await queryClient.invalidateQueries({ queryKey: queryKeys.care.planReviewBuild(orgId!) });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="h-full bg-[var(--background)]">
      <div className="stealth-noise" />
      <div className="flex h-full flex-col">
        <div className="border-b border-white/[0.06] px-5 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] tracking-widest text-[var(--text-muted)] uppercase">PLAN REVIEW BUILDER</span>
            <span className="rounded border border-white/[0.08] px-2 py-0.5 text-[10px] text-zinc-400">
              Status: {activeStatus}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <select
              value={selectedParticipant}
              onChange={(e) => setSelectedParticipant(e.target.value)}
              className="rounded-md border border-white/[0.08] bg-white/[0.02] px-2 py-1 text-[12px] text-zinc-200"
            >
              <option value="">Select participant...</option>
              {participants.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <button
              onClick={handleCreate}
              disabled={!selectedParticipant || creating}
              className="rounded-md bg-white px-3 py-1 text-[12px] font-semibold text-black hover:bg-zinc-200 transition-colors active:scale-95 disabled:opacity-50"
            >
              {creating ? "Creating..." : "+ New Plan Review"}
            </button>

            <select
              value={reportId}
              onChange={(e) => setReportId(e.target.value)}
              className="rounded-md border border-white/[0.08] bg-white/[0.02] px-2 py-1 text-[12px] text-zinc-200"
            >
              <option value="">Select report...</option>
              {reports.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title} ({r.status})
                </option>
              ))}
            </select>

            <button
              disabled={!reportId || isPending}
              onClick={() => startTransition(async () => {
                await startPlanReviewAggregationAction(reportId);
                await queryClient.invalidateQueries({ queryKey: queryKeys.care.planReviewReport(reportId) });
              })}
              className="inline-flex items-center gap-1 rounded-md border border-white/[0.1] px-3 py-1 text-[12px] text-zinc-200 disabled:opacity-50"
            >
              {isPending ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              Run 365-Day Aggregation
            </button>

            <button
              disabled={!reportId}
              onClick={() => setPlanReviewStatusAction({ report_id: reportId, status: "pending_manager_review" })}
              className="inline-flex items-center gap-1 rounded-md border border-white/[0.1] px-3 py-1 text-[12px] text-zinc-200 disabled:opacity-50"
            >
              <FileCheck2 size={12} />
              Mark Pending Manager Review
            </button>

            <button
              disabled={!reportId || !isEditable}
              onClick={() => startTransition(async () => {
                await finalizePlanReviewAction(reportId);
                await queryClient.invalidateQueries({ queryKey: queryKeys.care.planReviewReport(reportId) });
              })}
              className="rounded-md bg-emerald-500/10 px-3 py-1 text-[12px] font-semibold text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
            >
              Finalize & Generate PDF
            </button>

            <button
              disabled={!reportId}
              onClick={async () => {
                const url = await getFinalPlanReviewDownloadUrlAction(reportId);
                if (url) window.open(url, "_blank");
              }}
              className="inline-flex items-center gap-1 rounded-md border border-white/[0.1] px-3 py-1 text-[12px] text-zinc-200 disabled:opacity-50"
            >
              <Download size={12} />
              Download Final
            </button>
          </div>
        </div>

        <div className="grid h-[calc(100vh-170px)] grid-cols-1 gap-0 lg:grid-cols-2">
          <div className="overflow-y-auto border-r border-white/[0.06] p-4">
            {!reportId ? (
              <p className="text-[13px] text-zinc-500">Create or select a report to begin.</p>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-[11px] text-zinc-500">Executive Summary</label>
                  <textarea
                    value={draft?.executive_summary || ""}
                    onChange={(e) => setDraft((d: any) => ({ ...d, executive_summary: e.target.value }))}
                    disabled={!isEditable}
                    rows={6}
                    className="w-full rounded-md border border-white/[0.08] bg-white/[0.02] p-2 text-[13px] text-zinc-200 outline-none"
                  />
                </div>

                {goals.map((g: any, idx: number) => (
                  <div key={g.goal_id || idx} className="rounded-md border border-white/[0.06] bg-white/[0.01] p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div>
                        <p className="text-[12px] font-medium text-zinc-200">{g.goal_statement}</p>
                        <p className="text-[10px] text-zinc-500">{g.ndis_goal_category}</p>
                      </div>
                      <button
                        disabled={!isEditable}
                        onClick={async () => {
                          const steer = window.prompt("Regeneration steering instructions (optional):", "");
                          await regenerateGoalNarrativeAction({
                            report_id: reportId,
                            goal_id: g.goal_id,
                            steering_instructions: steer || undefined,
                          });
                          await queryClient.invalidateQueries({ queryKey: queryKeys.care.planReviewReport(reportId) });
                        }}
                        className="inline-flex items-center gap-1 rounded border border-white/[0.1] px-2 py-1 text-[11px] text-zinc-300 disabled:opacity-50"
                      >
                        <RefreshCw size={11} />
                        Regenerate
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
                      rows={7}
                      className="w-full rounded-md border border-white/[0.08] bg-black/30 p-2 text-[12px] text-zinc-200 outline-none"
                    />
                    <CitationPreview narrative={g.summary_narrative || ""} evidenceByDate={evidenceByDate} />
                  </div>
                ))}
                {!!snapshot?.raw_shift_notes_json && (
                  <p className="text-[10px] text-zinc-500">
                    Evidence snapshot sealed: {Array.isArray(snapshot.raw_shift_notes_json) ? snapshot.raw_shift_notes_json.length : 0} goal-linked notes
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="h-full bg-[#0b0b0b] p-2">
            {!reportId ? (
              <div className="flex h-full items-center justify-center text-[13px] text-zinc-600">
                Live PDF preview appears here.
              </div>
            ) : (
              <PlanReviewPreviewPane reportId={reportId} version={previewVersion} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CitationPreview({
  narrative,
  evidenceByDate,
}: {
  narrative: string;
  evidenceByDate: Record<string, string>;
}) {
  const citations = Array.from(new Set((narrative.match(/\[(\d{4}-\d{2}-\d{2})\]/g) || []).map((m) => m.slice(1, -1))));
  if (citations.length === 0) return null;
  return (
    <div className="mt-2 rounded border border-emerald-500/20 bg-emerald-500/5 p-2">
      <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-emerald-300">Citation Overlay</p>
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

class PlanReviewErrorBoundary extends React.Component<
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
            <h3 className="text-[14px] font-semibold text-zinc-200">
              AI Processing Delay
            </h3>
            <p className="mt-2 text-[12px] text-zinc-500">
              The AI encountered a delay processing 365 days of clinical notes.
              Please click &ldquo;Retry&rdquo; to run the analysis in smaller chronological chunks.
            </p>
            <p className="mt-1 font-mono text-[10px] text-zinc-700">
              {this.state.errorMessage}
            </p>
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

function PlanReviewPreviewPane({ reportId, version }: { reportId: string; version: number }) {
  const [retryKey, setRetryKey] = React.useState(0);
  return (
    <PlanReviewErrorBoundary onRetry={() => setRetryKey((k) => k + 1)}>
      <iframe
        key={`${reportId}-${version}-${retryKey}`}
        title="Live Plan Review PDF Preview"
        src={`/api/care/plan-reviews/preview?report_id=${reportId}&v=${version}`}
        className="h-full w-full rounded-md border border-white/[0.08] bg-white"
        onError={() => {
          throw new Error("504 Gateway Timeout — Preview render failed");
        }}
      />
    </PlanReviewErrorBoundary>
  );
}

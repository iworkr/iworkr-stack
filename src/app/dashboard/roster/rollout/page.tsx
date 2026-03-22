/**
 * @page /dashboard/roster/rollout
 * @status COMPLETE
 * @description Roster rollout preview with conflict detection and publish workflow
 * @dataSource server-action
 * @lastAudit 2026-03-22
 */
"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Check,
  X,
  AlertTriangle,
  Calendar,
  Clock,
  Users,
  Shield,
  DollarSign,
  ChevronRight,
  Loader2,
  Play,
  Ban,
  Flag,
} from "lucide-react";
import { useOrg } from "@/lib/hooks/use-org";
import {
  generateRolloutPreview,
  commitRollout,
  type RolloutPreview,
  type RolloutProjection,
  type RolloutConflict,
} from "@/app/actions/roster-templates";
import { LetterAvatar } from "@/components/ui/letter-avatar";

/* ── Constants & Helpers ──────────────────────────────────── */

const conflictStyles: Record<
  string,
  { bg: string; text: string; label: string; icon: typeof Shield }
> = {
  leave: { bg: "bg-amber-500/15", text: "text-amber-400", label: "Worker Leave", icon: Users },
  compliance: { bg: "bg-red-500/15", text: "text-red-400", label: "Compliance", icon: Shield },
  budget: { bg: "bg-red-500/15", text: "text-red-400", label: "Budget Exceeded", icon: DollarSign },
  plan_expiry: { bg: "bg-red-500/15", text: "text-red-400", label: "Plan Expired", icon: Calendar },
  public_holiday: { bg: "bg-amber-500/15", text: "text-amber-400", label: "Public Holiday", icon: Flag },
  fatigue: { bg: "bg-red-500/15", text: "text-red-400", label: "Fatigue Breach", icon: Clock },
};

function groupByDate(projections: RolloutProjection[]): Map<string, RolloutProjection[]> {
  const map = new Map<string, RolloutProjection[]>();
  for (const p of projections) {
    const existing = map.get(p.target_date) || [];
    existing.push(p);
    map.set(p.target_date, existing);
  }
  return map;
}

function formatDate(dateStr: string): { dayName: string; formatted: string } {
  const d = new Date(dateStr + "T00:00:00");
  return {
    dayName: d.toLocaleDateString("en-AU", { weekday: "long" }),
    formatted: d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }),
  };
}

function formatTime(datetime: string): string {
  const d = new Date(datetime);
  return d.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function formatDateRange(start: string, end: string): string {
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  const sStr = s.toLocaleDateString("en-AU", { month: "short", day: "numeric" });
  const eStr = e.toLocaleDateString("en-AU", { month: "short", day: "numeric", year: "numeric" });
  return `${sStr} → ${eStr}`;
}

function getInitials(name: string | null): string {
  if (!name) return "??";
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function getNextMonday(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 1 : 8 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split("T")[0];
}

/* ── Page Component ───────────────────────────────────────── */

export default function RolloutReviewPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { orgId, userId, loading: orgLoading } = useOrg();

  const templateId = searchParams.get("template");
  const startParam = searchParams.get("start");
  const weeksParam = searchParams.get("weeks");

  const [preview, setPreview] = useState<RolloutPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [committing, setCommitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [committed, setCommitted] = useState(false);

  /* ── Load Preview ────────────────────────────────────────── */

  const loadPreview = useCallback(async () => {
    if (!templateId || !orgId) return;
    setLoading(true);
    setError(null);
    try {
      const start = startParam || getNextMonday();
      const weeks = weeksParam ? parseInt(weeksParam, 10) : 4;
      const result = await generateRolloutPreview(templateId, orgId, start, weeks);
      setPreview(result);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to generate preview");
    } finally {
      setLoading(false);
    }
  }, [templateId, orgId, startParam, weeksParam]);

  useEffect(() => {
    if (!orgLoading && orgId && templateId) {
      loadPreview();
    } else if (!orgLoading && !templateId) {
      setLoading(false);
    }
  }, [orgLoading, orgId, templateId, loadPreview]);

  /* ── Commit Handler ──────────────────────────────────────── */

  const handleCommit = useCallback(async () => {
    if (!preview || !orgId || !userId) return;
    setCommitting(true);
    try {
      const result = await commitRollout(preview, orgId, userId);
      if (result.success) {
        setCommitted(true);
        setShowConfirmModal(false);
        setTimeout(() => { router.push("/dashboard/schedule"); }, 1800);
      } else {
        setError(result.error || "Commit failed");
        setShowConfirmModal(false);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Commit failed unexpectedly");
      setShowConfirmModal(false);
    } finally {
      setCommitting(false);
    }
  }, [preview, orgId, userId, router]);

  /* ── Derived Data ────────────────────────────────────────── */

  const successfulProjections = useMemo(
    () => preview?.projections.filter((p) => p.status === "ok" || p.status === "flagged") || [],
    [preview],
  );

  const skippedProjections = useMemo(
    () => preview?.projections.filter((p) => p.status === "skipped") || [],
    [preview],
  );

  const groupedSuccess = useMemo(() => groupByDate(successfulProjections), [successfulProjections]);

  const unassignedCount = useMemo(
    () => preview?.projections.filter((p) => p.status === "conflict" && p.conflict?.resolution?.type === "unassigned").length || 0,
    [preview],
  );

  const committableCount = useMemo(
    () => (preview?.summary.ok || 0) + (preview?.summary.flagged || 0) + unassignedCount,
    [preview, unassignedCount],
  );

  /* ── No Template → Empty State ──────────────────────────── */

  if (!templateId && !loading) {
    return (
      <div className="relative flex h-full flex-col bg-[var(--background)]">
        <div className="stealth-noise" />
        <div className="flex-1 flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-md w-full"
          >
            <div className="border border-white/[0.04] rounded-xl bg-[var(--surface-1)] p-8 text-center">
              <div className="w-14 h-14 rounded-full bg-white/[0.03] flex items-center justify-center mx-auto mb-5">
                <Calendar className="w-7 h-7 text-zinc-500" />
              </div>
              <h2 className="text-lg font-semibold text-zinc-100 mb-2">No Template Selected</h2>
              <p className="text-sm text-zinc-500 mb-6 leading-relaxed">
                Select a template from the Master Roster to preview a rollout.
              </p>
              <button
                onClick={() => router.push("/dashboard/roster/master")}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Go to Master Roster
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  /* ── Loading State ───────────────────────────────────────── */

  if (loading || orgLoading) {
    return (
      <div className="relative flex h-full flex-col bg-[var(--background)]">
        <div className="stealth-noise" />
        <div className="sticky top-0 z-20 border-b border-white/[0.04] bg-zinc-950/80 backdrop-blur-xl">
          <div className="flex items-center px-5 py-2.5 gap-3">
            <span className="font-mono text-[10px] font-bold tracking-widest text-[var(--text-muted)] uppercase">ROLLOUT PREVIEW</span>
          </div>
        </div>
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="border border-white/[0.03] rounded-xl bg-[var(--surface-1)] p-4">
                <div className="h-3 w-20 bg-zinc-800/50 rounded animate-pulse mb-3" />
                <div className="h-7 w-12 bg-zinc-800/50 rounded animate-pulse" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-12 gap-4">
            <div className="col-span-7 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="border border-white/[0.03] rounded-xl bg-[var(--surface-1)] p-4">
                  <div className="h-4 w-40 bg-zinc-800/50 rounded animate-pulse mb-3" />
                  <div className="h-16 bg-zinc-800/30 rounded animate-pulse" />
                </div>
              ))}
            </div>
            <div className="col-span-5 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="border border-white/[0.03] rounded-xl bg-[var(--surface-1)] p-4">
                  <div className="h-4 w-32 bg-zinc-800/50 rounded animate-pulse mb-3" />
                  <div className="h-20 bg-zinc-800/30 rounded animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Error State ────────────────────────────────────────── */

  if (error && !preview) {
    return (
      <div className="relative flex h-full flex-col bg-[var(--background)]">
        <div className="stealth-noise" />
        <div className="flex-1 flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-md w-full border border-red-900/30 rounded-xl bg-[var(--surface-1)] p-8 text-center"
          >
            <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-5">
              <X className="w-7 h-7 text-red-400" />
            </div>
            <h2 className="text-lg font-semibold text-zinc-100 mb-2">Rollout Preview Failed</h2>
            <p className="text-sm text-red-400/80 mb-6">{error}</p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => router.push("/dashboard/roster/master")}
                className="px-4 py-2 rounded-lg border border-white/[0.06] text-zinc-400 text-sm hover:bg-white/[0.03] transition-colors"
              >
                Back to Master
              </button>
              <button
                onClick={loadPreview}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-500 transition-colors"
              >
                Retry
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  if (!preview) return null;

  /* ── Main Render ────────────────────────────────────────── */

  return (
    <div className="relative flex h-full flex-col bg-[var(--background)]">
      {/* Noise texture */}
      <div className="stealth-noise" />
      {/* Atmospheric glow */}
      <div
        className="pointer-events-none absolute top-0 left-0 right-0 h-64 z-0"
        style={{ background: "radial-gradient(ellipse at center top, rgba(255,255,255,0.015) 0%, transparent 60%)" }}
      />

      {/* ── Success Overlay ─────────────────────────────────── */}
      <AnimatePresence>
        {committed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[var(--background)]/90 backdrop-blur-sm flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", damping: 20, stiffness: 300 }}
              className="text-center"
            >
              <div className="w-20 h-20 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto mb-6 ring-1 ring-emerald-500/30">
                <Check className="w-10 h-10 text-emerald-400" />
              </div>
              <h2 className="text-2xl font-semibold text-zinc-100 mb-2 tracking-tight">Rollout Committed</h2>
              <p className="text-sm text-zinc-500">{committableCount} shifts pushed to live roster. Redirecting…</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Confirm Modal ───────────────────────────────────── */}
      <AnimatePresence>
        {showConfirmModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6"
            onClick={() => !committing && setShowConfirmModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="max-w-lg w-full border border-white/[0.06] rounded-xl bg-[#0A0A0A]/95 backdrop-blur-xl p-6"
            >
              <div className="flex items-start gap-4 mb-6">
                <div className="w-10 h-10 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0 mt-0.5">
                  <Play className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-zinc-100 mb-1">Commit Rollout to Live Roster?</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    This will create{" "}
                    <span className="text-zinc-100 font-medium">
                      {preview.summary.ok + preview.summary.flagged} live shifts
                    </span>
                    {unassignedCount > 0 && (
                      <>
                        {" "}and{" "}
                        <span className="text-amber-400 font-medium">{unassignedCount} unassigned shifts</span>{" "}
                        requiring immediate cover
                      </>
                    )}
                    .{" "}
                    {preview.summary.skipped > 0 && (
                      <>{preview.summary.skipped} shifts will be skipped (holiday cancellations).</>
                    )}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-6">
                <div className="rounded-lg bg-emerald-500/[0.06] border border-emerald-500/20 p-3 text-center">
                  <div className="text-lg font-semibold text-emerald-400 font-mono">{preview.summary.ok}</div>
                  <div className="text-[11px] text-emerald-500/70 uppercase tracking-wider mt-0.5">Clean</div>
                </div>
                <div className="rounded-lg bg-amber-500/[0.06] border border-amber-500/20 p-3 text-center">
                  <div className="text-lg font-semibold text-amber-400 font-mono">{preview.summary.flagged}</div>
                  <div className="text-[11px] text-amber-500/70 uppercase tracking-wider mt-0.5">Flagged</div>
                </div>
                <div className="rounded-lg bg-red-500/[0.06] border border-red-500/20 p-3 text-center">
                  <div className="text-lg font-semibold text-red-400 font-mono">{preview.summary.conflicts}</div>
                  <div className="text-[11px] text-red-500/70 uppercase tracking-wider mt-0.5">Conflicts</div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  disabled={committing}
                  className="px-4 py-2 rounded-lg border border-white/[0.06] text-zinc-400 text-sm hover:bg-white/[0.03] transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCommit}
                  disabled={committing}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors disabled:opacity-70"
                >
                  {committing ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Committing…</>
                  ) : (
                    <><Check className="w-4 h-4" /> Confirm &amp; Commit</>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Command Bar Header ────────────────────────────────── */}
      <div className="sticky top-0 z-20 border-b border-white/[0.04] bg-zinc-950/80 backdrop-blur-xl">
        <div className="flex items-center justify-between px-5 py-2.5">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/dashboard/roster/master")}
              className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors group"
            >
              <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
              Master Roster
            </button>
            <span className="text-zinc-800">·</span>
            <span className="font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">
              ROLLOUT PREVIEW
            </span>
            <span className="text-zinc-800">·</span>
            <span className="text-[11px] text-zinc-300 font-medium">{preview.template_name}</span>
            <span className="text-[11px] text-zinc-600 font-mono">
              {formatDateRange(preview.rollout_start, preview.rollout_end)}
            </span>
          </div>
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowConfirmModal(true)}
            disabled={committed}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium text-white bg-emerald-600 hover:bg-emerald-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Play className="w-3 h-3" />
            Commit to Live Roster
          </motion.button>
        </div>
      </div>

      {/* ── Page Content ─────────────────────────────────────── */}
      <div className="relative z-10 flex-1 overflow-y-auto scrollbar-none">
        <div className="max-w-[1440px] mx-auto px-6 py-6 pb-24">
          {/* ── Summary Stats Bar ────────────────────────────────── */}
          <div className="grid grid-cols-5 gap-3 mb-6">
            <StatCard label="Total Shifts" value={preview.summary.total} color="white" />
            <StatCard label="Successful" value={preview.summary.ok} color="emerald" icon={<Check className="w-3.5 h-3.5" />} />
            <StatCard label="Conflicts" value={preview.summary.conflicts} color="red" icon={<X className="w-3.5 h-3.5" />} />
            <StatCard label="Flagged" value={preview.summary.flagged} color="amber" icon={<AlertTriangle className="w-3.5 h-3.5" />} />
            <StatCard label="Skipped" value={preview.summary.skipped} color="zinc" icon={<Ban className="w-3.5 h-3.5" />} />
          </div>

          {/* ── Main Content — Split Panel ───────────────────────── */}
          <div className="grid grid-cols-12 gap-4">
            {/* ── Left: Successful Projections ──────────────────────── */}
            <div className="col-span-7">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <h2 className="font-mono text-[9px] font-bold tracking-widest text-zinc-500 uppercase">
                  Successful Projections
                </h2>
                <span className="text-[10px] text-zinc-700 font-mono ml-auto">{successfulProjections.length} shifts</span>
              </div>

              <div className="space-y-4">
                {Array.from(groupedSuccess.entries()).map(([date, projections], groupIdx) => {
                  const { dayName, formatted } = formatDate(date);
                  return (
                    <motion.div
                      key={date}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: groupIdx * 0.03, duration: 0.3 }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">{dayName}</span>
                        <span className="text-[10px] text-zinc-600 font-mono">{formatted}</span>
                        {projections.some((p) => p.is_public_holiday) && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 text-[9px] font-medium uppercase tracking-wider">
                            <Flag className="w-2.5 h-2.5" />
                            Public Holiday
                          </span>
                        )}
                      </div>
                      <div className="space-y-1">
                        {projections.map((proj, shiftIdx) => (
                          <ShiftCard key={`${proj.template_shift_id}-${proj.target_date}-${shiftIdx}`} projection={proj} />
                        ))}
                      </div>
                    </motion.div>
                  );
                })}

                {successfulProjections.length === 0 && (
                  <div className="border border-white/[0.03] rounded-xl bg-[var(--surface-1)] p-8 text-center">
                    <p className="text-sm text-zinc-500">No successful projections. All shifts have conflicts.</p>
                  </div>
                )}
              </div>

              {/* Skipped / Holiday Cancellations */}
              {skippedProjections.length > 0 && (
                <div className="mt-8">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full bg-zinc-600" />
                    <h2 className="font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">
                      Skipped — Holiday Cancellations
                    </h2>
                    <span className="text-[10px] text-zinc-700 font-mono ml-auto">{skippedProjections.length} shifts</span>
                  </div>
                  <div className="space-y-1">
                    {skippedProjections.map((proj, i) => (
                      <motion.div
                        key={`skipped-${proj.template_shift_id}-${proj.target_date}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.02 }}
                        className="flex items-center gap-3 px-4 py-2 rounded-lg border border-white/[0.02] bg-white/[0.01] opacity-60"
                      >
                        <Ban className="w-4 h-4 text-zinc-700 shrink-0" />
                        <span className="text-[11px] text-zinc-600 font-mono">{formatDate(proj.target_date).formatted}</span>
                        <span className="text-[11px] text-zinc-600 font-mono">{formatTime(proj.start_datetime)} – {formatTime(proj.end_datetime)}</span>
                        <span className="text-[11px] text-zinc-700 line-through">{proj.title || proj.support_purpose || "Care Shift"}</span>
                        <span className="ml-auto px-2 py-0.5 rounded-full bg-white/[0.03] text-zinc-700 text-[9px] font-medium uppercase">Cancelled</span>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── Right: Conflicts & Warnings ───────────────────────── */}
            <div className="col-span-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <h2 className="font-mono text-[9px] font-bold tracking-widest text-zinc-500 uppercase">
                  Conflicts &amp; Warnings
                </h2>
                <span className="text-[10px] text-zinc-700 font-mono ml-auto">{preview.conflicts.length} issues</span>
              </div>

              {preview.conflicts.length > 0 ? (
                <div className="space-y-2">
                  {preview.conflicts.map((conflict, i) => (
                    <ConflictCard
                      key={`${conflict.template_shift_id}-${conflict.target_date}-${conflict.conflict_type}-${i}`}
                      conflict={conflict}
                      index={i}
                    />
                  ))}
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="border border-emerald-500/20 rounded-xl bg-emerald-500/[0.04] p-8 text-center"
                >
                  <div className="w-12 h-12 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto mb-4">
                    <Check className="w-6 h-6 text-emerald-400" />
                  </div>
                  <p className="text-sm text-emerald-400/80 font-medium">No conflicts detected</p>
                  <p className="text-xs text-zinc-600 mt-1">All shifts passed leave, compliance, budget, and holiday checks.</p>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom Sticky Action Bar ──────────────────────────── */}
      <div className="border-t border-white/[0.03] bg-[var(--surface-1)] px-5 py-2.5 flex items-center justify-between">
        <button
          onClick={() => router.push("/dashboard/roster/master")}
          className="inline-flex items-center gap-1.5 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Templates
        </button>

        <div className="flex items-center gap-4">
          {preview.summary.conflicts > 0 && (
            <div className="flex items-center gap-2 text-[11px]">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 text-[10px] font-medium">
                <X className="w-3 h-3" />
                {preview.summary.conflicts}
              </span>
              <span className="text-zinc-600">conflict{preview.summary.conflicts !== 1 ? "s" : ""}</span>
            </div>
          )}

          {unassignedCount > 0 && (
            <p className="text-[10px] text-amber-500/80 max-w-xs">
              {unassignedCount} conflict{unassignedCount !== 1 ? "s" : ""} will create unassigned shifts
            </p>
          )}

          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowConfirmModal(true)}
            disabled={committed}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[12px] font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50"
          >
            <Check className="w-3.5 h-3.5" />
            Commit {committableCount} Shift{committableCount !== 1 ? "s" : ""}
          </motion.button>
        </div>
      </div>
    </div>
  );
}

/* ── StatCard Sub-Component ───────────────────────────────── */

function StatCard({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: number;
  color: "white" | "emerald" | "red" | "amber" | "zinc";
  icon?: React.ReactNode;
}) {
  const styles: Record<string, { pill: string; number: string; border: string }> = {
    white: { pill: "", number: "text-zinc-100", border: "border-white/[0.03]" },
    emerald: { pill: "bg-emerald-500/15 text-emerald-400", number: "text-emerald-400", border: "border-emerald-500/15" },
    red: { pill: "bg-red-500/15 text-red-400", number: "text-red-400", border: "border-red-500/15" },
    amber: { pill: "bg-amber-500/15 text-amber-400", number: "text-amber-400", border: "border-amber-500/15" },
    zinc: { pill: "bg-zinc-700/30 text-zinc-500", number: "text-zinc-500", border: "border-white/[0.02]" },
  };

  const s = styles[color];

  return (
    <div className={`border ${s.border} rounded-xl bg-[var(--surface-1)] p-4 flex flex-col justify-between`}>
      <div className="flex items-center justify-between mb-3">
        <span className="font-mono text-[9px] font-bold tracking-widest text-zinc-600 uppercase">{label}</span>
        {icon && (
          <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full ${s.pill}`}>{icon}</span>
        )}
      </div>
      <span className={`text-2xl font-semibold font-mono ${s.number} tracking-tight`}>{value}</span>
    </div>
  );
}

/* ── ShiftCard Sub-Component ──────────────────────────────── */

function ShiftCard({ projection }: { projection: RolloutProjection }) {
  const isFlagged = projection.status === "flagged";

  return (
    <div
      className={`flex items-center gap-4 px-4 py-2.5 rounded-lg border transition-colors group ${
        isFlagged
          ? "border-amber-500/20 hover:border-amber-500/30 bg-amber-500/[0.02]"
          : "border-white/[0.03] hover:border-white/[0.06] bg-white/[0.01]"
      }`}
    >
      {/* Time range */}
      <div className="shrink-0">
        <span className="font-mono text-[12px] text-zinc-300">{formatTime(projection.start_datetime)}</span>
        <span className="text-zinc-700 mx-1">–</span>
        <span className="font-mono text-[12px] text-zinc-300">{formatTime(projection.end_datetime)}</span>
      </div>

      <div className="w-px h-6 bg-white/[0.04]" />

      {/* Worker */}
      <div className="flex items-center gap-2 min-w-0">
        <LetterAvatar
          name={projection.assigned_worker_name || "?"}
          size={24}
          className={projection.assigned_worker_id ? "ring-1 ring-emerald-500/20" : "ring-1 ring-red-500/20"}
        />
        <span className="text-[12px] text-zinc-300 truncate">
          {projection.assigned_worker_name || <span className="text-red-400 italic">Unassigned</span>}
        </span>
      </div>

      <span className="text-[11px] text-zinc-600 truncate hidden lg:block">
        {projection.title || projection.support_purpose || ""}
      </span>

      {projection.ndis_line_item && (
        <span className="ml-auto shrink-0 px-2 py-0.5 rounded bg-white/[0.03] text-[9px] font-mono text-zinc-600 uppercase">
          {projection.ndis_line_item}
        </span>
      )}

      {projection.is_public_holiday && (
        <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 text-[9px] font-medium">
          <Flag className="w-2.5 h-2.5" />
          PH
        </span>
      )}

      {isFlagged && <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
      {projection.status === "ok" && (
        <Check className="w-3.5 h-3.5 text-emerald-500/50 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
    </div>
  );
}

/* ── ConflictCard Sub-Component ───────────────────────────── */

function ConflictCard({ conflict, index }: { conflict: RolloutConflict; index: number }) {
  const style = conflictStyles[conflict.conflict_type] || {
    bg: "bg-zinc-500/15", text: "text-zinc-400", label: conflict.conflict_type, icon: AlertTriangle,
  };
  const Icon = style.icon;
  const { formatted } = formatDate(conflict.target_date);
  const isHardBlock = conflict.severity === "hard_block";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.25 }}
      className={`border ${
        isHardBlock ? "border-red-500/20" : "border-amber-500/15"
      } rounded-xl bg-[var(--surface-1)] p-4 transition-colors hover:bg-white/[0.02]`}
    >
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-lg ${style.bg} flex items-center justify-center shrink-0`}>
            <Icon className={`w-3.5 h-3.5 ${style.text}`} />
          </div>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider ${style.bg} ${style.text}`}>
            {style.label}
          </span>
        </div>
        <span className={`shrink-0 px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider ${
          isHardBlock ? "bg-red-500/15 text-red-400" : "bg-amber-500/15 text-amber-400"
        }`}>
          {isHardBlock ? "Hard Block" : "Warning"}
        </span>
      </div>

      <div className="flex items-center gap-2 text-[11px] text-zinc-500 mb-2">
        <Calendar className="w-3 h-3" />
        <span className="font-mono">{formatted}</span>
      </div>

      <p className="text-sm text-zinc-400 leading-relaxed mb-3">{conflict.message}</p>

      {conflict.resolution && (
        <div className={`rounded-lg px-3 py-2 ${
          conflict.resolution.type === "backup_worker"
            ? "bg-emerald-500/[0.06] border border-emerald-500/15"
            : conflict.resolution.type === "unassigned"
              ? "bg-red-500/[0.06] border border-red-500/15"
              : conflict.resolution.type === "skip"
                ? "bg-white/[0.02] border border-white/[0.03]"
                : "bg-amber-500/[0.06] border border-amber-500/15"
        }`}>
          {conflict.resolution.type === "backup_worker" && (
            <div className="flex items-center gap-2">
              <Users className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs text-emerald-400">Backup: {conflict.resolution.backup_worker_name || "Assigned"}</span>
              <ChevronRight className="w-3 h-3 text-emerald-500/40 ml-auto" />
            </div>
          )}
          {conflict.resolution.type === "unassigned" && (
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
              <span className="text-xs text-red-400">Requires manual assignment — shift will be created unassigned</span>
            </div>
          )}
          {conflict.resolution.type === "skip" && (
            <div className="flex items-center gap-2">
              <Ban className="w-3.5 h-3.5 text-zinc-500" />
              <span className="text-xs text-zinc-500">Shift will be skipped</span>
            </div>
          )}
          {conflict.resolution.type === "flag" && (
            <div className="flex items-center gap-2">
              <Flag className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs text-amber-400">Flagged for coordinator review</span>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
